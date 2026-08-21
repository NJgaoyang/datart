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

import com.alibaba.fastjson2.JSON;
import com.alibaba.druid.pool.DruidDataSource;
import datart.core.base.PageInfo;
import datart.core.base.consts.ValueType;
import datart.core.base.exception.Exceptions;
import datart.core.common.BeanUtils;
import datart.core.common.ReflectUtils;
import datart.core.data.provider.*;
import datart.data.provider.JdbcDataProvider;
import datart.data.provider.calcite.dialect.CustomSqlDialect;
import datart.data.provider.calcite.dialect.FetchAndOffsetSupport;
import datart.data.provider.jdbc.DataTypeUtils;
import datart.data.provider.jdbc.JdbcDriverInfo;
import datart.data.provider.jdbc.JdbcProperties;
import datart.data.provider.jdbc.SqlScriptRender;
import datart.data.provider.local.LocalDB;
import javassist.ClassPool;
import javassist.CtClass;
import javassist.CtMethod;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.apache.calcite.avatica.util.Casing;
import org.apache.calcite.sql.SqlDialect;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.commons.codec.digest.DigestUtils;
import org.apache.commons.lang3.StringUtils;
import org.springframework.util.CollectionUtils;

import javax.sql.DataSource;
import java.io.Closeable;
import java.lang.reflect.Constructor;
import java.sql.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

@Slf4j
@Setter
@Getter
public class JdbcDataProviderAdapter implements Closeable {

    private static final String SQL_DIALECT_PACKAGE = "datart.data.provider.calcite.dialect";

    protected static final String COUNT_SQL = "SELECT COUNT(*) FROM (%s) V_T";

    protected static final String PKTABLE_CAT = "PKTABLE_CAT";

    protected static final String PKTABLE_NAME = "PKTABLE_NAME";

    protected static final String PKCOLUMN_NAME = "PKCOLUMN_NAME";

    protected static final String FKCOLUMN_NAME = "FKCOLUMN_NAME";

    protected static final int DEFAULT_QUERY_TIMEOUT_SECONDS = 60;

    protected DataSource dataSource;

    protected JdbcProperties jdbcProperties;

    protected JdbcDriverInfo driverInfo;

    protected boolean init;

    protected SqlDialect sqlDialect;

    private final ThreadLocal<QueryContext> queryContext = new ThreadLocal<>();

    public final void init(JdbcProperties jdbcProperties, JdbcDriverInfo driverInfo) {
        try {
            this.jdbcProperties = jdbcProperties;
            this.driverInfo = driverInfo;
            this.dataSource = JdbcDataProvider.getDataSourceFactory().createDataSource(jdbcProperties);
        } catch (Exception e) {
            log.error("data provider init error", e);
            Exceptions.e(e);
        }
        this.init = true;
    }

    public boolean test(JdbcProperties properties) {
        BeanUtils.validate(properties);
        try {
            Class.forName(properties.getDriverClass());
        } catch (ClassNotFoundException e) {
            String errMsg = "Driver class not found " + properties.getDriverClass();
            log.error(errMsg, e);
            Exceptions.e(e);
        }
        try (Connection ignored = DriverManager.getConnection(
                properties.getUrl(), properties.getUser(), properties.getPassword())) {
            // Opening a connection is sufficient for validation; it must be closed immediately.
        } catch (SQLException sqlException) {
            Exceptions.e(sqlException);
        }
        return true;
    }

    public Set<String> readAllDatabases() throws SQLException {
        Set<String> databases = new HashSet<>();
        try (Connection conn = getConn()) {
            DatabaseMetaData metaData = conn.getMetaData();
            boolean isCatalog = isReadFromCatalog(conn);
            ResultSet rs = null;
            if (isCatalog) {
                rs = metaData.getCatalogs();
            } else {
                rs = metaData.getSchemas();
                log.info("Database 'catalogs' is empty, get databases with 'schemas'");
            }

            String currDatabase = readCurrDatabase(conn, isCatalog);
            if (StringUtils.isNotBlank(currDatabase)) {
                return Collections.singleton(currDatabase);
            }

            while (rs.next()) {
                String database = rs.getString(1);
                databases.add(database);
            }
            return databases;
        }
    }

    protected String readCurrDatabase(Connection conn, boolean isCatalog) throws SQLException {
        return isCatalog ? conn.getCatalog() : conn.getSchema();
    }

