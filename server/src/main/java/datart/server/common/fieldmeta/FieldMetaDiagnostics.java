package datart.server.common.fieldmeta;

import com.fasterxml.jackson.annotation.JsonInclude;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record FieldMetaDiagnostics(
        String viewType,
        String path,
        String rawName,
        String columnDisplayName,
        String columnComment,
        String hierarchyDisplayName,
        String hierarchyComment,
        String schemaComment) {
}
