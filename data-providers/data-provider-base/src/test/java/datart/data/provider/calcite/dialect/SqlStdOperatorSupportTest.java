package datart.data.provider.calcite.dialect;

import datart.data.provider.calcite.SqlParserUtils;
import datart.core.data.provider.StdSqlOperator;
import org.apache.calcite.sql.SqlDialect;
import org.apache.calcite.sql.SqlNode;
import org.junit.jupiter.api.Test;

import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlStdOperatorSupportTest {

    @Test
    void shouldRenderMysqlCompatibleFunctionNamesWithoutMutatingCalciteOperators() throws Exception {
        assertMysqlCompatibleFunctions(new MysqlSqlStdOperatorSupport());
        assertMysqlCompatibleFunctions(new StarRocksSqlStdOperatorSupport());
    }

    @Test
    void shouldParseQuotedIdentifiersUsingDialectConfiguration() throws Exception {
        SqlNode node = SqlParserUtils.createParser("SELECT `created_date` FROM `daily_report`",
                        new MysqlSqlStdOperatorSupport())
                .parseQuery();

        assertTrue(node.toSqlString(new MysqlSqlStdOperatorSupport()).getSql().contains("`created_date`"));
    }

    @Test
    void shouldKeepLegacyDateBucketsAndRenderNewStarRocksBucketsAsDateTrunc() throws Exception {
        StarRocksSqlStdOperatorSupport dialect = new StarRocksSqlStdOperatorSupport();
        String legacy = render(dialect, "AGG_DATE_MONTH(created_date)").toUpperCase(Locale.ROOT);
        String nativeBucket = render(dialect, "AGG_DATE_MONTH_NATIVE(created_date)").toUpperCase(Locale.ROOT);

        assertTrue(legacy.contains("DATE_FORMAT"));
        assertTrue(nativeBucket.contains("DATE_TRUNC('MONTH'"));
    }

    @Test
    void shouldExposePercentileApproxOnlyForStarRocks() throws Exception {
        StarRocksSqlStdOperatorSupport dialect = new StarRocksSqlStdOperatorSupport();

        assertTrue(dialect.supportedOperators().contains(StdSqlOperator.PERCENTILE_APPROX));
        assertFalse(new MysqlSqlStdOperatorSupport().supportedOperators().contains(StdSqlOperator.PERCENTILE_APPROX));
        SqlParserUtils.validateSnippet("PERCENTILE_APPROX(amount, 0.95)", dialect, dialect.supportedOperators());
        assertTrue(SqlParserUtils.parseSnippet("PERCENTILE_APPROX(amount, 0.95)")
                .toSqlString(dialect).getSql().contains("PERCENTILE_APPROX"));
        String percentile3 = SqlParserUtils.parseSnippet("PERCENTILE_APPROX(amount, 0.95, 10000)")
                .toSqlString(dialect).getSql();
        assertTrue(percentile3.contains("PERCENTILE_APPROX"));
        assertTrue(percentile3.contains("10000"));
    }

    @Test
    void shouldRenderTimeSliceAndDatetimeBucketsForStarRocks() throws Exception {
        StarRocksSqlStdOperatorSupport dialect = new StarRocksSqlStdOperatorSupport();
        String sql = render(dialect,
                "TIME_SLICE(created_at, INTERVAL 15 MINUTE), "
                        + "AGG_DATE_HOUR_NATIVE(created_at), "
                        + "AGG_DATE_MINUTE_NATIVE(created_at), "
                        + "AGG_DATE_SECOND_NATIVE(created_at)")
                .toUpperCase(Locale.ROOT);

        assertTrue(sql.contains("TIME_SLICE"));
        assertTrue(sql.contains("DATE_TRUNC('HOUR'"));
        assertTrue(sql.contains("DATE_TRUNC('MINUTE'"));
        assertTrue(sql.contains("DATE_TRUNC('SECOND'"));
    }

    @Test
    void shouldReturnDateForStarRocksNativeDateBucketsOnly() throws Exception {
        StarRocksSqlStdOperatorSupport dialect = new StarRocksSqlStdOperatorSupport();
        String dateSql = render(dialect,
                "AGG_DATE_YEAR_NATIVE(created_at), "
                        + "AGG_DATE_QUARTER_NATIVE(created_at), "
                        + "AGG_DATE_MONTH_NATIVE(created_at), "
                        + "AGG_DATE_WEEK_NATIVE(created_at), "
                        + "AGG_DATE_DAY_NATIVE(created_at)")
                .toUpperCase(Locale.ROOT);
        String datetimeSql = render(dialect,
                "AGG_DATE_HOUR_NATIVE(created_at), "
                        + "AGG_DATE_MINUTE_NATIVE(created_at), "
                        + "AGG_DATE_SECOND_NATIVE(created_at)")
                .toUpperCase(Locale.ROOT);

        assertTrue(dateSql.contains("CAST(DATE_TRUNC('YEAR'"));
        assertTrue(dateSql.contains("CAST(DATE_TRUNC('QUARTER'"));
        assertTrue(dateSql.contains("CAST(DATE_TRUNC('MONTH'"));
        assertTrue(dateSql.contains("CAST(DATE_TRUNC('WEEK'"));
        assertTrue(dateSql.contains("CAST(DATE_TRUNC('DAY'"));
        assertTrue(dateSql.contains("AS DATE)"));

        assertTrue(datetimeSql.contains("DATE_TRUNC('HOUR'"));
        assertTrue(datetimeSql.contains("DATE_TRUNC('MINUTE'"));
        assertTrue(datetimeSql.contains("DATE_TRUNC('SECOND'"));
        assertFalse(datetimeSql.contains("AS DATE"));
    }

    private void assertMysqlCompatibleFunctions(SqlDialect dialect) throws Exception {
        String sql = render(dialect, "TRUNC(dt, 2), DAY_OF_WEEK(dt), DAY_OF_MONTH(dt), DAY_OF_YEAR(dt)")
                .toUpperCase(Locale.ROOT);

        assertTrue(sql.contains("TRUNCATE"));
        assertTrue(sql.contains("DAYOFWEEK"));
        assertTrue(sql.contains("DAYOFMONTH"));
        assertTrue(sql.contains("DAYOFYEAR"));
    }

    private String render(SqlDialect dialect, String expression) throws Exception {
        return SqlParserUtils.createParser("SELECT " + expression + " FROM daily_report", dialect)
                .parseQuery()
                .toSqlString(dialect)
                .getSql();
    }
}
