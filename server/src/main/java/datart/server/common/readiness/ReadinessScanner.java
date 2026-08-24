package datart.server.common.readiness;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.entity.Dashboard;
import datart.core.entity.Datachart;
import datart.core.entity.RelWidgetElement;
import datart.core.entity.Source;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.entity.Widget;
import datart.core.mappers.ext.DatachartMapperExt;
import datart.core.mappers.ext.DashboardMapperExt;
import datart.core.mappers.ext.RelWidgetElementMapperExt;
import datart.core.mappers.ext.SourceMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.core.mappers.ext.ViewMapperExt;
import datart.core.mappers.ext.WidgetMapperExt;
import datart.server.base.dto.ReadinessIssue;
import datart.server.base.dto.ReadinessReport;
import datart.server.base.dto.ReadinessScopeReport;
import datart.server.base.dto.ReadinessSeverity;
import datart.server.common.fieldmeta.FieldMetaResolver;
import datart.server.common.fieldmeta.InvalidMigrationJsonException;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.SqlModelQueryPathSanitizer;
import datart.server.common.fieldmeta.StrictJson;
import datart.server.common.fieldmeta.ViewFieldKey;
import datart.server.common.fieldmeta.ViewModelMigrator;
import org.springframework.util.CollectionUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class ReadinessScanner {

    private final ViewMapperExt viewMapper;
    private final ViewFieldMapperExt viewFieldMapper;
    private final SourceMapperExt sourceMapper;
    private final SourceSchemaIndex schemaIndex;
    private final StrictJson strictJson;
    private final ObjectMapper objectMapper;
    private final DatachartMapperExt datachartMapper;
    private final DashboardMapperExt dashboardMapper;
    private final WidgetMapperExt widgetMapper;
    private final RelWidgetElementMapperExt widgetElementMapper;
    private final ViewModelMigrator modelMigrator = new ViewModelMigrator();
    private final SqlModelQueryPathSanitizer pathSanitizer = new SqlModelQueryPathSanitizer();

    public ReadinessScanner(ViewMapperExt viewMapper,
                            ViewFieldMapperExt viewFieldMapper,
                            SourceMapperExt sourceMapper,
                            SourceSchemaIndex schemaIndex,
                            StrictJson strictJson,
                            ObjectMapper objectMapper) {
        this(viewMapper, viewFieldMapper, sourceMapper, schemaIndex, strictJson, objectMapper,
                null, null, null, null);
    }

    public ReadinessScanner(ViewMapperExt viewMapper,
                            ViewFieldMapperExt viewFieldMapper,
                            SourceMapperExt sourceMapper,
                            SourceSchemaIndex schemaIndex,
                            StrictJson strictJson,
                            ObjectMapper objectMapper,
                            DatachartMapperExt datachartMapper,
                            DashboardMapperExt dashboardMapper,
                            WidgetMapperExt widgetMapper,
                            RelWidgetElementMapperExt widgetElementMapper) {
        this.viewMapper = viewMapper;
        this.viewFieldMapper = viewFieldMapper;
        this.sourceMapper = sourceMapper;
        this.schemaIndex = schemaIndex;
        this.strictJson = strictJson;
        this.objectMapper = objectMapper;
        this.datachartMapper = datachartMapper;
        this.dashboardMapper = dashboardMapper;
        this.widgetMapper = widgetMapper;
        this.widgetElementMapper = widgetElementMapper;
    }

    public ReadinessReport scan(String orgId) {
        Map<String, ResourceState> resources = new LinkedHashMap<>();
        Map<String, View> views = new LinkedHashMap<>();
        Map<String, List<ViewField>> viewFields = new HashMap<>();
        List<View> viewList = viewMapper.listByOrgId(orgId);
        if (!CollectionUtils.isEmpty(viewList)) {
            for (View view : viewList) {
                if (view == null || Boolean.TRUE.equals(view.getIsFolder())) {
                    continue;
                }
                views.put(view.getId(), view);
                ResourceState state = resources.computeIfAbsent(resourceKey("VIEW", view.getId()),
                        ignored -> new ResourceState("VIEW", view.getId(), view.getName()));
                List<ViewField> fields = loadViewFields(view.getId());
                viewFields.put(view.getId(), fields);
                scanView(view, state, fields);
            }
        }

        Map<String, Datachart> datacharts = new LinkedHashMap<>();
        ChartCoverage coverage = new ChartCoverage();
        if (datachartMapper != null) {
            for (Datachart datachart : safe(datachartMapper.listByOrgId(orgId))) {
                if (datachart == null) {
                    continue;
                }
                datacharts.put(datachart.getId(), datachart);
                ResourceState state = resources.computeIfAbsent(
                        resourceKey("DATACHART", datachart.getId()),
                        ignored -> new ResourceState("DATACHART", datachart.getId(), datachart.getName()));
                scanDatachart(datachart, views, viewFields, state, coverage);
            }
        }

        if (dashboardMapper != null) {
            for (Dashboard dashboard : safe(dashboardMapper.listByOrgId(orgId))) {
                if (dashboard == null) {
                    continue;
                }
                ResourceState state = resources.computeIfAbsent(
                        resourceKey("DASHBOARD", dashboard.getId()),
                        ignored -> new ResourceState("DASHBOARD", dashboard.getId(), dashboard.getName()));
                scanDashboard(dashboard, views, datacharts, state);
            }
        }
        return report(resources, coverage);
    }

    private void scanView(View view, ResourceState state, List<ViewField> actualFields) {
        Source source = view.getSourceId() == null || sourceMapper == null
                ? null : sourceMapper.selectByPrimaryKey(view.getSourceId());
        if (source == null) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_SOURCE_NOT_FOUND,
                    "View source does not exist");
        }

        ObjectNode model;
        try {
            model = strictJson.readObject("VIEW", view.getId(), view.getModel());
        } catch (InvalidMigrationJsonException e) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_MODEL_INVALID,
                    "View model is not valid JSON");
            return;
        }

        SourceSchemaIndex.Index index = null;
        if (schemaIndex != null && view.getSourceId() != null) {
            try {
                index = schemaIndex.forSource(view.getSourceId());
                if (index.getError() != null) {
                    issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_SCHEMA_INVALID,
                            "Source schema metadata is invalid");
                }
            } catch (RuntimeException e) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_SCHEMA_INVALID,
                        "Source schema metadata cannot be read");
            }
        }

        if ("SQL".equalsIgnoreCase(view.getType()) && index != null
                && pathSanitizer.count(view.getScript(), model, index) > 0) {
            issue(state, ReadinessSeverity.WARNING, ReadinessIssueCode.VIEW_LEGACY_SQL_PATH,
                    "SQL model contains a physical lineage path");
        }

        ViewModelMigrator.Result migration;
        try {
            migration = modelMigrator.migrate(model, index, view.getType());
        } catch (RuntimeException e) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_MODEL_UNRECONCILABLE,
                    "View model cannot be canonicalized");
            return;
        }
        if (migration.changedNodes() > 0) {
            issue(state, ReadinessSeverity.WARNING, ReadinessIssueCode.VIEW_LEGACY_MODEL_METADATA,
                    "View model can be canonicalized");
        }
        migration.issues().forEach(migrationIssue -> issue(state,
                migrationIssue.severity() == datart.server.base.dto.FieldMetaMigrationIssueSeverity.BLOCKING
                        ? ReadinessSeverity.BLOCKER : ReadinessSeverity.WARNING,
                migrationIssue.severity() == datart.server.base.dto.FieldMetaMigrationIssueSeverity.BLOCKING
                        ? ReadinessIssueCode.VIEW_MODEL_UNRECONCILABLE
                        : ReadinessIssueCode.VIEW_LEGACY_MODEL_METADATA,
                migrationIssue.reason()));

        Map<String, ExpectedField> expected = expectedFields(model, view.getType());
        validateSchemaReferences(view, expected.values(), index, state);
        scanViewFields(view, expected, state, actualFields);
    }

    private void validateSchemaReferences(View view, Iterable<ExpectedField> expected,
                                          SourceSchemaIndex.Index index, ResourceState state) {
        if (index == null || index.getError() != null || "SQL".equalsIgnoreCase(view.getType())) {
            return;
        }
        for (ExpectedField field : expected) {
            if (!field.path.isEmpty() && index.exact(field.path) == null) {
                issue(state, ReadinessSeverity.BLOCKER,
                        ReadinessIssueCode.VIEW_SCHEMA_REFERENCE_NOT_FOUND,
                        "View field source path is not present in source schema: " + field.originName);
            }
        }
    }

    private List<ViewField> loadViewFields(String viewId) {
        if (viewFieldMapper == null) {
            return List.of();
        }
        List<ViewField> fields = viewFieldMapper.listByViewId(viewId);
        return fields == null ? List.of() : fields;
    }

    private void scanViewFields(View view, Map<String, ExpectedField> expected,
                                ResourceState state, List<ViewField> actual) {
        List<ViewField> active = actual.stream()
                .filter(field -> Boolean.TRUE.equals(field.getActive()))
                .toList();
        Map<String, List<ViewField>> byCanonicalKey = new LinkedHashMap<>();
        for (ViewField field : active) {
            byCanonicalKey.computeIfAbsent(field.getCanonicalKey(), ignored -> new ArrayList<>()).add(field);
        }

        Map<String, List<ViewField>> byId = new HashMap<>();
        for (ViewField field : active) {
            if (blank(field.getId())) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_ID_MISSING,
                        "ViewField has no fieldId");
            } else {
                byId.computeIfAbsent(field.getId(), ignored -> new ArrayList<>()).add(field);
            }
        }
        byId.values().stream().filter(fields -> fields.size() > 1).forEach(fields -> issue(state,
                ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_ID_DUPLICATE,
                "ViewField fieldId is duplicated: " + fields.get(0).getId()));

        for (ExpectedField expectedField : expected.values()) {
            List<ViewField> matches = byCanonicalKey.getOrDefault(expectedField.canonicalKey, List.of());
            if (matches.isEmpty()) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_MISSING,
                        "ViewField is missing: " + expectedField.originName);
                continue;
            }
            if (matches.size() > 1) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_METADATA_MISMATCH,
                        "ViewField canonical key is duplicated: " + expectedField.canonicalKey);
            }
            ViewField field = matches.get(0);
            if (expectedField.missingFieldId || expectedField.fieldIds.size() > 1) {
                issue(state, ReadinessSeverity.BLOCKER,
                        expectedField.fieldIds.size() > 1
                                ? ReadinessIssueCode.VIEW_FIELD_ID_MISMATCH
                                : ReadinessIssueCode.VIEW_FIELD_ID_MISSING,
                        "View model fieldId is missing or inconsistent: " + expectedField.originName);
            }
            if (!expectedField.fieldIds.isEmpty() && !expectedField.fieldIds.contains(field.getId())) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_ID_MISMATCH,
                        "ViewField fieldId does not match View model: " + expectedField.originName);
            }
            if (!equalsText(expectedField.originName, field.getOriginName())
                    || !equalsText(expectedField.category, field.getFieldCategory())
                    || !equalsText(expectedField.expression, field.getExpression())) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_METADATA_MISMATCH,
                        "ViewField metadata does not match View model: " + expectedField.originName);
            }
            if (!equalsText(expectedField.type, field.getFieldType())) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_TYPE_MISMATCH,
                        "ViewField type does not match View model: " + expectedField.originName);
            }
            if (!"SQL".equalsIgnoreCase(view.getType())
                    && !expectedField.path.equals(readPath(field.getSourcePath()))) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_METADATA_MISMATCH,
                        "ViewField source path does not match View model: " + expectedField.originName);
            }
        }

        byCanonicalKey.keySet().stream()
                .filter(key -> !expected.containsKey(key))
                .forEach(key -> issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.VIEW_FIELD_ORPHAN,
                        "ViewField is not present in View model: " + key));
    }

    private void scanDatachart(Datachart datachart, Map<String, View> views,
                               Map<String, List<ViewField>> viewFields,
                               ResourceState state, ChartCoverage coverage) {
        View view = blank(datachart.getViewId()) ? null : views.get(datachart.getViewId());
        if (view == null) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_VIEW_NOT_FOUND,
                    "Datachart view does not exist: " + datachart.getViewId());
        }

        ObjectNode root;
        try {
            root = strictJson.readObject("DATACHART", datachart.getId(), datachart.getConfig());
        } catch (InvalidMigrationJsonException e) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_CONFIG_INVALID,
                    "Datachart config is not valid JSON");
            return;
        }
        JsonNode chartConfig = root.get("chartConfig");
        if (chartConfig == null || !chartConfig.isObject()) {
            chartConfig = root;
        }
        JsonNode datas = chartConfig.get("datas");
        if (datas == null || !datas.isArray()) {
            return;
        }
        List<ViewField> fields = view == null ? List.of()
                : viewFields.getOrDefault(view.getId(), List.of());
        for (JsonNode data : datas) {
            if (!data.isObject()) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_CONFIG_INVALID,
                        "Datachart data section is invalid");
                continue;
            }
            JsonNode rows = data.get("rows");
            if (rows == null || !rows.isArray()) {
                continue;
            }
            for (JsonNode rowNode : rows) {
                if (!rowNode.isObject()) {
                    issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_CONFIG_INVALID,
                            "Datachart field row is invalid");
                    continue;
                }
                scanDatachartRow((ObjectNode) rowNode, fields, datachart.getViewId(), state, coverage);
            }
        }
    }

    private void scanDatachartRow(ObjectNode row, List<ViewField> fields, String viewId,
                                  ResourceState state, ChartCoverage coverage) {
        String category = trim(row.path("category").asText(null));
        if (!isFieldCategory(category)) {
            return;
        }
        coverage.fieldReferences++;
        String fieldId = trim(row.path("fieldId").asText(null));
        String lookup = "dateLevelComputedField".equals(category)
                ? trim(row.path("field").asText(null))
                : trim(row.path("colName").asText(null));
        if (fieldId == null) {
            if ("computedField".equals(category) && trim(row.path("expression").asText(null)) == null) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_COMPUTED_FIELD_INVALID,
                        "Computed chart field has no expression: " + lookup);
            }
            ViewField legacy = resolveLegacyField(fields, lookup, row.get("path"));
            if (legacy == null) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_FIELD_NOT_FOUND,
                        "Datachart field cannot be resolved: " + lookup);
            } else if (isActive(legacy)) {
                issue(state, ReadinessSeverity.WARNING, ReadinessIssueCode.DATACHART_LEGACY_FIELD_REFERENCE,
                        "Datachart field has no fieldId and was resolved by legacy metadata: " + lookup);
            } else {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_FIELD_INACTIVE,
                        "Datachart field is inactive: " + lookup);
            }
            return;
        }

        coverage.fieldIdReferences++;
        List<ViewField> matches = fields.stream().filter(field -> fieldId.equals(field.getId())).toList();
        if (matches.isEmpty()) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_FIELD_NOT_FOUND,
                    "Datachart fieldId does not exist: " + fieldId);
            return;
        }
        ViewField field = matches.get(0);
        if (viewId != null && !viewId.equals(field.getViewId())) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_FIELD_VIEW_MISMATCH,
                    "Datachart field belongs to another View: " + fieldId);
            return;
        }
        if (!isActive(field)) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DATACHART_FIELD_INACTIVE,
                    "Datachart field is inactive: " + fieldId);
            return;
        }
        coverage.resolvedFieldIdReferences++;
    }

    private void scanDashboard(Dashboard dashboard, Map<String, View> views,
                               Map<String, Datachart> datacharts, ResourceState state) {
        try {
            strictJson.readObject("DASHBOARD", dashboard.getId(), dashboard.getConfig());
        } catch (InvalidMigrationJsonException e) {
            issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DASHBOARD_CONFIG_INVALID,
                    "Dashboard config is not valid JSON");
            return;
        }
        if (widgetMapper == null || widgetElementMapper == null) {
            return;
        }
        List<Widget> widgets = widgetMapper.listByDashboard(dashboard.getId());
        List<String> widgetIds = safe(widgets).stream().filter(widget -> widget != null)
                .map(Widget::getId).filter(id -> !blank(id)).toList();
        if (widgetIds.isEmpty()) {
            return;
        }
        List<RelWidgetElement> elements = widgetElementMapper.listWidgetElementsByIds(widgetIds);
        for (RelWidgetElement element : safe(elements)) {
            if (element == null || blank(element.getRelType())) {
                continue;
            }
            if ("DATACHART".equalsIgnoreCase(element.getRelType())) {
                if (blank(element.getRelId()) || !datacharts.containsKey(element.getRelId())) {
                    issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DASHBOARD_DATACHART_NOT_FOUND,
                            "Dashboard references a missing Datachart: " + element.getRelId());
                }
            } else if ("VIEW".equalsIgnoreCase(element.getRelType())
                    && (blank(element.getRelId()) || !views.containsKey(element.getRelId()))) {
                issue(state, ReadinessSeverity.BLOCKER, ReadinessIssueCode.DASHBOARD_WIDGET_RESOURCE_NOT_FOUND,
                        "Dashboard references a missing View: " + element.getRelId());
            }
        }
    }

    private ViewField resolveLegacyField(List<ViewField> fields, String name, JsonNode pathNode) {
        if (pathNode != null && pathNode.isArray()) {
            String path = join(pathNode);
            List<ViewField> exact = fields.stream()
                    .filter(field -> path.equals(String.join(".", readSourcePath(field.getSourcePath()))))
                    .filter(ReadinessScanner::isActive).toList();
            if (exact.size() == 1) {
                return exact.get(0);
            }
        }
        if (name == null) {
            return null;
        }
        List<ViewField> matches = fields.stream()
                .filter(field -> name.equals(field.getOriginName())).toList();
        return matches.size() == 1 ? matches.get(0) : null;
    }

    private static boolean isFieldCategory(String category) {
        return "field".equals(category) || "dateLevelComputedField".equals(category)
                || "computedField".equals(category);
    }

    private static boolean isActive(ViewField field) {
        return !Boolean.FALSE.equals(field.getActive());
    }

    private List<String> readSourcePath(String json) {
        if (blank(json)) {
            return List.of();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node != null && node.isArray()) {
                List<String> result = new ArrayList<>();
                node.forEach(value -> result.add(value.asText()));
                return result;
            }
        } catch (Exception ignored) {
            // An invalid path cannot be a deterministic legacy match.
        }
        return List.of();
    }

    private static String join(JsonNode values) {
        List<String> path = new ArrayList<>();
        values.forEach(value -> path.add(value.asText()));
        return String.join(".", path);
    }

    private Map<String, ExpectedField> expectedFields(ObjectNode model, String viewType) {
        Map<String, ExpectedField> fields = new LinkedHashMap<>();
        collectMap(model.get("columns"), fields, viewType);
        collectMap(model.get("hierarchy"), fields, viewType);
        JsonNode computed = model.get("computedFields");
        if (computed != null && computed.isArray()) {
            int ordinal = 0;
            for (JsonNode node : computed) {
                if (node.isObject()) {
                    addExpected("computed_" + ordinal++, (ObjectNode) node, fields, viewType);
                }
            }
        }
        return fields;
    }

    private void collectMap(JsonNode root, Map<String, ExpectedField> fields, String viewType) {
        if (root == null || !root.isObject()) {
            return;
        }
        root.fields().forEachRemaining(entry -> collectNode(entry.getKey(), entry.getValue(), fields, viewType));
    }

    private void collectNode(String fallback, JsonNode node, Map<String, ExpectedField> fields, String viewType) {
        if (node == null || !node.isObject()) {
            return;
        }
        JsonNode children = node.get("children");
        if (children != null && children.isArray() && !children.isEmpty()) {
            children.forEach(child -> collectNode(fallback, child, fields, viewType));
            return;
        }
        addExpected(fallback, (ObjectNode) node, fields, viewType);
    }

    private void addExpected(String fallback, ObjectNode node,
                             Map<String, ExpectedField> fields, String viewType) {
        List<String> path = FieldMetaResolver.path(node);
        String outputName = outputName(fallback, node);
        String originName = "SQL".equalsIgnoreCase(viewType)
                ? outputName : path.isEmpty() ? outputName : path.get(path.size() - 1);
        String category = node.path("category").asText("");
        String expression = trim(node.path("expression").asText(null));
        if ("COMPUTED".equalsIgnoreCase(category) || expression != null && path.isEmpty()) {
            category = "COMPUTED";
        }
        String type = node.path("type").asText("STRING");
        String finalCategory = category;
        String canonicalKey = ViewFieldKey.of(viewType, path, originName, finalCategory, expression);
        ExpectedField field = fields.computeIfAbsent(canonicalKey,
                ignored -> new ExpectedField(canonicalKey, originName, path, type, finalCategory, expression));
        String fieldId = trim(node.path("fieldId").asText(null));
        if (fieldId == null) {
            field.missingFieldId = true;
        } else {
            field.fieldIds.add(fieldId);
        }
    }

    private ReadinessReport report(Map<String, ResourceState> resources, ChartCoverage coverage) {
        ReadinessReport report = new ReadinessReport();
        List<ReadinessIssue> issues = resources.values().stream()
                .flatMap(resource -> resource.issues.stream())
                .sorted(Comparator.comparing(ReadinessIssue::getResourceId, Comparator.nullsFirst(String::compareTo))
                        .thenComparing(ReadinessIssue::getCode))
                .toList();
        report.setIssues(issues);
        report.setTotal(resources.size());
        Map<String, ReadinessScopeReport> scopes = new LinkedHashMap<>();
        for (ResourceState resource : resources.values()) {
            ReadinessScopeReport scope = scopes.computeIfAbsent(scopeKey(resource.resourceType),
                    ignored -> new ReadinessScopeReport());
            scope.setTotal(scope.getTotal() + 1);
            if (resource.has(ReadinessSeverity.BLOCKER)) {
                report.setBlockers(report.getBlockers() + 1);
                scope.setBlockers(scope.getBlockers() + 1);
            } else if (resource.has(ReadinessSeverity.WARNING)) {
                report.setWarnings(report.getWarnings() + 1);
                scope.setWarnings(scope.getWarnings() + 1);
            } else {
                report.setReady(report.getReady() + 1);
                scope.setReady(scope.getReady() + 1);
            }
        }
        report.setReadiness(report.getTotal() == 0
                ? 100D : report.getReady() * 100D / report.getTotal());
        report.setStrictEligible(report.getBlockers() == 0);
        report.setScopes(scopes);
        report.setChartFieldReferences(coverage.fieldReferences);
        report.setChartFieldIdReferences(coverage.fieldIdReferences);
        report.setResolvedChartFieldIdReferences(coverage.resolvedFieldIdReferences);
        report.setChartFieldIdCoverage(coverage.fieldReferences == 0
                ? 100D : coverage.fieldIdReferences * 100D / coverage.fieldReferences);
        report.setResolvedChartFieldIdCoverage(coverage.fieldReferences == 0
                ? 100D : coverage.resolvedFieldIdReferences * 100D / coverage.fieldReferences);
        return report;
    }

    private static String resourceKey(String type, String id) {
        return type + "\u0000" + id;
    }

    private static String scopeKey(String resourceType) {
        return switch (resourceType) {
            case "VIEW" -> "views";
            case "DATACHART" -> "datacharts";
            case "DASHBOARD" -> "dashboards";
            default -> resourceType.toLowerCase();
        };
    }

    private static <T> List<T> safe(List<T> values) {
        return values == null ? List.of() : values;
    }

    private static void issue(ResourceState state, ReadinessSeverity severity, String code, String message) {
        if (state.issues.stream().anyMatch(issue -> issue.getSeverity() == severity
                && code.equals(issue.getCode()) && message.equals(issue.getMessage()))) {
            return;
        }
        state.issues.add(new ReadinessIssue(state.resourceType, state.resourceId, state.resourceName,
                severity, code, message));
    }

    private List<String> readPath(String json) {
        if (blank(json)) {
            return List.of();
        }
        try {
            JsonNode node = objectMapper.readTree(json);
            if (node != null && node.isArray()) {
                List<String> result = new ArrayList<>();
                node.forEach(value -> result.add(value.asText()));
                return result;
            }
        } catch (Exception ignored) {
            // The metadata mismatch below is the stable scanner result.
        }
        return List.of();
    }

    private static String outputName(String fallback, JsonNode node) {
        JsonNode name = node.get("name");
        if (name != null && name.isArray() && !name.isEmpty()) {
            return name.get(name.size() - 1).asText(fallback);
        }
        return name == null ? fallback : name.asText(fallback);
    }

    private static String trim(String value) {
        return blank(value) ? null : value.trim();
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static boolean equalsText(String expected, String actual) {
        return java.util.Objects.equals(trim(expected), trim(actual));
    }

    private static final class ResourceState {
        private final String resourceType;
        private final String resourceId;
        private final String resourceName;
        private final List<ReadinessIssue> issues = new ArrayList<>();

        private ResourceState(String resourceType, String resourceId, String resourceName) {
            this.resourceType = resourceType;
            this.resourceId = resourceId;
            this.resourceName = resourceName;
        }

        private boolean has(ReadinessSeverity severity) {
            return issues.stream().anyMatch(issue -> issue.getSeverity() == severity);
        }
    }

    private static final class ChartCoverage {
        private int fieldReferences;
        private int fieldIdReferences;
        private int resolvedFieldIdReferences;
    }

    private static final class ExpectedField {
        private final String canonicalKey;
        private final String originName;
        private final List<String> path;
        private final String type;
        private final String category;
        private final String expression;
        private final Set<String> fieldIds = new LinkedHashSet<>();
        private boolean missingFieldId;

        private ExpectedField(String canonicalKey, String originName, List<String> path,
                              String type, String category, String expression) {
            this.canonicalKey = canonicalKey;
            this.originName = originName;
            this.path = path;
            this.type = type;
            this.category = category;
            this.expression = expression;
        }
    }
}
