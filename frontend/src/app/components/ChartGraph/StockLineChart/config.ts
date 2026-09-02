import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('date', 1), metric('ohlc', 4)],
  '股票趋势图',
  [
    {
      label: 'chart.movingAverage',
      key: 'movingAverage',
      default: false,
      comType: 'checkbox',
    },
  ],
);
