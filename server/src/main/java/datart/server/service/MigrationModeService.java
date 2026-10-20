package datart.server.service;

import datart.core.base.consts.MigrationMode;

public interface MigrationModeService {

    MigrationMode getMode(String orgId);
}
