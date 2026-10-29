import Chart from 'app/models/Chart';
import { ChartSelectionManager } from 'app/models/ChartSelectionManager';
import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { BrokerContext, BrokerOption } from 'app/types/ChartLifecycleBroker';
import {
  getColumnRenderName,
  getExtraSeriesRowData,
  getStyles,
  transformToDataSet,
} from 'app/utils/chartHelper';
import { applyMobileChartOption } from 'app/utils/mobileChartOption';
import dayjs from 'dayjs';
import { init } from 'echarts';
import i18next from 'i18next';

type Kind = 'radar' | 'heatmap' | 'treemap' | 'calendarHeatmap';

const translations = {
  'zh-CN': {
    appearance: '图表样式',
    showLabel: '显示数值标签',
    showLegend: '显示图例',
    lowColor: '低值颜色',
    highColor: '高值颜色',
    radarArea: '填充雷达区域',
    radarColor: '雷达图主色',
    radarMax: '数值上限（0 为自动）',
    dimension: '维度',
    date: '日期（日）',
    categories: '维度（横轴、纵轴）',
    hierarchy: '层级（上级、下级）',
    metrics: '指标',
    filter: '筛选',
    settings: '图表设置',
    tooltip: '显示悬浮提示',
    year: '年份（0 为全部年份）',
  },
  'en-US': {
    appearance: 'Chart style',
    showLabel: 'Show value labels',
    showLegend: 'Show legend',
    lowColor: 'Low value color',
    highColor: 'High value color',
    radarArea: 'Fill radar area',
    radarColor: 'Radar primary color',
    radarMax: 'Maximum value (0 for automatic)',
    dimension: 'Dimension',
    date: 'Date (day)',
    categories: 'Dimensions (horizontal, vertical)',
    hierarchy: 'Levels (parent, child)',
    metrics: 'Metric',
    filter: 'Filter',
    settings: 'Chart settings',
    tooltip: 'Show tooltip',
    year: 'Year (0 for all years)',
  },
};

function chartConfig(kind: Kind): ChartConfig {
  const maxDimensions = kind === 'heatmap' || kind === 'treemap' ? 2 : 1;
  const minDimensions = kind === 'heatmap' ? 2 : 1;
  return {
    datas: [
      {
        label:
          kind === 'calendarHeatmap'
            ? 'date'
            : kind === 'heatmap'
            ? 'categories'
            : kind === 'treemap'
            ? 'hierarchy'
            : 'dimension',
        key: 'dimension',
        required: true,
        type: 'group',
        limit: [minDimensions, maxDimensions],
      },
      {
        label: 'metrics',
        key: 'metrics',
        required: true,
        type: 'aggregate',
        limit: [1, kind === 'radar' ? 8 : 1],
      },
      { label: 'filter', key: 'filter', type: 'filter', allowSameField: true },
    ],
    styles: [
      {
        label: 'appearance',
        key: 'appearance',
        comType: 'group',
        rows: [
          {
            label: 'showLabel',
            key: 'showLabel',
            comType: 'checkbox',
            default: false,
          },
          ...(kind === 'radar'
            ? [
                {
                  label: 'showLegend',
                  key: 'showLegend',
                  comType: 'checkbox' as const,
                  default: true,
                },
                {
                  label: 'radarArea',
                  key: 'radarArea',
                  comType: 'checkbox' as const,
                  default: false,
                },
                {
                  label: 'radarColor',
                  key: 'radarColor',
                  comType: 'fontColor' as const,
                  default: '#5470c6',
                },
                {
                  label: 'radarMax',
                  key: 'radarMax',
                  comType: 'inputNumber' as const,
                  default: 0,
                  options: { min: 0 },
                },
              ]
            : [
                {
                  label: 'lowColor',
                  key: 'lowColor',
                  comType: 'fontColor' as const,
                  default: '#e0efff',
                },
                {
                  label: 'highColor',
                  key: 'highColor',
                  comType: 'fontColor' as const,
                  default: '#2364d2',
                },
              ]),
        ],
      },
    ],
    settings: [
      {
        label: 'settings',
        key: 'general',
        comType: 'group',
        rows: [
          {
            label: 'tooltip',
            key: 'tooltip',
            comType: 'checkbox',
            default: true,
          },
        ],
      },
      ...(kind === 'calendarHeatmap'
        ? [
            {
              label: 'settings',
              key: 'calendar',
              comType: 'group' as const,
              rows: [
                {
                  label: 'year',
                  key: 'year',
                  comType: 'inputNumber' as const,
                  default: 0,
                  options: { min: 0, max: 9999, step: 1 },
                },
              ],
            },
          ]
        : []),
    ],
    i18ns: Object.entries(translations).map(([lang, translation]) => ({
      lang,
      translation: {
        ...translation,
        viz: {
          palette: {
            data: {
              date: translation.date,
              categories: translation.categories,
              hierarchy: translation.hierarchy,
            },
          },
        },
      },
    })),
  };
}

