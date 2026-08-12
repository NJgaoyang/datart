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

import com.alibaba.fastjson2.JSON;
import datart.core.base.exception.Exceptions;
import datart.core.data.provider.QueryScript;
import datart.data.provider.script.JoinCondition;
import datart.data.provider.script.StructScript;
import datart.data.provider.script.TableJoin;
import org.apache.calcite.sql.*;
import org.apache.calcite.sql.fun.SqlStdOperatorTable;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.springframework.util.CollectionUtils;

import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;

public class StructScriptProcessor implements QueryScriptProcessor {
    @Override
    public QueryScriptProcessResult process(QueryScript queryScript) {
        StructScript structScript = JSON.parseObject(queryScript.getScript(), StructScript.class);

        if (structScript.getTable() == null || structScript.getTable().length == 0) {
            Exceptions.msg("Join table can not be empty!");
        }

        int aliasIndex = 0;
        Map<String, String> tableAlias = new LinkedHashMap<>();

        // Assign alias t0 to main table
        String[] mainTable = structScript.getTable();
        String mainAlias = "t" + aliasIndex++;
        TableAliasResolver.register(tableAlias, mainTable, mainAlias);
        SqlNode sqlJoin = SqlNodeUtils.createSqlBasicCall(
                SqlStdOperatorTable.AS,
                Arrays.asList(
                        SqlNodeUtils.createSqlIdentifier(mainTable),
                        new SqlIdentifier(mainAlias, SqlParserPos.ZERO)
                )
        );

        QueryScriptProcessResult result = new QueryScriptProcessResult();
        result.setWithDefaultPrefix(false);
        result.setTableAlias(tableAlias);
        if (CollectionUtils.isEmpty(structScript.getJoins())) {
            result.setFrom(sqlJoin);
            return result;
        }

        for (TableJoin tableJoin : structScript.getJoins()) {
            // Assign alias to this join table (t1, t2, ...)
            String[] joinTable = tableJoin.getTable();
            String joinAlias = "t" + aliasIndex++;
            TableAliasResolver.register(tableAlias, joinTable, joinAlias);

            SqlNode conditionNode = null;
            if (!CollectionUtils.isEmpty(tableJoin.getConditions())) {
                for (JoinCondition joinCondition : tableJoin.getConditions()) {
                    if (!joinCondition.isValid()) {
                        continue;
                    }
                    SqlNode leftNode = createAliasedIdentifier(joinCondition.getLeft(), tableAlias);
                    SqlNode rightNode = createAliasedIdentifier(joinCondition.getRight(), tableAlias);
                    SqlBasicCall condition = new SqlBasicCall(SqlStdOperatorTable.EQUALS
                            , new SqlNode[]{leftNode, rightNode}
                            , SqlParserPos.ZERO);
                    if (conditionNode == null) {
                        conditionNode = condition;
                    } else {
                        conditionNode = SqlNodeUtils.createSqlBasicCall(SqlStdOperatorTable.AND, Arrays.asList(conditionNode, condition));
                    }
                }
            }
            SqlNode aliasedJoinTable = SqlNodeUtils.createSqlBasicCall(
                    SqlStdOperatorTable.AS,
                    Arrays.asList(
                            SqlNodeUtils.createSqlIdentifier(joinTable),
                            new SqlIdentifier(joinAlias, SqlParserPos.ZERO)
                    )
            );
            sqlJoin = new SqlJoin(SqlParserPos.ZERO
                    , sqlJoin
                    , SqlLiteral.createBoolean(false, SqlParserPos.ZERO)
                    , tableJoin.getJoinType().symbol(SqlParserPos.ZERO)
                    , aliasedJoinTable
                    , SqlLiteral.createSymbol(JoinConditionType.ON, SqlParserPos.ZERO)
                    , conditionNode
            );
        }
        result.setFrom(sqlJoin);
        return result;
    }

    /**
     * Replace table name in qualified column reference with alias.
     * E.g., ["dim_date", "id"] → ["t0", "id"] when dim_date is aliased as t0.
     * Unqualified references (single segment) are returned as-is.
     * Falls back to case-insensitive match when exact match fails.
     */
    private SqlNode createAliasedIdentifier(String[] names, Map<String, String> tableAlias) {
        if (names == null || names.length == 0) return null;
        if (names.length < 2 || tableAlias == null || tableAlias.isEmpty()) {
            return SqlNodeUtils.createSqlIdentifier(names);
        }
        // For ["table", "column"] or ["db", "table", "column"],
        // the table name is the second-to-last segment
        String alias = TableAliasResolver.resolve(tableAlias, names);
        if (alias != null) {
            return SqlNodeUtils.createSqlIdentifier(alias, names[names.length - 1]);
        }
        return SqlNodeUtils.createSqlIdentifier(names);
    }

}
