package datart.server.service;

import datart.server.base.dto.MetadataUpgradePreflightReport;

public interface MetadataUpgradePreflightService {

    MetadataUpgradePreflightReport preflight(String orgId);
}
