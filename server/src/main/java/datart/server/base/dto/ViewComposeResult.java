package datart.server.base.dto;

import lombok.AllArgsConstructor;
import lombok.Data;

@Data
@AllArgsConstructor
public class ViewComposeResult {
    private String sourceId;
    private String script;
    private String config;
}
