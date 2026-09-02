import {
  group,
  metric,
  optionalMetric,
  simpleChartConfig,
} from '../chartConfig';
export default simpleChartConfig(
  [group(), metric('measure', 1), optionalMetric('target')],
  '子弹图',
  [
    {
      label: 'chart.range',
      key: 'range',
      default: 100,
      comType: 'inputNumber',
      options: { min: 0 },
    },
  ],
);
