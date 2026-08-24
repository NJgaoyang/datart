package datart.server.base.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class MetadataUpgradeIssue {

    private ReadinessSeverity severity;

    private String code;

    private String resourceType;

    private String resourceId;

    private String message;
}
