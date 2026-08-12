/**
 * MobileVizPage - 移动端报表页面
 * 全屏展示：报表列表 → 点击进入 → 图表垂直堆叠展示
 */
import { BarChartOutlined } from '@ant-design/icons';
import { Spin } from 'antd';
import { MobileBoard } from 'app/pages/DashBoardPage/pages/Board/MobileBoard';
import { useBoardSlice } from 'app/pages/DashBoardPage/pages/Board/slice';
import { useEditBoardSlice } from 'app/pages/DashBoardPage/pages/BoardEditor/slice';
import { selectOrgId } from 'app/pages/MainPage/slice/selectors';
import { useStoryBoardSlice } from 'app/pages/StoryBoardPage/slice';
import { FC, useCallback, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Route,
  Routes,
  useNavigate,
  useParams,
} from 'react-router-dom';
import styled from 'styled-components';
import { SPACE_MD, SPACE_SM, SPACE_XS, SPACE_LG } from 'styles/StyleConstants';
import { useVizSlice } from './pages/VizPage/slice';
import { selectVizs, selectVizListLoading } from './pages/VizPage/slice/selectors';
import { getFolders } from './pages/VizPage/slice/thunks';
import { FolderViewModel } from './pages/VizPage/slice/types';

export const MobileVizPage: FC = () => {
  useVizSlice();
  useBoardSlice();
  useEditBoardSlice();
  useStoryBoardSlice();

  return (
    <MobileContainer>
      <Routes>
        <Route
          path=":vizId"
          element={<MobileDashboardView />}
        />
        <Route
          index
          element={<MobileDashboardList />}
        />
      </Routes>
    </MobileContainer>
  );
};

/* ================== 报表列表 ================== */
const MobileDashboardList: FC = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const orgId = useSelector(selectOrgId);
  const vizs = useSelector(selectVizs);
  const loading = useSelector(selectVizListLoading);

  useEffect(() => {
    if (orgId) {
      dispatch(getFolders(orgId));
    }
  }, [dispatch, orgId]);

  // 只展示 DASHBOARD 类型
  const dashboards = useMemo(
    () => vizs.filter(v => v.relType === 'DASHBOARD'),
    [vizs],
  );

  const navigateToDashboard = useCallback(
    (vizId: string) => {
      navigate(`/organizations/${orgId}/vizs/${vizId}`);
    },
    [navigate, orgId],
  );

  return (
    <ListWrapper>
      <ListHeader>
        <LogoTitle>宜租乐BI</LogoTitle>
        <SubTitle>数据分析平台</SubTitle>
      </ListHeader>
      <ListContainer>
        {loading ? (
          <SpinWrap>
            <Spin size="large" />
          </SpinWrap>
        ) : dashboards.length === 0 ? (
          <EmptyHint>暂无报表</EmptyHint>
        ) : (
          <CardGrid>
            {dashboards.map((item) => (
              <DashboardCard
                key={(item as FolderViewModel).id}
                onClick={() => navigateToDashboard((item as FolderViewModel).relId)}
              >
                <CardIcon>
                  <BarChartOutlined />
                </CardIcon>
                <CardContent>
                  <CardName>{(item as FolderViewModel).name}</CardName>
                </CardContent>
              </DashboardCard>
            ))}
          </CardGrid>
        )}
      </ListContainer>
    </ListWrapper>
  );
};

/* ================== 仪表板详情视图 ================== */
const MobileDashboardView: FC = () => {
  const params = useParams<{ vizId: string }>();
  const vizId = params.vizId;

  if (!vizId) {
    return (
      <SpinWrap>
        <Spin size="large" />
      </SpinWrap>
    );
  }

  return (
    <MobileBoard
      id={vizId}
      allowDownload={true}
      allowShare={true}
      allowManage={true}
    />
  );
};

/* ================== 样式组件 ================== */
const MobileContainer = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  flex-direction: column;
  background-color: #f5f5f5;
  overflow: hidden;
`;

const ListWrapper = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`;

const ListHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: ${SPACE_LG} ${SPACE_MD} ${SPACE_MD};
  background: linear-gradient(135deg, ${p => p.theme.primary} 0%, ${p => p.theme.primary}88 100%);
  color: #fff;
`;

const LogoTitle = styled.h1`
  margin: 0 0 ${SPACE_XS};
  font-size: 24px;
  font-weight: 700;
`;

const SubTitle = styled.p`
  margin: 0;
  font-size: 13px;
  opacity: 0.85;
`;

const ListContainer = styled.div`
  flex: 1;
  width: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  -webkit-overflow-scrolling: touch;
  padding: 2vw 0;
`;

const CardGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2vw;
  padding: 0 3vw;
  min-width: 0;
`;

const DashboardCard = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: ${SPACE_SM} 4px;
  border-radius: 8px;
  background-color: ${p => p.theme.componentBackground};
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  cursor: pointer;
  transition: box-shadow 0.2s;
  aspect-ratio: 1;

  &:active {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
    background-color: ${p => p.theme.emphasisBackground};
  }
`;

const CardIcon = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  margin-bottom: ${SPACE_XS};
  border-radius: 8px;
  background-color: ${p => p.theme.primary}18;
  color: ${p => p.theme.primary};
  font-size: 16px;
  flex-shrink: 0;
`;

const CardContent = styled.div`
  width: 100%;
  text-align: center;
`;

const CardName = styled.div`
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  line-height: 1.3;
`;

const SpinWrap = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
`;

const EmptyHint = styled.div`
  text-align: center;
  padding: 60px 0;
  color: ${p => p.theme.textColorDisabled};
  font-size: 14px;
`;


