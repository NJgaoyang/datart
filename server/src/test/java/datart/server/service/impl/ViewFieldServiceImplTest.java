package datart.server.service.impl;

import datart.core.entity.SourceSchemas;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

class ViewFieldServiceImplTest {

    @Test
    void resolvesDisplayNameFromCustomCommentAndOrigin() {
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(null, null);

        ViewField field = new ViewField();
        field.setOriginName("origin");
        field.setSourceComment("comment");
        field.setCustomName(" custom ");
        assertEquals("custom", service.resolveDisplayName(field));

        field.setCustomName(null);
        assertEquals("comment", service.resolveDisplayName(field));

        field.setSourceComment(null);
        assertEquals("origin", service.resolveDisplayName(field));

        field.setCustomName(" ");
        field.setSourceComment(" comment ");
        assertEquals("comment", service.resolveDisplayName(field));

        field.setSourceComment(" ");
        assertEquals("origin", service.resolveDisplayName(field));
    }

    @Test
    void reconcilesJoinFieldsAndKeepsFieldIdWhenCommentChanges() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, schemaIndex("user_comment"));
        View view = view("STRUCT", "{\"columns\":{\"user\":{\"name\":[\"db\",\"user\",\"id\"],\"type\":\"STRING\"},\"order\":{\"name\":[\"db\",\"order\",\"id\"],\"type\":\"STRING\"}}}");

        service.reconcile(view);
        assertEquals(2, mapper.fields.size());
        ViewField user = mapper.fields.get("FIELD|db.user.id");
        ViewField order = mapper.fields.get("FIELD|db.order.id");
        assertNotEquals(user.getId(), order.getId());
        assertEquals("user_comment", user.getSourceComment());

        user.setCustomName("User ID");
        mapper.fields.put(user.getCanonicalKey(), user);
        String userId = user.getId();
        service = new ViewFieldServiceImpl(mapper, schemaIndex("updated_comment"));
        service.reconcile(view);

        assertEquals(userId, mapper.fields.get("FIELD|db.user.id").getId());
        assertEquals("updated_comment", mapper.fields.get("FIELD|db.user.id").getSourceComment());
        assertEquals("User ID", service.resolveDisplayName(mapper.fields.get("FIELD|db.user.id")));
    }

    @Test
    void marksMissingFieldsInactiveAndSupportsComputedAndSqlAlias() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View view = view("STRUCT", "{\"columns\":{\"id\":{\"name\":[\"db\",\"user\",\"id\"]},\"amount\":{\"name\":[\"db\",\"user\",\"amount\"]}},\"computedFields\":[{\"name\":\"avg_price\",\"type\":\"NUMBER\",\"category\":\"COMPUTED\",\"expression\":\"amount / count\"}]}");
        service.reconcile(view);
        String id = mapper.fields.get("FIELD|db.user.id").getId();
        assertEquals("COMPUTED|amount / count", mapper.fields.values().stream()
                .filter(field -> "avg_price".equals(field.getOriginName())).findFirst().orElseThrow().getCanonicalKey());

        view.setModel("{\"columns\":{\"id\":{\"name\":[\"db\",\"user\",\"id\"]}}}");
        service.reconcile(view);
        assertEquals(false, mapper.fields.get("FIELD|db.user.amount").getActive());

        view.setModel("{\"columns\":{\"id\":{\"name\":[\"db\",\"user\",\"id\"]},\"amount\":{\"name\":[\"db\",\"user\",\"amount\"]}}}");
        service.reconcile(view);
        assertEquals(id, mapper.fields.get("FIELD|db.user.id").getId());

        View sql = view("SQL", "{\"columns\":{\"userCount\":{\"name\":[\"user_count\"]},\"city\":{\"name\":[\"city_name\"]}}}");
        service.reconcile(sql);
        assertEquals("SQL|user_count", mapper.fields.get("SQL|user_count").getCanonicalKey());

        View duplicate = view("SQL", "{\"columns\":{\"a\":{\"name\":[\"a\",\"id\"]},\"b\":{\"name\":[\"b\",\"id\"]}}}");
        assertThrows(IllegalArgumentException.class, () -> service.reconcile(duplicate));
    }

    @Test
    void keepsSqlColumnAndHierarchyCommentsWhenSchemaCommentIsUnavailable() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View sql = view("SQL", "{\"columns\":{\"id\":{\"name\":[\"users\",\"id\"],\"comment\":\"用户编号\"}},\"hierarchy\":{\"id\":{\"name\":[\"users\",\"id\"],\"comment\":\"客户编号\"}}}");

        service.reconcile(sql);

        assertEquals("用户编号", mapper.fields.get("SQL|id").getSourceComment());

        sql.setModel("{\"columns\":{\"id\":{\"name\":[\"users\",\"id\"]}},\"hierarchy\":{\"id\":{\"name\":[\"users\",\"id\"],\"comment\":\"客户编号\"}}}");
        service.reconcile(sql);
        assertEquals("客户编号", mapper.fields.get("SQL|id").getSourceComment());
    }

    @Test
    void returnsIndependentEmptyLists() {
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(new FakeViewFieldMapper(), null);

        List<ViewFieldDTO> first = service.listByViewId("view-1");
        List<ViewFieldDTO> second = service.listByViewId("view-2");

        assertEquals(List.of(), first);
        assertEquals(List.of(), second);
        assertNotSame(first, second);
    }

    private static View view(String type, String model) {
        View view = new View();
        view.setId("view-1");
        view.setSourceId("source-1");
        view.setType(type);
        view.setModel(model);
        return view;
    }

    private static SourceSchemaIndex schemaIndex(String comment) {
        SourceSchemasMapperExt schemasMapper = Mockito.mock(SourceSchemasMapperExt.class);
        SourceSchemas schemas = new SourceSchemas();
        schemas.setSchemas("[{\"dbName\":\"db\",\"tables\":[{\"tableName\":\"user\",\"columns\":[{\"name\":[\"db\",\"user\",\"id\"],\"comment\":\"" + comment + "\"}]}]}]");
        Mockito.when(schemasMapper.selectBySource("source-1")).thenReturn(schemas);
        return new SourceSchemaIndex(schemasMapper, new com.fasterxml.jackson.databind.ObjectMapper());
    }

    private static class FakeViewFieldMapper implements ViewFieldMapperExt {
        private final Map<String, ViewField> fields = new LinkedHashMap<>();

        @Override
        public List<ViewField> listByViewId(String viewId) {
            return fields.values().stream().filter(field -> viewId.equals(field.getViewId())).toList();
        }

        @Override
        public ViewField selectByViewIdAndId(String viewId, String fieldId) {
            return fields.values().stream().filter(field -> field.getId().equals(fieldId)).findFirst().orElse(null);
        }

        @Override
        public int insert(ViewField field) {
            fields.put(field.getCanonicalKey(), field);
            return 1;
        }

        @Override
        public int update(ViewField field) {
            fields.put(field.getCanonicalKey(), field);
            return 1;
        }
    }
}
