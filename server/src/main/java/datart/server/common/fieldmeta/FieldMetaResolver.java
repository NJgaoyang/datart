package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

public class FieldMetaResolver {

    public ResolvedFieldMeta resolve(String fieldKey, JsonNode column, JsonNode hierarchy,
                                     SourceSchemaIndex.Index schemaIndex) {
        return resolve(fieldKey, column, hierarchy, schemaIndex, null);
    }

    public ResolvedFieldMeta resolve(String fieldKey, JsonNode column, JsonNode hierarchy,
                                     SourceSchemaIndex.Index schemaIndex, String viewType) {
        JsonNode primary = column != null && !column.isMissingNode() ? column : hierarchy;
        List<String> path = path(primary);
        String rawName = rawName(primary, fieldKey);

        SourceSchemaIndex.ColumnMeta schemaColumn = schemaIndex == null ? null : schemaIndex.exact(path);
        String schemaComment = trim(schemaColumn == null ? null : schemaColumn.comment());
        String columnComment = text(column, "comment");
        String hierarchyComment = text(hierarchy, "comment");
        boolean struct = "STRUCT".equalsIgnoreCase(viewType);
        FieldMetaDiagnostics diagnostics = diagnostics(viewType, path, rawName, column, hierarchy, schemaComment);

        Boolean columnCustom = marker(column);
        Boolean hierarchyCustom = marker(hierarchy);
        String columnDisplay = text(column, "displayName");
        String hierarchyDisplay = text(hierarchy, "displayName");
        Set<String> explicitCustoms = new LinkedHashSet<>();
        if (Boolean.TRUE.equals(columnCustom)) {
            if (columnDisplay == null) {
                return ambiguous(fieldKey, path, rawName, viewType, "CUSTOM_DISPLAY_EMPTY",
                        column, hierarchy, schemaComment);
            }
            explicitCustoms.add(columnDisplay);
        }
        if (Boolean.TRUE.equals(hierarchyCustom)) {
            if (hierarchyDisplay == null) {
                return ambiguous(fieldKey, path, rawName, viewType, "CUSTOM_DISPLAY_EMPTY",
                        column, hierarchy, schemaComment);
            }
            explicitCustoms.add(hierarchyDisplay);
        }
        if (explicitCustoms.size() > 1) {
            return ambiguous(fieldKey, path, rawName, viewType, "CUSTOM_DISPLAY_DIVERGENCE",
                    column, hierarchy, schemaComment);
        }
        boolean hasTrue = Boolean.TRUE.equals(columnCustom) || Boolean.TRUE.equals(hierarchyCustom);
        boolean hasFalse = Boolean.FALSE.equals(columnCustom) || Boolean.FALSE.equals(hierarchyCustom);
        if (hasTrue && hasFalse) {
            return ambiguous(fieldKey, path, rawName, viewType, "CUSTOM_MARKER_DIVERGENCE",
                    column, hierarchy, schemaComment);
        }
        if (hasTrue) {
            String comment = canonicalComment(struct, schemaComment, columnComment, hierarchyComment);
            return new ResolvedFieldMeta(fieldKey, path, rawName, comment, explicitCustoms.iterator().next(), true,
                    ResolvedFieldMeta.Status.ALREADY_FORMAL_CUSTOM, "已有明确自定义名称", diagnostics);
        }
        if (hasFalse) {
            String comment = canonicalComment(struct, schemaComment, columnComment, hierarchyComment);
            return new ResolvedFieldMeta(fieldKey, path, rawName, comment, null, false,
                    struct && schemaComment != null ? ResolvedFieldMeta.Status.COMMENT_RECOVERED_FROM_SCHEMA : ResolvedFieldMeta.Status.FALLBACK_CONFIDENT,
                    "已有明确的非自定义标记", diagnostics);
        }

        Set<String> legacyCustoms = new LinkedHashSet<>();
        addLegacyCustom(legacyCustoms, columnDisplay, rawName, columnComment);
        addLegacyCustom(legacyCustoms, hierarchyDisplay, rawName, hierarchyComment);
        if (legacyCustoms.size() > 1) {
            return ambiguous(fieldKey, path, rawName, viewType, "LEGACY_CUSTOM_DIVERGENCE",
                    column, hierarchy, schemaComment);
        }
        if (!legacyCustoms.isEmpty()) {
            String comment = canonicalComment(struct, schemaComment, columnComment, hierarchyComment);
            return new ResolvedFieldMeta(fieldKey, path, rawName, comment, legacyCustoms.iterator().next(), true,
                    ResolvedFieldMeta.Status.CUSTOM_CONFIDENT, "历史自定义名称", diagnostics);
        }
        String comment = canonicalComment(struct, schemaComment, columnComment, hierarchyComment);
        return new ResolvedFieldMeta(fieldKey, path, rawName, comment, null, false,
                struct && schemaComment != null ? ResolvedFieldMeta.Status.COMMENT_RECOVERED_FROM_SCHEMA : ResolvedFieldMeta.Status.FALLBACK_CONFIDENT,
                "历史 fallback 或无自定义名称", diagnostics);
    }

