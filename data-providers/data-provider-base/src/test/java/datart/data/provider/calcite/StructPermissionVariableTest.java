package datart.data.provider.calcite;

import datart.core.base.consts.ValueType;
import datart.core.base.consts.VariableTypeEnum;
import datart.core.data.provider.ExecuteParam;
import datart.core.data.provider.QueryScript;
import datart.core.data.provider.ScriptType;
import datart.core.data.provider.ScriptVariable;
import datart.data.provider.calcite.dialect.H2Dialect;
import datart.data.provider.jdbc.SqlScriptRender;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StructPermissionVariableTest {

    @Test
    void structJoinConditionCanReferencePermissionVariable() throws Exception {
        ScriptVariable username = new ScriptVariable(
                "DATART_USER_USERNAME",
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                Collections.singleton("alice"),
                false);
        QueryScript script = QueryScript.builder()
                .scriptType(ScriptType.STRUCT)
                .script("{\"table\":[\"orders\"],\"joins\":[{" +
                        "\"table\":[\"city_permission\"],\"joinType\":\"INNER\"," +
                        "\"conditions\":[" +
                        "{\"left\":[\"orders\",\"city\"],\"right\":[\"city_permission\",\"city\"]}," +
                        "{\"left\":[\"city_permission\",\"username\"],\"right\":[\"$DATART_USER_USERNAME$\"]}" +
                        "]}]}")
                .variables(Collections.singletonList(username))
                .build();

        String sql = new SqlScriptRender(
                script,
                ExecuteParam.empty(),
                H2Dialect.DEFAULT).render(true, false, false);

        assertTrue(sql.contains("'alice'"));
        assertFalse(sql.contains("$DATART_USER_USERNAME$"));
    }

    @Test
    void structJoinResolvesSameTableNameByQualifiedDatabasePath() throws Exception {
        QueryScript script = QueryScript.builder()
                .scriptType(ScriptType.STRUCT)
                .script("{\"table\":[\"ads\",\"user_info\"],\"joins\":[{" +
                        "\"table\":[\"dim\",\"user_info\"],\"joinType\":\"INNER\"," +
                        "\"conditions\":[{" +
                        "\"left\":[\"ads\",\"user_info\",\"city_id\"]," +
                        "\"right\":[\"dim\",\"user_info\",\"city_id\"]" +
                        "}]}]}")
                .variables(Collections.emptyList())
                .build();

        String sql = new SqlScriptRender(
                script,
                ExecuteParam.empty(),
                H2Dialect.DEFAULT).render(true, false, false);

        assertTrue(sql.contains("\"t0\".\"city_id\" = \"t1\".\"city_id\""));
    }
}
