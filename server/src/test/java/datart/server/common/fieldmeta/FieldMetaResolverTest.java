package datart.server.common.fieldmeta;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class FieldMetaResolverTest {

    private final FieldMetaResolver resolver = new FieldMetaResolver();
    private final ObjectMapper objectMapper = new ObjectMapper();

    @Test
    void resolvesEmptyFalseNodeAgainstExplicitTrueNode() {
        ObjectNode column = objectMapper.createObjectNode();
        column.putArray("name").add("created_date");
        column.put("isDisplayNameCustom", false);

        ObjectNode hierarchy = objectMapper.createObjectNode();
        hierarchy.put("name", "created_date");
        hierarchy.putArray("path").add("created_date");
        hierarchy.put("displayName", "创建时间");
        hierarchy.put("comment", "创建时间");
        hierarchy.put("isDisplayNameCustom", true);

        ResolvedFieldMeta result = resolver.resolve(
                "created_date", column, hierarchy, null, "SQL");

        assertTrue(result.displayNameCustom());
        assertEquals("创建时间", result.customDisplayName());
        assertEquals(ResolvedFieldMeta.Status.ALREADY_FORMAL_CUSTOM, result.status());
    }

    @Test
    void keepsRealMarkerDivergenceAmbiguous() {
        ObjectNode column = objectMapper.createObjectNode();
        column.putArray("name").add("city");
        column.put("displayName", "城市名称");
        column.put("isDisplayNameCustom", false);

        ObjectNode hierarchy = objectMapper.createObjectNode();
        hierarchy.putArray("path").add("city");
        hierarchy.put("displayName", "城市");
        hierarchy.put("isDisplayNameCustom", true);

        ResolvedFieldMeta result = resolver.resolve("city", column, hierarchy, null, "SQL");

        assertFalse(result.displayNameCustom());
        assertEquals(ResolvedFieldMeta.Status.AMBIGUOUS, result.status());
        assertEquals("CUSTOM_MARKER_DIVERGENCE", result.reason());
    }

    @Test
    void resolvesFalseNodeWhenItsCommentMatchesExplicitDisplayName() {
        ObjectNode column = objectMapper.createObjectNode();
        column.putArray("name").add("total_batteries");
        column.put("comment", "电池总数");
        column.put("isDisplayNameCustom", false);

        ObjectNode hierarchy = objectMapper.createObjectNode();
        hierarchy.putArray("path").add("total_batteries");
        hierarchy.put("displayName", "电池总数");
        hierarchy.put("comment", "电池总数");
        hierarchy.put("isDisplayNameCustom", true);

        ResolvedFieldMeta result = resolver.resolve(
                "total_batteries", column, hierarchy, null, "SQL");

        assertTrue(result.displayNameCustom());
        assertEquals("电池总数", result.customDisplayName());
    }
}
