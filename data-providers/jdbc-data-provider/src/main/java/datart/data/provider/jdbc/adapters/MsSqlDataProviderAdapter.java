package datart.data.provider.jdbc.adapters;

import datart.core.base.PageInfo;
import datart.core.data.provider.QueryExecutionTraceRegistry;
import datart.core.data.provider.Dataframe;
import datart.data.provider.script.SqlStringUtils;
import org.apache.commons.lang3.StringUtils;

import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public class MsSqlDataProviderAdapter extends JdbcDataProviderAdapter {

    @Override
    protected String readCurrDatabase(Connection conn, boolean isCatalog) throws SQLException {
        String databaseName = StringUtils.substringAfterLast(jdbcProperties.getUrl().toLowerCase(), "databasename=");
        databaseName = StringUtils.substringBefore(databaseName, ";");
        if (StringUtils.isBlank(databaseName)) {
            return null;
        }
        return super.readCurrDatabase(conn, isCatalog);
    }

    @Override
    public int executeCountSql(String sql) throws SQLException {
        String traceId = QueryExecutionTraceRegistry.start(jdbcProperties.getSourceId(), null,
                jdbcProperties.getDbType(), sql);
        try {
            try (Connection connection = getConn()) {
                try (Statement statement = connection.createStatement(ResultSet.TYPE_SCROLL_INSENSITIVE, ResultSet.CONCUR_READ_ONLY)) {
                    configureStatement(statement);
                    registerStatement(statement);
                    try {
                        try (ResultSet resultSet = statement.executeQuery(sql)) {
                            resultSet.last();
                            int count = resultSet.getRow();
                            QueryExecutionTraceRegistry.finish(traceId, "SUCCESS", null);
                            return count;
                        }
                    } finally {
                        unregisterStatement(statement);
                    }
                }
            }
        } catch (SQLException e) {
            QueryExecutionTraceRegistry.finish(traceId, "ERROR", e.getMessage());
            throw e;
        }
    }

    @Override
    protected Dataframe execute(String selectSql, PageInfo pageInfo) throws SQLException {
        selectSql = SqlStringUtils.rebuildSqlWithFragment(selectSql);
        return super.execute(selectSql, pageInfo);
    }
}
