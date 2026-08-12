package datart.server.base.params;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;

@Data
public class WechatMiniAppTokenParam {

    @NotBlank(message = "Mobile cannot be empty")
    private String mobile;

    @NotBlank(message = "Timestamp cannot be empty")
    private String timestamp;

    @NotBlank(message = "Sign cannot be empty")
    private String sign;

    private String redirectUrl;
}
