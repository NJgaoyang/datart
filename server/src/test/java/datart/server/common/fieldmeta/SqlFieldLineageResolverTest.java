package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import datart.core.entity.SourceSchemas;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlFieldLineageResolverTest {

    private final ObjectMapper json = new ObjectMapper();
    private final SqlFieldLineageResolver resolver = new SqlFieldLineageResolver();

    @Test
    void resolvesDirectAndAliasedPhysicalColumns() throws Exception {
        SourceSchemaIndex.Index schema = schema("""
                [{"dbName":"ads","tables":[{"tableName":"user_daily_report","columns":[
                  {"name":["ads","user_daily_report","created_date"],"comment":"创建时间"},
                  {"name":["ads","user_daily_report","renting_users"],"comment":"在租用户数"}
                ]}]}]
                """);

        Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages = resolver.resolve("""
                SELECT t.created_date, t.renting_users AS current_users
                FROM ads.user_daily_report t
                """, schema);

        assertEquals(List.of("ads", "user_daily_report", "created_date"), lineages.get("created_date").sourcePath());
        assertEquals(SqlFieldLineageResolver.Status.DIRECT_COLUMN, lineages.get("created_date").status());
        assertEquals(List.of("ads", "user_daily_report", "renting_users"), lineages.get("current_users").sourcePath());
        assertEquals(SqlFieldLineageResolver.Status.ALIASED_COLUMN, lineages.get("current_users").status());
    }

    @Test
    void expandsStarAndLeavesExpressionsWithoutPhysicalPath() throws Exception {
        SourceSchemaIndex.Index schema = schema("""
                [{"dbName":"ads","tables":[{"tableName":"daily","columns":[
                  {"name":["ads","daily","city"],"comment":"城市"},
                  {"name":["ads","daily","renting_users"],"comment":"在租用户数"}
                ]}]}]
                """);
        ObjectNode model = (ObjectNode) json.readTree("""
                {"columns":{
                  "city":{"name":["city"]},
                  "renting_users":{"name":["renting_users"]},
                  "net_increase_users":{"name":["net_increase_users"]}
                }}
                """);

        resolver.enrichModel("""
                SELECT t.*, t.renting_users - t.yesterday_users AS net_increase_users
                FROM ads.daily t
                """, model, schema);

        assertEquals("ads", model.at("/columns/city/path/0").asText());
        assertEquals("city", model.at("/columns/city/path/2").asText());
        assertEquals("renting_users", model.at("/columns/renting_users/path/2").asText());
        assertFalse(model.at("/columns/net_increase_users/path").isArray());
    }

    @Test
    void resolvesOnlyAUniqueUnqualifiedColumn() throws Exception {
        SourceSchemaIndex.Index schema = schema("""
                [{"dbName":"ads","tables":[
                  {"tableName":"users","columns":[{"name":["ads","users","city"],"comment":"城市"}]},
                  {"tableName":"orders","columns":[{"name":["ads","orders","city"],"comment":"下单城市"}]}
                ]}]
                """);

        SqlFieldLineageResolver.SqlFieldLineage lineage = resolver.resolve("""
                SELECT city FROM ads.users u JOIN ads.orders o ON u.id = o.user_id
                """, schema).get("city");

        assertEquals(SqlFieldLineageResolver.Status.AMBIGUOUS, lineage.status());
        assertTrue(lineage.sourcePath().isEmpty());
    }

    private SourceSchemaIndex.Index schema(String schemasJson) {
        SourceSchemasMapperExt mapper = Mockito.mock(SourceSchemasMapperExt.class);
        SourceSchemas schemas = new SourceSchemas();
        schemas.setSchemas(schemasJson);
        Mockito.when(mapper.selectBySource("source-1")).thenReturn(schemas);
        return new SourceSchemaIndex(mapper, json).forSource("source-1");
    }
}
