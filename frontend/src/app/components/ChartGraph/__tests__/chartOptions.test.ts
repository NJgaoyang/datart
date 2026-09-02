import { buildBidirectionalBarOption } from '../BidirectionalBarChart/BidirectionalBarChart';
import { buildGroupStackOption } from '../GroupStackColumnChart/GroupStackColumnChart';
import { getLiquidRatio } from '../LiquidChart/LiquidChart';
import { buildMixedOption } from '../MixedChart/MixedChart';
import { buildProgressBarOption } from '../ProgressBarChart/ProgressBarChart';

const field = (colName: string) => ({
  uid: colName,
  colName,
  type: 'string',
  category: 'dimension',
});

const metricField = (colName: string) => ({
  uid: colName,
  colName,
  type: 'number',
  category: 'measure',
});

const dataset = (columns: string[], rows: unknown[][]) => ({
  columns: columns.map(name => ({ name })),
  rows: rows as string[][],
});

describe('new chart option builders', () => {
  it('keeps grouped stacks independent and supports selected rows', () => {
    const category = field('category');
    const outer = field('series');
    const stack = field('stack');
    const value = metricField('value');
    const option = buildGroupStackOption(
      dataset(
        ['category', 'series', 'stack', 'value'],
        [
          ['A', 'one', 'x', '2'],
          ['A', 'one', 'y', '3'],
          ['A', 'two', 'x', '4'],
        ],
      ),
      {
        datas: [
          { key: 'category', type: 'group', rows: [category] },
          { key: 'series', type: 'group', rows: [outer] },
          { key: 'stack', type: 'color', rows: [stack] },
          { key: 'value', type: 'aggregate', rows: [value] },
        ],
        styles: [{ key: 'stack', rows: [{ key: 'enable', value: true }] }],
      } as any,
      [],
    );
    expect(option.series.map(series => series.stack)).toEqual([
      'group-0',
      'group-0',
      'group-1',
      'group-1',
    ]);
  });

  it('uses left and right metric slots for mixed chart modes', () => {
    const dimension = field('dimension');
    const left = metricField('left');
    const right = metricField('right');
    const option = buildMixedOption(
      dataset(
        ['dimension', 'left', 'right'],
        [
          ['A', '10', '20'],
          ['B', '', '30'],
        ],
      ),
      {
        datas: [
          { key: 'dimension', type: 'group', rows: [dimension] },
          { key: 'metricsL', type: 'aggregate', rows: [left] },
          { key: 'metricsR', type: 'aggregate', rows: [right] },
        ],
      } as any,
      'bar-line',
    );
    expect(
      option.series.map(series => [series.type, series.yAxisIndex]),
    ).toEqual([
      ['bar', 0],
      ['line', 1],
    ]);
    expect(option.series[1].data[1]).toBe(30);
  });

  it('preserves original bidirectional values in tooltip data', () => {
    const category = field('category');
    const left = metricField('left');
    const right = metricField('right');
    const option = buildBidirectionalBarOption(
      dataset(['category', 'left', 'right'], [['A', '-4', '6']]),
      {
        datas: [
          { key: 'category', type: 'group', rows: [category] },
          { key: 'sides', type: 'aggregate', rows: [left, right] },
        ],
      } as any,
    );
    expect(option.series[0].data[0]).toMatchObject({ value: -4, original: -4 });
    expect(option.series[1].data[0]).toMatchObject({ value: 6, original: 6 });
  });

  it('keeps the progress axis visible for values above the configured maximum', () => {
    const category = field('category');
    const value = metricField('value');
    const option = buildProgressBarOption(
      dataset(['category', 'value'], [['A', '120']]),
      {
        datas: [
          { key: 'category', type: 'group', rows: [category] },
          { key: 'metrics', type: 'aggregate', rows: [value] },
        ],
        styles: [{ key: 'chart', rows: [{ key: 'max', value: 100 }] }],
      } as any,
    );
    expect(option.xAxis.max).toBeGreaterThanOrEqual(120);
  });

  it('normalizes a zero liquid maximum without throwing', () => {
    const value = metricField('value');
    expect(
      getLiquidRatio(dataset(['value'], [['50']]), {
        datas: [{ key: 'metrics', type: 'aggregate', rows: [value] }],
        styles: [{ key: 'chart', rows: [{ key: 'max', value: 0 }] }],
      } as any),
    ).toBe(1);
  });
});
