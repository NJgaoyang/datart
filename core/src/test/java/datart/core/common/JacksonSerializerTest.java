package datart.core.common;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.junit.jupiter.api.Test;

import java.sql.Timestamp;
import java.text.SimpleDateFormat;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JacksonSerializerTest {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS)
            .setDateFormat(new SimpleDateFormat("yyyy-MM-dd HH:mm:ss"))
            .registerModule(new SimpleModule()
                    .addSerializer(java.sql.Date.class, new JacksonSerializer.SqlDateSerialize()));

    @Test
    void shouldSerializeSqlDateWithoutTime() throws Exception {
        assertEquals("\"2026-08-01\"",
                objectMapper.writeValueAsString(java.sql.Date.valueOf("2026-08-01")));
    }

    @Test
    void shouldKeepTimestampTimePart() throws Exception {
        String json = objectMapper.writeValueAsString(
                Timestamp.valueOf("2026-08-01 12:34:56"));

        assertTrue(json.contains("12:34:56"));
    }
}
