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

package datart.data.provider.jdbc;

import datart.core.base.exception.Exceptions;
import datart.core.base.exception.SqlParseError;
import datart.core.common.MessageResolver;
import datart.core.common.RequestContext;
import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.QueryScript;
import datart.core.data.provider.QueryOutputProjection;
import datart.core.data.provider.ScriptVariable;
import datart.core.data.provider.ScriptType;
import datart.data.provider.calcite.*;
import datart.data.provider.script.ReplacementPair;
import datart.data.provider.script.ScriptRender;
import datart.data.provider.script.SqlStringUtils;
import datart.data.provider.script.VariablePlaceholder;
import datart.data.provider.freemarker.FreemarkerContext;
import lombok.EqualsAndHashCode;
import lombok.extern.slf4j.Slf4j;
import org.apache.calcite.sql.SqlDialect;
import org.apache.calcite.sql.SqlIdentifier;
import org.apache.calcite.sql.SqlNode;
import org.apache.calcite.sql.SqlNodeList;
import org.apache.calcite.sql.SqlSelect;
import org.apache.calcite.sql.parser.SqlParser;
import org.apache.calcite.sql.parser.SqlParseException;
import org.apache.calcite.sql.parser.SqlParserPos;
import org.apache.calcite.sql.parser.impl.SqlParserImpl;
import org.apache.calcite.avatica.util.Casing;
import org.apache.calcite.avatica.util.Quoting;
import org.apache.calcite.sql.validate.SqlConformanceEnum;
import org.apache.commons.collections4.CollectionUtils;
import org.apache.commons.collections4.map.CaseInsensitiveMap;
import org.apache.commons.lang3.StringUtils;

import java.util.Comparator;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import static datart.core.base.consts.Const.VARIABLE_PATTERN;

@EqualsAndHashCode(callSuper = true)
@Slf4j
public class SqlScriptRender extends ScriptRender {

    public static final String TRUE_CONDITION = "1=1";

    public static final String FALSE_CONDITION = "1=0";

    private final SqlDialect sqlDialect;

    // special sql execute permission config from datasource
    private final boolean enableSpecialSQL;

    // default all identifiers
    private final boolean quoteIdentifiers;

    public SqlScriptRender(QueryScript queryScript, ExecuteParam executeParam, SqlDialect sqlDialect) {
        this(queryScript, executeParam, sqlDialect, false);
    }

    public SqlScriptRender(QueryScript queryScript, ExecuteParam executeParam, SqlDialect sqlDialect, boolean enableSpecialSQL) {
        this(queryScript, executeParam, sqlDialect, enableSpecialSQL, true);
    }

    public SqlScriptRender(QueryScript queryScript, ExecuteParam executeParam, SqlDialect sqlDialect, boolean enableSpecialSQL, boolean quoteIdentifiers) {
        super(queryScript, executeParam);
        this.sqlDialect = sqlDialect;
        this.enableSpecialSQL = enableSpecialSQL;
        this.quoteIdentifiers = quoteIdentifiers;
    }

    public String render(boolean withExecuteParam, boolean withPage, boolean onlySelectStatement) throws SqlParseException {
        //get the original value before processing the script
        QueryScriptProcessResult result = getScriptProcessor().process(queryScript);
        String selectSql;
        // build with execute params
        if (withExecuteParam) {
            selectSql = SqlBuilder.builder()
                    .withExecuteParam(executeParam)
                    .withDialect(sqlDialect)
                    .withQueryScriptProcessResult(result)
                    .withAddDefaultNamePrefix(result.isWithDefaultPrefix())
                    .withDefaultNamePrefix(result.getTablePrefix())
                    .withPage(withPage)
                    .withPresentationAliases(!onlySelectStatement)
                    .withQuoteIdentifiers(quoteIdentifiers)
                    .build();
        } else {
            selectSql = SqlBuilder.builder()
                    .withDialect(sqlDialect)
                    .withQueryScriptProcessResult(result)
                    .withAddDefaultNamePrefix(result.isWithDefaultPrefix())
                    .withDefaultNamePrefix(result.getTablePrefix())
                    .withPresentationAliases(!onlySelectStatement)
                    .withQuoteIdentifiers(quoteIdentifiers)
                    .build();
        }
        selectSql = SqlStringUtils.replaceFragmentVariables(selectSql, queryScript.getVariables());

        selectSql = SqlStringUtils.cleanupSql(selectSql);

        if (withExecuteParam && !onlySelectStatement
                && CollectionUtils.isNotEmpty(executeParam.getOutputProjections())) {
            selectSql = addPresentationProjection(selectSql, executeParam.getOutputProjections());
        }

        selectSql = replaceVariables(selectSql);

        RequestContext.setSql(selectSql);

        return selectSql;
    }

