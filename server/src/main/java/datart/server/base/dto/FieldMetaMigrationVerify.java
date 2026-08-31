package datart.server.base.dto;

import lombok.Data;

import java.util.ArrayList;
import java.util.List;

@Data
public class FieldMetaMigrationVerify {
    private String orgId;
    private boolean valid;
    private FieldMetaMigrationScope views = new FieldMetaMigrationScope();
    private FieldMetaMigrationScope widgets = new FieldMetaMigrationScope();
    private FieldMetaMigrationScope datacharts = new FieldMetaMigrationScope();
    private List<FieldMetaMigrationIssue> issues = new ArrayList<>();
}
