package datart.server.common.fieldmeta;

import org.apache.calcite.avatica.util.Casing;
import org.apache.calcite.avatica.util.Quoting;
import org.apache.calcite.sql.SqlBasicCall;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlJoin;
import org.apache.calcite.sql.SqlKind;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.SqlWith;
import org.apache.calcite.sql.SqlWithItem;
import org.apache.calcite.sql.SqlOrderBy;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.parser.impl.SqlParserImpl;
import org.apache.calcite.sql.validate.SqlConformanceEnum;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

@Component
public class SqlFieldLineageResolver {

    private static final Pattern DATART_VARIABLE = Pattern.compile("\\$[A-Za-z_][A-Za-z0-9_]*\\$");

    public Map<String, SqlFieldLineage> resolve(String sql, SourceSchemaIndex.Index schema) {
        if (sql == null || sql.isBlank() || schema == null) {
            return Map.of();
        }
        try {
            // Lineage only needs SQL structure; execution replaces Datart variables later with the real value.
            String parseableSql = DATART_VARIABLE.matcher(sql.replaceFirst(";\\s*$", "")).replaceAll("0");
            SqlNode query = SqlParser.create(parseableSql, parserConfig()).parseQuery();
            SqlSelect select;
            List<TableReference> tables;
            if (query instanceof SqlWith with && (select = extractSelect(with.body)) != null) {
                tables = tables(select.getFrom(), cteTables(with));
            } else if ((select = extractSelect(query)) != null) {
                tables = tables(select.getFrom());
            } else {
                return Map.of();
            }
            if (tables.isEmpty()) {
                return Map.of();
            }
            Map<String, SqlFieldLineage> result = new LinkedHashMap<>();
            for (SqlNode selectItem : select.getSelectList()) {
                resolveSelectItem(selectItem, tables, schema).forEach(lineage ->
                        result.putIfAbsent(lineage.outputName(), lineage));
            }
            return result;
        } catch (Exception ignored) {
            // Unsupported SQL must remain untouched; never infer a source path from output names.
            return Map.of();
        }
    }

    private static SqlParser.Config parserConfig() {
        return SqlParser.config()
                .withParserFactory(SqlParserImpl.FACTORY)
                .withQuotedCasing(Casing.UNCHANGED)
                .withUnquotedCasing(Casing.UNCHANGED)
                .withConformance(SqlConformanceEnum.LENIENT)
                .withCaseSensitive(true)
                .withQuoting(Quoting.BACK_TICK);
    }

    private static List<SqlFieldLineage> resolveSelectItem(SqlNode node, List<TableReference> tables,
                                                            SourceSchemaIndex.Index schema) {
        if (node instanceof SqlIdentifier identifier) {
            if (identifier.isStar()) {
                return expandStar(identifier, tables, schema);
            }
            String outputName = last(identifier.names);
            return List.of(direct(outputName, identifier, tables, schema, Status.DIRECT_COLUMN));
        }
        if (node instanceof SqlBasicCall call && call.getKind() == SqlKind.AS) {
            SqlNode expression = call.operand(0);
            SqlNode alias = call.operand(1);
            if (expression instanceof SqlIdentifier identifier && !identifier.isStar()) {
                return List.of(direct(lastName(alias), identifier, tables, schema, Status.ALIASED_COLUMN));
            }
            return List.of(new SqlFieldLineage(lastName(alias), List.of(), expression.toString(), Status.EXPRESSION));
        }
        return List.of();
    }

    private static SqlFieldLineage direct(String outputName, SqlIdentifier identifier, List<TableReference> tables,
                                           SourceSchemaIndex.Index schema, Status status) {
        SourceSchemaIndex.ColumnMeta column;
        if (identifier.names.size() == 1) {
            List<SourceSchemaIndex.ColumnMeta> matches = matchingColumns(tables, identifier.names.get(0), schema);
            if (matches.size() != 1) {
                return new SqlFieldLineage(outputName, List.of(), identifier.toString(),
                        matches.isEmpty() ? Status.UNRESOLVED : Status.AMBIGUOUS);
            }
            column = matches.get(0);
        } else {
            TableReference table = tableFor(tables, identifier.names.subList(0, identifier.names.size() - 1));
            column = table == null ? null : schema.tableColumn(table.path(), last(identifier.names));
            if (column == null) {
                return new SqlFieldLineage(outputName, List.of(), identifier.toString(), Status.UNRESOLVED);
            }
        }
        return new SqlFieldLineage(outputName, path(column), identifier.toString(), status);
    }

    private static List<SqlFieldLineage> expandStar(SqlIdentifier identifier, List<TableReference> tables,
                                                     SourceSchemaIndex.Index schema) {
        TableReference table = identifier.names.size() <= 1
                ? tables.size() == 1 ? tables.get(0) : null
                : tableFor(tables, identifier.names.subList(0, identifier.names.size() - 1));
        if (table == null) {
            return List.of();
        }
        return schema.tableColumns(table.path()).stream()
                .map(column -> new SqlFieldLineage(column.column(), path(column), null, Status.STAR_EXPANDED))
                .toList();
    }

