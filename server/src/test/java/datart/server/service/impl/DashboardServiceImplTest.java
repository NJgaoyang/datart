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

package datart.server.service.impl;

import datart.core.mappers.ext.DashboardMapperExt;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class DashboardServiceImplTest {

    private final DashboardMapperExt dashboardMapper = mock(DashboardMapperExt.class);

    private final DashboardServiceImpl dashboardService = new DashboardServiceImpl(
            dashboardMapper, null, null, null, null, null, null,
            null, null, null, null, null, null, null, null);

    @Test
    void shouldAllowDeleteWhenNoActiveStoryboardReferencesDashboard() {
        when(dashboardMapper.countActiveStorypageReferences("dashboard-id")).thenReturn(0);

        assertTrue(dashboardService.safeDelete("dashboard-id"));
    }

    @Test
    void shouldRejectDeleteWhenActiveStoryboardReferencesDashboard() {
        when(dashboardMapper.countActiveStorypageReferences("dashboard-id")).thenReturn(1);

        assertFalse(dashboardService.safeDelete("dashboard-id"));
    }
}
