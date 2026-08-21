package datart.data.provider.calcite;

import datart.core.base.consts.ValueType;
import datart.core.base.consts.VariableTypeEnum;
import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.QueryScript;
import datart.core.data.provider.ScriptType;
import datart.core.data.provider.ScriptVariable;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import datart.data.provider.jdbc.SqlScriptRender;
import datart.data.provider.script.SqlStringUtils;
import org.apache.calcite.sql.SqlNode;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlCompatibilitySuiteTest {

    private final StarRocksSqlStdOperatorSupport dialect = new StarRocksSqlStdOperatorSupport();

    @Test
    void parsesQuotedOutputAliasesButRejectsUnquotedAliasesStartingWithDigits() throws Exception {
        String quoted = "SELECT amount AS `48V_battery_ratio` FROM daily_report";
        String rendered = parse(quoted).toSqlString(dialect).getSql();

        assertTrue(rendered.contains("`48V_battery_ratio`"));
        assertThrows(Exception.class,
                () -> parse("SELECT amount AS 48V_battery_ratio FROM daily_report"));
    }

    @Test
    void parsesComplexJoinCaseSubqueryAndQuotedAlias() throws Exception {
        String sql = """
                SELECT t1.*,
                       t2.renting_users,
                       CASE
                           WHEN t2.renting_48v = 0 THEN NULL
                           ELSE ROUND(t1.batt_48v_count / t2.renting_48v, 2)
                       END AS `48V_battery_ratio`
                FROM s_battery_daily_report t1
                LEFT JOIN s_user_daily_report t2
                  ON t1.created_date = t2.created_date
                 AND t1.city = t2.city
                WHERE t1.city IN (
                    SELECT city_name
                    FROM ads_user_city_permission
                    WHERE username_en = 'alice'
                )
                GROUP BY t1.created_date, t1.city, t2.renting_users,
                         t2.renting_48v, t1.batt_48v_count
                HAVING COUNT(*) > 0
                ORDER BY t1.created_date
                LIMIT 100 OFFSET 10
                """;

        String rendered = parse(sql).toSqlString(dialect).getSql().toUpperCase(Locale.ROOT);

        assertTrue(rendered.contains("LEFT JOIN"));
        assertTrue(rendered.contains("CASE"));
        assertTrue(rendered.contains("ROUND"));
        assertTrue(rendered.contains("IN"));
        assertTrue(rendered.contains("GROUP BY"));
        assertTrue(rendered.contains("HAVING"));
        assertTrue(rendered.contains("ORDER BY"));
        assertTrue(rendered.contains("LIMIT"));
        assertTrue(rendered.contains("OFFSET"));
        assertTrue(rendered.contains("48V_BATTERY_RATIO"));
    }

    @Test
    void parsesCteUnionExistsWindowAndStarRocksFunctions() throws Exception {
        String sql = SqlStringUtils.convertBitwiseAndOperator("""
                WITH ranked AS (
                    SELECT city,
                           amount,
                           ROW_NUMBER() OVER (PARTITION BY city ORDER BY created_at DESC) AS rn
                    FROM daily_report
                )
                SELECT city,
                       amount,
                       flags & 1
                FROM ranked r
                WHERE EXISTS (
                    SELECT 1 FROM city_permission p WHERE p.city = r.city
                )
                UNION ALL
                SELECT city, NULL, NULL, NULL, NULL FROM archived_report
                """);

        String rendered = parse(sql).toSqlString(dialect).getSql().toUpperCase(Locale.ROOT);

        assertTrue(rendered.contains("WITH"));
        assertTrue(rendered.contains("UNION ALL"));
        assertTrue(rendered.contains("EXISTS"));
        assertTrue(rendered.contains("ROW_NUMBER"));
        assertTrue(rendered.contains("BITAND"));

    }

    @Test
    void preservesSpecialFunctionCompatibilityPaths() throws Exception {
        String dateTrunc = renderExpression("DATE_TRUNC('day', created_at)");
        String timeSlice = renderExpression("TIME_SLICE(created_at, INTERVAL 15 MINUTE)");
        String percentile = SqlParserUtils.parseSnippet("PERCENTILE_APPROX(amount, 0.5)")
                .toSqlString(dialect).getSql().toUpperCase(Locale.ROOT);

        assertTrue(dateTrunc.contains("DATE_TRUNC"));
        assertTrue(timeSlice.contains("TIME_SLICE"));
        assertTrue(percentile.contains("PERCENTILE_APPROX"));
    }

    @Test
    void resolvesDatartPermissionVariableBeforeRenderingSql() throws Exception {
        ScriptVariable username = new ScriptVariable(
                "DATART_USER_USERNAME",
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                Set.of("alice"),
                false);
        QueryScript queryScript = QueryScript.builder()
                .scriptType(ScriptType.SQL)
                .script("""
                        SELECT city
                        FROM daily_report
                        WHERE city IN (
                            SELECT city_name
                            FROM ads_user_city_permission
                            WHERE username_en = $DATART_USER_USERNAME$
                        )
                        """)
                .variables(List.of(username))
                .build();

        String rendered = new SqlScriptRender(
                queryScript, ExecuteParam.empty(), dialect, false, false)
                .render(false, false, false);

        assertTrue(rendered.contains("'alice'"));
        assertFalse(rendered.contains("$DATART_USER_USERNAME$"));
        assertTrue(rendered.toUpperCase(Locale.ROOT).contains("IN"));
    }

    private SqlNode parse(String sql) throws Exception {
        return SqlParserUtils.createParser(sql, dialect).parseQuery();
    }

    private String renderExpression(String expression) throws Exception {
        return parse("SELECT " + expression + " FROM daily_report")
                .toSqlString(dialect).getSql().toUpperCase(Locale.ROOT);
    }
}
