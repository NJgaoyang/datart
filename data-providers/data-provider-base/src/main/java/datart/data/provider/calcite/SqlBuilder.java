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
package datart.data.provider.calcite;


import datart.core.base.consts.ValueType;
import datart.core.base.exception.Exceptions;
import datart.data.provider.base.DataProviderException;
import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.SelectColumn;
import datart.core.data.provider.SingleTypedValue;
import datart.core.data.provider.sql.*;
import datart.data.provider.calcite.custom.CustomSqlBetweenOperator;
import datart.data.provider.script.SqlStringUtils;
import org.apache.calcite.sql.*;
import org.apache.calcite.sql.fun.SqlBetweenOperator;
import org.apache.calcite.sql.fun.SqlStdOperatorTable;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.apache.commons.lang3.StringUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.util.CollectionUtils;

import java.util.*;
import java.util.stream.Collectors;


public class SqlBuilder {

    private static final Logger log = LoggerFactory.getLogger(SqlBuilder.class);

    private QueryScriptProcessResult queryScriptProcessResult;

    private final Map<String, SqlNode> functionColumnMap = new HashMap<>();

    private ExecuteParam executeParam;

    private SqlDialect dialect;

    private boolean withPage;

    private boolean quoteIdentifiers;

    private boolean withNamePrefix;

    private String namePrefix;

    private Map<String, String> tableAlias;


    private SqlBuilder() {
    }

    public static SqlBuilder builder() {
        return new SqlBuilder();
    }


    public SqlBuilder withAddDefaultNamePrefix(boolean withDefaultNamePrefix) {
        this.withNamePrefix = withDefaultNamePrefix;
        return this;
    }

    public SqlBuilder withDefaultNamePrefix(String defaultNamePrefix) {
        this.namePrefix = defaultNamePrefix;
        return this;
    }


    public SqlBuilder withQueryScriptProcessResult(QueryScriptProcessResult queryScriptProcessResult) {
        this.queryScriptProcessResult = queryScriptProcessResult;
        return this;
    }

    public SqlBuilder withExecuteParam(ExecuteParam executeParam) {
        this.executeParam = executeParam;
        return this;
    }


    public SqlBuilder withDialect(SqlDialect sqlDialect) {
        this.dialect = sqlDialect;
        return this;
    }


    public SqlBuilder withPage(boolean withPage) {
        this.withPage = withPage;
        return this;
    }

    public SqlBuilder withQuoteIdentifiers(boolean quoteIdentifiers) {
        this.quoteIdentifiers = quoteIdentifiers;
        return this;
    }


