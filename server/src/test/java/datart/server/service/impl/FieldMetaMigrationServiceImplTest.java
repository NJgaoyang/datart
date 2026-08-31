package datart.server.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.entity.ViewField;
import datart.core.entity.View;
import datart.core.mappers.ext.FieldMetaMigrationMapperExt;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.security.manager.DatartSecurityManager;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.common.fieldmeta.SourceSchemaIndex;
import datart.server.common.fieldmeta.StrictJson;
import datart.server.service.ViewFieldService;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.jdbc.core.JdbcTemplate;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class FieldMetaMigrationServiceImplTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    @Test
    void rollbackRestoresUpdatedViewField() throws Exception {
        ViewField original = field("field-1", "旧名称", "旧注释", true);
        ViewField migrated = field("field-1", "迁移名称", "新注释", false);
        ViewFieldMapperExt viewFieldMapper = mock(ViewFieldMapperExt.class);
        when(viewFieldMapper.selectByViewIdAndId("view-1", "field-1")).thenReturn(migrated);
        when(viewFieldMapper.update(any(ViewField.class))).thenReturn(1);

        JdbcTemplate jdbcTemplate = jdbcFor(viewFieldBackup("view-1", "field-1", JSON.writeValueAsString(original), migrated));
        service(jdbcTemplate, viewFieldMapper).rollback("run-1");

        ArgumentCaptor<ViewField> restored = ArgumentCaptor.forClass(ViewField.class);
        verify(viewFieldMapper).update(restored.capture());
        assertEquals("旧名称", restored.getValue().getCustomName());
        assertEquals("旧注释", restored.getValue().getSourceComment());
        assertEquals(true, restored.getValue().getActive());
    }

    @Test
    void rollbackDeletesMigrationInsertedViewField() {
        ViewField inserted = field("field-new", "迁移名称", "新注释", true);
        ViewFieldMapperExt viewFieldMapper = mock(ViewFieldMapperExt.class);
        when(viewFieldMapper.selectByViewIdAndId("view-1", "field-new")).thenReturn(inserted);

        JdbcTemplate jdbcTemplate = jdbcFor(viewFieldBackup("view-1", "field-new", null, inserted));
        when(jdbcTemplate.update("DELETE FROM view_field WHERE id = ? AND view_id = ?", "field-new", "view-1"))
                .thenReturn(1);

        service(jdbcTemplate, viewFieldMapper).rollback("run-1");

        verify(jdbcTemplate).update("DELETE FROM view_field WHERE id = ? AND view_id = ?", "field-new", "view-1");
        verify(viewFieldMapper, never()).update(any(ViewField.class));
    }

    @Test
    void rollbackRejectsViewFieldChangedAfterMigration() {
        ViewField migrated = field("field-1", "迁移名称", "新注释", true);
        ViewField editedAfterMigration = field("field-1", "用户后续修改", "新注释", true);
        ViewFieldMapperExt viewFieldMapper = mock(ViewFieldMapperExt.class);
        when(viewFieldMapper.selectByViewIdAndId("view-1", "field-1")).thenReturn(editedAfterMigration);
        JdbcTemplate jdbcTemplate = jdbcFor(viewFieldBackup("view-1", "field-1", "{}", migrated));

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service(jdbcTemplate, viewFieldMapper).rollback("run-1"));

        assertEquals("ROLLBACK_CONFLICT: VIEW_FIELD field-1", error.getMessage());
        verify(viewFieldMapper, never()).update(any(ViewField.class));
        verify(jdbcTemplate, never()).update("DELETE FROM view_field WHERE id = ? AND view_id = ?", "field-1", "view-1");
    }

    @Test
    void scanSeparatesRecoverableSqlMetadataFromUnresolvedAliases() {
        FieldMetaMigrationMapperExt migrationMapper = mock(FieldMetaMigrationMapperExt.class);
        View view = new View();
        view.setId("view-1");
        view.setName("SQL View");
        view.setOrgId("org-1");
        view.setSourceId("source-1");
        view.setType("SQL");
        view.setModel("""
                {"columns":{
                  "net":{"name":["net_increase_users"],"displayName":"在租用户较昨日净增人数"},
                  "city":{"name":["city"],"comment":"城市"},
                  "efficiency":{"name":["cabinet_efficiency"]}
                }}
                """);
        when(migrationMapper.listDatasetViews("org-1")).thenReturn(List.of(view));
        when(migrationMapper.listWidgets("org-1")).thenReturn(List.of());
        when(migrationMapper.listDatacharts("org-1")).thenReturn(List.of());

        SourceSchemasMapperExt sourceSchemasMapper = mock(SourceSchemasMapperExt.class);
        ViewFieldService viewFieldService = mock(ViewFieldService.class);
        when(viewFieldService.listByViewId("view-1")).thenReturn(List.of());
        FieldMetaMigrationServiceImpl service = new FieldMetaMigrationServiceImpl(
                migrationMapper,
                new SourceSchemaIndex(sourceSchemasMapper, JSON),
                new StrictJson(JSON),
                mock(JdbcTemplate.class),
                viewFieldService,
                mock(ViewFieldMapperExt.class));
        service.setSecurityManager(mock(DatartSecurityManager.class));

        FieldMetaMigrationScan scan = service.scan("org-1");

        assertEquals(1, scan.getViews().getSqlViews());
        assertEquals(3, scan.getViews().getSqlFields());
        assertEquals(1, scan.getViews().getRecoverableCustomNames());
        assertEquals(1, scan.getViews().getRecoverableLegacyComments());
        assertEquals(1, scan.getViews().getUnresolvedSqlFields());
        assertEquals(List.of("SQL_COMMENT_RECOVERABLE_FROM_COLUMNS", "SQL_CUSTOM_NAME_RECOVERABLE",
                        "SQL_FIELD_NO_TRUSTED_DISPLAY_METADATA"),
                scan.getIssues().stream().map(issue -> issue.getReason()).sorted().collect(Collectors.toList()));
    }

    private static FieldMetaMigrationServiceImpl service(JdbcTemplate jdbcTemplate, ViewFieldMapperExt viewFieldMapper) {
        return new FieldMetaMigrationServiceImpl(
                mock(FieldMetaMigrationMapperExt.class),
                mock(SourceSchemaIndex.class),
                new StrictJson(JSON),
                jdbcTemplate,
                mock(ViewFieldService.class),
                viewFieldMapper);
    }

    private static JdbcTemplate jdbcFor(Map<String, Object> viewFieldBackup) {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation ->
                invocation.getArgument(0, String.class).contains("field_meta_migration_view_field_backup")
                        ? List.of(viewFieldBackup)
                        : List.of());
        when(jdbcTemplate.update(anyString(), any(Object[].class))).thenReturn(1);
        return jdbcTemplate;
    }

    private static Map<String, Object> viewFieldBackup(String viewId, String fieldId, String original,
                                                        ViewField migrated) {
        Map<String, Object> backup = new HashMap<>();
        backup.put("view_id", viewId);
        backup.put("field_id", fieldId);
        backup.put("original_json", original);
        backup.put("migrated_json_hash", sha256(json(migrated)));
        return backup;
    }

    private static ViewField field(String id, String customName, String sourceComment, boolean active) {
        ViewField field = new ViewField();
        field.setId(id);
        field.setViewId("view-1");
        field.setCanonicalKey("SQL|net_increase_users");
        field.setOriginName("net_increase_users");
        field.setCustomName(customName);
        field.setSourceComment(sourceComment);
        field.setSourcePath("[\"net_increase_users\"]");
        field.setFieldType("STRING");
        field.setFieldCategory("");
        field.setOrdinal(0);
        field.setActive(active);
        return field;
    }

    private static String json(ViewField field) {
        try {
            return JSON.writeValueAsString(field);
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte b : digest) {
                result.append(String.format("%02x", b));
            }
            return result.toString();
        } catch (Exception e) {
            throw new AssertionError(e);
        }
    }
}
