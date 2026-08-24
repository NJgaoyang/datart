package datart.server.service.impl;

import datart.core.base.consts.FileOwner;
import datart.core.base.consts.TransferFileType;
import datart.core.common.FileUtils;
import datart.core.common.TaskExecutor;
import datart.core.common.UUIDGenerator;
import datart.core.entity.*;
import datart.core.mappers.ext.*;
import datart.security.base.ResourceType;
import datart.server.base.transfer.TransferConfig;
import datart.server.base.transfer.model.DatachartResourceModel;
import datart.server.base.transfer.model.DashboardResourceModel;
import datart.server.base.transfer.model.ResourceModel;
import datart.server.base.transfer.model.organization.*;
import datart.server.common.TransferFileUtils;
import datart.server.service.*;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.*;
import java.util.stream.Collectors;

@Slf4j
@Service
public class OrganizationTransferServiceImpl extends BaseService implements OrganizationTransferService {

    private final OrganizationMapperExt organizationMapper;
    private final RoleMapperExt roleMapper;
    private final RelUserOrganizationMapperExt membershipMapper;
    private final RelRoleUserMapperExt userRoleMapper;
    private final RelRoleResourceMapperExt resourcePermissionMapper;
    private final RelSubjectColumnsMapperExt viewColumnPermissionMapper;
    private final RelVariableSubjectMapperExt variablePermissionMapper;
    private final SourceMapperExt sourceMapper;
    private final ViewMapperExt viewMapper;
    private final DatachartMapperExt datachartMapper;
    private final DashboardMapperExt dashboardMapper;
    private final FolderMapperExt folderMapper;
    private final SourceService sourceService;
    private final ViewService viewService;
    private final DatachartService datachartService;
    private final DashboardService dashboardService;
    private final FolderService folderService;
    private final FileService fileService;
    private final DownloadMapperExt downloadMapper;

    public OrganizationTransferServiceImpl(OrganizationMapperExt organizationMapper,
                                           RoleMapperExt roleMapper,
                                           RelUserOrganizationMapperExt membershipMapper,
                                           RelRoleUserMapperExt userRoleMapper,
                                           RelRoleResourceMapperExt resourcePermissionMapper,
                                           RelSubjectColumnsMapperExt viewColumnPermissionMapper,
                                           RelVariableSubjectMapperExt variablePermissionMapper,
                                           SourceMapperExt sourceMapper,
                                           ViewMapperExt viewMapper,
                                           DatachartMapperExt datachartMapper,
                                           DashboardMapperExt dashboardMapper,
                                           FolderMapperExt folderMapper,
                                           SourceService sourceService,
                                           ViewService viewService,
                                           DatachartService datachartService,
                                           DashboardService dashboardService,
                                           FolderService folderService,
                                           FileService fileService,
                                           DownloadMapperExt downloadMapper) {
        this.organizationMapper = organizationMapper;
        this.roleMapper = roleMapper;
        this.membershipMapper = membershipMapper;
        this.userRoleMapper = userRoleMapper;
        this.resourcePermissionMapper = resourcePermissionMapper;
        this.viewColumnPermissionMapper = viewColumnPermissionMapper;
        this.variablePermissionMapper = variablePermissionMapper;
        this.sourceMapper = sourceMapper;
        this.viewMapper = viewMapper;
        this.datachartMapper = datachartMapper;
        this.dashboardMapper = dashboardMapper;
        this.folderMapper = folderMapper;
        this.sourceService = sourceService;
        this.viewService = viewService;
        this.datachartService = datachartService;
        this.dashboardService = dashboardService;
        this.folderService = folderService;
        this.fileService = fileService;
        this.downloadMapper = downloadMapper;
    }

    @Override
    public OrganizationTransferModel buildPackage(String orgId) {
        securityManager.requireOrgOwner(orgId);
        Organization organization = organizationMapper.selectByPrimaryKey(orgId);
        if (organization == null) {
            throw new IllegalArgumentException("Organization does not exist: " + orgId);
        }

        OrganizationTransferModel model = new OrganizationTransferModel();
        model.setOrgId(orgId);
        model.setOrganization(toOrganizationModel(organization));
        model.setUsers(organizationMapper.listOrgMembers(orgId).stream()
                .map(this::toUserModel)
                .collect(Collectors.toList()));
        model.setMemberships(membershipMapper.listByOrgId(orgId).stream()
                .map(this::toMembershipModel)
                .collect(Collectors.toList()));
        model.setRoles(roleMapper.listAllByOrgId(orgId).stream()
                .map(this::toRoleModel)
                .collect(Collectors.toList()));
        model.setUserRoles(userRoleMapper.listByOrgId(orgId).stream()
                .map(this::toUserRoleModel)
                .collect(Collectors.toList()));
        model.setResources(exportResources(orgId));
        model.setPermissions(exportPermissions(orgId));
        model.setOwnership(exportOwnership(model.getResources()));
        return model;
    }

