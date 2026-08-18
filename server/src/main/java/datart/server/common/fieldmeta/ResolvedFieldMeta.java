package datart.server.common.fieldmeta;

import java.util.List;

public record ResolvedFieldMeta(
        String fieldKey,
        List<String> path,
        String rawName,
        String comment,
        String customDisplayName,
        boolean displayNameCustom,
        Status status,
        String reason,
        FieldMetaDiagnostics diagnostics) {

    public ResolvedFieldMeta(String fieldKey, List<String> path, String rawName, String comment,
                             String customDisplayName, boolean displayNameCustom,
                             Status status, String reason) {
        this(fieldKey, path, rawName, comment, customDisplayName, displayNameCustom, status, reason, null);
    }

    public enum Status {
        ALREADY_FORMAL_CUSTOM,
        FALLBACK_CONFIDENT,
        CUSTOM_CONFIDENT,
        COMMENT_RECOVERED_FROM_SCHEMA,
        AMBIGUOUS
    }
}
