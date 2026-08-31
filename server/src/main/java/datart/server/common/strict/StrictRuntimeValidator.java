package datart.server.common.strict;

import datart.core.data.provider.QueryOutputProjection;
import datart.core.entity.View;
import datart.core.entity.ViewField;
import datart.core.mappers.ext.ViewFieldMapperExt;
import datart.server.base.params.ViewExecuteParam;
import datart.server.common.fieldmeta.ChartComputedFieldInspector;
import org.apache.commons.lang3.StringUtils;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

public class StrictRuntimeValidator {

    private final ViewFieldMapperExt viewFieldMapper;

    public StrictRuntimeValidator(ViewFieldMapperExt viewFieldMapper) {
        this.viewFieldMapper = viewFieldMapper;
    }

    public void validate(View view, ViewExecuteParam param) {
        List<QueryOutputProjection> projections = param.getOutputProjections();
        if (projections == null || projections.isEmpty()) {
            return;
        }
        Map<String, ViewField> fields = new HashMap<>();
        for (ViewField field : viewFieldMapper.listByViewId(view.getId())) {
            fields.put(field.getId(), field);
        }
        for (QueryOutputProjection projection : projections) {
            String fieldId = StringUtils.trimToNull(projection.getFieldId());
            if (fieldId == null) {
                boolean computedMatched = ChartComputedFieldInspector.isValidProjection(param, projection);
                if (computedMatched) {
                    continue;
                }
                throw new StrictFieldReferenceException("STRICT_FIELD_ID_REQUIRED",
                        projection.getTechnicalAlias());
            }
            ViewField field = fields.get(fieldId);
            if (field == null) {
                ViewField foreignField = viewFieldMapper.selectById(fieldId);
                if (foreignField != null && !view.getId().equals(foreignField.getViewId())) {
                    throw new StrictFieldReferenceException("STRICT_FIELD_VIEW_MISMATCH", fieldId);
                }
                throw new StrictFieldReferenceException("STRICT_FIELD_NOT_FOUND", fieldId);
            }
            if (Boolean.FALSE.equals(field.getActive())) {
                throw new StrictFieldReferenceException("STRICT_FIELD_INACTIVE", fieldId);
            }
        }
    }
}
