package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.data.provider.QueryOutputProjection;
import datart.core.data.provider.sql.AggregateOperator;
import datart.core.data.provider.sql.FunctionColumn;
import datart.server.base.params.ViewExecuteParam;

import java.util.List;

/** Shared, fail-closed checks for chart-local computed fields. */
public final class ChartComputedFieldInspector {

    private ChartComputedFieldInspector() {
    }

    public static boolean isValidProjection(ViewExecuteParam param, QueryOutputProjection projection) {
        String technicalAlias = text(projection == null ? null : projection.getTechnicalAlias());
        if (technicalAlias == null || param == null) {
            return false;
        }

        List<FunctionColumn> functions = param.getFunctionColumns() == null
                ? List.of() : param.getFunctionColumns();
        if (uniqueFunction(functions, technicalAlias)) {
            return true;
        }

        List<AggregateOperator> aggregators = param.getAggregators() == null
                ? List.of() : param.getAggregators();
        List<AggregateOperator> matching = aggregators.stream()
                .filter(aggregator -> technicalAlias.equals(text(aggregator.getAlias())))
                .toList();
        if (matching.size() != 1) {
            return false;
        }

        String computedAlias = computedAlias(matching.get(0));
        return computedAlias != null && uniqueFunction(functions, computedAlias);
    }

    public static boolean isValidPersistedRow(ObjectNode row, JsonNode computedFields) {
        if (row == null || computedFields == null || !computedFields.isArray()) {
            return false;
        }
        String name = text(row.get("colName"));
        if (name == null) {
            return false;
        }
        int matches = 0;
        for (JsonNode definition : computedFields) {
            if (definition == null || !definition.isObject()
                    || !"computedField".equalsIgnoreCase(text(definition.get("category")))
                    || !name.equals(text(definition.get("name")))
                    || text(definition.get("expression")) == null) {
                continue;
            }
            matches++;
        }
        return matches == 1;
    }

    private static boolean uniqueFunction(List<FunctionColumn> functions, String alias) {
        return functions.stream()
                .filter(function -> alias.equals(text(function == null ? null : function.getAlias()))
                        && text(function == null ? null : function.getSnippet()) != null)
                .count() == 1;
    }

    private static String computedAlias(AggregateOperator aggregator) {
        if (aggregator == null) {
            return null;
        }
        String[] columns = aggregator.getColumnNames(false, null);
        return columns == null || columns.length != 1 ? null : text(columns[0]);
    }

    private static String text(JsonNode value) {
        return value == null ? null : text(value.asText(null));
    }

    private static String text(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
