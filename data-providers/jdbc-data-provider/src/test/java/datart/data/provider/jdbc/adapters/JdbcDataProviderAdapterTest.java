/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package datart.data.provider.jdbc.adapters;

import datart.core.base.consts.ValueType;
import datart.core.base.PageInfo;
import datart.core.data.provider.Dataframe;
import datart.data.provider.jdbc.JdbcProperties;
import org.junit.jupiter.api.Test;

import java.sql.Connection;
import java.sql.Driver;
import java.sql.DriverManager;
import java.sql.DriverPropertyInfo;
import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;
import java.util.Properties;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.*;

class JdbcDataProviderAdapterTest {

    private final TestJdbcDataProviderAdapter adapter = new TestJdbcDataProviderAdapter();

    @Test
    void shouldReadMysqlYearAsNumericValue() throws Exception {
        ResultSet resultSet = mockYearResultSet(2026, false);

        Dataframe dataframe = adapter.parse(resultSet);

        assertEquals(ValueType.NUMERIC, dataframe.getColumns().get(0).getType());
        assertEquals(2026, dataframe.getRows().get(0).get(0));
        verify(resultSet, never()).getObject(1);
    }

    @Test
    void shouldKeepNullMysqlYearValue() throws Exception {
        ResultSet resultSet = mockYearResultSet(0, true);

        Dataframe dataframe = adapter.parse(resultSet);

        assertNull(dataframe.getRows().get(0).get(0));
    }

    @Test
    void shouldReadJdbcDateAsSqlDate() throws Exception {
        ResultSet resultSet = mockDateResultSet(java.sql.Date.valueOf("2026-08-01"), false);

        Dataframe dataframe = adapter.parse(resultSet);

        Object value = dataframe.getRows().get(0).get(0);
        assertEquals(java.sql.Date.class, value.getClass());
        assertEquals("2026-08-01", value.toString());
        verify(resultSet).getDate(1);
        verify(resultSet, never()).getObject(1);
    }

    @Test
    void shouldKeepNullJdbcDateValue() throws Exception {
        ResultSet resultSet = mockDateResultSet(null, true);

        Dataframe dataframe = adapter.parse(resultSet);

        assertNull(dataframe.getRows().get(0).get(0));
    }

    @Test
    void shouldCloseConnectionAfterTestingDataSource() throws Exception {
        Connection connection = mock(Connection.class);
        Driver driver = new CloseTrackingDriver(connection);
        DriverManager.registerDriver(driver);
        try {
            JdbcProperties properties = new JdbcProperties();
            properties.setDbType("TEST");
            properties.setUrl(CloseTrackingDriver.URL);
            properties.setUser("user");
            properties.setPassword("password");
            properties.setDriverClass(CloseTrackingDriver.class.getName());

            adapter.test(properties);

            verify(connection).close();
        } finally {
            DriverManager.deregisterDriver(driver);
        }
    }

    @Test
    void shouldNotAppendLimitWhenRawSqlAlreadyHasTopLevelPagination() {
        PageInfo pageInfo = new PageInfo();
        pageInfo.setPageNo(2);
        pageInfo.setPageSize(10);

        assertEquals("SELECT * FROM report LIMIT 5",
                StarRocksDataProviderAdapter.appendLimit("SELECT * FROM report LIMIT 5", pageInfo));
        assertEquals("SELECT * FROM (SELECT * FROM report LIMIT 5) t LIMIT 10 OFFSET 10",
                StarRocksDataProviderAdapter.appendLimit("SELECT * FROM (SELECT * FROM report LIMIT 5) t", pageInfo));
    }

    @Test
    void shouldUseConfiguredQueryTimeoutOrTheSafeDefault() {
        JdbcProperties properties = new JdbcProperties();
        properties.setProperties(new Properties());
        adapter.setJdbcProperties(properties);

        assertEquals(60, adapter.getQueryTimeoutSeconds());

        properties.getProperties().setProperty("queryTimeout", "15");
        assertEquals(15, adapter.getQueryTimeoutSeconds());

        properties.getProperties().setProperty("queryTimeout", "invalid");
        assertEquals(60, adapter.getQueryTimeoutSeconds());
    }

    private ResultSet mockYearResultSet(int year, boolean wasNull) throws Exception {
        ResultSet resultSet = mock(ResultSet.class);
        ResultSetMetaData metadata = mock(ResultSetMetaData.class);
        when(resultSet.getMetaData()).thenReturn(metadata);
        when(metadata.getColumnCount()).thenReturn(1);
        when(metadata.getColumnType(1)).thenReturn(Types.DATE);
        when(metadata.getColumnTypeName(1)).thenReturn("YEAR");
        when(metadata.getColumnLabel(1)).thenReturn("report_year");
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getInt(1)).thenReturn(year);
        when(resultSet.wasNull()).thenReturn(wasNull);
        return resultSet;
    }

    private ResultSet mockDateResultSet(java.sql.Date date, boolean wasNull) throws Exception {
        ResultSet resultSet = mock(ResultSet.class);
        ResultSetMetaData metadata = mock(ResultSetMetaData.class);
        when(resultSet.getMetaData()).thenReturn(metadata);
        when(metadata.getColumnCount()).thenReturn(1);
        when(metadata.getColumnType(1)).thenReturn(Types.DATE);
        when(metadata.getColumnTypeName(1)).thenReturn("DATE");
        when(metadata.getColumnLabel(1)).thenReturn("created_date");
        when(resultSet.next()).thenReturn(true, false);
        when(resultSet.getDate(1)).thenReturn(date);
        when(resultSet.wasNull()).thenReturn(wasNull);
        return resultSet;
    }

    private static class TestJdbcDataProviderAdapter extends JdbcDataProviderAdapter {

        Dataframe parse(ResultSet resultSet) throws Exception {
            return parseResultSet(resultSet);
        }
    }

    private static class CloseTrackingDriver implements Driver {

        private static final String URL = "jdbc:datart-test:connection";
        private final Connection connection;

        private CloseTrackingDriver(Connection connection) {
            this.connection = connection;
        }

        @Override
        public Connection connect(String url, Properties info) {
            return acceptsURL(url) ? connection : null;
        }

        @Override
        public boolean acceptsURL(String url) {
            return URL.equals(url);
        }

        @Override
        public DriverPropertyInfo[] getPropertyInfo(String url, Properties info) {
            return new DriverPropertyInfo[0];
        }

        @Override
        public int getMajorVersion() {
            return 1;
        }

        @Override
        public int getMinorVersion() {
            return 0;
        }

        @Override
        public boolean jdbcCompliant() {
            return false;
        }

        @Override
        public java.util.logging.Logger getParentLogger() throws java.sql.SQLFeatureNotSupportedException {
            throw new java.sql.SQLFeatureNotSupportedException();
        }
    }
}
