package datart.server.service.impl;

import datart.server.base.dto.ReadinessIssue;
import datart.server.base.dto.ReadinessSeverity;
import datart.server.common.readiness.ReadinessIssueCode;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.service.FieldMetaMigrationService;
import datart.server.service.ReadinessService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MetadataUpgradePreflightAlignmentTest {

    @Test
    void classifiesPlannerBackedMissingFieldAsAutoUpgrade() {
        ReadinessIssue issue = issue(ReadinessIssueCode.VIEW_FIELD_MISSING);

        assertEquals(ReadinessIssueCode.VIEW_FIELD_AUTO_UPGRADE_REQUIRED,
                MetadataUpgradePreflightServiceImpl.alignedCode(issue, Set.of("view-1")));
    }

    @Test
    void keepsUnplannedMissingFieldBlocking() {
        ReadinessIssue issue = issue(ReadinessIssueCode.VIEW_FIELD_MISSING);

        assertEquals(ReadinessIssueCode.VIEW_FIELD_MISSING,
                MetadataUpgradePreflightServiceImpl.alignedCode(issue, Set.of("other-view")));
    }

    @Test
    void keepsSchemaReferenceBlockingUntilPlannerCanProveIt() {
        ReadinessIssue issue = issue(ReadinessIssueCode.VIEW_SCHEMA_REFERENCE_NOT_FOUND);

        assertEquals(ReadinessIssueCode.VIEW_SCHEMA_REFERENCE_NOT_FOUND,
                MetadataUpgradePreflightServiceImpl.alignedCode(issue, Set.of("view-1")));
    }

    private static ReadinessIssue issue(String code) {
        return new ReadinessIssue("VIEW", "view-1", "View 1", ReadinessSeverity.BLOCKER,
                code, "test");
    }
}
