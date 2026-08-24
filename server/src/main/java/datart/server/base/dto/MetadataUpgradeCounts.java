package datart.server.base.dto;

import lombok.Data;

@Data
public class MetadataUpgradeCounts {

    private int organizations;
    private int users;
    private int memberships;
    private int roles;
    private int userRoles;
    private int rolePermissions;
    private int views;
    private int viewFields;
    private int datacharts;
    private int dashboards;
    private int folders;
    private int sources;
    private int needUpgradeViews;
    private int needFieldIdRepair;
    private int needUpgradeDatacharts;
    private int needUpgradeDashboards;
}
