import { renderHook } from '@testing-library/react';
import {
  ChartDataSectionType,
  ChartDataViewFieldCategory,
  ChartInteractionEvent,
  ControllerFacadeTypes,
  DataViewFieldType,
} from 'app/constants';
import { InteractionFieldRelation, InteractionMouseEvent } from 'app/components/FormGenerator/constants';
import useChartInteractions from 'app/hooks/useChartInteractions';
import { ChartDataRequestBuilder } from 'app/models/ChartDataRequestBuilder';
import { widgetLinkEventAction } from 'app/pages/DashBoardPage/actions/widgetAction';
import { syncBoardWidgetChartDataAsync } from 'app/pages/DashBoardPage/pages/Board/slice/thunk';
import { DATE_LEVEL_DELIMITER, FilterSqlOperator } from 'globalConstants';
import { vi } from 'vitest';

vi.mock('app/hooks/useDrillThrough', () => ({
  default: () => ({
    openNewTab: vi.fn(),
    openBrowserTab: vi.fn(),
    getDialogContent: vi.fn(),
    redirectByUrl: vi.fn(),
    openNewByUrl: vi.fn(),
    getDialogContentByUrl: vi.fn(),
  }),
}));

vi.mock('app/pages/DashBoardPage/pages/Board/slice/thunk', () => {
  return {
    getChartWidgetDataAsync: vi.fn(),
    getControllerOptions: vi.fn(),
    getWidgetData: vi.fn(),
    syncBoardWidgetChartDataAsync: vi.fn((payload: unknown) => ({
      type: 'test/syncBoardWidgetChartDataAsync',
      payload,
    })),
  };
});

const dayFieldName = `snapshot_dt${DATE_LEVEL_DELIMITER}AGG_DATE_DAY`;

const createRule = () => ({
  id: 'rule-id',
  relId: 'target-chart',
  relation: InteractionFieldRelation.Auto,
  [InteractionFieldRelation.Customize]: [],
});

const createChartConfig = (row: Record<string, unknown>) => ({
  datas: [
    {
      type: ChartDataSectionType.Group,
      rows: [row],
    },
  ],
  settings: [],
});

const getLinkParams = ({
  interactionType,
  selectedItems,
  row,
}: {
  interactionType: ChartInteractionEvent;
  selectedItems: unknown[];
  row: Record<string, unknown>;
}) => {
  const { result } = renderHook(() => useChartInteractions({}));
  const callback = vi.fn();

  result.current.handleCrossFilteringEvent(
    {
      crossFilteringSetting: {
        event: InteractionMouseEvent.Left,
        rules: [createRule()],
      },
      targetEvent: InteractionMouseEvent.Left,
      clickEventParams: {
        interactionType,
        selectedItems,
      },
      view: {
        id: 'view-id',
        meta: [],
        config: {},
      },
      queryVariables: [],
      computedFields: [],
      aggregation: true,
      chartConfig: createChartConfig(row),
    },
    callback,
  );

  return callback.mock.calls[0][0][0];
};

const createActionState = () => {
  const sourceWidget = {
    id: 'source-widget',
    dashboardId: 'board-id',
    datachartId: 'source-chart',
    config: { type: 'chart' },
    relations: [],
    viewIds: ['view-id'],
  };
  const targetWidget = {
    id: 'target-widget',
    dashboardId: 'board-id',
    datachartId: 'target-chart',
    config: { type: 'chart' },
    relations: [],
    viewIds: ['view-id'],
  };
  const controllerWidget = {
    id: 'controller-widget',
    dashboardId: 'board-id',
    config: {
      type: 'controller',
      content: {
        type: ControllerFacadeTypes.DropdownList,
        relatedViews: [
          {
            viewId: 'view-id',
            fieldValue: 'controller_city',
            relatedCategory: ChartDataViewFieldCategory.Field,
            fieldValueType: DataViewFieldType.STRING,
          },
        ],
        config: {
          controllerValues: ['上海'],
          sqlOperator: FilterSqlOperator.In,
        },
      },
    },
    relations: [{ targetId: 'target-widget' }],
    viewIds: ['view-id'],
  };
  const targetDataChart = {
    id: 'target-chart',
    viewId: 'view-id',
    config: {
      chartConfig: createChartConfig({
        colName: 'city',
        type: DataViewFieldType.STRING,
      }),
      computedFields: [],
      aggregation: true,
    },
  };

  return {
    sourceWidget,
    state: {
      share: { executeTokenMap: {} },
      board: {
        widgetRecord: {
          'board-id': {
            'source-widget': sourceWidget,
            'target-widget': targetWidget,
            'controller-widget': controllerWidget,
          },
        },
        widgetInfoRecord: {
          'board-id': {
            'target-widget': { linkInfo: {} },
          },
        },
        dataChartMap: {
          'board-id': { 'target-chart': targetDataChart },
        },
        selectedItems: { 'target-widget': [] },
      },
    },
  };
};

