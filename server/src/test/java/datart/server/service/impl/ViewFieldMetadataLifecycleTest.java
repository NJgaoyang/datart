package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.base.consts.Const;
import datart.core.base.consts.MigrationMode;
import datart.core.entity.SourceSchemas;
import datart.core.entity.User;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.mappers.ext.*;
import datart.security.manager.DatartSecurityManager;
import datart.server.base.dto.ViewDetailDTO;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.base.transfer.ImportStrategy;
import datart.server.base.transfer.TransferConfig;
import datart.server.base.transfer.model.ResourceModel;
import datart.server.base.transfer.model.ViewResourceModel;
import datart.server.common.TransferFileUtils;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.service.MigrationModeService;
import datart.server.service.RoleService;
import datart.server.service.VariableService;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Exercises real export/import, reconciliation and naming services; only persistence is in memory. */
class ViewFieldMetadataLifecycleTest {

    @Test
    void patchedNameRoundTripsWithoutAnotherEditorSaveAndPreservesFieldId() throws Exception {
        Fixture source = new Fixture(null);
        View view = sqlView("source-view", """
                {"columns":{"city":{"name":["city"],"fieldId":"field-city",
                  "customName":"旧名称","comment":"源城市注释"}},
                 "hierarchy":{"city":{"name":"city","customName":"旧名称","comment":"旧层级注释"}}}
                """);
        source.add(view);
        String savedModel = view.getModel();
        source.fields.updateCustomName(view, "field-city", " 用户所在城市 ");

        ViewResourceModel exported = source.views.exportResource(mock(TransferConfig.class), Set.of(view.getId()));
        assertEquals(savedModel, view.getModel(), "Export must project onto an independent model");
        Fixture target = new Fixture(null);
        target.views.importResource(roundTrip(exported, 2), ImportStrategy.NEW, "target-org");

        ViewFieldDTO restored = target.fields.get(view.getId(), "field-city");
        assertEquals("用户所在城市", restored.getCustomName());
        assertEquals("用户所在城市", restored.getDisplayName());
        assertEquals("源城市注释", restored.getSourceComment());
        View imported = target.savedViews.get(view.getId());
        assertFalse(imported.getModel().contains("__datartFieldMetadata"));
        target.fields.reconcile(imported);
        assertEquals("用户所在城市", target.fields.get(view.getId(), "field-city").getCustomName());
    }

    @Test
    void clearedNameNullSourceCommentAndComputedAnnotationSurviveRoundTrip() throws Exception {
        Fixture source = new Fixture(null);
        View view = new View();
        view.setId("computed-view");
        view.setName("计算字段视图");
        view.setOrgId("source-org");
        view.setSourceId("source-1");
        view.setType("STRUCT");
        view.setModel("""
                {"columns":{"city":{"name":["db","users","city"],"fieldId":"field-city",
                    "customName":"已清空的旧名称","comment":"已删除的旧注释"}},
                 "hierarchy":{"city":{"name":["db","users","city"],
                    "customName":"已清空的旧名称","comment":"已删除的旧注释"}},
                 "computedFields":[{"name":"avg_price","fieldId":"field-average",
                    "category":"COMPUTED","type":"NUMBER","expression":"amount / count"},
                   {"name":"net_average","fieldId":"field-net-average","category":"COMPUTED",
                    "type":"NUMBER","expression":"net_amount / count","comment":"已删除的计算注释"}]}
                """);
        source.add(view);
        source.fields.updateCustomName(view, "field-city", null);
        source.store.selectById("field-city").setSourceComment(null);
        source.store.selectById("field-average").setSourceComment("平均价格");
        String savedModel = view.getModel();

        ViewResourceModel exported = source.views.exportResource(mock(TransferConfig.class), Set.of(view.getId()));
        assertEquals(savedModel, view.getModel());
        Fixture target = new Fixture(null);
        target.views.importResource(roundTrip(exported, 2), ImportStrategy.NEW, "target-org");

        ViewFieldDTO city = target.fields.get(view.getId(), "field-city");
        assertNull(city.getCustomName());
        assertNull(city.getSourceComment());
        assertEquals("city", city.getDisplayName());
        assertEquals(List.of("db", "users", "city"), city.getSourcePath());
        assertEquals("平均价格", target.fields.get(view.getId(), "field-average").getSourceComment());
        assertNull(target.fields.get(view.getId(), "field-net-average").getSourceComment());
        View imported = target.savedViews.get(view.getId());
        assertFalse(imported.getModel().contains("__datartFieldMetadata"));
        target.fields.reconcile(imported);
        assertNull(target.fields.get(view.getId(), "field-city").getCustomName());
        assertNull(target.fields.get(view.getId(), "field-city").getSourceComment());
        assertEquals("平均价格", target.fields.get(view.getId(), "field-average").getSourceComment());
        assertNull(target.fields.get(view.getId(), "field-net-average").getSourceComment());
    }

