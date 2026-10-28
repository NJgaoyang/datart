package datart.server.service.impl;

import datart.core.base.consts.Const;
import datart.core.base.exception.BaseException;
import datart.core.common.Application;
import datart.core.data.provider.Dataframe;
import datart.core.entity.Dashboard;
import datart.core.entity.Folder;
import datart.core.entity.Share;
import datart.core.entity.User;
import datart.core.entity.Role;
import datart.core.mappers.ext.ShareMapperExt;
import datart.core.mappers.ext.FolderMapperExt;
import datart.core.mappers.ext.UserMapperExt;
import datart.security.base.ResourceType;
import datart.security.manager.DatartSecurityManager;
import datart.security.util.AESUtil;
import datart.server.base.params.ShareAuthorizedToken;
import datart.server.base.params.ShareDownloadParam;
import datart.server.base.params.ShareToken;
import datart.server.base.params.ViewExecuteParam;
import datart.server.service.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Date;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ShareAccessSecurityTest {
    private final DatartSecurityManager security = mock(DatartSecurityManager.class);
    private final UserMapperExt users = mock(UserMapperExt.class);
    private final DashboardService dashboards = mock(DashboardService.class);
    private final DataProviderService provider = mock(DataProviderService.class);
    private final FolderMapperExt folders = mock(FolderMapperExt.class);
    private final ShareMapperExt shares = mock(ShareMapperExt.class);
    private final RoleService roles = mock(RoleService.class);
    private ShareServiceImpl service;

    @BeforeEach
    void setup() {
        service = new ShareServiceImpl(provider, mock(VizService.class), mock(DownloadService.class),
                shares, roles, users, dashboards,
                mock(DatachartService.class), mock(StoryboardService.class), folders);
        service.setSecurityManager(security);
    }

    @Test
    void loginShareRequiresActiveUserAndCorrectPassword() {
        Share share = new Share();
        share.setAuthenticationMode("LOGIN");
        share.setRowPermissionBy("CREATOR");
        User user = new User();
        user.setUsername("reader");
        user.setActive(true);
        when(users.selectByNameOrEmail("reader")).thenReturn(user);
        ShareToken token = new ShareToken();
        token.setUsername("reader");
        token.setPassword("wrong");
        assertThrows(BaseException.class, () -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, token));
        when(security.validateUser("reader", "correct")).thenReturn(true);
        token.setPassword("correct");
        assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, token));
        user.setActive(false);
        assertThrows(BaseException.class, () -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, token));
    }

    @Test
    void shareManagementChecksTheUnderlyingDashboardPermission() {
        Share share = new Share();
        share.setVizType("DASHBOARD");
        share.setVizId("board");
        Dashboard board = new Dashboard();
        when(folders.selectByRelTypeAndId("DASHBOARD", "board")).thenReturn(new Folder());
        when(dashboards.retrieve("board", false)).thenReturn(board);
        doThrow(new BaseException("denied")).when(dashboards).requirePermission(board, Const.MANAGE);
        assertThrows(BaseException.class, () -> service.requirePermission(share, Const.MANAGE));
        verify(dashboards).requirePermission(board, Const.MANAGE);
    }

    @Test
    void orphanedDashboardShareDoesNotGrantManagementToOrdinaryUsers() {
        Share share = new Share();
        share.setVizType("DASHBOARD");
        share.setVizId("board");
        share.setOrgId("org");
        assertThrows(BaseException.class, () -> service.requirePermission(share, Const.MANAGE));
        verifyNoInteractions(dashboards);
    }

    @Test
    void existingSessionMustBeAuthenticatedAndVisitorContextIsReleased() {
        Share share = new Share();
        share.setAuthenticationMode("LOGIN");
        share.setRowPermissionBy("VISITOR");
        share.setOrgId("org");
        User user = new User();
        user.setUsername("reader");
        user.setActive(true);
        when(security.getCurrentUser()).thenReturn(user);
        assertThrows(BaseException.class, () -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, new ShareToken()));
        when(security.isAuthenticated()).thenReturn(true);
        when(security.isOrgOwner("org")).thenReturn(true);
        assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, new ShareToken()));
        verify(security).runAs("reader");
        verify(security).releaseRunAs();
    }

    @Test
    void designatedRolesApplyEvenWhenDataUsesCreatorPermissions() {
        Share share = new Share();
        share.setAuthenticationMode("LOGIN");
        share.setRowPermissionBy("CREATOR");
        share.setOrgId("org");
        share.setRoles("[\"rallowed\"]");
        User user = new User();
        user.setId("user");
        user.setUsername("reader");
        user.setActive(true);
        when(security.isAuthenticated()).thenReturn(true);
        when(security.getCurrentUser()).thenReturn(user);
        assertThrows(BaseException.class, () -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, new ShareToken()));
        Role role = new Role();
        role.setId("allowed");
        when(roles.listUserRoles("org", "user")).thenReturn(List.of(role));
        assertDoesNotThrow(() -> ReflectionTestUtils.invokeMethod(service, "authenticationShare", share, new ShareToken()));
    }

    @Test
    void expiredViewTokenCannotExecuteOrCreateDownload() throws Exception {
        ShareAuthorizedToken token = new ShareAuthorizedToken();
        token.setVizType(ResourceType.VIEW);
        token.setVizId("view");
        token.setShareId("share");
        token.setExpiryDate(new Date(System.currentTimeMillis() - 10000));
        Share original = new Share();
        token.setPolicyHash(ShareServiceImpl.sharePolicyHash(original));
        when(shares.selectByPrimaryKey("share")).thenReturn(original);
        ViewExecuteParam param = new ViewExecuteParam();
        param.setViewId("view");
        try (MockedStatic<Application> app = mockStatic(Application.class)) {
            app.when(Application::getTokenSecret).thenReturn("test-secret");
            String encrypted = AESUtil.encrypt(token, Application.getTokenSecret());
            assertThrows(BaseException.class, () -> service.execute(ShareToken.create(encrypted), param));
            ShareDownloadParam download = new ShareDownloadParam();
            download.setDownloadParams(List.of(param));
            download.setExecuteToken(Map.of("view", ShareToken.create(encrypted)));
            assertThrows(BaseException.class, () -> service.createDownload("client", download));
            token.setExpiryDate(new Date(System.currentTimeMillis() + 100000));
            Share shortened = new Share();
            shortened.setExpiryDate(new Date(System.currentTimeMillis() - 10000));
            when(shares.selectByPrimaryKey("share")).thenReturn(shortened);
            String shortenedToken = AESUtil.encrypt(token, Application.getTokenSecret());
            assertThrows(BaseException.class, () -> service.execute(ShareToken.create(shortenedToken), param));
            verifyNoInteractions(provider);
        }
    }

    @Test
    void validViewTokenExecutesAndRestoresTheRequestIdentity() throws Exception {
        ShareAuthorizedToken token = new ShareAuthorizedToken();
        token.setShareId("share");
        token.setVizType(ResourceType.VIEW);
        token.setVizId("view");
        token.setPermissionBy("owner");
        Share current = new Share();
        token.setPolicyHash(ShareServiceImpl.sharePolicyHash(current));
        ViewExecuteParam param = new ViewExecuteParam();
        param.setViewId("view");
        when(shares.selectByPrimaryKey("share")).thenReturn(current);
        Dataframe result = Dataframe.empty();
        when(provider.execute(eq(param), eq(false), anyString())).thenReturn(result);
        try (MockedStatic<Application> app = mockStatic(Application.class)) {
            app.when(Application::getTokenSecret).thenReturn("test-secret");
            String encrypted = AESUtil.encrypt(token, Application.getTokenSecret());
            assertSame(result, service.execute(ShareToken.create(encrypted), param));
            verify(security).runAs("owner");
            verify(security).releaseRunAs();
            current.setAuthenticationMode("LOGIN");
            assertThrows(BaseException.class, () -> service.execute(ShareToken.create(encrypted), param));
        }
    }
}
