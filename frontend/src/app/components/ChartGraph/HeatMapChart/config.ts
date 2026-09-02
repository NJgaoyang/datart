import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig(
  [group('longitude', 1), group('latitude', 1), metric('value', 1)],
  '地图热力图',
  [
    {
      label: 'chart.radius',
      key: 'radius',
      default: 20,
      comType: 'inputNumber',
    },
    { label: 'chart.blur', key: 'blur', default: 0.85, comType: 'slider' },
    {
      label: 'chart.startColor',
      key: 'startColor',
      default: '#eef5ff',
      comType: 'fontColor',
    },
    {
      label: 'chart.endColor',
      key: 'endColor',
      default: '#2f6fed',
      comType: 'fontColor',
    },
  ],
);
