package datart.data.provider.calcite;

import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.sql.AggregateOperator;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlBuilderAggregateTest {

    @Test
    void shouldRenderNewSingleArgumentAggregates() throws Exception {
        assertAggregate(AggregateOperator.SqlOperator.STDDEV, "STDDEV");
        assertAggregate(AggregateOperator.SqlOperator.VARIANCE, "VARIANCE");
        assertAggregate(AggregateOperator.SqlOperator.APPROX_COUNT_DISTINCT, "APPROX_COUNT_DISTINCT");
    }

    private void assertAggregate(AggregateOperator.SqlOperator operator, String function) throws Exception {
        AggregateOperator aggregate = new AggregateOperator();
        aggregate.setColumn("amount");
        aggregate.setSqlOperator(operator);

        QueryScriptProcessResult query = new QueryScriptProcessResult();
        query.setFrom(new SqlIdentifier("daily_report", SqlParserPos.ZERO));
        String sql = SqlBuilder.builder()
                .withQueryScriptProcessResult(query)
                .withExecuteParam(ExecuteParam.builder()
                        .aggregators(Collections.singletonList(aggregate))
                        .build())
                .withDialect(new StarRocksSqlStdOperatorSupport())
                .withQuoteIdentifiers(true)
                .build();

        assertTrue(sql.contains(function + "(`amount`)"));
    }
    @Test
    void explicitAggregateRatioIsNotWrappedOrGroupedAgain() throws Exception {
        datart.core.data.provider.sql.FunctionColumn ratio = new datart.core.data.provider.sql.FunctionColumn();
        ratio.setAlias("ratio");
        ratio.setSnippet("SUM(a)/NULLIF(SUM(b), 0)");
        AggregateOperator ratioAgg = new AggregateOperator();
        ratioAgg.setColumn("ratio");
        ratioAgg.setAlias("ratio");
        ratioAgg.setSqlOperator(AggregateOperator.SqlOperator.SUM);
        AggregateOperator amount = new AggregateOperator();
        amount.setColumn("total");
        amount.setSqlOperator(AggregateOperator.SqlOperator.SUM);

        QueryScriptProcessResult query = new QueryScriptProcessResult();
        query.setFrom(new SqlIdentifier("daily_report", SqlParserPos.ZERO));
        String sql = SqlBuilder.builder()
                .withQueryScriptProcessResult(query)
                .withExecuteParam(ExecuteParam.builder()
                        .functionColumns(java.util.List.of(ratio))
                        .aggregators(java.util.List.of(ratioAgg, amount))
                        .build())
                .withDialect(new StarRocksSqlStdOperatorSupport())
                .withQuoteIdentifiers(true)
                .build();

        assertTrue(sql.toUpperCase().contains("SUM("));
        org.junit.jupiter.api.Assertions.assertFalse(
                sql.toUpperCase().contains("GROUP BY SUM("), sql);
        org.junit.jupiter.api.Assertions.assertFalse(
                sql.toUpperCase().contains("SUM(SUM("), sql);
    }

}
