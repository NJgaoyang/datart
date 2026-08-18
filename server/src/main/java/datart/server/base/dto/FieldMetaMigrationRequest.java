package datart.server.base.dto;

import lombok.Data;

@Data
public class FieldMetaMigrationRequest {
    private String orgId;
    private String expectedScanToken;
}