    private static String canonicalComment(boolean struct, String schemaComment,
                                           String columnComment, String hierarchyComment) {
        if (struct && schemaComment != null) {
            return schemaComment;
        }
        return columnComment != null ? columnComment : hierarchyComment;
    }

    private static void addLegacyCustom(Set<String> customs, String display, String rawName, String comment) {
        if (display != null && !display.equals(rawName) && !display.equals(comment)) {
            customs.add(display);
        }
    }

    private static ResolvedFieldMeta ambiguous(String fieldKey, List<String> path, String rawName,
                                               String viewType, String reason, JsonNode column,
                                               JsonNode hierarchy, String schemaComment) {
        return new ResolvedFieldMeta(fieldKey, path, rawName, null, null, false,
                ResolvedFieldMeta.Status.AMBIGUOUS, reason,
                diagnostics(viewType, path, rawName, column, hierarchy, schemaComment));
    }

    private static FieldMetaDiagnostics diagnostics(String viewType, List<String> path, String rawName,
                                                    JsonNode column, JsonNode hierarchy, String schemaComment) {
        return new FieldMetaDiagnostics(
                viewType,
                path.isEmpty() ? null : String.join(".", path),
                rawName,
                text(column, "displayName"),
                text(column, "comment"),
                text(hierarchy, "displayName"),
                text(hierarchy, "comment"),
                schemaComment);
    }

    public static List<String> path(JsonNode node) {
        if (node == null || node.isMissingNode()) {
            return List.of();
        }
        JsonNode path = node.get("path");
        if (path != null && path.isArray()) {
            return strings(path);
        }
        JsonNode name = node.get("name");
        if (name != null && name.isArray()) {
            return strings(name);
        }
        return List.of();
    }

    private static List<String> strings(JsonNode node) {
        List<String> values = new ArrayList<>();
        node.forEach(value -> {
            if (value.isTextual() && !value.asText().isBlank()) {
                values.add(value.asText());
            }
        });
        return values;
    }

    private static String rawName(JsonNode node, String fallback) {
        List<String> path = path(node);
        if (!path.isEmpty()) {
            return path.get(path.size() - 1);
        }
        JsonNode name = node == null ? null : node.get("name");
        return name != null && name.isTextual() ? name.asText() : fallback;
    }

    private static Boolean marker(JsonNode node) {
        if (node == null || !node.has("isDisplayNameCustom")) {
            return null;
        }
        return node.get("isDisplayNameCustom").isBoolean() ? node.get("isDisplayNameCustom").asBoolean() : null;
    }

    private static String text(JsonNode node, String field) {
        return node == null || node.get(field) == null ? null : trim(node.get(field).asText(null));
    }

    private static String trim(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }
}
