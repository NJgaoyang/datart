package datart.data.provider.calcite;

import datart.core.base.exception.Exceptions;
import datart.core.data.provider.FunctionDefinition;
import datart.core.data.provider.FunctionDefinitionRegistry;
import datart.core.data.provider.StdSqlOperator;
import org.apache.calcite.avatica.util.Casing;
import org.apache.calcite.avatica.util.Quoting;
import org.apache.calcite.sql.SqlCall;
import org.apache.calcite.sql.SqlDialect;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.parser.impl.SqlParserImpl;
import org.apache.calcite.sql.util.SqlBasicVisitor;
import org.apache.calcite.sql.validate.SqlConformanceEnum;

import java.util.Set;
import java.util.regex.Pattern;
import java.util.ArrayList;
import java.util.List;

public class SqlParserUtils {

    private static final String SELECT_SQL = "SELECT %s FROM DATART_VTABLE";

    private static final Pattern PERCENTILE_APPROX = Pattern.compile("(?i)\\bPERCENTILE_APPROX\\b");

    public static SqlNode parseSnippet(String snippet) throws SqlParseException {
        String sql = String.format(SELECT_SQL, normalizeSnippet(snippet));
        SqlParser.Config config = SqlParser.config()
                .withParserFactory(SqlParserImpl.FACTORY)
                .withQuotedCasing(Casing.UNCHANGED)
                .withUnquotedCasing(Casing.UNCHANGED)
                .withConformance(SqlConformanceEnum.LENIENT)
                .withCaseSensitive(true)
                .withQuoting(Quoting.BRACKET);
        return SqlParser.create(sql, config).parseQuery();

    }

    public static void validateSnippet(String snippet, SqlDialect sqlDialect,
                                       Set<StdSqlOperator> supportedOperators) throws SqlParseException {
        if (PERCENTILE_APPROX.matcher(snippet).find()
                && !supportedOperators.contains(StdSqlOperator.PERCENTILE_APPROX)) {
            Exceptions.msg("Function 'PERCENTILE_APPROX' is not supported by this data source");
        }
        SqlNode node = parseSnippet(snippet);
        node.accept(new SqlBasicVisitor<Void>() {
            @Override
            public Void visit(SqlCall call) {
                StdSqlOperator operator = StdSqlOperator.symbolOf(call.getOperator().getName());
                if (operator != null && !supportedOperators.contains(operator)) {
                    Exceptions.msg("Function '" + operator.getSymbol() + "' is not supported by this data source");
                }
                if (operator != null) {
                    FunctionDefinition definition = FunctionDefinitionRegistry.definition(operator);
                    if (definition != null && (call.operandCount() < definition.getMinArgs()
                            || call.operandCount() > definition.getMaxArgs())) {
                        Exceptions.msg("Function '" + operator.getSymbol() + "' expects between "
                                + definition.getMinArgs() + " and " + definition.getMaxArgs() + " arguments");
                    }
                }
                return super.visit(call);
            }
        });
        node.toSqlString(sqlDialect);
    }

    public static SqlParser createParser(SqlDialect sqlDialect) {
        return createParser("", sqlDialect);
    }

    public static SqlParser createParser(String sql, SqlDialect sqlDialect) {
        SqlParser.Config config = SqlParser.config()
                .withParserFactory(SqlParserImpl.FACTORY)
                .withConformance(SqlConformanceEnum.LENIENT)
                .withUnquotedCasing(sqlDialect.getUnquotedCasing())
                .withQuotedCasing(sqlDialect.getQuotedCasing())
                .withQuoting(sqlDialect.configureParser(SqlParser.Config.DEFAULT).quoting());
        return SqlParser.create(sql, config);
    }

    private static String normalizeSnippet(String snippet) {
        StringBuilder normalized = new StringBuilder();
        java.util.regex.Matcher matcher = PERCENTILE_APPROX.matcher(snippet);
        int cursor = 0;
        while (matcher.find(cursor)) {
            int open = matcher.end();
            while (open < snippet.length() && Character.isWhitespace(snippet.charAt(open))) {
                open++;
            }
            if (open >= snippet.length() || snippet.charAt(open) != '(') {
                normalized.append(snippet, cursor, matcher.end());
                cursor = matcher.end();
                continue;
            }
            int close = matchingParenthesis(snippet, open);
            List<String> args = close < 0 ? List.of() : splitArguments(snippet.substring(open + 1, close));
            if (args.size() < 2 || args.size() > 3) {
                Exceptions.msg("Function 'PERCENTILE_APPROX' expects 2 or 3 arguments");
                normalized.append(snippet, cursor, matcher.end());
                cursor = matcher.end();
                continue;
            }
            normalized.append(snippet, cursor, matcher.start())
                    .append("PERCENTILE_CONT(").append(args.get(1)).append(") WITHIN GROUP (ORDER BY ")
                    .append(args.get(0));
            if (args.size() == 3) {
                // Preserve StarRocks' optional precision/compression argument in
                // the AST; the StarRocks dialect restores it on output.
                normalized.append(", ").append(args.get(2));
            }
            normalized.append(')');
            cursor = close + 1;
        }
        return normalized.append(snippet.substring(cursor)).toString();
    }

    private static int matchingParenthesis(String value, int open) {
        int level = 0;
        for (int index = open; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current == '(') level++;
            if (current == ')' && --level == 0) return index;
        }
        return -1;
    }

    private static List<String> splitArguments(String value) {
        List<String> args = new ArrayList<>();
        int level = 0;
        int start = 0;
        for (int index = 0; index < value.length(); index++) {
            char current = value.charAt(index);
            if (current == '(') level++;
            if (current == ')') level--;
            if (current == ',' && level == 0) {
                args.add(value.substring(start, index).trim());
                start = index + 1;
            }
        }
        args.add(value.substring(start).trim());
        return args;
    }
}
