package datart.core.data.provider;

import java.util.ArrayList;
import java.util.Collections;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** One compatibility-safe registry; the old enum support API remains unchanged. */
public final class FunctionDefinitionRegistry {

    private static final Map<StdSqlOperator, FunctionDefinition> DEFINITIONS = new EnumMap<>(StdSqlOperator.class);

    static {
        for (StdSqlOperator operator : StdSqlOperator.values()) {
            DEFINITIONS.put(operator, new FunctionDefinition(operator.getSymbol(), 1, Integer.MAX_VALUE, "ANY", null));
        }
        define(StdSqlOperator.SUM, 1, 1, "NUMERIC");
        define(StdSqlOperator.AVG, 1, 1, "NUMERIC");
        define(StdSqlOperator.MAX, 1, 1, "ANY");
        define(StdSqlOperator.MIN, 1, 1, "ANY");
        define(StdSqlOperator.COUNT, 1, 1, "NUMERIC");
        define(StdSqlOperator.DISTINCT, 1, 1, "ANY");
        define(StdSqlOperator.VAR, 1, 1, "NUMERIC");
        define(StdSqlOperator.STDDEV, 1, 1, "NUMERIC");
        define(StdSqlOperator.MEDIAN, 1, 1, "NUMERIC");
        DEFINITIONS.put(StdSqlOperator.PERCENTILE_APPROX,
                new FunctionDefinition("PERCENTILE_APPROX", 2, 3, "DOUBLE", null));
        DEFINITIONS.put(StdSqlOperator.TIME_SLICE,
                new FunctionDefinition("TIME_SLICE", 2, 3, "DATETIME", "2.3.0"));

        define(StdSqlOperator.ABS, 1, 1, "NUMERIC");
        define(StdSqlOperator.CEILING, 1, 1, "NUMERIC");
        define(StdSqlOperator.FLOOR, 1, 1, "NUMERIC");
        define(StdSqlOperator.POWER, 2, 2, "NUMERIC");
        define(StdSqlOperator.ROUND, 1, 2, "NUMERIC");
        define(StdSqlOperator.SQRT, 1, 1, "NUMERIC");
        define(StdSqlOperator.EXP, 1, 1, "NUMERIC");
        define(StdSqlOperator.LOG10, 1, 1, "NUMERIC");
        define(StdSqlOperator.LN, 1, 1, "NUMERIC");
        define(StdSqlOperator.MOD, 2, 2, "NUMERIC");
        define(StdSqlOperator.RAND, 0, 1, "NUMERIC");
        define(StdSqlOperator.DEGREES, 1, 1, "NUMERIC");
        define(StdSqlOperator.RADIANS, 1, 1, "NUMERIC");
        define(StdSqlOperator.TRUNC, 1, 2, "NUMERIC");
        define(StdSqlOperator.SIGN, 1, 1, "NUMERIC");
        define(StdSqlOperator.ACOS, 1, 1, "NUMERIC");
        define(StdSqlOperator.ASIN, 1, 1, "NUMERIC");
        define(StdSqlOperator.ATAN, 1, 1, "NUMERIC");
        define(StdSqlOperator.ATAN2, 2, 2, "NUMERIC");
        define(StdSqlOperator.SIN, 1, 1, "NUMERIC");
        define(StdSqlOperator.COS, 1, 1, "NUMERIC");
        define(StdSqlOperator.TAN, 1, 1, "NUMERIC");
        define(StdSqlOperator.COT, 1, 1, "NUMERIC");

        define(StdSqlOperator.LENGTH, 1, 1, "NUMERIC");
        define(StdSqlOperator.CONCAT, 2, Integer.MAX_VALUE, "STRING");
        define(StdSqlOperator.REPLACE, 3, 3, "STRING");
        define(StdSqlOperator.SUBSTRING, 2, 3, "STRING");
        define(StdSqlOperator.LOWER, 1, 1, "STRING");
        define(StdSqlOperator.UPPER, 1, 1, "STRING");
        define(StdSqlOperator.LTRIM, 1, 1, "STRING");
        define(StdSqlOperator.RTRIM, 1, 1, "STRING");
        define(StdSqlOperator.TRIM, 1, 1, "STRING");

        define(StdSqlOperator.NOW, 0, 0, "DATETIME");
        define(StdSqlOperator.SECOND, 1, 1, "NUMERIC");
        define(StdSqlOperator.MINUTE, 1, 1, "NUMERIC");
        define(StdSqlOperator.HOUR, 1, 1, "NUMERIC");
        define(StdSqlOperator.DAY, 1, 1, "NUMERIC");
        define(StdSqlOperator.WEEK, 1, 1, "NUMERIC");
        define(StdSqlOperator.QUARTER, 1, 1, "NUMERIC");
        define(StdSqlOperator.MONTH, 1, 1, "NUMERIC");
        define(StdSqlOperator.YEAR, 1, 1, "NUMERIC");
        define(StdSqlOperator.DAY_OF_WEEK, 1, 1, "NUMERIC");
        define(StdSqlOperator.DAY_OF_MONTH, 1, 1, "NUMERIC");
        define(StdSqlOperator.DAY_OF_YEAR, 1, 1, "NUMERIC");
        for (StdSqlOperator operator : new StdSqlOperator[]{
                StdSqlOperator.AGG_DATE_YEAR, StdSqlOperator.AGG_DATE_QUARTER,
                StdSqlOperator.AGG_DATE_MONTH, StdSqlOperator.AGG_DATE_WEEK,
                StdSqlOperator.AGG_DATE_DAY, StdSqlOperator.AGG_DATE_HOUR,
                StdSqlOperator.AGG_DATE_MINUTE, StdSqlOperator.AGG_DATE_SECOND,
        }) {
            define(operator, 1, 1, "STRING");
        }
        for (StdSqlOperator operator : new StdSqlOperator[]{
                StdSqlOperator.AGG_DATE_YEAR_NATIVE, StdSqlOperator.AGG_DATE_QUARTER_NATIVE,
                StdSqlOperator.AGG_DATE_MONTH_NATIVE, StdSqlOperator.AGG_DATE_WEEK_NATIVE,
                StdSqlOperator.AGG_DATE_DAY_NATIVE}) {
            define(operator, 1, 1, "DATE");
        }
        for (StdSqlOperator operator : new StdSqlOperator[]{
                StdSqlOperator.AGG_DATE_HOUR_NATIVE, StdSqlOperator.AGG_DATE_MINUTE_NATIVE,
                StdSqlOperator.AGG_DATE_SECOND_NATIVE}) {
            define(operator, 1, 1, "DATETIME");
        }
        define(StdSqlOperator.IF, 3, 3, "ANY");
        define(StdSqlOperator.COALESCE, 1, Integer.MAX_VALUE, "ANY");
        define(StdSqlOperator.ADD, 2, 2, "NUMERIC");
        define(StdSqlOperator.SUBTRACT, 2, 2, "NUMERIC");
        define(StdSqlOperator.MULTIPLY, 2, 2, "NUMERIC");
        define(StdSqlOperator.DIVIDE, 2, 2, "NUMERIC");
        define(StdSqlOperator.EQUALS, 2, 2, "BOOLEAN");
        define(StdSqlOperator.NOT_EQUALS, 2, 2, "BOOLEAN");
        define(StdSqlOperator.GREETER_THAN, 2, 2, "BOOLEAN");
        define(StdSqlOperator.GREETER_THAN_EQ, 2, 2, "BOOLEAN");
        define(StdSqlOperator.LESS_THAN, 2, 2, "BOOLEAN");
        define(StdSqlOperator.LESS_THAN_EQ, 2, 2, "BOOLEAN");
    }

    private static void define(StdSqlOperator operator, int minArgs, int maxArgs, String returnType) {
        DEFINITIONS.put(operator, new FunctionDefinition(operator.getSymbol(), minArgs, maxArgs, returnType, null));
    }

    private FunctionDefinitionRegistry() {
    }

    public static FunctionDefinition definition(StdSqlOperator operator) {
        return DEFINITIONS.get(operator);
    }

    public static List<FunctionDefinition> supported(Set<StdSqlOperator> operators) {
        if (operators == null || operators.isEmpty()) {
            return Collections.emptyList();
        }
        List<FunctionDefinition> result = new ArrayList<>();
        for (StdSqlOperator operator : StdSqlOperator.values()) {
            if (operators.contains(operator)) {
                result.add(DEFINITIONS.get(operator));
            }
        }
        return result;
    }
}