    @Test
    void legacyV1PackageWithoutCanonicalSnapshotStillImportsItsExplicitCustomName() throws Exception {
        View view = sqlView("legacy-view", """
                {"columns":{"city":{"name":["city"],"fieldId":"legacy-field",
                  "displayName":"历史自定义城市","comment":"源城市注释","isDisplayNameCustom":true}}}
                """);
        ViewResourceModel.MainModel main = new ViewResourceModel.MainModel();
        main.setView(view);
        main.setVariables(List.of());
        ViewResourceModel legacy = new ViewResourceModel();
        legacy.setMainModels(List.of(main));

        Fixture target = new Fixture(null);
        target.views.importResource(roundTrip(legacy, 1), ImportStrategy.NEW, "target-org");

        ViewFieldDTO field = target.fields.get(view.getId(), "legacy-field");
        assertEquals("历史自定义城市", field.getCustomName());
        assertEquals("源城市注释", field.getSourceComment());
    }

    @Test
    void importedFieldDoesNotTakeAnotherViewsExistingFieldId() throws Exception {
        Fixture source = new Fixture(null);
        View view = sqlView("source-view", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"shared-id\"}}}");
        source.add(view);
        source.fields.updateCustomName(view, "shared-id", "用户所在城市");
        ViewResourceModel exported = source.views.exportResource(mock(TransferConfig.class), Set.of(view.getId()));
        Fixture target = new Fixture(null);
        View unrelated = sqlView("other-view", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"shared-id\",\"customName\":\"其他视图\"}}}");
        target.add(unrelated);

        target.views.importResource(roundTrip(exported, 2), ImportStrategy.NEW, "target-org");

        ViewFieldDTO restored = target.fields.listByViewId(view.getId()).get(0);
        assertNotEquals("shared-id", restored.getFieldId());
        assertEquals("用户所在城市", restored.getCustomName());
        assertEquals("其他视图", target.fields.get(unrelated.getId(), "shared-id").getCustomName());
    }

    @Test
    void explicitRefreshUsesSavedDefinitionKeepsCustomNameAndDoesNotTouchOtherViews() throws Exception {
        SourceSchemasMapperExt schemas = mock(SourceSchemasMapperExt.class);
        SourceSchemas schema = new SourceSchemas();
        schema.setSchemas(schemaJson("原始城市注释"));
        when(schemas.selectBySource("source-1")).thenReturn(schema);
        SourceSchemaIndex index = new SourceSchemaIndex(schemas, new ObjectMapper());
        Fixture fixture = new Fixture(index);
        View saved = sqlView("saved-view", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"saved-field\"}}}");
        saved.setScript("SELECT u.city FROM db.users u");
        fixture.add(saved);
        fixture.fields.updateCustomName(saved, "saved-field", "自定义城市");
        View other = sqlView("other-view", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"other-field\"}}}");
        other.setScript(saved.getScript());
        fixture.add(other);
        schema.setSchemas(schemaJson("更新后的城市注释"));
        index.invalidate("source-1");

        ViewDetailDTO refreshed = fixture.views.refreshFieldMetadata(saved.getId());

        verify(fixture.views).requirePermission(saved, Const.MANAGE);
        assertEquals("SELECT u.city FROM db.users u", refreshed.getScript());
        assertEquals("saved-field", refreshed.getFields().get(0).getFieldId());
        assertEquals("更新后的城市注释", refreshed.getFields().get(0).getSourceComment());
        assertEquals("自定义城市", refreshed.getFields().get(0).getDisplayName());
        assertEquals("原始城市注释", fixture.fields.get(other.getId(), "other-field").getSourceComment());
    }

    @Test
    void explicitRefreshChecksManageBeforeMutatingMetadata() {
        Fixture fixture = new Fixture(null);
        View view = sqlView("read-only-view", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"field-city\",\"comment\":\"城市\"}}}");
        fixture.add(view);
        doThrow(new SecurityException("read-only user")).when(fixture.views).requirePermission(view, Const.MANAGE);
        int writes = fixture.store.writes;

        assertThrows(SecurityException.class, () -> fixture.views.refreshFieldMetadata(view.getId()));

        assertEquals(writes, fixture.store.writes);
        verify(fixture.viewMapper, never()).updateByPrimaryKey(any());
        assertEquals("城市", fixture.fields.get(view.getId(), "field-city").getSourceComment());
    }

