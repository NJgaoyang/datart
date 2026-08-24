package datart.server.service.impl;

import datart.core.mappers.ext.*;
import datart.server.base.dto.*;
import datart.server.common.metadata.MetadataSnapshotHasher;
import datart.server.common.readiness.ReadinessIssueCode;
import datart.server.service.BaseService;
import datart.server.service.FieldMetaMigrationService;
import datart.server.service.MetadataUpgradePreflightService;
import datart.server.service.ReadinessService;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class MetadataUpgradePreflightServiceImpl extends BaseService implements MetadataUpgradePreflightService {

    private final JdbcTemplate jdbcTemplate;
    private final ReadinessService readinessService;
    private final FieldMetaMigrationService fieldMetaMigrationService;

    public MetadataUpgradePreflightServiceImpl(JdbcTemplate jdbcTemplate,
                                               ReadinessService readinessService,
                                               FieldMetaMigrationService fieldMetaMigrationService) {
        this.jdbcTemplate = jdbcTemplate;
        this.readinessService = readinessService;
        this.fieldMetaMigrationService = fieldMetaMigrationService;
    }

    @Override
    public MetadataUpgradePreflightReport preflight(String orgId) {
        securityManager.requireOrgOwner(orgId);
        MetadataUpgradePreflightReport report = new MetadataUpgradePreflightReport();
        report.setOrgId(orgId);

        MetadataIntegritySnapshot snapshot = snapshot(orgId, report);
        report.setSnapshot(snapshot);
        populateCounts(report.getCounts(), snapshot);
        FieldMetaMigrationScan migrationPlan = migrationPlan(orgId, report);
        scanRelationIntegrity(orgId, report);
        scanResourceReadiness(orgId, report, migrationPlan);

        int blockers = (int) report.getIssues().stream()
                .filter(issue -> issue.getSeverity() == ReadinessSeverity.BLOCKER)
                .count();
        int warnings = (int) report.getIssues().stream()
                .filter(issue -> issue.getSeverity() == ReadinessSeverity.WARNING)
                .count();
        report.setBlockers(blockers);
        report.setWarnings(warnings);
        report.setApplyAllowed(blockers == 0);
        return report;
    }

    private FieldMetaMigrationScan migrationPlan(String orgId, MetadataUpgradePreflightReport report) {
        try {
            FieldMetaMigrationScan plan = fieldMetaMigrationService.scan(orgId);
            plan.getIssues().stream()
                    .filter(issue -> issue.getSeverity() == null
                            || issue.getSeverity() == FieldMetaMigrationIssueSeverity.BLOCKING)
                    .forEach(issue -> addIssue(report, ReadinessSeverity.BLOCKER,
                            "FIELD_META_MIGRATION_BLOCKED", issue.getEntityType(), issue.getEntityId(),
                            issue.getReason() + ": " + issue.getDetail()));
            return plan;
        } catch (RuntimeException e) {
            addIssue(report, ReadinessSeverity.BLOCKER, "FIELD_META_MIGRATION_PLAN_FAILED",
                    "RESOURCE", null, "Cannot build field metadata upgrade plan");
            return new FieldMetaMigrationScan();
        }
    }

    private MetadataIntegritySnapshot snapshot(String orgId, MetadataUpgradePreflightReport report) {
        MetadataIntegritySnapshot snapshot = new MetadataIntegritySnapshot();
        snapshot.setPasswordHashCovered(true);
        Map<String, String> checksums = new LinkedHashMap<>();

        List<SnapshotQuery> identityQueries = identityQueries(orgId);
        for (SnapshotQuery query : identityQueries) {
            List<Map<String, Object>> rows = query(query, report);
            snapshot.getRowCounts().put(query.name(), rows.size());
            String checksum = MetadataSnapshotHasher.checksum(query.name(), query.columns(), rows);
            snapshot.getChecksums().put(query.name(), checksum);
            checksums.put(query.name(), checksum);
        }

        List<SnapshotQuery> resourceIdQueries = resourceIdQueries(orgId);
        for (SnapshotQuery query : resourceIdQueries) {
            List<Map<String, Object>> rows = query(query, report);
            snapshot.getResourceIdCounts().put(query.name(), rows.size());
            String checksum = MetadataSnapshotHasher.checksum(query.name(), query.columns(), rows);
            snapshot.getResourceIdChecksums().put(query.name(), checksum);
            checksums.put(query.name(), checksum);
        }
        snapshot.setOverallChecksum(MetadataSnapshotHasher.combine(checksums));
        return snapshot;
    }

    private List<SnapshotQuery> identityQueries(String orgId) {
        return List.of(
                new SnapshotQuery("organization", List.of("id", "name", "avatar", "description", "migration_mode"),
                        "SELECT id, name, avatar, description, migration_mode FROM organization WHERE id = ? ORDER BY id", orgId),
                new SnapshotQuery("user", List.of("id", "username", "email", "password", "active", "name", "description", "avatar"),
                        "SELECT DISTINCT u.id, u.username, u.email, u.password, u.active, u.name, u.description, u.avatar " +
                                "FROM `user` u JOIN rel_user_organization ruo ON ruo.user_id = u.id " +
                                "WHERE ruo.org_id = ? ORDER BY u.id", orgId),
                new SnapshotQuery("rel_user_organization", List.of("id", "org_id", "user_id"),
                        "SELECT id, org_id, user_id FROM rel_user_organization WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("role", List.of("id", "org_id", "name", "type", "description", "avatar"),
                        "SELECT id, org_id, name, type, description, avatar FROM role WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("rel_role_user", List.of("id", "user_id", "role_id"),
                        "SELECT rru.id, rru.user_id, rru.role_id FROM rel_role_user rru " +
                                "JOIN role r ON r.id = rru.role_id WHERE r.org_id = ? ORDER BY rru.id", orgId),
                new SnapshotQuery("rel_role_resource", List.of("id", "role_id", "resource_id", "resource_type", "org_id", "permission"),
                        "SELECT id, role_id, resource_id, resource_type, org_id, permission " +
                                "FROM rel_role_resource WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("rel_subject_columns", List.of("id", "view_id", "subject_id", "subject_type", "column_permission"),
                        "SELECT rsc.id, rsc.view_id, rsc.subject_id, rsc.subject_type, rsc.column_permission " +
                                "FROM rel_subject_columns rsc JOIN `view` v ON v.id = rsc.view_id " +
                                "WHERE v.org_id = ? ORDER BY rsc.id", orgId),
                new SnapshotQuery("rel_variable_subject", List.of("id", "variable_id", "subject_id", "subject_type", "value", "use_default_value"),
                        "SELECT rvs.id, rvs.variable_id, rvs.subject_id, rvs.subject_type, rvs.value, rvs.use_default_value " +
                                "FROM rel_variable_subject rvs JOIN variable v ON v.id = rvs.variable_id " +
                                "WHERE v.org_id = ? ORDER BY rvs.id", orgId)
        );
    }

    private List<SnapshotQuery> resourceIdQueries(String orgId) {
        return List.of(
                new SnapshotQuery("source.id", List.of("id"),
                        "SELECT id FROM source WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("view.id", List.of("id"),
                        "SELECT id FROM `view` WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("view_field.id", List.of("id"),
                        "SELECT vf.id FROM view_field vf JOIN `view` v ON v.id = vf.view_id " +
                                "WHERE v.org_id = ? ORDER BY vf.id", orgId),
                new SnapshotQuery("datachart.id", List.of("id"),
                        "SELECT id FROM datachart WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("dashboard.id", List.of("id"),
                        "SELECT id FROM dashboard WHERE org_id = ? ORDER BY id", orgId),
                new SnapshotQuery("folder.id", List.of("id"),
                        "SELECT id FROM folder WHERE org_id = ? ORDER BY id", orgId)
        );
    }

    private List<Map<String, Object>> query(SnapshotQuery query, MetadataUpgradePreflightReport report) {
        try {
            return jdbcTemplate.queryForList(query.sql(), query.args());
        } catch (DataAccessException e) {
            addIssue(report, ReadinessSeverity.BLOCKER, "METADATA_SCHEMA_UNAVAILABLE",
                    query.name(), null, "Cannot read metadata table/query: " + query.name());
            return List.of();
        }
    }

    private void populateCounts(MetadataUpgradeCounts counts, MetadataIntegritySnapshot snapshot) {
        counts.setOrganizations(count(snapshot, "organization"));
        counts.setUsers(count(snapshot, "user"));
        counts.setMemberships(count(snapshot, "rel_user_organization"));
        counts.setRoles(count(snapshot, "role"));
        counts.setUserRoles(count(snapshot, "rel_role_user"));
        counts.setRolePermissions(count(snapshot, "rel_role_resource"));
        counts.setViews(count(snapshot, "view.id"));
        counts.setViewFields(count(snapshot, "view_field.id"));
        counts.setDatacharts(count(snapshot, "datachart.id"));
        counts.setDashboards(count(snapshot, "dashboard.id"));
        counts.setFolders(count(snapshot, "folder.id"));
        counts.setSources(count(snapshot, "source.id"));
    }

    private void scanRelationIntegrity(String orgId, MetadataUpgradePreflightReport report) {
        addOrphanIssue(report, ReadinessSeverity.WARNING, "ORPHAN_MEMBERSHIP", "rel_user_organization", """
                SELECT COUNT(*) FROM rel_user_organization ruo
                LEFT JOIN `user` u ON u.id = ruo.user_id
                WHERE ruo.org_id = ? AND u.id IS NULL
                """, orgId);
        addOrphanIssue(report, ReadinessSeverity.WARNING, "ORPHAN_USER_ROLE", "rel_role_user", """
                SELECT COUNT(*) FROM rel_role_user rru
                LEFT JOIN `user` u ON u.id = rru.user_id
                LEFT JOIN role r ON r.id = rru.role_id AND r.org_id = ?
                WHERE rru.role_id IS NOT NULL AND (u.id IS NULL OR r.id IS NULL)
                """, orgId);
        addOrphanIssue(report, ReadinessSeverity.WARNING, "ORPHAN_ROLE_PERMISSION", "rel_role_resource", """
                SELECT COUNT(*) FROM rel_role_resource rrr
                LEFT JOIN role r ON r.id = rrr.role_id AND r.org_id = ?
                WHERE rrr.org_id = ? AND r.id IS NULL
                """, orgId, orgId);
        addOrphanIssue(report, ReadinessSeverity.WARNING, "MISSING_RESOURCE_PERMISSION_TARGET", "rel_role_resource", """
                SELECT COUNT(*) FROM rel_role_resource rrr
                LEFT JOIN source s ON rrr.resource_type = 'SOURCE' AND s.id = rrr.resource_id
                LEFT JOIN `view` v ON rrr.resource_type = 'VIEW' AND v.id = rrr.resource_id
                LEFT JOIN datachart dc ON rrr.resource_type = 'DATACHART' AND dc.id = rrr.resource_id
                LEFT JOIN dashboard d ON rrr.resource_type = 'DASHBOARD' AND d.id = rrr.resource_id
                LEFT JOIN folder f ON rrr.resource_type = 'FOLDER' AND f.id = rrr.resource_id
                WHERE rrr.org_id = ? AND rrr.resource_id IS NOT NULL AND
                    ((rrr.resource_type = 'SOURCE' AND s.id IS NULL) OR
                     (rrr.resource_type = 'VIEW' AND v.id IS NULL) OR
                     (rrr.resource_type = 'DATACHART' AND dc.id IS NULL) OR
                     (rrr.resource_type = 'DASHBOARD' AND d.id IS NULL) OR
                     (rrr.resource_type = 'FOLDER' AND f.id IS NULL))
                """, orgId);
        addOrphanIssue(report, ReadinessSeverity.BLOCKER, "ORPHAN_VIEW_COLUMN_PERMISSION", "rel_subject_columns", """
                SELECT COUNT(*) FROM rel_subject_columns rsc
                LEFT JOIN `view` v ON v.id = rsc.view_id AND v.org_id = ?
                WHERE v.id IS NULL
                """, orgId);
        addOrphanIssue(report, ReadinessSeverity.BLOCKER, "ORPHAN_VARIABLE_PERMISSION", "rel_variable_subject", """
                SELECT COUNT(*) FROM rel_variable_subject rvs
                LEFT JOIN variable v ON v.id = rvs.variable_id AND v.org_id = ?
                WHERE v.id IS NULL
                """, orgId);
    }

    private void addOrphanIssue(MetadataUpgradePreflightReport report,
                                ReadinessSeverity severity,
                                String code,
                                String resourceType,
                                String sql,
                                Object... args) {
        try {
            Integer count = jdbcTemplate.queryForObject(sql, Integer.class, args);
            if (count != null && count > 0) {
                addIssue(report, severity, code, resourceType, null,
                        severity == ReadinessSeverity.WARNING
                                ? "Legacy relation retained; unresolved rows are ignored by existing JOIN semantics: " + count
                                : "Found " + count + " unresolved metadata relation(s)");
            }
        } catch (DataAccessException e) {
            addIssue(report, ReadinessSeverity.BLOCKER, "METADATA_SCHEMA_UNAVAILABLE",
                    resourceType, null, "Cannot validate metadata relation: " + resourceType);
        }
    }

    private void scanResourceReadiness(String orgId, MetadataUpgradePreflightReport report,
                                       FieldMetaMigrationScan migrationPlan) {
        try {
            ReadinessReport readiness = readinessService.scan(orgId);
            Set<String> upgradeViews = new LinkedHashSet<>();
            Set<String> autoUpgradeableViews = new LinkedHashSet<>(
                    migrationPlan.getAutoUpgradeableViewIds() == null
                            ? List.of() : migrationPlan.getAutoUpgradeableViewIds());
            Set<String> fieldIdRepair = new LinkedHashSet<>();
            Set<String> upgradeDatacharts = new LinkedHashSet<>();
            Set<String> upgradeDashboards = new LinkedHashSet<>();
            int autoUpgradeRequired = 0;
            for (ReadinessIssue issue : readiness.getIssues()) {
                String alignedCode = alignedCode(issue, autoUpgradeableViews);
                if (ReadinessIssueCode.VIEW_FIELD_AUTO_UPGRADE_REQUIRED.equals(alignedCode)) {
                    addIssue(report, ReadinessSeverity.WARNING, alignedCode,
                            issue.getResourceType(), issue.getResourceId(),
                            "M2 will rebuild this ViewField: " + issue.getMessage());
                    autoUpgradeRequired++;
                } else {
                    addIssue(report, issue.getSeverity(), issue.getCode(), issue.getResourceType(),
                            issue.getResourceId(), issue.getMessage());
                }
                if ("VIEW".equals(issue.getResourceType())
                        && ("VIEW_LEGACY_MODEL_METADATA".equals(issue.getCode())
                        || "VIEW_LEGACY_SQL_PATH".equals(issue.getCode())
                        || "VIEW_FIELD_MISSING".equals(issue.getCode())
                        || ReadinessIssueCode.VIEW_SCHEMA_REFERENCE_NOT_FOUND.equals(issue.getCode()))) {
                    upgradeViews.add(issue.getResourceId());
                }
                if (issue.getCode().startsWith("VIEW_FIELD_ID_")
                        || "DATACHART_FIELD_ID_MISSING".equals(issue.getCode())) {
                    fieldIdRepair.add(issue.getResourceId());
                }
                if ("DATACHART".equals(issue.getResourceType())) {
                    upgradeDatacharts.add(issue.getResourceId());
                }
                if ("DASHBOARD".equals(issue.getResourceType())) {
                    upgradeDashboards.add(issue.getResourceId());
                }
            }
            report.getCounts().setNeedUpgradeViews(upgradeViews.size());
            report.getCounts().setNeedFieldIdRepair(fieldIdRepair.size());
            report.getCounts().setNeedUpgradeDatacharts(upgradeDatacharts.size());
            report.getCounts().setNeedUpgradeDashboards(upgradeDashboards.size());
            report.getCounts().setAutoUpgradeRequired(autoUpgradeRequired);
        } catch (RuntimeException e) {
            addIssue(report, ReadinessSeverity.BLOCKER, "METADATA_READINESS_SCAN_FAILED",
                    "RESOURCE", null, "Resource readiness scan failed");
        }
    }

    static String alignedCode(ReadinessIssue issue, Set<String> autoUpgradeableViewIds) {
        if (issue == null || !"VIEW".equals(issue.getResourceType())
                || !autoUpgradeableViewIds.contains(issue.getResourceId())) {
            return issue == null ? null : issue.getCode();
        }
        if (ReadinessIssueCode.VIEW_FIELD_MISSING.equals(issue.getCode())) {
            return ReadinessIssueCode.VIEW_FIELD_AUTO_UPGRADE_REQUIRED;
        }
        return issue.getCode();
    }

    private void addIssue(MetadataUpgradePreflightReport report,
                          ReadinessSeverity severity,
                          String code,
                          String resourceType,
                          String resourceId,
                          String message) {
        report.getIssues().add(new MetadataUpgradeIssue(severity, code, resourceType, resourceId, message));
    }

    private int count(MetadataIntegritySnapshot snapshot, String name) {
        return snapshot.getRowCounts().getOrDefault(name,
                snapshot.getResourceIdCounts().getOrDefault(name, 0));
    }

    private record SnapshotQuery(String name, List<String> columns, String sql, Object... args) {
    }
}
