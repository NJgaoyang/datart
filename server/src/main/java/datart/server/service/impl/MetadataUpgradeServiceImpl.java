package datart.server.service.impl;

import datart.core.base.consts.MigrationMode;
import datart.server.base.dto.FieldMetaMigrationRequest;
import datart.server.base.dto.FieldMetaMigrationResult;
import datart.server.base.dto.FieldMetaMigrationScan;
import datart.server.base.dto.MetadataIntegritySnapshot;
import datart.server.base.dto.MetadataUpgradeApplyReport;
import datart.server.base.dto.MetadataUpgradeChangeCounts;
import datart.server.base.dto.MetadataUpgradeInvariantReport;
import datart.server.base.dto.MetadataUpgradePreflightReport;
import datart.server.base.dto.ReadinessReport;
import datart.server.common.metadata.MetadataUpgradeTablePolicy;
import datart.server.service.BaseService;
import datart.server.service.FieldMetaMigrationService;
import datart.server.service.MetadataUpgradePreflightService;
import datart.server.service.MetadataUpgradeService;
import datart.server.service.MigrationModeService;
import datart.server.service.ReadinessService;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

@Service
public class MetadataUpgradeServiceImpl extends BaseService implements MetadataUpgradeService {

    private static final Set<String> PERMISSION_TABLES = Set.of(
            "rel_role_resource", "rel_subject_columns", "rel_variable_subject");

    private final MetadataUpgradePreflightService preflightService;
    private final FieldMetaMigrationService fieldMetaMigrationService;
    private final MigrationModeService migrationModeService;
    private final ReadinessService readinessService;
    private final JdbcTemplate jdbcTemplate;

