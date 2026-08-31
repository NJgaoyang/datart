package datart.server.base.dto;

import datart.core.base.consts.MigrationMode;
import lombok.Data;

@Data
public class MigrationModeStatus {

    private String orgId;

    private MigrationMode mode;

    private ReadinessReport readiness;
}
