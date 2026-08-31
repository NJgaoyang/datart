/*
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package datart.core.data.provider;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class StdSqlOperatorTest {

    @Test
    void resolvesArithmeticSymbolsWithoutCollisions() {
        assertEquals(StdSqlOperator.ADD, StdSqlOperator.symbolOf("+"));
        assertEquals(StdSqlOperator.SUBTRACT, StdSqlOperator.symbolOf("-"));
        assertEquals(StdSqlOperator.MULTIPLY, StdSqlOperator.symbolOf("*"));
        assertEquals(StdSqlOperator.DIVIDE, StdSqlOperator.symbolOf("/"));
    }

    @Test
    void exposesFunctionMetadataForValidationAndSourceCapabilities() {
        FunctionDefinition percentile = FunctionDefinitionRegistry.definition(StdSqlOperator.PERCENTILE_APPROX);
        assertEquals(2, percentile.getMinArgs());
        assertEquals(3, percentile.getMaxArgs());
        assertEquals("DOUBLE", percentile.getReturnType());

        FunctionDefinition timeSlice = FunctionDefinitionRegistry.definition(StdSqlOperator.TIME_SLICE);
        assertEquals(2, timeSlice.getMinArgs());
        assertEquals(3, timeSlice.getMaxArgs());
        assertEquals("2.3.0", timeSlice.getMinStarRocksVersion());
    }

    @Test
    void exposesLogicalTypesForNativeDateLevels() {
        assertEquals("DATE", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_YEAR_NATIVE).getReturnType());
        assertEquals("DATE", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_QUARTER_NATIVE).getReturnType());
        assertEquals("DATE", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_MONTH_NATIVE).getReturnType());
        assertEquals("DATE", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_WEEK_NATIVE).getReturnType());
        assertEquals("DATE", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_DAY_NATIVE).getReturnType());
        assertEquals("DATETIME", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_HOUR_NATIVE).getReturnType());
        assertEquals("DATETIME", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_MINUTE_NATIVE).getReturnType());
        assertEquals("DATETIME", FunctionDefinitionRegistry
                .definition(StdSqlOperator.AGG_DATE_SECOND_NATIVE).getReturnType());
    }
}