    private String addPresentationProjection(String technicalSql,
                                             List<QueryOutputProjection> projections) throws SqlParseException {
        SqlNode inner = SqlParser.create(technicalSql, SqlParser.config()
                .withParserFactory(SqlParserImpl.FACTORY)
                .withQuotedCasing(Casing.UNCHANGED)
                .withUnquotedCasing(Casing.UNCHANGED)
                .withConformance(SqlConformanceEnum.LENIENT)
                .withQuoting(Quoting.BACK_TICK))
                .parseQuery();
        SqlNodeList selectList = new SqlNodeList(org.apache.calcite.sql.parser.SqlParserPos.ZERO);
        for (QueryOutputProjection projection : projections) {
            if (projection == null || StringUtils.isBlank(projection.getTechnicalAlias())
                    || StringUtils.isBlank(projection.getDisplayAlias())) {
                continue;
            }
            SqlNode technicalColumn = createQuotedTechnicalIdentifier(projection);
            selectList.add(SqlNodeUtils.createAliasNode(technicalColumn, projection.getDisplayAlias()));
        }
        if (selectList.isEmpty()) {
            return technicalSql;
        }
        SqlSelect outer = new SqlSelect(
                org.apache.calcite.sql.parser.SqlParserPos.ZERO,
                new SqlNodeList(org.apache.calcite.sql.parser.SqlParserPos.ZERO),
                selectList,
                SqlNodeUtils.createAliasNode(inner, "DATART_RESULT"),
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null);
        return SqlNodeUtils.toSql(outer, sqlDialect, quoteIdentifiers);
    }

    private SqlIdentifier createQuotedTechnicalIdentifier(QueryOutputProjection projection) {
        SqlParserPos quoted = SqlParserPos.ZERO.withQuoting(true);
        String technicalAlias = projection.getOrdinal() == null
                ? projection.getTechnicalAlias()
                : "DATART_RESULT_COL_" + projection.getOrdinal();
        return new SqlIdentifier(
                Arrays.asList("DATART_RESULT", technicalAlias),
                null,
                SqlParserPos.ZERO,
                Arrays.asList(quoted, quoted));
    }

    public QueryScriptProcessor getScriptProcessor() {
        switch (queryScript.getScriptType()) {
            case SQL:
                return new SqlQueryScriptProcessor(enableSpecialSQL, sqlDialect);
            case STRUCT:
                return new StructScriptProcessor();
            default:
                Exceptions.msg("Unsupported script type " + queryScript.getScriptType());
                return null;
        }
    }

    public String renderRawSql() throws SqlParseException {
        if (queryScript.getScriptType() != ScriptType.SQL) {
            return render(true, false, false);
        }

        Map<String, ?> dataMap = queryScript.getVariables()
                .stream()
                .collect(Collectors.toMap(ScriptVariable::getName,
                        variable -> {
                            if (CollectionUtils.isEmpty(variable.getValues())) {
                                return "";
                            } else if (variable.getValues().size() == 1) {
                                return variable.getValues().iterator().next();
                            } else return variable.getValues();
                        }));

        String selectSql = FreemarkerContext.process(queryScript.getScript(), dataMap);
        selectSql = SqlStringUtils.cleanupSqlComments(selectSql, sqlDialect);
        selectSql = SqlStringUtils.replaceFragmentVariables(selectSql, queryScript.getVariables());
        selectSql = SqlStringUtils.convertBitwiseAndOperator(selectSql);
        selectSql = ((SqlQueryScriptProcessor) getScriptProcessor()).parseSelectSql(selectSql);
        selectSql = SqlStringUtils.cleanupSql(selectSql);
        selectSql = SqlStringUtils.removeEndDelimiter(selectSql);
        selectSql = SqlStringUtils.replaceFragmentVariables(selectSql, queryScript.getVariables());
        selectSql = SqlStringUtils.cleanupSql(selectSql);
        selectSql = replaceVariables(selectSql);
        RequestContext.setSql(selectSql);
        return selectSql;
    }


    public String replaceVariables(String selectSql) throws SqlParseException {

        if (StringUtils.isBlank(selectSql)
                || CollectionUtils.isEmpty(queryScript.getVariables())
                || !containsVariable(selectSql)) {
            return selectSql;
        }

        Map<String, ScriptVariable> variableMap = new CaseInsensitiveMap<>();

        if (CollectionUtils.isNotEmpty(queryScript.getVariables())) {
            for (ScriptVariable variable : queryScript.getVariables()) {
                variableMap.put(variable.getNameWithQuote(), variable);
            }
        }

        List<VariablePlaceholder> placeholders = null;
        try {
            placeholders = SqlParserVariableResolver.resolve(sqlDialect, selectSql, variableMap);
        } catch (Exception e) {
            SqlParseError sqlParseError = new SqlParseError(e);
            sqlParseError.setSql(selectSql);
            sqlParseError.setDbType(sqlDialect.getDatabaseProduct().name());
            RequestContext.putWarning(MessageResolver.getMessage("message.provider.sql.parse.failed"), sqlParseError);
            placeholders = RegexVariableResolver.resolve(sqlDialect, selectSql, variableMap);
        }

        placeholders = placeholders.stream()
                .sorted(Comparator.comparingDouble(holder -> (holder instanceof SimpleVariablePlaceholder) ? 1000 + holder.getOriginalSqlFragment().length() : -holder.getOriginalSqlFragment().length()))
                .collect(Collectors.toList());

        if (CollectionUtils.isNotEmpty(placeholders)) {
            for (VariablePlaceholder placeholder : placeholders) {
                ReplacementPair replacementPair = placeholder.replacementPair();
                selectSql = StringUtils.replaceIgnoreCase(selectSql, replacementPair.getPattern(), replacementPair.getReplacement());
            }
        }

        return selectSql;
    }

    private boolean containsVariable(String sql) {
        if (StringUtils.isBlank(sql)) {
            return false;
        }
        return VARIABLE_PATTERN.matcher(sql).find();
    }

}
