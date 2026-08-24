package datart.server.base.transfer.model.organization;

import lombok.Data;

@Data
public class OrganizationResourcePermissionModel {

    private String sourceOrgId;

    private String sourceRoleId;

    private String sourceResourceId;

    private String resourceType;

    private Integer permission;
}
