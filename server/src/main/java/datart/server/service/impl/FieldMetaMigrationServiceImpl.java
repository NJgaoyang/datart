package datart.server.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.base.consts.Const;
import datart.core.entity.Datachart;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.entity.Widget;
import datart.core.mappers.ext.FieldMetaMigrationMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.security.util.PermissionHelper;
import datart.server.base.dto.FieldMetaMigrationIssue;
import datart.server.base.dto.FieldMetaMigrationIssueSeverity;
import datart.server.base.dto.FieldMetaMigrationRequest;
import datart.server.base.dto.FieldMetaMigrationResult;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.base.dto.FieldMetaMigrationScope;
import datart.server.base.dto.FieldMetaMigrationVerify;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.common.fieldmeta.ChartConfigReconciler;
import datart.server.common.fieldmeta.FieldMetaResolver;
import datart.server.common.fieldmeta.FieldMetaDiagnostics;
import datart.server.common.fieldmeta.InvalidMigrationJsonException;
import datart.server.common.fieldmeta.ResolvedFieldMeta;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.SqlModelQueryPathSanitizer;
import datart.server.common.fieldmeta.StrictJson;
import datart.server.common.fieldmeta.ViewModelMigrator;
import datart.server.service.BaseService;
import datart.server.service.FieldMetaMigrationService;
import datart.server.service.ViewFieldService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class FieldMetaMigrationServiceImpl extends BaseService implements FieldMetaMigrationService {

    private static final String VIEW = "VIEW";
    private static final String WIDGET = "WIDGET";
    private static final String DATACHART = "DATACHART";
    private static final String VIEW_FIELD_BACKUP = "field_meta_migration_view_field_backup";

    private final FieldMetaMigrationMapperExt mapper;
    private final SourceSchemaIndex schemaIndex;
    private final StrictJson strictJson;
    private final JdbcTemplate jdbcTemplate;
    private final ViewFieldService viewFieldService;
    private final ViewFieldMapperExt viewFieldMapper;
    private final SqlModelQueryPathSanitizer sqlModelQueryPathSanitizer = new SqlModelQueryPathSanitizer();

    public FieldMetaMigrationServiceImpl(FieldMetaMigrationMapperExt mapper,
                                         SourceSchemaIndex schemaIndex,
                                         StrictJson strictJson,
                                         JdbcTemplate jdbcTemplate,
                                         ViewFieldService viewFieldService,
                                         ViewFieldMapperExt viewFieldMapper) {
        this.mapper = mapper;
        this.schemaIndex = schemaIndex;
        this.strictJson = strictJson;
        this.jdbcTemplate = jdbcTemplate;
        this.viewFieldService = viewFieldService;
        this.viewFieldMapper = viewFieldMapper;
    }

    @Override
    public FieldMetaMigrationScan scan(String orgId) {
        checkAdminPermission(orgId);
        Snapshot snapshot = buildSnapshot(orgId);
        FieldMetaMigrationScan scan = new FieldMetaMigrationScan();
        scan.setOrgId(orgId);
        scan.setViews(snapshot.views);
        scan.setWidgets(snapshot.widgets);
        scan.setDatacharts(snapshot.datacharts);
        scan.setIssues(snapshot.issues);
        scan.setScanToken(scanToken(snapshot.tokens));
        scan.setCanMigrate(snapshot.issues.stream().noneMatch(FieldMetaMigrationServiceImpl::isBlocking));
        return scan;
    }

    @Override
    @Transactional
    public FieldMetaMigrationResult migrate(FieldMetaMigrationRequest request) {
        checkAdminPermission(request.getOrgId());
        Snapshot snapshot = buildSnapshot(request.getOrgId());
        String actualToken = scanToken(snapshot.tokens);
        if (request.getExpectedScanToken() == null || !request.getExpectedScanToken().equals(actualToken)) {
            throw new IllegalArgumentException("SCAN_EXPIRED");
        }
        if (snapshot.issues.stream().anyMatch(FieldMetaMigrationServiceImpl::isBlocking)) {
            throw new IllegalArgumentException("MIGRATION_BLOCKED: scan contains blocking issues");
        }

        String runId = id();
        String userId = getCurrentUser() == null ? null : getCurrentUser().getId();
        insertRun(runId, request.getOrgId(), userId, snapshot);
        FieldMetaMigrationResult result = new FieldMetaMigrationResult();
        result.setRunId(runId);
        result.setStatus("RUNNING");
        result.setViews(copy(snapshot.views));
        result.setWidgets(copy(snapshot.widgets));
        result.setDatacharts(copy(snapshot.datacharts));
        resetMigrationCounters(result.getViews());
        resetMigrationCounters(result.getWidgets());
        resetMigrationCounters(result.getDatacharts());

        try {
            migrateViews(snapshot, runId, userId, result);
            migrateWidgets(snapshot, runId, userId, result);
            migrateDatacharts(snapshot, runId, userId, result);
            result.setStatus("SUCCESS");
            finishRun(runId, "SUCCESS", result);
            return result;
        } catch (RuntimeException e) {
            finishRun(runId, "FAILED", result);
            throw e;
        }
    }

    @Override
    public FieldMetaMigrationVerify verify(String orgId) {
        checkAdminPermission(orgId);
        Snapshot snapshot = buildSnapshot(orgId);
        FieldMetaMigrationVerify verify = new FieldMetaMigrationVerify();
        verify.setOrgId(orgId);
        verify.setViews(copy(snapshot.views));
        verify.setWidgets(copy(snapshot.widgets));
        verify.setDatacharts(copy(snapshot.datacharts));
        verify.setIssues(snapshot.issues);
        validateFormalData(snapshot, verify);
        verifyCharts(snapshot, verify);
        verify.setValid(verify.getIssues().stream().noneMatch(FieldMetaMigrationServiceImpl::isBlocking));
        return verify;
    }

    @Override
    @Transactional
    public FieldMetaMigrationResult rollback(String runId) {
        List<Map<String, Object>> backups = jdbcTemplate.queryForList(
                "SELECT * FROM field_meta_migration_backup WHERE run_id = ? ORDER BY id", runId);
        List<Map<String, Object>> viewFieldBackups = jdbcTemplate.queryForList(
                "SELECT * FROM " + VIEW_FIELD_BACKUP + " WHERE run_id = ? ORDER BY id", runId);
        if (backups.isEmpty() && viewFieldBackups.isEmpty()) {
            throw new IllegalArgumentException("MIGRATION_RUN_NOT_FOUND: " + runId);
        }
        verifyJsonBackups(backups);
        verifyViewFieldBackups(viewFieldBackups);
        FieldMetaMigrationResult result = new FieldMetaMigrationResult();
        result.setRunId(runId);
        result.setStatus("ROLLED_BACK");
        restoreJsonBackups(backups, result);
        restoreViewFieldBackups(viewFieldBackups, result);
        jdbcTemplate.update("UPDATE field_meta_migration_run SET status='ROLLED_BACK', completed_at=NOW() WHERE id=?", runId);
        return result;
    }

    private void verifyJsonBackups(List<Map<String, Object>> backups) {
        for (Map<String, Object> backup : backups) {
            String entityType = (String) value(backup, "entity_type");
            String table = table(entityType);
            String field = (String) value(backup, "json_field");
            String id = (String) value(backup, "entity_id");
            Map<String, Object> current = jdbcTemplate.queryForMap(
                    "SELECT " + field + " AS json_value FROM " + table + " WHERE id = ?", id);
            String currentJson = (String) current.get("json_value");
            if (!Objects.equals(sha256(currentJson == null ? "" : currentJson), value(backup, "migrated_json_hash"))) {
                throw new IllegalStateException("ROLLBACK_CONFLICT: " + entityType + " " + id);
            }
        }
    }

    private void restoreJsonBackups(List<Map<String, Object>> backups, FieldMetaMigrationResult result) {
        for (Map<String, Object> backup : backups) {
            String entityType = (String) value(backup, "entity_type");
            String table = table(entityType);
            String field = (String) value(backup, "json_field");
            String id = (String) value(backup, "entity_id");
            int affected = jdbcTemplate.update("UPDATE " + table + " SET " + field + " = ?, update_time = NOW() WHERE id = ?",
                    value(backup, "original_json"), id);
            if (affected != 1) {
                throw new IllegalStateException("ROLLBACK_CONFLICT: " + entityType + " " + id);
            }
            incrementRollbackScope(result, entityType);
        }
    }

    private Snapshot buildSnapshot(String orgId) {
        Snapshot snapshot = new Snapshot();
        snapshot.orgId = orgId;
        Map<String, ViewSnapshot> views = new HashMap<>();
        List<View> datasetViews = mapper.listDatasetViews(orgId);
        snapshot.views.setTotal(datasetViews.size());
        for (View view : datasetViews) {
            snapshot.tokens.add(token(VIEW, view.getId(), view.getUpdateTime(), view.getModel()));
            try {
                ObjectNode model = strictJson.readObject(VIEW, view.getId(), view.getModel());
                SourceSchemaIndex.Index index = schemaIndex.forSource(view.getSourceId());
                if (index.getError() != null) {
                    addIssue(snapshot, VIEW, view, null, "INVALID_SCHEMA_JSON", index.getError());
                }
                int pollutedPaths = "SQL".equalsIgnoreCase(view.getType())
                        ? sqlModelQueryPathSanitizer.count(view.getScript(), model, index) : 0;
                if (pollutedPaths > 0) {
                    snapshot.views.setPollutedSqlModels(snapshot.views.getPollutedSqlModels() + 1);
                    snapshot.views.setPollutedSqlColumns(snapshot.views.getPollutedSqlColumns() + pollutedPaths);
                    addIssue(snapshot, VIEW, view, null, "SQL_PHYSICAL_LINEAGE_IN_QUERY_PATH",
                            "detected " + pollutedPaths + " polluted model path(s)",
                            FieldMetaMigrationIssueSeverity.WARNING);
                }
                ViewModelMigrator.Result migration = new ViewModelMigrator().migrate(model, index, view.getType());
                List<ViewFieldDTO> viewFields = viewFieldService.listByViewId(view.getId());
                ViewSnapshot viewSnapshot = new ViewSnapshot(view, model, migration.model(), fields(migration.fields()),
                        viewFields);
                views.put(view.getId(), viewSnapshot);
                snapshot.views.setFields(snapshot.views.getFields() + migration.fields().size());
                countFields(snapshot.views, migration.fields());
                countSqlMetadata(snapshot, view, migration.fields(), viewFields, index);
                snapshot.views.setModified(snapshot.views.getModified() + (migration.changedNodes() > 0 ? 1 : 0));
                migration.issues().forEach(issue -> {
                    if ("SQL_COMMENT_RESOLVED_FROM_COLUMNS".equals(issue.reason())) {
                        snapshot.views.setResolvedFromColumns(snapshot.views.getResolvedFromColumns() + 1);
                    }
                    if ("SQL_OUTPUT_COLUMN_DUPLICATED".equals(issue.reason())) {
                        snapshot.views.setBlockingSqlConflicts(snapshot.views.getBlockingSqlConflicts() + 1);
                    }
                    addIssue(snapshot, VIEW, view, issue.fieldKey(), issue.reason(), issue.diagnostics(), issue.severity());
                });
            } catch (InvalidMigrationJsonException e) {
                snapshot.views.setInvalidJson(snapshot.views.getInvalidJson() + 1);
                addIssue(snapshot, VIEW, view, null, "INVALID_JSON", e.getMessage());
            }
        }
        snapshot.views.setTotal(datasetViews.size());
        snapshot.viewSnapshots = views;

        for (Widget widget : mapper.listWidgets(orgId)) {
            snapshot.tokens.add(token(WIDGET, widget.getId(), widget.getUpdateTime(), widget.getConfig()));
            scanWidget(snapshot, widget);
        }
        for (Datachart datachart : mapper.listDatacharts(orgId)) {
            snapshot.tokens.add(token(DATACHART, datachart.getId(), datachart.getUpdateTime(), datachart.getConfig()));
            snapshot.datacharts.setTotal(snapshot.datacharts.getTotal() + 1);
            scanDatachart(snapshot, datachart);
        }
        return snapshot;
    }

    private void scanWidget(Snapshot snapshot, Widget widget) {
        try {
            ObjectNode root = strictJson.readObject(WIDGET, widget.getId(), widget.getConfig());
            if (!isChartWidget(root)) {
                return;
            }
            snapshot.widgets.setTotal(snapshot.widgets.getTotal() + 1);
            String viewId = text(root.at("/content/dataChart/viewId"));
            List<String> relationIds = mapper.listWidgetViewIds(widget.getId());
            if (viewId == null || relationIds.size() != 1 || !viewId.equals(relationIds.get(0))) {
                snapshot.widgets.setReferenceMismatch(snapshot.widgets.getReferenceMismatch() + 1);
                addIssue(snapshot, WIDGET, widget.getId(), null, "REFERENCE_MISMATCH", "content.dataChart.viewId 与 rel_widget_element 不一致");
                return;
            }
            ViewSnapshot view = snapshot.viewSnapshots.get(viewId);
            if (view == null) {
                snapshot.widgets.setUnmatched(snapshot.widgets.getUnmatched() + 1);
                addIssue(snapshot, WIDGET, widget.getId(), null, "UNMATCHED_VIEW", viewId);
                return;
            }
            JsonNode chartConfig = root.at("/content/dataChart/config");
            if (!chartConfig.isObject()) {
                addIssue(snapshot, WIDGET, widget.getId(), null, "INVALID_JSON", "缺少 content.dataChart.config");
                return;
            }
            ChartConfigReconciler reconciler = new ChartConfigReconciler();
            ChartConfigReconciler.Result result = view.viewFields.isEmpty()
                    ? reconciler.reconcile((ObjectNode) chartConfig, view.fields)
                    : reconciler.reconcile((ObjectNode) chartConfig, view.viewFields);
            countChart(snapshot.widgets, result);
            result.issues().forEach(issue -> addIssue(snapshot, WIDGET, widget.getId(), issue.fieldKey(), "UNMATCHED", issue.reason()));
        } catch (InvalidMigrationJsonException e) {
            snapshot.widgets.setTotal(snapshot.widgets.getTotal() + 1);
            snapshot.widgets.setInvalidJson(snapshot.widgets.getInvalidJson() + 1);
            addIssue(snapshot, WIDGET, widget.getId(), null, "INVALID_JSON", e.getMessage());
        }
    }

    private void scanDatachart(Snapshot snapshot, Datachart datachart) {
        try {
            ObjectNode root = strictJson.readObject(DATACHART, datachart.getId(), datachart.getConfig());
            ViewSnapshot view = snapshot.viewSnapshots.get(datachart.getViewId());
            if (view == null) {
                snapshot.datacharts.setUnmatched(snapshot.datacharts.getUnmatched() + 1);
                addIssue(snapshot, DATACHART, datachart.getId(), null, "UNMATCHED_VIEW", datachart.getViewId());
                return;
            }
            ChartConfigReconciler reconciler = new ChartConfigReconciler();
            ChartConfigReconciler.Result result = view.viewFields.isEmpty()
                    ? reconciler.reconcile(root, view.fields)
                    : reconciler.reconcile(root, view.viewFields);
            countChart(snapshot.datacharts, result);
            result.issues().forEach(issue -> addIssue(snapshot, DATACHART, datachart.getId(), issue.fieldKey(), "UNMATCHED", issue.reason()));
        } catch (InvalidMigrationJsonException e) {
            snapshot.datacharts.setInvalidJson(snapshot.datacharts.getInvalidJson() + 1);
            addIssue(snapshot, DATACHART, datachart.getId(), null, "INVALID_JSON", e.getMessage());
        }
    }

    private void migrateViews(Snapshot snapshot, String runId, String userId, FieldMetaMigrationResult result) {
        for (ViewSnapshot view : snapshot.viewSnapshots.values()) {
            String original = view.view.getModel();
            Map<String, String> originalViewFields = snapshotViewFields(view.view.getId());
            view.view.setModel(strictJson.write(view.originalModel));
            sqlModelQueryPathSanitizer.sanitize(view.view.getScript(), view.originalModel,
                    schemaIndex.forSource(view.view.getSourceId()));
            view.view.setModel(strictJson.write(view.originalModel));
            viewFieldService.migrateLegacyMetadata(view.view);
            sqlModelQueryPathSanitizer.sanitize(view.view.getScript(), view.migratedModel,
                    schemaIndex.forSource(view.view.getSourceId()));
            view.view.setModel(strictJson.write(view.migratedModel));
            viewFieldService.reconcile(view.view);
            ObjectNode reconciledModel = strictJson.readObject(VIEW, view.view.getId(), view.view.getModel());
            view.migratedModel.removeAll();
            view.migratedModel.setAll(reconciledModel);
            view.viewFields = viewFieldService.listByViewId(view.view.getId());
            boolean viewFieldsChanged = backupViewFields(runId, view.view.getOrgId(), view.view.getId(), originalViewFields);
            String migrated = view.view.getModel();
            if (migrated.equals(original)) {
                if (viewFieldsChanged) {
                    result.getViews().setModified(result.getViews().getModified() + 1);
                }
                continue;
            }
            backup(runId, view.view.getOrgId(), VIEW, view.view.getId(), "model",
                    original, view.view.getUpdateTime(), migrated);
            if (mapper.updateViewModel(view.view.getId(), migrated, userId, view.view.getUpdateTime()) != 1) {
                throw new IllegalStateException("CONCURRENT_MODIFICATION: view " + view.view.getId());
            }
            result.getViews().setModified(result.getViews().getModified() + 1);
        }
    }

    private Map<String, String> snapshotViewFields(String viewId) {
        Map<String, String> snapshot = new HashMap<>();
        for (ViewField field : viewFieldMapper.listByViewId(viewId)) {
            snapshot.put(field.getId(), viewFieldJson(field));
        }
        return snapshot;
    }

    private boolean backupViewFields(String runId, String orgId, String viewId, Map<String, String> originalViewFields) {
        boolean changed = false;
        for (ViewField field : viewFieldMapper.listByViewId(viewId)) {
            String migrated = viewFieldJson(field);
            String original = originalViewFields.get(field.getId());
            if (Objects.equals(original, migrated)) {
                continue;
            }
            jdbcTemplate.update("INSERT INTO " + VIEW_FIELD_BACKUP
                            + " (id, run_id, org_id, view_id, field_id, original_json, migrated_json_hash, create_time)"
                            + " VALUES (?, ?, ?, ?, ?, ?, ?, NOW())",
                    id(), runId, orgId, viewId, field.getId(), original, sha256(migrated));
            changed = true;
        }
        return changed;
    }

    private void verifyViewFieldBackups(List<Map<String, Object>> backups) {
        for (Map<String, Object> backup : backups) {
            String viewId = (String) value(backup, "view_id");
            String fieldId = (String) value(backup, "field_id");
            ViewField current = viewFieldMapper.selectByViewIdAndId(viewId, fieldId);
            if (current == null || !Objects.equals(sha256(viewFieldJson(current)), value(backup, "migrated_json_hash"))) {
                throw new IllegalStateException("ROLLBACK_CONFLICT: VIEW_FIELD " + fieldId);
            }
        }
    }

    private void restoreViewFieldBackups(List<Map<String, Object>> backups, FieldMetaMigrationResult result) {
        for (Map<String, Object> backup : backups) {
            String viewId = (String) value(backup, "view_id");
            String fieldId = (String) value(backup, "field_id");
            String original = (String) value(backup, "original_json");
            int affected;
            if (original == null) {
                affected = jdbcTemplate.update("DELETE FROM view_field WHERE id = ? AND view_id = ?", fieldId, viewId);
            } else {
                affected = viewFieldMapper.update(readViewField(original));
            }
            if (affected != 1) {
                throw new IllegalStateException("ROLLBACK_CONFLICT: VIEW_FIELD " + fieldId);
            }
            result.getViews().setModified(result.getViews().getModified() + 1);
        }
    }

    private void migrateWidgets(Snapshot snapshot, String runId, String userId, FieldMetaMigrationResult result) {
        for (Widget widget : mapper.listWidgets(snapshot.orgId)) {
            ObjectNode root = strictJson.readObject(WIDGET, widget.getId(), widget.getConfig());
            if (!isChartWidget(root)) {
                continue;
            }
            migrateChartEntity(snapshot, runId, userId, result.getWidgets(), widget.getId(), WIDGET,
                    widget.getConfig(), widget.getUpdateTime(), null, mapper.listWidgetViewIds(widget.getId()));
        }
    }

    private void migrateDatacharts(Snapshot snapshot, String runId, String userId, FieldMetaMigrationResult result) {
        for (Datachart datachart : mapper.listDatacharts(snapshot.orgId)) {
            migrateChartEntity(snapshot, runId, userId, result.getDatacharts(), datachart.getId(), DATACHART,
                    datachart.getConfig(), datachart.getUpdateTime(), datachart.getViewId(), null);
        }
    }

    private void migrateChartEntity(Snapshot snapshot, String runId, String userId, FieldMetaMigrationScope scope,
                                    String entityId, String entityType, String originalJson, Date updateTime,
                                    String datachartViewId, List<String> relationIds) {
        ObjectNode root = strictJson.readObject(entityType, entityId, originalJson);
        String viewId = datachartViewId != null ? datachartViewId : text(root.at("/content/dataChart/viewId"));
        if (relationIds != null && (viewId == null || relationIds.size() != 1 || !viewId.equals(relationIds.get(0)))) {
            throw new IllegalStateException("REFERENCE_MISMATCH: " + entityId);
        }
        ViewSnapshot view = snapshot.viewSnapshots.get(viewId);
        if (view == null) {
            throw new IllegalStateException("UNMATCHED_VIEW: " + viewId);
        }
        ObjectNode chartRoot;
        if (datachartViewId == null) {
            JsonNode widgetChartConfig = root.at("/content/dataChart/config");
            if (!widgetChartConfig.isObject()) {
                throw new IllegalStateException("INVALID_JSON: missing content.dataChart.config");
            }
            chartRoot = (ObjectNode) widgetChartConfig;
        } else {
            chartRoot = root;
        }
        ChartConfigReconciler reconciler = new ChartConfigReconciler();
        ChartConfigReconciler.Result reconciled = view.viewFields.isEmpty()
                ? reconciler.reconcile(chartRoot, view.fields)
                : reconciler.reconcile(chartRoot, view.viewFields);
        scope.setRowsUpdated(scope.getRowsUpdated() + reconciled.changedRows());
        if (reconciled.issues().size() > 0) {
            throw new IllegalStateException("UNMATCHED chart row: " + entityId);
        }
        String migrated = strictJson.write(root);
        if (migrated.equals(originalJson)) {
            return;
        }
        backup(runId, snapshot.orgId, entityType, entityId, "config", originalJson, updateTime, migrated);
        int affected = entityType.equals(WIDGET)
                ? mapper.updateWidgetConfig(entityId, migrated, userId, updateTime)
                : mapper.updateDatachartConfig(entityId, migrated, userId, updateTime);
        if (affected != 1) {
            throw new IllegalStateException("CONCURRENT_MODIFICATION: " + entityType + " " + entityId);
        }
        scope.setModified(scope.getModified() + 1);
    }

    private void insertRun(String runId, String orgId, String userId, Snapshot snapshot) {
        jdbcTemplate.update("INSERT INTO field_meta_migration_run (id, org_id, status, scan_count, ambiguous_count, failed_count, started_by, started_at) VALUES (?, ?, 'RUNNING', ?, ?, ?, ?, NOW())",
                runId, orgId, snapshot.views.getTotal() + snapshot.widgets.getTotal() + snapshot.datacharts.getTotal(),
                blockingIssueCount(snapshot), 0, userId);
    }

    private void finishRun(String runId, String status, FieldMetaMigrationResult result) {
        jdbcTemplate.update("UPDATE field_meta_migration_run SET status=?, migrated_count=?, completed_at=NOW() WHERE id=?",
                status, result.getViews().getModified() + result.getWidgets().getModified() + result.getDatacharts().getModified(), runId);
    }

    private void backup(String runId, String orgId, String entityType, String entityId, String jsonField,
                        String original, Date updateTime, String migrated) {
        String backupId = id();
        jdbcTemplate.update("INSERT INTO field_meta_migration_backup (id, run_id, org_id, entity_type, entity_id, json_field, original_json, original_update_time, migrated_json_hash, create_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())",
                backupId, runId, orgId, entityType, entityId, jsonField, original, updateTime, sha256(migrated));
    }

    private static String viewFieldJson(ViewField field) {
        try {
            return OBJECT_MAPPER.writeValueAsString(field);
        } catch (Exception e) {
            throw new IllegalStateException("VIEW_FIELD_BACKUP_SERIALIZE_FAILED", e);
        }
    }

    private static ViewField readViewField(String json) {
        try {
            return OBJECT_MAPPER.readValue(json, ViewField.class);
        } catch (Exception e) {
            throw new IllegalStateException("VIEW_FIELD_BACKUP_DESERIALIZE_FAILED", e);
        }
    }

    private void checkAdminPermission(String orgId) {
        securityManager.requireAllPermissions(PermissionHelper.rolePermission(orgId, Const.MANAGE));
    }

    private static void countFields(FieldMetaMigrationScope scope, List<ResolvedFieldMeta> fields) {
        for (ResolvedFieldMeta field : fields) {
            switch (field.status()) {
                case ALREADY_FORMAL_CUSTOM -> scope.setAlreadyFormal(scope.getAlreadyFormal() + 1);
                case FALLBACK_CONFIDENT -> scope.setFallbackConfident(scope.getFallbackConfident() + 1);
                case CUSTOM_CONFIDENT -> scope.setCustomConfident(scope.getCustomConfident() + 1);
                case COMMENT_RECOVERED_FROM_SCHEMA -> scope.setCommentRecovered(scope.getCommentRecovered() + 1);
                case AMBIGUOUS -> scope.setAmbiguous(scope.getAmbiguous() + 1);
            }
        }
    }

    private static void countSqlMetadata(Snapshot snapshot, View view, List<ResolvedFieldMeta> fields,
                                         List<ViewFieldDTO> viewFields, SourceSchemaIndex.Index index) {
        if (!"SQL".equalsIgnoreCase(view.getType())) {
            return;
        }
        FieldMetaMigrationScope scope = snapshot.views;
        scope.setSqlViews(scope.getSqlViews() + 1);
        scope.setSqlFields(scope.getSqlFields() + fields.size());
        for (ResolvedFieldMeta field : fields) {
            ViewFieldDTO existing = findUniqueByOriginName(viewFields, field.rawName());
            boolean existingCustom = existing != null && hasText(existing.getCustomName());
            boolean existingComment = existing != null && hasText(existing.getSourceComment());
            if (existingCustom) {
                scope.setExistingCustomNames(scope.getExistingCustomNames() + 1);
            } else if (field.displayNameCustom()) {
                scope.setRecoverableCustomNames(scope.getRecoverableCustomNames() + 1);
                addIssue(snapshot, VIEW, view, field.fieldKey(), "SQL_CUSTOM_NAME_RECOVERABLE",
                        field.diagnostics(), FieldMetaMigrationIssueSeverity.WARNING);
            }

            FieldMetaDiagnostics diagnostics = field.diagnostics();
            String modelComment = diagnostics == null ? null
                    : hasText(diagnostics.columnComment()) ? diagnostics.columnComment() : diagnostics.hierarchyComment();
            SourceSchemaIndex.ColumnMeta schema = index == null ? null : index.exact(field.path());
            String schemaComment = schema == null ? null : schema.comment();
            if (hasText(modelComment)) {
                scope.setRecoverableLegacyComments(scope.getRecoverableLegacyComments() + 1);
                String reason = hasText(diagnostics.columnComment())
                        ? "SQL_COMMENT_RECOVERABLE_FROM_COLUMNS" : "SQL_COMMENT_RECOVERABLE_FROM_HIERARCHY";
                addIssue(snapshot, VIEW, view, field.fieldKey(), reason, diagnostics,
                        FieldMetaMigrationIssueSeverity.WARNING);
            } else if (hasText(schemaComment)) {
                scope.setRecoverableExactSchemaComments(scope.getRecoverableExactSchemaComments() + 1);
                addIssue(snapshot, VIEW, view, field.fieldKey(), "SQL_COMMENT_RECOVERABLE_FROM_EXACT_SCHEMA",
                        diagnostics, FieldMetaMigrationIssueSeverity.WARNING);
            } else if (existingComment) {
                scope.setPreservedExistingComments(scope.getPreservedExistingComments() + 1);
                addIssue(snapshot, VIEW, view, field.fieldKey(), "SQL_COMMENT_PRESERVED_EXISTING",
                        diagnostics, FieldMetaMigrationIssueSeverity.WARNING);
            } else if (!existingCustom && !field.displayNameCustom()) {
                scope.setUnresolvedSqlFields(scope.getUnresolvedSqlFields() + 1);
                addIssue(snapshot, VIEW, view, field.fieldKey(), "SQL_FIELD_NO_TRUSTED_DISPLAY_METADATA",
                        diagnostics, FieldMetaMigrationIssueSeverity.WARNING);
            }
        }
    }

    private static ViewFieldDTO findUniqueByOriginName(List<ViewFieldDTO> fields, String originName) {
        ViewFieldDTO match = null;
        for (ViewFieldDTO field : fields) {
            if (!Objects.equals(originName, field.getOriginName())) {
                continue;
            }
            if (match != null) {
                return null;
            }
            match = field;
        }
        return match;
    }

    private static boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static void countChart(FieldMetaMigrationScope scope, ChartConfigReconciler.Result result) {
        scope.setRows(scope.getRows() + result.rows());
        scope.setRowsMatched(scope.getRowsMatched() + result.rows() - result.issues().size());
        scope.setRowsUpdated(scope.getRowsUpdated() + result.changedRows());
        scope.setUnmatched(scope.getUnmatched() + result.issues().size());
    }

    private static Map<String, ResolvedFieldMeta> fields(List<ResolvedFieldMeta> fields) {
        return fields.stream().collect(Collectors.toMap(ResolvedFieldMeta::fieldKey, field -> field, (left, right) -> left, HashMap::new));
    }

    private static FieldMetaMigrationScope copy(FieldMetaMigrationScope source) {
        FieldMetaMigrationScope target = new FieldMetaMigrationScope();
        target.setTotal(source.getTotal());
        target.setFields(source.getFields());
        target.setAlreadyFormal(source.getAlreadyFormal());
        target.setFallbackConfident(source.getFallbackConfident());
        target.setCustomConfident(source.getCustomConfident());
        target.setCommentRecovered(source.getCommentRecovered());
        target.setResolvedFromColumns(source.getResolvedFromColumns());
        target.setAmbiguous(source.getAmbiguous());
        target.setInvalidJson(source.getInvalidJson());
        target.setModified(source.getModified());
        target.setRows(source.getRows());
        target.setRowsMatched(source.getRowsMatched());
        target.setRowsUpdated(source.getRowsUpdated());
        target.setUnmatched(source.getUnmatched());
        target.setReferenceMismatch(source.getReferenceMismatch());
        target.setSqlViews(source.getSqlViews());
        target.setSqlFields(source.getSqlFields());
        target.setRecoverableCustomNames(source.getRecoverableCustomNames());
        target.setRecoverableLegacyComments(source.getRecoverableLegacyComments());
        target.setRecoverableExactSchemaComments(source.getRecoverableExactSchemaComments());
        target.setExistingCustomNames(source.getExistingCustomNames());
        target.setPreservedExistingComments(source.getPreservedExistingComments());
        target.setUnresolvedSqlFields(source.getUnresolvedSqlFields());
        target.setBlockingSqlConflicts(source.getBlockingSqlConflicts());
        target.setPollutedSqlModels(source.getPollutedSqlModels());
        target.setPollutedSqlColumns(source.getPollutedSqlColumns());
        return target;
    }

    private static void resetMigrationCounters(FieldMetaMigrationScope scope) {
        scope.setModified(0);
        scope.setRowsUpdated(0);
    }

    private void validateFormalData(Snapshot snapshot, FieldMetaMigrationVerify verify) {
        for (ViewSnapshot view : snapshot.viewSnapshots.values()) {
            for (ViewModelMigrator.MigrationIssue issue : new ViewModelMigrator().validateFormal(view.originalModel)) {
                verify.getIssues().add(new FieldMetaMigrationIssue(VIEW, view.view.getId(), view.view.getName(),
                        issue.fieldKey(), "INVALID_FORMAT", issue.reason()));
            }
        }
    }

    private void verifyCharts(Snapshot snapshot, FieldMetaMigrationVerify verify) {
        for (Widget widget : mapper.listWidgets(snapshot.orgId)) {
            try {
                ObjectNode root = strictJson.readObject(WIDGET, widget.getId(), widget.getConfig());
                if (!isChartWidget(root)) {
                    continue;
                }
                String viewId = text(root.at("/content/dataChart/viewId"));
                ViewSnapshot view = snapshot.viewSnapshots.get(viewId);
                if (view == null) {
                    continue;
                }
                JsonNode chartConfig = root.at("/content/dataChart/config");
                if (chartConfig.isObject()) {
                    ChartConfigReconciler reconciler = new ChartConfigReconciler();
                    ChartConfigReconciler.Result result = view.viewFields.isEmpty()
                            ? reconciler.reconcile((ObjectNode) chartConfig, view.fields)
                            : reconciler.reconcile((ObjectNode) chartConfig, view.viewFields);
                    if (result.changedRows() > 0) {
                        verify.getIssues().add(new FieldMetaMigrationIssue(WIDGET, widget.getId(), widget.getId(), null,
                                "LEGACY_CHART_METADATA", "图表字段 metadata 未与 View 完全一致"));
                    }
                }
            } catch (InvalidMigrationJsonException ignored) {
                // buildSnapshot already reports invalid JSON
            }
        }
        for (Datachart datachart : mapper.listDatacharts(snapshot.orgId)) {
            try {
                ObjectNode root = strictJson.readObject(DATACHART, datachart.getId(), datachart.getConfig());
                ViewSnapshot view = snapshot.viewSnapshots.get(datachart.getViewId());
                if (view == null) {
                    continue;
                }
                ChartConfigReconciler reconciler = new ChartConfigReconciler();
                ChartConfigReconciler.Result result = view.viewFields.isEmpty()
                        ? reconciler.reconcile(root, view.fields)
                        : reconciler.reconcile(root, view.viewFields);
                if (result.changedRows() > 0) {
                    verify.getIssues().add(new FieldMetaMigrationIssue(DATACHART, datachart.getId(), datachart.getName(), null,
                            "LEGACY_CHART_METADATA", "图表字段 metadata 未与 View 完全一致"));
                }
            } catch (InvalidMigrationJsonException ignored) {
                // buildSnapshot already reports invalid JSON
            }
        }
    }

    private static String token(String type, String id, Date updateTime, String json) {
        return type + ":" + id + ":" + (updateTime == null ? "" : updateTime.getTime()) + ":" + sha256(json == null ? "" : json);
    }

    private static String scanToken(List<String> tokens) {
        String value = tokens.stream().sorted(Comparator.naturalOrder()).collect(Collectors.joining("\n"));
        return sha256(value);
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : digest) {
                result.append(String.format("%02x", b));
            }
            return result.toString();
        } catch (Exception e) {
            throw new IllegalStateException("SHA-256 unavailable", e);
        }
    }

    private static String text(JsonNode node) {
        return node == null || node.isMissingNode() || node.isNull() ? null : node.asText();
    }

    private static boolean isChartWidget(ObjectNode root) {
        return "chart".equalsIgnoreCase(text(root.get("type")));
    }

    private static String id() {
        return UUID.randomUUID().toString().replace("-", "");
    }

    private static String table(String entityType) {
        return switch (entityType) {
            case VIEW -> "`view`";
            case WIDGET -> "widget";
            case DATACHART -> "datachart";
            default -> throw new IllegalArgumentException("Unsupported migration entity: " + entityType);
        };
    }

    private static Object value(Map<String, Object> row, String key) {
        Object value = row.get(key);
        if (value != null || row.containsKey(key)) {
            return value;
        }
        return row.get(key.toUpperCase());
    }

    private static void incrementRollbackScope(FieldMetaMigrationResult result, String entityType) {
        FieldMetaMigrationScope scope = switch (entityType) {
            case VIEW -> result.getViews();
            case WIDGET -> result.getWidgets();
            case DATACHART -> result.getDatacharts();
            default -> throw new IllegalArgumentException("Unsupported migration entity: " + entityType);
        };
        scope.setModified(scope.getModified() + 1);
    }

    private static void addIssue(Snapshot snapshot, String entityType, View view, String fieldKey, String reason, String detail) {
        addIssue(snapshot, entityType, view.getId(), view.getName(), fieldKey, reason, detail);
    }

    private static void addIssue(Snapshot snapshot, String entityType, View view, String fieldKey,
                                 String reason, String detail, FieldMetaMigrationIssueSeverity severity) {
        snapshot.issues.add(new FieldMetaMigrationIssue(entityType, view.getId(), view.getName(), fieldKey,
                reason, detail, severity));
    }

    private static void addIssue(Snapshot snapshot, String entityType, String entityId, String fieldKey, String reason, String detail) {
        addIssue(snapshot, entityType, entityId, entityId, fieldKey, reason, detail);
    }

    private static void addIssue(Snapshot snapshot, String entityType, String entityId, String resourceName,
                                 String fieldKey, String reason, String detail) {
        snapshot.issues.add(new FieldMetaMigrationIssue(entityType, entityId, resourceName, fieldKey, reason, detail));
    }

    private static void addIssue(Snapshot snapshot, String entityType, View view, String fieldKey,
                                 String reason, FieldMetaDiagnostics diagnostics) {
        addIssue(snapshot, entityType, view, fieldKey, reason, diagnostics, FieldMetaMigrationIssueSeverity.BLOCKING);
    }

    private static void addIssue(Snapshot snapshot, String entityType, View view, String fieldKey,
                                 String reason, FieldMetaDiagnostics diagnostics,
                                 FieldMetaMigrationIssueSeverity severity) {
        FieldMetaMigrationIssue issue = new FieldMetaMigrationIssue(entityType, view.getId(), view.getName(),
                fieldKey, reason, diagnostics == null ? null : diagnostics.toString(), severity);
        if (diagnostics != null) {
            issue.setViewType(diagnostics.viewType());
            issue.setPath(diagnostics.path());
            issue.setRawName(diagnostics.rawName());
            issue.setColumnDisplayName(diagnostics.columnDisplayName());
            issue.setColumnComment(diagnostics.columnComment());
            issue.setHierarchyDisplayName(diagnostics.hierarchyDisplayName());
            issue.setHierarchyComment(diagnostics.hierarchyComment());
            issue.setSchemaComment(diagnostics.schemaComment());
        }
        snapshot.issues.add(issue);
    }

    private static boolean isBlocking(FieldMetaMigrationIssue issue) {
        return issue.getSeverity() == null || issue.getSeverity() == FieldMetaMigrationIssueSeverity.BLOCKING;
    }

    private static int blockingIssueCount(Snapshot snapshot) {
        return (int) snapshot.issues.stream().filter(FieldMetaMigrationServiceImpl::isBlocking).count();
    }

    private static final class ViewSnapshot {
        private final View view;
        private final ObjectNode originalModel;
        private final ObjectNode migratedModel;
        private final Map<String, ResolvedFieldMeta> fields;
        private List<ViewFieldDTO> viewFields;

        private ViewSnapshot(View view, ObjectNode originalModel, ObjectNode migratedModel,
                             Map<String, ResolvedFieldMeta> fields, List<ViewFieldDTO> viewFields) {
            this.view = view;
            this.originalModel = originalModel;
            this.migratedModel = migratedModel;
            this.fields = fields;
            this.viewFields = viewFields;
        }
    }

    private static final class Snapshot {
        private String orgId;
        private final FieldMetaMigrationScope views = new FieldMetaMigrationScope();
        private final FieldMetaMigrationScope widgets = new FieldMetaMigrationScope();
        private final FieldMetaMigrationScope datacharts = new FieldMetaMigrationScope();
        private final List<FieldMetaMigrationIssue> issues = new ArrayList<>();
        private final List<String> tokens = new ArrayList<>();
        private Map<String, ViewSnapshot> viewSnapshots = new HashMap<>();
    }
}
