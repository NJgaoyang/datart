package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.base.consts.Const;
import datart.core.mappers.ext.DatachartMapperExt;
import datart.core.mappers.ext.DashboardMapperExt;
import datart.core.mappers.ext.RelWidgetElementMapperExt;
import datart.core.mappers.ext.SourceMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.core.mappers.ext.ViewMapperExt;
import datart.core.mappers.ext.WidgetMapperExt;
import datart.security.util.PermissionHelper;
import datart.server.base.dto.ReadinessReport;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.StrictJson;
import datart.server.common.readiness.ReadinessScanner;
import datart.server.service.BaseService;
import datart.server.service.ReadinessService;
import org.springframework.stereotype.Service;

@Service
public class ReadinessServiceImpl extends BaseService implements ReadinessService {

    private final ReadinessScanner scanner;

    public ReadinessServiceImpl(ViewMapperExt viewMapper,
                                ViewFieldMapperExt viewFieldMapper,
                                SourceMapperExt sourceMapper,
                                SourceSchemaIndex schemaIndex,
                                StrictJson strictJson,
                                ObjectMapper objectMapper,
                                DatachartMapperExt datachartMapper,
                                DashboardMapperExt dashboardMapper,
                                WidgetMapperExt widgetMapper,
                                RelWidgetElementMapperExt widgetElementMapper) {
        this.scanner = new ReadinessScanner(viewMapper, viewFieldMapper, sourceMapper,
                schemaIndex, strictJson, objectMapper, datachartMapper, dashboardMapper,
                widgetMapper, widgetElementMapper);
    }

    @Override
    public ReadinessReport scan(String orgId) {
        requireManage(orgId);
        return scanner.scan(orgId);
    }

    private void requireManage(String orgId) {
        securityManager.requireAllPermissions(PermissionHelper.rolePermission(orgId, Const.MANAGE));
    }

}