    public Set<String> readAllTables(String database) throws SQLException {
        try (Connection conn = getConn()) {
            Set<String> tables = new HashSet<>();
            DatabaseMetaData metadata = conn.getMetaData();
            String catalog = null;
            String schema = null;
            if (isReadFromCatalog(conn)) {
                catalog = database;
                schema = conn.getSchema();
            } else {
                schema = database;
            }
            try (ResultSet rs = metadata.getTables(catalog, schema, "%", new String[]{"TABLE", "VIEW"})) {
                while (rs.next()) {
                    String tableName = rs.getString(3);
                    tables.add(tableName);
                }
            }
            return tables;
        }
    }

    protected boolean isReadFromCatalog(Connection conn) throws SQLException {
        return conn.getMetaData().getCatalogs().next();
    }

    public Set<Column> readTableColumn(String database, String table) throws SQLException {
        try (Connection conn = getConn()) {
            Set<Column> columnSet = new HashSet<>();
            DatabaseMetaData metadata = conn.getMetaData();
            boolean isCatalog = isReadFromCatalog(conn);
            String catalog = isCatalog ? database : null;
            String schema = isCatalog ? null : database;
            Map<String, List<ForeignKey>> importedKeys = getImportedKeys(metadata, catalog, schema, table);
            try (ResultSet columns = metadata.getColumns(catalog, schema, table, null)) {
                while (columns.next()) {
                    Column column = readTableColumn(columns);
                    column.setForeignKeys(importedKeys.get(column.columnKey()));
                    columnSet.add(column);
                }
            }
            return columnSet;
        }
    }

    public String getQueryKey(QueryScript script, ExecuteParam executeParam) throws SqlParseException {
        SqlScriptRender render = new SqlScriptRender(script, executeParam, getSqlDialect(), jdbcProperties.isEnableSpecialSql(), driverInfo.getQuoteIdentifiers());
        return "Q" + DigestUtils.md5Hex(render.render(true, supportPaging(), true) + ";includeColumns:" + JSON.toJSONString(executeParam.getIncludeColumns()) + ";viewId:" + script.getViewId() + ";pageInfo:" + JSON.toJSONString(executeParam.getPageInfo()));
    }

    protected Column readTableColumn(ResultSet columnMetadata) throws SQLException {
        Column column = new Column();
        column.setName(columnMetadata.getString(4));
        column.setType(isYearType(columnMetadata.getString(6))
                ? ValueType.NUMERIC
                : DataTypeUtils.jdbcType2DataType(columnMetadata.getInt(5)));
        column.setComment(columnMetadata.getString(12));
        return column;
    }

    /**
     * 获取表的外键关系
     */
    protected Map<String, List<ForeignKey>> getImportedKeys(DatabaseMetaData metadata, String catalog, String schema, String table) throws SQLException {
        HashMap<String, List<ForeignKey>> keyMap = new HashMap<>();
        try (ResultSet importedKeys = metadata.getImportedKeys(catalog, schema, table)) {
            while (importedKeys.next()) {
                ForeignKey foreignKey = new ForeignKey();
                foreignKey.setDatabase(importedKeys.getString(PKTABLE_CAT));
                foreignKey.setTable(importedKeys.getString(PKTABLE_NAME));
                foreignKey.setColumn(importedKeys.getString(PKCOLUMN_NAME));
                keyMap.computeIfAbsent(importedKeys.getString(FKCOLUMN_NAME), key -> new ArrayList<>()).add(foreignKey);
            }
        } catch (SQLFeatureNotSupportedException e) {
            log.warn(e.getMessage());
        }
        return keyMap;
    }

    /**
     * 直接执行，返回所有数据，用于支持已经支持分页的数据库，或者不需要分页的查询。
     *
     * @param sql 直接提交至数据源执行的SQL，通常已经包含了分页
     * @return 全量数据
     * @throws SQLException SQL执行异常
     */
    protected Dataframe execute(String sql) throws SQLException {
        long startedAt = System.nanoTime();
        QueryContext context = queryContext.get();
        String traceId = QueryExecutionTraceRegistry.start(jdbcProperties.getSourceId(),
                context == null ? null : context.queryId,
                jdbcProperties.getDbType(), context == null ? null : context.reportName, sql);
        try (Connection conn = getConn()) {
            try (Statement statement = conn.createStatement()) {
                configureStatement(statement);
                registerStatement(statement);
                // Use a moderate fetchSize to enable streaming, preventing OOM
                // on large result sets. MySQL/StarRocks drivers stream row-by-row
                // with fetchSize>0; other drivers typically batch this many rows
                statement.setFetchSize(2000);
                try {
                    try (ResultSet rs = statement.executeQuery(sql)) {
                        Dataframe dataframe = parseResultSet(rs);
                        QueryExecutionTraceRegistry.finish(traceId, "SUCCESS", null);
                        return dataframe;
                    }
                } finally {
                    unregisterStatement(statement);
                }
            }
        } catch (SQLException e) {
            QueryExecutionTraceRegistry.finish(traceId, "ERROR", e.getMessage());
            logSqlFailure(sql, startedAt, e);
            throw e;
        }
    }

