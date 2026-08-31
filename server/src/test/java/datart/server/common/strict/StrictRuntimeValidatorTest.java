package datart.server.common.strict;

import com.alibaba.fastjson2.JSON;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.data.provider.QueryOutputProjection;
import datart.core.data.provider.sql.AggregateOperator;
import datart.core.data.provider.sql.FunctionColumn;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.server.base.params.ViewExecuteParam;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class StrictRuntimeValidatorTest {

    private final ViewFieldMapperExt mapper = mock(ViewFieldMapperExt.class);
    private final StrictRuntimeValidator validator = new StrictRuntimeValidator(mapper);

    @Test
    void rejectsMissingFieldId() {
        ViewExecuteParam param = param(null);

        StrictFieldReferenceException error = assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param));
        org.junit.jupiter.api.Assertions.assertTrue(error.getMessage().contains("STRICT_FIELD_ID_REQUIRED"));
    }

    @Test
    void acceptsNonAggregateComputedProjection() {
        QueryOutputProjection projection = projection(null, "computed_total");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        FunctionColumn function = new FunctionColumn();
        function.setAlias("computed_total");
        function.setSnippet("[orders]+[returns]");
        param.setFunctionColumns(List.of(function));

        assertDoesNotThrow(() -> validator.validate(view(), param));
    }

    @Test
    void acceptsAggregateComputedProjectionThroughAggregatorAndFunctionColumn() {
        QueryOutputProjection projection = projection(null, "SUM(直营总订单数)");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        FunctionColumn function = new FunctionColumn();
        function.setAlias("直营总订单数");
        function.setSnippet("[channel_orders]+[direct_orders]+[douyin_orders]");
        param.setFunctionColumns(List.of(function));
        AggregateOperator aggregator = new AggregateOperator();
        aggregator.setAlias("SUM(直营总订单数)");
        aggregator.setColumn("直营总订单数");
        aggregator.setSqlOperator(AggregateOperator.SqlOperator.SUM);
        param.setAggregators(List.of(aggregator));

        assertDoesNotThrow(() -> validator.validate(view(), param));
    }

    @Test
    void acceptsRealDashboardPayloadAfterObjectMapperDeserialization() throws Exception {
        String payload = realDashboardPayload();

        ViewExecuteParam param = new ObjectMapper().readValue(payload,
                new TypeReference<List<ViewExecuteParam>>() { }).get(0);

        QueryOutputProjection projection = param.getOutputProjections().get(2);
        assertEquals("SUM(直营总订单数)", projection.getTechnicalAlias());
        assertNull(projection.getFieldId());
        assertEquals("SUM(直营总订单数)", param.getAggregators().get(1).getAlias());
        assertEquals("直营总订单数", param.getAggregators().get(1).getColumnKey());
        assertEquals("直营总订单数", param.getFunctionColumns().get(0).getAlias());
        assertEquals("[channel_orders]+[direct_orders]+[douyin_orders]",
                param.getFunctionColumns().get(0).getSnippet());

        View view = view();
        view.setId("2981ad9e6e284db6888eac339f39090f");
        when(mapper.listByViewId(view.getId())).thenReturn(List.of(
                field("af6fa60ae0ac4131950611f76df7cfc5", view.getId(), true),
                field("49c39453ebf3484d907f0569ddd688d5", view.getId(), true)));

        assertDoesNotThrow(() -> validator.validate(view, param));
    }

    @Test
    void acceptsRealDashboardPayloadAfterFastjsonDeserialization() {
        ViewExecuteParam param = JSON.parseArray(realDashboardPayload(), ViewExecuteParam.class).get(0);

        assertEquals("SUM(直营总订单数)", param.getOutputProjections().get(2).getTechnicalAlias());
        assertNull(param.getOutputProjections().get(2).getFieldId());
        assertEquals("SUM(直营总订单数)", param.getAggregators().get(1).getAlias());
        assertEquals("直营总订单数", param.getAggregators().get(1).getColumnKey());
        assertEquals("直营总订单数", param.getFunctionColumns().get(0).getAlias());
        assertEquals("[channel_orders]+[direct_orders]+[douyin_orders]",
                param.getFunctionColumns().get(0).getSnippet());

        View view = view();
        view.setId("2981ad9e6e284db6888eac339f39090f");
        when(mapper.listByViewId(view.getId())).thenReturn(List.of(
                field("af6fa60ae0ac4131950611f76df7cfc5", view.getId(), true),
                field("49c39453ebf3484d907f0569ddd688d5", view.getId(), true)));

        assertDoesNotThrow(() -> validator.validate(view, param));
    }

    private static String realDashboardPayload() {
        return """
                [{
                  "requestId":"7205458f724e4924a9844585200c6da8",
                  "viewId":"2981ad9e6e284db6888eac339f39090f",
                  "aggregators":[
                    {"alias":"SUM(total_orders)","column":["total_orders"],"sqlOperator":"SUM"},
                    {"alias":"SUM(直营总订单数)","column":["直营总订单数"],"sqlOperator":"SUM"}
                  ],
                  "groups":[{"alias":"city","column":["city"]}],
                  "functionColumns":[
                    {"alias":"直营总订单数","snippet":"[channel_orders]+[direct_orders]+[douyin_orders]"}
                  ],
                  "outputProjections":[
                    {"fieldId":"af6fa60ae0ac4131950611f76df7cfc5","technicalAlias":"city","displayAlias":"city","ordinal":0},
                    {"fieldId":"49c39453ebf3484d907f0569ddd688d5","technicalAlias":"SUM(total_orders)","displayAlias":"总订单数","ordinal":1},
                    {"technicalAlias":"SUM(直营总订单数)","displayAlias":"直营总订单数","ordinal":2}
                  ]
                }]
                """;
    }

    @Test
    void rejectsDisplayAliasWithoutStructuredComputedRelation() {
        QueryOutputProjection projection = projection(null, "not_a_computed_field");
        projection.setDisplayAlias("not_a_computed_field");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param));
    }

    @Test
    void rejectsComputedProjectionWithEmptyFunctionSnippet() {
        QueryOutputProjection projection = projection(null, "computed_total");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        FunctionColumn function = new FunctionColumn();
        function.setAlias("computed_total");
        function.setSnippet(" ");
        param.setFunctionColumns(List.of(function));
        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param));
    }

    @Test
    void rejectsAggregateComputedProjectionWithoutFunctionColumn() {
        QueryOutputProjection projection = projection(null, "SUM(computed_total)");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        AggregateOperator aggregator = new AggregateOperator();
        aggregator.setAlias("SUM(computed_total)");
        aggregator.setColumn("computed_total");
        param.setAggregators(List.of(aggregator));

        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param));
    }

    @Test
    void rejectsAmbiguousComputedFunctionMatch() {
        QueryOutputProjection projection = projection(null, "computed_total");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        FunctionColumn first = new FunctionColumn();
        first.setAlias("computed_total");
        first.setSnippet("[orders]");
        FunctionColumn second = new FunctionColumn();
        second.setAlias("computed_total");
        second.setSnippet("[returns]");
        param.setFunctionColumns(List.of(first, second));

        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param));
    }

    @Test
    void rejectsAggregateComputedProjectionWithMultipleColumns() {
        QueryOutputProjection projection = projection(null, "SUM(computed_total)");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        AggregateOperator aggregator = new AggregateOperator();
        aggregator.setAlias("SUM(computed_total)");
        aggregator.setColumn("computed_total", "other");
        param.setAggregators(List.of(aggregator));

        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param));
    }

    @Test
    void acceptsActiveCanonicalField() {
        ViewField field = field("field-1", "view-1", true);
        when(mapper.listByViewId("view-1")).thenReturn(List.of(field));

        assertDoesNotThrow(() -> validator.validate(view(), param("field-1")));
        verify(mapper, never()).selectById(anyString());
    }

    @Test
    void rejectsInactiveField() {
        when(mapper.listByViewId("view-1")).thenReturn(List.of(field("field-1", "view-1", false)));

        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param("field-1")));
    }

    @Test
    void rejectsFieldFromAnotherView() {
        ViewField foreign = field("field-1", "view-2", true);
        when(mapper.listByViewId("view-1")).thenReturn(List.of());
        when(mapper.selectById("field-1")).thenReturn(foreign);

        assertThrows(StrictFieldReferenceException.class,
                () -> validator.validate(view(), param("field-1")));
    }

    private static View view() {
        View view = new View();
        view.setId("view-1");
        return view;
    }

    private static ViewField field(String id, String viewId, boolean active) {
        ViewField field = new ViewField();
        field.setId(id);
        field.setViewId(viewId);
        field.setActive(active);
        return field;
    }

    private static ViewExecuteParam param(String fieldId) {
        QueryOutputProjection projection = projection(fieldId, "city");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        return param;
    }

    private static QueryOutputProjection projection(String fieldId, String technicalAlias) {
        QueryOutputProjection projection = new QueryOutputProjection();
        projection.setFieldId(fieldId);
        projection.setTechnicalAlias(technicalAlias);
        return projection;
    }
}
