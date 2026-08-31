package datart.server.common.readiness;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.entity.Source;
import datart.core.entity.Datachart;
import datart.core.entity.Dashboard;
import datart.core.entity.RelWidgetElement;
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
import datart.server.common.fieldmeta.StrictJson;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ReadinessScannerTest {

    private final ViewMapperExt viewMapper = mock(ViewMapperExt.class);
    private final ViewFieldMapperExt viewFieldMapper = mock(ViewFieldMapperExt.class);
    private final SourceMapperExt sourceMapper = mock(SourceMapperExt.class);
    private final ReadinessScanner scanner = new ReadinessScanner(
            viewMapper,
            viewFieldMapper,
            sourceMapper,
            null,
            new StrictJson(new ObjectMapper()),
            new ObjectMapper());

    @BeforeEach
    void setUp() {
        when(sourceMapper.selectByPrimaryKey("source-1")).thenReturn(mock(Source.class));
    }

    @Test
    void canonicalViewIsReady() {
        View view = view("view-1", "Canonical", canonicalModel(), "source-1");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getTotal());
        assertEquals(1, report.getReady());
        assertEquals(0, report.getWarnings());
        assertEquals(0, report.getBlockers());
        assertEquals(100D, report.getReadiness());
        assertTrue(report.isStrictEligible());
        assertTrue(report.getIssues().isEmpty());
    }

    @Test
    void recognizableLegacyModelIsWarningOnly() {
        View view = view("view-1", "Legacy", legacyModel(), "source-1");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getWarnings());
        assertEquals(0, report.getBlockers());
        assertTrue(report.isStrictEligible());
        assertTrue(hasIssue(report, ReadinessIssueCode.VIEW_LEGACY_MODEL_METADATA));
    }

    @Test
    void missingViewFieldIsBlocker() {
        View view = view("view-1", "Missing field", canonicalModel(), "source-1");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of());

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getBlockers());
        assertFalse(report.isStrictEligible());
        assertTrue(hasIssue(report, ReadinessIssueCode.VIEW_FIELD_MISSING));
    }

    @Test
    void orphanViewFieldIsBlocker() {
        View view = view("view-1", "Orphan field", canonicalModel(), "source-1");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        ViewField orphan = field("view-1");
        orphan.setCanonicalKey("FIELD|db.city.other");
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(orphan));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getBlockers());
        assertTrue(hasIssue(report, ReadinessIssueCode.VIEW_FIELD_ORPHAN));
    }

    @Test
    void missingSourceIsBlocker() {
        View view = view("view-1", "Missing source", canonicalModel(), "missing-source");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getBlockers());
        assertTrue(hasIssue(report, ReadinessIssueCode.VIEW_SOURCE_NOT_FOUND));
    }

    @Test
    void emptySystemIsReadyAndStrictEligible() {
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of());

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(0, report.getTotal());
        assertEquals(100D, report.getReadiness());
        assertTrue(report.isStrictEligible());
    }

    @Test
    void aggregateReportKeepsReadyAndBlockedResourcesSeparate() {
        View ready = view("view-1", "Ready", canonicalModel(), "source-1");
        View blocked = view("view-2", "Blocked", canonicalModel(), "source-1");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(ready, blocked));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));
        when(viewFieldMapper.listByViewId("view-2")).thenReturn(List.of());

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(2, report.getTotal());
        assertEquals(1, report.getReady());
        assertEquals(1, report.getBlockers());
        assertEquals(50D, report.getReadiness());
        assertFalse(report.isStrictEligible());
    }

    @Test
    void datachartFieldIdResolvesAndCoverageIsReported() {
        DatachartMapperExt datachartMapper = mock(DatachartMapperExt.class);
        ReadinessScanner scanner = scanner(datachartMapper, null, null, null);
        View view = view("view-1", "View", canonicalModel(), "source-1");
        Datachart datachart = datachart("chart-1", "Chart", "view-1", chartConfig("field-city"));
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));
        when(datachartMapper.listByOrgId("org-1")).thenReturn(List.of(datachart));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(2, report.getTotal());
        assertEquals(2, report.getReady());
        assertEquals(100D, report.getChartFieldIdCoverage());
        assertEquals(100D, report.getResolvedChartFieldIdCoverage());
        assertEquals(1, report.getScopes().get("datacharts").getReady());
    }

    @Test
    void legacyDatachartReferenceIsWarningWhenItResolvesUniquely() {
        DatachartMapperExt datachartMapper = mock(DatachartMapperExt.class);
        ReadinessScanner scanner = scanner(datachartMapper, null, null, null);
        View view = view("view-1", "View", canonicalModel(), "source-1");
        Datachart datachart = datachart("chart-1", "Legacy chart", "view-1",
                "{\"chartConfig\":{\"datas\":[{\"rows\":[{" +
                        "\"category\":\"field\",\"colName\":\"city_name\"}]}]}}");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));
        when(datachartMapper.listByOrgId("org-1")).thenReturn(List.of(datachart));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(0, report.getWarnings());
        assertEquals(1, report.getBlockers());
        assertEquals(0D, report.getChartFieldIdCoverage());
        assertTrue(hasIssue(report, ReadinessIssueCode.DATACHART_FIELD_ID_MISSING));
    }

    @Test
    void embeddedWidgetCountsViewFieldsButValidComputedFieldIsNotAViewFieldReference() {
        DashboardMapperExt dashboardMapper = mock(DashboardMapperExt.class);
        WidgetMapperExt widgetMapper = mock(WidgetMapperExt.class);
        RelWidgetElementMapperExt elementMapper = mock(RelWidgetElementMapperExt.class);
        ReadinessScanner scanner = scanner(null, dashboardMapper, widgetMapper, elementMapper);
        View view = view("view-1", "View", canonicalModel(), "source-1");
        Dashboard dashboard = dashboard("dashboard-1", "Dashboard");
        Widget widget = new Widget();
        widget.setId("widget-1");
        widget.setConfig("""
                {"content":{"dataChart":{"viewId":"view-1","config":{
                  "chartConfig":{"datas":[{"rows":[
                    {"category":"field","colName":"city_name","fieldId":"field-city"},
                    {"category":"computedField","colName":"直营总订单数"}
                  ]}]},
                  "computedFields":[{"name":"直营总订单数","category":"computedField","expression":"[channel_orders]+[direct_orders]"}]
                }}}}
                """);
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));
        when(dashboardMapper.listByOrgId("org-1")).thenReturn(List.of(dashboard));
        when(widgetMapper.listByDashboard("dashboard-1")).thenReturn(List.of(widget));
        when(elementMapper.listWidgetElementsByIds(List.of("widget-1"))).thenReturn(List.of());

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(2, report.getTotal());
        assertEquals(2, report.getReady());
        assertEquals(0, report.getBlockers());
        assertEquals(1, report.getChartFieldReferences());
        assertEquals(1, report.getChartFieldIdReferences());
        assertEquals(1, report.getResolvedChartFieldIdReferences());
        assertEquals(100D, report.getChartFieldIdCoverage());
        assertEquals(100D, report.getResolvedChartFieldIdCoverage());
        assertTrue(report.isStrictEligible());
    }

    @Test
    void embeddedWidgetComputedFieldWithoutDefinitionBlocksReadiness() {
        DashboardMapperExt dashboardMapper = mock(DashboardMapperExt.class);
        WidgetMapperExt widgetMapper = mock(WidgetMapperExt.class);
        RelWidgetElementMapperExt elementMapper = mock(RelWidgetElementMapperExt.class);
        ReadinessScanner scanner = scanner(null, dashboardMapper, widgetMapper, elementMapper);
        View view = view("view-1", "View", canonicalModel(), "source-1");
        Dashboard dashboard = dashboard("dashboard-1", "Dashboard");
        Widget widget = new Widget();
        widget.setId("widget-1");
        widget.setConfig("""
                {"content":{"dataChart":{"viewId":"view-1","config":{
                  "chartConfig":{"datas":[{"rows":[{"category":"computedField","colName":"missing_computed"}]}]},
                  "computedFields":[]
                }}}}
                """);
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));
        when(dashboardMapper.listByOrgId("org-1")).thenReturn(List.of(dashboard));
        when(widgetMapper.listByDashboard("dashboard-1")).thenReturn(List.of(widget));
        when(elementMapper.listWidgetElementsByIds(List.of("widget-1"))).thenReturn(List.of());

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getBlockers());
        assertFalse(report.isStrictEligible());
        assertTrue(hasIssue(report, ReadinessIssueCode.DATACHART_COMPUTED_FIELD_INVALID));
        assertEquals(0, report.getChartFieldReferences());
    }

    @Test
    void unresolvedDatachartFieldIsBlocker() {
        DatachartMapperExt datachartMapper = mock(DatachartMapperExt.class);
        ReadinessScanner scanner = scanner(datachartMapper, null, null, null);
        View view = view("view-1", "View", canonicalModel(), "source-1");
        Datachart datachart = datachart("chart-1", "Broken chart", "view-1", chartConfig("missing"));
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));
        when(datachartMapper.listByOrgId("org-1")).thenReturn(List.of(datachart));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getBlockers());
        assertTrue(hasIssue(report, ReadinessIssueCode.DATACHART_FIELD_NOT_FOUND));
    }

    @Test
    void dashboardMissingDatachartIsBlocker() {
        DatachartMapperExt datachartMapper = mock(DatachartMapperExt.class);
        DashboardMapperExt dashboardMapper = mock(DashboardMapperExt.class);
        WidgetMapperExt widgetMapper = mock(WidgetMapperExt.class);
        RelWidgetElementMapperExt elementMapper = mock(RelWidgetElementMapperExt.class);
        ReadinessScanner scanner = scanner(datachartMapper, dashboardMapper, widgetMapper, elementMapper);
        Dashboard dashboard = dashboard("dashboard-1", "Dashboard");
        Widget widget = new Widget();
        widget.setId("widget-1");
        RelWidgetElement element = new RelWidgetElement();
        element.setWidgetId("widget-1");
        element.setRelType("DATACHART");
        element.setRelId("missing-chart");
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of());
        when(datachartMapper.listByOrgId("org-1")).thenReturn(List.of());
        when(dashboardMapper.listByOrgId("org-1")).thenReturn(List.of(dashboard));
        when(widgetMapper.listByDashboard("dashboard-1")).thenReturn(List.of(widget));
        when(elementMapper.listWidgetElementsByIds(List.of("widget-1"))).thenReturn(List.of(element));

        ReadinessReport report = scanner.scan("org-1");

        assertEquals(1, report.getBlockers());
        assertTrue(hasIssue(report, ReadinessIssueCode.DASHBOARD_DATACHART_NOT_FOUND));
    }

    @Test
    void repeatedScanIsStableAndDoesNotChangeViewModel() {
        View view = view("view-1", "Stable", canonicalModel(), "source-1");
        String before = view.getModel();
        when(viewMapper.listByOrgId("org-1")).thenReturn(List.of(view));
        when(viewFieldMapper.listByViewId("view-1")).thenReturn(List.of(field("view-1")));

        ReadinessReport first = scanner.scan("org-1");
        ReadinessReport second = scanner.scan("org-1");

        assertEquals(first, second);
        assertEquals(before, view.getModel());
    }

    private static View view(String id, String name, String model, String sourceId) {
        View view = new View();
        view.setId(id);
        view.setName(name);
        view.setType("STRUCT");
        view.setSourceId(sourceId);
        view.setModel(model);
        return view;
    }

    private static ViewField field(String viewId) {
        ViewField field = new ViewField();
        field.setId("field-city");
        field.setViewId(viewId);
        field.setCanonicalKey("FIELD|db.city.city_name");
        field.setOriginName("city_name");
        field.setSourcePath("[\"db\",\"city\",\"city_name\"]");
        field.setFieldType("STRING");
        field.setFieldCategory("DIMENSION");
        field.setActive(true);
        return field;
    }

    private ReadinessScanner scanner(DatachartMapperExt datachartMapper,
                                    DashboardMapperExt dashboardMapper,
                                    WidgetMapperExt widgetMapper,
                                    RelWidgetElementMapperExt elementMapper) {
        return new ReadinessScanner(viewMapper, viewFieldMapper, sourceMapper, null,
                new StrictJson(new ObjectMapper()), new ObjectMapper(), datachartMapper,
                dashboardMapper, widgetMapper, elementMapper);
    }

    private static Datachart datachart(String id, String name, String viewId, String config) {
        Datachart datachart = new Datachart();
        datachart.setId(id);
        datachart.setName(name);
        datachart.setViewId(viewId);
        datachart.setConfig(config);
        return datachart;
    }

    private static Dashboard dashboard(String id, String name) {
        Dashboard dashboard = new Dashboard();
        dashboard.setId(id);
        dashboard.setName(name);
        dashboard.setConfig("{}");
        return dashboard;
    }

    private static String chartConfig(String fieldId) {
        return "{\"chartConfig\":{\"datas\":[{\"rows\":[{" +
                "\"category\":\"field\",\"colName\":\"city_name\",\"fieldId\":\"" +
                fieldId + "\"}]}]}}";
    }

    private static String canonicalModel() {
        return "{\"columns\":{\"city\":{" +
                "\"fieldId\":\"field-city\",\"name\":[\"db\",\"city\",\"city_name\"]," +
                "\"type\":\"STRING\",\"category\":\"DIMENSION\"," +
                "\"isDisplayNameCustom\":false}}}";
    }

    private static String legacyModel() {
        return "{\"columns\":{\"city\":{" +
                "\"fieldId\":\"field-city\",\"name\":[\"db\",\"city\",\"city_name\"]," +
                "\"type\":\"STRING\",\"category\":\"DIMENSION\",\"comment\":\"城市\"}}}";
    }

    private static boolean hasIssue(ReadinessReport report, String code) {
        return report.getIssues().stream().map(ReadinessIssue::getCode).anyMatch(code::equals);
    }
}
