package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.common.Application;
import datart.core.base.consts.MigrationMode;
import datart.core.entity.Datachart;
import datart.core.entity.Dashboard;
import datart.core.entity.Folder;
import datart.core.entity.RelWidgetElement;
import datart.core.entity.Source;
import datart.core.entity.User;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.entity.Widget;
import datart.core.mappers.ext.*;
import datart.security.manager.DatartSecurityManager;
import datart.server.base.dto.ReadinessReport;
import datart.server.base.dto.ViewDetailDTO;
import datart.server.base.dto.WidgetDetail;
import datart.server.base.transfer.ImportStrategy;
import datart.server.base.transfer.model.*;
import datart.server.common.TransferFileUtils;
import datart.server.common.readiness.ReadinessScanner;
import datart.server.service.FileService;
import datart.server.service.FolderService;
import datart.server.service.MigrationModeService;
import datart.server.service.RoleService;
import datart.server.service.VariableService;
import datart.server.service.ViewFieldService;
import datart.server.service.WidgetService;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationContext;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.ObjectOutputStream;
import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MigrationRuntimeVerificationTest {

    @Test
    void legacyImportExportImportReachesReadinessAndRuntimeSmoke() throws Exception {
        Fixture fixture = new Fixture();
        ResourceModel legacy = fixture.resourceModel(true);

        TransferFileUtils.TransferReadResult legacyPackage = readLegacy(legacy);
        assertEquals(1, legacyPackage.formatVersion());
        fixture.importResource((ResourceModel) legacyPackage.model(), ImportStrategy.NEW);
        assertEquals(1, fixture.views.size());
        assertEquals(1, fixture.datacharts.size());
        assertEquals(1, fixture.dashboards.size());

        ReadinessReport first = fixture.scan();
        assertTrue(first.getTotal() == 3, first::toString);
        assertEquals(3, first.getReady(), first::toString);
        assertEquals(0, first.getBlockers());
        assertTrue(first.isStrictEligible());
        assertEquals(100D, first.getReadiness());
        assertEquals(100D, first.getChartFieldIdCoverage());
        assertEquals(100D, first.getResolvedChartFieldIdCoverage());

        fixture.assertRuntimeSmoke();

        ResourceModel exported = fixture.currentResourceModel();
        TransferFileUtils.TransferReadResult v2 = readV2(exported);
        assertEquals(2, v2.formatVersion());
        fixture.importResource((ResourceModel) v2.model(), ImportStrategy.ROLLBACK);

        ReadinessReport second = fixture.scan();
        assertEquals(first, second);
        assertEquals("field-city", fixture.fields.get("view-1").getId());
        assertFalse(fixture.views.get("view-1").getModel().contains("\"fieldId\":null"));
    }

    private static TransferFileUtils.TransferReadResult readLegacy(ResourceModel model) throws Exception {
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ObjectOutputStream output = new ObjectOutputStream(new GZIPOutputStream(bytes))) {
            output.writeObject(model);
        }
        return TransferFileUtils.readWithMetadata(new ByteArrayInputStream(bytes.toByteArray()), 1024 * 1024);
    }

    private static TransferFileUtils.TransferReadResult readV2(ResourceModel model) throws Exception {
        java.nio.file.Path file = java.nio.file.Files.createTempFile("datart-v2", ".datart");
        try {
            TransferFileUtils.write(model, file.toString());
            try (var input = java.nio.file.Files.newInputStream(file)) {
                return TransferFileUtils.readWithMetadata(input, 1024 * 1024);
            }
        } finally {
            java.nio.file.Files.deleteIfExists(file);
        }
    }

    private static final class Fixture {
        private final ObjectMapper json = new ObjectMapper();
        private final Map<String, View> views = new LinkedHashMap<>();
        private final Map<String, ViewField> fields = new LinkedHashMap<>();
        private final Map<String, Datachart> datacharts = new LinkedHashMap<>();
        private final Map<String, Dashboard> dashboards = new LinkedHashMap<>();
        private final Map<String, Widget> widgets = new LinkedHashMap<>();
        private final List<RelWidgetElement> elements = new ArrayList<>();

        private final ViewMapperExt viewMapper = mock(ViewMapperExt.class);
        private final ViewFieldMapperExt viewFieldMapper = mock(ViewFieldMapperExt.class);
        private final DatachartMapperExt datachartMapper = mock(DatachartMapperExt.class);
        private final DashboardMapperExt dashboardMapper = mock(DashboardMapperExt.class);
        private final WidgetMapperExt widgetMapper = mock(WidgetMapperExt.class);
        private final RelWidgetElementMapperExt elementMapper = mock(RelWidgetElementMapperExt.class);
        private final RelWidgetWidgetMapperExt widgetRelationMapper = mock(RelWidgetWidgetMapperExt.class);
        private final SourceMapperExt sourceMapper = mock(SourceMapperExt.class);
        private final FolderMapperExt folderMapper = mock(FolderMapperExt.class);
        private final RelSubjectColumnsMapperExt subjectColumnsMapper = mock(RelSubjectColumnsMapperExt.class);
        private final VariableService variableService = mock(VariableService.class);
        private final MigrationModeService migrationModeService = mock(MigrationModeService.class);
        private final FileService fileService = mock(FileService.class);
        private final FolderService folderService = mock(FolderService.class);
        private final WidgetService widgetService = mock(WidgetService.class);
        private final ViewFieldService viewFieldService = mock(ViewFieldService.class);
        private final DatartSecurityManager securityManager = mock(DatartSecurityManager.class);
        private final ViewServiceImpl viewService;
        private final DatachartServiceImpl datachartService;
        private final DashboardServiceImpl dashboardService;
        private final ReadinessScanner scanner;

        private Fixture() {
            User user = new User();
            user.setId("user-1");
            when(securityManager.getCurrentUser()).thenReturn(user);
            when(sourceMapper.selectByPrimaryKey(anyString())).thenReturn(mock(Source.class));
            when(viewMapper.listByOrgId(anyString())).thenAnswer(ignored -> new ArrayList<>(views.values()));
            when(viewMapper.selectByPrimaryKey(anyString())).thenAnswer(invocation -> views.get(invocation.getArgument(0)));
            when(viewMapper.selectActiveByPrimaryKey(anyString())).thenAnswer(invocation -> views.get(invocation.getArgument(0)));
            when(viewMapper.listByIds(any())).thenAnswer(invocation -> ((java.util.Set<String>) invocation.getArgument(0))
                    .stream().map(views::get).filter(java.util.Objects::nonNull).toList());
            when(viewFieldMapper.listByViewId(anyString())).thenAnswer(invocation -> {
                ViewField field = fields.get(invocation.getArgument(0));
                return field == null ? List.of() : List.of(field);
            });
            when(datachartMapper.listByOrgId(anyString())).thenAnswer(ignored -> new ArrayList<>(datacharts.values()));
            when(datachartMapper.selectByPrimaryKey(anyString())).thenAnswer(invocation -> datacharts.get(invocation.getArgument(0)));
            when(datachartMapper.listByIds(any())).thenAnswer(invocation -> ((java.util.Set<String>) invocation.getArgument(0))
                    .stream().map(datacharts::get).filter(java.util.Objects::nonNull).toList());
            when(dashboardMapper.listByOrgId(anyString())).thenAnswer(ignored -> new ArrayList<>(dashboards.values()));
            when(dashboardMapper.selectByPrimaryKey(anyString())).thenAnswer(invocation -> dashboards.get(invocation.getArgument(0)));
            when(widgetMapper.listByDashboard(anyString())).thenAnswer(ignored -> new ArrayList<>(widgets.values()));
            when(elementMapper.listWidgetElementsByIds(any())).thenAnswer(ignored -> new ArrayList<>(elements));
            when(widgetRelationMapper.listTargetWidgetsByIds(any())).thenReturn(List.of());
            when(folderMapper.selectByRelTypeAndId(anyString(), anyString())).thenReturn(null);
            when(variableService.listByView(anyString())).thenReturn(List.of());
            when(variableService.listViewVariableRels(anyString())).thenReturn(List.of());
            when(variableService.listOrgQueryVariables(anyString())).thenReturn(List.of());
            when(variableService.listViewQueryVariables(anyString())).thenReturn(List.of());
            when(securityManager.isOrgOwner(anyString())).thenReturn(true);
            when(migrationModeService.getMode(anyString())).thenReturn(MigrationMode.COMPAT);

            doAnswer(invocation -> {
                View view = invocation.getArgument(0);
                views.put(view.getId(), view);
                return 1;
            }).when(viewMapper).insert(any(View.class));
            doAnswer(invocation -> {
                View view = invocation.getArgument(0);
                views.put(view.getId(), view);
                return 1;
            }).when(viewMapper).updateByPrimaryKey(any(View.class));
            doAnswer(invocation -> {
                View view = invocation.getArgument(0);
                ObjectNode root = (ObjectNode) json.readTree(view.getModel());
                ((ObjectNode) root.path("columns").path("city")).put("fieldId", "field-city");
                view.setModel(root.toString());
                views.put(view.getId(), view);
                ViewField field = new ViewField();
                field.setId("field-city");
                field.setViewId(view.getId());
                field.setCanonicalKey("FIELD|db.city.city_name");
                field.setOriginName("city_name");
                field.setSourcePath("[\"db\",\"city\",\"city_name\"]");
                field.setFieldType("STRING");
                field.setFieldCategory("DIMENSION");
                field.setActive(true);
                fields.put(view.getId(), field);
                return null;
            }).when(viewFieldService).rebuild(any(View.class));
            doAnswer(invocation -> {
                Datachart datachart = invocation.getArgument(0);
                datacharts.put(datachart.getId(), datachart);
                return 1;
            }).when(datachartMapper).insert(any(Datachart.class));
            doAnswer(invocation -> {
                Dashboard dashboard = invocation.getArgument(0);
                dashboards.put(dashboard.getId(), dashboard);
                return 1;
            }).when(dashboardMapper).insert(any(Dashboard.class));
            doAnswer(invocation -> {
                Widget widget = invocation.getArgument(0);
                widgets.put(widget.getId(), widget);
                return 1;
            }).when(widgetMapper).insert(any(Widget.class));
            doAnswer(invocation -> {
                elements.addAll(invocation.getArgument(0));
                return null;
            }).when(elementMapper).batchInsert(any());

            viewService = new ViewServiceImpl(viewMapper, subjectColumnsMapper,
                    mock(RelRoleResourceMapperExt.class), mock(RoleService.class), variableService,
                    mock(VariableMapperExt.class), mock(RelVariableSubjectMapperExt.class),
                    mock(DashboardMapperExt.class), datachartMapper, viewFieldService, null, null,
                    migrationModeService);
            datachartService = new DatachartServiceImpl(mock(RoleService.class), fileService,
                    folderMapper, mock(RelRoleResourceMapperExt.class), folderService,
                    datachartMapper, viewService, variableService, viewFieldService,
                    migrationModeService);
            dashboardService = new DashboardServiceImpl(dashboardMapper, widgetMapper, elementMapper,
                    widgetRelationMapper, mock(RelRoleResourceMapperExt.class), mock(RoleService.class),
                    fileService, folderMapper, viewMapper, datachartMapper,
                    widgetService, folderService, variableService,
                    viewService, datachartService, migrationModeService);
            viewService.setSecurityManager(securityManager);
            datachartService.setSecurityManager(securityManager);
            dashboardService.setSecurityManager(securityManager);
            scanner = new ReadinessScanner(viewMapper, viewFieldMapper, sourceMapper, null,
                    new datart.server.common.fieldmeta.StrictJson(json), json, datachartMapper,
                    dashboardMapper, widgetMapper, elementMapper);
        }

        private ResourceModel resourceModel(boolean legacy) {
            View view = new View();
            view.setId("view-1");
            view.setName("城市视图");
            view.setOrgId("source-org");
            view.setSourceId("source-1");
            view.setType("STRUCT");
            view.setModel(legacy
                    ? "{\"columns\":{\"city\":{\"name\":[\"db\",\"city\",\"city_name\"],\"type\":\"STRING\",\"category\":\"DIMENSION\",\"displayName\":\"city_name\",\"comment\":\"城市\"}}}"
                    : "{\"columns\":{\"city\":{\"fieldId\":\"field-city\",\"name\":[\"db\",\"city\",\"city_name\"],\"type\":\"STRING\",\"category\":\"DIMENSION\",\"isDisplayNameCustom\":false}}}");
            ViewResourceModel.MainModel viewMain = new ViewResourceModel.MainModel();
            viewMain.setView(view);
            viewMain.setVariables(List.of());
            ViewResourceModel viewModel = new ViewResourceModel();
            viewModel.setMainModels(List.of(viewMain));
            viewModel.setSources(java.util.Set.of("source-1"));

            Datachart datachart = new Datachart();
            datachart.setId("chart-1");
            datachart.setName("城市图表");
            datachart.setViewId("view-1");
            datachart.setConfig("{\"chartConfig\":{\"datas\":[{\"rows\":[{" +
                    "\"category\":\"field\",\"colName\":\"city_name\",\"fieldId\":\"field-city\"}]}]}}");
            DatachartResourceModel.MainModel chartMain = new DatachartResourceModel.MainModel();
            chartMain.setDatachart(datachart);
            chartMain.setFolder(folder("chart-folder", "城市图表"));
            DatachartResourceModel chartModel = new DatachartResourceModel();
            chartModel.setMainModels(List.of(chartMain));

            Dashboard dashboard = new Dashboard();
            dashboard.setId("dashboard-1");
            dashboard.setName("城市看板");
            dashboard.setConfig("{}");
            WidgetDetail widget = new WidgetDetail();
            widget.setId("widget-1");
            widget.setDashboardId("dashboard-1");
            widget.setDatachartId("chart-1");
            widget.setViewIds(List.of());
            widget.setConfig("{}");
            DashboardResourceModel.MainModel dashboardMain = new DashboardResourceModel.MainModel();
            dashboardMain.setDashboard(dashboard);
            dashboardMain.setFolder(folder("dashboard-folder", "城市看板"));
            dashboardMain.setWidgets(List.of(widget));
            dashboardMain.setFiles(Map.of());
            DashboardResourceModel dashboardModel = new DashboardResourceModel();
            dashboardModel.setMainModels(List.of(dashboardMain));
            dashboardModel.setDatacharts(java.util.Set.of("chart-1"));
            dashboardModel.setViews(java.util.Set.of("view-1"));

            ResourceModel resource = new ResourceModel();
            resource.setViewResourceModel(viewModel);
            resource.setDatachartResourceModel(chartModel);
            resource.setDashboardResourceModel(dashboardModel);
            return resource;
        }

        private ResourceModel currentResourceModel() {
            ResourceModel resource = resourceModel(false);
            resource.getViewResourceModel().getMainModels().get(0).setView(views.get("view-1"));
            resource.getDatachartResourceModel().getMainModels().get(0).setDatachart(datacharts.get("chart-1"));
            resource.getDashboardResourceModel().getMainModels().get(0).setDashboard(dashboards.get("dashboard-1"));
            resource.getDashboardResourceModel().getMainModels().get(0)
                    .setWidgets(List.of((WidgetDetail) widgets.get("widget-1")));
            return resource;
        }

        private void importResource(ResourceModel model, ImportStrategy strategy) {
            viewService.importResource(model.getViewResourceModel(), strategy, "target-org");
            datachartService.importResource(model.getDatachartResourceModel(), strategy, "target-org");
            dashboardService.importResource(model.getDashboardResourceModel(), strategy, "target-org");
        }

        private ReadinessReport scan() {
            return scanner.scan("target-org");
        }

        private void assertRuntimeSmoke() throws Exception {
            View view = views.get("view-1");
            ViewDetailDTO detail = viewService.buildViewDetail(view);
            assertNotNull(detail);
            assertEquals("view-1", detail.getId());
            Field contextField = Application.class.getDeclaredField("context");
            contextField.setAccessible(true);
            Object previousContext = contextField.get(null);
            ApplicationContext context = mock(ApplicationContext.class);
            when(context.getBean(DatachartMapperExt.class)).thenReturn(datachartMapper);
            when(context.getBean(DashboardMapperExt.class)).thenReturn(dashboardMapper);
            when(context.getBean(ViewMapperExt.class)).thenReturn(viewMapper);
            contextField.set(null, context);
            try {
                var chartDetail = datachartService.getDatachartDetail("chart-1");
                assertNotNull(chartDetail);
                assertEquals("view-1", chartDetail.getView().getId());
                var dashboardDetail = dashboardService.getDashboardDetail("dashboard-1");
                assertNotNull(dashboardDetail);
                assertEquals(1, dashboardDetail.getDatacharts().size());
                assertEquals(1, dashboardDetail.getViews().size());
                assertEquals(MigrationMode.COMPAT,
                        ((ViewDetailDTO) dashboardDetail.getViews().get(0)).getMigrationMode());
                when(migrationModeService.getMode(anyString())).thenReturn(MigrationMode.STRICT);
                var strictDashboardDetail = dashboardService.getDashboardDetail("dashboard-1");
                assertEquals(MigrationMode.STRICT,
                        ((ViewDetailDTO) strictDashboardDetail.getViews().get(0)).getMigrationMode());
                when(migrationModeService.getMode(anyString())).thenReturn(MigrationMode.COMPAT);
            } finally {
                contextField.set(null, previousContext);
            }
            assertTrue(view.getModel().contains("\"fieldId\":\"field-city\""));
            assertTrue(json.readTree(datacharts.get("chart-1").getConfig())
                    .at("/chartConfig/datas/0/rows/0/fieldId").asText().equals("field-city"));
            assertTrue(elements.stream().anyMatch(element -> "chart-1".equals(element.getRelId())));
        }

        private static Folder folder(String id, String name) {
            Folder folder = new Folder();
            folder.setId(id);
            folder.setName(name);
            folder.setRelId(id);
            return folder;
        }
    }
}
