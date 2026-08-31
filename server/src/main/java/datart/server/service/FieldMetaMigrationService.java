package datart.server.service;

import datart.server.base.dto.FieldMetaMigrationRequest;
import datart.server.base.dto.FieldMetaMigrationResult;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.base.dto.FieldMetaMigrationVerify;

public interface FieldMetaMigrationService {
    FieldMetaMigrationScan scan(String orgId);

    FieldMetaMigrationResult migrate(FieldMetaMigrationRequest request);

    FieldMetaMigrationVerify verify(String orgId);

    FieldMetaMigrationResult rollback(String runId);
}
