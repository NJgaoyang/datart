package datart.server.config;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class AccessLogIndexMigrationTest {

    @Test
    void extractsTableNameForSingleWordColumn() {
        assertEquals("access_log", AccessLogIndexMigration.extractTableName(
                "ALTER TABLE access_log ADD INDEX idx_access_log_user (user)"));
    }

    @Test
    void extractsTableNameForMultiWordColumns() {
        assertEquals("access_log", AccessLogIndexMigration.extractTableName(
                "ALTER TABLE access_log ADD INDEX idx_access_log_resource_type (resource_type)"));
        assertEquals("dashboard", AccessLogIndexMigration.extractTableName(
                "ALTER TABLE dashboard ADD INDEX idx_dashboard_create_by (create_by)"));
        assertEquals("schedule_log", AccessLogIndexMigration.extractTableName(
                "ALTER TABLE schedule_log ADD INDEX idx_schedule_log_start (start)"));
    }

    @Test
    void returnsEmptyForUnparsableStatements() {
        assertEquals("", AccessLogIndexMigration.extractTableName(null));
        assertEquals("", AccessLogIndexMigration.extractTableName("SELECT 1"));
    }
}
