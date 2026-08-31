package datart.server.config;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.ConnectionCallback;
import org.springframework.jdbc.core.JdbcTemplate;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AccessLogColumnMigrationTest {

    @Test
    void checksOnlyCurrentDatabaseBeforeAddingColumn() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        ResultSet columns = mock(ResultSet.class);
        ResultSet otherDatabaseColumns = mock(ResultSet.class);

        when(connection.getCatalog()).thenReturn("database_b");
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getColumns(null, null, "access_log", "resource_name"))
                .thenReturn(otherDatabaseColumns);
        when(otherDatabaseColumns.next()).thenReturn(true);
        when(metadata.getColumns("database_b", null, "access_log", "resource_name"))
                .thenReturn(columns);
        when(columns.next()).thenReturn(false);
        when(jdbcTemplate.execute(any(ConnectionCallback.class))).thenAnswer(invocation ->
                invocation.getArgument(0, ConnectionCallback.class).doInConnection(connection));

        new AccessLogColumnMigration(jdbcTemplate).addResourceNameColumn();

        verify(metadata).getColumns(eq("database_b"), isNull(), eq("access_log"), eq("resource_name"));
        verify(metadata, never()).getColumns(isNull(), isNull(), eq("access_log"), eq("resource_name"));
        verify(jdbcTemplate).execute(
                "ALTER TABLE access_log ADD COLUMN resource_name varchar(256) NULL AFTER resource_id");
    }

    @Test
    void skipsAlterWhenCurrentDatabaseAlreadyHasColumn() throws Exception {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        Connection connection = mock(Connection.class);
        DatabaseMetaData metadata = mock(DatabaseMetaData.class);
        ResultSet columns = mock(ResultSet.class);

        when(connection.getCatalog()).thenReturn("database_b");
        when(connection.getMetaData()).thenReturn(metadata);
        when(metadata.getColumns("database_b", null, "access_log", "resource_name"))
                .thenReturn(columns);
        when(columns.next()).thenReturn(true);
        when(jdbcTemplate.execute(any(ConnectionCallback.class))).thenAnswer(invocation ->
                invocation.getArgument(0, ConnectionCallback.class).doInConnection(connection));

        new AccessLogColumnMigration(jdbcTemplate).addResourceNameColumn();

        verify(metadata).getColumns(eq("database_b"), isNull(), eq("access_log"), eq("resource_name"));
        verify(jdbcTemplate, never()).execute(
                "ALTER TABLE access_log ADD COLUMN resource_name varchar(256) NULL AFTER resource_id");
    }
}
