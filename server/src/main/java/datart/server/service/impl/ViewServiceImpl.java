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
import com.alibaba.fastjson2.JSONObject;
import datart.core.base.consts.Const;
import datart.core.base.consts.MigrationMode;
import datart.core.base.exception.Exceptions;
import datart.core.base.exception.NotFoundException;
import datart.core.base.exception.ParamException;
import datart.core.common.Application;
import datart.core.common.DateUtils;
import datart.core.common.UUIDGenerator;
import datart.core.data.provider.DataProviderSource;
import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.QueryScript;
import datart.core.data.provider.ScriptType;
import datart.core.entity.*;
import datart.core.mappers.ext.*;
import datart.security.base.ResourceType;
import datart.security.exception.PermissionDeniedException;
import datart.security.manager.shiro.ShiroSecurityManager;
import datart.security.util.PermissionHelper;
import datart.server.base.dto.ViewComposeResult;
import datart.server.base.dto.ViewDetailDTO;
import datart.server.base.dto.ViewLineageDTO;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.base.params.*;
import datart.server.base.transfer.ImportStrategy;
import datart.server.base.transfer.TransferConfig;
import datart.server.base.transfer.model.ViewResourceModel;
import datart.server.common.fieldmeta.SqlModelQueryPathSanitizer;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.ViewModelExportSanitizer;
import datart.server.common.fieldmeta.ViewModelMigrator;
import datart.server.service.*;
import org.springframework.beans.BeanUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.stream.Collectors;

@Service
public class ViewServiceImpl extends BaseService implements ViewService {

    private final ViewMapperExt viewMapper;

    private final RelSubjectColumnsMapperExt rscMapper;

    private final RelRoleResourceMapperExt rrrMapper;

    private final RoleService roleService;

    private final VariableService variableService;

    private final VariableMapperExt variableMapper;

    private final RelVariableSubjectMapperExt rvsMapper;

    private final DashboardMapperExt dashboardMapper;

    private final DatachartMapperExt datachartMapper;

    private final ViewFieldService viewFieldService;

    private final SourceSchemaIndex schemaIndex;

    private final SqlModelQueryPathSanitizer sqlModelQueryPathSanitizer;

    private final MigrationModeService migrationModeService;

    private final ViewModelMigrator modelMigrator = new ViewModelMigrator();

    public ViewServiceImpl(ViewMapperExt viewMapper,
                           RelSubjectColumnsMapperExt rscMapper,
                           RelRoleResourceMapperExt rrrMapper,
                           RoleService roleService,
                           VariableService variableService,
                           VariableMapperExt variableMapper,
                           RelVariableSubjectMapperExt rvsMapper,
                           DashboardMapperExt dashboardMapper,
                           DatachartMapperExt datachartMapper,
                           ViewFieldService viewFieldService,
                           SourceSchemaIndex schemaIndex,
                           SqlModelQueryPathSanitizer sqlModelQueryPathSanitizer,
                           MigrationModeService migrationModeService) {
        this.viewMapper = viewMapper;
        this.rscMapper = rscMapper;
        this.rrrMapper = rrrMapper;
        this.roleService = roleService;
        this.variableService = variableService;
        this.variableMapper = variableMapper;
        this.rvsMapper = rvsMapper;
        this.dashboardMapper = dashboardMapper;
        this.datachartMapper = datachartMapper;
        this.viewFieldService = viewFieldService;
        this.schemaIndex = schemaIndex;
        this.sqlModelQueryPathSanitizer = sqlModelQueryPathSanitizer;
        this.migrationModeService = migrationModeService;
    }

