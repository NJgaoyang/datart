package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.base.consts.Const;
import datart.core.base.consts.MigrationMode;
import datart.core.base.exception.Exceptions;
import datart.core.base.exception.NotAllowedException;
import datart.core.entity.Organization;
import datart.core.mappers.ext.DatachartMapperExt;
import datart.core.mappers.ext.DashboardMapperExt;
import datart.core.mappers.ext.RelWidgetElementMapperExt;
import datart.core.mappers.ext.SourceMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.core.mappers.ext.ViewMapperExt;
import datart.core.mappers.ext.WidgetMapperExt;
import datart.core.mappers.ext.OrganizationMapperExt;
import datart.security.util.PermissionHelper;
import datart.server.base.dto.ReadinessReport;
import datart.server.base.dto.MigrationModeStatus;
import datart.server.base.params.MigrationModeUpdateParam;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.StrictJson;
import datart.server.common.readiness.ReadinessScanner;
import datart.server.service.BaseService;
import datart.server.service.MigrationModeService;
import datart.server.service.ReadinessService;
import org.springframework.stereotype.Service;

@Service
public class ReadinessServiceImpl extends BaseService implements ReadinessService {

    private final ReadinessScanner scanner;
    private final OrganizationMapperExt organizationMapper;
    private final MigrationModeService migrationModeService;

    public ReadinessServiceImpl(ViewMapperExt viewMapper,
                                ViewFieldMapperExt viewFieldMapper,
                                SourceMapperExt sourceMapper,
                                SourceSchemaIndex schemaIndex,
                                StrictJson strictJson,
                                ObjectMapper objectMapper,
                                DatachartMapperExt datachartMapper,
                                DashboardMapperExt dashboardMapper,
                                WidgetMapperExt widgetMapper,
                                RelWidgetElementMapperExt widgetElementMapper,
                                OrganizationMapperExt organizationMapper,
                                MigrationModeService migrationModeService) {
        this.organizationMapper = organizationMapper;
        this.migrationModeService = migrationModeService;
        this.scanner = new ReadinessScanner(viewMapper, viewFieldMapper, sourceMapper,
                schemaIndex, strictJson, objectMapper, datachartMapper, dashboardMapper,
                widgetMapper, widgetElementMapper);
    }

    @Override
    public ReadinessReport scan(String orgId) {
        requireManage(orgId);
        return scanner.scan(orgId);
    }

    public MigrationModeStatus getMode(String orgId) {
        requireManage(orgId);
        Organization organization = organizationMapper.selectByPrimaryKey(orgId);
        if (organization == null) {
            Exceptions.notFound("organization");
        }
        return status(organization, null);
    }

    public MigrationModeStatus updateMode(MigrationModeUpdateParam param) {
        requireManage(param.getOrgId());
        Organization organization = organizationMapper.selectByPrimaryKey(param.getOrgId());
        if (organization == null) {
            Exceptions.notFound("organization");
        }

        ReadinessReport readiness = null;
        if (param.getMode() == MigrationMode.STRICT) {
            readiness = scanner.scan(param.getOrgId());
            if (!isStrictReady(readiness)) {
                throw new NotAllowedException("STRICT_ENABLE_BLOCKED: readiness is not 100% or has unresolved field references");
            }
        }
        organization.setMigrationMode(param.getMode());
        organizationMapper.updateByPrimaryKeySelective(organization);
        return status(organization, readiness);
    }

    private void requireManage(String orgId) {
        securityManager.requireAllPermissions(PermissionHelper.rolePermission(orgId, Const.MANAGE));
    }

    private MigrationModeStatus status(Organization organization, ReadinessReport readiness) {
        MigrationModeStatus status = new MigrationModeStatus();
        status.setOrgId(organization.getId());
        status.setMode(migrationModeService.getMode(organization.getId()));
        status.setReadiness(readiness);
        return status;
    }

    static boolean isStrictReady(ReadinessReport report) {
        return report != null
                && report.getBlockers() == 0
                && report.isStrictEligible()
                && report.getReadiness() == 100D
                && report.getChartFieldIdCoverage() == 100D
                && report.getResolvedChartFieldIdCoverage() == 100D;
    }
}
