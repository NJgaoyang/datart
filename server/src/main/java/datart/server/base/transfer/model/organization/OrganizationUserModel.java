package datart.server.base.transfer.model.organization;

import lombok.Data;

@Data
public class OrganizationUserModel {

    private String sourceId;

    private String username;

    private String email;

    private String name;

    private String description;

    private String avatar;

    private Boolean active;
}