    @Override
    public ViewComposeResult compose(ViewComposeParam param) throws Exception {
        View left = retrieve(param.getLeftViewId());
        View right = retrieve(param.getRightViewId());
        if (!Objects.equals(left.getOrgId(), right.getOrgId())
                || !Objects.equals(left.getSourceId(), right.getSourceId())) {
            Exceptions.tr(ParamException.class, "The views must belong to the same data source");
        }
        if (Objects.equals(left.getId(), right.getId())) {
            Exceptions.tr(ParamException.class, "A view cannot join itself");
        }

        Source source = retrieve(left.getSourceId(), Source.class, false);
        Application.getBean(SourceService.class).requirePermission(source, Const.READ);
        validateJoinConditions(left, right, param.getConditions());

        String joinType = normalizeJoinType(param.getJoinType());
        DataProviderService dataProviderService = Application.getBean(DataProviderService.class);
        DataProviderSource providerSource = dataProviderService.parseDataProviderConfig(source);
        // SQL source scripts must stay as templates until the real viewer
        // executes the composed view; rendering with an empty variable map
        // here would silently erase view-specific security predicates.
        String leftPrefix = "__join0__";
        String rightPrefix = "__join1__";
        String leftSql = namespaceSqlVariables(renderViewSql(providerSource, left),
                leftPrefix, runtimeViewVariableNames(left, new HashSet<>()));
        String rightSql = namespaceSqlVariables(renderViewSql(providerSource, right),
                rightPrefix, runtimeViewVariableNames(right, new HashSet<>()));
        String selectList = buildSelectList(left, right);
        String conditions = param.getConditions().stream()
                .map(condition -> quote("v0") + "." + quote(resolveInputColumnName(left, condition.getLeftColumn()))
                        + " = " + quote("v1") + "." + quote(resolveInputColumnName(right, condition.getRightColumn())))
                .collect(Collectors.joining(" AND "));
        String script = "SELECT " + selectList + "\n"
                + "FROM (\n" + indent(leftSql) + "\n) " + quote("v0") + "\n"
                + joinType + " JOIN (\n" + indent(rightSql) + "\n) " + quote("v1")
                + "\nON " + conditions;

        JSONObject config = new JSONObject();
        JSONObject lineage = new JSONObject();
        lineage.put("upstreamViewIds", Arrays.asList(left.getId(), right.getId()));
        Map<String, String> variableScopes = new LinkedHashMap<>();
        variableScopes.put(left.getId(), leftPrefix);
        variableScopes.put(right.getId(), rightPrefix);
        lineage.put("variableScopes", variableScopes);
        // Stable source identity: SQL subquery aliases alone cannot recover
        // physical lineage, comments or distinct same-name JOIN fields.
        lineage.put("outputFieldSources", outputFieldSources(left, right));
        config.put("lineage", lineage);
        JSONObject viewJoin = new JSONObject();
        viewJoin.put("leftViewId", left.getId());
        viewJoin.put("rightViewId", right.getId());
        viewJoin.put("joinType", joinType);
        viewJoin.put("conditions", param.getConditions());
        config.put("viewJoin", viewJoin);
        return new ViewComposeResult(source.getId(), script, config.toJSONString());
    }

    @Override
    public ViewLineageDTO getLineage(String viewId) {
        View view = retrieve(viewId);
        ViewLineageDTO lineage = new ViewLineageDTO();

        // ── Upstream: sources (STRUCT / SQL views) ──
        if ("STRUCT".equals(view.getType()) || "SQL".equals(view.getType())) {
            buildSourceLineage(view, lineage);
        }

        // ── Upstream: views (compose views) ──
        for (String upstreamId : parseUpstreamViewIds(view.getConfig())) {
            View upstream = viewMapper.selectActiveByPrimaryKey(upstreamId);
            if (upstream != null && canRead(upstream)) {
                lineage.getViews().add(new ViewLineageDTO.Item(upstream.getId(), upstream.getName()));
            }
        }

        // ── Downstream: views (views that reference this view via compose) ──
        List<View> downstreamViews = activeDownstreamViews(view).stream()
                .filter(this::canRead)
                .collect(Collectors.toList());
        downstreamViews.forEach(item ->
                lineage.getViews().add(new ViewLineageDTO.Item(item.getId(), item.getName())));

        // ── Downstream: dashboards ──
        dashboardMapper.listByViewId(viewId).stream()
                .filter(this::canRead)
                .forEach(item -> lineage.getDashboards()
                        .add(new ViewLineageDTO.Item(item.getId(), item.getName())));

        // ── Downstream: analyses ──
        datachartMapper.listByViewId(viewId).stream()
                .filter(this::canRead)
                .forEach(item -> lineage.getAnalyses()
                        .add(new ViewLineageDTO.Item(item.getId(), item.getName())));
        return lineage;
    }

    /**
     * 提取表视图（STRUCT）和 SQL 视图的上游数据源信息。
     * <p>
     * STRUCT: 解析 script JSON，提取主表名及 JOIN 表名。
     * 显示格式为 "数据源名称 / 表名"。
     * <p>
     * SQL: 显示数据源名称。
     */
    private void buildSourceLineage(View view, ViewLineageDTO lineage) {
        try {
            Source source = retrieve(view.getSourceId(), Source.class, true);
            String display = source.getName();
            if ("STRUCT".equals(view.getType()) && view.getScript() != null) {
                try {
                    JSONObject structJson = JSON.parseObject(view.getScript());
                    JSONArray tableArr = structJson.getJSONArray("table");
                    if (tableArr != null && !tableArr.isEmpty()) {
                        String tablePath = tableArr.stream()
                                .map(Object::toString)
                                .collect(Collectors.joining("."));
                        display = source.getName() + " / " + tablePath;
                    }
                } catch (Exception ignored) {
                    // Script may not be valid STRUCT JSON, use source name only
                }
            }
            lineage.getSources().add(new ViewLineageDTO.Item(source.getId(), display));
        } catch (Exception ignored) {
            // Source not accessible or permission denied, skip
        }
    }


