package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.entity.SourceSchemas;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
        Map<String, SqlFieldLineageResolver.SqlFieldLineage> lineages = resolver.resolve("""
                SELECT t.*, t.renting_users - t.yesterday_users AS net_increase_users
                FROM ads.daily t
                """, schema);

        assertEquals(List.of("ads", "daily", "city"), lineages.get("city").sourcePath());
        assertEquals(List.of("ads", "daily", "renting_users"), lineages.get("renting_users").sourcePath());
        assertEquals(SqlFieldLineageResolver.Status.EXPRESSION, lineages.get("net_increase_users").status());
        assertTrue(lineages.get("net_increase_users").sourcePath().isEmpty());
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
