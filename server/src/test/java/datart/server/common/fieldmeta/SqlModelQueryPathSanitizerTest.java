package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.entity.SourceSchemas;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class SqlModelQueryPathSanitizerTest {

    @Test
    void removesOnlyPathsEqualToResolvedPhysicalLineage() throws Exception {
        ObjectMapper json = new ObjectMapper();
        SourceSchemasMapperExt mapper = Mockito.mock(SourceSchemasMapperExt.class);
        SourceSchemas schemas = new SourceSchemas();
        schemas.setSchemas("[{\"dbName\":\"ads\",\"tables\":[{\"tableName\":\"daily\",\"columns\":["
                + "{\"name\":[\"ads\",\"daily\",\"city\"]}]}]}]");
        Mockito.when(mapper.selectBySource("source-1")).thenReturn(schemas);
        SourceSchemaIndex.Index index = new SourceSchemaIndex(mapper, json).forSource("source-1");
        ObjectNode model = (ObjectNode) json.readTree("""
                {"columns":{
                  "city":{"name":["city"],"path":["ads","daily","city"]},
                  "legacy":{"name":["legacy"],"path":["ads","daily","other"]}
                },"hierarchy":{
                  "city":{"name":["city"],"path":["ads","daily","city"]}
                }}
                """);

        SqlModelQueryPathSanitizer sanitizer = new SqlModelQueryPathSanitizer();

        assertEquals(2, sanitizer.count("SELECT t.city FROM ads.daily t", model, index));
        assertEquals(2, sanitizer.sanitize("SELECT t.city FROM ads.daily t", model, index));
        assertFalse(model.at("/columns/city/path").isArray());
        assertFalse(model.at("/hierarchy/city/path").isArray());
        assertEquals("other", model.at("/columns/legacy/path/2").asText());
    }
}
