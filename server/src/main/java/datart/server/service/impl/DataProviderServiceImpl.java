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

package datart.server.service.impl;

import com.alibaba.fastjson2.JSON;
import com.alibaba.fastjson2.JSONArray;
import com.alibaba.fastjson2.JSONException;
import com.alibaba.fastjson2.JSONObject;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.google.common.collect.Sets;
import datart.core.base.PageInfo;
import datart.core.base.consts.Const;
import datart.core.base.consts.ValueType;
import datart.core.base.consts.VariableTypeEnum;
import datart.core.base.exception.BaseException;
import datart.core.base.exception.Exceptions;
import datart.core.common.RequestContext;
import datart.core.data.provider.*;
import datart.core.entity.RelSubjectColumns;
import datart.core.entity.Source;
import datart.core.entity.View;
import datart.core.mappers.ext.RelSubjectColumnsMapperExt;
import datart.security.util.PermissionHelper;
import datart.security.util.AESUtil;
import datart.server.base.dto.VariableValue;
import datart.server.base.params.TestExecuteParam;
import datart.server.base.params.ViewExecuteParam;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.SqlPreviewFieldMetadataResolver;
import datart.server.service.BaseService;
import datart.server.service.DataProviderService;
import datart.server.service.SourceService;
import datart.server.service.VariableService;
import datart.server.service.ViewService;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.springframework.stereotype.Service;
import org.springframework.util.CollectionUtils;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.sql.SQLException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class DataProviderServiceImpl extends BaseService implements DataProviderService {

    // build in variables
    private static final String VARIABLE_NAME = "DATART_USER_NAME";

    private static final String VARIABLE_USERNAME = "DATART_USER_USERNAME";

    private static final String VARIABLE_EMAIL = "DATART_USER_EMAIL";

    private static final String VARIABLE_ID = "DATART_USER_ID";

    private static final String SERVER_AGGREGATE = "serverAggregate";

    private ObjectMapper objectMapper;

    private final DataProviderManager dataProviderManager;

    private final RelSubjectColumnsMapperExt rscMapper;

    private final VariableService variableService;

    private final ViewService viewService;

    private final SourceService sourceService;

    private final QueryExecutionTracePersistence queryExecutionTracePersistence;

    private final SourceSchemaIndex sourceSchemaIndex;

    private final SqlPreviewFieldMetadataResolver sqlPreviewFieldMetadataResolver;

    public DataProviderServiceImpl(DataProviderManager dataProviderManager,
                                   RelSubjectColumnsMapperExt rscMapper,
                                   VariableService variableService,
                                   ViewService viewService,
                                   SourceService sourceService,
                                   QueryExecutionTracePersistence queryExecutionTracePersistence,
                                   SourceSchemaIndex sourceSchemaIndex,
                                   SqlPreviewFieldMetadataResolver sqlPreviewFieldMetadataResolver) {
        this.dataProviderManager = dataProviderManager;
        this.rscMapper = rscMapper;
        this.variableService = variableService;
        this.viewService = viewService;
        this.sourceService = sourceService;
        this.queryExecutionTracePersistence = queryExecutionTracePersistence;
        this.sourceSchemaIndex = sourceSchemaIndex;
        this.sqlPreviewFieldMetadataResolver = sqlPreviewFieldMetadataResolver;
    }

    @PostConstruct
    public void init() {
        objectMapper = new ObjectMapper();
        objectMapper.configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    }

    @Override
    public List<DataProviderInfo> getSupportedDataProviders() {
        return dataProviderManager.getSupportedDataProviders();
    }

    @Override
    public DataProviderConfigTemplate getSourceConfigTemplate(String type) throws IOException {
        return dataProviderManager.getSourceConfigTemplate(type);
    }

    @Override
    public Object testConnection(DataProviderSource source) throws Exception {
        Map<String, Object> properties = source.getProperties();
        if (!CollectionUtils.isEmpty(properties)) {
            for (String key : properties.keySet()) {
                Object val = properties.get(key);
                if (val instanceof String) {
                    properties.put(key, decryptValue(val.toString()));
                }
            }
        }
        return dataProviderManager.testConnection(source);
    }

    @Override
    public Set<String> readAllDatabases(String sourceId) throws SQLException {
        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.READ);
        return dataProviderManager.readAllDatabases(parseDataProviderConfig(source));
    }

    @Override
    public Set<String> readTables(String sourceId, String database) throws SQLException {
        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.READ);
        return dataProviderManager.readTables(parseDataProviderConfig(source), database);
    }

    @Override
    public Set<Column> readTableColumns(String sourceId, String database, String table) throws SQLException {
        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.READ);
        return dataProviderManager.readTableColumns(parseDataProviderConfig(source), database, table);
    }

    @Override
    public DataProviderSource parseDataProviderConfig(Source source) {
        DataProviderSource providerSource = new DataProviderSource();
        try {
            providerSource.setSourceId(source.getId());
            providerSource.setType(source.getType());
            providerSource.setName(source.getName());
            Map<String, Object> properties = new HashMap<>(16);
            if (StringUtils.isNotBlank(source.getConfig())) {
                properties = objectMapper.readValue(source.getConfig(), HashMap.class);
            }
            // decrypt values
            for (String key : properties.keySet()) {
                Object val = properties.get(key);
                if (val instanceof String) {
                    String dq = decryptValue(val.toString());
                    properties.put(key, dq);
                }
            }
            providerSource.setProperties(properties);
        } catch (Exception e) {
            Exceptions.tr(BaseException.class, "message.provider.config.error");
        }
        return providerSource;
    }


    /**
     * 测试执行。
     * : 权限变量不生效。
     * : 系统变量不生效。
     * : 查询变量使用默认值。
     *
     * @return 执行结果
     */
    @Override
    public Dataframe testExecute(TestExecuteParam testExecuteParam) throws Exception {
        Source source = retrieve(testExecuteParam.getSourceId(), Source.class, true);
        List<ScriptVariable> variables = getOrgVariables(source.getOrgId());
        if (!CollectionUtils.isEmpty(testExecuteParam.getVariables())) {
            variables.addAll(testExecuteParam.getVariables());
        }
        for (ScriptVariable variable : variables) {
            if (variable.isExpression()) {
                variable.setValueType(ValueType.FRAGMENT);
            }
        }
        if (securityManager.isOrgOwner(source.getOrgId())) {
            disablePermissionVariables(variables);
        }
        QueryScript queryScript = QueryScript.builder()
                .test(true)
                .sourceId(source.getId())
                .script(testExecuteParam.getScript())
                .scriptType(testExecuteParam.getScriptType())
                .variables(variables)
                .build();
        DataProviderSource providerSource = parseDataProviderConfig(source);

        ExecuteParam executeParam = ExecuteParam
                .builder()
                .pageInfo(PageInfo.builder().pageNo(1).pageSize(testExecuteParam.getSize()).countTotal(false).build())
                .includeColumns(Collections.singleton(SelectColumn.of(null, "*")))
                .columns(testExecuteParam.getColumns())
                .serverAggregate((boolean) providerSource.getProperties().getOrDefault(SERVER_AGGREGATE, false))
                .cacheEnable(false)
                .queryId(testExecuteParam.getQueryId())
                .queryOwner(getCurrentUser().getId())
                .reportName("数据集预览")
                .build();
        Dataframe dataframe = dataProviderManager.execute(providerSource, queryScript, executeParam);
        if (testExecuteParam.getScriptType() == ScriptType.SQL) {
            dataframe.setPreviewFields(sqlPreviewFieldMetadataResolver.resolve(
                    testExecuteParam.getScript(),
                    dataframe.getColumns(),
                    sourceSchemaIndex.forSource(source.getId())));
        }
        return dataframe;
    }

    @Override
    public String renderSql(DataProviderSource source, QueryScript queryScript, ExecuteParam executeParam) throws Exception {
        return dataProviderManager.renderSql(source, queryScript, executeParam);
    }

    @Override
    public Dataframe execute(ViewExecuteParam viewExecuteParam) throws Exception {
        return execute(viewExecuteParam, true);
    }

    @Override
    public Dataframe execute(ViewExecuteParam viewExecuteParam, boolean checkViewPermission) throws Exception {
        return execute(viewExecuteParam, checkViewPermission, null, null);
    }

    @Override
    public Dataframe execute(ViewExecuteParam viewExecuteParam, boolean checkViewPermission, String queryOwner) throws Exception {
        return execute(viewExecuteParam, checkViewPermission, null, queryOwner);
    }

    private Dataframe execute(ViewExecuteParam viewExecuteParam, boolean checkViewPermission,
                              BatchContext batchContext) throws Exception {
        return execute(viewExecuteParam, checkViewPermission, batchContext, null);
    }

    private Dataframe execute(ViewExecuteParam viewExecuteParam, boolean checkViewPermission,
                              BatchContext batchContext, String queryOwner) throws Exception {
        if (viewExecuteParam.isEmpty()) {
            return Dataframe.empty();
        }

        String viewId = viewExecuteParam.getViewId();
        View view;
        Source source;
        DataProviderSource providerSource;
        Set<SelectColumn> columns;
        List<ScriptVariable> variables;

        // 批次内复用: 如果提供了 BatchContext，优先从缓存获取
        if (batchContext != null) {
            view = batchContext.getView(viewId, checkViewPermission);
            source = batchContext.getSource(view.getSourceId());
            if (checkViewPermission) {
                sourceService.requirePermission(source, Const.READ);
            }
            providerSource = batchContext.getProviderSource(source);
            columns = batchContext.getColumnPermission(view);
            variables = batchContext.getVariables(view, viewExecuteParam);
        } else {
            view = retrieve(viewId, View.class, checkViewPermission);
            source = retrieve(view.getSourceId(), Source.class, false);
            // 权限级联检查: VIEW 执行时必须同时拥有对应 SOURCE 的 READ 权限
            if (checkViewPermission) {
                sourceService.requirePermission(source, Const.READ);
            }
            providerSource = parseDataProviderConfig(source);
            columns = parseColumnPermission(view);
            variables = parseVariables(view, viewExecuteParam);
        }

        boolean scriptPermission = true;
        try {
            viewService.requirePermission(view, Const.MANAGE);
        } catch (Exception e) {
            scriptPermission = false;
        }
        RequestContext.setScriptPermission(scriptPermission);

        if (securityManager.isOrgOwner(view.getOrgId())) {
            disablePermissionVariables(variables);
        }

        QueryScript queryScript = QueryScript.builder()
                .test(false)
                .sourceId(source.getId())
                .script(view.getScript())
                .scriptType(view.getType() == null ? ScriptType.SQL : ScriptType.valueOf(view.getType()))
                .variables(variables)
                .schema(parseSchema(view.getModel()))
                .build();

        if (viewExecuteParam.getPageInfo().getPageNo() < 1) {
            viewExecuteParam.getPageInfo().setPageNo(1);
        }

        viewExecuteParam.getPageInfo().setPageSize(Math.min(viewExecuteParam.getPageInfo().getPageSize(), Integer.MAX_VALUE));

        ExecuteParam queryParam = ExecuteParam.builder()
                .columns(viewExecuteParam.getColumns())
                .keywords(viewExecuteParam.getKeywords())
                .functionColumns(viewExecuteParam.getFunctionColumns())
                .outputProjections(viewExecuteParam.getOutputProjections())
                .aggregators(viewExecuteParam.getAggregators())
                .filters(viewExecuteParam.getFilters())
                .groups(viewExecuteParam.getGroups())
                .orders(viewExecuteParam.getOrders())
                .pageInfo(viewExecuteParam.getPageInfo())
                .includeColumns(columns)
                .concurrencyOptimize(viewExecuteParam.isConcurrencyControl())
                .serverAggregate((boolean) providerSource.getProperties().getOrDefault(SERVER_AGGREGATE, false))
                .cacheEnable(viewExecuteParam.isCache())
                .cacheExpires(viewExecuteParam.getCacheExpires())
                .queryId(viewExecuteParam.getQueryId())
                .queryOwner(StringUtils.defaultIfBlank(queryOwner, getCurrentUser().getId()))
                .reportId(viewExecuteParam.getVizId())
                .reportName(StringUtils.defaultIfBlank(viewExecuteParam.getVizName(), view.getName()))
                .build();

        Dataframe dataframe = dataProviderManager.execute(providerSource, queryScript, queryParam);

        if (!viewExecuteParam.isScript() || !scriptPermission) {
            dataframe.setScript(null);
        }
        return dataframe;
    }

    @Override
    public Map<String, Dataframe> executeBatch(List<ViewExecuteParam> params) throws Exception {
        Map<String, Dataframe> results = new HashMap<>();
        if (CollectionUtils.isEmpty(params)) {
            return results;
        }
        BatchContext batchContext = new BatchContext();
        for (ViewExecuteParam param : params) {
            String resultKey = StringUtils.isNotBlank(param.getRequestId())
                    ? param.getRequestId()
                    : param.getVizId();
            Dataframe df = execute(param, true, batchContext);
            results.put(resultKey, df);
        }
        return results;
    }

    /**
     * 批次上下文，在单次批量请求内缓存 View/Source/DataProviderSource/列权限/变量，
     * 避免同一批次内对相同 View 的重复数据库查询。
     */
    private class BatchContext {
        private final Map<String, View> viewCache = new HashMap<>();
        private final Map<String, Source> sourceCache = new HashMap<>();
        private final Map<String, DataProviderSource> providerSourceCache = new HashMap<>();
        private final Map<String, Set<SelectColumn>> columnPermCache = new HashMap<>();
        private final Map<String, List<ScriptVariable>> baseVariableCache = new HashMap<>();

        View getView(String viewId, boolean checkViewPermission) {
            return viewCache.computeIfAbsent(viewId,
                    id -> retrieve(id, View.class, checkViewPermission));
        }

        Source getSource(String sourceId) {
            return sourceCache.computeIfAbsent(sourceId,
                    id -> retrieve(id, Source.class, false));
        }

        DataProviderSource getProviderSource(Source source) {
            return providerSourceCache.computeIfAbsent(source.getId(),
                    id -> parseDataProviderConfig(source));
        }

        Set<SelectColumn> getColumnPermission(View view) {
            return columnPermCache.computeIfAbsent(view.getId(),
                    id -> parseColumnPermission(view));
        }

        List<ScriptVariable> getVariables(View view, ViewExecuteParam param) {
            // 基础变量（系统变量 + org变量 + view变量）对同一 view 相同，可缓存
            List<ScriptVariable> baseVars = baseVariableCache.computeIfAbsent(view.getId(), id -> {
                List<ScriptVariable> vars = new LinkedList<>();
                vars.addAll(getOrgVariables(view.getOrgId()));
                vars.addAll(getViewVariables(view));
                return vars;
            });
            // 每个请求需要独立拷贝，因为查询参数替换会修改变量值
            List<ScriptVariable> variables = new LinkedList<>();
            for (ScriptVariable baseVar : baseVars) {
                ScriptVariable copy = new ScriptVariable(
                        baseVar.getName(), baseVar.getType(), baseVar.getValueType(),
                        baseVar.getValues() == null ? null : new HashSet<>(baseVar.getValues()),
                        baseVar.isExpression());
                copy.setDisabled(baseVar.isDisabled());
                copy.setFormat(baseVar.getFormat());
                variables.add(copy);
            }
            // 应用查询参数替换
            variables.stream()
                    .filter(v -> v.getType().equals(VariableTypeEnum.QUERY))
                    .forEach(v -> {
                        if (!CollectionUtils.isEmpty(param.getParams())
                                && param.getParams().containsKey(v.getName())) {
                            v.setValues(param.getParams().get(v.getName()));
                        } else {
                            if (v.isExpression()) {
                                v.setValueType(ValueType.FRAGMENT);
                            }
                        }
                    });
            return variables;
        }
    }

    @Override
    public Set<StdSqlOperator> supportedStdFunctions(String sourceId) {

        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.READ);

        DataProviderSource dataProviderSource = parseDataProviderConfig(source);

        return dataProviderManager.supportedStdFunctions(dataProviderSource);
    }

    @Override
    public List<FunctionDefinition> functionDefinitions(String sourceId) {
        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.READ);
        DataProviderSource dataProviderSource = parseDataProviderConfig(source);
        return FunctionDefinitionRegistry.supported(
                dataProviderManager.supportedStdFunctions(dataProviderSource));
    }

    @Override
    public boolean validateFunction(String sourceId, String snippet) {
        Source source = retrieve(sourceId, Source.class);
        DataProviderSource dataProviderSource = parseDataProviderConfig(source);
        return dataProviderManager.validateFunction(dataProviderSource, snippet);
    }

    @Override
    public boolean cancelQuery(String queryId) {
        return QueryCancellationRegistry.cancel(queryId, getCurrentUser().getId());
    }

    @Override
    public boolean cancelQuery(String queryId, String queryOwner) {
        return QueryCancellationRegistry.cancel(queryId, queryOwner);
    }

    @Override
    public Map<String, Object> getRuntimeStats(String sourceId) {
        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.MANAGE);
        return dataProviderManager.getRuntimeStats(parseDataProviderConfig(source));
    }

    @Override
    public List<Map<String, Object>> getQueryTraces(String sourceId) {
        Source source = retrieve(sourceId, Source.class, false);
        sourceService.requirePermission(source, Const.MANAGE);
        return queryExecutionTracePersistence.recent(sourceId);
    }

    @Override
    public Map<String, Object> getQueryMonitor(String orgId) {
        securityManager.requireAllPermissions(PermissionHelper.rolePermission(orgId, Const.MANAGE));
        List<Map<String, Object>> sourceStatuses = new ArrayList<>();
        List<Map<String, Object>> traces = new ArrayList<>();
        for (Source source : sourceService.listSources(orgId, true)) {
            try {
                sourceService.requirePermission(source, Const.MANAGE);
            } catch (RuntimeException ignored) {
                continue;
            }
            if (!"JDBC".equalsIgnoreCase(source.getType())) {
                continue;
            }
            Map<String, Object> status = new LinkedHashMap<>(
                    dataProviderManager.getRuntimeStats(parseDataProviderConfig(source)));
            status.put("sourceId", source.getId());
            status.put("sourceName", source.getName());
            sourceStatuses.add(status);
            for (Map<String, Object> trace : queryExecutionTracePersistence.recent(source.getId())) {
                Map<String, Object> row = new LinkedHashMap<>(trace);
                row.put("sourceName", source.getName());
                traces.add(row);
            }
        }
        traces.sort(Comparator.comparingLong(
                row -> -((Number) row.getOrDefault("startedAt", 0L)).longValue()));
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("sources", sourceStatuses);
        result.put("traces", traces);
        return result;
    }

    @Override
    public String decryptValue(String value) {
        if (StringUtils.isEmpty(value)) {
            return value;
        }
        if (!value.startsWith(Const.ENCRYPT_FLAG)) {
            return value;
        }
        try {
            return AESUtil.decrypt(value.replaceFirst(Const.ENCRYPT_FLAG, ""));
        } catch (Exception e) {
            return value;
        }
    }

    @Override
    public void updateSource(Source source) {
        dataProviderManager.updateSource(parseDataProviderConfig(source));
    }

    private void disablePermissionVariables(List<ScriptVariable> variables) {
        for (ScriptVariable variable : variables) {
            if (VariableTypeEnum.PERMISSION.equals(variable.getType())) {
                variable.setDisabled(true);
            }
        }
    }

    private List<ScriptVariable> parseVariables(View view, ViewExecuteParam param) {
        //通用变量
        List<ScriptVariable> variables = new LinkedList<>();
        variables.addAll(getOrgVariables(view.getOrgId()));
        // view自定义变量
        variables.addAll(getViewVariables(view));
        variables.stream()
                .filter(v -> v.getType().equals(VariableTypeEnum.QUERY))
                .forEach(v -> {
                    //通过参数传值，进行参数替换
                    if (!CollectionUtils.isEmpty(param.getParams()) && param.getParams().containsKey(v.getName())) {
                        v.setValues(param.getParams().get(v.getName()));
                    } else {
                        //没有参数传值，如果是表达式类型作为默认值，在没有给定值的情况下，改变变量类型为表达式
                        if (v.isExpression()) {
                            v.setValueType(ValueType.FRAGMENT);
                        }
                    }
                });
        return variables;
    }

    private List<ScriptVariable> getSysVariables() {
        LinkedList<ScriptVariable> variables = new LinkedList<>();
        variables.add(new ScriptVariable(VARIABLE_NAME,
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                getCurrentUser().getName() == null ? Collections.emptySet() : Sets.newHashSet(getCurrentUser().getName()),
                false));
        variables.add(new ScriptVariable(VARIABLE_EMAIL,
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                Sets.newHashSet(getCurrentUser().getEmail()),
                false));
        variables.add(new ScriptVariable(VARIABLE_ID,
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                Sets.newHashSet(getCurrentUser().getId()),
                false));
        variables.add(new ScriptVariable(VARIABLE_USERNAME,
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                Sets.newHashSet(getCurrentUser().getUsername()),
                false));
        return variables;
    }

    private List<ScriptVariable> getViewVariables(String viewId) {
        return variableService.listViewVarValuesByUser(getCurrentUser().getId(), viewId)
                .stream()
                .map(this::convertScriptValue)
                .collect(Collectors.toList());
    }

    private List<ScriptVariable> getViewVariables(View view) {
        List<ScriptVariable> variables = new LinkedList<>();
        collectViewVariables(view, variables, new HashSet<>());
        return variables;
    }

    private void collectViewVariables(View view, List<ScriptVariable> variables, Set<String> visited) {
        if (view == null || !visited.add(view.getId())) {
            return;
        }
        variables.addAll(getViewVariables(view.getId()));
        if (StringUtils.isBlank(view.getConfig())) {
            return;
        }
        try {
            JSONObject config = JSON.parseObject(view.getConfig());
            JSONObject lineage = config.getJSONObject("lineage");
            JSONArray upstreamIds = lineage == null ? null : lineage.getJSONArray("upstreamViewIds");
            if (upstreamIds != null) {
                for (String upstreamId : upstreamIds.toJavaList(String.class)) {
                    collectViewVariables(retrieve(upstreamId, View.class, false), variables, visited);
                }
            }
        } catch (JSONException e) {
            log.warn("Failed to parse view lineage config for view {}", view.getId(), e);
        }
    }

    private List<ScriptVariable> getOrgVariables(String orgId) {
        // 内置变量
        List<ScriptVariable> variables = new LinkedList<>(getSysVariables());
        // 组织变量
        variables.addAll(variableService.listOrgValue(orgId)
                .stream()
                .map(this::convertScriptValue)
                .collect(Collectors.toList()));
        return variables;
    }

    private ScriptVariable convertScriptValue(VariableValue var) {
        return new ScriptVariable(var.getName(),
                VariableTypeEnum.valueOf(var.getType()),
                ValueType.valueOf(var.getValueType()),
                var.getValues(),
                var.isExpression());
    }

    private Set<SelectColumn> parseColumnPermission(View view) {
        if (securityManager.isOrgOwner(view.getOrgId())) {
            return Collections.singleton(SelectColumn.of(null, "*"));
        }
        try {
            Set<SelectColumn> columns = new HashSet<>();
            List<RelSubjectColumns> relSubjectColumns = rscMapper.listByUser(view.getId(), getCurrentUser().getId());
            for (RelSubjectColumns relSubjectColumn : relSubjectColumns) {
                List<String> cols = (List<String>) objectMapper.readValue(relSubjectColumn.getColumnPermission(), ArrayList.class);
                if (!CollectionUtils.isEmpty(cols)) {
                    for (String col : cols) {
                        if (StringUtils.isNotBlank(col)) {
                            columns.add(SelectColumn.of(null, col.split("\\.")));
                        }
                    }
                }
            }
            return columns;
        } catch (Exception e) {
            Exceptions.e(e);
        }
        return null;
    }

    /**
     * 从 view 中解析配置的schema
     *
     * @param model view.model
     */
    Map<String, Column> parseSchema(String model) {
        Map<String, Column> schema = new LinkedHashMap<>();
        if (StringUtils.isBlank(model)) {
            return schema;
        }

        JSONObject jsonObject = JSON.parseObject(model);
        try {
            if (jsonObject.containsKey("columns")) {
                jsonObject = jsonObject.getJSONObject("columns");
                for (String key : jsonObject.keySet()) {
                    JSONObject item = jsonObject.getJSONObject(key);
                    String[] names;
                    if (item.get("name") instanceof JSONArray) {
                        if (item.getJSONArray("name").size() == 1) {
                            String nameString = item.getJSONArray("name").getString(0);
                            try {
                                names = JSON.parseArray(nameString).toArray(new String[0]);
                            } catch (JSONException e) {
                                names = new String[]{nameString};
                            }
                        } else {
                            names = item.getJSONArray("name").toArray(new String[0]);
                        }
                    } else {
                        names = new String[]{Optional.ofNullable(item.getString("name")).orElse(key)};
                    }
                    Column column = Column.of(ValueType.valueOf(item.getString("type")), names);
                    schema.put(column.columnKey(), column);
                }
            } else if (jsonObject.containsKey("hierarchy")) {
                jsonObject = jsonObject.getJSONObject("hierarchy");
                for (String key : jsonObject.keySet()) {
                    JSONObject item = jsonObject.getJSONObject(key);
                    if (item.containsKey("children")) {
                        JSONArray children = item.getJSONArray("children");
                        if (children != null && children.size() > 0) {
                            for (int i = 0; i < children.size(); i++) {
                                JSONObject child = children.getJSONObject(i);
                                schema.put(child.getString("name"), Column.of(ValueType.valueOf(child.getString("type")), child.getString("name").split("\\.")));
                            }
                        }
                    } else {
                        schema.put(key, Column.of(ValueType.valueOf(item.getString("type")), key.split("\\.")));
                    }
                }
            } else {
                // 兼容1.0.0-beta.1以前的版本
                for (String key : jsonObject.keySet()) {
                    ValueType type = ValueType.valueOf(jsonObject.getJSONObject(key).getString("type"));
                    schema.put(key, Column.of(type, key));
                }
            }
        } catch (Exception e) {
            log.error("view model parse error", e);
        }
        return schema;
    }

}
