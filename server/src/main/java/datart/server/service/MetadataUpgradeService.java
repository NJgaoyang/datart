package datart.server.service;

import datart.server.base.dto.MetadataUpgradeApplyReport;

public interface MetadataUpgradeService {

    MetadataUpgradeApplyReport apply(String orgId);
}
