package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.server.base.dto.FieldMetaMigrationIssueSeverity;
import datart.server.base.dto.ViewFieldDTO;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FieldMetaMigrationTest {

    private final ObjectMapper mapper = new ObjectMapper();

    @Test
    void migratesColumnsAndHierarchyFromOneFallbackDecision() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "columns": {"order_id": {"name": ["orders", "order_id"], "displayName": "订单编号", "comment": "订单编号"}},
                  "hierarchy": {"order_id": {"name": ["orders", "order_id"], "displayName": "订单编号", "comment": "订单编号"}}
                }
                """);

        ViewModelMigrator.Result result = new ViewModelMigrator().migrate(model, SourceSchemaIndex.Index.empty());

        assertTrue(result.issues().isEmpty());
        assertFalse(result.model().at("/columns/order_id/displayName").isTextual());
        assertFalse(result.model().at("/hierarchy/order_id/displayName").isTextual());
        assertEquals(false, result.model().at("/columns/order_id/isDisplayNameCustom").asBoolean());
        assertEquals(false, result.model().at("/hierarchy/order_id/isDisplayNameCustom").asBoolean());
    }

    @Test
    void canonicalModelIsIdempotentAndPreservesFieldIdentity() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "columns": {"renting_users": {"fieldId": "field-renting", "name": ["daily", "renting_users"], "displayName": "在租用户数", "comment": "在租用户数", "isDisplayNameCustom": false}},
                  "hierarchy": {"renting_users": {"fieldId": "field-renting", "name": ["daily", "renting_users"], "displayName": "在租用户数", "comment": "在租用户数", "isDisplayNameCustom": false}}
                }
                """);

        ViewModelMigrator migrator = new ViewModelMigrator();
        ViewModelMigrator.Result first = migrator.migrate(model, SourceSchemaIndex.Index.empty());
        ViewModelMigrator.Result second = migrator.migrate(first.model(), SourceSchemaIndex.Index.empty());

        assertEquals(2, first.changedNodes());
        assertEquals(0, second.changedNodes());
        assertEquals("field-renting", second.model().at("/columns/renting_users/fieldId").asText());
        assertFalse(second.model().at("/columns/renting_users/displayName").isTextual());
        assertFalse(second.model().at("/hierarchy/renting_users/displayName").isTextual());
        assertEquals("在租用户数", second.model().at("/columns/renting_users/comment").asText());
    }

    @Test
    void preservesExplicitCustomNameWhileCanonicalizingModel() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "columns": {"renting_users": {"fieldId": "field-renting", "name": ["daily", "renting_users"], "displayName": "当前租用人数", "comment": "在租用户数", "isDisplayNameCustom": true}}
                }
                """);

        ViewModelMigrator.Result result = new ViewModelMigrator().migrate(model, SourceSchemaIndex.Index.empty());

        assertTrue(result.issues().isEmpty());
        assertEquals("当前租用人数", result.model().at("/columns/renting_users/displayName").asText());
        assertEquals("在租用户数", result.model().at("/columns/renting_users/comment").asText());
        assertTrue(result.model().at("/columns/renting_users/isDisplayNameCustom").asBoolean());
    }

    @Test
    void doesNotCreateViewFieldIdentityForChartComputedField() throws Exception {
        ObjectNode chart = (ObjectNode) mapper.readTree("""
                {"chartConfig":{"datas":[{"rows":[
                  {"category":"computedField","colName":"直营总订单数"}
                ]}],"computedFields":[
                  {"name":"直营总订单数","category":"computedField","expression":"[channel_orders]+[direct_orders]"}
                ]}}
                """);

        ChartConfigReconciler.Result result = new ChartConfigReconciler()
                .reconcile(chart, List.of());

        assertEquals(0, result.rows());
        assertEquals(0, result.issues().size());
        assertFalse(chart.at("/chartConfig/datas/0/rows/0/fieldId").isValueNode());
    }

    @Test
    void blocksConflictingColumnsAndHierarchyCustomNames() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "columns": {"id": {"name": ["users", "id"], "displayName": "用户编号"}},
                  "hierarchy": {"id": {"name": ["users", "id"], "displayName": "客户编号"}}
                }
                """);

        ViewModelMigrator.Result result = new ViewModelMigrator().migrate(model, SourceSchemaIndex.Index.empty());

        assertEquals(1, result.issues().size());
        assertEquals("LEGACY_CUSTOM_DIVERGENCE", result.issues().get(0).reason());
        assertEquals("用户编号", result.issues().get(0).diagnostics().columnDisplayName());
    }

    @Test
    void resolvesSqlCommentDivergenceFromColumnsAsWarning() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "columns": {"id": {"name": ["users", "id"], "comment": "用户编号"}},
                  "hierarchy": {"id": {"name": ["users", "id"], "comment": "客户编号"}}
                }
                """);

        ViewModelMigrator.Result result = new ViewModelMigrator().migrate(model, SourceSchemaIndex.Index.empty(), "SQL");

        assertEquals(1, result.issues().size());
        assertEquals("SQL_COMMENT_RESOLVED_FROM_COLUMNS", result.issues().get(0).reason());
        assertEquals(FieldMetaMigrationIssueSeverity.WARNING, result.issues().get(0).severity());
        assertEquals("客户编号", result.issues().get(0).diagnostics().hierarchyComment());
        assertEquals("用户编号", result.model().at("/columns/id/comment").asText());
        assertEquals("用户编号", result.model().at("/hierarchy/id/comment").asText());
        assertFalse(result.model().at("/columns/id/displayName").isTextual());
        assertFalse(result.model().at("/hierarchy/id/displayName").isTextual());
    }

    @Test
    void keepsHierarchyAsHierarchyWhenColumnsAreAbsent() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "hierarchy": {"city": {"name": ["city"], "comment": "城市"}}
                }
                """);

        ViewModelMigrator.Result result = new ViewModelMigrator().migrate(model, SourceSchemaIndex.Index.empty(), "SQL");

        assertTrue(result.issues().isEmpty());
        assertEquals("城市", result.fields().get(0).diagnostics().hierarchyComment());
        assertEquals(null, result.fields().get(0).diagnostics().columnComment());
    }

    @Test
    void blocksDuplicateSqlOutputNames() throws Exception {
        ObjectNode model = (ObjectNode) mapper.readTree("""
                {
                  "columns": {
                    "first": {"name": ["first", "id"]},
                    "second": {"name": ["second", "id"]}
                  }
                }
                """);

        ViewModelMigrator.Result result = new ViewModelMigrator().migrate(model, SourceSchemaIndex.Index.empty(), "SQL");

        assertEquals(1, result.issues().size());
        assertEquals("SQL_OUTPUT_COLUMN_DUPLICATED", result.issues().get(0).reason());
        assertEquals(FieldMetaMigrationIssueSeverity.BLOCKING, result.issues().get(0).severity());
    }

    @Test
    void reconcilesChartMetadataWithoutTouchingAlias() throws Exception {
        ObjectNode chart = (ObjectNode) mapper.readTree("""
                {"datas":[{"rows":[
                  {"category":"field","colName":"order_id","alias":"订单量"},
                  {"category":"dateLevelComputedField","field":"created_at","name":"created_at@date_level_delimiter@AGG_DATE_DAY","alias":"日期"}
                ]}]}
                """);
        ResolvedFieldMeta order = new ResolvedFieldMeta("orders.order_id", List.of("orders", "order_id"),
                "order_id", "订单编号", "订单号", true,
                ResolvedFieldMeta.Status.CUSTOM_CONFIDENT, "test");
        ResolvedFieldMeta date = new ResolvedFieldMeta("created_at", List.of("created_at"),
                "created_at", "创建时间", null, false,
                ResolvedFieldMeta.Status.FALLBACK_CONFIDENT, "test");

        ChartConfigReconciler.Result result = new ChartConfigReconciler().reconcile(chart, Map.of(
                order.fieldKey(), order,
                date.fieldKey(), date));

        assertEquals(2, result.rows());
        assertEquals(0, result.issues().size());
        assertEquals("订单量", chart.at("/datas/0/rows/0/alias").asText());
        assertEquals("订单号", chart.at("/datas/0/rows/0/displayName").asText());
        assertEquals("日期", chart.at("/datas/0/rows/1/alias").asText());
        assertFalse(chart.at("/datas/0/rows/1/displayName").isTextual());
    }

    @Test
    void addsFieldIdByExactPathAndRejectsInactiveField() throws Exception {
        ObjectNode chart = (ObjectNode) mapper.readTree("""
                {"datas":[{"rows":[
                  {"category":"field","colName":"id","path":["db","user","id"]},
                  {"category":"field","colName":"old_id","fieldId":"inactive"}
                ]}]}
                """);
        ViewFieldDTO active = field("field-1", "id", List.of("db", "user", "id"), true);
        ViewFieldDTO inactive = field("inactive", "old_id", List.of("db", "user", "old_id"), false);

        ChartConfigReconciler.Result result = new ChartConfigReconciler().reconcile(chart, List.of(active, inactive));

        assertEquals(2, result.rows());
        assertEquals("field-1", chart.at("/datas/0/rows/0/fieldId").asText());
        assertEquals("FIELD_INACTIVE", result.issues().get(0).reason());
    }

    @Test
    void resolvesLegacyQualifiedColumnNameAgainstCanonicalSourcePath() throws Exception {
        ObjectNode chart = (ObjectNode) mapper.readTree("""
                {"datas":[{"rows":[
                  {"category":"field","colName":"dim_date.month_start_date"}
                ]}]}
                """);
        ViewFieldDTO field = field("field-month", "month_start_date",
                List.of("dim_date", "month_start_date"), true);

        ChartConfigReconciler.Result result = new ChartConfigReconciler()
                .reconcile(chart, List.of(field));

        assertEquals(1, result.rows());
        assertEquals(0, result.issues().size());
        assertEquals("field-month", chart.at("/datas/0/rows/0/fieldId").asText());
    }

    @Test
    void strictValidationRequiresCanonicalFieldId() throws Exception {
        ObjectNode chart = (ObjectNode) mapper.readTree("""
                {"datas":[{"rows":[
                  {"category":"field","colName":"city","path":["city"]},
                  {"category":"field","colName":"old","fieldId":"missing","path":["city"]}
                ]}]}
                """);
        ViewFieldDTO field = field("field-city", "city", List.of("city"), true);

        ChartConfigReconciler.Result result = new ChartConfigReconciler()
                .validateStrict(chart, List.of(field));

        assertEquals(2, result.rows());
        assertEquals("STRICT_FIELD_ID_REQUIRED", result.issues().get(0).reason());
        assertEquals("STRICT_FIELD_NOT_FOUND", result.issues().get(1).reason());
    }

    private static ViewFieldDTO field(String id, String name, List<String> path, boolean active) {
        ViewFieldDTO field = new ViewFieldDTO();
        field.setFieldId(id);
        field.setOriginName(name);
        field.setSourcePath(path);
        field.setActive(active);
        return field;
    }
}
