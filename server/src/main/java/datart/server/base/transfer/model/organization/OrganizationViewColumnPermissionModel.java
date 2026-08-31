package datart.server.base.transfer.model.organization;

import lombok.Data;

@Data
public class OrganizationViewColumnPermissionModel {

    private String sourceViewId;

    private String sourceSubjectId;

    private String subjectType;

    private String columnPermission;
}
