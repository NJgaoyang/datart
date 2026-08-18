package datart.core.data.provider;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class QueryExecutionTraceRegistryTest {

    @Test
    void storesQueryDetailsForAdminMonitor() {
        String sql = "SELECT sensitive_column FROM sensitive_table";
        String traceId = QueryExecutionTraceRegistry.start("source-1", "query-1", "MYSQL", "日报", sql);
        QueryExecutionTraceRegistry.finish(traceId, "SUCCESS", null);

        Map<String, Object> trace = QueryExecutionTraceRegistry.recent("source-1").stream()
                .filter(item -> traceId.equals(item.get("id")))
                .findFirst()
                .orElseThrow();
        assertEquals("SUCCESS", trace.get("status"));
        assertNotEquals(sql, trace.get("sqlDigest"));
        assertEquals("日报", trace.get("reportName"));
        assertEquals(sql, trace.get("sql"));
        assertNotNull(trace.get("endedAt"));
    }
}
