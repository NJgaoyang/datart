package datart.data.provider.calcite;

import datart.core.base.consts.ValueType;
import datart.core.base.consts.VariableTypeEnum;
import datart.core.data.provider.QueryScript;
import datart.core.data.provider.ScriptVariable;
import datart.data.provider.calcite.dialect.StarRocksSqlStdOperatorSupport;
import org.junit.jupiter.api.Test;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class SqlQueryScriptProcessorVariableScopeTest {

    @Test
    void rendersConflictingSameNameSourceVariablesIndependently() {
        ScriptVariable left = new ScriptVariable("__join0__city",
                VariableTypeEnum.PERMISSION, ValueType.STRING, Set.of("'Singapore'"), false);
        ScriptVariable right = new ScriptVariable("__join1__city",
                VariableTypeEnum.PERMISSION, ValueType.STRING, Set.of("'Shanghai'"), false);
        QueryScript query = QueryScript.builder()
                .script("SELECT ${__join0__city} AS left_city, ${__join1__city} AS right_city")
                .variables(List.of(left, right))
                .build();

        QueryScriptProcessResult rendered = new SqlQueryScriptProcessor(
                false, new StarRocksSqlStdOperatorSupport()).process(query);
        String sql = rendered.getFrom().toString();
        assertTrue(sql.contains("'Singapore'"), sql);
        assertTrue(sql.contains("'Shanghai'"), sql);
    }
}
