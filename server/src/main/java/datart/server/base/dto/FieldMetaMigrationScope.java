package datart.server.base.dto;

import lombok.Data;

@Data
public class FieldMetaMigrationScope {
    private int total;
    private int fields;
    private int alreadyFormal;
    private int fallbackConfident;
    private int customConfident;
    private int commentRecovered;
    private int resolvedFromColumns;
    private int ambiguous;
    private int invalidJson;
    private int modified;
    private int rows;
    private int rowsMatched;
    private int rowsUpdated;
    private int unmatched;
    private int referenceMismatch;
}