    /** Exact FreeMarker and SQL fragment placeholders; never replace raw
     * identifier substrings (e.g. city in city_code). */
    static String namespaceSqlVariables(String sql, String prefix, Set<String> names) {
        if (sql == null || names.isEmpty()) return sql;
        String result = sql;
        for (String name : names) {
            result = result.replace("${" + name + "}", "${" + prefix + name + "}");
            result = result.replace("$" + name + "$", "$" + prefix + name + "$");
        }
        return result;
    }

    /** These names are what a composed upstream view actually exposes,
     * including earlier JOIN namespaces. Organization variables stay global. */
    private Set<String> runtimeViewVariableNames(View view, Set<String> visiting) {
        Set<String> names = new LinkedHashSet<>();
        if (view == null || !visiting.add(view.getId())) return names;
        try {
            for (Variable item : variableMapper.selectViewVariables(view.getId())) {
                if (item.getName() != null) names.add(item.getName());
            }
            if (view.getConfig() != null) {
                JSONObject cfg = JSON.parseObject(view.getConfig());
                JSONObject lineage = cfg == null ? null : cfg.getJSONObject("lineage");
                JSONArray ids = lineage == null ? null : lineage.getJSONArray("upstreamViewIds");
                JSONObject scopes = lineage == null ? null : lineage.getJSONObject("variableScopes");
                if (ids != null) {
                    for (String id : ids.toJavaList(String.class)) {
                        View upstream = viewMapper.selectActiveByPrimaryKey(id);
                        String prefix = scopes == null ? "" : scopes.getString(id);
                        if (prefix == null) prefix = "";
                        for (String name : runtimeViewVariableNames(upstream, visiting)) {
                            names.add(prefix + name);
                        }
                    }
                }
            }
            return names;
        } finally {
            visiting.remove(view.getId());
        }
    }

    private String renderViewSql(DataProviderSource providerSource, View view) throws Exception {
        // Do not resolve source SQL variables at JOIN design time.
        // The composed SQL must evaluate them under the eventual viewer.
        if ("SQL".equalsIgnoreCase(view.getType())) {
            return view.getScript().trim().replaceFirst(";\\s*$", "");
        }
        QueryScript queryScript = QueryScript.builder()
                .test(true)
                .sourceId(view.getSourceId())
                .script(view.getScript())
                .scriptType(ScriptType.valueOf(view.getType()))
                .variables(Collections.emptyList())
                .build();
        String sql = Application.getBean(DataProviderService.class)
                .renderSql(providerSource, queryScript, ExecuteParam.empty());
        return sql == null ? "" : sql.trim().replaceFirst(";\\s*$", "");
    }

    private void validateJoinConditions(View left, View right,
                                        List<ViewComposeParam.JoinCondition> conditions) {
        Set<String> leftColumns = modelColumns(left);
        Set<String> rightColumns = modelColumns(right);
        for (ViewComposeParam.JoinCondition condition : conditions) {
            if (!leftColumns.contains(condition.getLeftColumn())
                    || !rightColumns.contains(condition.getRightColumn())) {
                Exceptions.tr(ParamException.class, "Join column does not exist in the selected view");
            }
        }
    }


    private JSONObject outputFieldSources(View left, View right) {
        JSONObject result = new JSONObject();
        Set<String> used = new HashSet<>();
        for (String column : modelColumns(left)) {
            result.put(column, fieldSource(left.getId(), column));
            used.add(column);
        }
        for (String column : modelColumns(right)) {
            String alias = column;
            int suffix = 1;
            while (used.contains(alias)) {
                alias = "right_" + column + (suffix == 1 ? "" : "_" + suffix);
                suffix++;
            }
            used.add(alias);
            result.put(alias, fieldSource(right.getId(), column));
        }
        return result;
    }

    private JSONObject fieldSource(String viewId, String sourceColumnKey) {
        JSONObject source = new JSONObject();
        source.put("viewId", viewId);
        source.put("columnKey", sourceColumnKey);
        return source;
    }

    /**
     * A STRUCT table field is a physical path, but a SQL/composed View
     * already exposes an output column name (possibly containing dots).
     */
    static String resolveInputColumnName(View view, String column) {
        return "STRUCT".equalsIgnoreCase(view.getType())
                ? extractPhysicalColumnName(column)
                : column;
    }

