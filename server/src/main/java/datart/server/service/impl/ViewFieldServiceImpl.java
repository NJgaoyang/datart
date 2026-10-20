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
import datart.server.common.fieldmeta.SqlFieldLineageResolver;
import datart.server.common.fieldmeta.ViewFieldKey;
import org.springframework.beans.factory.annotation.Autowired;
import datart.server.service.BaseService;
import datart.server.service.ViewFieldService;
import org.springframework.stereotype.Service;
import lombok.extern.slf4j.Slf4j;
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
@Slf4j
public class ViewFieldServiceImpl extends BaseService implements ViewFieldService {

    private final ViewFieldMapperExt mapper;
    private final SourceSchemaIndex schemaIndex;
    private final SqlFieldLineageResolver sqlFieldLineageResolver;
    private final FieldMetaResolver legacyResolver = new FieldMetaResolver();

    @Autowired
    public ViewFieldServiceImpl(ViewFieldMapperExt mapper, SourceSchemaIndex schemaIndex,
                                SqlFieldLineageResolver sqlFieldLineageResolver) {
        this.mapper = mapper;
        this.schemaIndex = schemaIndex;
        this.sqlFieldLineageResolver = sqlFieldLineageResolver;
    }

    public ViewFieldServiceImpl(ViewFieldMapperExt mapper, SourceSchemaIndex schemaIndex) {
        this(mapper, schemaIndex, new SqlFieldLineageResolver());
    }

    @Override
    public List<ViewFieldDTO> listByViewId(String viewId) {
        return mapper.listByViewId(viewId).stream()
                .map(this::toDTO)
                .collect(Collectors.toCollection(ArrayList::new));
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
        reconcile(view, false);
    }

    @Override
    @Transactional
    public void rebuild(View view) {
        if (view == null || view.getId() == null) {
            return;
        }
        mapper.deleteByViewId(view.getId());
        reconcile(view);
    }

    @Override
    @Transactional
    public void migrateLegacyMetadata(View view) {
        reconcile(view, true);
    }

