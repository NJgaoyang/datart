import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('dimension', 1), metric('metricsL'), metric('metricsR')],
  '组合图',
  [
    {
      label: 'chart.smooth',
      key: 'smooth',
      default: false,
      comType: 'checkbox',
    },
  ],
);