    private static String extractPhysicalColumnName(String column) {
        int lastDot = column.lastIndexOf('.');
        return lastDot < 0 ? column : column.substring(lastDot + 1);
    }

    private String buildSelectList(View left, View right) {
        Set<String> leftColumns = modelColumns(left);
        Set<String> rightColumns = modelColumns(right);
        if (leftColumns.isEmpty() || rightColumns.isEmpty()) {
            return quote("v0") + ".*, " + quote("v1") + ".*";
        }
        List<String> selections = new ArrayList<>();
        leftColumns.forEach(column -> selections.add(
                quote("v0") + "." + quote(resolveInputColumnName(left, column)) + " AS " + quote(column)));
        Set<String> usedAliases = new HashSet<>(leftColumns);
        for (String column : rightColumns) {
            String alias = column;
            int suffix = 1;
            while (usedAliases.contains(alias)) {
                alias = "right_" + column + (suffix == 1 ? "" : "_" + suffix);
                suffix++;
            }
            usedAliases.add(alias);
            selections.add(quote("v1") + "." + quote(resolveInputColumnName(right, column)) + " AS " + quote(alias));
        }
        return selections.stream().collect(Collectors.joining(",\n       "));
    }

    private Set<String> modelColumns(View view) {
        if (view.getModel() == null) {
            return Collections.emptySet();
        }
        JSONObject model = JSON.parseObject(view.getModel());
        JSONObject columns = model.getJSONObject("columns");
        return columns == null ? Collections.emptySet() : columns.keySet();
    }

    private String normalizeJoinType(String joinType) {
        String normalized = joinType.trim().toUpperCase(Locale.ROOT);
        if (!Arrays.asList("INNER", "LEFT", "RIGHT", "FULL").contains(normalized)) {
            Exceptions.tr(ParamException.class, "Unsupported join type");
        }
        return normalized;
    }

    private List<String> parseUpstreamViewIds(String configText) {
        if (configText == null) {
            return Collections.emptyList();
        }
        try {
            JSONObject config = JSON.parseObject(configText);
            JSONObject lineage = config.getJSONObject("lineage");
            JSONArray ids = lineage == null ? null : lineage.getJSONArray("upstreamViewIds");
            return ids == null ? Collections.emptyList() : ids.toJavaList(String.class);
        } catch (Exception ignored) {
            return Collections.emptyList();
        }
    }

    private List<View> activeDownstreamViews(View view) {
        return viewMapper.listByOrgId(view.getOrgId()).stream()
                .filter(candidate -> parseUpstreamViewIds(candidate.getConfig()).contains(view.getId()))
                .collect(Collectors.toList());
    }

    private boolean canRead(BaseEntity entity) {
        try {
            if (entity instanceof View) {
                requirePermission((View) entity, Const.READ);
            } else if (entity instanceof Dashboard) {
                retrieve(entity.getId(), Dashboard.class, true);
            } else if (entity instanceof Datachart) {
                retrieve(entity.getId(), Datachart.class, true);
            }
            return true;
        } catch (Exception ignored) {
            return false;
        }
    }

    private String quote(String identifier) {
        return "`" + identifier.replace("`", "``") + "`";
    }

    /**
     * Extract the actual column name from a model column key.
     * Model column keys are dot-separated paths like "dim.dim_date.month_cn"
     * where the last segment is the actual column name ("month_cn").
     * Simple column names like "renting_48v" are returned as-is.
     */
    private String extractActualColumn(String modelColumnKey) {
        return extractPhysicalColumnName(modelColumnKey);
    }

    private String indent(String sql) {
        return Arrays.stream(sql.split("\\R"))
                .map(line -> "  " + line)
                .collect(Collectors.joining("\n"));
    }

    @Override
    @Transactional
    public View create(BaseCreateParam createParam) {

        ViewCreateParam viewCreateParam = (ViewCreateParam) createParam;
        View view = new View();
        BeanUtils.copyProperties(createParam, view);
        view.setType(viewCreateParam.getType() == null ? null : viewCreateParam.getType().name());
        view.setCreateBy(getCurrentUser().getId());
        view.setCreateTime(new Date());
        view.setId(UUIDGenerator.generate());
        view.setStatus(Const.DATA_STATUS_ACTIVE);
        sanitizeSqlQueryPaths(view);
        canonicalizeModelMetadata(view);
        requirePermission(view, Const.CREATE);
        viewFieldService.reconcile(view);
        viewMapper.insert(view);

        getRoleService().grantPermission(viewCreateParam.getPermissions());

        if (!CollectionUtils.isEmpty(viewCreateParam.getVariablesToCreate())) {
            List<VariableCreateParam> variablesToCreate = viewCreateParam.getVariablesToCreate();
            variablesToCreate.forEach(var -> {
                var.setViewId(view.getId());
                var.setOrgId(viewCreateParam.getOrgId());
            });
            variableService.batchInsert(variablesToCreate);
        }
        List<RelSubjectColumns> columnPermission = viewCreateParam.getColumnPermission();
        if (!CollectionUtils.isEmpty(columnPermission)) {
            for (RelSubjectColumns relSubjectColumns : columnPermission) {
                relSubjectColumns.setViewId(view.getId());
                relSubjectColumns.setId(UUIDGenerator.generate());
                relSubjectColumns.setCreateBy(getCurrentUser().getId());
                relSubjectColumns.setCreateTime(new Date());
            }
            rscMapper.batchInsert(columnPermission);
        }

        return getViewDetail(view.getId());
    }

