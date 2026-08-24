package datart.server.base.dto;

import lombok.Data;

@Data
public class MetadataUpgradeInvariantReport {

    private boolean identityChecksumMatched;
    private boolean passwordChecksumMatched;
    private boolean permissionChecksumMatched;
    private boolean resourceIdChecksumMatched;
    private boolean viewFieldIdsStable;
}
