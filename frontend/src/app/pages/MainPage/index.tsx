/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { Spin } from 'antd';
import type { ChartEditorBaseProps } from 'app/components/ChartEditor';
import useMount from 'app/hooks/useMount';
import { useIsMobile } from 'app/hooks/useIsMobile';
import { useIsWeappEmbed } from 'app/hooks/useEmbedMode';
import ChartManager from 'app/models/ChartManager';
import { useAppSlice } from 'app/slice';
import React, { useCallback, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'redux/hooks';
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from 'react-router-dom';
import styled from 'styled-components';
import { NotFoundPage } from '../NotFoundPage';
import { AccessRoute } from './AccessRoute';
import { Background } from './Background';
import { Navbar } from './Navbar';

import { ResourceTypes } from './pages/PermissionPage/constants';
import { useViewSlice } from './pages/ViewPage/slice';
import { useVizSlice } from './pages/VizPage/slice';
import { initChartPreviewData } from './pages/VizPage/slice/thunks';
import { useMainSlice } from './slice';
import { selectOrgId } from './slice/selectors';
import {
  getDataProviders,
  getLoggedInUserPermissions,
  getUserSettings,
} from './slice/thunks';
// Admin-only pages are never needed to open a read-only dashboard.
// Keep React.lazy boundaries outside hooks and route elements.
const AuditLogPage = React.lazy(() =>
  import('./pages/AuditLogPage').then(mod => ({ default: mod.AuditLogPage })),
);
const MonitorPage = React.lazy(() =>
  import('./pages/MonitorPage').then(mod => ({ default: mod.MonitorPage })),
);
const ResourceMigrationPage = React.lazy(() =>
  import('./pages/ResourceMigrationPage').then(mod => ({
    default: mod.ResourceMigrationPage,
  })),
);
const LazyChartEditor = React.lazy(() => import('app/components/ChartEditor'));
const LazyStoryEditor = React.lazy(() =>
  import('../StoryBoardPage/Editor').then(mod => ({
    default: mod.StoryEditor,
  })),
);
const LazyStoryPlayer = React.lazy(() =>
  import('../StoryBoardPage/Player').then(mod => ({
    default: mod.StoryPlayer,
  })),
);
const LazyConfirmInvitePage = React.lazy(() =>
  import('./pages/ConfirmInvitePage').then(mod => ({
    default: mod.ConfirmInvitePage,
  })),
);
const LazyMemberPage = React.lazy(() =>
  import('./pages/MemberPage').then(mod => ({ default: mod.MemberPage })),
);
const LazyOrgSettingPage = React.lazy(() =>
  import('./pages/OrgSettingPage').then(mod => ({
    default: mod.OrgSettingPage,
  })),
);
const LazyPermissionPage = React.lazy(() =>
  import('./pages/PermissionPage').then(mod => ({
    default: mod.PermissionPage,
  })),
);
const LazySchedulePage = React.lazy(() =>
  import('./pages/SchedulePage').then(mod => ({ default: mod.SchedulePage })),
);
const LazySourcePage = React.lazy(() =>
  import('./pages/SourcePage').then(mod => ({ default: mod.SourcePage })),
);
const LazyVariablePage = React.lazy(() =>
  import('./pages/VariablePage').then(mod => ({ default: mod.VariablePage })),
);
const LazyViewPage = React.lazy(() =>
  import('./pages/ViewPage').then(mod => ({ default: mod.ViewPage })),
);
const LazyVizPage = React.lazy(() =>
  import('./pages/VizPage').then(mod => ({ default: mod.VizPage })),
);
const LazyMobileVizPage = React.lazy(() =>
  import('./MobileVizPage').then(mod => ({ default: mod.MobileVizPage })),
);

function ChartEditorRoute({
  orgId,
  onClose,
  onSaveInDataChart,
}: {
  orgId: string;
  onClose: () => void;
  onSaveInDataChart: (orgId: string, backendChartId: string) => void;
}) {
  const location = useLocation();
  const hisSearch = new URLSearchParams(location.search);
  const hisState = {
    dataChartId: hisSearch.get('dataChartId') || '',
    chartType: hisSearch.get('chartType') || 'dataChart',
    container: hisSearch.get('container') || 'dataChart',
    defaultViewId: hisSearch.get('defaultViewId') || '',
  } as ChartEditorBaseProps;
  return (
    <AccessRoute module={ResourceTypes.Viz}>
      <LazyChartEditor
        dataChartId={hisState.dataChartId}
        orgId={orgId}
        chartType={hisState.chartType}
        container={hisState.container}
        defaultViewId={hisState.defaultViewId}
        onClose={onClose}
        onSaveInDataChart={onSaveInDataChart}
      />
    </AccessRoute>
  );
}

export function MainPage() {
  useAppSlice();
  const { actions } = useMainSlice();
  const { actions: vizActions } = useVizSlice();
  const { actions: viewActions } = useViewSlice();
  const dispatch = useAppDispatch();
  const isMobile = useIsMobile();
  const isWeappEmbed = useIsWeappEmbed();
  const shouldUseMobileViz = isMobile || isWeappEmbed;
  const organizationMatch = useMatch('/organizations/:orgId/*');
  const orgId = useSelector(selectOrgId);
  const navigate = useNavigate();
  // loaded first time

  useMount(
    () => {
      ChartManager.instance()
        .load()
        .catch(err =>
          console.error('Fail to load customize charts with ', err),
        );
      dispatch(getUserSettings(organizationMatch?.params.orgId));
      dispatch(getDataProviders());
    },
    () => {
      dispatch(actions.clear());
    },
  );

  useEffect(() => {
    if (orgId) {
      dispatch(vizActions.clear());
      dispatch(viewActions.clear());
      dispatch(getLoggedInUserPermissions(orgId));
    }
  }, [dispatch, vizActions, viewActions, orgId]);

  const onSaveInDataChart = useCallback(
    (orgId: string, backendChartId: string) => {
      dispatch(
        initChartPreviewData({
          backendChartId,
          orgId,
        }),
      );
      navigate(`/organizations/${orgId}/vizs/${backendChartId}`);
    },
    [dispatch, navigate],
  );

  return (
    <AppContainer>
      <Background />
      {!shouldUseMobileViz && <Navbar />}
      {orgId && (
        <React.Suspense
          fallback={
            <RouteLoading>
              <Spin />
            </RouteLoading>
          }
        >
          <Routes>
            <Route
              path="/"
              element={<Navigate to={`/organizations/${orgId}`} replace />}
            />
            <Route path="/confirminvite" element={<LazyConfirmInvitePage />} />
            <Route
              path="/organizations/:orgId"
              element={
                <Navigate
                  to={`/organizations/${organizationMatch?.params.orgId}/vizs`}
                  replace
                />
              }
            />
            <Route
              path="/organizations/:orgId/vizs/chartEditor"
              element={
                <ChartEditorRoute
                  orgId={orgId}
                  onClose={() => navigate(-1)}
                  onSaveInDataChart={onSaveInDataChart}
                />
              }
            />
            <Route
              path="/organizations/:orgId/vizs/storyPlayer/:storyId"
              element={<LazyStoryPlayer />}
            />
            <Route
              path="/organizations/:orgId/vizs/storyEditor/:storyId"
              element={<LazyStoryEditor />}
            />
            <Route
              path="/organizations/:orgId/vizs/*"
              element={
                shouldUseMobileViz ? (
                  <LazyMobileVizPage />
                ) : (
                  <AccessRoute module={ResourceTypes.Viz}>
                    <LazyVizPage />
                  </AccessRoute>
                )
              }
            />
            <Route
              path="/organizations/:orgId/views/*"
              element={
                <AccessRoute module={ResourceTypes.View}>
                  <LazyViewPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/sources/*"
              element={
                <AccessRoute module={ResourceTypes.Source}>
                  <LazySourcePage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/schedules/*"
              element={
                <AccessRoute module={ResourceTypes.Schedule}>
                  <LazySchedulePage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/members/*"
              element={
                <AccessRoute module={ResourceTypes.User}>
                  <LazyMemberPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/roles/*"
              element={
                <AccessRoute module={ResourceTypes.User}>
                  <LazyMemberPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/permissions"
              element={
                <Navigate
                  to={`/organizations/${organizationMatch?.params.orgId}/permissions/subject`}
                  replace
                />
              }
            />
            <Route
              path="/organizations/:orgId/permissions/:viewpoint/*"
              element={
                <AccessRoute module={ResourceTypes.Manager}>
                  <LazyPermissionPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/variables"
              element={
                <AccessRoute module={ResourceTypes.Manager}>
                  <LazyVariablePage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/monitor"
              element={
                <AccessRoute module={ResourceTypes.Manager}>
                  <MonitorPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/orgSettings"
              element={
                <AccessRoute module={ResourceTypes.Manager}>
                  <LazyOrgSettingPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/resourceMigration"
              element={
                <AccessRoute module={ResourceTypes.Manager}>
                  <ResourceMigrationPage />
                </AccessRoute>
              }
            />
            <Route
              path="/organizations/:orgId/auditLog"
              element={
                <AccessRoute module={ResourceTypes.Manager}>
                  <AuditLogPage />
                </AccessRoute>
              }
            />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </React.Suspense>
      )}
    </AppContainer>
  );
}

const AppContainer = styled.main`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  background-color: ${p => p.theme.bodyBackground};
`;

const RouteLoading = styled.div`
  display: grid;
  flex: 1;
  min-height: 240px;
  place-items: center;
`;
