package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FieldMetaMigrationResult {
    private String runId;
    private String status;
    private FieldMetaMigrationScope views = new FieldMetaMigrationScope();
    private FieldMetaMigrationScope widgets = new FieldMetaMigrationScope();
    private FieldMetaMigrationScope datacharts = new FieldMetaMigrationScope();
    private List<FieldMetaMigrationIssue> issues = new ArrayList<>();
}
