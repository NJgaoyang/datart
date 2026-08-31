package datart.server.common;

import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DatabaseSchemaContractTest {

    @Test
    void viewFieldSchemaContainsOnlyCanonicalMetadataColumns() throws IOException {
        String ddl = readResource("/db/migration/V3__view_field_metadata.sql").toLowerCase();

        assertTrue(ddl.contains("source_comment"));
        assertTrue(ddl.contains("custom_name"));
        assertTrue(ddl.contains("origin_name"));
        assertFalse(ddl.contains("is_display_name_custom"));
        assertFalse(ddl.contains("display_name"));
        assertFalse(ddl.contains("`comment`"));
    }

    private static String readResource(String resource) throws IOException {
        try (InputStream input = DatabaseSchemaContractTest.class.getResourceAsStream(resource)) {
            assertTrue(input != null, "Missing schema resource: " + resource);
            return new String(input.readAllBytes(), StandardCharsets.UTF_8);
        }
    }
}
