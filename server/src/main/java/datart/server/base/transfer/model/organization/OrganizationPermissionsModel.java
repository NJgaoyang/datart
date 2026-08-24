package datart.server.base.transfer.model.organization;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class OrganizationPermissionsModel {

    private List<OrganizationResourcePermissionModel> resources = new ArrayList<>();

    private List<OrganizationViewColumnPermissionModel> viewColumns = new ArrayList<>();

    private List<OrganizationVariablePermissionModel> variables = new ArrayList<>();
}
