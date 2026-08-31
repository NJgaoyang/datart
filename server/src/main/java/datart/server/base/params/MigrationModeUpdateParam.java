package datart.server.base.params;

import datart.core.base.consts.MigrationMode;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class MigrationModeUpdateParam {

    @NotBlank
    private String orgId;

    @NotNull
    private MigrationMode mode;
}
