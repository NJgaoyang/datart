package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

@Component
public class StrictJson {

    private final ObjectMapper objectMapper;

    public StrictJson(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public JsonNode read(String entityType, String id, String json) {
        try {
            if (json == null || json.isBlank()) {
                throw new IllegalArgumentException("empty JSON");
            }
            return objectMapper.readTree(json);
        } catch (Exception e) {
            throw new InvalidMigrationJsonException(entityType, id, e);
        }
    }

    public ObjectNode readObject(String entityType, String id, String json) {
        JsonNode node = read(entityType, id, json);
        if (!node.isObject()) {
            throw new InvalidMigrationJsonException(entityType, id,
                    new IllegalArgumentException("JSON root is not an object"));
        }
        return (ObjectNode) node;
    }

    public String write(JsonNode node) {
        try {
            return objectMapper.writeValueAsString(node);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to serialize migration JSON", e);
        }
    }
}
