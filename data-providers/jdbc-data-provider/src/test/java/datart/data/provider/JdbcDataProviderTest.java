package datart.data.provider;

import datart.core.data.provider.DataProviderSource;
import datart.core.base.exception.BaseException;
import datart.data.provider.calcite.dialect.MysqlSqlStdOperatorSupport;
import datart.data.provider.jdbc.JdbcProperties;
import datart.data.provider.jdbc.adapters.JdbcDataProviderAdapter;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JdbcDataProviderTest {

    @Test
    void shouldReuseAdapterForSameSourceConfiguration() throws SQLException {
        TestJdbcDataProvider provider = new TestJdbcDataProvider();
        DataProviderSource source = source("source-1", "jdbc:test:first");

        provider.readAllDatabases(source);
        provider.readAllDatabases(source("source-1", "jdbc:test:first"));

        assertEquals(1, provider.createdCount);
        assertFalse(provider.adapters[0].closed);
    }

    @Test
    void shouldReplaceAndCloseAdapterWhenConfigurationChanges() throws SQLException {
        TestJdbcDataProvider provider = new TestJdbcDataProvider();

        provider.readAllDatabases(source("source-1", "jdbc:test:first"));
        provider.readAllDatabases(source("source-1", "jdbc:test:second"));

        assertEquals(2, provider.createdCount);
        assertTrue(provider.adapters[0].closed);
        assertFalse(provider.adapters[1].closed);
    }

    @Test
    void shouldCloseCachedAdaptersWhenEvictedOrProviderStops() throws SQLException, IOException {
        TestJdbcDataProvider provider = new TestJdbcDataProvider();
        provider.readAllDatabases(source("source-1", "jdbc:test:first"));
        provider.evictProvider("source-1");

        assertTrue(provider.adapters[0].closed);

        provider.readAllDatabases(source("source-2", "jdbc:test:second"));
        provider.close();

        assertTrue(provider.adapters[1].closed);
    }

    @Test
    void shouldValidateFunctionsAgainstTheSelectedSourceDialect() {
        TestJdbcDataProvider provider = new TestJdbcDataProvider();
        DataProviderSource source = source("source-1", "jdbc:test:first");

        assertTrue(provider.validateFunction(source, "DAY_OF_WEEK(created_date)"));
        assertTrue(provider.validateFunction(source, "DATE_SUB(created_date, INTERVAL 1 DAY)"));
        assertThrows(BaseException.class, () -> provider.validateFunction(source, "MEDIAN(created_date)"));
    }

    @Test
    void shouldExposeStatsOnlyForAnInitializedSource() throws SQLException {
        TestJdbcDataProvider provider = new TestJdbcDataProvider();
        DataProviderSource source = source("source-1", "jdbc:test:first");

        assertEquals(false, provider.getRuntimeStats(source).get("initialized"));

        provider.readAllDatabases(source);

        Map<String, Object> stats = provider.getRuntimeStats(source);
        assertEquals("source-1", stats.get("sourceId"));
        assertEquals(true, stats.get("initialized"));
        assertEquals(2, stats.get("activeCount"));
    }

    private static DataProviderSource source(String sourceId, String url) {
        Map<String, Object> properties = new HashMap<>();
        properties.put(JdbcDataProvider.DB_TYPE, "MYSQL");
        properties.put(JdbcDataProvider.URL, url);
        properties.put(JdbcDataProvider.USER, "user");
        properties.put(JdbcDataProvider.PASSWORD, "password");
        properties.put(JdbcDataProvider.DRIVER_CLASS, "driver.Class");
        properties.put("properties", new HashMap<>());

        DataProviderSource source = new DataProviderSource();
        source.setSourceId(sourceId);
        source.setName(sourceId);
        source.setProperties(properties);
        return source;
    }

    private static class TestJdbcDataProvider extends JdbcDataProvider {
        private final CloseTrackingAdapter[] adapters = new CloseTrackingAdapter[2];
        private int createdCount;

        @Override
        protected JdbcDataProviderAdapter createProviderAdapter(JdbcProperties properties) {
            CloseTrackingAdapter adapter = new CloseTrackingAdapter();
            adapters[createdCount++] = adapter;
            return adapter;
        }
    }

    private static class CloseTrackingAdapter extends JdbcDataProviderAdapter {
        private boolean closed;

        @Override
        public java.util.Set<String> readAllDatabases() {
            return java.util.Collections.emptySet();
        }

        @Override
        public org.apache.calcite.sql.SqlDialect getSqlDialect() {
            return new MysqlSqlStdOperatorSupport();
        }

        @Override
        public void close() {
            closed = true;
        }

        @Override
        public Map<String, Object> getRuntimeStats() {
            return Map.of("activeCount", 2);
        }
    }
}
