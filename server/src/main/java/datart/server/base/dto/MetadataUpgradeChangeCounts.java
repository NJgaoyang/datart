package datart.server.base.dto;

import lombok.Data;

@Data
public class MetadataUpgradeChangeCounts {

    private int views;
    private int viewFieldsReconciled;
    private int viewFieldsCreated;
    private int widgets;
    private int datacharts;
    private int dashboards;
}
