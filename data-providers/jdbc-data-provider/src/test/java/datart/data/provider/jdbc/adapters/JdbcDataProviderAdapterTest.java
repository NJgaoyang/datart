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
import datart.core.data.provider.Dataframe;
import org.junit.jupiter.api.Test;

import java.sql.ResultSet;
import java.sql.ResultSetMetaData;
import java.sql.Types;

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

    private static class TestJdbcDataProviderAdapter extends JdbcDataProviderAdapter {

        Dataframe parse(ResultSet resultSet) throws Exception {
            return parseResultSet(resultSet);
        }
    }
}
