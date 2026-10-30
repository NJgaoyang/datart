package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;

/**
 * Removes redundant View.model presentation markers from V2 resource exports.
 * Canonical names and comments are projected into a legacy-readable model by
 * ViewFieldService before sanitizing. Its import-only metadata snapshot is kept
 * so explicit nulls and computed annotations survive a resource round trip.
 */
public final class ViewModelExportSanitizer {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private ViewModelExportSanitizer() {
    }

    public static String sanitize(String model) {
        if (model == null || model.isBlank()) {
            return model;
        }
        try {
            JsonNode root = MAPPER.readTree(model);
            stripFieldMap(root == null ? null : root.get("columns"));
            stripFieldMap(root == null ? null : root.get("hierarchy"));
            return MAPPER.writeValueAsString(root);
        } catch (Exception ignored) {
            return model;
        }
    }

    private static void stripFieldMap(JsonNode fields) {
        if (fields == null || !fields.isObject()) {
            return;
        }
        fields.fields().forEachRemaining(entry -> stripField(entry.getKey(), entry.getValue()));
    }

    private static void stripField(String fallbackName, JsonNode node) {
        if (node == null || !node.isObject()) {
            return;
        }
        ObjectNode field = (ObjectNode) node;
        String name = fieldName(fallbackName, field);
        String displayName = text(field.get("displayName"));
        String comment = text(field.get("comment"));
        boolean custom = field.path("isDisplayNameCustom").isBoolean()
                ? field.get("isDisplayNameCustom").asBoolean()
                : displayName != null && !displayName.equals(name) && !displayName.equals(comment);

        field.remove("isDisplayNameCustom");
        if (!custom) {
            field.remove("displayName");
        }
        JsonNode children = field.get("children");
        if (children != null && children.isArray()) {
            children.forEach(child -> stripField(name, child));
        }
    }

    private static String fieldName(String fallback, ObjectNode field) {
        JsonNode name = field.get("name");
        if (name != null && name.isArray() && !name.isEmpty()) {
            return name.get(name.size() - 1).asText(fallback);
        }
        return name == null ? fallback : name.asText(fallback);
    }

    private static String text(JsonNode node) {
        if (node == null || node.isNull()) {
            return null;
        }
        String value = node.asText();
        return value == null || value.isBlank() ? null : value;
    }
}
