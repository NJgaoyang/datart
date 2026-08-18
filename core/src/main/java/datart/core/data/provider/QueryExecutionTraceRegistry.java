package datart.core.data.provider;

import org.apache.commons.codec.digest.DigestUtils;

import java.util.ArrayList;
import java.util.Deque;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.concurrent.ConcurrentLinkedDeque;

/** Bounded, process-local query details for the administrator monitor. */
public final class QueryExecutionTraceRegistry {

    private static final int MAX_EVENTS = 200;
    private static final Deque<Trace> EVENTS = new ConcurrentLinkedDeque<>();
    private static volatile Consumer<Map<String, Object>> completedListener;

    private QueryExecutionTraceRegistry() {
    }

    public static void setCompletedListener(Consumer<Map<String, Object>> listener) {
        completedListener = listener;
    }

    public static String start(String sourceId, String queryId, String dbType, String sql) {
        return start(sourceId, queryId, dbType, null, sql);
    }

    public static String start(String sourceId, String queryId, String dbType,
                               String reportName, String sql) {
        Trace trace = new Trace(UUID.randomUUID().toString(), sourceId, queryId, dbType, reportName,
                sql, DigestUtils.sha256Hex(sql == null ? "" : sql), System.currentTimeMillis());
        EVENTS.addFirst(trace);
        while (EVENTS.size() > MAX_EVENTS) {
            EVENTS.pollLast();
        }
        return trace.id;
    }

    public static void finish(String traceId, String status, String error) {
        for (Trace trace : EVENTS) {
            if (trace.id.equals(traceId)) {
                trace.status = status;
                trace.error = error;
                trace.endedAt = System.currentTimeMillis();
                trace.elapsedMs = Math.max(0, trace.endedAt - trace.startedAt);
                Consumer<Map<String, Object>> listener = completedListener;
                if (listener != null) {
                    try {
                        listener.accept(trace.asMap());
                    } catch (RuntimeException ignored) {
                        // Observability must never change query execution behavior.
                    }
                }
                return;
            }
        }
    }

    public static List<Map<String, Object>> recent(String sourceId) {
        List<Map<String, Object>> result = new ArrayList<>();
        for (Trace trace : EVENTS) {
            if (sourceId == null || sourceId.equals(trace.sourceId)) {
                result.add(trace.asMap());
            }
        }
        return result;
    }

    private static class Trace {
        private final String id;
        private final String sourceId;
        private final String queryId;
        private final String dbType;
        private final String reportName;
        private final String sql;
        private final String sqlDigest;
        private final long startedAt;
        private volatile long elapsedMs;
        private volatile long endedAt;
        private volatile String status = "RUNNING";
        private volatile String error;

        private Trace(String id, String sourceId, String queryId, String dbType, String reportName,
                      String sql, String sqlDigest, long startedAt) {
            this.id = id;
            this.sourceId = sourceId;
            this.queryId = queryId;
            this.dbType = dbType;
            this.reportName = reportName;
            this.sql = sql;
            this.sqlDigest = sqlDigest;
            this.startedAt = startedAt;
        }

        private Map<String, Object> asMap() {
            Map<String, Object> map = new LinkedHashMap<>();
            map.put("id", id);
            map.put("sourceId", sourceId);
            map.put("queryId", queryId);
            map.put("dbType", dbType);
            map.put("reportName", reportName);
            map.put("sql", sql);
            map.put("sqlDigest", sqlDigest);
            map.put("startedAt", startedAt);
            map.put("elapsedMs", elapsedMs);
            if (endedAt > 0) {
                map.put("endedAt", endedAt);
            }
            map.put("status", status);
            if (error != null) {
                map.put("error", error);
            }
            return map;
        }
    }
}
