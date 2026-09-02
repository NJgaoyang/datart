import { metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig([metric()], '水波图', [
  {
    label: 'chart.max',
    key: 'max',
    default: 100,
    comType: 'inputNumber',
    options: { min: 0 },
  },
  {
    label: 'chart.color',
    key: 'color',
    default: '#4e79a7',
    comType: 'fontColor',
  },
  {
    label: 'chart.shape',
    key: 'shape',
    default: 'circle',
    comType: 'select',
    options: { items: ['circle', 'rect'] },
  },
  {
    label: 'chart.size',
    key: 'size',
    default: 80,
    comType: 'inputNumber',
    options: { min: 10, max: 100 },
  },
]);