    @Override
    public ViewDetailDTO getViewDetail(String viewId) {
        View view = retrieve(viewId);
        ViewDetailDTO viewDetailDTO = buildViewDetail(view);
        // column permission
        viewDetailDTO.setRelSubjectColumns(rscMapper.listByView(viewId));
        //view variables
        viewDetailDTO.setVariables(variableService.listByView(viewId));
        // view variables rel
        viewDetailDTO.setRelVariableSubjects(variableService.listViewVariableRels(viewId));
        return viewDetailDTO;
    }

    @Override
    @Transactional
    public ViewDetailDTO refreshFieldMetadata(String viewId) {
        View view = retrieve(viewId);
        requirePermission(view, Const.MANAGE);
        // Reconcile only the saved definition. Unsaved editor SQL and model
        // changes are deliberately not part of this operation.
        viewFieldService.reconcile(view);
        view.setUpdateBy(getCurrentUser().getId());
        view.setUpdateTime(new Date());
        if (viewMapper.updateByPrimaryKey(view) != 1) {
            throw new IllegalStateException("VIEW_FIELD_REFRESH_FAILED");
        }
        return getViewDetail(viewId);
    }

    @Override
    public ViewDetailDTO buildViewDetail(View view) {
        if (migrationModeService == null) {
            throw new IllegalStateException("STRICT_ONLY_MIGRATION_MODE_SERVICE_REQUIRED");
        }
        return buildViewDetail(view, migrationModeService.getMode(view.getOrgId()));
    }

    @Override
    public ViewDetailDTO buildViewDetail(View view, MigrationMode migrationMode) {
        ViewDetailDTO viewDetailDTO = new ViewDetailDTO(view);
        if (migrationMode != MigrationMode.STRICT) {
            throw new IllegalStateException("STRICT_ONLY_VIEW_REQUIRED: " + view.getId());
        }
        viewDetailDTO.setMigrationMode(MigrationMode.STRICT);
        List<ViewFieldDTO> fields = viewFieldService.listByViewId(view.getId());
        viewDetailDTO.setFields(fields == null ? new ArrayList<>() : new ArrayList<>(fields));
        return viewDetailDTO;
    }

    @Override
    public List<View> getViews(String orgId) {
        List<View> views = viewMapper.listByOrgId(orgId);

        Map<String, View> filtered = new HashMap<>();

        List<View> permitted = views.stream().filter(view -> {
            try {
                requirePermission(view, Const.READ);
                return true;
            } catch (Exception e) {
                filtered.put(view.getId(), view);
                return false;
            }
        }).collect(Collectors.toList());

        while (!filtered.isEmpty()) {
            boolean updated = false;
            for (View view : permitted) {
                View parent = filtered.remove(view.getParentId());
                if (parent != null) {
                    permitted.add(parent);
                    updated = true;
                    break;
                }
            }
            if (!updated) {
                break;
            }
        }
        return permitted;

    }

    @Override
    public View updateView(BaseUpdateParam updateParam) {
        boolean update = update(updateParam);
        return getViewDetail(updateParam.getId());
    }

    @Override
    public RoleService getRoleService() {
        return roleService;
    }

    @Override
    @Transactional
    public boolean unarchive(String id, String newName, String parentId, double index) {

        View view = retrieve(id);
        requirePermission(view, Const.MANAGE);

        //check name
        if (!view.getName().equals(newName)) {
            checkUnique(view.getOrgId(), parentId, newName);
        }

        // update status
        view.setName(newName);
        view.setParentId(parentId);
        view.setStatus(Const.DATA_STATUS_ACTIVE);
        view.setIndex(index);
        return 1 == viewMapper.updateByPrimaryKey(view);

    }

