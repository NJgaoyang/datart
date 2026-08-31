package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.server.base.dto.FieldMetaMigrationIssueSeverity;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class ViewModelMigrator {

    private final FieldMetaResolver resolver = new FieldMetaResolver();

    public Result migrate(ObjectNode model, SourceSchemaIndex.Index schemaIndex) {
        return migrate(model, schemaIndex, null);
    }

    public Result migrate(ObjectNode model, SourceSchemaIndex.Index schemaIndex, String viewType) {
        ObjectNode result = model.deepCopy();
        Map<String, FieldReferences> nodes = new LinkedHashMap<>();
        collectReferences(result.path("columns"), nodes, ReferenceRole.COLUMN);
        collectReferences(result.path("hierarchy"), nodes, ReferenceRole.HIERARCHY);
        List<ResolvedFieldMeta> fields = new ArrayList<>();
        List<MigrationIssue> issues = new ArrayList<>();
        Set<String> sqlOutputNames = new HashSet<>();
        int changed = 0;
        for (Map.Entry<String, FieldReferences> entry : nodes.entrySet()) {
            FieldReferences refs = entry.getValue();
            List<ObjectNode> nodesForField = refs.nodes();
            ObjectNode column = refs.column();
            ObjectNode hierarchy = refs.hierarchy();
            if (nodesForField.size() > 2
                    && nodesForField.stream().anyMatch(node -> !sameMetadata(nodesForField.get(0), node))) {
                issues.add(new MigrationIssue("VIEW", entry.getKey(), entry.getKey(), "同一业务字段存在多份不一致元数据"));
                continue;
            }
            ResolvedFieldMeta resolved = resolver.resolve(entry.getKey(), column, hierarchy, schemaIndex, viewType);
            fields.add(resolved);
            if ("SQL".equalsIgnoreCase(viewType) && !sqlOutputNames.add(resolved.rawName())) {
                issues.add(new MigrationIssue("VIEW", entry.getKey(), entry.getKey(),
                        "SQL_OUTPUT_COLUMN_DUPLICATED", resolved.diagnostics(),
                        FieldMetaMigrationIssueSeverity.BLOCKING));
                continue;
            }
            if (commentDiverges(column, hierarchy, schemaIndex, resolved, viewType)) {
                issues.add(new MigrationIssue("VIEW", entry.getKey(), entry.getKey(),
                        "SQL_COMMENT_RESOLVED_FROM_COLUMNS", resolved.diagnostics(),
                        FieldMetaMigrationIssueSeverity.WARNING));
            }
            if (resolved.status() == ResolvedFieldMeta.Status.AMBIGUOUS) {
                issues.add(new MigrationIssue("VIEW", entry.getKey(), entry.getKey(), resolved.reason(),
                        resolved.diagnostics(), FieldMetaMigrationIssueSeverity.BLOCKING));
                continue;
            }
            for (ObjectNode node : nodesForField) {
                changed += apply(node, resolved);
            }
        }
        return new Result(result, fields, issues, changed);
    }

    public List<MigrationIssue> validateFormal(ObjectNode model) {
        Map<String, List<ObjectNode>> nodes = new LinkedHashMap<>();
        collect(model.path("columns"), nodes);
        collect(model.path("hierarchy"), nodes);
        List<MigrationIssue> issues = new ArrayList<>();
        nodes.forEach((key, refs) -> {
            String display = null;
            String comment = null;
            Boolean custom = null;
            for (ObjectNode node : refs) {
                String nodeDisplay = text(node, "displayName");
                String nodeComment = text(node, "comment");
                JsonNode marker = node.get("isDisplayNameCustom");
                if (marker == null || !marker.isBoolean()) {
                    issues.add(new MigrationIssue("VIEW", key, key, "缺少 isDisplayNameCustom"));
                    continue;
                }
                if (marker.asBoolean() && nodeDisplay == null) {
                    issues.add(new MigrationIssue("VIEW", key, key, "custom 字段 displayName 为空"));
                }
                if (!marker.asBoolean() && nodeDisplay != null) {
                    issues.add(new MigrationIssue("VIEW", key, key, "非 custom 字段仍包含 displayName"));
                }
                if (display == null) {
                    display = nodeDisplay;
                    comment = nodeComment;
                    custom = marker.asBoolean();
                } else if (!same(display, nodeDisplay) || !same(comment, nodeComment) || custom != marker.asBoolean()) {
                    issues.add(new MigrationIssue("VIEW", key, key, "columns/hierarchy 元数据不一致"));
                }
            }
        });
        return issues;
    }

    private static int apply(ObjectNode node, ResolvedFieldMeta resolved) {
        String before = node.toString();
        if (resolved.displayNameCustom()) {
            node.put("displayName", resolved.customDisplayName());
        } else {
            node.remove("displayName");
        }
        node.put("isDisplayNameCustom", resolved.displayNameCustom());
        if (resolved.comment() == null) {
            node.remove("comment");
        } else {
            node.put("comment", resolved.comment());
        }
        return before.equals(node.toString()) ? 0 : 1;
    }

    private static String text(ObjectNode node, String field) {
        if (node == null) {
            return null;
        }
        JsonNode value = node.get(field);
        if (value == null || value.isNull()) {
            return null;
        }
        String text = value.asText().trim();
        return text.isEmpty() ? null : text;
    }

    private static boolean same(String left, String right) {
        return left == null ? right == null : left.equals(right);
    }

    private static boolean sameMetadata(ObjectNode left, ObjectNode right) {
        return same(text(left, "displayName"), text(right, "displayName"))
                && same(text(left, "comment"), text(right, "comment"))
                && same(left.get("isDisplayNameCustom") == null ? null : left.get("isDisplayNameCustom").asText(),
                right.get("isDisplayNameCustom") == null ? null : right.get("isDisplayNameCustom").asText());
    }

    private static boolean commentDiverges(ObjectNode column, ObjectNode hierarchy,
                                           SourceSchemaIndex.Index schemaIndex, ResolvedFieldMeta resolved,
                                           String viewType) {
        String columnComment = text(column, "comment");
        String hierarchyComment = text(hierarchy, "comment");
        if (columnComment == null || hierarchyComment == null || columnComment.equals(hierarchyComment)) {
            return false;
        }
        if ("STRUCT".equalsIgnoreCase(viewType)) {
            SourceSchemaIndex.ColumnMeta schema = schemaIndex == null ? null : schemaIndex.exact(resolved.path());
            return schema == null || text(schema.comment()) == null;
        }
        return "SQL".equalsIgnoreCase(viewType);
    }

    private static String text(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private static void collect(JsonNode root, Map<String, List<ObjectNode>> nodes) {
        if (root == null || !root.isObject()) {
            return;
        }
        root.fields().forEachRemaining(entry -> collectNode(entry.getKey(), entry.getValue(), nodes));
    }

    private static void collectReferences(JsonNode root, Map<String, FieldReferences> nodes, ReferenceRole role) {
        if (root == null || !root.isObject()) {
            return;
        }
        root.fields().forEachRemaining(entry -> collectReferenceNode(entry.getKey(), entry.getValue(), nodes, role));
    }

    private static void collectReferenceNode(String key, JsonNode node, Map<String, FieldReferences> nodes,
                                             ReferenceRole role) {
        if (!node.isObject()) {
            return;
        }
        ObjectNode object = (ObjectNode) node;
        String fieldKey = keyOf(key, object);
        if (object.has("children") && object.get("children").isArray()) {
            object.get("children").forEach(child -> collectReferenceChild(fieldKey, child, nodes, role));
            return;
        }
        nodes.computeIfAbsent(fieldKey, ignored -> new FieldReferences()).add(role, object);
    }

    private static void collectReferenceChild(String parentKey, JsonNode child, Map<String, FieldReferences> nodes,
                                              ReferenceRole role) {
        if (!child.isObject()) {
            return;
        }
        ObjectNode object = (ObjectNode) child;
        String fieldKey = keyOf(parentKey, object);
        nodes.computeIfAbsent(fieldKey, ignored -> new FieldReferences()).add(role, object);
        if (object.has("children") && object.get("children").isArray()) {
            object.get("children").forEach(nested -> collectReferenceChild(fieldKey, nested, nodes, role));
        }
    }

    private static void collectNode(String key, JsonNode node, Map<String, List<ObjectNode>> nodes) {
        if (!node.isObject()) {
            return;
        }
        ObjectNode object = (ObjectNode) node;
        String fieldKey = keyOf(key, object);
        if (object.has("children") && object.get("children").isArray()) {
            object.get("children").forEach(child -> collectChild(fieldKey, child, nodes));
        } else {
            nodes.computeIfAbsent(fieldKey, ignored -> new ArrayList<>()).add(object);
        }
    }

    private static void collectChild(String parentKey, JsonNode child, Map<String, List<ObjectNode>> nodes) {
        if (!child.isObject()) {
            return;
        }
        ObjectNode object = (ObjectNode) child;
        String fieldKey = keyOf(parentKey, object);
        nodes.computeIfAbsent(fieldKey, ignored -> new ArrayList<>()).add(object);
        if (object.has("children") && object.get("children").isArray()) {
            object.get("children").forEach(nested -> collectChild(fieldKey, nested, nodes));
        }
    }

    private static String keyOf(String fallback, JsonNode node) {
        List<String> path = FieldMetaResolver.path(node);
        if (!path.isEmpty()) {
            return String.join(".", path);
        }
        JsonNode name = node.get("name");
        return name != null && name.isTextual() ? name.asText() : fallback;
    }

    private enum ReferenceRole {
        COLUMN,
        HIERARCHY
    }

    private static final class FieldReferences {
        private final List<ObjectNode> columns = new ArrayList<>();
        private final List<ObjectNode> hierarchies = new ArrayList<>();

        private void add(ReferenceRole role, ObjectNode node) {
            (role == ReferenceRole.COLUMN ? columns : hierarchies).add(node);
        }

        private ObjectNode column() {
            return columns.isEmpty() ? null : columns.get(0);
        }

        private ObjectNode hierarchy() {
            return hierarchies.isEmpty() ? null : hierarchies.get(0);
        }

        private List<ObjectNode> nodes() {
            List<ObjectNode> result = new ArrayList<>();
            result.addAll(columns);
            result.addAll(hierarchies);
            return result;
        }
    }

    public record Result(ObjectNode model, List<ResolvedFieldMeta> fields,
                         List<MigrationIssue> issues, int changedNodes) {
    }

    public record MigrationIssue(String entityType, String fieldKey, String detail, String reason,
                                 FieldMetaDiagnostics diagnostics, FieldMetaMigrationIssueSeverity severity) {
        public MigrationIssue(String entityType, String fieldKey, String detail, String reason) {
            this(entityType, fieldKey, detail, reason, null, FieldMetaMigrationIssueSeverity.BLOCKING);
        }
    }
}
