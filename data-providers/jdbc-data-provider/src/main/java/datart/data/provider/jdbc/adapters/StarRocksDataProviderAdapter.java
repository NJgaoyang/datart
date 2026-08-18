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

package datart.data.provider.jdbc.adapters;

import datart.core.base.PageInfo;
import datart.core.data.provider.Dataframe;
import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.QueryScript;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import datart.data.provider.calcite.SqlParserUtils;
import datart.data.provider.jdbc.SqlScriptRender;
import datart.data.provider.script.SqlStringUtils;
import org.apache.calcite.sql.SqlDialect;
import org.apache.calcite.sql.SqlBasicCall;
import org.apache.calcite.sql.SqlLiteral;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.fun.SqlStdOperatorTable;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.lang3.StringUtils;

public class StarRocksDataProviderAdapter extends JdbcDataProviderAdapter {

    @Override
    public SqlDialect getSqlDialect() {
        if (sqlDialect != null) {
            return sqlDialect;
        }
        // If user explicitly configured a dialect class, respect it
        if (StringUtils.isNotBlank(driverInfo.getSqlDialect())) {
            return super.getSqlDialect();
        }
        // Use StarRocksSqlStdOperatorSupport (Calcite 1.37+ built-in StarRocksDialect)
        // which supports AGG_DATE_YEAR, AGG_DATE_QUARTER, AGG_DATE_MONTH,
        // AGG_DATE_WEEK, AGG_DATE_DAY, plus native StarRocks syntax
        sqlDialect = new StarRocksSqlStdOperatorSupport();
        configSqlDialect(sqlDialect, driverInfo);
        return sqlDialect;
    }

    @Override
    public Dataframe executeOnSource(QueryScript script, ExecuteParam executeParam) throws Exception {
        if (shouldKeepScriptOrderInSubQuery(executeParam)) {
            startQuery(executeParam);
            try {
            SqlScriptRender render = new SqlScriptRender(script
                    , executeParam
                    , getSqlDialect()
                    , jdbcProperties.isEnableSpecialSql()
                    , driverInfo.getQuoteIdentifiers());
            String sql = appendLimitWithAst(render.renderRawSql(), executeParam.getPageInfo(), getSqlDialect());
            Dataframe dataframe = execute(sql);
            if (executeParam.getPageInfo().isCountTotal()) {
                int total = executeCountSql(render.render(true, false, true));
                executeParam.getPageInfo().setTotal(total);
                dataframe.setPageInfo(executeParam.getPageInfo());
            }
            dataframe.setScript(sql);
            return dataframe;
            } finally {
                endQuery();
            }
        }
        return super.executeOnSource(script, executeParam);
    }

    private boolean shouldKeepScriptOrderInSubQuery(ExecuteParam executeParam) {
        if (executeParam == null || executeParam.getPageInfo() == null) {
            return false;
        }
        return CollectionUtils.isEmpty(executeParam.getColumns())
                && CollectionUtils.isEmpty(executeParam.getKeywords())
                && CollectionUtils.isEmpty(executeParam.getFunctionColumns())
                && CollectionUtils.isEmpty(executeParam.getAggregators())
                && CollectionUtils.isEmpty(executeParam.getFilters())
                && CollectionUtils.isEmpty(executeParam.getGroups())
                && CollectionUtils.isEmpty(executeParam.getOrders());
    }

    static String appendLimit(String sql, PageInfo pageInfo) {
        if (SqlStringUtils.hasTopLevelPagination(sql)) {
            return sql;
        }
        long pageSize = Math.min(pageInfo.getPageSize(), Integer.MAX_VALUE);
        long offset = Math.min((pageInfo.getPageNo() - 1) * pageInfo.getPageSize(), Integer.MAX_VALUE);
        return sql + " LIMIT " + pageSize + " OFFSET " + offset;
    }

    static String appendLimitWithAst(String sql, PageInfo pageInfo, SqlDialect dialect) {
        if (SqlStringUtils.hasTopLevelPagination(sql)) {
            return sql;
        }
        try {
            SqlNode parsed = SqlParserUtils.createParser(sql, dialect).parseQuery();
            SqlSelect select = parsed instanceof SqlSelect
                    ? (SqlSelect) parsed
                    : wrapForPagination(parsed);
            select.setFetch(SqlLiteral.createExactNumeric(String.valueOf(Math.min(pageInfo.getPageSize(), Integer.MAX_VALUE)), SqlParserPos.ZERO));
            select.setOffset(SqlLiteral.createExactNumeric(String.valueOf(Math.min((pageInfo.getPageNo() - 1L) * pageInfo.getPageSize(), Integer.MAX_VALUE)), SqlParserPos.ZERO));
            return select.toSqlString(dialect).getSql();
        } catch (Exception ignored) {
            // Raw SQL may contain database-specific syntax that Calcite cannot parse.
        }
        return appendLimit(sql, pageInfo);
    }

    private static SqlSelect wrapForPagination(SqlNode query) {
        SqlParserPos pos = SqlParserPos.ZERO;
        SqlNode from = new SqlBasicCall(
                SqlStdOperatorTable.AS,
                new SqlNode[]{query, new SqlIdentifier("DATART_PAGE", pos)},
                pos);
        return new SqlSelect(
                pos,
                new SqlNodeList(pos),
                SqlNodeList.SINGLETON_STAR,
                from,
                null,
                new SqlNodeList(pos),
                null,
                new SqlNodeList(pos),
                null,
                new SqlNodeList(pos),
                null,
                null,
                new SqlNodeList(pos));
    }
}