    /**
     * 根据页面操作生成的Aggregator,Filter,Group By, Order By等操作符，重新构建SQL。
     * <p>
     * SELECT [[group columns],[agg columns]] FROM (SQL) T <filters> <groups> <orders>
     */
    public String build() throws SqlParseException {

        final SqlNodeList selectList = new SqlNodeList(SqlParserPos.ZERO);

        final SqlNodeList orderBy = new SqlNodeList(SqlParserPos.ZERO);

        final SqlNodeList groupBy = new SqlNodeList(SqlParserPos.ZERO);

        SqlNode where = null;

        SqlNode having = null;

        // Load table alias map from struct view script processor
        this.tableAlias = queryScriptProcessResult != null
                ? queryScriptProcessResult.getTableAlias()
                : null;

        //function columns
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getFunctionColumns())) {
            for (FunctionColumn functionColumn : executeParam.getFunctionColumns()) {
                try {
                    functionColumnMap.put(functionColumn.getAlias(), parseSnippet(functionColumn, namePrefix, true));
                } catch (SqlParseException e) {
                    log.error("Failed to parse function column '{}': snippet={}, error={}",
                            functionColumn.getAlias(), functionColumn.getSnippet(), e.getMessage());
                    Exceptions.tr(DataProviderException.class,
                            "message.provider.sql.parse.snippet",
                            functionColumn.getAlias() != null ? functionColumn.getAlias() : functionColumn.getSnippet(),
                            e.getMessage());
                }
            }
        }

        //columns
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getColumns())) {
            for (SelectColumn column : executeParam.getColumns()) {
                if (functionColumnMap.containsKey(column.getColumnKey())) {
                    selectList.add(SqlNodeUtils.createAliasNode(functionColumnMap.get(column.getColumnKey()), column.getAlias()));
                } else {
                    selectList.add(SqlNodeUtils.createAliasNode(createColumnIdentifier(column.getColumnNames(withNamePrefix, namePrefix)), column.getAlias()));
                }
            }
        }

        // filters
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getFilters())) {
            for (FilterOperator filter : executeParam.getFilters()) {
                SqlNode filterSqlNode = filterSqlNode(filter);
                if (filter.getAggOperator() != null) {
                    if (having == null) {
                        having = filterSqlNode;
                    } else {
                        having = new SqlBasicCall(SqlStdOperatorTable.AND, new SqlNode[]{having, filterSqlNode}, SqlParserPos.ZERO);
                    }
                } else {
                    if (where == null) {
                        where = filterSqlNode;
                    } else {
                        where = new SqlBasicCall(SqlStdOperatorTable.AND, new SqlNode[]{where, filterSqlNode}, SqlParserPos.ZERO);
                    }
                }
            }
        }

        //group by
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getGroups())) {
            for (GroupByOperator group : executeParam.getGroups()) {
                SqlNode sqlNode = null;
                if (functionColumnMap.containsKey(group.getColumnKey())) {
                    sqlNode = functionColumnMap.get(group.getColumnKey());
                    selectList.add(SqlNodeUtils.createAliasNode(sqlNode, group.getAlias()));
                } else {
                    sqlNode = createColumnIdentifier(group.getColumnNames(withNamePrefix, namePrefix));
                    selectList.add(SqlNodeUtils.createAliasNode(sqlNode, group.getAlias()));
                }
                groupBy.add(sqlNode);
            }
        }

        // aggregators
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getAggregators())) {
            for (AggregateOperator aggregator : executeParam.getAggregators()) {
                selectList.add(createAggNode(aggregator));
            }
        }

        // Auto-add date-level / function-column aggregators to GROUP BY
        // when mixed with real aggregate functions (SUM, COUNT, etc.) and
        // no explicit GROUP BY exists.
        // Date-level aggregators (AGG_DATE_YEAR, AGG_DATE_MONTH, etc.) are
        // rendered as scalar SQL functions (YEAR(), DATE_FORMAT()), not true
        // aggregate functions. SQL engines (StarRocks, MySQL, etc.) require
        // all non-aggregate SELECT expressions to appear in GROUP BY.
        if (groupBy.size() == 0 && executeParam != null
                && !CollectionUtils.isEmpty(executeParam.getAggregators())) {
            boolean hasRealAggregate = false;
            for (AggregateOperator agg : executeParam.getAggregators()) {
                if (agg.getSqlOperator() != null) {
                    hasRealAggregate = true;
                    break;
                }
            }
            if (hasRealAggregate) {
                for (AggregateOperator agg : executeParam.getAggregators()) {
                    if (agg.getSqlOperator() == null) {
                        if (functionColumnMap.containsKey(agg.getColumnKey())) {
                            groupBy.add(functionColumnMap.get(agg.getColumnKey()));
                        } else {
                            // Date-level aggregator (AGG_DATE_YEAR, AGG_DATE_MONTH, etc.)
                            // rendered as scalar expression → add its column to GROUP BY
                            groupBy.add(createColumnIdentifier(agg.getColumnNames(withNamePrefix, namePrefix)));
                        }
                    }
                }
            }
        }

        //order
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getOrders())) {
            for (OrderOperator order : executeParam.getOrders()) {
                orderBy.add(createOrderNode(order));
            }
        }

        //keywords
        SqlNodeList keywordList = new SqlNodeList(SqlParserPos.ZERO);
        if (executeParam != null && !CollectionUtils.isEmpty(executeParam.getKeywords())) {
            for (SelectKeyword keyword : executeParam.getKeywords()) {
                keywordList.add(SqlLiteral.createSymbol(SqlSelectKeyword.valueOf(keyword.name()), SqlParserPos.ZERO));
            }
        }

        // fetch &　offset
        SqlNode fetch = null;
        SqlNode offset = null;
        if (executeParam != null && withPage && executeParam.getPageInfo() != null) {
            fetch = SqlLiteral.createExactNumeric(Math.min(executeParam.getPageInfo().getPageSize(), Integer.MAX_VALUE) + "", SqlParserPos.ZERO);
            offset = SqlLiteral.createExactNumeric(Math.min((executeParam.getPageInfo().getPageNo() - 1) * executeParam.getPageInfo().getPageSize(), Integer.MAX_VALUE) + "", SqlParserPos.ZERO);
        }

        if (selectList.size() == 0) {
            selectList.add(SqlIdentifier.star(SqlParserPos.ZERO));
        }
        SqlSelect sqlSelect = new SqlSelect(SqlParserPos.ZERO,
                keywordList,
                selectList,
                queryScriptProcessResult.getFrom(),
                where,
                groupBy.size() > 0 ? groupBy : null,
                having,
                null,
                orderBy.size() > 0 ? orderBy : null,
                offset,
                fetch,
                null);
        return SqlNodeUtils.toSql(sqlSelect, this.dialect, quoteIdentifiers);
    }

    private SqlNode createAggNode(AggregateOperator operator) {
        SqlNode sqlNode;
        String columnKey = operator.getColumnKey();
        if (functionColumnMap.containsKey(columnKey)) {
            sqlNode = functionColumnMap.get(columnKey);
        } else {
            sqlNode = createColumnIdentifier(operator.getColumnNames(withNamePrefix, namePrefix));
        }
        SqlOperator sqlOp = mappingSqlAggFunction(operator.getSqlOperator());
        SqlNode aggCall;
        if (operator.getSqlOperator() == null) {
            aggCall = sqlNode;
        } else if (operator.getSqlOperator() == AggregateOperator.SqlOperator.COUNT_DISTINCT) {
            aggCall = SqlNodeUtils
                    .createSqlBasicCall(sqlOp, Collections.singletonList(sqlNode),
                            SqlLiteral.createSymbol(SqlSelectKeyword.DISTINCT, SqlParserPos.ZERO));
        } else {
            aggCall = SqlNodeUtils
                    .createSqlBasicCall(sqlOp, Collections.singletonList(sqlNode));
        }

        if (StringUtils.isNotBlank(operator.getAlias())) {
            return SqlNodeUtils.createAliasNode(aggCall, operator.getAlias());
        } else {
            return aggCall;
        }
    }

    private SqlNode createOrderNode(OrderOperator operator) {
        SqlNode sqlNode;
        if (functionColumnMap.containsKey(operator.getColumnKey())) {
            sqlNode = functionColumnMap.get(operator.getColumnKey());
        } else {
            if (operator.getColumnKey() == null) {
                sqlNode = SqlLiteral.createNull(SqlParserPos.ZERO);
            } else {
                sqlNode = createColumnIdentifier(operator.getColumnNames(withNamePrefix, namePrefix));
            }
        }
        if (operator.getAggOperator() != null) {
            SqlOperator aggOperator = mappingSqlAggFunction(operator.getAggOperator());
            sqlNode = new SqlBasicCall(aggOperator,
                    new SqlNode[]{sqlNode}, SqlParserPos.ZERO);
        }
        if (operator.getOperator() == OrderOperator.SqlOperator.DESC) {
            return new SqlBasicCall(SqlStdOperatorTable.DESC,
                    new SqlNode[]{sqlNode}, SqlParserPos.ZERO);
        } else {
            return sqlNode;
        }
    }


    private SqlNode filterSqlNode(FilterOperator operator) {
        SqlNode column;
        if (operator.getAggOperator() != null) {
            AggregateOperator agg = new AggregateOperator();
            agg.setSqlOperator(operator.getAggOperator());
            agg.setColumn(operator.getColumnNames(withNamePrefix, namePrefix));
            column = createAggNode(agg);
        } else {
            if (functionColumnMap.containsKey(operator.getColumnKey())) {
                column = functionColumnMap.get(operator.getColumnKey());
            } else {
                column = createColumnIdentifier(operator.getColumnNames(withNamePrefix, namePrefix));
            }
        }
        List<SqlNode> nodes = Arrays.stream(operator.getValues())
                .map(this::convertTypedValue)
                .collect(Collectors.toList());

        SqlNode[] sqlNodes = null;

        org.apache.calcite.sql.SqlOperator sqlOp = null;
        switch (operator.getSqlOperator()) {
            case IN:
                sqlOp = SqlStdOperatorTable.IN;
                sqlNodes = new SqlNode[]{column, new SqlNodeList(nodes, SqlParserPos.ZERO)};
                break;
            case NOT_IN:
                sqlOp = SqlStdOperatorTable.NOT_IN;
                sqlNodes = new SqlNode[]{column, new SqlNodeList(nodes, SqlParserPos.ZERO)};
                break;
            case EQ:
                sqlOp = SqlStdOperatorTable.EQUALS;
                sqlNodes = new SqlNode[]{column, nodes.get(0)};
                break;
            case GT:
                sqlOp = SqlStdOperatorTable.GREATER_THAN;
                sqlNodes = new SqlNode[]{column, nodes.get(0)};
                break;
            case LT:
                sqlOp = SqlStdOperatorTable.LESS_THAN;
                sqlNodes = new SqlNode[]{column, nodes.get(0)};
                break;
            case NE:
                sqlOp = SqlStdOperatorTable.NOT_EQUALS;
                sqlNodes = new SqlNode[]{column, nodes.get(0)};
                break;
            case GTE:
                sqlOp = SqlStdOperatorTable.GREATER_THAN_OR_EQUAL;
                sqlNodes = new SqlNode[]{column, nodes.get(0)};
                break;
            case LTE:
                sqlOp = SqlStdOperatorTable.LESS_THAN_OR_EQUAL;
                sqlNodes = new SqlNode[]{column, nodes.get(0)};
                break;
            case LIKE:
                operator.getValues()[0].setValue("%" + operator.getValues()[0].getValue() + "%");
                sqlOp = SqlStdOperatorTable.LIKE;
                sqlNodes = new SqlNode[]{castToVarchar(column), convertTypedValue(operator.getValues()[0])};
                break;
            case PREFIX_LIKE:
                operator.getValues()[0].setValue(operator.getValues()[0].getValue() + "%");
                sqlOp = SqlStdOperatorTable.LIKE;
                sqlNodes = new SqlNode[]{castToVarchar(column), convertTypedValue(operator.getValues()[0])};
                break;
            case SUFFIX_LIKE:
                operator.getValues()[0].setValue("%" + operator.getValues()[0].getValue());
                sqlOp = SqlStdOperatorTable.LIKE;
                sqlNodes = new SqlNode[]{castToVarchar(column), convertTypedValue(operator.getValues()[0])};
                break;
            case NOT_LIKE:
                operator.getValues()[0].setValue("%" + operator.getValues()[0].getValue() + "%");
                sqlOp = SqlStdOperatorTable.NOT_LIKE;
                sqlNodes = new SqlNode[]{castToVarchar(column), convertTypedValue(operator.getValues()[0])};
                break;
            case PREFIX_NOT_LIKE:
                operator.getValues()[0].setValue(operator.getValues()[0].getValue() + "%");
                sqlOp = SqlStdOperatorTable.NOT_LIKE;
                sqlNodes = new SqlNode[]{castToVarchar(column), convertTypedValue(operator.getValues()[0])};
                break;
            case SUFFIX_NOT_LIKE:
                operator.getValues()[0].setValue("%" + operator.getValues()[0].getValue());
                sqlOp = SqlStdOperatorTable.NOT_LIKE;
                sqlNodes = new SqlNode[]{castToVarchar(column), convertTypedValue(operator.getValues()[0])};
                break;
            case IS_NULL:
                sqlOp = SqlStdOperatorTable.IS_NULL;
                sqlNodes = new SqlNode[]{column};
                break;
            case NOT_NULL:
                sqlOp = SqlStdOperatorTable.IS_NOT_NULL;
                sqlNodes = new SqlNode[]{column};
                break;
            case BETWEEN:
                sqlOp = new CustomSqlBetweenOperator(
                        SqlBetweenOperator.Flag.ASYMMETRIC,
                        false);
                nodes.add(0, column);
                sqlNodes = nodes.toArray(new SqlNode[0]);
                break;
            case NOT_BETWEEN:
                sqlOp = new CustomSqlBetweenOperator(
                        SqlBetweenOperator.Flag.ASYMMETRIC,
                        true);
                nodes.add(0, column);
                sqlNodes = nodes.toArray(new SqlNode[0]);
                break;
            default:
                Exceptions.msg("message.provider.sql.type.unsupported", operator.getSqlOperator().name());
        }
        return new SqlBasicCall(sqlOp, sqlNodes, SqlParserPos.ZERO);
    }

    /**
     * parse function column ,and register the column functions
     *
     * @param column    function column
     * @param tableName table where function to execute
     * @param register  whether register this function as build function
     */
    private SqlNode parseSnippet(FunctionColumn column, String tableName, boolean register) throws SqlParseException {
        String snippet = SqlStringUtils.convertBitwiseAndOperator(column.getSnippet());
        SqlSelect sqlSelect = (SqlSelect) SqlParserUtils.parseSnippet(snippet);
        SqlNodeList selectList = sqlSelect.getSelectList();
        if (selectList == null || selectList.size() == 0) {
            Exceptions.msg("parseSnippet: empty select list for expression: " + column.getSnippet());
        }
        SqlNode sqlNode = selectList.get(0);
        if (!(sqlNode instanceof SqlCall)) {
            return sqlNode;
        }
        if (tableAlias != null && !tableAlias.isEmpty()) {
            // Struct view (multi-table JOIN): translate original table names to aliases
            // in function column snippets. tableName may be null for struct views
            // (StructScriptProcessor sets withDefaultPrefix=false).
            completionIdentifier((SqlCall) sqlNode, tableName);
        } else if (withNamePrefix && StringUtils.isNotBlank(tableName)) {
            // Simple view: prefix unqualified columns with the default table name
            completionIdentifier((SqlCall) sqlNode, tableName);
        }
        if (register) {
            try {
                SqlFunctionRegisterVisitor visitor = new SqlFunctionRegisterVisitor();
                visitor.visit((SqlCall) sqlNode);
            } catch (Exception e) {
                log.warn("Failed to register function for expression: {}. Error: {}",
                        column.getSnippet(), e.getMessage());
            }
        }
        return sqlNode;
    }

    private void completionIdentifier(SqlCall call, String tableName) {
        // Translate original table name to alias (for struct views with JOINs)
        // E.g., "dim_date" → "t0" so that function column snippet references use the alias
        //
        // For struct views, tableName may be null (StructScriptProcessor sets
        // withDefaultPrefix=false). In that case we can still translate already-qualified
        // identifiers using the tableAlias map, but we cannot prefix unqualified columns.
        String resolvedTableName = null;
        if (StringUtils.isNotBlank(tableName)) {
            resolvedTableName = tableName;
            if (tableAlias != null && !tableAlias.isEmpty()) {
                String alias = TableAliasResolver.resolve(
                        tableAlias, new String[]{tableName, "_column_"});
                if (alias != null) {
                    resolvedTableName = alias;
                }
            }
        }

        List<SqlNode> operandList = call.getOperandList();
        for (int i = 0; i < operandList.size(); i++) {
            SqlNode sqlNode = operandList.get(i);
            if (sqlNode instanceof SqlIdentifier) {
                SqlIdentifier identifier = (SqlIdentifier) sqlNode;
                if (identifier.names.size() == 1) {
                    // Unqualified column → prefix with resolved alias/table name
                    // Only when a tableName was provided (skip for struct views)
                    if (resolvedTableName != null) {
                        call.setOperand(i, SqlNodeUtils.createSqlIdentifier(resolvedTableName, identifier.names.get(0)));
                    }
                } else if (identifier.names.size() >= 2 && tableAlias != null && !tableAlias.isEmpty()) {
                    // Already qualified: translate the table portion to alias if needed
                    // This works even when tableName is null (struct view case)
                    String existingAlias = TableAliasResolver.resolve(
                            tableAlias, identifier.names.toArray(new String[0]));
                    if (existingAlias != null) {
                        call.setOperand(i, SqlNodeUtils.createSqlIdentifier(existingAlias, identifier.names.get(identifier.names.size() - 1)));
                    }
                }
            } else if (sqlNode instanceof SqlCall) {
                completionIdentifier((SqlCall) sqlNode, tableName);
            } else if (sqlNode instanceof SqlNodeList) {
                // Handle SqlNodeList (e.g., WHEN-THEN pairs inside CASE WHEN)
                // Descend into each element to translate identifiers
                SqlNodeList nodeList = (SqlNodeList) sqlNode;
                for (int j = 0; j < nodeList.size(); j++) {
                    SqlNode listItem = nodeList.get(j);
                    if (listItem instanceof SqlCall) {
                        completionIdentifier((SqlCall) listItem, tableName);
                    } else if (listItem instanceof SqlIdentifier) {
                        // Handle bare identifiers inside node list if any
                        SqlIdentifier id = (SqlIdentifier) listItem;
                        if (id.names.size() == 1 && resolvedTableName != null) {
                            nodeList.set(j, SqlNodeUtils.createSqlIdentifier(resolvedTableName, id.names.get(0)));
                        }
                    }
                }
            }
        }

        // Auto-wrap the column operand of LIKE/NOT LIKE with CAST to VARCHAR.
        // Needed for StarRocks, Doris, etc. that don't support LIKE on non-string
        // types (DATE, NUMERIC, etc.). This mirrors the behavior already present
        // in filterSqlNode() for filter-level LIKE operations.
        String opName = call.getOperator().getName();
        if (("LIKE".equalsIgnoreCase(opName) || "NOT LIKE".equalsIgnoreCase(opName))
                && call.getOperandList().size() >= 2) {
            SqlNode column = call.getOperandList().get(0);
            String columnStr = SqlNodeUtils.toSql(column, this.dialect, this.quoteIdentifiers);
            call.setOperand(0, new SqlFragment("CAST(" + columnStr + " AS VARCHAR(255))"));
        }
    }

    private SqlNode convertTypedValue(SingleTypedValue typedValue) {
        if (typedValue.getValueType().equals(ValueType.SNIPPET) && functionColumnMap.containsKey(typedValue.getValue().toString())) {
            return functionColumnMap.get(typedValue.getValue().toString());
        }
        return SqlNodeUtils.createSqlNode(typedValue);
    }

    private SqlAggFunction mappingSqlAggFunction(AggregateOperator.SqlOperator sqlOperator) {
        if (sqlOperator == null) {
            return null;
        }
        switch (sqlOperator) {
            case AVG:
                return SqlStdOperatorTable.AVG;
            case MAX:
                return SqlStdOperatorTable.MAX;
            case MIN:
                return SqlStdOperatorTable.MIN;
            case SUM:
                return SqlStdOperatorTable.SUM;
            case COUNT:
            case COUNT_DISTINCT:
                return SqlStdOperatorTable.COUNT;
            default:
                Exceptions.msg("message.provider.sql.type.unsupported", sqlOperator.name());
        }
        return null;
    }

    /**
     * Create a SqlIdentifier from column names, automatically translating table names
     * to aliases when a TABLE_ALIAS map is available (struct views with JOINs).
     * <p>
     * E.g., for columnNames = ["dim_date", "month_num"] and tableAlias = {"dim_date": "t0"},
     * returns SqlIdentifier(["t0", "month_num"]) instead of SqlIdentifier(["dim_date", "month_num"]).
     * <p>
     * Falls back to case-insensitive lookup when exact match fails, because the
     * column's table name (from frontend metadata) may differ in case from the
     * table name stored by StructScriptProcessor (e.g., "Dim_Date" vs "dim_date").
     */
    private SqlNode createColumnIdentifier(String[] columnNames) {
        if (tableAlias != null && !tableAlias.isEmpty()
                && columnNames != null && columnNames.length >= 2) {
            String tableName = columnNames[columnNames.length - 2];
            String alias = TableAliasResolver.resolve(tableAlias, columnNames);
            if (alias != null) {
                return SqlNodeUtils.createSqlIdentifier(alias, columnNames[columnNames.length - 1]);
            }
            // Table name not found in alias map: log available keys for diagnosis
            log.warn("Table alias not found for '{}' (from column [{}]). "
                     + "Available table aliases: {}. "
                     + "This may cause 'Column cannot be resolved' errors on data sources "
                     + "that are strict about table name references.",
                     tableName,
                     String.join(".", columnNames),
                     tableAlias.keySet());
        }
        return SqlNodeUtils.createSqlIdentifier(columnNames);
    }

    /**
     * Wrap column in CAST(column AS VARCHAR(255)) so that LIKE operators work on
     * non-string column types (e.g. DATE, NUMERIC).
     * <p>
     * Uses SqlFragment to directly embed the CAST as raw SQL, bypassing Calcite's
     * type inference system. This avoids issues where Calcite may optimize away
     * or reject CAST expressions during query serialization or validation.
     */
    private SqlNode castToVarchar(SqlNode column) {
        String columnStr = SqlNodeUtils.toSql(column, this.dialect, this.quoteIdentifiers);
        return new SqlFragment("CAST(" + columnStr + " AS VARCHAR(255))");
    }

}
