package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class MetadataUpgradePreflightReport {

    private String orgId;

    private boolean readOnly = true;

    private boolean applyAllowed;

    private int blockers;

    private int warnings;

    private MetadataUpgradeCounts counts = new MetadataUpgradeCounts();

    private MetadataIntegritySnapshot snapshot = new MetadataIntegritySnapshot();

    private List<MetadataUpgradeIssue> issues = new ArrayList<>();
}
