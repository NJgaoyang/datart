package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class MetadataUpgradeApplyReport {

    private boolean success;
    private boolean noOp;
    private String orgId;
    private String status;
    private String message;
    private MetadataUpgradeChangeCounts changes = new MetadataUpgradeChangeCounts();
    private MetadataUpgradeInvariantReport invariants = new MetadataUpgradeInvariantReport();
    private MetadataIntegritySnapshot beforeSnapshot;
    private MetadataIntegritySnapshot afterSnapshot;
    private ReadinessReport readiness;
    private List<String> modifiedTables = new ArrayList<>();
    private List<String> modifiedFields = new ArrayList<>();
}
