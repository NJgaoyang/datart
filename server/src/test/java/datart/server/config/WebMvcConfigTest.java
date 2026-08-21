package datart.server.config;

import com.alibaba.fastjson2.JSON;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WebMvcConfigTest {

    @Test
    void shouldSerializeSqlDateWithoutTimeInFastjson() {
        new WebMvcConfig(null, null).configureMessageConverters(new ArrayList<>());

        assertEquals("\"2026-08-01\"", JSON.toJSONString(java.sql.Date.valueOf("2026-08-01")));
    }
}
