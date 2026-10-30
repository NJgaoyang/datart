package datart.data.provider.calcite;

import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.SelectColumn;
import datart.core.data.provider.sql.FunctionColumn;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlBuilderComputedFieldIdentityTest {

    @Test
    void bareQualifiedFieldKeepsTheSelectedJoinSource() throws Exception {
        String sql = build("[sales].[refunds].[amount]", joinSource());

        assertTrue(sql.contains("`t1`.`amount` AS `computed_value`"), sql);
        assertFalse(sql.contains("`sales`.`refunds`.`amount`"), sql);
        assertFalse(sql.contains("`t0`.`amount`"), sql);
    }

    @Test
    void qualifiedFunctionArgumentsKeepBothJoinSources() throws Exception {
        String sql = build(
                "SUM([sales].[orders].[amount]) - SUM([sales].[refunds].[amount])",
                joinSource());

        assertTrue(sql.contains("SUM(`t0`.`amount`)"), sql);
        assertTrue(sql.contains("SUM(`t1`.`amount`)"), sql);
    }

    @Test
    void legacyUnqualifiedFieldIsNotGuessedFromTheFirstJoinTable() throws Exception {
        String sql = build("[amount]", joinSource());

        assertTrue(sql.contains("`amount` AS `computed_value`"), sql);
        assertFalse(sql.contains("`t0`.`amount`"), sql);
        assertFalse(sql.contains("`t1`.`amount`"), sql);
    }

    @Test
    void sqlViewOutputWithALiteralDotRemainsOneIdentifier() throws Exception {
        QueryScriptProcessResult source = new QueryScriptProcessResult();
        source.setFrom(new SqlIdentifier("DATART_VTABLE", SqlParserPos.ZERO));
        String sql = build("[orders.amount]", source);

        assertTrue(sql.contains("`orders.amount` AS `computed_value`"), sql);
        assertFalse(sql.contains("`orders`.`amount`"), sql);
    }

    private QueryScriptProcessResult joinSource() throws Exception {
        StarRocksSqlStdOperatorSupport dialect = new StarRocksSqlStdOperatorSupport();
        SqlSelect query = (SqlSelect) SqlParserUtils.createParser(
                "SELECT * FROM sales.orders AS t0 JOIN sales.refunds AS t1 "
                        + "ON t0.id = t1.order_id", dialect).parseQuery();
        QueryScriptProcessResult source = new QueryScriptProcessResult();
        source.setFrom(query.getFrom());
        Map<String, String> aliases = new LinkedHashMap<>();
        TableAliasResolver.register(aliases, new String[]{"sales", "orders"}, "t0");
        TableAliasResolver.register(aliases, new String[]{"sales", "refunds"}, "t1");
        source.setTableAlias(aliases);
        return source;
    }

    private String build(String expression, QueryScriptProcessResult source) throws Exception {
        FunctionColumn computed = new FunctionColumn();
        computed.setAlias("computed_value");
        computed.setSnippet(expression);
        return SqlBuilder.builder()
                .withQueryScriptProcessResult(source)
                .withExecuteParam(ExecuteParam.builder()
                        .columns(List.of(SelectColumn.of("computed_value", "computed_value")))
                        .functionColumns(List.of(computed))
                        .build())
                .withDialect(new StarRocksSqlStdOperatorSupport())
                .withQuoteIdentifiers(true)
                .build();
    }
}
