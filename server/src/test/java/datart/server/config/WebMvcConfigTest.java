package datart.server.config;

import com.alibaba.fastjson2.JSON;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.sql.Timestamp;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WebMvcConfigTest {

    @Test
    void shouldSerializeSqlDateWithoutTimeInFastjson() {
        new WebMvcConfig(null, null).configureMessageConverters(new ArrayList<>());

        assertEquals("\"2026-08-01\"", JSON.toJSONString(java.sql.Date.valueOf("2026-08-01")));
    }

    @Test
    void shouldKeepTimestampTimePartInFastjson() {
        new WebMvcConfig(null, null).configureMessageConverters(new ArrayList<>());

        String json = JSON.toJSONString(Timestamp.valueOf("2026-08-01 12:34:56"));

        assertTrue(json.contains("12:34:56"));
    }
}
