package datart.server.service.impl;

import datart.core.entity.Dashboard;
import datart.core.entity.Datachart;
import datart.core.entity.View;
import datart.core.mappers.ext.DashboardMapperExt;
import datart.core.mappers.ext.DatachartMapperExt;
import datart.core.mappers.ext.ViewMapperExt;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ViewServiceImplTest {

    private final ViewMapperExt viewMapper = mock(ViewMapperExt.class);
    private final DashboardMapperExt dashboardMapper = mock(DashboardMapperExt.class);
    private final DatachartMapperExt datachartMapper = mock(DatachartMapperExt.class);
    private final ViewServiceImpl service = new ViewServiceImpl(
            viewMapper, null, null, null, null, null, null,
            dashboardMapper, datachartMapper, null, null, null, null);

    @Test
    void safeDeleteUsesOnlyActiveLineageDependencies() {
        View view = view("view-id", "org-id", null);
        when(viewMapper.selectActiveByPrimaryKey("view-id")).thenReturn(view);
        when(viewMapper.listByOrgId("org-id")).thenReturn(List.of(view));
        when(datachartMapper.listByViewId("view-id")).thenReturn(List.of());
        when(dashboardMapper.listByViewId("view-id")).thenReturn(List.of());

        assertTrue(service.safeDelete("view-id"));

        when(datachartMapper.listByViewId("view-id")).thenReturn(List.of(new Datachart()));
        assertFalse(service.safeDelete("view-id"));

        when(datachartMapper.listByViewId("view-id")).thenReturn(List.of());
        when(dashboardMapper.listByViewId("view-id")).thenReturn(List.of(new Dashboard()));
        assertFalse(service.safeDelete("view-id"));
    }

    @Test
    void safeDeleteRejectsActiveComposedDownstreamView() {
        View view = view("view-id", "org-id", null);
        View downstream = view("downstream-id", "org-id",
                "{\"lineage\":{\"upstreamViewIds\":[\"view-id\"]}}");
        when(viewMapper.selectActiveByPrimaryKey("view-id")).thenReturn(view);
        when(viewMapper.listByOrgId("org-id")).thenReturn(List.of(view, downstream));

        assertFalse(service.safeDelete("view-id"));
    }

    private static View view(String id, String orgId, String config) {
        View view = new View();
        view.setId(id);
        view.setOrgId(orgId);
        view.setConfig(config);
        return view;
    }
}
