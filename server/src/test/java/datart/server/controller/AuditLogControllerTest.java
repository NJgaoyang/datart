package datart.server.controller;

import datart.core.base.exception.ParamException;
import datart.core.entity.Organization;
import datart.core.mappers.ext.OrganizationMapperExt;
import datart.security.exception.PermissionDeniedException;
import datart.security.manager.DatartSecurityManager;
import datart.server.service.AsyncAccessLogService;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuditLogControllerTest {
    private final AsyncAccessLogService logs = mock(AsyncAccessLogService.class);
    private final OrganizationMapperExt organizations = mock(OrganizationMapperExt.class);
    private final DatartSecurityManager security = mock(DatartSecurityManager.class);
    private final AuditLogController controller = new AuditLogController(logs, organizations);

    private void setupOrganizations() {
        Organization first = new Organization();
        first.setId("first");
        Organization second = new Organization();
        second.setId("second");
        when(organizations.list()).thenReturn(List.of(first, second));
        controller.setSecurityManager(security);
    }

    @Test
    void deniesUsersWithoutManagementPermissionBeforeReadingLogs() {
        setupOrganizations();
        doNothing().doThrow(new PermissionDeniedException("denied")).when(security).requireAllPermissions(any());
        assertThrows(PermissionDeniedException.class, () -> controller.queryLogs(null, null, null, null, 20, 1));
        verify(security, times(2)).requireAllPermissions(any());
        verifyNoInteractions(logs);
    }

    @Test
    void checksEveryOrganizationAndLimitsPageSize() {
        setupOrganizations();
        controller.queryLogs(null, null, null, null, 20, 1);
        verify(security, times(2)).requireAllPermissions(any());
        verify(logs).queryLogs(null, null, null, null, 20, 1);
        assertThrows(ParamException.class, () -> controller.queryLogs(null, null, null, null, 101, 1));
        assertThrows(ParamException.class, () -> controller.queryLogs(null, null, null, null, 20, 0));
    }
}
