package datart.server.service;


import datart.core.data.provider.*;
import datart.core.entity.Source;
import datart.server.base.params.ViewExecuteParam;
import datart.server.base.params.TestExecuteParam;

import java.io.IOException;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.Set;

public interface DataProviderService {


    List<DataProviderInfo> getSupportedDataProviders();

    DataProviderConfigTemplate getSourceConfigTemplate(String type) throws IOException;

    Object testConnection(DataProviderSource source) throws Exception;

    Set<String> readAllDatabases(String sourceId) throws SQLException;

    Set<String> readTables(String sourceId, String database) throws SQLException;

    Set<Column> readTableColumns(String sourceId, String schema, String table) throws SQLException;

    Dataframe testExecute(TestExecuteParam testExecuteParam) throws Exception;

    String renderSql(DataProviderSource source, QueryScript queryScript, ExecuteParam executeParam) throws Exception;

    Dataframe execute(ViewExecuteParam viewExecuteParam) throws Exception;

    Dataframe execute(ViewExecuteParam viewExecuteParam, boolean checkViewPermission) throws Exception;

    Dataframe execute(ViewExecuteParam viewExecuteParam, boolean checkViewPermission, String queryOwner) throws Exception;

    Map<String, Dataframe> executeBatch(List<ViewExecuteParam> params) throws Exception;

    Set<StdSqlOperator> supportedStdFunctions(String sourceId);

    List<FunctionDefinition> functionDefinitions(String sourceId);

    boolean validateFunction(String sourceId, String snippet);

    boolean cancelQuery(String queryId);

    boolean cancelQuery(String queryId, String queryOwner);

    Map<String, Object> getRuntimeStats(String sourceId);

    List<Map<String, Object>> getQueryTraces(String sourceId);

    Map<String, Object> getQueryMonitor(String orgId);

    String decryptValue(String value);

    void updateSource(Source source);

    DataProviderSource parseDataProviderConfig(Source source);

}
