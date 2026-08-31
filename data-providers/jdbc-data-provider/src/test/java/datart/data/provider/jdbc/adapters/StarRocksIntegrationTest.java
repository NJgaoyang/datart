package datart.data.provider.jdbc.adapters;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "DATART_STARROCKS_JDBC_URL", matches = ".+")
class StarRocksIntegrationTest {

    @Test
    void shouldSupportDateFunctionsUsedByDatart() throws Exception {
        try (Connection connection = connect();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT DAYOFWEEK(DATE '2026-08-17'), DATE_TRUNC('month', CAST('2026-08-17 12:10:00' AS DATETIME))")) {
            resultSet.next();
            assertEquals(1, resultSet.getInt(1));
            assertTrue(resultSet.getString(2).startsWith("2026-08-01"));
        }
    }

    @Test
    void shouldSupportFirstBatchAggregates() throws Exception {
        try (Connection connection = connect();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery("SELECT STDDEV(value), VARIANCE(value), APPROX_COUNT_DISTINCT(value) FROM (SELECT 1 AS value UNION ALL SELECT 2) values_table")) {
            resultSet.next();
            assertTrue(resultSet.getDouble(1) > 0);
            assertTrue(resultSet.getDouble(2) > 0);
            assertEquals(2, resultSet.getLong(3));
        }
    }

    @Test
    void shouldSupportPercentileApproxWithOptionalCompression() throws Exception {
        try (Connection connection = connect();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(
                     "SELECT PERCENTILE_APPROX(value, 0.5), "
                             + "PERCENTILE_APPROX(value, 0.5, 10000) "
                             + "FROM (SELECT 1 AS value UNION ALL SELECT 2 UNION ALL SELECT 3) values_table")) {
            resultSet.next();
            assertEquals(2D, resultSet.getDouble(1), 0.01D);
            assertEquals(2D, resultSet.getDouble(2), 0.01D);
        }
    }

    @Test
    void shouldSupportTimeSliceAndDatetimeBuckets() throws Exception {
        try (Connection connection = connect();
             Statement statement = connection.createStatement();
             ResultSet resultSet = statement.executeQuery(
                     "SELECT TIME_SLICE(CAST('2026-08-17 12:34:56' AS DATETIME), INTERVAL 15 MINUTE), "
                             + "DATE_TRUNC('hour', CAST('2026-08-17 12:34:56' AS DATETIME)), "
                             + "DATE_TRUNC('minute', CAST('2026-08-17 12:34:56' AS DATETIME)), "
                             + "DATE_TRUNC('second', CAST('2026-08-17 12:34:56' AS DATETIME))")) {
            resultSet.next();
            assertTrue(resultSet.getString(1).startsWith("2026-08-17 12:30"));
            assertTrue(resultSet.getString(2).startsWith("2026-08-17 12:00"));
            assertTrue(resultSet.getString(3).startsWith("2026-08-17 12:34"));
            assertTrue(resultSet.getString(4).startsWith("2026-08-17 12:34:56"));
        }
    }

    private Connection connect() throws Exception {
        return DriverManager.getConnection(
                System.getenv("DATART_STARROCKS_JDBC_URL"),
                System.getenv().getOrDefault("DATART_STARROCKS_JDBC_USER", ""),
                System.getenv().getOrDefault("DATART_STARROCKS_JDBC_PASSWORD", ""));
    }
}