    /**
     * 用于未支持SQL分页的数据库，使用通用的分页方案进行分页。
     *
     * @param selectSql 提交至数据源执行的SQL
     * @param pageInfo  需要执行的分页信息
     * @return 分页后的数据
     * @throws SQLException SQL执行异常
     */
    protected Dataframe execute(String selectSql, PageInfo pageInfo) throws SQLException {
        Dataframe dataframe;
        long startedAt = System.nanoTime();
        QueryContext context = queryContext.get();
        String traceId = QueryExecutionTraceRegistry.start(jdbcProperties.getSourceId(),
                context == null ? null : context.queryId,
                jdbcProperties.getDbType(), context == null ? null : context.reportName, selectSql);
        try (Connection conn = getConn()) {
            try (Statement statement = conn.createStatement()) {
                configureStatement(statement);
                registerStatement(statement);
                statement.setFetchSize((int) Math.min(pageInfo.getPageSize(), 10_000));
                try {
                    try (ResultSet resultSet = statement.executeQuery(selectSql)) {
                        try {
                            resultSet.absolute((int) Math.min(pageInfo.getTotal(), (pageInfo.getPageNo() - 1) * pageInfo.getPageSize()));
                        } catch (Exception e) {
                            int count = 0;
                            while (count < (pageInfo.getPageNo() - 1) * pageInfo.getPageSize() && resultSet.next()) {
                                count++;
                            }
                        }
                        dataframe = parseResultSet(resultSet, pageInfo.getPageSize());
                        QueryExecutionTraceRegistry.finish(traceId, "SUCCESS", null);
                        return dataframe;
                    }
                } finally {
                    unregisterStatement(statement);
                }
            }
        } catch (SQLException e) {
            QueryExecutionTraceRegistry.finish(traceId, "ERROR", e.getMessage());
            logSqlFailure(selectSql, startedAt, e);
            throw e;
        }
    }