    @Override
    @Transactional
    public void deleteReference(View view) {
        List<Variable> variables = variableService.listByView(view.getId());
        if (variables.size() > 0) {
            rvsMapper.deleteByVariables(variables.stream().map(Variable::getId).collect(Collectors.toSet()));
        }
        rscMapper.deleteByView(view.getId());
        variableService.delViewVariables(view.getId());
    }

    @Override
    public boolean updateBase(ViewBaseUpdateParam updateParam) {
        View view = retrieve(updateParam.getId());
        requirePermission(view, Const.MANAGE);
        if (!view.getName().equals(updateParam.getName())) {
            //check name
            View check = new View();
            check.setParentId(updateParam.getParentId());
            check.setOrgId(view.getOrgId());
            check.setName(updateParam.getName());
            checkUnique(check);
        }

        // update base info
        view.setId(updateParam.getId());
        view.setUpdateBy(getCurrentUser().getId());
        view.setUpdateTime(new Date());
        view.setName(updateParam.getName());
        view.setParentId(updateParam.getParentId());
        view.setIndex(updateParam.getIndex());
        return 1 == viewMapper.updateByPrimaryKey(view);
    }

    @Override
    public ViewResourceModel exportResource(TransferConfig transferConfig, Set<String> ids) {

        if (ids == null || ids.size() == 0) {
            return null;
        }

        ViewResourceModel viewResourceModel = new ViewResourceModel();
        List<ViewResourceModel.MainModel> mainModels = new LinkedList<>();
        viewResourceModel.setMainModels(mainModels);
        Map<String, View> parentMap = new HashMap<>();
        Set<String> sourceIds = new HashSet<>();

        for (String viewId : ids) {
            ViewResourceModel.MainModel mainModel = new ViewResourceModel.MainModel();
            View view = retrieve(viewId);
            securityManager.requireOrgOwner(view.getOrgId());
            View exportView = new View();
            BeanUtils.copyProperties(view, exportView);
            exportView.setModel(ViewModelExportSanitizer.sanitize(viewFieldService.exportModel(view)));
            mainModel.setView(exportView);
            // variables
            mainModel.setVariables(variableService.listByView(viewId));
            mainModels.add(mainModel);
            sourceIds.add(view.getSourceId());
            if (transferConfig.isWithParents()) {
                List<View> allParents = getAllParents(view.getParentId());
                if (!CollectionUtils.isEmpty(allParents)) {
                    for (View parent : allParents) {
                        parentMap.put(parent.getId(), parent);
                    }
                }
            }
        }
        viewResourceModel.setParents(new LinkedList<>(parentMap.values()));
        // source
        viewResourceModel.setSources(sourceIds);
        return viewResourceModel;
    }

    @Override
    @Transactional
    public boolean importResource(ViewResourceModel model, ImportStrategy strategy, String orgId) {
        if (model == null) {
            return true;
        }
        switch (strategy) {
            case OVERWRITE:
                importView(model, orgId, true);
                break;
            case ROLLBACK:
                importView(model, orgId, false);
                break;
            default:
                importView(model, orgId, false);
        }
        return true;
    }

    @Override
    public void replaceId(ViewResourceModel model
            , final Map<String, String> sourceIdMapping
            , final Map<String, String> viewIdMapping
            , final Map<String, String> chartIdMapping, Map<String, String> boardIdMapping, Map<String, String> folderIdMapping) {

        if (model == null || model.getMainModels() == null) {
            return;
        }
        Map<String, String> parentIdMapping = new HashMap<>();
        if (!CollectionUtils.isEmpty(model.getParents())) {
            for (View parent : model.getParents()) {
                String newId = UUIDGenerator.generate();
                parentIdMapping.put(parent.getId(), newId);
                parent.setId(newId);
            }
            for (View parent : model.getParents()) {
                parent.setParentId(parentIdMapping.get(parent.getParentId()));
            }
        }
        for (ViewResourceModel.MainModel mainModel : model.getMainModels()) {
            String newId = UUIDGenerator.generate();
            viewIdMapping.put(mainModel.getView().getId(), newId);
            mainModel.getView().setId(newId);
            mainModel.getView().setSourceId(sourceIdMapping.get(mainModel.getView().getSourceId()));
            mainModel.getView().setParentId(parentIdMapping.get(mainModel.getView().getParentId()));
            if (!CollectionUtils.isEmpty(mainModel.getVariables())) {
                for (Variable variable : mainModel.getVariables()) {
                    variable.setId(UUIDGenerator.generate());
                    variable.setViewId(newId);
                }
            }
        }
    }


    @Override
    public boolean checkUnique(String orgId, String parentId, String name) {
        if (!CollectionUtils.isEmpty(viewMapper.checkName(orgId, parentId, name))) {
            Exceptions.tr(ParamException.class, "error.param.exists.name");
        }
        return true;
    }

