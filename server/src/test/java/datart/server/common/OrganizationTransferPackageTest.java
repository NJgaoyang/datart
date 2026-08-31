package datart.server.common;

import datart.server.base.transfer.model.ResourceModel;
import datart.server.base.transfer.model.organization.OrganizationMembershipModel;
import datart.server.base.transfer.model.organization.OrganizationPermissionsModel;
import datart.server.base.transfer.model.organization.OrganizationResourcePermissionModel;
import datart.server.base.transfer.model.organization.OrganizationRoleModel;
import datart.server.base.transfer.model.organization.OrganizationTransferModel;
import datart.server.base.transfer.model.organization.OrganizationTransferOrganizationModel;
import datart.server.base.transfer.model.organization.OrganizationUserModel;
import datart.server.base.transfer.model.organization.OrganizationUserRoleModel;
import datart.server.base.transfer.model.organization.OrganizationVariablePermissionModel;
import datart.server.base.transfer.model.organization.OrganizationViewColumnPermissionModel;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.GZIPInputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OrganizationTransferPackageTest {

    @Test
    void shouldRoundTripOrganizationPackageWithResourceModel() throws Exception {
        OrganizationTransferModel source = packageModel();
        Path file = Files.createTempFile("datart-organization", ".dor");
        try {
            TransferFileUtils.write(source, file.toString());

            TransferFileUtils.TransferReadResult result;
            try (InputStream input = Files.newInputStream(file)) {
                result = TransferFileUtils.readWithMetadata(input, 1024 * 1024);
            }

            assertEquals(OrganizationTransferModel.PACKAGE_TYPE, result.packageType());
            assertEquals(OrganizationTransferModel.FORMAT_VERSION, result.formatVersion());
            OrganizationTransferModel imported = (OrganizationTransferModel) result.model();
            assertEquals("old-org", imported.getOrganization().getSourceId());
            assertEquals("old-user", imported.getUsers().get(0).getSourceId());
            assertEquals("old-role", imported.getRoles().get(0).getSourceId());
            assertEquals("old-user", imported.getMemberships().get(0).getSourceUserId());
            assertEquals("old-role", imported.getUserRoles().get(0).getSourceRoleId());
            assertEquals("old-view", imported.getPermissions().getViewColumns().get(0).getSourceViewId());
            assertNotNull(imported.getResources());
            assertEquals("old-org", imported.getResources().getOrgId());
        } finally {
            Files.deleteIfExists(file);
        }
    }

    @Test
    void shouldWriteExplicitOrganizationPackageEnvelope() throws Exception {
        Path file = Files.createTempFile("datart-organization-envelope", ".dor");
        try {
            TransferFileUtils.write(packageModel(), file.toString());
            String json;
            try (GZIPInputStream input = new GZIPInputStream(Files.newInputStream(file));
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                input.transferTo(output);
                json = output.toString(StandardCharsets.UTF_8);
            }
            assertTrue(json.contains("\"packageType\":\"ORGANIZATION\""));
            assertTrue(json.contains("\"formatVersion\":1"));
        } finally {
            Files.deleteIfExists(file);
        }
    }

    @Test
    void shouldNotSerializeUserAuthenticationSecrets() throws Exception {
        Path file = Files.createTempFile("datart-organization-sensitive", ".dor");
        try {
            TransferFileUtils.write(packageModel(), file.toString());
            String json;
            try (GZIPInputStream input = new GZIPInputStream(Files.newInputStream(file));
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                input.transferTo(output);
                json = output.toString(StandardCharsets.UTF_8);
            }
            assertFalse(json.contains("password"));
            assertFalse(json.contains("passwordHash"));
            assertFalse(json.contains("salt"));
            assertFalse(json.contains("token"));
            assertFalse(json.contains("refreshToken"));
            assertFalse(json.contains("session"));
            assertFalse(json.contains("secret"));
            assertFalse(json.contains("\"value\""));
        } finally {
            Files.deleteIfExists(file);
        }
    }

    private static OrganizationTransferModel packageModel() {
        OrganizationTransferModel model = new OrganizationTransferModel();
        model.setOrgId("old-org");

        OrganizationTransferOrganizationModel organization = new OrganizationTransferOrganizationModel();
        organization.setSourceId("old-org");
        organization.setName("Sales");
        model.setOrganization(organization);

        OrganizationUserModel user = new OrganizationUserModel();
        user.setSourceId("old-user");
        user.setUsername("zhangsan");
        user.setEmail("zhangsan@example.com");
        user.setName("张三");
        user.setActive(true);
        model.getUsers().add(user);

        OrganizationMembershipModel membership = new OrganizationMembershipModel();
        membership.setSourceOrgId("old-org");
        membership.setSourceUserId("old-user");
        model.getMemberships().add(membership);

        OrganizationRoleModel role = new OrganizationRoleModel();
        role.setSourceId("old-role");
        role.setSourceOrgId("old-org");
        role.setName("Analyst");
        model.getRoles().add(role);

        OrganizationUserRoleModel userRole = new OrganizationUserRoleModel();
        userRole.setSourceUserId("old-user");
        userRole.setSourceRoleId("old-role");
        model.getUserRoles().add(userRole);

        OrganizationPermissionsModel permissions = model.getPermissions();
        OrganizationResourcePermissionModel resourcePermission = new OrganizationResourcePermissionModel();
        resourcePermission.setSourceOrgId("old-org");
        resourcePermission.setSourceRoleId("old-role");
        resourcePermission.setSourceResourceId("old-dashboard");
        resourcePermission.setResourceType("DASHBOARD");
        resourcePermission.setPermission(2);
        permissions.getResources().add(resourcePermission);

        OrganizationViewColumnPermissionModel columnPermission = new OrganizationViewColumnPermissionModel();
        columnPermission.setSourceViewId("old-view");
        columnPermission.setSourceSubjectId("old-role");
        columnPermission.setSubjectType("USER_ROLE");
        columnPermission.setColumnPermission("city");
        permissions.getViewColumns().add(columnPermission);

        OrganizationVariablePermissionModel variablePermission = new OrganizationVariablePermissionModel();
        variablePermission.setSourceVariableId("old-variable");
        variablePermission.setSourceSubjectId("old-role");
        variablePermission.setSubjectType("USER_ROLE");
        variablePermission.setUseDefaultValue(true);
        permissions.getVariables().add(variablePermission);

        ResourceModel resources = new ResourceModel();
        resources.setOrgId("old-org");
        model.setResources(resources);
        return model;
    }
}
