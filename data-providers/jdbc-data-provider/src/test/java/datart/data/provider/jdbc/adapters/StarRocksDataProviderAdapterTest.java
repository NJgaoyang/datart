package datart.data.provider.jdbc.adapters;

import datart.core.base.PageInfo;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StarRocksDataProviderAdapterTest {

    @Test
    void shouldApplySimpleRawSqlPaginationThroughCalcite() {
        String sql = StarRocksDataProviderAdapter.appendLimitWithAst(
                "SELECT city FROM daily_report", PageInfo.builder().pageNo(2).pageSize(10).build(),
                new StarRocksSqlStdOperatorSupport());

        assertTrue(sql.toUpperCase().contains("LIMIT 10"));
        assertTrue(sql.toUpperCase().contains("OFFSET 10"));
    }

    @Test
    void shouldKeepExistingTopLevelPagination() {
        String sql = "SELECT city FROM daily_report LIMIT 5";

        assertEquals(sql, StarRocksDataProviderAdapter.appendLimitWithAst(
                sql, PageInfo.builder().pageNo(2).pageSize(10).build(), new StarRocksSqlStdOperatorSupport()));
    }

    @Test
    void shouldPaginateCteAndUnionWithAnOuterAstSelect() {
        PageInfo pageInfo = PageInfo.builder().pageNo(2).pageSize(10).build();
        String cte = StarRocksDataProviderAdapter.appendLimitWithAst(
                "WITH daily AS (SELECT city FROM report) SELECT city FROM daily", pageInfo,
                new StarRocksSqlStdOperatorSupport());
        String union = StarRocksDataProviderAdapter.appendLimitWithAst(
                "SELECT city FROM report_a UNION ALL SELECT city FROM report_b", pageInfo,
                new StarRocksSqlStdOperatorSupport());

        assertTrue(cte.toUpperCase().contains("DATART_PAGE"));
        assertTrue(union.toUpperCase().contains("DATART_PAGE"));
        assertTrue(cte.toUpperCase().contains("LIMIT 10"));
        assertTrue(union.toUpperCase().contains("OFFSET 10"));
    }
}
