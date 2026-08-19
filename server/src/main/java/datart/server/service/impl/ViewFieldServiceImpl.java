package datart.server.service.impl;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.common.UUIDGenerator;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.common.fieldmeta.FieldMetaResolver;
import datart.server.common.fieldmeta.ResolvedFieldMeta;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.ViewFieldKey;
import datart.server.service.BaseService;
import datart.server.service.ViewFieldService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.HashSet;
import java.util.stream.Collectors;

@Service
public class ViewFieldServiceImpl extends BaseService implements ViewFieldService {

    private final ViewFieldMapperExt mapper;
    private final SourceSchemaIndex schemaIndex;
    private final FieldMetaResolver legacyResolver = new FieldMetaResolver();

    public ViewFieldServiceImpl(ViewFieldMapperExt mapper, SourceSchemaIndex schemaIndex) {
        this.mapper = mapper;
        this.schemaIndex = schemaIndex;
    }

    @Override
    public List<ViewFieldDTO> listByViewId(String viewId) {
        return mapper.listByViewId(viewId).stream().map(this::toDTO).toList();
    }

    @Override
    public ViewFieldDTO get(String viewId, String fieldId) {
        ViewField field = mapper.selectByViewIdAndId(viewId, fieldId);
        return field == null ? null : toDTO(field);
    }

    @Override
    public Map<String, ViewFieldDTO> mapByViewId(String viewId) {
        return listByViewId(viewId).stream()
                .collect(Collectors.toMap(ViewFieldDTO::getFieldId, item -> item,
                        (left, right) -> left, LinkedHashMap::new));
    }

    @Override
    @Transactional
    public void reconcile(View view) {
        if (view == null || view.getId() == null || view.getModel() == null || view.getModel().isBlank()) {
            return;
        }
        try {
            ObjectNode root = (ObjectNode) OBJECT_MAPPER.readTree(view.getModel());
            Map<String, List<ObjectNode>> references = collectReferences(root);
            Map<String, ViewField> existing = mapper.listByViewId(view.getId()).stream()
                    .collect(Collectors.toMap(ViewField::getCanonicalKey, item -> item,
                            (left, right) -> left, LinkedHashMap::new));
            Set<String> seen = new HashSet<>();
            Set<String> sqlOutputNames = new HashSet<>();
            SourceSchemaIndex.Index source = schemaIndex == null ? null : schemaIndex.forSource(view.getSourceId());
            int ordinal = 0;
            for (Map.Entry<String, List<ObjectNode>> entry : references.entrySet()) {
                List<ObjectNode> refs = entry.getValue();
                ObjectNode first = refs.get(0);
                FieldData data = FieldData.from(entry.getKey(), first, view.getType());
                if ("SQL".equalsIgnoreCase(view.getType()) && !sqlOutputNames.add(data.originName())) {
                    throw new IllegalArgumentException("SQL_OUTPUT_COLUMN_DUPLICATED: " + data.originName());
                }
                ViewField field = existing.get(data.canonicalKey());
                if (field == null) {
                    field = new ViewField();
                    field.setId(first.path("fieldId").asText(null));
                    if (field.getId() == null || field.getId().isBlank()) {
                        field.setId(UUIDGenerator.generate());
                    }
                    field.setViewId(view.getId());
                    field.setCanonicalKey(data.canonicalKey());
                    field.setCreateBy(currentUserId());
                    field.setCreateTime(new Date());
                    field.setCustomName(legacyCustomName(view.getType(), entry.getKey(), refs, source));
                }
                field.setViewId(view.getId());
                field.setCanonicalKey(data.canonicalKey());
                field.setOriginName(data.originName());
                field.setSourcePath(toJson(data.sourcePath()));
                field.setFieldType(data.type());
                field.setFieldCategory(data.category());
                field.setExpression(data.expression());
                field.setOrdinal(ordinal++);
                field.setActive(true);
                field.setSourceComment(sourceComment(view.getType(), data, source, field));
                field.setUpdateBy(currentUserId());
                field.setUpdateTime(new Date());
                if (existing.containsKey(data.canonicalKey())) {
                    mapper.update(field);
                } else {
                    mapper.insert(field);
                }
                seen.add(data.canonicalKey());
                for (ObjectNode node : refs) {
                    node.put("fieldId", field.getId());
                }
            }
            existing.values().stream()
                    .filter(field -> !seen.contains(field.getCanonicalKey()) && Boolean.TRUE.equals(field.getActive()))
                    .forEach(field -> {
                        field.setActive(false);
                        field.setUpdateBy(currentUserId());
                        field.setUpdateTime(new Date());
                        mapper.update(field);
                    });
            String reconciledModel = OBJECT_MAPPER.writeValueAsString(root);
            if (!Objects.equals(view.getModel(), reconciledModel)) {
                view.setModel(reconciledModel);
            }
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("VIEW_FIELD_RECONCILE_FAILED", e);
        }
    }

    @Override
    @Transactional
    public ViewFieldDTO updateCustomName(String viewId, String fieldId, String customName) {
        ViewField field = mapper.selectByViewIdAndId(viewId, fieldId);
        if (field == null) {
            throw new IllegalArgumentException("VIEW_FIELD_NOT_FOUND: " + fieldId);
        }
        field.setCustomName(trimToNull(customName));
        field.setUpdateBy(currentUserId());
        field.setUpdateTime(new Date());
        mapper.update(field);
        return toDTO(field);
    }