    @Test
    void newJoinedFieldTracksUpstreamEffectiveNameWithoutCreatingALocalOverride() {
        Fixture fixture = new Fixture(null);
        View upstream = sqlView("upstream", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"upstream-field\",\"comment\":\"城市\"}}}");
        fixture.add(upstream);
        fixture.fields.updateCustomName(upstream, "upstream-field", "上游自定义城市");
        View joined = joinedView("joined", "joined-field");
        fixture.add(joined);

        ViewFieldDTO initial = fixture.fields.get(joined.getId(), "joined-field");
        assertNull(initial.getCustomName());
        assertEquals("上游自定义城市", initial.getSourceComment());
        fixture.fields.updateCustomName(upstream, "upstream-field", "上游新的中文");
        fixture.views.refreshFieldMetadata(joined.getId());

        ViewFieldDTO refreshed = fixture.fields.get(joined.getId(), "joined-field");
        assertNull(refreshed.getCustomName());
        assertEquals("上游新的中文", refreshed.getDisplayName());
    }

    @Test
    void existingJoinedOverrideStaysProtectedAndClearingItUsesCurrentUpstreamName() {
        Fixture fixture = new Fixture(null);
        View upstream = sqlView("upstream", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"upstream-field\",\"comment\":\"城市\"}}}");
        fixture.add(upstream);
        View joined = joinedView("joined", "joined-field");
        fixture.add(joined);
        fixture.fields.updateCustomName(joined, "joined-field", "旧快照或人工覆盖");
        // A stale editor model must not revive this value after a clear.
        joined.setModel(joined.getModel().replace("\"name\":[\"city\"]", "\"name\":[\"city\"],\"customName\":\"过期model名称\""));
        fixture.fields.updateCustomName(upstream, "upstream-field", "上游新名称");

        fixture.views.refreshFieldMetadata(joined.getId());
        assertEquals("旧快照或人工覆盖", fixture.fields.get(joined.getId(), "joined-field").getCustomName());
        fixture.fields.updateCustomName(upstream, "upstream-field", "清空时的上游名称");
        ViewFieldDTO cleared = fixture.fields.updateCustomName(joined, "joined-field", " ");

        assertNull(cleared.getCustomName());
        assertEquals("清空时的上游名称", cleared.getDisplayName());
        fixture.fields.reconcile(joined);
        assertNull(fixture.fields.get(joined.getId(), "joined-field").getCustomName());
    }

    @Test
    void clearingAFieldFromAnotherViewFailsBeforeReconciliation() {
        Fixture fixture = new Fixture(null);
        View first = sqlView("first", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"first-field\"}}}");
        View second = sqlView("second", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"second-field\",\"customName\":\"第二个视图\"}}}");
        fixture.add(first);
        fixture.add(second);
        int writes = fixture.store.writes;

        assertThrows(IllegalArgumentException.class,
                () -> fixture.fields.updateCustomName(first, "second-field", null));

        assertEquals(writes, fixture.store.writes);
        assertEquals("第二个视图", fixture.fields.get(second.getId(), "second-field").getCustomName());
    }

    @Test
    void malformedTransferMetadataIsRejectedBeforeDeletingExistingFields() throws Exception {
        for (String malformedField : List.of(
                "{\"customName\":{},\"sourceComment\":null,\"sourcePath\":[]}",
                "{\"customName\":null,\"sourceComment\":[],\"sourcePath\":[]}",
                "{\"customName\":null,\"sourceComment\":null,\"sourcePath\":[1]}")) {
            Fixture fixture = new Fixture(null);
            View view = sqlView("import-target", "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"field-city\",\"customName\":\"原名称\"}}}");
            fixture.add(view);
            ObjectMapper json = new ObjectMapper();
            ObjectNode model = (ObjectNode) json.readTree(view.getModel());
            ObjectNode snapshot = model.putObject("__datartFieldMetadata");
            snapshot.put("version", 1);
            snapshot.putObject("fields").set("SQL|city", json.readTree(malformedField));
            view.setModel(json.writeValueAsString(model));
            int writes = fixture.store.writes;

            assertThrows(IllegalArgumentException.class, () -> fixture.fields.rebuild(view));

            assertEquals(writes, fixture.store.writes);
            assertEquals("原名称", fixture.fields.get(view.getId(), "field-city").getCustomName());
        }
    }

