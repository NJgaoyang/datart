package datart.server.service;

import datart.server.base.dto.HistoryMigrationPreview;

public interface HistoryMigrationService {

    HistoryMigrationPreview preview(String orgId);
}
