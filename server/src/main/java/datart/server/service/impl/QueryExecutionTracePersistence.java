package datart.server.service.impl;

import datart.core.data.provider.QueryExecutionTraceRegistry;
import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.sql.Connection;
import java.sql.ResultSet;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ArrayBlockingQueue;
import java.util.concurrent.TimeUnit;

/** Persists completed query details for the administrator monitor. */
@Component
@Slf4j
public class QueryExecutionTracePersistence {

    private static final int QUEUE_CAPACITY = 2_000;
    private static final int MAX_ERROR_LENGTH = 2_000;
    private static final int CLEANUP_EVERY_WRITES = 100;
    private static final int MAX_RECENT_TRACES = 200;

    private final JdbcTemplate jdbcTemplate;
    private final ArrayBlockingQueue<Map<String, Object>> queue = new ArrayBlockingQueue<>(QUEUE_CAPACITY);
    private final int retentionDays;
    private volatile boolean stop;
    private int writesSinceCleanup;
    private Thread writer;

    public QueryExecutionTracePersistence(JdbcTemplate jdbcTemplate,
                                          @Value("${datart.query-trace.retention-days:30}") int retentionDays) {
        this.jdbcTemplate = jdbcTemplate;
        this.retentionDays = Math.max(1, retentionDays);
    }

    @PostConstruct
    public void start() {
        createTable();
        QueryExecutionTraceRegistry.setCompletedListener(this::enqueue);
        writer = new Thread(this::writeLoop, "datart-query-trace-writer");
        writer.setDaemon(true);
        writer.start();
    }

    @PreDestroy
    public void stop() {
        QueryExecutionTraceRegistry.setCompletedListener(null);
        stop = true;
        if (writer != null) {
            writer.interrupt();
            try {
                writer.join(5_000);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    public List<Map<String, Object>> recent(String sourceId) {
        return recent(sourceId, MAX_RECENT_TRACES);
    }

    public List<Map<String, Object>> recent(String sourceId, int limit) {
        int safeLimit = Math.max(1, Math.min(limit, MAX_RECENT_TRACES));
        try {
            List<Map<String, Object>> persisted = jdbcTemplate.queryForList(
                    "SELECT id, source_id AS sourceId, query_id AS queryId, db_type AS dbType, "
                            + "report_name AS reportName, sql_text AS sql, sql_digest AS sqlDigest, "
                            + "started_at AS startedAt, ended_at AS endedAt, elapsed_ms AS elapsedMs, "
                            + "status, error FROM datart_query_trace WHERE source_id = ? "
                    + "ORDER BY started_at DESC LIMIT ?", sourceId, safeLimit);
            Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
            for (Map<String, Object> trace : QueryExecutionTraceRegistry.recent(sourceId)) {
                merged.put(String.valueOf(trace.get("id")), trace);
            }
            for (Map<String, Object> trace : persisted) {
                merged.putIfAbsent(String.valueOf(trace.get("id")), trace);
            }
            return merged.values().stream().limit(safeLimit).toList();
        } catch (Exception e) {
            log.debug("Query trace table is unavailable; using process-local summaries", e);
            return QueryExecutionTraceRegistry.recent(sourceId).stream().limit(safeLimit).toList();
        }
    }

    private void createTable() {
        try {
            jdbcTemplate.execute("CREATE TABLE IF NOT EXISTS datart_query_trace ("
                    + "id varchar(64) NOT NULL, source_id varchar(64) NOT NULL, query_id varchar(128), "
                    + "db_type varchar(32), report_name varchar(255), sql_text LONGTEXT, sql_digest char(64) NOT NULL, "
                    + "started_at bigint NOT NULL, ended_at bigint, "
                    + "elapsed_ms bigint NOT NULL DEFAULT 0, status varchar(16) NOT NULL, error varchar(2000), "
                    + "PRIMARY KEY (id), INDEX idx_datart_query_trace_source_time (source_id, started_at)"
                    + ") ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
            addColumnIfMissing("ALTER TABLE datart_query_trace ADD COLUMN report_name varchar(255)");
            addColumnIfMissing("ALTER TABLE datart_query_trace ADD COLUMN sql_text LONGTEXT");
            addColumnIfMissing("ALTER TABLE datart_query_trace ADD COLUMN ended_at bigint");
            addIndexIfMissing("datart_query_trace", "idx_datart_query_trace_started_at",
                    "ALTER TABLE datart_query_trace ADD INDEX idx_datart_query_trace_started_at (started_at)");
        } catch (Exception e) {
            log.warn("Failed to create datart_query_trace table: {}", e.getMessage());
        }
    }

    private void addColumnIfMissing(String sql) {
        try {
            jdbcTemplate.execute(sql);
        } catch (Exception e) {
            log.debug("Query trace schema already contains column or cannot be altered: {}", e.getMessage());
        }
    }

    private void addIndexIfMissing(String tableName, String indexName, String sql) {
        try {
            Boolean exists = jdbcTemplate.execute((Connection connection) -> {
                try (ResultSet indexes = connection.getMetaData()
                        .getIndexInfo(connection.getCatalog(), null, tableName, false, false)) {
                    while (indexes.next()) {
                        if (indexName.equalsIgnoreCase(indexes.getString("INDEX_NAME"))) {
                            return true;
                        }
                    }
                }
                return false;
            });
            if (!Boolean.TRUE.equals(exists)) {
                jdbcTemplate.execute(sql);
            }
        } catch (Exception e) {
            log.debug("Query trace index check failed for {}: {}", indexName, e.getMessage());
        }
    }

    private void enqueue(Map<String, Object> trace) {
        if (!queue.offer(new HashMap<>(trace))) {
            log.debug("Query trace queue is full; dropping summary {}", trace.get("id"));
        }
    }

    private void writeLoop() {
        while (!stop || !queue.isEmpty()) {
            try {
                Map<String, Object> trace = queue.poll(1, TimeUnit.SECONDS);
                if (trace != null) {
                    write(trace);
                }
            } catch (InterruptedException e) {
                if (stop) {
                    break;
                }
            } catch (Exception e) {
                log.warn("Query trace insert failed: {}", e.getMessage());
            }
        }
    }

    private void write(Map<String, Object> trace) {
        String error = (String) trace.get("error");
        jdbcTemplate.update("INSERT INTO datart_query_trace "
                        + "(id, source_id, query_id, db_type, report_name, sql_text, sql_digest, started_at, ended_at, "
                        + "elapsed_ms, status, error) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                trace.get("id"), trace.get("sourceId"), trace.get("queryId"), trace.get("dbType"),
                trace.get("reportName"), trace.get("sql"), trace.get("sqlDigest"), trace.get("startedAt"),
                trace.get("endedAt"), trace.get("elapsedMs"), trace.get("status"),
                error == null ? null : error.substring(0, Math.min(MAX_ERROR_LENGTH, error.length())));
        if (++writesSinceCleanup >= CLEANUP_EVERY_WRITES) {
            writesSinceCleanup = 0;
            long cutoff = System.currentTimeMillis() - retentionDays * 86_400_000L;
            jdbcTemplate.update("DELETE FROM datart_query_trace WHERE started_at < ?", cutoff);
        }
    }
}
