import type { VizRenderMode } from 'app/pages/DashBoardPage/pages/Board/slice/types';

export const SHARE_MOBILE_BREAKPOINT = 960;

export const shouldUseMobileShareLayout = (
  width: number,
  boardType: string | undefined,
  mode: VizRenderMode,
): boolean => boardType === 'auto'
  && mode === 'share'
  && width > 0
  && width <= SHARE_MOBILE_BREAKPOINT;