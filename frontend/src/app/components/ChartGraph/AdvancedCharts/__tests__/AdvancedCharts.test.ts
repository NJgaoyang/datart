import ChartManager from 'app/models/ChartManager';
import { AdvancedChart, buildAdvancedOptions } from '..';
import { init } from 'echarts';
import { transferChartConfigs } from 'app/utils/internalChartHelper';

const field = (colName: string) =>
  ({ colName, type: 'STRING', category: 'field' } as any);
const config = (dimensions: string[], metrics: string[], styles: any[] = []) =>
  ({
    datas: [
      { key: 'dimension', type: 'group', rows: dimensions.map(field) },
      { key: 'metrics', type: 'aggregate', rows: metrics.map(field) },
    ],
    styles,
  } as any);
const dataset = (columns: string[], rows: any[][]) => ({
  columns: columns.map(name => ({ name })),
  rows,
});

describe('advanced charts', () => {
  it('registers four distinct charts with editable field and appearance settings', () => {
    for (const kind of [
      'radar',
      'heatmap',
      'treemap',
      'calendarHeatmap',
    ] as const) {
      const chart = ChartManager.instance().getById(
        `advanced-${kind}`,
      ) as AdvancedChart;
      expect(chart).toBeDefined();
      expect(
        chart.config?.datas?.some(section => section.type === 'filter'),
      ).toBe(true);
      expect(chart.config?.styles?.[0].rows?.length).toBeGreaterThan(1);
      expect(chart.config?.settings?.[0].rows?.[0].key).toBe('tooltip');
    }
  });

  it('provides translated names for special data fields', () => {
    const chart = ChartManager.instance().getById('advanced-calendarHeatmap')!;
    const chinese = chart.config?.i18ns?.find(item => item.lang === 'zh-CN')
      ?.translation as any;
    expect(chinese.viz.palette.data.date).toBe('日期（日）');
  });

  it('renders radar values from each selected metric and category', () => {
    const result: any = buildAdvancedOptions(
      'radar',
      dataset(
        ['team', 'sales', 'users'],
        [
          ['A', '3', '5'],
          ['B', '7', '2'],
        ],
      ),
      config(['team'], ['sales', 'users']),
    );
    expect(result.radar.indicator.map(item => item.name)).toEqual(['A', 'B']);
    expect(result.series[0].data.map(item => item.value)).toEqual([
      [3, 7],
      [5, 2],
    ]);
  });

  it('maps both heatmap dimensions, including zero and negative values', () => {
    const result: any = buildAdvancedOptions(
      'heatmap',
      dataset(
        ['x', 'y', 'value'],
        [
          ['A', 'east', '0'],
          ['B', 'west', '-2'],
        ],
      ),
      config(['x', 'y'], ['value']),
    );
    expect(result.series[0].data.map(item => item.value)).toEqual([
      [0, 0, 0],
      [1, 1, -2],
    ]);
    expect(result.visualMap.min).toBe(-2);
  });

  it('builds a two-level treemap and excludes negative values', () => {
    const result: any = buildAdvancedOptions(
      'treemap',
      dataset(
        ['region', 'store', 'amount'],
        [
          ['A', 'one', '3'],
          ['A', 'two', '4'],
          ['B', 'three', '-1'],
        ],
      ),
      config(['region', 'store'], ['amount']),
    );
    expect(result.series[0].data.map(item => item.name)).toEqual(['A']);
    expect(
      result.series[0].data[0].children.map(item => [item.name, item.value]),
    ).toEqual([
      ['one', 3],
      ['two', 4],
    ]);
  });

  it('combines same-day values and creates separate calendars for each year', () => {
    const result: any = buildAdvancedOptions(
      'calendarHeatmap',
      dataset(
        ['date', 'count'],
        [
          ['2025-12-31', '2'],
          ['2026-01-01 10:00:00', '3'],
          ['2026-01-01 12:00:00', '4'],
          ['2026-02-30', '10'],
        ],
      ),
      config(['date'], ['count']),
    );
    expect(result.calendar.map(item => item.range)).toEqual(['2025', '2026']);
    expect(result.series[1].data[0].value).toEqual(['2026-01-01', 7]);
  });

  it('restores saved appearance and year settings when a chart is reopened', () => {
    const chart = ChartManager.instance().getById('advanced-calendarHeatmap')!;
    const saved = JSON.parse(
      JSON.stringify({
        datas: config(['date'], ['count']).datas,
        styles: [
          { key: 'appearance', rows: [{ key: 'highColor', value: '#ff0000' }] },
        ],
        settings: [{ key: 'calendar', rows: [{ key: 'year', value: 2026 }] }],
      }),
    );
    const restored = transferChartConfigs(chart.config, saved);
    const data = dataset(
      ['date', 'count'],
      [
        ['2025-12-31', '2'],
        ['2026-01-01', '3'],
      ],
    );
    const result: any = buildAdvancedOptions('calendarHeatmap', data, restored);
    expect(result.calendar.map(item => item.range)).toEqual(['2026']);
    expect(result.visualMap.inRange.color[1]).toBe('#ff0000');
  });

  it('honors chart-specific appearance and tooltip settings', () => {
    const result: any = buildAdvancedOptions(
      'radar',
      dataset(['team', 'sales'], [['A', '3']]),
      {
        ...config(
          ['team'],
          ['sales'],
          [
            {
              key: 'appearance',
              rows: [
                { key: 'radarMax', value: 10 },
                { key: 'radarColor', value: '#ff0000' },
              ],
            },
          ],
        ),
        settings: [
          { key: 'general', rows: [{ key: 'tooltip', value: false }] },
        ],
      },
    );
    expect(result.radar.indicator[0].max).toBe(10);
    expect(result.color[0]).toBe('#ff0000');
    expect(result.tooltip.show).toBe(false);
  });

  it('clears data when required fields are missing', () => {
    expect(
      (buildAdvancedOptions('radar', dataset([], []), config([], [])) as any)
        .series,
    ).toEqual([]);
  });

  it.each([
    [
      'radar',
      ['name', 'value'],
      [
        ['A', '3'],
        ['B', '5'],
      ],
      ['name'],
    ],
    ['heatmap', ['x', 'y', 'value'], [['A', 'B', '3']], ['x', 'y']],
    ['treemap', ['name', 'value'], [['A', '3']], ['name']],
    ['calendarHeatmap', ['date', 'value'], [['2026-01-01', '3']], ['date']],
  ] as const)(
    'renders %s using ECharts',
    (kind, columns, input, dimensions) => {
      const chart = init(null, undefined, {
        renderer: 'svg',
        ssr: true,
        width: 800,
        height: 450,
      });
      try {
        chart.setOption(
          buildAdvancedOptions(
            kind,
            dataset(
              [...columns],
              input.map(row => [...row]),
            ),
            config([...dimensions], ['value']),
          ) as any,
        );
        expect(chart.renderToSVGString()).toContain('<svg');
      } finally {
        chart.dispose();
      }
    },
  );
});
