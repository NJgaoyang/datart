package datart.server.service.impl;

import datart.core.data.provider.DataProviderManager;
import datart.core.data.provider.SelectColumn;
import datart.core.entity.RelSubjectColumns;
import datart.core.entity.User;
import datart.core.entity.View;
import datart.core.mappers.ext.RelSubjectColumnsMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.security.manager.DatartSecurityManager;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.SqlPreviewFieldMetadataResolver;
import datart.server.service.MigrationModeService;
import datart.server.service.SourceService;
import datart.server.service.VariableService;
import datart.server.service.ViewService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DataProviderColumnPermissionTest {
    private final RelSubjectColumnsMapperExt mapper = mock(RelSubjectColumnsMapperExt.class);
    private final ViewService viewService = mock(ViewService.class);
    private final DatartSecurityManager security = mock(DatartSecurityManager.class);
    private final View view = new View();
    private DataProviderServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new DataProviderServiceImpl(mock(DataProviderManager.class), mapper,
                mock(VariableService.class), viewService, mock(SourceService.class),
                mock(QueryExecutionTracePersistence.class), mock(SourceSchemaIndex.class),
                mock(SqlPreviewFieldMetadataResolver.class), mock(MigrationModeService.class),
                mock(ViewFieldMapperExt.class));
        service.setSecurityManager(security);
        service.init();
        view.setId("view");
        view.setOrgId("org");
        User user = new User();
        user.setId("user");
        when(security.getCurrentUser()).thenReturn(user);
    }

    @Test
    void readableRoleWithoutColumnRestrictionsGetsAllColumns() {
        when(viewService.getReadableRoleIds(view)).thenReturn(List.of("reader"));
        when(mapper.listByUser("view", "user")).thenReturn(List.of());
        assertEquals(Set.of(SelectColumn.of(null, "*")), service.parseColumnPermission(view));
    }

    @Test
    void explicitRestrictionsAreUnionedOnlyForReadableRoles() {
        when(viewService.getReadableRoleIds(view)).thenReturn(List.of("reader", "analyst"));
        when(mapper.listByUser("view", "user")).thenReturn(List.of(
                permission("reader", "[\"city\"]"), permission("analyst", "[\"month_label\"]"),
                permission("unrelated", "[\"secret\"]")));
        assertEquals(Set.of(SelectColumn.of(null, "city"), SelectColumn.of(null, "month_label")),
                service.parseColumnPermission(view));
    }

    @Test
    void unrestrictedReadableRoleGrantsAllButUnrelatedRoleDoesNot() {
        when(viewService.getReadableRoleIds(view)).thenReturn(List.of("reader", "analyst"));
        when(mapper.listByUser("view", "user")).thenReturn(List.of(permission("reader", "[\"city\"]")));
        assertEquals(Set.of(SelectColumn.of(null, "*")), service.parseColumnPermission(view));

        when(viewService.getReadableRoleIds(view)).thenReturn(List.of("reader"));
        assertEquals(Set.of(SelectColumn.of(null, "city")), service.parseColumnPermission(view));
    }

    @Test
    void explicitEmptyPermissionAndNoReadableRoleRemainDenied() {
        when(viewService.getReadableRoleIds(view)).thenReturn(List.of("reader"));
        when(mapper.listByUser("view", "user")).thenReturn(List.of(permission("reader", "[]")));
        assertTrue(service.parseColumnPermission(view).isEmpty());
        when(viewService.getReadableRoleIds(view)).thenReturn(List.of());
        assertTrue(service.parseColumnPermission(view).isEmpty());
    }

    @Test
    void brokenPermissionDataFailsClosedAndOwnerRemainsUnrestricted() {
        when(viewService.getReadableRoleIds(view)).thenReturn(List.of("reader"));
        when(mapper.listByUser("view", "user")).thenReturn(List.of(permission("reader", "invalid")));
        assertThrows(IllegalStateException.class, () -> service.parseColumnPermission(view));
        when(security.isOrgOwner("org")).thenReturn(true);
        assertEquals(Set.of(SelectColumn.of(null, "*")), service.parseColumnPermission(view));
    }

    private static RelSubjectColumns permission(String role, String columns) {
        RelSubjectColumns result = new RelSubjectColumns();
        result.setSubjectId(role);
        result.setColumnPermission(columns);
        return result;
    }
}