function number(value: unknown): number | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function bounds(values: number[]) {
  return values.length
    ? values.reduce(
        ([min, max], value) => [Math.min(min, value), Math.max(max, value)],
        [values[0], values[0]],
      )
    : [0, 1];
}

function noData() {
  return {
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: 'middle',
        style: {
          text: i18next.t('viz.palette.graph.noValidData', {
            defaultValue: 'No valid data for this chart',
          }),
          fill: '#8c8c8c',
        },
      },
    ],
    series: [],
  };
}

export function buildAdvancedOptions(
  kind: Kind,
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) {
  const sections = config.datas || [];
  const dimensions = sections
    .filter(s => s.type === 'group')
    .flatMap(s => s.rows || []);
  const metrics = sections
    .filter(s => s.type === 'aggregate')
    .flatMap(s => s.rows || []);
  const rows = Array.from(
    transformToDataSet(dataset.rows, dataset.columns, sections),
  );
  const [
    showLabel,
    showLegend,
    radarArea,
    lowColor,
    highColor,
    radarColor,
    radarMax,
  ] = getStyles(
    config.styles || [],
    ['appearance'],
    [
      'showLabel',
      'showLegend',
      'radarArea',
      'lowColor',
      'highColor',
      'radarColor',
      'radarMax',
    ],
  );
  const palette = [lowColor || '#e0efff', highColor || '#2364d2'];
  const [showTooltip] = getStyles(
    config.settings || [],
    ['general'],
    ['tooltip'],
  );
  if (!dimensions.length || !metrics.length) return { series: [] };
  if (!rows.length) return noData();

  if (kind === 'radar') {
    const values = rows
      .map(row => ({
        name: String(row.getCell(dimensions[0]) ?? ''),
        values: metrics.map(field => number(row.getCell(field))),
        row,
      }))
      .filter(
        item => item.name && item.values.some(value => value !== undefined),
      );
    if (!values.length) return noData();
    const indicator = values.map(item => {
      const valid = item.values.filter(
        (value): value is number => value !== undefined,
      );
      return {
        name: item.name,
        min: Math.min(0, ...valid),
        max: radarMax > 0 ? radarMax : Math.max(1, ...valid),
      };
    });
    return {
      tooltip: { show: showTooltip !== false },
      color: [
        radarColor || '#5470c6',
        '#91cc75',
        '#fac858',
        '#ee6666',
        '#73c0de',
        '#3ba272',
        '#fc8452',
        '#9a60b4',
      ],
      legend: { show: showLegend !== false },
      radar: { indicator },
      series: [
        {
          type: 'radar',
          label: { show: !!showLabel },
          areaStyle: radarArea ? {} : undefined,
          data: metrics.map((field, index) => ({
            name: getColumnRenderName(field),
            value: values.map(item => item.values[index] ?? null),
          })),
        },
      ],
    };
  }

  const cells = rows.flatMap(row => {
    const value = number(row.getCell(metrics[0]));
    const first = row.getCell(dimensions[0]);
    const second = dimensions[1] ? row.getCell(dimensions[1]) : undefined;
    if (
      value === undefined ||
      first === null ||
      first === undefined ||
      first === '' ||
      (kind === 'heatmap' &&
        (second === null || second === undefined || second === ''))
    )
      return [];
    return [
      {
        first: String(first),
        second: second == null ? undefined : String(second),
        value,
        row,
      },
    ];
  });
  if (!cells.length) return noData();

  if (kind === 'treemap') {
    const root = new Map<
      string,
      { name: string; value?: number; children?: any[] }
    >();
    for (const cell of cells) {
      if (cell.value < 0) continue;
      if (dimensions.length === 1) {
        const existing = root.get(cell.first);
        if (existing) existing.value = (existing.value || 0) + cell.value;
        else
          root.set(cell.first, {
            name: cell.first,
            value: cell.value,
            ...getExtraSeriesRowData(cell.row),
          });
      } else {
        if (cell.second === undefined || cell.second === '') continue;
        let parent = root.get(cell.first);
        if (!parent) {
          parent = { name: cell.first, children: [] };
          root.set(cell.first, parent);
        }
        const child = parent.children!.find(item => item.name === cell.second);
        if (child) child.value += cell.value;
        else
          parent.children!.push({
            name: cell.second,
            value: cell.value,
            ...getExtraSeriesRowData(cell.row),
          });
      }
    }
    const [min, max] = bounds(
      cells.filter(cell => cell.value >= 0).map(cell => cell.value),
    );
    return {
      tooltip: { show: showTooltip !== false },
      graphic: cells.some(cell => cell.value < 0)
        ? [
            {
              type: 'text',
              left: 'center',
              top: 0,
              style: {
                text: i18next.t('viz.palette.graph.treemapNegative', {
                  defaultValue: 'Negative values are not shown in treemaps',
                }),
                fill: '#d46b08',
              },
            },
          ]
        : [],
      series: [
        {
          type: 'treemap',
          data: Array.from(root.values()),
          color: palette,
          colorMappingBy: 'value',
          visualMin: min,
          visualMax: max,
          label: { show: !!showLabel, formatter: '{b}: {c}' },
          roam: false,
        },
      ],
    };
  }

  if (kind === 'heatmap') {
    const x = Array.from(new Set(cells.map(cell => cell.first)));
    const y = Array.from(new Set(cells.map(cell => cell.second!)));
    const xIndexes = new Map(x.map((value, index) => [value, index]));
    const yIndexes = new Map(y.map((value, index) => [value, index]));
    const data = cells.map(cell => ({
      value: [xIndexes.get(cell.first), yIndexes.get(cell.second!), cell.value],
      ...getExtraSeriesRowData(cell.row),
    }));
    const values = cells.map(cell => cell.value);
    const [min, max] = bounds(values);
    return {
      tooltip: { show: showTooltip !== false, position: 'top' },
      grid: {
        left: '10%',
        right: '10%',
        top: '8%',
        bottom: '18%',
        containLabel: true,
      },
      xAxis: { type: 'category', data: x },
      yAxis: { type: 'category', data: y },
      visualMap: {
        min,
        max,
        calculable: true,
        orient: 'horizontal',
        left: 'center',
        bottom: 0,
        inRange: { color: palette },
      },
      series: [
        {
          type: 'heatmap',
          data,
          label: {
            show: !!showLabel,
            formatter: (params: any) => params.value?.[2] ?? '',
          },
        },
      ],
    };
  }

  const daily = new Map<
    string,
    {
      first: string;
      second?: string;
      value: number;
      row: typeof cells[number]['row'];
      date: string;
      year: string;
    }
  >();
  cells.forEach(cell => {
    const text = cell.first.slice(0, 10);
    const parsed = dayjs(text);
    if (
      !/^\d{4}-\d{2}-\d{2}$/.test(text) ||
      !parsed.isValid() ||
      parsed.format('YYYY-MM-DD') !== text
    )
      return;
    const existing = daily.get(text);
    if (existing) existing.value += cell.value;
    else daily.set(text, { ...cell, date: text, year: text.slice(0, 4) });
  });
  const [selectedYear] = getStyles(
    config.settings || [],
    ['calendar'],
    ['year'],
  );
  const dates = Array.from(daily.values()).filter(
    item => !selectedYear || item.year === String(selectedYear),
  );
  const years = Array.from(new Set(dates.map(item => item.year))).sort();
  if (!years.length) return noData();
  const values = dates.map(item => item.value);
  const [min, max] = bounds(values);
  return {
    tooltip: { show: showTooltip !== false, position: 'top' },
    visualMap: {
      min,
      max,
      orient: 'horizontal',
      left: 'center',
      bottom: 0,
      inRange: { color: palette },
    },
    calendar: years.map((year, index) => ({
      range: year,
      left: 50,
      right: 20,
      top: `${10 + (index * 80) / Math.max(years.length, 1)}%`,
      height: `${65 / Math.max(years.length, 1)}%`,
      cellSize: ['auto', 'auto'],
      yearLabel: { show: true },
    })),
    series: years.map((year, index) => ({
      type: 'heatmap',
      coordinateSystem: 'calendar',
      calendarIndex: index,
      label: {
        show: !!showLabel,
        formatter: (params: any) => params.value?.[1] ?? '',
      },
      data: dates
        .filter(item => item.year === year)
        .map(item => ({
          value: [item.date, item.value],
          ...getExtraSeriesRowData(item.row),
        })),
    })),
  };
}

