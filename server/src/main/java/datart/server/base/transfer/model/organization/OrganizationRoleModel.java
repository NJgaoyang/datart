package datart.server.base.transfer.model.organization;

import lombok.Data;

@Data
public class OrganizationRoleModel {

    private String sourceId;

    private String sourceOrgId;

    private String name;

    private String type;

    private String description;

    private String avatar;
}
