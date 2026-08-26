package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void doesNotReuseFieldIdFromAnotherViewWhenCopyingAView() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField original = field("field-from-source-view", "source-view", "FIELD|db.user.id", "id");
        mapper.fields.put(original.getCanonicalKey(), original);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View copied = view("STRUCT", "{\"columns\":{\"id\":{\"fieldId\":\"field-from-source-view\",\"name\":[\"db\",\"user\",\"id\"]}}}");
        copied.setId("copied-view");

        service.reconcile(copied);

        assertEquals(1, mapper.insertCount);
        assertEquals(1, mapper.insertedFields.size());
        assertNotEquals(original.getId(), mapper.insertedFields.get(0).getId());
        assertEquals("copied-view", mapper.insertedFields.get(0).getViewId());
        assertEquals("field-from-source-view", original.getId());
    }

    @Test
    void updatesExistingFieldWhenCanonicalKeyChangesWithinTheSameView() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField existing = field("field-1", "view-1", "FIELD|db.user.old_name", "old_name");
        mapper.fields.put(existing.getCanonicalKey(), existing);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View view = view("STRUCT", "{\"columns\":{\"renamed\":{\"fieldId\":\"field-1\",\"name\":[\"db\",\"user\",\"new_name\"]}}}");

        service.reconcile(view);

        assertEquals(0, mapper.insertCount);
        assertEquals(1, mapper.updateCount);
        ViewField actual = mapper.fields.get("FIELD|db.user.new_name");
        assertEquals("field-1", actual.getId());
        assertEquals("FIELD|db.user.new_name", actual.getCanonicalKey());
        assertTrue(actual.getActive());
    }

    @Test
    void preservesAFieldIdThatDoesNotExistYetDuringImport() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View view = view("STRUCT", "{\"columns\":{\"id\":{\"fieldId\":\"imported-field-id\",\"name\":[\"db\",\"user\",\"id\"]}}}");

        service.reconcile(view);

        assertEquals("imported-field-id", mapper.fields.get("FIELD|db.user.id").getId());
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

    @Test
    void canonicalViewFieldDtoDoesNotExposeLegacyMetadata() throws Exception {
        ViewFieldDTO field = new ViewFieldDTO();
        field.setFieldId("field-city");
        field.setOriginName("city");
        field.setSourceComment("城市");
        field.setDisplayName("城市");

        String json = new ObjectMapper().writeValueAsString(field);

        assertTrue(json.contains("\"displayName\":\"城市\""));
        assertFalse(json.contains("isDisplayNameCustom"));
        assertFalse(json.contains("\"comment\""));
    }

    @Test
    void normalReconcileDoesNotReviveClearedLegacyCustomName() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField existing = field("field-1", "view-1", "SQL|net_increase_users", "net_increase_users");
        mapper.fields.put(existing.getCanonicalKey(), existing);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View sql = view("SQL", "{\"columns\":{\"net\":{\"name\":[\"net_increase_users\"],\"displayName\":\"在租用户较昨日净增人数\",\"isDisplayNameCustom\":true}}}");

        service.reconcile(sql);

        assertNull(mapper.fields.get("SQL|net_increase_users").getCustomName());
        assertEquals("field-1", mapper.fields.get("SQL|net_increase_users").getId());
    }

    @Test
    void rebuildDropsImportedTargetMetadataBeforeReconciling() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField existing = field("old-id", "view-1", "SQL|city_name_std", "city_name_std");
        existing.setCustomName("旧环境名称");
        mapper.fields.put(existing.getCanonicalKey(), existing);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View sql = view("SQL", "{\"columns\":{\"city\":{\"fieldId\":\"new-id\",\"name\":[\"city_name_std\"]}}}");

        service.rebuild(sql);

        ViewField actual = mapper.fields.get("SQL|city_name_std");
        assertEquals("new-id", actual.getId());
        assertNull(actual.getCustomName());
    }

    @Test
    void migrationOnlyBackfillsLegacyCustomNameWithoutChangingFieldId() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField existing = field("field-1", "view-1", "SQL|net_increase_users", "net_increase_users");
        mapper.fields.put(existing.getCanonicalKey(), existing);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View sql = view("SQL", "{\"columns\":{\"net\":{\"name\":[\"net_increase_users\"],\"displayName\":\"在租用户较昨日净增人数\",\"isDisplayNameCustom\":true}}}");

        service.migrateLegacyMetadata(sql);

        ViewField actual = mapper.fields.get("SQL|net_increase_users");
        assertEquals("field-1", actual.getId());
        assertEquals("在租用户较昨日净增人数", actual.getCustomName());
    }

    @Test
    void migrationOnlyDoesNotOverwriteExistingCustomName() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField existing = field("field-1", "view-1", "SQL|net_increase_users", "net_increase_users");
        existing.setCustomName("用户自定义A");
        mapper.fields.put(existing.getCanonicalKey(), existing);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View sql = view("SQL", "{\"columns\":{\"net\":{\"name\":[\"net_increase_users\"],\"displayName\":\"历史B\",\"isDisplayNameCustom\":true}}}");

        service.migrateLegacyMetadata(sql);

        assertEquals("用户自定义A", mapper.fields.get("SQL|net_increase_users").getCustomName());
    }

    @Test
    void normalReconcilePreservesExistingCommentWhenNoTrustedCommentExists() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewField existing = field("field-1", "view-1", "COMPUTED|amount / count", "avg_price");
        existing.setSourceComment("平均价格");
        mapper.fields.put(existing.getCanonicalKey(), existing);
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View view = view("STRUCT", "{\"computedFields\":[{\"name\":\"avg_price\",\"category\":\"COMPUTED\",\"expression\":\"amount / count\"}]}");

        service.reconcile(view);

        assertEquals("平均价格", mapper.fields.get("COMPUTED|amount / count").getSourceComment());
    }

    @Test
    void sqlModelCommentWinsOverExactSchemaComment() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, schemaIndex("Schema Comment"));
        View sql = view("SQL", "{\"columns\":{\"id\":{\"name\":[\"db\",\"user\",\"id\"],\"comment\":\"历史用户编号\"}}}");

        service.reconcile(sql);

        assertEquals("历史用户编号", mapper.fields.get("SQL|id").getSourceComment());
    }

    @Test
    void sqlExactSchemaCommentIsUsedWhenModelHasNoComment() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, schemaIndex("Schema Comment"));
        View sql = view("SQL", "{\"columns\":{\"id\":{\"name\":[\"db\",\"user\",\"id\"]}}}");
        sql.setScript("SELECT t.id FROM db.`user` t");

        service.reconcile(sql);

        ViewField actual = mapper.fields.get("SQL|id");
        assertEquals("[\"db\",\"user\",\"id\"]", actual.getSourcePath());
        assertEquals("Schema Comment", actual.getSourceComment());
    }

    @Test
    void sqlPhysicalPathKeepsAliasAsQueryIdentityAndUsesSourceComment() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper,
                schemaIndex("ads", "daily", "renting_users", "在租用户数"));
        View sql = view("SQL", """
                {"columns":{"current_users":{
                  "name":["current_users"],
                  "path":["ads","daily","renting_users"]
                }}}
                """);
        sql.setScript("SELECT t.renting_users AS current_users FROM ads.daily t");

        service.reconcile(sql);

        ViewField actual = mapper.fields.get("SQL|current_users");
        assertEquals("current_users", actual.getOriginName());
        assertEquals("在租用户数", actual.getSourceComment());
        assertEquals("在租用户数", service.resolveDisplayName(actual));
    }

    @Test
    void resolvesSqlPhysicalPathWithoutWritingItToModel() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper,
                schemaIndex("ads", "daily", "renting_users", "在租用户数"));
        View sql = view("SQL", "{\"columns\":{\"current_users\":{\"name\":[\"current_users\"]}}}");
        sql.setScript("SELECT t.renting_users AS current_users FROM ads.daily t");

        service.reconcile(sql);

        ViewField actual = mapper.fields.get("SQL|current_users");
        assertEquals("[\"ads\",\"daily\",\"renting_users\"]", actual.getSourcePath());
        assertEquals("在租用户数", actual.getSourceComment());
        assertFalse(sql.getModel().contains("\"path\""));
    }

    @Test
    void sqlExpressionWithoutTrustedMetadataKeepsOriginName() {
        FakeViewFieldMapper mapper = new FakeViewFieldMapper();
        ViewFieldServiceImpl service = new ViewFieldServiceImpl(mapper, null);
        View sql = view("SQL", "{\"columns\":{\"efficiency\":{\"name\":[\"cabinet_efficiency\"],\"expression\":\"round(a / b, 2)\"}}}");

        service.reconcile(sql);

        ViewField actual = mapper.fields.get("SQL|cabinet_efficiency");
        assertNull(actual.getSourceComment());
        assertNull(actual.getCustomName());
        assertEquals("cabinet_efficiency", service.resolveDisplayName(actual));
    }

    private static View view(String type, String model) {
        View view = new View();
        view.setId("view-1");
        view.setSourceId("source-1");
        view.setType(type);
        view.setModel(model);
        return view;
    }

    private static ViewField field(String id, String viewId, String canonicalKey, String originName) {
        ViewField field = new ViewField();
        field.setId(id);
        field.setViewId(viewId);
        field.setCanonicalKey(canonicalKey);
        field.setOriginName(originName);
        field.setFieldType("STRING");
        field.setFieldCategory("");
        field.setActive(true);
        return field;
    }

    private static SourceSchemaIndex schemaIndex(String comment) {
        return schemaIndex("db", "user", "id", comment);
    }

    private static SourceSchemaIndex schemaIndex(String database, String table, String column, String comment) {
        SourceSchemasMapperExt schemasMapper = Mockito.mock(SourceSchemasMapperExt.class);
        SourceSchemas schemas = new SourceSchemas();
        schemas.setSchemas("[{\"dbName\":\"" + database + "\",\"tables\":[{\"tableName\":\"" + table
                + "\",\"columns\":[{\"name\":[\"" + database + "\",\"" + table + "\",\"" + column
                + "\"],\"comment\":\"" + comment + "\"}]}]}]");
        Mockito.when(schemasMapper.selectBySource("source-1")).thenReturn(schemas);
        return new SourceSchemaIndex(schemasMapper, new com.fasterxml.jackson.databind.ObjectMapper());
    }

    private static class FakeViewFieldMapper implements ViewFieldMapperExt {
        private final Map<String, ViewField> fields = new LinkedHashMap<>();
        private final List<ViewField> insertedFields = new java.util.ArrayList<>();
        private int insertCount;
        private int updateCount;

        @Override
        public int deleteByViewId(String viewId) {
            fields.values().removeIf(field -> viewId.equals(field.getViewId()));
            return 1;
        }

        @Override
        public List<ViewField> listByViewId(String viewId) {
            return fields.values().stream().filter(field -> viewId.equals(field.getViewId())).toList();
        }

        @Override
        public ViewField selectByViewIdAndId(String viewId, String fieldId) {
            return fields.values().stream().filter(field -> field.getId().equals(fieldId)).findFirst().orElse(null);
        }

        @Override
        public ViewField selectById(String fieldId) {
            return fields.values().stream().filter(field -> field.getId().equals(fieldId)).findFirst().orElse(null);
        }

        @Override
        public int insert(ViewField field) {
            insertCount++;
            insertedFields.add(field);
            fields.put(field.getCanonicalKey(), field);
            return 1;
        }

        @Override
        public int update(ViewField field) {
            updateCount++;
            fields.put(field.getCanonicalKey(), field);
            return 1;
        }
    }
}
