package datart.server.service;

import datart.server.base.dto.ReadinessReport;
import datart.server.base.dto.MigrationModeStatus;
import datart.server.base.params.MigrationModeUpdateParam;

public interface ReadinessService {

    ReadinessReport scan(String orgId);

    MigrationModeStatus getMode(String orgId);

    MigrationModeStatus updateMode(MigrationModeUpdateParam param);
}