const runWidgetLinkAction = async (params: unknown[]) => {
  vi.mocked(syncBoardWidgetChartDataAsync).mockClear();
  const { sourceWidget, state } = createActionState();
  const dispatched: unknown[] = [];
  const dispatch = vi.fn(action => {
    dispatched.push(action);
    return action;
  });

  await widgetLinkEventAction('read', sourceWidget as any, params as any)(
    dispatch,
    () => state,
  );

  return {
    payload: vi.mocked(syncBoardWidgetChartDataAsync).mock.calls[0][0] as any,
    dispatched,
    state,
  };
};

describe('Current Cross Filtering integration', () => {
  test('Select rebuilds click filters from the current selected item', () => {
    const linkParams = getLinkParams({
      interactionType: ChartInteractionEvent.Select,
      selectedItems: [{ data: { rowData: { city: '上海' } } }],
      row: { colName: 'city', type: DataViewFieldType.STRING },
    });

    expect(linkParams.isUnSelectedAll).toBe(false);
    expect(linkParams.filters).toEqual({ city: ['上海'] });
  });

  test('UnSelect produces an empty linkage filter set', () => {
    const linkParams = getLinkParams({
      interactionType: ChartInteractionEvent.UnSelect,
      selectedItems: [],
      row: { colName: 'city', type: DataViewFieldType.STRING },
    });

    expect(linkParams.isUnSelectedAll).toBe(true);
    expect(linkParams.filters).toEqual({});
  });

  test('multi-select uses the current selected set instead of appending history', () => {
    const row = { colName: 'city', type: DataViewFieldType.STRING };
    const first = getLinkParams({
      interactionType: ChartInteractionEvent.Select,
      selectedItems: [
        { data: { rowData: { city: '上海' } } },
        { data: { rowData: { city: '北京' } } },
      ],
      row,
    });
    const second = getLinkParams({
      interactionType: ChartInteractionEvent.Select,
      selectedItems: [{ data: { rowData: { city: '北京' } } }],
      row,
    });

    expect(first.filters).toEqual({ city: ['上海', '北京'] });
    expect(second.filters).toEqual({ city: ['北京'] });
    expect(second.filters.city).not.toContain('上海');
  });

  test('UnSelect clears tempFilters but preserves target controller filters and refreshes', async () => {
    const { payload, dispatched } = await runWidgetLinkAction([
      {
        rule: createRule(),
        isUnSelectedAll: true,
        filters: { city: ['上海'] },
        variables: {},
      },
    ]);

    expect(payload.tempFilters).toEqual([]);
    expect(payload.extraFilters).toEqual([
      expect.objectContaining({ column: 'controller_city' }),
    ]);
    expect(vi.mocked(syncBoardWidgetChartDataAsync)).toHaveBeenCalledTimes(1);

    const toggleThunk = dispatched.find(action => typeof action === 'function') as any;
    const toggleDispatch = vi.fn();
    toggleThunk(toggleDispatch, () => ({}));
    expect(toggleDispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        payload: expect.objectContaining({ toggle: false }),
      }),
    );
  });

  test('DateLevel linkage reaches Builder and generates its function column', async () => {
    const { payload } = await runWidgetLinkAction([
      {
        rule: createRule(),
        isUnSelectedAll: false,
        filters: { [dayFieldName]: ['2026-08-25'] },
        variables: {},
      },
    ]);

    expect(payload.tempFilters).toEqual([
      expect.objectContaining({ column: dayFieldName }),
    ]);

    const request = new ChartDataRequestBuilder(
      {
        id: 'view-id',
        meta: [
          {
            name: 'snapshot_dt',
            path: ['DATART_VTABLE', 'snapshot_dt'],
            type: DataViewFieldType.DATE,
          },
        ],
        computedFields: [],
      } as any,
      [],
      [],
      {},
      false,
      true,
    )
      .addRuntimeFilters(payload.tempFilters)
      .build();

    expect(request.functionColumns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          alias: dayFieldName,
          snippet: expect.stringContaining('AGG_DATE_DAY'),
        }),
      ]),
    );
  });
});
