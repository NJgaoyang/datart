package datart.server.common.readiness;

public final class ReadinessIssueCode {

    public static final String VIEW_SOURCE_NOT_FOUND = "VIEW_SOURCE_NOT_FOUND";
    public static final String VIEW_MODEL_INVALID = "VIEW_MODEL_INVALID";
    public static final String VIEW_MODEL_UNRECONCILABLE = "VIEW_MODEL_UNRECONCILABLE";
    public static final String VIEW_LEGACY_SQL_PATH = "VIEW_LEGACY_SQL_PATH";
    public static final String VIEW_LEGACY_MODEL_METADATA = "VIEW_LEGACY_MODEL_METADATA";
    public static final String VIEW_SCHEMA_INVALID = "VIEW_SCHEMA_INVALID";
    public static final String VIEW_SCHEMA_REFERENCE_NOT_FOUND = "VIEW_SCHEMA_REFERENCE_NOT_FOUND";
    public static final String VIEW_FIELD_MISSING = "VIEW_FIELD_MISSING";
    public static final String VIEW_FIELD_ORPHAN = "VIEW_FIELD_ORPHAN";
    public static final String VIEW_FIELD_ID_MISSING = "VIEW_FIELD_ID_MISSING";
    public static final String VIEW_FIELD_ID_DUPLICATE = "VIEW_FIELD_ID_DUPLICATE";
    public static final String VIEW_FIELD_ID_MISMATCH = "VIEW_FIELD_ID_MISMATCH";
    public static final String VIEW_FIELD_TYPE_MISMATCH = "VIEW_FIELD_TYPE_MISMATCH";
    public static final String VIEW_FIELD_METADATA_MISMATCH = "VIEW_FIELD_METADATA_MISMATCH";
    public static final String DATACHART_VIEW_NOT_FOUND = "DATACHART_VIEW_NOT_FOUND";
    public static final String DATACHART_FIELD_ID_MISSING = "DATACHART_FIELD_ID_MISSING";
    public static final String DATACHART_FIELD_NOT_FOUND = "DATACHART_FIELD_NOT_FOUND";
    public static final String DATACHART_FIELD_VIEW_MISMATCH = "DATACHART_FIELD_VIEW_MISMATCH";
    public static final String DATACHART_FIELD_INACTIVE = "DATACHART_FIELD_INACTIVE";
    public static final String DATACHART_LEGACY_FIELD_REFERENCE = "DATACHART_LEGACY_FIELD_REFERENCE";
    public static final String DATACHART_CONFIG_INVALID = "DATACHART_CONFIG_INVALID";
    public static final String DATACHART_COMPUTED_FIELD_INVALID = "DATACHART_COMPUTED_FIELD_INVALID";
    public static final String DASHBOARD_CONFIG_INVALID = "DASHBOARD_CONFIG_INVALID";
    public static final String DASHBOARD_DATACHART_NOT_FOUND = "DASHBOARD_DATACHART_NOT_FOUND";
    public static final String DASHBOARD_WIDGET_RESOURCE_NOT_FOUND = "DASHBOARD_WIDGET_RESOURCE_NOT_FOUND";
    public static final String DASHBOARD_LEGACY_REFERENCE = "DASHBOARD_LEGACY_REFERENCE";

    private ReadinessIssueCode() {
    }
}
