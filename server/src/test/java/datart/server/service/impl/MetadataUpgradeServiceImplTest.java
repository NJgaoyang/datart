package datart.server.service.impl;

import datart.core.base.consts.MigrationMode;
import datart.server.base.dto.FieldMetaMigrationResult;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.base.dto.MetadataIntegritySnapshot;
import datart.server.base.dto.MetadataUpgradePreflightReport;
import datart.server.base.dto.ReadinessReport;
import datart.server.service.FieldMetaMigrationService;
import datart.server.service.MetadataUpgradePreflightService;
import datart.server.service.MigrationModeService;
import datart.server.service.ReadinessService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MetadataUpgradeServiceImplTest {

    @Test
    void rejectsPreflightBlockerBeforeMigration() {
        MetadataUpgradePreflightService preflight = mock(MetadataUpgradePreflightService.class);
        FieldMetaMigrationService migration = mock(FieldMetaMigrationService.class);
        MigrationModeService mode = mock(MigrationModeService.class);
        when(mode.getMode("org-1")).thenReturn(MigrationMode.COMPAT);
        when(preflight.preflight("org-1")).thenReturn(preflight(false));

        MetadataUpgradeServiceImpl service = service(preflight, migration, mode, mock(ReadinessService.class));

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.apply("org-1"));

        assertEquals("METADATA_UPGRADE_BLOCKED", error.getMessage());
        verify(migration, never()).scan(anyString());
    }

    @Test
    void rejectsStrictOrganizationWithoutTouchingMigration() {
        MetadataUpgradePreflightService preflight = mock(MetadataUpgradePreflightService.class);
        FieldMetaMigrationService migration = mock(FieldMetaMigrationService.class);
        MigrationModeService mode = mock(MigrationModeService.class);
        when(mode.getMode("org-1")).thenReturn(MigrationMode.STRICT);
        when(preflight.preflight("org-1")).thenReturn(preflight(true));

        MetadataUpgradeServiceImpl service = service(preflight, migration, mode, mock(ReadinessService.class));

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.apply("org-1"));

        assertEquals("METADATA_UPGRADE_STRICT_NOT_ALLOWED", error.getMessage());
        verify(migration, never()).scan(anyString());
    }

    @Test
    void secondApplyIsNoOpWhenReadinessIsCanonical() {
        MetadataUpgradePreflightService preflight = mock(MetadataUpgradePreflightService.class);
        FieldMetaMigrationService migration = mock(FieldMetaMigrationService.class);
        MigrationModeService mode = mock(MigrationModeService.class);
        ReadinessService readiness = mock(ReadinessService.class);
        when(mode.getMode("org-1")).thenReturn(MigrationMode.COMPAT);
        when(preflight.preflight("org-1")).thenReturn(preflight(true));
        when(readiness.scan("org-1")).thenReturn(ready());
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), any(Object[].class)))
                .thenReturn(List.of());

        MetadataUpgradeServiceImpl service = new MetadataUpgradeServiceImpl(
                preflight, migration, mode, readiness, jdbcTemplate);

        var result = service.apply("org-1");

        assertTrue(result.isSuccess());
        assertTrue(result.isNoOp());
        assertEquals("NO_OP", result.getStatus());
        verify(migration, never()).scan(anyString());
    }

    @Test
    void rejectsImmutableChecksumChangeAfterMigration() {
        MetadataUpgradePreflightService preflight = mock(MetadataUpgradePreflightService.class);
        FieldMetaMigrationService migration = mock(FieldMetaMigrationService.class);
        MigrationModeService mode = mock(MigrationModeService.class);
        ReadinessService readiness = mock(ReadinessService.class);
        when(mode.getMode("org-1")).thenReturn(MigrationMode.COMPAT);
        when(preflight.preflight("org-1")).thenReturn(
                preflight(true, snapshot("before")), preflight(true, snapshot("after")));
        when(readiness.scan("org-1")).thenReturn(notReady(), ready());
        FieldMetaMigrationScan scan = new FieldMetaMigrationScan();
        scan.setCanMigrate(true);
        scan.setScanToken("token");
        when(migration.scan("org-1")).thenReturn(scan);
        when(migration.migrate(any())).thenReturn(new FieldMetaMigrationResult());
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), any(Object[].class)))
                .thenReturn(List.of());

        MetadataUpgradeServiceImpl service = new MetadataUpgradeServiceImpl(
                preflight, migration, mode, readiness, jdbcTemplate);

        IllegalStateException error = assertThrows(IllegalStateException.class,
                () -> service.apply("org-1"));

        assertEquals("METADATA_UPGRADE_INTEGRITY_FAILED", error.getMessage());
        verify(migration).migrate(any());
    }

    private static MetadataUpgradeServiceImpl service(MetadataUpgradePreflightService preflight,
                                                       FieldMetaMigrationService migration,
                                                       MigrationModeService mode,
                                                       ReadinessService readiness) {
        JdbcTemplate jdbcTemplate = mock(JdbcTemplate.class);
        when(jdbcTemplate.queryForList(anyString(), eq(String.class), any(Object[].class)))
                .thenReturn(List.of());
        return new MetadataUpgradeServiceImpl(preflight, migration, mode, readiness, jdbcTemplate);
    }

    private static MetadataUpgradePreflightReport preflight(boolean allowed) {
        return preflight(allowed, snapshot("same"));
    }

    private static MetadataUpgradePreflightReport preflight(boolean allowed, MetadataIntegritySnapshot snapshot) {
        MetadataUpgradePreflightReport report = new MetadataUpgradePreflightReport();
        report.setApplyAllowed(allowed);
        report.setSnapshot(snapshot);
        return report;
    }

    private static MetadataIntegritySnapshot snapshot(String checksum) {
        MetadataIntegritySnapshot snapshot = new MetadataIntegritySnapshot();
        snapshot.getChecksums().put("user", checksum);
        snapshot.getChecksums().put("rel_role_resource", checksum);
        snapshot.getChecksums().put("rel_subject_columns", checksum);
        snapshot.getChecksums().put("rel_variable_subject", checksum);
        snapshot.getResourceIdChecksums().put("source.id", checksum);
        return snapshot;
    }

    private static ReadinessReport ready() {
        ReadinessReport report = new ReadinessReport();
        report.setReadiness(100D);
        report.setBlockers(0);
        report.setChartFieldIdCoverage(100D);
        report.setResolvedChartFieldIdCoverage(100D);
        return report;
    }

    private static ReadinessReport notReady() {
        ReadinessReport report = ready();
        report.setReadiness(90D);
        return report;
    }
}