    @Override
    public Download exportPackage(String orgId) {
        securityManager.requireOrgOwner(orgId);
        String username = getCurrentUser().getUsername();
        Download download = new Download();
        download.setId(UUIDGenerator.generate());
        download.setCreateBy(getCurrentUser().getId());
        download.setCreateTime(new Date());
        download.setStatus((byte) 0);
        String path = fileService.getBasePath(FileOwner.EXPORT, null)
                + "/organization-" + System.currentTimeMillis()
                + TransferFileType.DATART_ORGANIZATION_FILE.getSuffix();
        download.setPath(path);
        download.setName(new File(path).getName());
        downloadMapper.insert(download);
        TaskExecutor.submit(() -> {
            securityManager.runAs(username);
            try {
                TransferFileUtils.write(buildPackage(orgId), path);
                download.setStatus((byte) 1);
            } catch (Exception e) {
                download.setStatus((byte) -1);
                log.error("organization package export failed", e);
            } finally {
                download.setUpdateTime(new Date());
                downloadMapper.updateByPrimaryKey(download);
                securityManager.releaseRunAs();
            }
        });
        return download;
    }

    private OrganizationPermissionsModel exportPermissions(String orgId) {
        OrganizationPermissionsModel permissions = new OrganizationPermissionsModel();
        permissions.setResources(resourcePermissionMapper.listByOrgId(orgId).stream()
                .map(this::toResourcePermissionModel)
                .collect(Collectors.toList()));
        permissions.setViewColumns(viewColumnPermissionMapper.listByOrgId(orgId).stream()
                .map(this::toViewColumnPermissionModel)
                .collect(Collectors.toList()));
        // Variable values are intentionally omitted from V1. The relationship
        // metadata is exported, but plaintext variable values need a separate
        // security policy before they can be migrated.
        permissions.setVariables(variablePermissionMapper.listByOrgId(orgId).stream()
                .map(this::toVariablePermissionModel)
                .collect(Collectors.toList()));
        return permissions;
    }

    private ResourceModel exportResources(String orgId) {
        TransferConfig config = TransferConfig.builder().withParents(true).build();
        ResourceModel resources = new ResourceModel();
        resources.setOrgId(orgId);

        Set<String> dashboardIds = dashboardMapper.listByOrgId(orgId).stream()
                .map(Dashboard::getId).collect(Collectors.toSet());
        Set<String> datachartIds = datachartMapper.listByOrgId(orgId).stream()
                .map(Datachart::getId).collect(Collectors.toSet());
        Set<String> viewIds = viewMapper.listByOrgId(orgId).stream()
                .map(View::getId).collect(Collectors.toSet());
        Set<String> sourceIds = sourceMapper.listByOrg(orgId, true).stream()
                .map(Source::getId).collect(Collectors.toSet());
        Set<String> folderIds = folderMapper.selectByOrg(orgId).stream()
                .map(Folder::getId).collect(Collectors.toSet());

        if (!dashboardIds.isEmpty()) {
            DashboardResourceModel dashboardModel = dashboardService.exportResource(config, dashboardIds);
            resources.setDashboardResourceModel(dashboardModel);
            datachartIds.addAll(dashboardModel.getDatacharts());
            viewIds.addAll(dashboardModel.getViews());
            addAll(folderIds, dashboardModel.getParents());
        }
        if (!datachartIds.isEmpty()) {
            DatachartResourceModel datachartModel = datachartService.exportResource(config, datachartIds);
            resources.setDatachartResourceModel(datachartModel);
            viewIds.addAll(datachartModel.getViews());
            addAll(folderIds, datachartModel.getParents());
        }
        if (!viewIds.isEmpty()) {
            var viewModel = viewService.exportResource(config, viewIds);
            resources.setViewResourceModel(viewModel);
            sourceIds.addAll(viewModel.getSources());
        }
        if (!sourceIds.isEmpty()) {
            resources.setSourceResourceModel(sourceService.exportResource(config, sourceIds));
        }
        if (!folderIds.isEmpty()) {
            resources.setFolderTransferModel(folderService.exportResource(config, folderIds));
        }
        return resources;
    }

