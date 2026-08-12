package datart.server.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.sql.Connection;
import java.sql.ResultSet;

@Slf4j
@Component
public class AccessLogColumnMigration {

    private final JdbcTemplate jdbcTemplate;

    public AccessLogColumnMigration(JdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    @PostConstruct
    public void addResourceNameColumn() {
        try {
            Boolean exists = jdbcTemplate.execute((Connection conn) -> {
                ResultSet rs = conn.getMetaData()
                        .getColumns(null, null, "access_log", "resource_name");
                return rs.next();
            });
            if (Boolean.TRUE.equals(exists)) {
                log.info("Column access_log.resource_name already exists, skip migration.");
                return;
            }
            jdbcTemplate.execute("ALTER TABLE access_log ADD COLUMN resource_name varchar(256) NULL AFTER resource_id");
            log.info("Column access_log.resource_name added successfully.");
        } catch (Exception e) {
            log.warn("Failed to add resource_name column to access_log: {}", e.getMessage());
        }
    }
}
