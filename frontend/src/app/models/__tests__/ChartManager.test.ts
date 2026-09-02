import ChartManager from '../ChartManager';

describe('ChartManager built-in parity charts', () => {
  it('registers the new stable chart ids without changing existing ids', () => {
    const ids = ChartManager.instance()
      .getAllCharts()
      .map(chart => chart.meta.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'radar',
        'treemap-chart',
        'sankey-chart',
        'bullet-chart',
        'group-stack-column-chart',
        'chart-mix-bar-line',
        'chart-mix-group',
        'chart-mix-stack',
        'chart-mix-dual-line',
        'geo-heatmap-chart',
        'flow-map-chart',
        'stock-line-chart',
        'circle-packing-chart',
        'picture-group-chart',
      ]),
    );
    expect(ids).toContain('piovt-sheet');
  });
});