    public MetadataUpgradeServiceImpl(MetadataUpgradePreflightService preflightService,
                                      FieldMetaMigrationService fieldMetaMigrationService,
                                      MigrationModeService migrationModeService,
                                      ReadinessService readinessService,
                                      JdbcTemplate jdbcTemplate) {
        this.preflightService = preflightService;
        this.fieldMetaMigrationService = fieldMetaMigrationService;
        this.migrationModeService = migrationModeService;
        this.readinessService = readinessService;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public MetadataUpgradeApplyReport apply(String orgId) {
        MetadataUpgradePreflightReport before = preflightService.preflight(orgId);
        if (migrationModeService.getMode(orgId) == MigrationMode.STRICT) {
            throw new IllegalStateException("METADATA_UPGRADE_STRICT_NOT_ALLOWED");
        }
        if (!before.isApplyAllowed()) {
            throw new IllegalStateException("METADATA_UPGRADE_BLOCKED");
        }

        Set<String> beforeViewFieldIds = resourceIds(orgId, "view_field");
        ReadinessReport currentReadiness = readinessService.scan(orgId);
        if (strictReady(currentReadiness)) {
            return report(orgId, before, before, currentReadiness, true, null, stableInvariants());
        }

        FieldMetaMigrationScan scan = fieldMetaMigrationService.scan(orgId);
        if (!scan.isCanMigrate()) {
            throw new IllegalStateException("METADATA_UPGRADE_BLOCKED");
        }
        FieldMetaMigrationResult result = fieldMetaMigrationService.migrate(
                request(orgId, scan.getScanToken()));

        MetadataUpgradePreflightReport after = preflightService.preflight(orgId);
        ReadinessReport readiness = readinessService.scan(orgId);
        MetadataUpgradeInvariantReport invariants = compare(before.getSnapshot(), after.getSnapshot(),
                beforeViewFieldIds, orgId);
        if (!after.isApplyAllowed()) {
            throw new IllegalStateException("METADATA_UPGRADE_POSTCHECK_BLOCKED");
        }
        if (!allInvariantsMatch(invariants)) {
            throw new IllegalStateException("METADATA_UPGRADE_INTEGRITY_FAILED");
        }
        if (!strictReady(readiness)) {
            throw new IllegalStateException("METADATA_UPGRADE_READINESS_FAILED");
        }

        MetadataUpgradeApplyReport report = report(orgId, before, after, readiness, false, result, invariants);
        report.setSuccess(true);
        report.setStatus("SUCCESS");
        report.setMessage("Metadata upgrade applied in place");
        return report;
    }

    private MetadataUpgradeApplyReport report(String orgId,
                                              MetadataUpgradePreflightReport before,
                                              MetadataUpgradePreflightReport after,
                                              ReadinessReport readiness,
                                              boolean noOp,
                                              FieldMetaMigrationResult migration,
                                              MetadataUpgradeInvariantReport invariantOverride) {
        MetadataUpgradeApplyReport report = new MetadataUpgradeApplyReport();
        report.setOrgId(orgId);
        report.setSuccess(true);
        report.setNoOp(noOp);
        report.setStatus(noOp ? "NO_OP" : "SUCCESS");
        report.setMessage(noOp ? "Metadata is already canonical" : "Metadata upgrade applied in place");
        report.setBeforeSnapshot(before.getSnapshot());
        report.setAfterSnapshot(after.getSnapshot());
        report.setReadiness(readiness);
        MetadataUpgradeInvariantReport invariants = invariantOverride == null
                ? compare(before.getSnapshot(), after.getSnapshot(), Set.of(), orgId) : invariantOverride;
        report.setInvariants(invariants);
        if (migration != null) {
            fillChanges(report, migration, before, after);
        }
        return report;
    }

    private void fillChanges(MetadataUpgradeApplyReport report,
                             FieldMetaMigrationResult migration,
                             MetadataUpgradePreflightReport before,
                             MetadataUpgradePreflightReport after) {
        MetadataUpgradeChangeCounts changes = report.getChanges();
        changes.setViews(migration.getViews().getModified());
        changes.setViewFieldsReconciled(migration.getViews().getFields());
        changes.setViewFieldsCreated(Math.max(0,
                after.getCounts().getViewFields() - before.getCounts().getViewFields()));
        changes.setWidgets(migration.getWidgets().getModified());
        changes.setDatacharts(migration.getDatacharts().getModified());
        report.setModifiedTables(new java.util.ArrayList<>());
        report.setModifiedFields(new java.util.ArrayList<>());
        if (changes.getViews() > 0 || changes.getViewFieldsReconciled() > 0) {
            report.getModifiedTables().add("view");
            report.getModifiedTables().add("view_field");
            report.getModifiedFields().add("view.model");
            report.getModifiedFields().add("view_field.metadata");
        }
        if (changes.getWidgets() > 0) {
            report.getModifiedTables().add("widget");
            report.getModifiedFields().add("widget.config");
        }
        if (changes.getDatacharts() > 0) {
            report.getModifiedTables().add("datachart");
            report.getModifiedFields().add("datachart.config");
        }
    }

    private MetadataUpgradeInvariantReport compare(MetadataIntegritySnapshot before,
                                                    MetadataIntegritySnapshot after,
                                                    Set<String> beforeViewFieldIds,
                                                    String orgId) {
        MetadataUpgradeInvariantReport result = new MetadataUpgradeInvariantReport();
        Map<String, String> beforeChecksums = before == null ? Map.of() : before.getChecksums();
        Map<String, String> afterChecksums = after == null ? Map.of() : after.getChecksums();
        result.setIdentityChecksumMatched(beforeChecksums.equals(afterChecksums));
        result.setPasswordChecksumMatched(checksum(beforeChecksums, "user")
                .equals(checksum(afterChecksums, "user")));
        result.setPermissionChecksumMatched(PERMISSION_TABLES.stream()
                .allMatch(table -> checksum(beforeChecksums, table).equals(checksum(afterChecksums, table))));

        Map<String, String> beforeResource = before == null ? Map.of() : before.getResourceIdChecksums();
        Map<String, String> afterResource = after == null ? Map.of() : after.getResourceIdChecksums();
        result.setResourceIdChecksumMatched(MetadataUpgradeTablePolicy.IMMUTABLE_RESOURCE_ID_TABLES.stream()
                .filter(table -> !"view_field".equals(table))
                .allMatch(table -> checksum(beforeResource, table + ".id")
                        .equals(checksum(afterResource, table + ".id"))));
        result.setViewFieldIdsStable(resourceIds(orgId, "view_field").containsAll(beforeViewFieldIds));
        return result;
    }

    private static MetadataUpgradeInvariantReport stableInvariants() {
        MetadataUpgradeInvariantReport result = new MetadataUpgradeInvariantReport();
        result.setIdentityChecksumMatched(true);
        result.setPasswordChecksumMatched(true);
        result.setPermissionChecksumMatched(true);
        result.setResourceIdChecksumMatched(true);
        result.setViewFieldIdsStable(true);
        return result;
    }

    private Set<String> resourceIds(String orgId, String table) {
        String sql = switch (table) {
            case "source" -> "SELECT id FROM source WHERE org_id = ? ORDER BY id";
            case "view" -> "SELECT id FROM `view` WHERE org_id = ? ORDER BY id";
            case "view_field" -> "SELECT vf.id FROM view_field vf JOIN `view` v ON v.id = vf.view_id WHERE v.org_id = ? ORDER BY vf.id";
            case "datachart" -> "SELECT id FROM datachart WHERE org_id = ? ORDER BY id";
            case "dashboard" -> "SELECT id FROM dashboard WHERE org_id = ? ORDER BY id";
            case "folder" -> "SELECT id FROM folder WHERE org_id = ? ORDER BY id";
            default -> throw new IllegalArgumentException("Unsupported resource ID table: " + table);
        };
        return new LinkedHashSet<>(jdbcTemplate.queryForList(sql, String.class, orgId));
    }

    private static String checksum(Map<String, String> checksums, String key) {
        return checksums.getOrDefault(key, "");
    }

    private static boolean allInvariantsMatch(MetadataUpgradeInvariantReport report) {
        return report.isIdentityChecksumMatched()
                && report.isPasswordChecksumMatched()
                && report.isPermissionChecksumMatched()
                && report.isResourceIdChecksumMatched()
                && report.isViewFieldIdsStable();
    }

    private static boolean strictReady(ReadinessReport report) {
        return report != null
                && report.getBlockers() == 0
                && report.getReadiness() >= 100D
                && report.getChartFieldIdCoverage() >= 100D
                && report.getResolvedChartFieldIdCoverage() >= 100D;
    }

    private static FieldMetaMigrationRequest request(String orgId, String scanToken) {
        FieldMetaMigrationRequest request = new FieldMetaMigrationRequest();
        request.setOrgId(orgId);
        request.setExpectedScanToken(scanToken);
        return request;
    }
}