    @Override
    public String resolveDisplayName(ViewField field) {
        String customName = trimToNull(field.getCustomName());
        if (customName != null) {
            return customName;
        }
        String sourceComment = trimToNull(field.getSourceComment());
        return sourceComment == null ? field.getOriginName() : sourceComment;
    }

    private Map<String, List<ObjectNode>> collectReferences(ObjectNode root) {
        Map<String, List<ObjectNode>> result = new LinkedHashMap<>();
        collectMap(root.path("columns"), result);
        collectMap(root.path("hierarchy"), result);
        JsonNode computedFields = root.get("computedFields");
        if (computedFields != null && computedFields.isArray()) {
            for (JsonNode node : computedFields) {
                if (node.isObject()) {
                    addReference(result, "computed_" + result.size(), (ObjectNode) node);
                }
            }
        }
        return result;
    }

    private void collectMap(JsonNode root, Map<String, List<ObjectNode>> result) {
        if (root == null || !root.isObject()) {
            return;
        }
        root.fields().forEachRemaining(entry -> collectNode(entry.getKey(), entry.getValue(), result));
    }

    private void collectNode(String fallback, JsonNode node, Map<String, List<ObjectNode>> result) {
        if (!node.isObject()) {
            return;
        }
        ObjectNode object = (ObjectNode) node;
        ArrayNode children = object.has("children") && object.get("children").isArray()
                ? (ArrayNode) object.get("children") : null;
        if (children != null && !children.isEmpty()) {
            for (JsonNode child : children) {
                collectNode(fallback, child, result);
            }
            return;
        }
        FieldData data = FieldData.from(fallback, object, null);
        addReference(result, data.canonicalKey(), object);
    }

    private void addReference(Map<String, List<ObjectNode>> result, String key, ObjectNode node) {
        FieldData data = FieldData.from(key, node, null);
        result.computeIfAbsent(data.canonicalKey(), ignored -> new ArrayList<>()).add(node);
    }

    private String legacyCustomName(String viewType, String fieldKey, List<ObjectNode> refs,
                                    SourceSchemaIndex.Index source) {
        ObjectNode column = refs.isEmpty() ? null : refs.get(0);
        ObjectNode hierarchy = refs.size() > 1 ? refs.get(1) : null;
        ResolvedFieldMeta resolved = legacyResolver.resolve(fieldKey, column, hierarchy, source, viewType);
        return resolved.displayNameCustom() ? trimToNull(resolved.customDisplayName()) : null;
    }

    private String sourceComment(String viewType, FieldData data, SourceSchemaIndex.Index source, ViewField existing) {
        if ("SQL".equalsIgnoreCase(viewType) || "COMPUTED".equalsIgnoreCase(data.category())) {
            return null;
        }
        SourceSchemaIndex.ColumnMeta schema = source == null ? null : source.exact(data.sourcePath());
        if (schema != null) {
            return trimToNull(schema.comment());
        }
        return existing == null ? null : existing.getSourceComment();
    }

    private ViewFieldDTO toDTO(ViewField field) {
        ViewFieldDTO dto = new ViewFieldDTO();
        dto.setFieldId(field.getId());
        dto.setOriginName(field.getOriginName());
        dto.setSourceComment(field.getSourceComment());
        dto.setCustomName(field.getCustomName());
        dto.setDisplayName(resolveDisplayName(field));
        dto.setSourcePath(fromJson(field.getSourcePath()));
        dto.setType(field.getFieldType());
        dto.setCategory(field.getFieldCategory());
        dto.setExpression(field.getExpression());
        dto.setActive(field.getActive());
        return dto;
    }

    private String currentUserId() {
        return securityManager == null || getCurrentUser() == null ? null : getCurrentUser().getId();
    }

    private String toJson(List<String> path) {
        try {
            return OBJECT_MAPPER.writeValueAsString(path);
        } catch (Exception e) {
            throw new IllegalArgumentException("VIEW_FIELD_SOURCE_PATH_FAILED", e);
        }
    }

    private List<String> fromJson(String path) {
        if (path == null || path.isBlank()) {
            return List.of();
        }
        try {
            return OBJECT_MAPPER.readValue(path, OBJECT_MAPPER.getTypeFactory()
                    .constructCollectionType(List.class, String.class));
        } catch (Exception e) {
            return List.of(path);
        }
    }

    private static String trimToNull(String value) {
        return value == null || value.trim().isEmpty() ? null : value.trim();
    }

    private record FieldData(String canonicalKey, String originName, List<String> sourcePath,
                             String type, String category, String expression) {
        static FieldData from(String fallback, JsonNode node, String viewType) {
            List<String> path = FieldMetaResolver.path(node);
            String originName = path.isEmpty() ? node.path("name").asText(fallback) : path.get(path.size() - 1);
            String category = node.path("category").asText(null);
            String expression = trimToNull(node.path("expression").asText(null));
            if ("COMPUTED".equalsIgnoreCase(category) || expression != null && path.isEmpty()) {
                category = "COMPUTED";
            }
            String type = node.path("type").asText("STRING");
            return new FieldData(ViewFieldKey.of(viewType, path, originName, category, expression),
                    originName, path, type, category == null ? "" : category, expression);
        }
    }
}
