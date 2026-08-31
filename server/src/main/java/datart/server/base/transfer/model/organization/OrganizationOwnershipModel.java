package datart.server.base.transfer.model.organization;

import lombok.Data;

@Data
public class OrganizationOwnershipModel {

    private String resourceType;

    private String sourceResourceId;

    private String sourceCreateBy;

    private String sourceUpdateBy;
}