    private List<OrganizationOwnershipModel> exportOwnership(ResourceModel resources) {
        List<OrganizationOwnershipModel> ownership = new ArrayList<>();
        if (resources == null) {
            return ownership;
        }
        if (resources.getSourceResourceModel() != null
                && resources.getSourceResourceModel().getMainModels() != null) {
            resources.getSourceResourceModel().getMainModels().forEach(main ->
                    addOwnership(ownership, ResourceType.SOURCE.name(), main.getSource()));
        }
        if (resources.getViewResourceModel() != null
                && resources.getViewResourceModel().getMainModels() != null) {
            resources.getViewResourceModel().getMainModels().forEach(main ->
                    addOwnership(ownership, ResourceType.VIEW.name(), main.getView()));
        }
        if (resources.getDatachartResourceModel() != null
                && resources.getDatachartResourceModel().getMainModels() != null) {
            resources.getDatachartResourceModel().getMainModels().forEach(main ->
                    addOwnership(ownership, ResourceType.DATACHART.name(), main.getDatachart()));
        }
        if (resources.getDashboardResourceModel() != null
                && resources.getDashboardResourceModel().getMainModels() != null) {
            resources.getDashboardResourceModel().getMainModels().forEach(main ->
                    addOwnership(ownership, ResourceType.DASHBOARD.name(), main.getDashboard()));
        }
        return ownership;
    }

    private void addOwnership(List<OrganizationOwnershipModel> ownership,
                              String resourceType,
                              BaseEntity resource) {
        if (resource == null) {
            return;
        }
        OrganizationOwnershipModel item = new OrganizationOwnershipModel();
        item.setResourceType(resourceType);
        item.setSourceResourceId(resource.getId());
        item.setSourceCreateBy(resource.getCreateBy());
        item.setSourceUpdateBy(resource.getUpdateBy());
        ownership.add(item);
    }

    private OrganizationTransferOrganizationModel toOrganizationModel(Organization source) {
        OrganizationTransferOrganizationModel target = new OrganizationTransferOrganizationModel();
        target.setSourceId(source.getId());
        target.setName(source.getName());
        target.setAvatar(source.getAvatar());
        target.setDescription(source.getDescription());
        return target;
    }

    private OrganizationUserModel toUserModel(User source) {
        OrganizationUserModel target = new OrganizationUserModel();
        target.setSourceId(source.getId());
        target.setUsername(source.getUsername());
        target.setEmail(source.getEmail());
        target.setName(source.getName());
        target.setDescription(source.getDescription());
        target.setAvatar(source.getAvatar());
        target.setActive(source.getActive());
        return target;
    }

    private OrganizationMembershipModel toMembershipModel(RelUserOrganization source) {
        OrganizationMembershipModel target = new OrganizationMembershipModel();
        target.setSourceOrgId(source.getOrgId());
        target.setSourceUserId(source.getUserId());
        return target;
    }

    private OrganizationRoleModel toRoleModel(Role source) {
        OrganizationRoleModel target = new OrganizationRoleModel();
        target.setSourceId(source.getId());
        target.setSourceOrgId(source.getOrgId());
        target.setName(source.getName());
        target.setType(source.getType());
        target.setDescription(source.getDescription());
        target.setAvatar(source.getAvatar());
        return target;
    }

    private OrganizationUserRoleModel toUserRoleModel(RelRoleUser source) {
        OrganizationUserRoleModel target = new OrganizationUserRoleModel();
        target.setSourceUserId(source.getUserId());
        target.setSourceRoleId(source.getRoleId());
        return target;
    }

    private OrganizationResourcePermissionModel toResourcePermissionModel(RelRoleResource source) {
        OrganizationResourcePermissionModel target = new OrganizationResourcePermissionModel();
        target.setSourceOrgId(source.getOrgId());
        target.setSourceRoleId(source.getRoleId());
        target.setSourceResourceId(source.getResourceId());
        target.setResourceType(source.getResourceType());
        target.setPermission(source.getPermission());
        return target;
    }

    private OrganizationViewColumnPermissionModel toViewColumnPermissionModel(RelSubjectColumns source) {
        OrganizationViewColumnPermissionModel target = new OrganizationViewColumnPermissionModel();
        target.setSourceViewId(source.getViewId());
        target.setSourceSubjectId(source.getSubjectId());
        target.setSubjectType(source.getSubjectType());
        target.setColumnPermission(source.getColumnPermission());
        return target;
    }

    private OrganizationVariablePermissionModel toVariablePermissionModel(RelVariableSubject source) {
        OrganizationVariablePermissionModel target = new OrganizationVariablePermissionModel();
        target.setSourceVariableId(source.getVariableId());
        target.setSourceSubjectId(source.getSubjectId());
        target.setSubjectType(source.getSubjectType());
        target.setUseDefaultValue(source.getUseDefaultValue());
        return target;
    }

    private static void addAll(Set<String> target, Collection<String> values) {
        if (values != null) {
            target.addAll(values);
        }
    }
}