    private static List<SourceSchemaIndex.ColumnMeta> matchingColumns(List<TableReference> tables, String name,
                                                                         SourceSchemaIndex.Index schema) {
        return tables.stream()
                .map(table -> schema.tableColumn(table.path(), name))
                .filter(Objects::nonNull)
                .distinct()
                .toList();
    }

    private static List<TableReference> tables(SqlNode from) {
        return tables(from, Map.of());
    }

    private static List<TableReference> tables(SqlNode from, Map<String, TableReference> ctes) {
        if (from instanceof SqlJoin join) {
            List<TableReference> result = new ArrayList<>(tables(join.getLeft(), ctes));
            result.addAll(tables(join.getRight(), ctes));
            return result;
        }
        if (from instanceof SqlIdentifier identifier && !identifier.isStar()) {
            TableReference cte = identifier.names.size() == 1 ? ctes.get(key(last(identifier.names))) : null;
            if (cte != null) {
                return List.of(new TableReference(last(identifier.names), cte.path));
            }
            return List.of(new TableReference(last(identifier.names), identifier.names));
        }
        if (from instanceof SqlBasicCall call && call.getKind() == SqlKind.AS
                && call.operand(0) instanceof SqlIdentifier table) {
            TableReference cte = table.names.size() == 1 ? ctes.get(key(last(table.names))) : null;
            if (cte != null) {
                return List.of(new TableReference(lastName(call.operand(1)), cte.path));
            }
            return List.of(new TableReference(lastName(call.operand(1)), table.names));
        }
        if (from instanceof SqlBasicCall call && call.getKind() == SqlKind.AS
                && isSingleSourceSelectStar(extractSelect(call.operand(0)))) {
            SqlSelect select = extractSelect(call.operand(0));
            List<TableReference> nested = tables(select.getFrom(), ctes);
            return nested.size() == 1
                    ? List.of(new TableReference(lastName(call.operand(1)), nested.get(0).path))
                    : List.of();
        }
        return List.of();
    }

    private static Map<String, TableReference> cteTables(SqlWith with) {
        Map<String, TableReference> result = new LinkedHashMap<>();
        for (SqlNode node : with.withList) {
            SqlSelect select = node instanceof SqlWithItem cteItem ? extractSelect(cteItem.query) : null;
            if (!(node instanceof SqlWithItem item)
                    || (item.columnList != null && item.columnList.size() > 0)
                    || !isSingleSourceSelectStar(select)) {
                continue;
            }
            List<TableReference> sources = tables(select.getFrom(), result);
            if (sources.size() == 1) {
                result.put(key(last(item.name.names)),
                        new TableReference(last(item.name.names), sources.get(0).path));
            }
        }
        return result;
    }

    private static SqlSelect extractSelect(SqlNode node) {
        if (node instanceof SqlSelect select) {
            return select;
        }
        return node instanceof SqlOrderBy orderBy && orderBy.query instanceof SqlSelect select ? select : null;
    }

    private static boolean isSingleSourceSelectStar(SqlSelect select) {
        return select != null
                && select.getSelectList().size() == 1
                && select.getSelectList().get(0) instanceof SqlIdentifier star
                && star.isStar();
    }

    private static TableReference tableFor(List<TableReference> tables, List<String> qualifier) {
        List<TableReference> matches = tables.stream().filter(table -> table.matches(qualifier)).toList();
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private static String lastName(SqlNode node) {
        return node instanceof SqlIdentifier identifier ? last(identifier.names) : node.toString();
    }

    private static String last(List<String> names) {
        return names.get(names.size() - 1);
    }

    private static List<String> path(SourceSchemaIndex.ColumnMeta column) {
        return column.database() == null || column.database().isBlank()
                ? List.of(column.table(), column.column())
                : List.of(column.database(), column.table(), column.column());
    }

    public record SqlFieldLineage(String outputName, List<String> sourcePath, String expression, Status status) {
        public boolean hasPhysicalPath() {
            return status == Status.DIRECT_COLUMN || status == Status.ALIASED_COLUMN || status == Status.STAR_EXPANDED;
        }
    }

    public enum Status {
        DIRECT_COLUMN,
        ALIASED_COLUMN,
        STAR_EXPANDED,
        EXPRESSION,
        AMBIGUOUS,
        UNRESOLVED
    }

    private record TableReference(String alias, List<String> path) {
        private boolean matches(List<String> qualifier) {
            if (qualifier.size() == 1 && equalsIgnoreCase(alias, qualifier.get(0))) {
                return true;
            }
            if (path.size() != qualifier.size()) {
                return false;
            }
            for (int index = 0; index < path.size(); index++) {
                if (!equalsIgnoreCase(path.get(index), qualifier.get(index))) {
                    return false;
                }
            }
            return true;
        }
    }

    private static boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.toLowerCase(Locale.ROOT).equals(right.toLowerCase(Locale.ROOT));
    }

    private static String key(String value) {
        return value.toLowerCase(Locale.ROOT);
    }
}
