package datart.server.service.impl;

import datart.core.entity.Datachart;
import datart.server.base.dto.ViewFieldDTO;
import datart.server.common.strict.StrictFieldReferenceException;
import datart.server.service.*;
import datart.core.mappers.ext.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class DatachartStrictOnlyImportTest {
    private ViewFieldService fields;
    private DatachartServiceImpl service;

    @BeforeEach
    void setup() {
        fields = mock(ViewFieldService.class);
        service = new DatachartServiceImpl(
                mock(RoleService.class),
                mock(FileService.class),
                mock(FolderMapperExt.class),
                mock(RelRoleResourceMapperExt.class),
                mock(FolderService.class),
                mock(DatachartMapperExt.class),
                mock(ViewService.class),
                mock(VariableService.class),
                fields,
                mock(MigrationModeService.class));
        ViewFieldDTO field = new ViewFieldDTO();
        field.setFieldId("field-city");
        field.setActive(true);
        when(fields.listByViewId("view-city")).thenReturn(List.of(field));
    }

    private Datachart chart(String rowJson) {
        Datachart chart = new Datachart();
        chart.setId("chart-city");
        chart.setViewId("view-city");
        chart.setConfig("{\"chartConfig\":{\"datas\":[{\"rows\":[" + rowJson + "]}]}}");
        return chart;
    }

    @Test
    void validStableFieldIdIsAcceptedWithoutLegacyRewriting() {
        Datachart chart = chart("{\"category\":\"field\",\"fieldId\":\"field-city\",\"colName\":\"city\"}");
        String original = chart.getConfig();
        service.normalizeImportedConfig(chart);
        assertEquals(original, chart.getConfig());
    }

    @Test
    void importedChartCannotInferMissingFieldIdFromOldColumnName() {
        Datachart chart = chart("{\"category\":\"field\",\"colName\":\"city\"}");
        assertThrows(StrictFieldReferenceException.class,
                () -> service.normalizeImportedConfig(chart));
    }

    @Test
    void importedChartCannotAcceptUnknownOrInactiveFieldId() {
        for (String fieldId : List.of("missing", "other-view")) {
            Datachart chart = chart("{\"category\":\"field\",\"fieldId\":\"" + fieldId + "\"}");
            assertThrows(StrictFieldReferenceException.class,
                    () -> service.normalizeImportedConfig(chart));
        }
        ViewFieldDTO inactive = new ViewFieldDTO();
        inactive.setFieldId("field-city");
        inactive.setActive(false);
        when(fields.listByViewId("view-city")).thenReturn(List.of(inactive));
        assertThrows(StrictFieldReferenceException.class,
                () -> service.normalizeImportedConfig(chart("{\"category\":\"field\",\"fieldId\":\"field-city\"}")));
    }

    @Test
    void malformedConfigFailsClosedInsteadOfSilentlyImporting() {
        Datachart chart = new Datachart();
        chart.setId("chart-malformed");
        chart.setViewId("view-city");
        chart.setConfig("{not-valid-json");
        assertThrows(StrictFieldReferenceException.class,
                () -> service.normalizeImportedConfig(chart));
    }
}