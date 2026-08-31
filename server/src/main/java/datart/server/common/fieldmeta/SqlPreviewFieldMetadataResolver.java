/*
 * Datart
 *
 * Licensed under the Apache License, Version 2.0
 */
package datart.server.common.fieldmeta;

import datart.core.data.provider.Column;
import datart.core.data.provider.PreviewFieldMeta;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Builds the same conservative physical-comment metadata used by SQL ViewField reconciliation. */
@Component
public class SqlPreviewFieldMetadataResolver {

    private final SqlFieldLineageResolver lineageResolver;

    public SqlPreviewFieldMetadataResolver(SqlFieldLineageResolver lineageResolver) {
        this.lineageResolver = lineageResolver;
    }

    public List<PreviewFieldMeta> resolve(String sql, List<Column> columns, SourceSchemaIndex.Index schema) {
        if (columns == null || columns.isEmpty()) {
            return List.of();
        }
        Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages =
                lineageResolver.resolve(sql, schema);
        List<PreviewFieldMeta> result = new ArrayList<>(columns.size());
        for (Column column : columns) {
            String originName = column == null || column.getName() == null || column.getName().length == 0
                    ? null : column.columnName();
            if (originName == null || originName.isBlank()) {
                continue;
            }
            SqlFieldLineageResolver.SqlFieldLineage lineage = findLineage(lineages, originName);
            PreviewFieldMeta meta = new PreviewFieldMeta();
            meta.setOriginName(originName);
            meta.setType(column.getType() == null ? null : column.getType().name());
            if (lineage != null) {
                meta.setCategory(lineage.status().name());
                meta.setExpression(lineage.expression());
            }
            if (lineage != null && lineage.hasPhysicalPath()) {
                meta.setSourcePath(lineage.sourcePath());
                SourceSchemaIndex.ColumnMeta source = schema == null ? null : schema.exact(lineage.sourcePath());
                String comment = trim(source == null ? null : source.comment());
                meta.setSourceComment(comment);
                meta.setDisplayName(comment == null ? originName : comment);
            } else {
                // Expressions, ambiguous fields and unresolved fields must not inherit a source comment.
                meta.setSourcePath(List.of());
                meta.setDisplayName(originName);
            }
            result.add(meta);
        }
        return result;
    }

    private static SqlFieldLineageResolver.SqlFieldLineage findLineage(
            Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages, String name) {
        SqlFieldLineageResolver.SqlFieldLineage exact = lineages.get(name);
        if (exact != null) {
            return exact;
        }
        return lineages.entrySet().stream()
                .filter(entry -> entry.getKey().equalsIgnoreCase(name))
                .map(Map.Entry::getValue)
                .findFirst()
                .orElse(null);
    }

    private static String trim(String value) {
        String trimmed = value == null ? null : value.trim();
        return trimmed == null || trimmed.isEmpty() ? null : trimmed;
    }
}
