import { applyCommonEChartsStyles } from '../BasicEChartsChart';
import { group, metric, simpleChartConfig } from '../chartConfig';

describe('simple chart configuration', () => {
  it('adds DataEase-style filter and info slots without replacing chart slots', () => {
    const config = simpleChartConfig([group('dimension', 1), metric()], 'test');

    expect(config.datas?.map(item => item.type)).toEqual([
      'group',
      'aggregate',
      'filter',
      'info',
    ]);
    expect(config.datas?.[0]).toMatchObject({
      required: true,
      drillable: true,
    });
    expect(config.datas?.[1]).toMatchObject({ required: true });
  });

  it('applies common label, legend, tooltip, and animation settings', () => {
    const option = applyCommonEChartsStyles(
      {
        tooltip: { trigger: 'axis' },
        legend: { data: ['value'] },
        xAxis: { type: 'category', data: ['A'] },
        series: [{ type: 'bar', data: [1] }],
      },
      {
        ...simpleChartConfig([group('dimension', 1), metric()], 'test'),
        styles: [
          { key: 'label', rows: [{ key: 'showLabel', value: false }] },
          {
            key: 'legend',
            rows: [
              { key: 'showLegend', value: true },
              { key: 'position', value: 'top' },
            ],
          },
          { key: 'tooltip', rows: [{ key: 'showTooltip', value: false }] },
        ],
        settings: [
          {
            key: 'advanced',
            rows: [
              { key: 'animation', value: false },
              { key: 'showDataZoom', value: true },
            ],
          },
        ],
      } as any,
    );

    expect(option.animation).toBe(false);
    expect(option.tooltip.show).toBe(false);
    expect(option.legend).toMatchObject({ show: true, top: 0, left: 'center' });
    expect(option.series[0]).toMatchObject({
      animation: false,
      label: { show: false },
    });
    expect(option.dataZoom).toEqual([{ type: 'inside' }, { type: 'slider' }]);
  });
});
