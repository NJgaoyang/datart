import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig([group(), metric()], '进度条图', [
  {
    label: 'chart.max',
    key: 'max',
    default: 100,
    comType: 'inputNumber',
    options: { min: 0 },
  },
]);