export class AdvancedChart extends Chart {
  config: ChartConfig;
  private chart: ReturnType<typeof init> | null = null;
  private selection?: ChartSelectionManager;
  constructor(private kind: Kind) {
    const icons = {
      radar: 'radar',
      heatmap: 'fenzubiao',
      treemap: 'treemap',
      calendarHeatmap: '24gf-table',
    };
    super(
      `advanced-${kind}`,
      `viz.palette.graph.names.${kind}Chart`,
      icons[kind],
    );
    this.config = chartConfig(kind);
    this.meta.requirements = [
      {
        group: kind === 'heatmap' ? 2 : kind === 'treemap' ? [1, 2] : 1,
        aggregate: kind === 'radar' ? [1, 8] : 1,
      },
    ];
  }
  onMount(options: BrokerOption, context: BrokerContext) {
    const container = context.document?.getElementById(options.containerId);
    if (!container || !context.window) return;
    this.chart = init(container, 'default');
    this.selection = new ChartSelectionManager(this.mouseEvents);
    this.selection.attachWindowListeners(context.window);
    this.selection.attachZRenderListeners(this.chart);
    this.selection.attachEChartsListeners(this.chart);
  }
  onUpdated(options: BrokerOption) {
    if (!this.chart) return;
    if (
      !options.dataset?.columns ||
      !options.config ||
      !this.isMatchRequirement(options.config)
    ) {
      this.chart.clear();
      return;
    }
    this.selection?.updateSelectedItems(options.selectedItems);
    this.chart.setOption(
      applyMobileChartOption(
        buildAdvancedOptions(this.kind, options.dataset, options.config),
        {
          isMobile: Boolean(options.widgetSpecialConfig?.isMobile),
          isEmbedded: Boolean(options.widgetSpecialConfig?.isEmbedded),
        },
      ) as any,
      true,
    );
  }
  onUnMount(_options: BrokerOption, context: BrokerContext) {
    this.selection?.removeWindowListeners(context.window);
    if (this.chart) this.selection?.removeZRenderListeners(this.chart);
    this.chart?.dispose();
    this.chart = null;
  }
  onResize(_options: BrokerOption, context: BrokerContext) {
    this.chart?.resize({ width: context.width, height: context.height });
  }
}

export const advancedCharts = () =>
  (['radar', 'heatmap', 'treemap', 'calendarHeatmap'] as const).map(
    kind => new AdvancedChart(kind),
  );
