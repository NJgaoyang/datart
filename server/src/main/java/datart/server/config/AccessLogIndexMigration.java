package datart.server.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.sql.ResultSet;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 系统表查询字段索引自动迁移
 * 应用启动时自动检查并创建缺失的索引
 */
@Slf4j
@Component
public class AccessLogIndexMigration {

    private final JdbcTemplate jdbcTemplate;

    /**
     * 所有需要创建的索引（按表分组，保持有序）
     * key = 索引名, value = ALTER TABLE 语句
     */
    private static final Map<String, String> INDEXES = new LinkedHashMap<String, String>() {{
        // ========== access_log ==========
        put("idx_access_log_user",          "ALTER TABLE access_log ADD INDEX idx_access_log_user (user)");
        put("idx_access_log_resource_type", "ALTER TABLE access_log ADD INDEX idx_access_log_resource_type (resource_type)");
        put("idx_access_log_access_time",   "ALTER TABLE access_log ADD INDEX idx_access_log_access_time (access_time)");

        // ========== dashboard ==========
        put("idx_dashboard_create_by",     "ALTER TABLE dashboard ADD INDEX idx_dashboard_create_by (create_by)");
        put("idx_dashboard_status",        "ALTER TABLE dashboard ADD INDEX idx_dashboard_status (status)");
        put("idx_dashboard_create_time",   "ALTER TABLE dashboard ADD INDEX idx_dashboard_create_time (create_time)");

        // ========== datachart ==========
        put("idx_datachart_create_by",     "ALTER TABLE datachart ADD INDEX idx_datachart_create_by (create_by)");
        put("idx_datachart_status",        "ALTER TABLE datachart ADD INDEX idx_datachart_status (status)");
        put("idx_datachart_create_time",   "ALTER TABLE datachart ADD INDEX idx_datachart_create_time (create_time)");

        // ========== download ==========
        put("idx_download_status",         "ALTER TABLE download ADD INDEX idx_download_status (status)");
        put("idx_download_create_time",    "ALTER TABLE download ADD INDEX idx_download_create_time (create_time)");

        // ========== link ==========
        put("idx_link_rel_type",           "ALTER TABLE link ADD INDEX idx_link_rel_type (rel_type)");
        put("idx_link_rel_id",             "ALTER TABLE link ADD INDEX idx_link_rel_id (rel_id)");
        put("idx_link_create_by",          "ALTER TABLE link ADD INDEX idx_link_create_by (create_by)");

        // ========== organization ==========
        put("idx_organization_create_by",  "ALTER TABLE organization ADD INDEX idx_organization_create_by (create_by)");

        // ========== schedule ==========
        put("idx_schedule_status",         "ALTER TABLE schedule ADD INDEX idx_schedule_status (status)");
        put("idx_schedule_active",         "ALTER TABLE schedule ADD INDEX idx_schedule_active (active)");

        // ========== schedule_log ==========
        put("idx_schedule_log_status",     "ALTER TABLE schedule_log ADD INDEX idx_schedule_log_status (status)");
        put("idx_schedule_log_start",      "ALTER TABLE schedule_log ADD INDEX idx_schedule_log_start (start)");
        put("idx_schedule_log_end",        "ALTER TABLE schedule_log ADD INDEX idx_schedule_log_end (end)");

        // ========== share ==========
        put("idx_share_org_id",            "ALTER TABLE share ADD INDEX idx_share_org_id (org_id)");
        put("idx_share_create_by",         "ALTER TABLE share ADD INDEX idx_share_create_by (create_by)");

        // ========== source ==========
        put("idx_source_create_by",        "ALTER TABLE source ADD INDEX idx_source_create_by (create_by)");
        put("idx_source_type",             "ALTER TABLE source ADD INDEX idx_source_type (type)");
        put("idx_source_status",           "ALTER TABLE source ADD INDEX idx_source_status (status)");

        // ========== storyboard ==========
        put("idx_storyboard_create_by",    "ALTER TABLE storyboard ADD INDEX idx_storyboard_create_by (create_by)");
        put("idx_storyboard_status",       "ALTER TABLE storyboard ADD INDEX idx_storyboard_status (status)");

        // ========== user ==========
        put("idx_user_active",             "ALTER TABLE user ADD INDEX idx_user_active (active)");

        // ========== view ==========
        put("idx_view_create_by",          "ALTER TABLE view ADD INDEX idx_view_create_by (create_by)");
        put("idx_view_type",               "ALTER TABLE view ADD INDEX idx_view_type (type)");
        put("idx_view_status",             "ALTER TABLE view ADD INDEX idx_view_status (status)");
    }};

    public AccessLogIndexMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void addIndexes() {
        log.info("Starting system table index check...");
        int created = 0;
        int skipped = 0;

        for (Map.Entry<String, String> entry : INDEXES.entrySet()) {
            String indexName = entry.getKey();
            String alterSql = entry.getValue();
            // 从索引名提取表名: idx_{table}_{column} -> {table}
            String tableName = extractTableName(indexName);

            try {
                if (indexExists(tableName, indexName)) {
                    log.debug("Index {}.{} already exists, skip.", tableName, indexName);
                    skipped++;
                    continue;
                }
                jdbcTemplate.execute(alterSql);
                log.info("Index {}.{} created successfully.", tableName, indexName);
                created++;
            } catch (Exception e) {
                log.warn("Failed to create index {}.{}: {}", tableName, indexName, e.getMessage());
            }
        }

        log.info("System table index check complete. Created: {}, Skipped: {}", created, skipped);
    }

    /**
     * 从索引名提取表名
     * 命名规范: idx_{tableName}_{columnName}  ->  tableName
     */
    private String extractTableName(String indexName) {
        // idx_link_rel_type    -> link
        // idx_access_log_user  -> access_log
        // idx_schedule_log_end -> schedule_log
        String withoutPrefix = indexName.substring(4); // 去掉 "idx_"
        int lastUnderscore = withoutPrefix.lastIndexOf('_');
        return lastUnderscore > 0 ? withoutPrefix.substring(0, lastUnderscore) : withoutPrefix;
    }

    private boolean indexExists(String tableName, String indexName) {
        try {
            Boolean exists = jdbcTemplate.execute((Connection conn) -> {
                ResultSet rs = conn.getMetaData()
                        .getIndexInfo(null, null, tableName, false, false);
                while (rs.next()) {
                    if (indexName.equalsIgnoreCase(rs.getString("INDEX_NAME"))) {
                        return true;
                    }
                }
                return false;
            });
            return Boolean.TRUE.equals(exists);
        } catch (Exception e) {
            log.warn("Failed to check index existence {}.{}: {}", tableName, indexName, e.getMessage());
            return false;
        }
    }
}
