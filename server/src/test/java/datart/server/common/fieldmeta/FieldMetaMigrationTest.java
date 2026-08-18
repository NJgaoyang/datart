package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.server.base.dto.FieldMetaMigrationIssueSeverity;
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
}
