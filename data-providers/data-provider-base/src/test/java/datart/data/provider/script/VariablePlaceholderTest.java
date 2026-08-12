package datart.data.provider.script;

import datart.core.base.consts.ValueType;
import datart.core.base.consts.VariableTypeEnum;
import datart.core.data.provider.ScriptVariable;
import datart.data.provider.jdbc.SqlScriptRender;
import org.junit.jupiter.api.Test;

import java.util.Collections;

import static org.junit.jupiter.api.Assertions.assertEquals;

class VariablePlaceholderTest {

    @Test
    void missingPermissionVariableMustFailClosed() {
        VariablePlaceholder placeholder = new VariablePlaceholder(
                Collections.emptyList(),
                null,
                null,
                "city = $CITY_PERMISSION$");

        ReplacementPair replacement = placeholder.replacementPair();

        assertEquals("city = $CITY_PERMISSION$", replacement.getPattern());
        assertEquals(SqlScriptRender.FALSE_CONDITION, replacement.getReplacement());
    }

    @Test
    void disabledPermissionVariableMustAllowOrganizationOwner() {
        ScriptVariable variable = new ScriptVariable(
                "CITY_PERMISSION",
                VariableTypeEnum.PERMISSION,
                ValueType.STRING,
                Collections.emptySet(),
                false);
        variable.setDisabled(true);
        VariablePlaceholder placeholder = new VariablePlaceholder(
                Collections.singletonList(variable),
                null,
                null,
                "city = $CITY_PERMISSION$");

        ReplacementPair replacement = placeholder.replacementPair();

        assertEquals(SqlScriptRender.TRUE_CONDITION, replacement.getReplacement());
    }
}
