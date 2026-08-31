package datart.server.base.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class ReadinessIssue {
    private String resourceType;
    private String resourceId;
    private String resourceName;
    private ReadinessSeverity severity;
    private String code;
    private String message;
}
