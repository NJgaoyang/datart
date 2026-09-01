package datart.server.base.dto;

import datart.core.entity.Dashboard;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DashboardBaseInfoTest {

    @Test
    void shouldDefaultLegacyDashboardsToMobileAndRespectSavedSwitches() {
        Dashboard dashboard = new Dashboard();
        dashboard.setConfig("{}");
        DashboardBaseInfo legacy = new DashboardBaseInfo(dashboard);
        assertTrue(legacy.getMobileTransformEnabled());
        assertFalse(legacy.getMobileVisible());

        dashboard.setConfig("{\"jsonConfig\":{\"props\":[{\"key\":\"basic\",\"rows\":[" +
                "{\"key\":\"mobileTransformEnabled\",\"value\":false}," +
                "{\"key\":\"mobileVisible\",\"value\":false}]}]}}");
        DashboardBaseInfo disabled = new DashboardBaseInfo(dashboard);
        assertFalse(disabled.getMobileTransformEnabled());
        assertFalse(disabled.getMobileVisible());
    }
}
