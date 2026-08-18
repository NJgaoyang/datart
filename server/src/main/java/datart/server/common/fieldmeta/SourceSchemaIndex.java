package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.data.provider.Column;
import datart.core.data.provider.SchemaItem;
import datart.core.data.provider.TableInfo;
import datart.core.entity.SourceSchemas;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Component
public class SourceSchemaIndex {

    private final SourceSchemasMapperExt sourceSchemasMapper;
    private final ObjectMapper objectMapper;
    private final Map<String, Index> cache = new HashMap<>();

    public SourceSchemaIndex(SourceSchemasMapperExt sourceSchemasMapper, ObjectMapper objectMapper) {
        this.sourceSchemasMapper = sourceSchemasMapper;
        this.objectMapper = objectMapper;
    }

    public synchronized Index forSource(String sourceId) {
        if (sourceId == null) {
            return Index.empty();
        }
        return cache.computeIfAbsent(sourceId, this::load);
    }

    private Index load(String sourceId) {
        SourceSchemas sourceSchemas = sourceSchemasMapper.selectBySource(sourceId);
        if (sourceSchemas == null || sourceSchemas.getSchemas() == null || sourceSchemas.getSchemas().isBlank()) {
            return Index.empty();
        }
        try {
            List<SchemaItem> schemas = objectMapper.readValue(sourceSchemas.getSchemas(),
                    objectMapper.getTypeFactory().constructCollectionType(List.class, SchemaItem.class));
            Map<String, List<ColumnMeta>> columns = new HashMap<>();
            for (SchemaItem schema : schemas) {
                if (schema == null || schema.getTables() == null) {
                    continue;
                }
                for (TableInfo table : schema.getTables()) {
                    if (table == null || table.getColumns() == null) {
                        continue;
                    }
                    for (Column column : table.getColumns()) {
                        if (column == null || column.getName() == null || column.getName().length == 0) {
                            continue;
                        }
                        String[] name = column.getName();
                        String db = schema.getDbName();
                        String tableName = name.length > 1 ? name[name.length - 2] : table.getTableName();
                        String columnName = name[name.length - 1];
                        add(columns, key(db, tableName, columnName), new ColumnMeta(db, tableName, columnName, column.getComment()));
                    }
                }
            }
            return new Index(columns);
        } catch (Exception e) {
            return Index.invalid(e.getMessage());
        }
    }

    private static void add(Map<String, List<ColumnMeta>> columns, String key, ColumnMeta value) {
        columns.computeIfAbsent(key, ignored -> new ArrayList<>()).add(value);
    }

    private static String key(String db, String table, String column) {
        return normalize(db) + "\u0000" + normalize(table) + "\u0000" + normalize(column);
    }

    private static String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    public record ColumnMeta(String database, String table, String column, String comment) {
    }

    public static final class Index {
        private final Map<String, List<ColumnMeta>> columns;
        private final String error;

        private Index(Map<String, List<ColumnMeta>> columns) {
            this(columns, null);
        }

        private Index(Map<String, List<ColumnMeta>> columns, String error) {
            this.columns = columns;
            this.error = error;
        }

        static Index empty() {
            return new Index(Map.of());
        }

        static Index invalid(String error) {
            return new Index(Map.of(), error);
        }

        public String getError() {
            return error;
        }

        public ColumnMeta exact(List<String> path) {
            if (path == null || path.size() < 2) {
                return null;
            }
            String column = path.get(path.size() - 1);
            String table = path.get(path.size() - 2);
            if (path.size() == 2) {
                List<ColumnMeta> matches = columns.values().stream()
                        .flatMap(List::stream)
                        .filter(item -> normalize(item.table()).equals(normalize(table))
                                && normalize(item.column()).equals(normalize(column)))
                        .toList();
                return matches.size() == 1 ? matches.get(0) : null;
            }
            String db = path.size() >= 3 ? path.get(path.size() - 3) : "";
            List<ColumnMeta> matches = columns.get(key(db, table, column));
            if (matches == null || matches.size() != 1) {
                return null;
            }
            return matches.get(0);
        }
    }
}
