package datart.server.service.impl;

import datart.core.base.consts.Const;
import datart.core.entity.Dashboard;
import datart.core.entity.Datachart;
import datart.core.entity.Folder;
import datart.core.entity.View;
import datart.core.mappers.ext.DatachartMapperExt;
import datart.core.mappers.ext.DashboardMapperExt;
import datart.core.mappers.ext.FolderMapperExt;
import datart.core.mappers.ext.ViewMapperExt;
import datart.security.base.ResourceType;
import datart.security.util.PermissionHelper;
import datart.server.base.dto.HistoryMigrationPreview;
import datart.server.common.HistoryMigrationDetector;
import datart.server.service.BaseService;
import datart.server.service.DatachartService;
import datart.server.service.DashboardService;
import datart.server.service.HistoryMigrationService;
import datart.server.service.ViewService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class HistoryMigrationServiceImpl extends BaseService implements HistoryMigrationService {

    private final FolderMapperExt folderMapper;
    private final DatachartMapperExt datachartMapper;
    private final DashboardMapperExt dashboardMapper;
    private final ViewMapperExt viewMapper;
    private final DatachartService datachartService;
    private final DashboardService dashboardService;
    private final ViewService viewService;

    public HistoryMigrationServiceImpl(FolderMapperExt folderMapper,
                                       DatachartMapperExt datachartMapper,
                                       DashboardMapperExt dashboardMapper,
                                       ViewMapperExt viewMapper,
                                       DatachartService datachartService,
                                       DashboardService dashboardService,
                                       ViewService viewService) {
        this.folderMapper = folderMapper;
        this.datachartMapper = datachartMapper;
        this.dashboardMapper = dashboardMapper;
        this.viewMapper = viewMapper;
        this.datachartService = datachartService;
        this.dashboardService = dashboardService;
        this.viewService = viewService;
    }

    @Override
    public HistoryMigrationPreview preview(String orgId) {
        checkAdminPermission(orgId);
        HistoryMigrationPreview preview = new HistoryMigrationPreview();
        preview.setOrgId(orgId);
        preview.setDestructive(false);

        for (View view : viewMapper.listByOrgId(orgId)) {
            if (!Boolean.TRUE.equals(view.getIsFolder()) && canManageView(view)) {
                add(preview, ResourceType.VIEW.name(), view.getId(), view.getName(),
                        view.getScript(), view.getConfig());
            }
        }
        for (Folder folder : folderMapper.selectByOrg(orgId)) {
            if (ResourceType.DATACHART.name().equals(folder.getRelType())) {
                Datachart datachart = datachartMapper.selectByPrimaryKey(folder.getRelId());
                if (datachart != null && canManageDatachart(datachart)) {
                    add(preview, ResourceType.DATACHART.name(), datachart.getId(), datachart.getName(),
                            datachart.getConfig());
                }
            } else if (ResourceType.DASHBOARD.name().equals(folder.getRelType())) {
                Dashboard dashboard = dashboardMapper.selectByPrimaryKey(folder.getRelId());
                if (dashboard != null && canManageDashboard(dashboard)) {
                    add(preview, ResourceType.DASHBOARD.name(), dashboard.getId(), dashboard.getName(),
                            dashboard.getConfig());
                }
            }
        }
        return preview;
    }

    private void add(HistoryMigrationPreview preview, String type, String id, String name, String... values) {
        List<String> reasons = HistoryMigrationDetector.reasons(values);
        HistoryMigrationPreview.Item item = new HistoryMigrationPreview.Item();
        item.setResourceType(type);
        item.setResourceId(id);
        item.setResourceName(name);
        item.setReasons(reasons);
        item.setStatus(reasons.isEmpty() ? "NO_CHANGE" : "REVIEW");
        preview.getItems().add(item);
        preview.setTotal(preview.getTotal() + 1);
        if (!reasons.isEmpty()) {
            preview.setNeedsReview(preview.getNeedsReview() + 1);
        }
    }

    private void checkAdminPermission(String orgId) {
        securityManager.requireAllPermissions(PermissionHelper.rolePermission(orgId, Const.MANAGE));
    }

    private boolean canManageView(View view) {
        try {
            viewService.requirePermission(view, Const.MANAGE);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private boolean canManageDatachart(Datachart datachart) {
        try {
            datachartService.requirePermission(datachart, Const.MANAGE);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }

    private boolean canManageDashboard(Dashboard dashboard) {
        try {
            dashboardService.requirePermission(dashboard, Const.MANAGE);
            return true;
        } catch (RuntimeException ignored) {
            return false;
        }
    }
}
