package datart.server.common;

import datart.core.base.consts.ValueType;
import datart.core.data.provider.Column;
import datart.core.data.provider.Dataframe;
import datart.core.data.provider.QueryOutputProjection;
import datart.core.data.provider.ResultFieldMeta;
import datart.core.entity.poi.ColumnSetting;
import datart.server.base.dto.chart.ChartColumn;
import org.junit.jupiter.api.Test;
import java.util.*;
import static org.junit.jupiter.api.Assertions.assertEquals;

class PoiConvertUtilsDisplayNameTest {

    private Dataframe result(String display) {
        Dataframe frame = new Dataframe();
        frame.setColumns(List.of(Column.of(ValueType.STRING, "city")));
        ResultFieldMeta metadata = new ResultFieldMeta();
        metadata.setOrdinal(0);
        metadata.setTechnicalName("city");
        metadata.setDisplayName(display);
        frame.setResultFields(List.of(metadata));
        return frame;
    }

    @Test
    void usesFieldMetadataUnlessChartAliasOverridesIt() {
        ChartColumn config = new ChartColumn();
        config.setColName("city");
        Map<Integer, List<Column>> headers = new HashMap<>();
        headers.put(0, new ArrayList<>(List.of(Column.of(ValueType.STRING, "city"))));
        PoiConvertUtils.replaceColumnAlias(List.of(config), headers, result("城市"), Map.of());
        assertEquals("城市", headers.get(0).get(0).columnName());

        config.getAlias().setName("所在城市");
        headers.get(0).set(0, Column.of(ValueType.STRING, "city"));
        PoiConvertUtils.replaceColumnAlias(List.of(config), headers, result("城市"), Map.of());
        assertEquals("所在城市", headers.get(0).get(0).columnName());
    }

    @Test
    void keepsDeclaredColumnOrderWhenOutputOrdinalsDiffer() {
        ChartColumn config = new ChartColumn();
        config.setColName("city");
        Map<Integer, List<Column>> headers = Map.of(
                0, new ArrayList<>(List.of(Column.of(ValueType.STRING, "city"))));
        ColumnSetting setting = new ColumnSetting();
        setting.setIndex(0);
        PoiConvertUtils.replaceColumnAlias(List.of(config), headers, result("城市"), Map.of(0, setting));
        assertEquals("城市", headers.get(0).get(0).columnName());
    }
}
