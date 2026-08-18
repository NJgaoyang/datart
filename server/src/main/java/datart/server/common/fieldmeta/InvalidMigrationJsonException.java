package datart.server.common.fieldmeta;

public class InvalidMigrationJsonException extends RuntimeException {

    private final String entityType;
    private final String entityId;

    public InvalidMigrationJsonException(String entityType, String entityId, Throwable cause) {
        super("Invalid JSON for " + entityType + " " + entityId, cause);
        this.entityType = entityType;
        this.entityId = entityId;
    }

    public String getEntityType() {
        return entityType;
    }

    public String getEntityId() {
        return entityId;
    }
}
