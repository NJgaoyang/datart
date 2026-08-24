package datart.server.common.metadata;

import java.util.List;

public final class MetadataUpgradeTablePolicy {

    public static final List<String> IMMUTABLE_IDENTITY_SECURITY_TABLES = List.of(
            "organization",
            "user",
            "rel_user_organization",
            "role",
            "rel_role_user",
            "rel_role_resource",
            "rel_subject_columns",
            "rel_variable_subject"
    );

    public static final List<String> IMMUTABLE_RESOURCE_ID_TABLES = List.of(
            "source",
            "view",
            "view_field",
            "datachart",
            "dashboard",
            "folder"
    );

    public static final List<String> IN_PLACE_UPGRADABLE_RESOURCE_TABLES = List.of(
            "view",
            "view_field",
            "datachart",
            "dashboard"
    );

    private MetadataUpgradeTablePolicy() {
    }
}
