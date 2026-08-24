package datart.server.service.impl;

import datart.core.entity.User;
import datart.core.entity.View;
import datart.core.mappers.ext.*;
import datart.security.manager.DatartSecurityManager;
import datart.server.base.transfer.ImportStrategy;
import datart.server.base.transfer.model.ResourceModel;
import datart.server.base.transfer.model.ViewResourceModel;
import datart.server.common.TransferFileUtils;
import datart.server.service.MigrationModeService;
import datart.server.service.RoleService;
import datart.server.service.VariableService;
import datart.server.service.ViewFieldService;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

class ViewResourceRoundTripTest {

    @Test
    void exportPackageRoundTripImportsCanonicalViewAndRebuildsFields() throws Exception {
        View view = new View();
        view.setId("view-1");
        view.setName("城市视图");
        view.setOrgId("source-org");
        view.setSourceId("source-1");
        view.setType("STRUCT");
        view.setModel("{\"columns\":{\"city\":{\"name\":[\"db\",\"city\",\"city_name\"],\"displayName\":\"城市\",\"comment\":\"城市\"}}}");

        ViewResourceModel.MainModel mainModel = new ViewResourceModel.MainModel();
        mainModel.setView(view);
        mainModel.setVariables(List.of());
        ViewResourceModel views = new ViewResourceModel();
        views.setMainModels(List.of(mainModel));
        ResourceModel exported = new ResourceModel();
        exported.setViewResourceModel(views);

        Path file = Files.createTempFile("datart-resource-round-trip", ".datart");
        try {
            TransferFileUtils.write(exported, file.toString());
            TransferFileUtils.TransferReadResult importedPackage;
            try (var input = Files.newInputStream(file)) {
                importedPackage = TransferFileUtils.readWithMetadata(input, 1024 * 1024);
            }

            ViewMapperExt viewMapper = mock(ViewMapperExt.class);
            ViewFieldService viewFieldService = mock(ViewFieldService.class);
            DatartSecurityManager securityManager = mock(DatartSecurityManager.class);
            User user = new User();
            user.setId("user-1");
            when(securityManager.getCurrentUser()).thenReturn(user);

            ViewServiceImpl service = new ViewServiceImpl(
                    viewMapper,
                    mock(RelSubjectColumnsMapperExt.class),
                    mock(RelRoleResourceMapperExt.class),
                    mock(RoleService.class),
                    mock(VariableService.class),
                    mock(VariableMapperExt.class),
                    mock(RelVariableSubjectMapperExt.class),
                    mock(DashboardMapperExt.class),
                    mock(DatachartMapperExt.class),
                    viewFieldService,
                    null,
                    null,
                    mock(MigrationModeService.class));
            service.setSecurityManager(securityManager);

            ResourceModel model = (ResourceModel) importedPackage.model();
            service.importResource(model.getViewResourceModel(), ImportStrategy.NEW, "target-org");

            verify(viewFieldService).rebuild(any(View.class));
            verify(viewMapper).insert(argThat(imported ->
                    "target-org".equals(imported.getOrgId())
                            && imported.getModel().contains("\"displayName\":\"城市\"")));
            assertEquals(2, importedPackage.formatVersion());
        } finally {
            Files.deleteIfExists(file);
        }
    }
}
