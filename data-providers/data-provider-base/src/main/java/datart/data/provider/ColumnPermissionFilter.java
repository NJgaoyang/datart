package datart.data.provider;

import datart.core.data.provider.*;
import datart.core.data.provider.sql.*;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.util.SqlShuttle;
import org.apache.commons.lang3.StringUtils;

import java.util.*;

/**
 * Fail-closed output-column permission matching. Query aliases are output
 * transport names, never authorization identities. Computed fields must have
 * ONLY permitted source identifiers; unreadable expressions are denied.
 */
public final class ColumnPermissionFilter {

    private ColumnPermissionFilter() { }

    public static void mask(Dataframe data, ExecuteParam param) {
        if (data == null || data.getColumns() == null || param == null
                || param.getIncludeColumns() == null) return;

        Set<String> authorized = new HashSet<>();
        boolean unrestricted = false;
        for (SelectColumn selected : param.getIncludeColumns()) {
            if (selected == null) continue;
            String key = selected.getColumnKey();
            if (StringUtils.isBlank(key)) continue;
            if ("*".equals(key)) {
                unrestricted = true;
                break;
            }
            authorized.add(key);
        }
        if (unrestricted) return;

        List<String> selectedInputs = new ArrayList<>();
        if (param.getColumns() != null) {
            for (SelectColumn item : param.getColumns()) selectedInputs.add(item.getColumnKey());
        }
        if (param.getGroups() != null) {
            for (GroupByOperator item : param.getGroups()) selectedInputs.add(item.getColumnKey());
        }
        if (param.getAggregators() != null) {
            for (AggregateOperator item : param.getAggregators()) selectedInputs.add(item.getColumnKey());
        }
        Map<String, String> functions = new HashMap<>();
        if (param.getFunctionColumns() != null) {
            for (FunctionColumn item : param.getFunctionColumns()) {
                if (item != null && StringUtils.isNotBlank(item.getAlias())) {
                    functions.put(item.getAlias(), item.getSnippet());
                }
            }
        }
        Map<Integer, QueryOutputProjection> projections = new HashMap<>();
        if (param.getOutputProjections() != null) {
            for (QueryOutputProjection item : param.getOutputProjections()) {
                if (item != null && item.getOrdinal() != null) {
                    projections.put(item.getOrdinal(), item);
                }
            }
        }

        List<Integer> denied = new ArrayList<>();
        for (int index = 0; index < data.getColumns().size(); index++) {
            Column output = data.getColumns().get(index);
            String rawName = output.columnKey();
            QueryOutputProjection projection = projections.get(index);
            String source = null;
            if (projection != null) {
                String mapped = projection.getTechnicalAlias();
                // Never interpret an unverified alias/ordinal as a grant.
                if (StringUtils.equalsIgnoreCase(rawName, QueryOutputAlias.of(index))
                        || StringUtils.equalsIgnoreCase(rawName, mapped)) {
                    if (index < selectedInputs.size()) {
                        source = selectedInputs.get(index);
                    }
                    if (source == null && functions.containsKey(mapped)) source = mapped;
                }
            } else if (index < selectedInputs.size()) {
                source = selectedInputs.get(index);
            }
            if (source == null && !rawName.startsWith("__fcol_")) source = rawName;
            if (source == null || !isPermitted(source, functions, authorized, new HashSet<>())) {
                denied.add(index);
            }
        }

        if (denied.isEmpty() || data.getRows() == null) return;
        for (List<Object> row : data.getRows()) {
            for (int index : denied) {
                if (index < row.size()) row.set(index, null);
            }
        }
    }

    private static boolean isPermitted(String source, Map<String, String> functions,
                                       Set<String> allowed, Set<String> visiting) {
        if (!functions.containsKey(source)) return allowed.contains(source);
        if (!visiting.add(source)) return false;
        String expression = functions.get(source);
        if (StringUtils.isBlank(expression)) return false;
        Set<String> references = new HashSet<>();
        try {
            SqlNode statement = SqlParser.create("SELECT " + expression).parseQuery();
            statement.accept(new SqlShuttle() {
                @Override
                public SqlNode visit(SqlIdentifier id) {
                    if (id.isStar()) {
                        references.add("*");
                    } else {
                        references.add(String.join(".", id.names));
                    }
                    return id;
                }
            });
        } catch (Exception e) {
            // Never grant read access when computed-field lineage is unknown.
            return false;
        }
        for (String reference : references) {
            if (!isPermitted(reference, functions, allowed, visiting)) return false;
        }
        visiting.remove(source);
        return true;
    }
}
