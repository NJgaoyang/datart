package datart.server.base.dto;

import datart.core.entity.RelSubjectColumns;
import datart.core.entity.RelVariableSubject;
import datart.core.entity.Variable;
import datart.core.entity.View;
import datart.core.base.consts.MigrationMode;
import lombok.Data;
import lombok.EqualsAndHashCode;
import org.springframework.beans.BeanUtils;

import java.util.List;

@EqualsAndHashCode(callSuper = true)
@Data
public class ViewDetailDTO extends View {

    private List<RelSubjectColumns> relSubjectColumns;

    private List<Variable> variables;

    private List<RelVariableSubject> relVariableSubjects;

    private List<ViewFieldDTO> fields;

    private MigrationMode migrationMode;

    public ViewDetailDTO(View view) {
        BeanUtils.copyProperties(view, this);
    }
}
