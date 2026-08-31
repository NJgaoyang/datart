package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/** Removes only SQL model paths proven to be copied from physical lineage. */
@Component
public class SqlModelQueryPathSanitizer {

    private final SqlFieldLineageResolver resolver;

    public SqlModelQueryPathSanitizer() {
        this(new SqlFieldLineageResolver());
    }

    public SqlModelQueryPathSanitizer(SqlFieldLineageResolver resolver) {
        this.resolver = resolver;
    }

    public int sanitize(String sql, ObjectNode model, SourceSchemaIndex.Index schema) {
        return visit(sql, model, schema, true);
    }

    public int count(String sql, ObjectNode model, SourceSchemaIndex.Index schema) {
        return visit(sql, model, schema, false);
    }

    private int visit(String sql, ObjectNode model, SourceSchemaIndex.Index schema, boolean repair) {
        if (sql == null || sql.isBlank() || model == null || schema == null) {
            return 0;
        }
        Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages = resolver.resolve(sql, schema);
        if (lineages.isEmpty()) {
            return 0;
        }
        return visitFields(model.path("columns"), lineages, repair)
                + visitFields(model.path("hierarchy"), lineages, repair);
    }

    private int visitFields(JsonNode fields,
                            Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages,
                            boolean repair) {
        if (fields == null || !fields.isObject()) {
            return 0;
        }
        int count = 0;
        var iterator = fields.fields();
        while (iterator.hasNext()) {
            Map.Entry<String, JsonNode> entry = iterator.next();
            count += visitField(entry.getKey(), entry.getValue(), lineages, repair);
        }
        return count;
    }

    private int visitField(String fallbackName, JsonNode node,
                           Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages,
                           boolean repair) {
        if (!(node instanceof ObjectNode field)) {
            return 0;
        }
        String outputName = outputName(field, fallbackName);
        SqlFieldLineageResolver.SqlFieldLineage lineage = lineages.get(outputName);
        int count = 0;
        if (lineage != null && lineage.hasPhysicalPath() && samePath(field.get("path"), lineage.sourcePath())) {
            count++;
            if (repair) {
                field.remove("path");
            }
        }
        JsonNode children = field.get("children");
        if (children != null && children.isArray()) {
            for (JsonNode child : children) {
                count += visitField(outputName, child, lineages, repair);
            }
        }
        return count;
    }

    private static boolean samePath(JsonNode node, List<String> expected) {
        if (node == null || !node.isArray() || node.size() != expected.size()) {
            return false;
        }
        for (int index = 0; index < expected.size(); index++) {
            if (!expected.get(index).equals(node.get(index).asText())) {
                return false;
            }
        }
        return true;
    }

    private static String outputName(JsonNode node, String fallback) {
        JsonNode name = node.get("name");
        if (name != null && name.isArray() && !name.isEmpty()) {
            return name.get(name.size() - 1).asText(fallback);
        }
        return name == null ? fallback : name.asText(fallback);
    }
}
