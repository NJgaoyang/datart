/*
 * Datart
 * <p>
 * Copyright 2021
 * <p>
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * <p>
 * http://www.apache.org/licenses/LICENSE-2.0
 * <p>
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package datart.data.provider.script;

import com.google.common.collect.Iterables;
import datart.core.base.consts.ValueType;
import datart.core.base.exception.Exceptions;
import datart.core.common.ReflectUtils;
import datart.core.data.provider.ScriptVariable;
import datart.data.provider.base.DataProviderException;
import datart.data.provider.jdbc.SqlSplitter;
import org.apache.calcite.avatica.util.Quoting;
import org.apache.calcite.config.Lex;
import org.apache.calcite.sql.SqlDialect;
import org.apache.calcite.sql.advise.SqlSimpleParser;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.CharUtils;
import org.apache.commons.lang3.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Stack;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class SqlStringUtils {

    public static final String REG_SQL_SINGLE_LINE_COMMENT = "-{2,}.*([\r\n])";

    public static final String REG_SQL_MULTI_LINE_COMMENT = "/\\*+[\\s\\S]*\\*+/";

    public static final String REG_WITH_SQL_FRAGMENT = "((?i)WITH[\\s\\S]+(?i)AS?\\s*\\([\\s\\S]+\\))\\s*(?i)SELECT";

    /**
     * 替换脚本中的表达式类型变量
     *
     * @param sql       原始SQL
     * @param variables 变量
     * @return 替换后的SQL
     */
    public static String replaceFragmentVariables(String sql, List<ScriptVariable> variables) {
        if (CollectionUtils.isEmpty(variables)) {
            return sql;
        }
        for (ScriptVariable variable : variables) {
            if (ValueType.FRAGMENT.equals(variable.getValueType())) {
                int size = Iterables.size(variable.getValues());
                if (size != 1) {
                    Exceptions.tr(DataProviderException.class, "message.provider.variable.expression.size", size + ":" + variable.getValues());
                }
                sql = sql.replace(variable.getNameWithQuote(), Iterables.get(variable.getValues(), 0));
            }
        }
        return sql;
    }

    /**
     * 移除SQL末尾的分号
     *
     * @param sql 原始SQL
     * @return 移除末尾分号的SQL
     */
    public static String removeEndDelimiter(String sql) {
        if (StringUtils.isBlank(sql)) {
            return sql;
        }
        sql = sql.trim();
        sql = StringUtils.removeEnd(sql, SqlSplitter.DEFAULT_DELIMITER + "");
        sql = sql.trim();
        if (sql.endsWith(SqlSplitter.DEFAULT_DELIMITER + "")) {
            return removeEndDelimiter(sql);
        } else {
            return sql;
        }
    }

    public static String cleanupSql(String sql) {
        //sql = sql.replaceAll(REG_SQL_SINGLE_LINE_COMMENT, " ");
        //sql = sql.replaceAll(REG_SQL_MULTI_LINE_COMMENT, " ");
        sql = sql.replace(CharUtils.CR, CharUtils.toChar(" "));
        sql = sql.replace(CharUtils.LF, CharUtils.toChar(" "));
        return sql.trim();
    }

    public static String cleanupSqlComments(String sql, SqlDialect sqlDialect) {
        Quoting quoting = Lex.MYSQL.quoting;
        if (sqlDialect != null) {
            quoting = sqlDialect.configureParser(SqlParser.Config.DEFAULT).quoting();
        }
        List<SqlParserPos> posList = new ArrayList<>();

        SqlSimpleParser.Tokenizer tokenizer = new SqlSimpleParser.Tokenizer(sql, "", quoting);
        int currPos = 0;
        while (true) {
            SqlSimpleParser.Token token = tokenizer.nextToken();
            if (token == null) {
                break;
            } else {
                Object tokenType = ReflectUtils.getFieldValue(token, "type");
                Integer endIndex = (Integer) ReflectUtils.getFieldValue(tokenizer, "pos");
                if ("COMMENT".equals(tokenType.toString())) {
                    posList.add(new SqlParserPos(0, currPos, 0, endIndex));
                }
                currPos = endIndex;
            }
        }
        int removeLength = 0;
        for (SqlParserPos pos : posList) {
            String pattern = sql.substring(pos.getColumnNum() - removeLength, pos.getEndColumnNum() - removeLength);
            sql = StringUtils.replaceOnce(sql, pattern, "");
            removeLength = removeLength + pattern.length();
        }
        return sql.trim();
    }

    /**
     * 处理sql with语句
     *
     * @param sql
     * @return
     */
    public static String rebuildSqlWithFragment(String sql) {
        if (!sql.toLowerCase().startsWith("with")) {
            Matcher matcher = Pattern.compile(REG_WITH_SQL_FRAGMENT).matcher(sql);
            if (matcher.find()) {
                String withFragment = matcher.group();
                if (!StringUtils.isEmpty(withFragment)) {
                    if (withFragment.length() > 6) {
                        int lastSelectIndex = withFragment.length() - 6;
                        sql = sql.replace(withFragment, withFragment.substring(lastSelectIndex));
                        withFragment = withFragment.substring(0, lastSelectIndex);
                    }
                    String space = " ";
                    sql = withFragment + space + sql;
                    sql = sql.replaceAll(space + "{2,}", space);
                }
            }
        }
        return sql;
    }

    public static char[] findMissedParentheses(String str) {
        Stack<Integer> stack = new Stack<>();
        Stack<Integer> toRemove = new Stack<>();
        for (int i = 0; i < str.length(); i++) {
            char chr = str.charAt(i);
            if ('(' == chr) {
                stack.push(i);
            } else if (')' == chr) {
                if (stack.isEmpty()) {
                    toRemove.push(i);
                } else {
                    stack.pop();
                }
            }
        }
        while (!stack.isEmpty()) {
            toRemove.add(stack.pop());
        }
        if (toRemove.isEmpty()) {
            return new char[0];
        }
        char[] missedParentheses = new char[toRemove.size()];
        for (int i = 0; i < toRemove.size(); i++) {
            char c = str.charAt(toRemove.get(i));
            if (c == '(') {
                missedParentheses[i] = ')';
            } else {
                missedParentheses[i] = '(';
            }
        }
        return missedParentheses;
    }

    /**
     * Convert bitwise AND operator '&amp;' to BITAND() function calls.
     * Only converts '&amp;' that appear as binary operators outside of string literals.
     * <p>
     * Examples:
     * <pre>
     *   "a &amp; b"                   → "BITAND(a, b)"
     *   "a &amp; b &amp; c"          → "BITAND(BITAND(a, b), c)"
     *   "(status &amp; 0xFF) = 0"    → "(BITAND(status, 0xFF)) = 0"
     *   "'a &amp; b'"                → unchanged (inside string literal)
     * </pre>
     *
     * @param sql the SQL string that may contain '&amp;' bitwise AND operators
     * @return SQL with '&amp;' operators replaced by BITAND() calls
     */
    public static String convertBitwiseAndOperator(String sql) {
        if (sql == null || !sql.contains("&")) {
            return sql;
        }

        StringBuilder result = new StringBuilder();
        int len = sql.length();
        int i = 0;

        while (i < len) {
            char c = sql.charAt(i);

            // Pass through string literals unchanged (single-quote, double-quote, backtick)
            if (c == '\'' || c == '"' || c == '`') {
                int start = i;
                i = skipQuotedLiteral(sql, len, i);
                result.append(sql, start, i);
                continue;
            }

            // Check for '&' operator (but not '&&' logical AND)
            if (c == '&') {
                // Part of '&&' — pass through unchanged
                if ((i + 1 < len && sql.charAt(i + 1) == '&')
                        || (result.length() > 0 && result.charAt(result.length() - 1) == '&')) {
                    result.append(c);
                    i++;
                    continue;
                }

                // Extract left operand from the result buffer (going backward)
                int leftStart = findExpressionLeftBound(result);
                // Preserve leading whitespace (e.g., space after "SELECT" in "SELECT a")
                int leftExprStart = leftStart;
                while (leftExprStart < result.length()
                        && Character.isWhitespace(result.charAt(leftExprStart))) {
                    leftExprStart++;
                }
                String leftExpr = result.substring(leftExprStart).trim();
                String leftLeadingWs = result.substring(leftStart, leftExprStart);
                result.setLength(leftStart);
                result.append(leftLeadingWs);

                // Skip the '&' and following whitespace
                i++;
                while (i < len && Character.isWhitespace(sql.charAt(i))) {
                    i++;
                }

                // Extract right operand from remaining SQL
                int rightEnd = findExpressionRightBound(sql, len, i);
                String rightExpr = sql.substring(i, rightEnd).trim();
                i = rightEnd;

                result.append("BITAND(").append(leftExpr).append(", ").append(rightExpr).append(")");

                // Preserve space before a keyword that follows the right expression
                // (e.g., "a & b FROM t" → should keep space before FROM)
                if (i < len && i > 0 && sql.charAt(i - 1) == ' '
                        && Character.isLetter(sql.charAt(i))) {
                    result.append(' ');
                }
                continue;
            }

            result.append(c);
            i++;
        }

        return result.toString();
    }

    /**
     * Skip a quoted literal (single-quote, double-quote, or backtick),
     * handling escaped quotes within the literal.
     *
     * @return the index after the closing quote, or len if unclosed
     */
    static int skipQuotedLiteral(String sql, int len, int start) {
        char quote = sql.charAt(start);
        int i = start + 1;
        while (i < len) {
            char ch = sql.charAt(i);
            if (ch == quote) {
                i++;
                // Check for escaped quote (doubled, e.g. '' or "" in SQL)
                if (i < len && sql.charAt(i) == quote) {
                    i++;
                    continue;
                }
                return i;
            }
            if (ch == '\\' && i + 1 < len) {
                i++; // skip escape char and the escaped character
            }
            i++;
        }
        return len;
    }

    /**
     * Find the start position of the rightmost continuous expression in the buffer.
     * Walks backward from the end, tracking parentheses, stopping at delimiters
     * that terminate the expression.
     */
    static int findExpressionLeftBound(StringBuilder result) {
        int j = result.length() - 1;
        // Skip trailing whitespace
        while (j >= 0 && Character.isWhitespace(result.charAt(j))) {
            j--;
        }
        if (j < 0) {
            return 0;
        }

        int parenDepth = 0;
        while (j >= 0) {
            char ch = result.charAt(j);
            if (ch == ')') {
                parenDepth++;
                j--;
                continue;
            }
            if (ch == '(') {
                if (parenDepth > 0) {
                    // Matching '(' for a previously seen ')' — e.g. inside func(x)
                    parenDepth--;
                    j--;
                    continue;
                }
                // Structural '(' at depth 0 — not part of our expression, stop before it
                return j + 1;
            }
            if (parenDepth > 0) {
                j--;
                continue;
            }
            // Stop at expression terminators when at depth 0
            if (isExpressionTerminator(ch, result, j)) {
                return j + 1;
            }
            j--;
        }
        return 0;
    }

    /**
     * Find the end position of the leftmost continuous expression in the remaining SQL.
     * Walks forward, tracking parentheses, stopping at delimiters.
     */
    static int findExpressionRightBound(String sql, int len, int start) {
        int i = start;
        int parenDepth = 0;

        while (i < len) {
            char c = sql.charAt(i);
            char prev = i > start ? sql.charAt(i - 1) : ' ';
            char next = i + 1 < len ? sql.charAt(i + 1) : ' ';

            // Skip quoted literals inside the expression
            if (c == '\'' || c == '"' || c == '`') {
                i = skipQuotedLiteral(sql, len, i);
                if (i >= len) {
                    return len;
                }
                continue;
            }

            if (c == '(') {
                parenDepth++;
                i++;
                continue;
            }
            if (c == ')') {
                if (parenDepth > 0) {
                    parenDepth--;
                    i++;
                    continue;
                }
                return i; // unmatched closing paren — boundary
            }

            if (parenDepth > 0) {
                i++;
                continue;
            }

            // At depth 0, check for terminators
            if (c == ',' || c == ';') {
                return i;
            }
            // Another '&' — stop so it gets processed in next iteration
            if (c == '&' && next != '&' && prev != '&') {
                return i;
            }
            // Comparison operators: =, <, >, <=, >=, <>, !=
            if (c == '=' && prev != '<' && prev != '>' && prev != '!' && prev != ':') {
                return i;
            }
            if (c == '<' && next != '=' && next != '>') {
                return i;
            }
            if (c == '>' && next != '=') {
                return i;
            }
            // SQL clause keywords that terminate an expression
            if (isBoundaryKeywordAt(sql, len, i)) {
                return i;
            }

            i++;
        }
        return len;
    }

    /**
     * Check if a character at the given position marks an expression boundary (left side).
     */
    private static boolean isExpressionTerminator(char ch, StringBuilder buf, int pos) {
        if (ch == ',' || ch == ';') {
            return true;
        }
        if (ch == '&' && (pos == 0 || buf.charAt(pos - 1) != '&')) {
            return true;
        }
        if (ch == '=') {
            char prev = pos > 0 ? buf.charAt(pos - 1) : ' ';
            return prev != '<' && prev != '>' && prev != '!' && prev != ':';
        }
        if (ch == '<') {
            char prev = pos > 0 ? buf.charAt(pos - 1) : ' ';
            return prev != '<';
        }
        if (ch == '>') {
            char prev = pos > 0 ? buf.charAt(pos - 1) : ' ';
            return prev != '>';
        }
        if (ch == '|') {
            return true;
        }
        // Check for SQL clause keywords ending at this position
        return isBoundaryKeywordAtEnd(buf, pos);
    }

    /**
     * Check if a SQL clause boundary keyword starts at position i in the given string.
     */
    private static boolean isBoundaryKeywordAt(String s, int len, int i) {
        // Only check if at a word boundary start
        if (i > 0 && Character.isLetterOrDigit(s.charAt(i - 1))) {
            return false;
        }
        return startsWithKeyword(s, len, i, "FROM")
                || startsWithKeyword(s, len, i, "WHERE")
                || startsWithKeyword(s, len, i, "GROUP")
                || startsWithKeyword(s, len, i, "ORDER")
                || startsWithKeyword(s, len, i, "HAVING")
                || startsWithKeyword(s, len, i, "LIMIT")
                || startsWithKeyword(s, len, i, "OFFSET")
                || startsWithKeyword(s, len, i, "UNION")
                || startsWithKeyword(s, len, i, "AND")
                || startsWithKeyword(s, len, i, "OR")
                || startsWithKeyword(s, len, i, "NOT")
                || startsWithKeyword(s, len, i, "LIKE")
                || startsWithKeyword(s, len, i, "BETWEEN")
                || startsWithKeyword(s, len, i, "INNER")
                || startsWithKeyword(s, len, i, "OUTER")
                || startsWithKeyword(s, len, i, "LEFT")
                || startsWithKeyword(s, len, i, "RIGHT")
                || startsWithKeyword(s, len, i, "CROSS")
                || startsWithKeyword(s, len, i, "JOIN")
                || startsWithKeyword(s, len, i, "ON");
    }

    /**
     * Check if a SQL clause boundary keyword ends at position pos in the buffer.
     */
    private static boolean isBoundaryKeywordAtEnd(StringBuilder buf, int pos) {
        if (pos < 1) {
            return false;
        }
        // Check if the character at pos is the end of a keyword
        // Walk backward to find the start of the current word
        int wordStart = pos;
        while (wordStart >= 0 && Character.isLetterOrDigit(buf.charAt(wordStart))) {
            wordStart--;
        }
        wordStart++;
        if (wordStart > pos) {
            return false;
        }
        // Also check the character right after pos (should be non-alphanumeric)
        if (pos + 1 < buf.length() && Character.isLetterOrDigit(buf.charAt(pos + 1))) {
            return false; // this is not the end of a word
        }
        String word = buf.substring(wordStart, pos + 1);
        return isSqlBoundaryKeyword(word);
    }

    private static boolean startsWithKeyword(String s, int len, int i, String kw) {
        int kwLen = kw.length();
        if (i + kwLen > len) {
            return false;
        }
        if (!s.substring(i, i + kwLen).equalsIgnoreCase(kw)) {
            return false;
        }
        // Must be followed by whitespace, non-alphanumeric, or end
        return i + kwLen >= len || !Character.isLetterOrDigit(s.charAt(i + kwLen));
    }

    private static boolean isSqlBoundaryKeyword(String word) {
        if (word == null || word.isEmpty()) {
            return false;
        }
        String upper = word.toUpperCase();
        return "SELECT".equals(upper) || "FROM".equals(upper) || "WHERE".equals(upper)
                || "GROUP".equals(upper) || "ORDER".equals(upper) || "HAVING".equals(upper)
                || "LIMIT".equals(upper) || "OFFSET".equals(upper) || "UNION".equals(upper)
                || "AND".equals(upper) || "OR".equals(upper) || "NOT".equals(upper)
                || "LIKE".equals(upper) || "BETWEEN".equals(upper) || "INNER".equals(upper)
                || "OUTER".equals(upper) || "LEFT".equals(upper) || "RIGHT".equals(upper)
                || "CROSS".equals(upper) || "JOIN".equals(upper) || "ON".equals(upper);
    }
}
