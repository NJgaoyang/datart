package datart.data.provider.script;

import org.apache.calcite.avatica.util.Casing;
import org.apache.calcite.avatica.util.Quoting;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.parser.impl.SqlParserImpl;
import org.apache.calcite.sql.validate.SqlConformanceEnum;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Tests that Calcite 1.37.0 natively parses StarRocks/MySQL-compatible SQL expressions.
 * The previous convertStarRocksDateIntervalSyntax workaround has been removed because
 * Calcite 1.37+ natively supports DATE_SUB/DATE_ADD/SUBDATE/ADDDATE with INTERVAL args.
 */
public class SqlStringUtilsTest {

    private boolean canParse(String sql) {
        try {
            SqlParser.Config config = SqlParser.config()
                    .withParserFactory(SqlParserImpl.FACTORY)
                    .withConformance(SqlConformanceEnum.LENIENT)
                    .withQuotedCasing(Casing.UNCHANGED)
                    .withUnquotedCasing(Casing.UNCHANGED);
            SqlParser.create(sql, config).parseQuery();
            return true;
        } catch (Exception e) {
            System.out.println("Parse FAIL: " + sql + " -> " + e.getMessage().split("\n")[0]);
            return false;
        }
    }

    @Test
    public void testDateSubNativeParse() {
        assertTrue(canParse("SELECT DATE_SUB(CURRENT_DATE, INTERVAL 1 DAY) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 1 HOUR) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 2 MONTH) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 1 MINUTE) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 1 SECOND) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 1 YEAR) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 1 WEEK) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_SUB(col, INTERVAL 1 QUARTER) FROM DUAL"));
    }

    @Test
    public void testDateAddNativeParse() {
        assertTrue(canParse("SELECT DATE_ADD(col, INTERVAL 1 DAY) FROM DUAL"));
        assertTrue(canParse("SELECT DATE_ADD(date_col, INTERVAL 2 MONTH) FROM DUAL"));
    }

    @Test
    public void testSubdateAdddateNativeParse() {
        assertTrue(canParse("SELECT SUBDATE(CURRENT_DATE, INTERVAL 1 DAY) FROM DUAL"));
        assertTrue(canParse("SELECT ADDDATE(CURRENT_DATE, INTERVAL 1 DAY) FROM DUAL"));
        assertTrue(canParse("SELECT SUBDATE(ts_col, INTERVAL 7 DAY) FROM DUAL"));
        assertTrue(canParse("SELECT ADDDATE(date_col, INTERVAL 1 HOUR) FROM DUAL"));
    }

    @Test
    public void testCaseInsensitiveParse() {
        assertTrue(canParse("SELECT date_sub(col, interval 5 day) FROM DUAL"));
    }

    @Test
    public void testFunctionInsideDateSub() {
        assertTrue(canParse("SELECT DATE_SUB(func(x), INTERVAL 3 MONTH) FROM DUAL"));
    }

    @Test
    public void testMultipleDateFunctions() {
        assertTrue(canParse("SELECT DATE_SUB(a, INTERVAL 1 DAY) + DATE_ADD(b, INTERVAL 2 MONTH) FROM DUAL"));
    }

    @Test
    public void testColumnPrefixedArg() {
        assertTrue(canParse("SELECT DATE_SUB(t0.created_date, INTERVAL 1 DAY) FROM DUAL"));
    }

    @Test
    public void testExtraSpaces() {
        assertTrue(canParse("SELECT DATE_SUB(  col , INTERVAL  30   DAY  ) FROM DUAL"));
    }

    @Test
    public void testJsonObjectNativeParse() {
        assertTrue(canParse("SELECT JSON_OBJECT('id', 87, 'name', 'carrot') FROM DUAL"));
    }

    // ======================== BIT_AND (&) conversion tests ========================

    @Test
    public void testSimpleBitAnd() {
        assertEquals("BITAND(a, b)", SqlStringUtils.convertBitwiseAndOperator("a & b"));
    }

    @Test
    public void testChainedBitAnd() {
        assertEquals("BITAND(BITAND(a, b), c)",
                SqlStringUtils.convertBitwiseAndOperator("a & b & c"));
    }

    @Test
    public void testBitAndWithSpaces() {
        assertEquals("BITAND(a, b)", SqlStringUtils.convertBitwiseAndOperator("a  &  b"));
    }

    @Test
    public void testBitAndWithParenthesizedExpr() {
        assertEquals("BITAND((a + b), c)",
                SqlStringUtils.convertBitwiseAndOperator("(a + b) & c"));
    }

    @Test
    public void testRightSideParenthesized() {
        assertEquals("BITAND(a, (b | c))",
                SqlStringUtils.convertBitwiseAndOperator("a & (b | c)"));
    }

    @Test
    public void testBitAndWithFunctionCall() {
        assertEquals("BITAND(func(x), y)",
                SqlStringUtils.convertBitwiseAndOperator("func(x) & y"));
    }

    @Test
    public void testBitAndInsideSelect() {
        String input = "SELECT a & b FROM t";
        String expected = "SELECT BITAND(a, b) FROM t";
        assertEquals(expected, SqlStringUtils.convertBitwiseAndOperator(input));
    }

    @Test
    public void testBitAndWithComparison() {
        String input = "(status & 0xFF) = 0";
        String expected = "(BITAND(status, 0xFF)) = 0";
        assertEquals(expected, SqlStringUtils.convertBitwiseAndOperator(input));
    }

    @Test
    public void testStringLiteralUnchanged() {
        String input = "SELECT 'a & b' FROM t";
        assertEquals(input, SqlStringUtils.convertBitwiseAndOperator(input));
    }

    @Test
    public void testLogicalAndUnchanged() {
        String input = "a && b";
        assertEquals(input, SqlStringUtils.convertBitwiseAndOperator(input));
    }

    @Test
    public void testNoBitAndUnchanged() {
        String input = "SELECT a, b FROM t";
        assertEquals(input, SqlStringUtils.convertBitwiseAndOperator(input));
    }

    @Test
    public void testBitAndWithQualifiedNames() {
        assertEquals("BITAND(t.a, t.b)",
                SqlStringUtils.convertBitwiseAndOperator("t.a & t.b"));
    }

    @Test
    public void testBitAndWithBacktickQuoted() {
        // & inside backtick-quoted identifier should remain unchanged
        // but & outside should be converted
        assertEquals("BITAND(`col_a`, b)",
                SqlStringUtils.convertBitwiseAndOperator("`col_a` & b"));
    }

    @Test
    public void testBitAndConvertedThenParsed() {
        // Verify the converted output can be parsed by Calcite
        String converted = SqlStringUtils.convertBitwiseAndOperator("a & b");
        assertTrue(canParse("SELECT " + converted + " FROM DUAL"));

        String converted2 = SqlStringUtils.convertBitwiseAndOperator("a & b & c");
        assertTrue(canParse("SELECT " + converted2 + " FROM DUAL"));
    }

    @Test
    public void testBitAndWithHexLiteral() {
        assertEquals("BITAND(status, 0xFF)",
                SqlStringUtils.convertBitwiseAndOperator("status & 0xFF"));
    }

    @Test
    public void testBitAndWithDoubleQuotedIdentifier() {
        assertEquals("BITAND(\"col_a\", b)",
                SqlStringUtils.convertBitwiseAndOperator("\"col_a\" & b"));
    }
}
