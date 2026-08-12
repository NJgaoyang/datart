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
import datart.data.provider.jdbc.SqlScriptRender;
import org.apache.calcite.sql.SqlDialect;
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
            SqlScriptRender render = new SqlScriptRender(script
                    , executeParam
                    , getSqlDialect()
                    , jdbcProperties.isEnableSpecialSql()
                    , driverInfo.getQuoteIdentifiers());
            String sql = appendLimit(render.renderRawSql(), executeParam.getPageInfo());
            Dataframe dataframe = execute(sql);
            if (executeParam.getPageInfo().isCountTotal()) {
                int total = executeCountSql(render.render(true, false, true));
                executeParam.getPageInfo().setTotal(total);
                dataframe.setPageInfo(executeParam.getPageInfo());
            }
            dataframe.setScript(sql);
            return dataframe;
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

    private String appendLimit(String sql, PageInfo pageInfo) {
        long pageSize = Math.min(pageInfo.getPageSize(), Integer.MAX_VALUE);
        long offset = Math.min((pageInfo.getPageNo() - 1) * pageInfo.getPageSize(), Integer.MAX_VALUE);
        return sql + " LIMIT " + pageSize + " OFFSET " + offset;
    }
}