    @Override
    @Transactional
    public boolean update(BaseUpdateParam updateParam) {
        ViewUpdateParam viewUpdateParam = (ViewUpdateParam) updateParam;
        View view = retrieve(viewUpdateParam.getId());
        requirePermission(view, Const.MANAGE);
        if (!CollectionUtils.isEmpty(viewUpdateParam.getVariablesToCreate())) {
            List<VariableCreateParam> variablesToCreate = viewUpdateParam.getVariablesToCreate();
            for (VariableCreateParam variableCreateParam : variablesToCreate) {
                variableCreateParam.setOrgId(view.getOrgId());
                variableCreateParam.setViewId(viewUpdateParam.getId());
            }
            variableService.batchInsert(variablesToCreate);
        }

        if (!CollectionUtils.isEmpty(viewUpdateParam.getVariablesToUpdate())) {
            List<VariableUpdateParam> variablesToUpdate = viewUpdateParam.getVariablesToUpdate();
            variableService.batchUpdate(variablesToUpdate);
        }

        if (!CollectionUtils.isEmpty(viewUpdateParam.getVariableToDelete())) {
            Set<String> delete = viewUpdateParam.getVariableToDelete();
            variableService.deleteByIds(delete);
        }

        List<RelSubjectColumns> columnPermission = viewUpdateParam.getColumnPermission();
        if (columnPermission != null) {
            rscMapper.deleteByView(updateParam.getId());
            for (RelSubjectColumns relSubjectColumns : columnPermission) {
                relSubjectColumns.setId(UUIDGenerator.generate());
                relSubjectColumns.setCreateBy(getCurrentUser().getId());
                relSubjectColumns.setCreateTime(new Date());
            }
            if (!CollectionUtils.isEmpty(columnPermission)) {
                rscMapper.batchInsert(columnPermission);
            }
        }
        Application.getBean(DataProviderService.class).updateSource(retrieve(view.getSourceId(), Source.class, false));
        BeanUtils.copyProperties(updateParam, view);
        view.setType(viewUpdateParam.getType().name());
        sanitizeSqlQueryPaths(view);
        canonicalizeModelMetadata(view);
        viewFieldService.reconcile(view);
        view.setUpdateBy(getCurrentUser().getId());
        view.setUpdateTime(new Date());
        return 1 == viewMapper.updateByPrimaryKey(view);
    }

