package datart.core.entity;

import lombok.Data;
import lombok.EqualsAndHashCode;

@Data
@EqualsAndHashCode(callSuper = true)
public class ViewField extends BaseEntity {

    private String viewId;

    private String canonicalKey;

    private String originName;

    private String sourceComment;

    private String customName;

    private String sourcePath;

    private String fieldType;

    private String fieldCategory;

    private String expression;

    private Integer ordinal;

    private Boolean active;
}
