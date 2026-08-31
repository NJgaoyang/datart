package datart.server.base.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class FieldMetaMigrationIssue {
    private String entityType;
    private String entityId;
    private String resourceName;
    private String fieldKey;
    private String reason;
    private String detail;
    private FieldMetaMigrationIssueSeverity severity;
    private String viewType;
    private String path;
    private String rawName;
    private String columnDisplayName;
    private String columnComment;
    private String hierarchyDisplayName;
    private String hierarchyComment;
    private String schemaComment;

    public FieldMetaMigrationIssue(String entityType, String entityId, String resourceName,
                                   String fieldKey, String reason, String detail) {
        this.entityType = entityType;
        this.entityId = entityId;
        this.resourceName = resourceName;
        this.fieldKey = fieldKey;
        this.reason = reason;
        this.detail = detail;
        this.severity = FieldMetaMigrationIssueSeverity.BLOCKING;
    }

    public FieldMetaMigrationIssue(String entityType, String entityId, String resourceName,
                                   String fieldKey, String reason, String detail,
                                   FieldMetaMigrationIssueSeverity severity) {
        this(entityType, entityId, resourceName, fieldKey, reason, detail);
        this.severity = severity;
    }
}
