package datart.server.common.strict;

import datart.core.data.provider.QueryOutputProjection;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.server.base.params.ViewExecuteParam;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
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
        QueryOutputProjection projection = new QueryOutputProjection();
        projection.setFieldId(fieldId);
        projection.setTechnicalAlias("city");
        ViewExecuteParam param = new ViewExecuteParam();
        param.setOutputProjections(List.of(projection));
        return param;
    }
}
