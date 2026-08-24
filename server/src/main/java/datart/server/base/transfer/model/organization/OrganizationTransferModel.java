package datart.server.base.transfer.model.organization;

import datart.server.base.transfer.model.ResourceModel;
import datart.server.base.transfer.model.TransferModel;
import lombok.Data;

import java.util.ArrayList;
import java.util.List;

/**
 * The V1 organization package. It deliberately contains transfer DTOs instead
 * of database entities so authentication secrets cannot leak into the package.
 */
@Data
public class OrganizationTransferModel extends TransferModel {

    public static final String PACKAGE_TYPE = "ORGANIZATION";

    public static final int FORMAT_VERSION = 1;

    private OrganizationTransferOrganizationModel organization;

    private List<OrganizationUserModel> users = new ArrayList<>();

    private List<OrganizationMembershipModel> memberships = new ArrayList<>();

    private List<OrganizationRoleModel> roles = new ArrayList<>();

    private List<OrganizationUserRoleModel> userRoles = new ArrayList<>();

    private ResourceModel resources;

    private OrganizationPermissionsModel permissions = new OrganizationPermissionsModel();

    private List<OrganizationOwnershipModel> ownership = new ArrayList<>();

    @Override
    public String getPackageType() {
        return PACKAGE_TYPE;
    }

    @Override
    public int getFormatVersion() {
        return FORMAT_VERSION;
    }

    @Override
    public String getVizName() {
        return "organization";
    }
}
