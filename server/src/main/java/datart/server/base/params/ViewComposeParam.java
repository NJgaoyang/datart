package datart.server.base.params;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import java.util.List;

@Data
public class ViewComposeParam {

    @NotBlank
    private String leftViewId;

    @NotBlank
    private String rightViewId;

    @NotBlank
    private String joinType;

    @NotEmpty
    private List<JoinCondition> conditions;

    @Data
    public static class JoinCondition {
        @NotBlank
        private String leftColumn;

        @NotBlank
        private String rightColumn;
    }
}