    private static ViewResourceModel roundTrip(ViewResourceModel views, int version) throws Exception {
        ResourceModel resource = new ResourceModel();
        resource.setViewResourceModel(views);
        Path file = Files.createTempFile("datart-field-metadata", ".datart");
        try {
            TransferFileUtils.write(resource, file.toString());
            byte[] bytes = Files.readAllBytes(file);
            if (version == 1) {
                ObjectMapper json = new ObjectMapper();
                ObjectNode envelope;
                try (GZIPInputStream input = new GZIPInputStream(new ByteArrayInputStream(bytes))) {
                    envelope = (ObjectNode) json.readTree(input);
                }
                envelope.put("formatVersion", 1);
                ByteArrayOutputStream encoded = new ByteArrayOutputStream();
                try (GZIPOutputStream output = new GZIPOutputStream(encoded)) {
                    json.writeValue(output, envelope);
                }
                bytes = encoded.toByteArray();
            }
            TransferFileUtils.TransferReadResult read = TransferFileUtils.readWithMetadata(
                    new ByteArrayInputStream(bytes), 1024 * 1024);
            assertEquals(version, read.formatVersion());
            return ((ResourceModel) read.model()).getViewResourceModel();
        } finally {
            Files.deleteIfExists(file);
        }
    }

    private static View sqlView(String id, String model) {
        View view = new View();
        view.setId(id);
        view.setName(id);
        view.setOrgId("source-org");
        view.setSourceId("source-1");
        view.setType("SQL");
        view.setModel(model);
        return view;
    }

    private static View joinedView(String id, String fieldId) {
        View view = sqlView(id, "{\"columns\":{\"city\":{\"name\":[\"city\"],\"fieldId\":\"" + fieldId + "\"}}}");
        view.setConfig("{\"lineage\":{\"outputFieldSources\":{\"city\":{\"viewId\":\"upstream\",\"columnKey\":\"city\"}}}}");
        return view;
    }

    private static String schemaJson(String comment) {
        return "[{\"dbName\":\"db\",\"tables\":[{\"tableName\":\"users\",\"columns\":[{\"name\":[\"db\",\"users\",\"city\"],\"comment\":\"" + comment + "\"}]}]}]";
    }

    private static final class Fixture {
        final FieldStore store = new FieldStore();
        final ViewFieldServiceImpl fields;
        final Map<String, View> savedViews = new LinkedHashMap<>();
        final ViewMapperExt viewMapper = mock(ViewMapperExt.class);
        final ViewServiceImpl views;

        Fixture(SourceSchemaIndex index) {
            fields = new ViewFieldServiceImpl(store, index);
            DatartSecurityManager security = mock(DatartSecurityManager.class);
            User user = new User();
            user.setId("test-user");
            when(security.getCurrentUser()).thenReturn(user);
            when(security.isOrgOwner(anyString())).thenReturn(true);
            fields.setSecurityManager(security);
            MigrationModeService modes = mock(MigrationModeService.class);
            when(modes.getMode(anyString())).thenReturn(MigrationMode.STRICT);
            views = spy(new ViewServiceImpl(viewMapper, mock(RelSubjectColumnsMapperExt.class),
                    mock(RelRoleResourceMapperExt.class), mock(RoleService.class), mock(VariableService.class),
                    mock(VariableMapperExt.class), mock(RelVariableSubjectMapperExt.class),
                    mock(DashboardMapperExt.class), mock(DatachartMapperExt.class), fields, index, null, modes));
            views.setSecurityManager(security);
            doAnswer(call -> savedViews.get(call.getArgument(0))).when(views).retrieve(anyString());
            when(viewMapper.insert(any())).thenAnswer(call -> save(call.getArgument(0)));
            when(viewMapper.updateByPrimaryKey(any())).thenAnswer(call -> save(call.getArgument(0)));
        }

        void add(View view) {
            fields.reconcile(view);
            savedViews.put(view.getId(), view);
        }

        private int save(View view) {
            savedViews.put(view.getId(), view);
            return 1;
        }
    }

    private static final class FieldStore implements ViewFieldMapperExt {
        private final Map<String, ViewField> fields = new LinkedHashMap<>();
        private int writes;

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
            ViewField field = fields.get(fieldId);
            return field != null && viewId.equals(field.getViewId()) ? field : null;
        }

        @Override
        public ViewField selectById(String fieldId) {
            return fields.get(fieldId);
        }

        @Override
        public int insert(ViewField field) {
            writes++;
            fields.put(field.getId(), field);
            return 1;
        }

        @Override
        public int update(ViewField field) {
            writes++;
            fields.put(field.getId(), field);
            return 1;
        }
    }
}
