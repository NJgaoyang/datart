package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.server.base.dto.ViewFieldDTO;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class ChartConfigReconciler {

    public Result reconcile(ObjectNode root, List<ViewFieldDTO> fields) {
        List<MigrationIssue> issues = new ArrayList<>();
        int rows = 0;
        int changed = 0;
        ObjectNode chartConfig = chartConfig(root);
        JsonNode datas = chartConfig == null ? null : chartConfig.get("datas");
        if (datas == null || !datas.isArray()) {
            return new Result(0, 0, issues);
        }
        for (JsonNode data : datas) {
            JsonNode rowNodes = data.get("rows");
            if (rowNodes == null || !rowNodes.isArray()) {
                continue;
            }
            for (JsonNode rowNode : rowNodes) {
                if (!rowNode.isObject()) {
                    continue;
                }
                ObjectNode row = (ObjectNode) rowNode;
                String category = text(row, "category");
                if (!"field".equals(category) && !"dateLevelComputedField".equals(category)) {
                    continue;
                }
                rows++;
                String lookup = "dateLevelComputedField".equals(category)
                        ? text(row, "field") : text(row, "colName");
                ViewFieldDTO field = find(fields, text(row, "fieldId"), lookup, row.get("path"));
                if (field == null) {
                    issues.add(new MigrationIssue("CHART_ROW", lookup, lookup,
                            text(row, "fieldId") == null ? "无法确定性关联 View 字段" : "FIELD_INACTIVE"));
                    continue;
                }
                changed += apply(row, field);
            }
        }
        return new Result(rows, changed, issues);
    }

    public Result reconcile(ObjectNode root, Map<String, ResolvedFieldMeta> fields) {
        List<MigrationIssue> issues = new ArrayList<>();
        int rows = 0;
        int changed = 0;
        ObjectNode chartConfig = chartConfig(root);
        JsonNode datas = chartConfig == null ? null : chartConfig.get("datas");
        if (datas == null || !datas.isArray()) {
            return new Result(0, 0, issues);
        }
        for (JsonNode data : datas) {
            JsonNode rowNodes = data.get("rows");
            if (rowNodes == null || !rowNodes.isArray()) {
                continue;
            }
            for (JsonNode rowNode : rowNodes) {
                if (!rowNode.isObject()) {
                    continue;
                }
                ObjectNode row = (ObjectNode) rowNode;
                String category = text(row, "category");
                if (!"field".equals(category) && !"dateLevelComputedField".equals(category)) {
                    continue;
                }
                rows++;
                String lookup = "dateLevelComputedField".equals(category)
                        ? text(row, "field") : text(row, "colName");
                ResolvedFieldMeta meta = find(fields, lookup, row.get("path"));
                if (meta == null) {
                    issues.add(new MigrationIssue("CHART_ROW", lookup, lookup, "无法确定性关联 View 字段"));
                    continue;
                }
                changed += apply(row, meta);
            }
        }
        return new Result(rows, changed, issues);
    }

    private static ObjectNode chartConfig(ObjectNode root) {
        if (root == null) {
            return null;
        }
        JsonNode nested = root.get("chartConfig");
        return nested != null && nested.isObject() ? (ObjectNode) nested : root;
    }

    private static ResolvedFieldMeta find(Map<String, ResolvedFieldMeta> fields, String name, JsonNode pathNode) {
        if (pathNode != null && pathNode.isArray()) {
            String path = join(pathNode);
            ResolvedFieldMeta exact = fields.get(path);
            if (exact != null) {
                return exact;
            }
        }
        if (name == null) {
            return null;
        }
        ResolvedFieldMeta exact = fields.get(name);
        if (exact != null) {
            return exact;
        }
        ResolvedFieldMeta match = null;
        for (ResolvedFieldMeta field : fields.values()) {
            if (name.equals(field.rawName())) {
                if (match != null) {
                    return null;
                }
                match = field;
            }
        }
        return match;
    }

    private static int apply(ObjectNode row, ResolvedFieldMeta meta) {
        String before = row.toString();
        if (meta.path() != null && !meta.path().isEmpty()) {
            ArrayNode path = row.putArray("path");
            meta.path().forEach(path::add);
        }
        if (meta.displayNameCustom()) {
            row.put("displayName", meta.customDisplayName());
        } else {
            row.remove("displayName");
        }
        row.put("isDisplayNameCustom", meta.displayNameCustom());
        if (meta.comment() == null) {
            row.remove("comment");
        } else {
            row.put("comment", meta.comment());
        }
        return before.equals(row.toString()) ? 0 : 1;
    }

    private static int apply(ObjectNode row, ViewFieldDTO field) {
        String before = row.toString();
        row.put("fieldId", field.getFieldId());
        return before.equals(row.toString()) ? 0 : 1;
    }

    private static ViewFieldDTO find(List<ViewFieldDTO> fields, String fieldId, String name, JsonNode pathNode) {
        if (fieldId != null) {
            return fields.stream()
                    .filter(field -> fieldId.equals(field.getFieldId())
                            && !Boolean.FALSE.equals(field.getActive()))
                    .findFirst().orElse(null);
        }
        if (pathNode != null && pathNode.isArray()) {
            String path = join(pathNode);
            ViewFieldDTO exact = fields.stream()
                    .filter(field -> !Boolean.FALSE.equals(field.getActive())
                            && path.equals(String.join(".", field.getSourcePath() == null
                            ? List.of() : field.getSourcePath())))
                    .findFirst().orElse(null);
            if (exact != null) {
                return exact;
            }
        }
        if (name == null) {
            return null;
        }
        ViewFieldDTO match = null;
        for (ViewFieldDTO field : fields) {
            if (Boolean.FALSE.equals(field.getActive()) || !name.equals(field.getOriginName())) {
                continue;
            }
            if (match != null) {
                return null;
            }
            match = field;
        }
        return match;
    }

    private static String text(JsonNode node, String field) {
        JsonNode value = node.get(field);
        return value == null || value.isNull() ? null : value.asText();
    }

    private static String join(JsonNode values) {
        List<String> path = new ArrayList<>();
        values.forEach(value -> path.add(value.asText()));
        return String.join(".", path);
    }

    public record Result(int rows, int changedRows, List<MigrationIssue> issues) {
    }

    public record MigrationIssue(String entityType, String fieldKey, String detail, String reason) {
    }
}
