package datart.server.base.dto;

import lombok.Data;

import java.util.List;

@Data
public class ViewFieldDTO {

    private String fieldId;

    private String originName;

    private String sourceComment;

    private String customName;

    private String displayName;

    private List<String> sourcePath;

    private String type;

    private String category;

    private String expression;

    private Boolean active;
}