    private void logSqlFailure(String sql, long startedAt, SQLException exception) {
        String digest = DigestUtils.sha256Hex(sql);
        long elapsedMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startedAt);
        String dbType = jdbcProperties == null ? "unknown" : jdbcProperties.getDbType();
        String sourceId = jdbcProperties == null ? "unknown" : jdbcProperties.getSourceId();
        QueryContext context = queryContext.get();
        String queryId = context == null ? null : context.queryId;
        log.error("SQL execution failed: queryId={}, sourceId={}, dbType={}, elapsedMs={}, sqlDigest={}, error={}",
                queryId, sourceId, dbType, elapsedMs, digest, exception.getMessage());
        log.debug("Failed SQL detail: sqlDigest={}, sql={}", digest, sql);
    }

    /**
     * 单独执行一次查询获取总数据量，用于分页
     *
     * @param sql 不包含分页的SQL
     * @return 总记录数
     */
    public int executeCountSql(String sql) throws SQLException {
        String countSql = String.format(COUNT_SQL, sql);
        long startedAt = System.nanoTime();
        QueryContext context = queryContext.get();
        String traceId = QueryExecutionTraceRegistry.start(jdbcProperties.getSourceId(),
                context == null ? null : context.queryId,
                jdbcProperties.getDbType(), context == null ? null : context.reportName, countSql);
        try {
            try (Connection connection = getConn()) {
                try (PreparedStatement preparedStatement = connection.prepareStatement(countSql)) {
                    configureStatement(preparedStatement);
                    registerStatement(preparedStatement);
                    // COUNT only returns one row — use minimal fetch size
                    preparedStatement.setFetchSize(1);
                    try {
                        try (ResultSet resultSet = preparedStatement.executeQuery()) {
                            resultSet.next();
                            int count = resultSet.getInt(1);
                            QueryExecutionTraceRegistry.finish(traceId, "SUCCESS", null);
                            return count;
                        }
                    } finally {
                        unregisterStatement(preparedStatement);
                    }
                }
            }
        } catch (SQLException e) {
            QueryExecutionTraceRegistry.finish(traceId, "ERROR", e.getMessage());
            logSqlFailure(countSql, startedAt, e);
            throw e;
        }
    }

    protected void configureStatement(Statement statement) throws SQLException {
        statement.setQueryTimeout(getQueryTimeoutSeconds());
    }

    int getQueryTimeoutSeconds() {
        if (jdbcProperties == null || jdbcProperties.getProperties() == null) {
            return DEFAULT_QUERY_TIMEOUT_SECONDS;
        }
        String value = jdbcProperties.getProperties().getProperty("queryTimeout");
        if (StringUtils.isBlank(value)) {
            return DEFAULT_QUERY_TIMEOUT_SECONDS;
        }
        try {
            return Math.max(0, Integer.parseInt(value));
        } catch (NumberFormatException e) {
            log.warn("Invalid JDBC queryTimeout '{}', using {} seconds", value, DEFAULT_QUERY_TIMEOUT_SECONDS);
            return DEFAULT_QUERY_TIMEOUT_SECONDS;
        }
    }

    protected Connection getConn() throws SQLException {
        return dataSource.getConnection();
    }

    protected void startQuery(ExecuteParam executeParam) {
        if (executeParam != null && StringUtils.isNotBlank(executeParam.getQueryId())) {
            queryContext.set(new QueryContext(executeParam.getQueryId(), executeParam.getQueryOwner(),
                    executeParam.getReportName()));
        }
    }

    protected void endQuery() {
        queryContext.remove();
    }

    protected void registerStatement(Statement statement) {
        QueryContext context = queryContext.get();
        if (context != null) {
            QueryCancellationRegistry.register(context.queryId, context.ownerId, statement);
        }
    }

    protected void unregisterStatement(Statement statement) {
        QueryContext context = queryContext.get();
        if (context != null) {
            QueryCancellationRegistry.unregister(context.queryId, statement);
        }
    }

    public Map<String, Object> getRuntimeStats() {
        if (!(dataSource instanceof DruidDataSource)) {
            return Collections.emptyMap();
        }
        DruidDataSource druid = (DruidDataSource) dataSource;
        Map<String, Object> stats = new LinkedHashMap<>();
        stats.put("activeCount", druid.getActiveCount());
        stats.put("poolingCount", druid.getPoolingCount());
        stats.put("maxActive", druid.getMaxActive());
        stats.put("connectCount", druid.getConnectCount());
        stats.put("closeCount", druid.getCloseCount());
        stats.put("waitThreadCount", druid.getWaitThreadCount());
        stats.put("queryTimeout", getQueryTimeoutSeconds());
        return stats;
    }

    public List<Map<String, Object>> getQueryTraces() {
        return QueryExecutionTraceRegistry.recent(jdbcProperties == null ? null : jdbcProperties.getSourceId());
    }

    @Override
    public void close() {
        if (dataSource == null) {
            return;
        }
        JdbcDataProvider.getDataSourceFactory().destroy(dataSource);
    }

    public boolean supportPaging() {
        return driverInfo.supportSqlLimit() || (sqlDialect instanceof FetchAndOffsetSupport);
    }

    public SqlDialect getSqlDialect() {

        if (sqlDialect != null) {
            return sqlDialect;
        }
        if (StringUtils.isNotBlank(driverInfo.getSqlDialect())) {
            try {
                Class<?> clz = Class.forName(driverInfo.getSqlDialect());
                Class<?> superclass = clz.getSuperclass();
                if (superclass.equals(CustomSqlDialect.class)) {
                    Constructor<?> constructor = clz.getConstructor(JdbcDriverInfo.class);
                    sqlDialect = (CustomSqlDialect) constructor.newInstance(driverInfo);
                } else {
                    sqlDialect = (SqlDialect) clz.newInstance();
                }
            } catch (Exception ignored) {
                log.warn("Sql dialect " + driverInfo.getSqlDialect() + " not found, use default sql dialect");
            }
        }
        if (sqlDialect == null) {
            try {
                sqlDialect = getDefaultSqlDialect(driverInfo);
            } catch (Exception ignored) {
                log.warn("DBType " + driverInfo.getDbType() + " mismatched, use custom sql dialect");
                sqlDialect = new CustomSqlDialect(driverInfo);
            }
        }
        configSqlDialect(sqlDialect, driverInfo);
        return sqlDialect;
    }

    protected void configSqlDialect(SqlDialect sqlDialect, JdbcDriverInfo driverInfo) {
        try {
            Map<String, Object> fieldValues = new HashMap<>();
            // set identifierQuote
            if (StringUtils.isNotBlank(driverInfo.getIdentifierQuote())) {
                fieldValues.put("identifierQuoteString", driverInfo.getIdentifierQuote());
                fieldValues.put("identifierEndQuoteString", driverInfo.getIdentifierQuote());
                fieldValues.put("identifierEscapedQuote", driverInfo.getIdentifierQuote() + driverInfo.getIdentifierQuote());
            }
            if (StringUtils.isNotBlank(driverInfo.getIdentifierEndQuote())) {
                fieldValues.put("identifierEndQuoteString", driverInfo.getIdentifierEndQuote());
                fieldValues.put("identifierEscapedQuote", driverInfo.getIdentifierEndQuote() + driverInfo.getIdentifierEndQuote());
            }
            if (StringUtils.isNotBlank(driverInfo.getIdentifierEscapedQuote())) {
                fieldValues.put("identifierEscapedQuote", driverInfo.getIdentifierEscapedQuote());
            }
            // set default casing UNCHANGED
            fieldValues.put("unquotedCasing", Casing.UNCHANGED);
            fieldValues.put("quotedCasing", Casing.UNCHANGED);

            //set values
            for (Map.Entry<String, Object> entry : fieldValues.entrySet()) {
                ReflectUtils.setFiledValue(sqlDialect, entry.getKey(), entry.getValue());
            }
        } catch (Exception e) {
            log.warn("sql dialect config error for " + driverInfo.getSqlDialect());
        }
    }

    protected SqlDialect getDefaultSqlDialect(JdbcDriverInfo driverInfo) throws Exception {
        sqlDialect = SqlDialect.DatabaseProduct.valueOf(driverInfo.getDbType().toUpperCase()).getDialect();
        Class<? extends SqlDialect> dialectClass = sqlDialect.getClass();
        ClassPool classPool = ClassPool.getDefault();
        CtClass superClass = classPool.get(dialectClass.getName());
        CtClass ctClass = classPool.makeClass(dialectClass.getName().toLowerCase(Locale.ROOT) + ".Proxy", superClass);
        if (driverInfo.supportSqlLimit()) {
            ctClass.addMethod(CtMethod.make("    public void unparseOffsetFetch(org.apache.calcite.sql.SqlWriter writer, org.apache.calcite.sql.SqlNode offset, org.apache.calcite.sql.SqlNode fetch) {\n" +
                    "        unparseFetchUsingLimit(writer, offset, fetch);\n" +
                    "    }", ctClass));
        }
        Class<?> aClass = ctClass.toClass();
        Constructor<?> constructor = aClass.getConstructor(SqlDialect.Context.class);
        SqlDialect.Context context = ReflectUtils.getFieldValue(dialectClass, "DEFAULT_CONTEXT");
        return (SqlDialect) constructor.newInstance(context);
    }

    protected Dataframe parseResultSet(ResultSet rs) throws SQLException {
        return parseResultSet(rs, Long.MAX_VALUE);
    }

    protected Dataframe parseResultSet(ResultSet rs, long count) throws SQLException {
        Dataframe dataframe = new Dataframe();
        List<Column> columns = getColumns(rs);
        ArrayList<List<Object>> rows = new ArrayList<>();
        int c = 0;
        while (rs.next()) {
            ArrayList<Object> row = new ArrayList<>();
            rows.add(row);
            for (int i = 1; i < columns.size() + 1; i++) {
                row.add(getObjFromResultSet(rs, i));
            }
            c++;
            if (c >= count) {
                break;
            }
        }
        dataframe.setColumns(columns);
        dataframe.setRows(rows);
        return dataframe;
    }

    protected List<Column> getColumns(ResultSet rs) throws SQLException {
        ArrayList<Column> columns = new ArrayList<>();
        for (int i = 1; i <= rs.getMetaData().getColumnCount(); i++) {
            int columnType = rs.getMetaData().getColumnType(i);
            String columnTypeName = rs.getMetaData().getColumnTypeName(i);
            String columnName = rs.getMetaData().getColumnLabel(i);
            ValueType valueType = isYearType(columnTypeName)
                    ? ValueType.NUMERIC
                    : DataTypeUtils.jdbcType2DataType(columnType);
            columns.add(Column.of(valueType, columnName));
        }
        return columns;
    }

    /**
     * 本地执行，从数据源拉取全量数据，在本地执行聚合操作
     */
    public Dataframe executeInLocal(QueryScript script, ExecuteParam executeParam) throws Exception {
        startQuery(executeParam);
        try {

        List<SelectColumn> selectColumns = null;
        // 构建执行参数，查询源表全量数据
        if (!CollectionUtils.isEmpty(script.getSchema())) {
            selectColumns = script.getSchema().values().parallelStream().map(column -> {
                SelectColumn selectColumn = new SelectColumn();
                selectColumn.setColumn(column.getName());
                selectColumn.setAlias(column.columnKey());
                return selectColumn;
            }).collect(Collectors.toList());
        }
        ExecuteParam tempExecuteParam = ExecuteParam.builder()
                .columns(selectColumns)
                .concurrencyOptimize(true)
                .cacheEnable(executeParam.isCacheEnable())
                .cacheExpires(executeParam.getCacheExpires())
                .concurrencyOptimize(executeParam.isConcurrencyOptimize())
                .build();

        SqlScriptRender render = new SqlScriptRender(script
                , tempExecuteParam
                , getSqlDialect()
                , jdbcProperties.isEnableSpecialSql()
                , driverInfo.getQuoteIdentifiers());
        String sql = render.render(true, false, false);
        Dataframe data = execute(sql);

        if (!CollectionUtils.isEmpty(script.getSchema())) {
            for (Column column : data.getColumns()) {
                column.setType(script.getSchema().getOrDefault(column.columnKey(), column).getType());
            }
        }
        data.setName(script.toQueryKey());
        return LocalDB.executeLocalQuery(script, executeParam, data.splitByTable(script.getSchema()));
        } finally {
            endQuery();
        }
    }

    /**
     * 在数据源执行，组装完整SQL，提交至数据源执行
     */
    public Dataframe executeOnSource(QueryScript script, ExecuteParam executeParam) throws Exception {
        startQuery(executeParam);
        try {

        Dataframe dataframe;
        String sql;

        SqlScriptRender render = new SqlScriptRender(script
                , executeParam
                , getSqlDialect()
                , jdbcProperties.isEnableSpecialSql()
                , driverInfo.getQuoteIdentifiers());

        if (supportPaging()) {
            sql = render.render(true, true, false);
            log.debug(sql);
            dataframe = execute(sql);
        } else {
            sql = render.render(true, false, false);
            log.debug(sql);
            dataframe = execute(sql, executeParam.getPageInfo());
        }
        // fix page info
        if (executeParam.getPageInfo().isCountTotal()) {
            int total = executeCountSql(render.render(true, false, true));
            executeParam.getPageInfo().setTotal(total);
            dataframe.setPageInfo(executeParam.getPageInfo());
        }
        dataframe.setScript(sql);
        return dataframe;
        } finally {
            endQuery();
        }
    }

    public String renderSql(QueryScript script, ExecuteParam executeParam) throws Exception {
        SqlScriptRender render = new SqlScriptRender(script
                , executeParam == null ? ExecuteParam.empty() : executeParam
                , getSqlDialect()
                , jdbcProperties.isEnableSpecialSql()
                , driverInfo.getQuoteIdentifiers());
        return render.render(false, false, false);
    }

    protected Object getObjFromResultSet(ResultSet rs, int columnIndex) throws SQLException {
        ResultSetMetaData metadata = rs.getMetaData();
        if (isYearType(metadata.getColumnTypeName(columnIndex))) {
            int year = rs.getInt(columnIndex);
            return rs.wasNull() ? null : year;
        }

        if (metadata.getColumnType(columnIndex) == Types.DATE) {
            java.sql.Date date = rs.getDate(columnIndex);
            return rs.wasNull() ? null : date;
        }

        Object obj = rs.getObject(columnIndex);
        if (obj instanceof Boolean) {
            obj = rs.getObject(columnIndex).toString();
        } else if (obj instanceof LocalDateTime) {
            obj = rs.getTimestamp(columnIndex);
        }
        return obj;
    }

    private boolean isYearType(String columnTypeName) {
        return "YEAR".equalsIgnoreCase(columnTypeName);
    }

    private static class QueryContext {
        private final String queryId;
        private final String ownerId;
        private final String reportName;

        private QueryContext(String queryId, String ownerId, String reportName) {
            this.queryId = queryId;
            this.ownerId = ownerId;
            this.reportName = reportName;
        }
    }
}