    private void reconcile(View view, boolean migrateLegacyMetadata) {
        if (view == null || view.getId() == null || view.getModel() == null || view.getModel().isBlank()) {
            return;
        }
        try {
            ObjectNode root = (ObjectNode) OBJECT_MAPPER.readTree(view.getModel());
            Map<String, FieldReferences> references = collectReferences(root, view.getType());
            Map<String, ViewField> existing = mapper.listByViewId(view.getId()).stream()
                    .collect(Collectors.toMap(ViewField::getCanonicalKey, item -> item,
                            (left, right) -> left, LinkedHashMap::new));
            Set<String> seenFieldIds = new HashSet<>();
            Set<String> sqlOutputNames = new HashSet<>();
            SourceSchemaIndex.Index source = schemaIndex == null ? null : schemaIndex.forSource(view.getSourceId());
            Map<String, SqlFieldLineageResolver.SqlFieldLineage> sqlLineages = "SQL".equalsIgnoreCase(view.getType())
                    ? sqlFieldLineageResolver.resolve(view.getScript(), source) : Map.of();
            Map<String, UpstreamIdentity> joinSources = readJoinSources(view);
            Map<String, List<ViewField>> upstreamFields = new LinkedHashMap<>();
            for (UpstreamIdentity identity : joinSources.values()) {
                upstreamFields.computeIfAbsent(identity.viewId(), mapper::listByViewId);
            }
            int ordinal = 0;
            for (Map.Entry<String, FieldReferences> entry : references.entrySet()) {
                FieldReferences refs = entry.getValue();
                ObjectNode first = refs.primary();
                FieldData data = FieldData.from(entry.getKey(), first, view.getType());
                if ("SQL".equalsIgnoreCase(view.getType()) && !sqlOutputNames.add(data.originName())) {
                    throw new IllegalArgumentException("SQL_OUTPUT_COLUMN_DUPLICATED: " + data.originName());
                }
                ViewField field = existing.get(data.canonicalKey());
                boolean persisted = field != null;
                if (field == null) {
                    String requestedFieldId = trimToNull(first.path("fieldId").asText(null));
                    ViewField fieldById = requestedFieldId == null
                            ? null
                            : mapper.selectById(requestedFieldId);
                    if (fieldById != null && Objects.equals(fieldById.getViewId(), view.getId())) {
                        field = fieldById;
                        persisted = true;
                    } else {
                        field = new ViewField();
                        if (fieldById != null) {
                            field.setId(UUIDGenerator.generate());
                        } else if (requestedFieldId != null) {
                            field.setId(requestedFieldId);
                        } else {
                            field.setId(UUIDGenerator.generate());
                        }
                        field.setViewId(view.getId());
                        field.setCreateBy(currentUserId());
                        field.setCreateTime(new Date());
                    }
                }
                // Keep the previous identity until we have compared source
                // changes; existing-by-ID fields can change canonical key.
                String previousCanonicalKey = field.getCanonicalKey();
                UpstreamIdentity joinSource = joinSources.get(data.originName());
                ViewField upstream = joinSource == null ? null
                        : matchUpstreamField(upstreamFields.get(joinSource.viewId()), joinSource.columnKey());
                List<String> physicalSourcePath = upstream != null
                        ? fromJson(upstream.getSourcePath())
                        : physicalSourcePath(view.getType(), data, sqlLineages);
                field.setViewId(view.getId());
                field.setCanonicalKey(data.canonicalKey());
                field.setOriginName(data.originName());
                // A legacy record may have a null sourcePath. For an
                // unchanged computed field, null and [] represent the same
                // lack of physical lineage, not a source transition.
                String formerSourcePath = toJson(fromJson(field.getSourcePath()));
                String nextSourcePath = toJson(physicalSourcePath);
                field.setSourcePath(nextSourcePath);
                field.setFieldType(data.type());
                field.setFieldCategory(data.category());
                field.setExpression(data.expression());
                field.setOrdinal(ordinal++);
                field.setActive(true);
                String sourceComment = upstream != null
                        ? trimToNull(upstream.getSourceComment())
                        : sourceComment(view.getType(), data, refs, source, physicalSourcePath);
                if (!persisted && upstream != null && trimToNull(upstream.getCustomName()) != null) {
                    field.setCustomName(trimToNull(upstream.getCustomName()));
                }
                if (sourceComment != null) {
                    field.setSourceComment(sourceComment);
                } else if (shouldClearMissingComment(formerSourcePath, nextSourcePath,
                        persisted && !Objects.equals(previousCanonicalKey, data.canonicalKey()),
                        upstream != null || (source != null && !physicalSourcePath.isEmpty()
                                && source.exact(physicalSourcePath) != null))) {
                    // Clear only when the physical path or stable field
                    // identity changed, or the source is verified to lack a
                    // comment. An unchanged computed field has no physical
                    // path but can still retain its existing annotation.
                    field.setSourceComment(null);
                } else {
                    // Same known source but comment lookup unavailable:
                    // do not erase the previously verified metadata.
                    log.warn("Source comment unavailable for view {} field {} with unchanged physical lineage",
                            view.getId(), field.getCanonicalKey());
                }
                if (migrateLegacyMetadata && trimToNull(field.getCustomName()) == null) {
                    String customName = legacyCustomName(view.getType(), data.canonicalKey(), refs, source);
                    if (customName != null) {
                        field.setCustomName(customName);
                    }
                }
                field.setUpdateBy(currentUserId());
                field.setUpdateTime(new Date());
                if (persisted) {
                    mapper.update(field);
                } else {
                    mapper.insert(field);
                }
                seenFieldIds.add(field.getId());
                for (ObjectNode node : refs.nodes()) {
                    node.put("fieldId", field.getId());
                }
            }
            existing.values().stream()
                    .filter(field -> !seenFieldIds.contains(field.getId()) && Boolean.TRUE.equals(field.getActive()))
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

    private Map<String, FieldReferences> collectReferences(ObjectNode root, String viewType) {
        Map<String, FieldReferences> result = new LinkedHashMap<>();
        collectMap(root.path("columns"), result, ReferenceRole.COLUMN, viewType);
        collectMap(root.path("hierarchy"), result, ReferenceRole.HIERARCHY, viewType);
        JsonNode computedFields = root.get("computedFields");
        if (computedFields != null && computedFields.isArray()) {
            for (JsonNode node : computedFields) {
                if (node.isObject()) {
                    addReference(result, "computed_" + result.size(), (ObjectNode) node, ReferenceRole.COMPUTED, viewType);
                }
            }
        }
        return result;
    }

    private void collectMap(JsonNode root, Map<String, FieldReferences> result, ReferenceRole role, String viewType) {
        if (root == null || !root.isObject()) {
            return;
        }
        root.fields().forEachRemaining(entry -> collectNode(entry.getKey(), entry.getValue(), result, role, viewType));
    }

    private void collectNode(String fallback, JsonNode node, Map<String, FieldReferences> result, ReferenceRole role,
                             String viewType) {
        if (!node.isObject()) {
            return;
        }
        ObjectNode object = (ObjectNode) node;
        ArrayNode children = object.has("children") && object.get("children").isArray()
                ? (ArrayNode) object.get("children") : null;
        if (children != null && !children.isEmpty()) {
            for (JsonNode child : children) {
                collectNode(fallback, child, result, role, viewType);
            }
            return;
        }
        FieldData data = FieldData.from(fallback, object, viewType);
        addReference(result, "SQL".equalsIgnoreCase(viewType) ? fallback : data.canonicalKey(), object, role, viewType);
    }

    private void addReference(Map<String, FieldReferences> result, String key, ObjectNode node, ReferenceRole role,
                              String viewType) {
        FieldData data = FieldData.from(key, node, viewType);
        String referenceKey = "SQL".equalsIgnoreCase(viewType) ? key : data.canonicalKey();
        result.computeIfAbsent(referenceKey, ignored -> new FieldReferences()).add(role, node);
    }

    private String legacyCustomName(String viewType, String fieldKey, FieldReferences refs,
                                    SourceSchemaIndex.Index source) {
        ResolvedFieldMeta resolved = legacyResolver.resolve(fieldKey, refs.resolverColumn(), refs.hierarchy(), source, viewType);
        return resolved.displayNameCustom() ? trimToNull(resolved.customDisplayName()) : null;
    }


    private record UpstreamIdentity(String viewId, String columnKey) { }

    private Map<String, UpstreamIdentity> readJoinSources(View view) {
        Map<String, UpstreamIdentity> result = new LinkedHashMap<>();
        if (view.getConfig() == null) return result;
        try {
            JsonNode root = OBJECT_MAPPER.readTree(view.getConfig());
            JsonNode mapping = root.path("lineage").path("outputFieldSources");
            if (mapping.isObject()) {
                mapping.fields().forEachRemaining(entry -> {
                    String viewId = trimToNull(entry.getValue().path("viewId").asText(null));
                    String columnKey = trimToNull(entry.getValue().path("columnKey").asText(null));
                    if (viewId != null && columnKey != null) {
                        result.put(entry.getKey(), new UpstreamIdentity(viewId, columnKey));
                    }
                });
            }
        } catch (Exception ignored) {
            // Corrupt lineage should never trigger guessed annotations.
        }
        return result;
    }

    private ViewField matchUpstreamField(List<ViewField> fields, String columnKey) {
        if (fields == null) return null;
        List<ViewField> matches = fields.stream()
                .filter(field -> Boolean.TRUE.equals(field.getActive()))
                .filter(field -> Objects.equals(columnKey, field.getCanonicalKey())
                        || Objects.equals(columnKey, field.getOriginName())
                        || Objects.equals(columnKey, String.join(".", fromJson(field.getSourcePath()))))
                .toList();
        return matches.size() == 1 ? matches.get(0) : null;
    }

    /** A confirmed comment removal must not leave stale Chinese labels;
     * an unavailable schema lookup must not erase valid previous labels. */
    static boolean shouldClearMissingComment(String oldPath, String nextPath,
                                             boolean sourceLost, boolean sourceVerified) {
        return sourceLost || !Objects.equals(oldPath, nextPath) || sourceVerified;
    }

    private String sourceComment(String viewType, FieldData data, FieldReferences refs,
                                 SourceSchemaIndex.Index source, List<String> physicalSourcePath) {
        if ("COMPUTED".equalsIgnoreCase(data.category())) {
            return null;
        }
        SourceSchemaIndex.ColumnMeta schema = source == null ? null : source.exact(physicalSourcePath);
        if (schema != null) {
            // A known column with an empty physical comment is a verified
            // deletion. Do not resurrect stale annotations from the model.
            return trimToNull(schema.comment());
        }
        ResolvedFieldMeta resolved = legacyResolver.resolve(data.canonicalKey(), refs.resolverColumn(), refs.hierarchy(),
                source, viewType);
        return trimToNull(resolved.comment());
    }

    private List<String> physicalSourcePath(String viewType, FieldData data,
                                             Map<String, SqlFieldLineageResolver.SqlFieldLineage> sqlLineages) {
        if (!"SQL".equalsIgnoreCase(viewType)) {
            return data.sourcePath();
        }
        SqlFieldLineageResolver.SqlFieldLineage lineage = sqlLineages.get(data.originName());
        return lineage != null && lineage.hasPhysicalPath() ? lineage.sourcePath() : List.of();
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

    private enum ReferenceRole {
        COLUMN,
        HIERARCHY,
        COMPUTED
    }

    private static final class FieldReferences {
        private final List<ObjectNode> columns = new ArrayList<>();
        private final List<ObjectNode> hierarchies = new ArrayList<>();
        private final List<ObjectNode> computed = new ArrayList<>();

        private void add(ReferenceRole role, ObjectNode node) {
            switch (role) {
                case COLUMN -> columns.add(node);
                case HIERARCHY -> hierarchies.add(node);
                case COMPUTED -> computed.add(node);
            }
        }

        private ObjectNode primary() {
            ObjectNode resolverColumn = resolverColumn();
            return resolverColumn == null ? hierarchy() : resolverColumn;
        }

        private ObjectNode resolverColumn() {
            return columns.isEmpty() && !computed.isEmpty() ? computed.get(0) : column();
        }

        private ObjectNode column() {
            return columns.isEmpty() ? null : columns.get(0);
        }

        private ObjectNode hierarchy() {
            return hierarchies.isEmpty() ? null : hierarchies.get(0);
        }

        private List<ObjectNode> nodes() {
            List<ObjectNode> nodes = new ArrayList<>();
            nodes.addAll(columns);
            nodes.addAll(hierarchies);
            nodes.addAll(computed);
            return nodes;
        }
    }

    private record FieldData(String canonicalKey, String originName, List<String> sourcePath,
                             String type, String category, String expression) {
        static FieldData from(String fallback, JsonNode node, String viewType) {
            List<String> path = FieldMetaResolver.path(node);
            String outputName = outputName(node, fallback);
            String originName = "SQL".equalsIgnoreCase(viewType) ? outputName
                    : path.isEmpty() ? outputName : path.get(path.size() - 1);
            String category = node.path("category").asText(null);
            String expression = trimToNull(node.path("expression").asText(null));
            if ("COMPUTED".equalsIgnoreCase(category) || expression != null && path.isEmpty()) {
                category = "COMPUTED";
            }
            String type = node.path("type").asText("STRING");
            return new FieldData(ViewFieldKey.of(viewType, path, originName, category, expression),
                    originName, path, type, category == null ? "" : category, expression);
        }

        private static String outputName(JsonNode node, String fallback) {
            JsonNode name = node.get("name");
            if (name != null && name.isArray() && !name.isEmpty()) {
                return name.get(name.size() - 1).asText(fallback);
            }
            return name == null ? fallback : name.asText(fallback);
        }
    }
}
