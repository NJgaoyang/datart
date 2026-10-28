import { vi } from 'vitest';
import * as dashboardUtils from 'app/pages/DashBoardPage/utils';
import { boardDrillManager } from 'app/pages/DashBoardPage/components/BoardDrillManager/BoardDrillManager';
import { request2 } from 'utils/request';
import { getChartWidgetDataAsync } from '../thunk';

vi.mock('utils/request', () => ({ request2: vi.fn() }));

test('a slower old shared query cannot overwrite a newer result', async () => {
  const mockRequest = vi.mocked(request2);
  mockRequest.mockReset();
  const completions: Array<(value: any) => void> = [];
  mockRequest.mockImplementation((arg: any) => {
    if (arg.url.includes('/cancel/')) return Promise.resolve({ data: true }) as any;
    return new Promise(resolve => completions.push(resolve)) as any;
  });
  vi.spyOn(dashboardUtils, 'getChartWidgetRequestParams').mockReturnValue({ filters: [], aggregators: [] } as any);
  vi.spyOn(boardDrillManager, 'getWidgetDrill').mockReturnValue(undefined);
  const widget = { id: 'widget', dashboardId: 'board', datachartId: 'chart' };
  const state = {
    board: {
      widgetRecord: { board: { widget } }, widgetInfoRecord: {},
      viewMap: { view: { id: 'view' } }, dataChartMap: { board: { chart: { viewId: 'view' } } },
      boardInfoRecord: {},
    },
    share: { executeTokenMap: { view: { authorizedToken: 'token' } } },
  } as any;
  const dispatch = vi.fn((action: any) => action);
  const arg = { boardId: 'board', widgetId: 'widget', renderMode: 'share' as const };
  const old = getChartWidgetDataAsync(arg)(dispatch, () => state, undefined);
  const latest = getChartWidgetDataAsync(arg)(dispatch, () => state, undefined);
  expect(completions).toHaveLength(2);
  completions[1]({ data: { rows: [['new']], pageInfo: {} } });
  await latest;
  completions[0]({ data: { rows: [['old']], pageInfo: {} } });
  await old;
  const writes = dispatch.mock.calls.map(([action]) => action).filter(action => action.type.endsWith('/setWidgetData'));
  expect(writes).toHaveLength(1);
  expect(writes[0].payload.data.rows).toEqual([['new']]);
  vi.restoreAllMocks();
});
