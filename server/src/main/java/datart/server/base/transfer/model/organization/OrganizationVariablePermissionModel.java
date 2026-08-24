package datart.server.base.transfer.model.organization;

import lombok.Data;

@Data
public class OrganizationVariablePermissionModel {

    private String sourceVariableId;

    private String sourceSubjectId;

    private String subjectType;

    private Boolean useDefaultValue;
}
