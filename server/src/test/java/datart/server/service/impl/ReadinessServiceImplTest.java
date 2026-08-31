package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.base.consts.MigrationMode;
import datart.core.base.exception.NotAllowedException;
import datart.core.entity.Organization;
import datart.core.entity.View;
import datart.core.mappers.ext.DatachartMapperExt;
import datart.core.mappers.ext.DashboardMapperExt;
import datart.core.mappers.ext.OrganizationMapperExt;
import datart.core.mappers.ext.RelWidgetElementMapperExt;
import datart.core.mappers.ext.SourceMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.core.mappers.ext.ViewMapperExt;
import datart.core.mappers.ext.WidgetMapperExt;
import datart.security.manager.DatartSecurityManager;
import datart.server.base.params.MigrationModeUpdateParam;
import datart.server.common.fieldmeta.StrictJson;
import datart.server.service.MigrationModeService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReadinessServiceImplTest {

    private final ViewMapperExt viewMapper = mock(ViewMapperExt.class);
    private final OrganizationMapperExt organizationMapper = mock(OrganizationMapperExt.class);
    private final MigrationModeService migrationModeService = mock(MigrationModeService.class);
    private final DatartSecurityManager securityManager = mock(DatartSecurityManager.class);
    private final Organization organization = organization("org-1");
    private ReadinessServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ReadinessServiceImpl(
                viewMapper,
                mock(ViewFieldMapperExt.class),
                mock(SourceMapperExt.class),
                null,
                new StrictJson(new ObjectMapper()),
                new ObjectMapper(),
                mock(DatachartMapperExt.class),
                mock(DashboardMapperExt.class),
                mock(WidgetMapperExt.class),
                mock(RelWidgetElementMapperExt.class),
                organizationMapper,
                migrationModeService);
        service.setSecurityManager(securityManager);
        organization.setMigrationMode(null);
        when(organizationMapper.selectByPrimaryKey("org-1")).thenReturn(organization);
        when(migrationModeService.getMode("org-1"))
                .thenAnswer(ignored -> organization.getMigrationMode() == null
                        ? MigrationMode.COMPAT : organization.getMigrationMode());
    }

    @Test
    void defaultsMissingModeToCompat() {
        assertEquals(MigrationMode.COMPAT, service.getMode("org-1").getMode());
    }

    @Test
    void enablesStrictOnlyAfterFreshReadinessScan() {
        MigrationModeUpdateParam param = new MigrationModeUpdateParam();
        param.setOrgId("org-1");
        param.setMode(MigrationMode.STRICT);

        assertEquals(MigrationMode.STRICT, service.updateMode(param).getMode());
        assertEquals(MigrationMode.STRICT, organization.getMigrationMode());
        verify(organizationMapper).updateByPrimaryKeySelective(organization);
    }

    @Test
    void rejectsStrictWhenReadinessHasBlockers() {
        View broken = new View();
        broken.setId("view-1");
        broken.setName("Broken view");
        broken.setSourceId("missing-source");
        broken.setModel("{}");
        when(viewMapper.listByOrgId("org-1")).thenReturn(java.util.List.of(broken));

        MigrationModeUpdateParam param = new MigrationModeUpdateParam();
        param.setOrgId("org-1");
        param.setMode(MigrationMode.STRICT);

        assertThrows(NotAllowedException.class, () -> service.updateMode(param));
        verify(organizationMapper, never()).updateByPrimaryKeySelective(any());
    }

    @Test
    void canRollBackToCompatWithoutReadinessGate() {
        organization.setMigrationMode(MigrationMode.STRICT);
        MigrationModeUpdateParam param = new MigrationModeUpdateParam();
        param.setOrgId("org-1");
        param.setMode(MigrationMode.COMPAT);

        assertEquals(MigrationMode.COMPAT, service.updateMode(param).getMode());
        verify(organizationMapper).updateByPrimaryKeySelective(organization);
    }

    private static Organization organization(String id) {
        Organization organization = new Organization();
        organization.setId(id);
        organization.setName("Test organization");
        return organization;
    }
}
