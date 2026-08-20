package datart.data.provider.jdbc;

import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.QueryOutputProjection;
import datart.core.data.provider.QueryScript;
import datart.core.data.provider.ScriptType;
import datart.core.data.provider.SelectColumn;
import datart.core.data.provider.sql.AggregateOperator;
import datart.core.data.provider.sql.FunctionColumn;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlScriptRenderProjectionTest {

    @Test
    void keepsTechnicalIdentityInsideAndUsesBusinessAliasOnlyOutside() throws Exception {
        QueryOutputProjection projection = new QueryOutputProjection();
        projection.setTechnicalAlias("city");
        projection.setDisplayAlias("推荐官城市");
        projection.setOrdinal(0);

        SqlScriptRender render = new SqlScriptRender(
                QueryScript.builder()
                        .scriptType(ScriptType.SQL)
                        .script("SELECT city FROM ads.users")
                        .variables(List.of())
                        .build(),
                ExecuteParam.builder()
                        .columns(List.of(SelectColumn.of("city", "city")))
                        .outputProjections(List.of(projection))
                        .build(),
                new StarRocksSqlStdOperatorSupport());

        String sql = render.render(true, false, false);

        assertTrue(sql.contains("AS `推荐官城市`"));
        assertTrue(sql.contains("`DATART_RESULT`.`DATART_RESULT_COL_0`"));
        assertTrue(sql.contains("AS `DATART_RESULT_COL_0`"));
        assertFalse(render.render(true, false, true).contains("推荐官城市"));
    }

    @Test
    void quotesDateLevelTechnicalAlias() throws Exception {
        QueryOutputProjection projection = new QueryOutputProjection();
        projection.setTechnicalAlias("root.birthday@date_level_delimiter@AGG_DATE_YEAR");
        projection.setDisplayAlias("年份");
        projection.setOrdinal(0);

        String sql = new SqlScriptRender(
                QueryScript.builder()
                        .scriptType(ScriptType.SQL)
                        .script("SELECT birthday FROM ads.users")
                        .variables(List.of())
                        .build(),
                ExecuteParam.builder()
                        .functionColumns(List.of(functionColumn(
                                "root.birthday@date_level_delimiter@AGG_DATE_YEAR", "YEAR(birthday)")))
                        .aggregators(List.of(technicalColumn("root.birthday@date_level_delimiter@AGG_DATE_YEAR")))
                        .outputProjections(List.of(projection))
                        .build(),
                new StarRocksSqlStdOperatorSupport(), false, false)
                .render(true, false, false);

        assertTrue(sql.contains("`DATART_RESULT`.`DATART_RESULT_COL_0`"));
        assertTrue(sql.contains("AS `DATART_RESULT_COL_0`"));
        assertTrue(sql.contains("AS `年份`"));
    }

    @Test
    void quotesAggregateTechnicalAlias() throws Exception {
        QueryOutputProjection projection = new QueryOutputProjection();
        projection.setTechnicalAlias("SUM(renting_users)");
        projection.setDisplayAlias("在租用户数");
        projection.setOrdinal(0);

        String sql = new SqlScriptRender(
                QueryScript.builder()
                        .scriptType(ScriptType.SQL)
                        .script("SELECT SUM(renting_users) AS `SUM(renting_users)` FROM ads.users")
                        .variables(List.of())
                        .build(),
                ExecuteParam.builder()
                        .aggregators(List.of(technicalColumn("renting_users", AggregateOperator.SqlOperator.SUM,
                                "SUM(renting_users)")))
                        .outputProjections(List.of(projection))
                        .build(),
                new StarRocksSqlStdOperatorSupport(), false, false)
                .render(true, false, false);

        assertTrue(sql.contains("`DATART_RESULT`.`DATART_RESULT_COL_0`"));
        assertTrue(sql.contains("AS `DATART_RESULT_COL_0`"));
        assertTrue(sql.contains("AS `在租用户数`"));
    }

    private static AggregateOperator technicalColumn(String... column) {
        AggregateOperator aggregate = new AggregateOperator();
        aggregate.setColumn(column);
        aggregate.setAlias(column[0]);
        return aggregate;
    }

    private static AggregateOperator technicalColumn(String column,
                                                     AggregateOperator.SqlOperator operator,
                                                     String alias) {
        AggregateOperator aggregate = new AggregateOperator();
        aggregate.setColumn(column);
        aggregate.setSqlOperator(operator);
        aggregate.setAlias(alias);
        return aggregate;
    }

    private static FunctionColumn functionColumn(String alias, String snippet) {
        FunctionColumn functionColumn = new FunctionColumn();
        functionColumn.setAlias(alias);
        functionColumn.setSnippet(snippet);
        return functionColumn;
    }
}