    private void canonicalizeModelMetadata(View view) {
        String model = view.getModel();
        if (model == null || model.trim().isEmpty()) {
            return;
        }
        try {
            com.fasterxml.jackson.databind.JsonNode parsed = OBJECT_MAPPER.readTree(model);
            if (!(parsed instanceof com.fasterxml.jackson.databind.node.ObjectNode objectModel)) {
                return;
            }
            SourceSchemaIndex.Index source = schemaIndex == null || view.getSourceId() == null
                    ? null
                    : schemaIndex.forSource(view.getSourceId());
            ViewModelMigrator.Result result = modelMigrator.migrate(objectModel, source, view.getType());
            view.setModel(OBJECT_MAPPER.writeValueAsString(result.model()));
        } catch (Exception ignored) {
            // Keep the submitted model unchanged when it cannot be canonicalized.
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private void sanitizeSqlQueryPaths(View view) {
        if (!"SQL".equalsIgnoreCase(view.getType()) || !hasText(view.getScript()) || !hasText(view.getModel())) {
            return;
        }
        try {
            com.fasterxml.jackson.databind.JsonNode root = OBJECT_MAPPER.readTree(view.getModel());
            if (root instanceof com.fasterxml.jackson.databind.node.ObjectNode model) {
                sqlModelQueryPathSanitizer.sanitize(view.getScript(), model,
                        schemaIndex.forSource(view.getSourceId()));
                view.setModel(OBJECT_MAPPER.writeValueAsString(model));
            }
        } catch (Exception ignored) {
            // Invalid or unsupported SQL keeps the submitted model unchanged.
        }
    }

    @Override
    public void requirePermission(View view, int permission) {
        if (securityManager.isOrgOwner(view.getOrgId())) {
            return;
        }
        requirePermission(view, permission, new HashSet<>());
    }

    private void requirePermission(View view, int permission, Set<String> visited) {
        if (view.getId() != null && !visited.add(view.getId())) {
            return;
        }
        List<Role> roles = roleService.listUserRoles(view.getOrgId(), getCurrentUser().getId());
        boolean hasPermission = roles.stream().anyMatch(role -> hasPermission(role, view, permission));
        if (!hasPermission) {
            Exceptions.tr(PermissionDeniedException.class, "message.security.permission-denied",
                    ResourceType.VIEW + ":" + view.getName() + ":" + ShiroSecurityManager.expand2StringPermissions(permission));
        }
        if (permission == Const.READ) {
            for (String upstreamId : parseUpstreamViewIds(view.getConfig())) {
                View upstream = viewMapper.selectActiveByPrimaryKey(upstreamId);
                if (upstream == null) {
                    Exceptions.tr(NotFoundException.class, "Upstream view not found: " + upstreamId);
                }
                requirePermission(upstream, Const.READ, visited);
            }
        }
    }

    private boolean hasPermission(Role role, View view, int permission) {
        if (view.getId() == null || rrrMapper.countRolePermission(view.getId(), role.getId()) == 0) {
            View parent = viewMapper.selectByPrimaryKey(view.getParentId());
            if (parent == null) {
                return securityManager.hasPermission(PermissionHelper.viewPermission(view.getOrgId(), role.getId(), ResourceType.VIEW.name(), permission));
            } else {
                return hasPermission(role, parent, permission);
            }
        } else {
            return securityManager.hasPermission(PermissionHelper.viewPermission(view.getOrgId(), role.getId(), view.getId(), permission));
        }
    }

    @Override
    public List<String> getReadableRoleIds(View view) {
        return roleService.listUserRoles(view.getOrgId(), getCurrentUser().getId()).stream()
                .filter(role -> hasPermission(role, view, Const.READ))
                .map(Role::getId)
                .toList();
    }

    public boolean safeDelete(String id) {
        // check children
        if (viewMapper.checkReference(id) != 0) {
            return false;
        }
        View view = viewMapper.selectActiveByPrimaryKey(id);
        return (view == null || activeDownstreamViews(view).isEmpty())
                && CollectionUtils.isEmpty(datachartMapper.listByViewId(id))
                && CollectionUtils.isEmpty(dashboardMapper.listByViewId(id));
    }

    private void importView(ViewResourceModel model,
                            String orgId,
                            boolean deleteFirst) {
        if (model == null || CollectionUtils.isEmpty(model.getMainModels())) {
            return;
        }
        for (ViewResourceModel.MainModel mainModel : model.getMainModels()) {
            View view = mainModel.getView();
            if (view == null) {
                continue;
            }
            if (deleteFirst) {
                try {
                    View retrieve = retrieve(view.getId(), false);
                    if (retrieve != null && !retrieve.getOrgId().equals(orgId)) {
                        Exceptions.msg("message.viz.import.database.conflict");
                    }
                } catch (NotFoundException ignored) {
                }
                try {
                    delete(view.getId(), false, false);
                } catch (Exception ignore) {
                }
            }
            // check name
            try {
                View check = new View();
                check.setOrgId(orgId);
                check.setParentId(view.getParentId());
                check.setName(view.getName());
                checkUnique(check);
            } catch (Exception e) {
                view.setName(DateUtils.withTimeString(view.getName()));
            }
            // insert view
            view.setOrgId(orgId);
            view.setUpdateBy(getCurrentUser().getId());
            view.setUpdateTime(new Date());
            sanitizeSqlQueryPaths(view);
            canonicalizeModelMetadata(view);
            viewMapper.insert(view);
            viewFieldService.rebuild(view);
            viewMapper.updateByPrimaryKey(view);

            // insert variables
            if (!CollectionUtils.isEmpty(mainModel.getVariables())) {
                for (Variable variable : mainModel.getVariables()) {
                    variable.setOrgId(orgId);
                }
                variableMapper.batchInsert(mainModel.getVariables());
            }

            // insert parents
            if (!CollectionUtils.isEmpty(model.getParents())) {
                for (View parent : model.getParents()) {
                    try {
                        View check = new View();
                        check.setOrgId(orgId);
                        check.setName(parent.getName());
                        check.setParentId(check.getParentId());
                        checkUnique(check);
                    } catch (Exception e) {
                        parent.setName(DateUtils.withTimeString(parent.getName()));
                    }
                    try {
                        parent.setOrgId(orgId);
                        viewMapper.insert(parent);
                    } catch (Exception ignore) {
                    }
                }
            }
        }
    }

    @Override
    public List<View> getAllParents(String viewId) {
        List<View> parents = new LinkedList<>();
        getParent(parents, viewId);
        return parents;
    }

    private void getParent(List<View> list, String parentId) {
        View view = viewMapper.selectByPrimaryKey(parentId);
        if (view != null) {
            if (view.getParentId() != null) {
                getParent(list, view.getParentId());
            }
            list.add(view);
        }
    }

}
