import {
  ChartConfig,
  ChartDataConfig,
  ChartStyleSectionRow,
} from 'app/types/ChartConfig';

export const simpleChartConfig = (
  datas: ChartDataConfig[],
  title: string,
  chartRows: ChartStyleSectionRow[] = [],
): ChartConfig => ({
  datas: [
    ...datas,
    ...(datas.some(data => data.type === 'filter')
      ? []
      : ([
          { label: 'filter', key: 'filter', type: 'filter' },
        ] as ChartDataConfig[])),
    ...(datas.some(data => data.type === 'info')
      ? []
      : ([{ label: 'info', key: 'info', type: 'info' }] as ChartDataConfig[])),
  ],
  styles: [
    {
      label: 'chart.title',
      key: 'chart',
      comType: 'group',
      rows: chartRows,
    },
    {
      label: 'label.title',
      key: 'label',
      comType: 'group',
      rows: [
        {
          label: 'label.showLabel',
          key: 'showLabel',
          default: true,
          comType: 'checkbox',
        },
        {
          label: 'label.font',
          key: 'font',
          default: { fontSize: 12, color: '#495057' },
          comType: 'font',
        },
      ],
    },
    {
      label: 'legend.title',
      key: 'legend',
      comType: 'group',
      rows: [
        {
          label: 'legend.showLegend',
          key: 'showLegend',
          default: true,
          comType: 'checkbox',
        },
        {
          label: 'legend.position',
          key: 'position',
          default: 'right',
          comType: 'legendPosition',
        },
      ],
    },
    {
      label: 'tooltip.title',
      key: 'tooltip',
      comType: 'group',
      rows: [
        {
          label: 'tooltip.showTooltip',
          key: 'showTooltip',
          default: true,
          comType: 'checkbox',
        },
      ],
    },
  ],
  settings: [
    {
      label: 'advanced.title',
      key: 'advanced',
      comType: 'group',
      rows: [
        {
          label: 'advanced.animation',
          key: 'animation',
          default: true,
          comType: 'checkbox',
        },
        {
          label: 'advanced.showDataZoom',
          key: 'showDataZoom',
          default: false,
          comType: 'checkbox',
        },
      ],
    },
  ],
  i18ns: [
    {
      lang: 'zh-CN',
      translation: {
        chart: {
          title,
          round: '圆角',
          orient: '方向',
          horizontal: '横向',
          max: '最大值',
          range: '区间上限',
          color: '颜色',
          shape: '形状',
          size: '大小',
          startColor: '起始颜色',
          endColor: '结束颜色',
          radius: '半径',
          blur: '模糊',
          animation: '动画',
          movingAverage: '均线',
          columns: '列数',
          fit: '图片适应方式',
          stack: '堆叠',
          smooth: '平滑',
        },
        label: { title: '标签', showLabel: '显示标签', font: '字体' },
        legend: { title: '图例', showLegend: '显示图例', position: '位置' },
        tooltip: { title: '提示', showTooltip: '显示提示' },
        advanced: {
          title: '高级设置',
          animation: '启用动画',
          showDataZoom: '显示数据缩放',
        },
      },
    },
    {
      lang: 'en-US',
      translation: {
        chart: {
          title,
          round: 'Radius',
          orient: 'Orientation',
          horizontal: 'Horizontal',
          max: 'Maximum',
          range: 'Range',
          color: 'Color',
          shape: 'Shape',
          size: 'Size',
          startColor: 'Start color',
          endColor: 'End color',
          radius: 'Radius',
          blur: 'Blur',
          animation: 'Animation',
          movingAverage: 'Moving average',
          columns: 'Columns',
          fit: 'Image fit',
          stack: 'Stack',
          smooth: 'Smooth',
        },
        label: { title: 'Label', showLabel: 'Show label', font: 'Font' },
        legend: {
          title: 'Legend',
          showLegend: 'Show legend',
          position: 'Position',
        },
        tooltip: { title: 'Tooltip', showTooltip: 'Show tooltip' },
        advanced: {
          title: 'Advanced',
          animation: 'Enable animation',
          showDataZoom: 'Show data zoom',
        },
      },
    },
  ],
});

export const group = (
  key = 'group',
  limit: number | number[] = [0, 999],
): ChartDataConfig => ({
  label: key,
  key,
  type: 'group',
  limit,
  required: Array.isArray(limit) ? limit[0] > 0 : limit > 0,
  actions: {
    NUMERIC: ['alias', 'colorize', 'sortable'],
    STRING: ['alias', 'colorize', 'sortable'],
    DATE: ['alias', 'sortable', 'dateLevel'],
    DATETIME: ['alias', 'sortable', 'dateLevel'],
  },
  drillable: true,
});

export const metric = (
  key = 'metrics',
  limit: number | number[] = [1, 999],
): ChartDataConfig => ({
  label: key,
  key,
  type: 'aggregate',
  required: Array.isArray(limit) ? limit[0] > 0 : limit > 0,
  limit,
  actions: {
    NUMERIC: ['aggregate', 'alias', 'format', 'sortable', 'colorSingle'],
    STRING: ['aggregate', 'alias', 'format', 'sortable', 'colorSingle'],
    DATE: ['aggregate', 'alias', 'format', 'sortable'],
    DATETIME: ['aggregate', 'alias', 'format', 'sortable'],
  },
});

export const color = (
  key = 'color',
  limit: number | number[] = [0, 1],
): ChartDataConfig => ({
  label: key,
  key,
  type: 'color',
  limit,
});

export const optionalMetric = (key: string): ChartDataConfig => ({
  ...metric(key, [0, 1]),
  required: false,
});

export default simpleChartConfig;
