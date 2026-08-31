package datart.server.common;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HistoryMigrationDetectorTest {

    @Test
    void detectsLegacyDateAndRawSqlWithoutReturningSqlText() {
        var reasons = HistoryMigrationDetector.reasons(
                "SELECT AGG_DATE_MONTH(created_date) FROM report");

        assertEquals(2, reasons.size());
        assertTrue(reasons.contains("LEGACY_DATE_EXPRESSION"));
        assertTrue(reasons.contains("RAW_SQL_REVIEW"));
    }
}
