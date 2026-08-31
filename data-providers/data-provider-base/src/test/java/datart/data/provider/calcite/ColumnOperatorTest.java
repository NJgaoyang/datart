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

package datart.data.provider.calcite;

import datart.core.data.provider.sql.FilterOperator;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;

class ColumnOperatorTest {

    @Test
    void doesNotAddDuplicateDefaultPrefix() {
        FilterOperator operator = new FilterOperator();
        operator.setColumn("DATART_VTABLE", "available_battery_per_non_storage_user_ratio");

        assertArrayEquals(
                new String[]{"DATART_VTABLE", "available_battery_per_non_storage_user_ratio"},
                operator.getColumnNames(true, "DATART_VTABLE"));
    }

    @Test
    void addsDefaultPrefixToUnqualifiedColumn() {
        FilterOperator operator = new FilterOperator();
        operator.setColumn("available_battery_per_non_storage_user_ratio");

        assertArrayEquals(
                new String[]{"DATART_VTABLE", "available_battery_per_non_storage_user_ratio"},
                operator.getColumnNames(true, "DATART_VTABLE"));
    }
}
