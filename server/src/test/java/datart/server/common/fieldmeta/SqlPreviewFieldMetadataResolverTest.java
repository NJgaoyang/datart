package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import datart.core.base.consts.ValueType;
import datart.core.data.provider.Column;
import datart.core.data.provider.PreviewFieldMeta;
import datart.core.entity.SourceSchemas;
import datart.core.mappers.ext.SourceSchemasMapperExt;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SqlPreviewFieldMetadataResolverTest {

    @Test
    void usesPhysicalCommentsButKeepsExpressionsConservative() {
        SourceSchemaIndex.Index schema = schema();
        SqlPreviewFieldMetadataResolver resolver =
                new SqlPreviewFieldMetadataResolver(new SqlFieldLineageResolver());

        List<PreviewFieldMeta> fields = resolver.resolve("""
                SELECT city, renting_users - last_month_users AS net_increase_users
                FROM ads.daily
                """, List.of(
                Column.of(ValueType.STRING, "city"),
                Column.of(ValueType.NUMERIC, "net_increase_users")), schema);

        assertEquals("城市", fields.get(0).getDisplayName());
        assertEquals("城市", fields.get(0).getSourceComment());
        assertEquals(List.of("ads", "daily", "city"), fields.get(0).getSourcePath());
        assertEquals("net_increase_users", fields.get(1).getDisplayName());
        assertTrue(fields.get(1).getSourcePath().isEmpty());
    }

    @Test
    void expandsSelectStarWithPhysicalComments() {
        SourceSchemaIndex.Index schema = schema();
        SqlPreviewFieldMetadataResolver resolver =
                new SqlPreviewFieldMetadataResolver(new SqlFieldLineageResolver());

        List<PreviewFieldMeta> fields = resolver.resolve("SELECT * FROM ads.daily", List.of(
                Column.of(ValueType.STRING, "city"),
                Column.of(ValueType.NUMERIC, "renting_users")), schema);

        assertEquals("城市", fields.get(0).getDisplayName());
        assertEquals("在租用户数", fields.get(1).getDisplayName());
    }

    @Test
    void keepsChineseLabelsThroughASimpleSelectStarSubquery() {
        SqlPreviewFieldMetadataResolver resolver =
                new SqlPreviewFieldMetadataResolver(new SqlFieldLineageResolver());

        List<PreviewFieldMeta> fields = resolver.resolve("""
                SELECT t1.city,
                       t1.renting_users,
                       t1.renting_users - LAG(t1.renting_users) OVER (ORDER BY t1.city) AS month_increase_users
                FROM (SELECT * FROM ads.daily) t1
                """, List.of(
                Column.of(ValueType.STRING, "city"),
                Column.of(ValueType.NUMERIC, "renting_users"),
                Column.of(ValueType.NUMERIC, "month_increase_users")), schema());

        assertEquals("城市", fields.get(0).getDisplayName());
        assertEquals("在租用户数", fields.get(1).getDisplayName());
        assertEquals("month_increase_users", fields.get(2).getDisplayName());
    }

    @Test
    void keepsChineseLabelsThroughSimpleStarCtes() {
        SqlPreviewFieldMetadataResolver resolver =
                new SqlPreviewFieldMetadataResolver(new SqlFieldLineageResolver());

        List<PreviewFieldMeta> fields = resolver.resolve("""
                WITH monthly AS (SELECT * FROM ads.daily),
                     scoped_monthly AS (SELECT * FROM monthly)
                SELECT t.city, t.renting_users,
                       t.renting_users - LAG(t.renting_users) OVER (ORDER BY t.city) AS month_increase_users
                FROM scoped_monthly t
                """, List.of(
                Column.of(ValueType.STRING, "city"),
                Column.of(ValueType.NUMERIC, "renting_users"),
                Column.of(ValueType.NUMERIC, "month_increase_users")), schema());

        assertEquals("城市", fields.get(0).getDisplayName());
        assertEquals("在租用户数", fields.get(1).getDisplayName());
        assertEquals("month_increase_users", fields.get(2).getDisplayName());
    }

    @Test
    void keepsChineseLabelsWhenSqlContainsADatartPermissionVariable() {
        SqlPreviewFieldMetadataResolver resolver =
                new SqlPreviewFieldMetadataResolver(new SqlFieldLineageResolver());

        List<PreviewFieldMeta> fields = resolver.resolve("""
                SELECT t1.city, t1.renting_users
                FROM (SELECT * FROM ads.daily WHERE month_label >= '2026-06' ORDER BY month_label DESC) t1
                WHERE t1.city IN (
                    SELECT city_name FROM ads.user_city_permission
                    WHERE username_en = $DATART_USER_USERNAME$
                )
                """, List.of(
                Column.of(ValueType.STRING, "city"),
                Column.of(ValueType.NUMERIC, "renting_users")), schema());

        assertEquals("城市", fields.get(0).getDisplayName());
        assertEquals("在租用户数", fields.get(1).getDisplayName());
    }

    private SourceSchemaIndex.Index schema() {
        SourceSchemasMapperExt mapper = Mockito.mock(SourceSchemasMapperExt.class);
        SourceSchemas schemas = new SourceSchemas();
        schemas.setSchemas("""
                [{"dbName":"ads","tables":[{"tableName":"daily","columns":[
                  {"name":["ads","daily","city"],"comment":"城市"},
                  {"name":["ads","daily","renting_users"],"comment":"在租用户数"},
                  {"name":["ads","daily","last_month_users"],"comment":"上月用户数"}
                ]}]}]
                """);
        Mockito.when(mapper.selectBySource("source-1")).thenReturn(schemas);
        return new SourceSchemaIndex(mapper, new ObjectMapper()).forSource("source-1");
    }
}
