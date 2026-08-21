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
    void shouldApplyFirstAndSecondPageOffsetsWithOrderBy() {
        PageInfo firstPage = PageInfo.builder().pageNo(1).pageSize(10).build();
        PageInfo secondPage = PageInfo.builder().pageNo(2).pageSize(10).build();

        String first = StarRocksDataProviderAdapter.appendLimitWithAst(
                "SELECT city FROM daily_report ORDER BY created_date", firstPage,
                new StarRocksSqlStdOperatorSupport());
        String second = StarRocksDataProviderAdapter.appendLimitWithAst(
                "SELECT city FROM daily_report ORDER BY created_date", secondPage,
                new StarRocksSqlStdOperatorSupport());

        assertTrue(first.toUpperCase().contains("LIMIT 10"));
        assertTrue(first.toUpperCase().contains("OFFSET 0"));
        assertTrue(second.toUpperCase().contains("LIMIT 10"));
        assertTrue(second.toUpperCase().contains("OFFSET 10"));
    }

    @Test
    void shouldKeepExistingTopLevelPagination() {
        String sql = "SELECT city FROM daily_report LIMIT 5";

        assertEquals(sql, StarRocksDataProviderAdapter.appendLimitWithAst(
                sql, PageInfo.builder().pageNo(2).pageSize(10).build(), new StarRocksSqlStdOperatorSupport()));
    }

    @Test
    void shouldKeepExistingTopLevelLimitAndOffset() {
        String sql = "SELECT city FROM daily_report LIMIT 5 OFFSET 2";

        assertEquals(sql, StarRocksDataProviderAdapter.appendLimitWithAst(
                sql, PageInfo.builder().pageNo(2).pageSize(10).build(),
                new StarRocksSqlStdOperatorSupport()));
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

    @Test
    void shouldPaginateNestedOrderByQuery() {
        String sql = StarRocksDataProviderAdapter.appendLimitWithAst(
                "SELECT * FROM (SELECT city FROM daily_report ORDER BY created_date) t",
                PageInfo.builder().pageNo(2).pageSize(10).build(),
                new StarRocksSqlStdOperatorSupport());

        assertTrue(sql.toUpperCase().contains("LIMIT 10"));
        assertTrue(sql.toUpperCase().contains("OFFSET 10"));
    }
}
