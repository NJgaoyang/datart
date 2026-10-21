import { BoardType, DashboardConfigBeta3 } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { AutoBoardBackgroundDefault, AutoBoardWidgetBackgroundDefault, AUTO_LAYOUT_VERSION, MOBILE_LAYOUT_VERSION, PC_ROW_LAYOUT_VERSION, LAYOUT_COLS_MAP, MOBILE_MIN_MARGIN, MOBILE_MIN_PADDING } from 'app/pages/DashBoardPage/constants';
export const getInitBoardConfigBeta3 = (boardType?: BoardType) => {
  const dashboardConfig: DashboardConfigBeta3 = {
    type: boardType || 'auto',
    version: '',
    background: AutoBoardBackgroundDefault,
    widgetDefaultSettings: {
      background: AutoBoardWidgetBackgroundDefault,
      boxShadow: true,
    },
    maxWidgetIndex: 0,
    initialQuery: true,
    hasQueryControl: false,
    hasResetControl: false,

    // auto
    allowOverlap: false,
    margin: [1, 1], //0-100
    containerPadding: [1, 1], //0-100
    layoutVersion: AUTO_LAYOUT_VERSION,
    mobileLayoutVersion: MOBILE_LAYOUT_VERSION,
    pcRowLayoutVersion: PC_ROW_LAYOUT_VERSION,
    cols: LAYOUT_COLS_MAP,
    mobileMargin: [MOBILE_MIN_MARGIN, MOBILE_MIN_MARGIN],
    mobileContainerPadding: [MOBILE_MIN_PADDING, MOBILE_MIN_PADDING],
    // free
    width: 1920,
    height: 1080,
    gridStep: [10, 10],
    scaleMode: 'scaleWidth',
  };
  return dashboardConfig;
};
