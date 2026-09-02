import {
  buildBidirectionalData,
  buildCirclePackingPoints,
  buildFlowData,
  buildGeoHeatmapData,
  buildHierarchy,
  buildProgressData,
  buildRangeData,
  buildSankeyData,
} from '../chartBuilders';

describe('chart builders', () => {
  it('aggregates hierarchy values and keeps empty groups safe', () => {
    const tree = buildHierarchy([
      { groups: ['A', 'X'], values: [2] },
      { groups: ['A', 'X'], values: [3] },
      { groups: ['', 'Y'], values: [1] },
    ]);
    expect(tree).toEqual([
      { name: 'A', value: 5, children: [{ name: 'X', value: 5 }] },
      { name: '未命名', value: 1, children: [{ name: 'Y', value: 1 }] },
    ]);
    expect(buildHierarchy([{ groups: ['negative'], values: [-2] }])).toEqual([
      { name: 'negative', value: 0 },
    ]);
  });

  it('deduplicates sankey links and filters invalid edges', () => {
    expect(
      buildSankeyData([
        { source: 'A', target: 'B', value: 2 },
        { source: 'A', target: 'B', value: 3 },
        { source: 'A', target: 'A', value: 10 },
        { source: '', target: 'B', value: 1 },
      ]),
    ).toEqual({
      nodes: [{ name: 'A' }, { name: 'B' }],
      links: [{ source: 'A', target: 'B', value: 5 }],
    });
  });

  it('normalizes range, progress, and bidirectional values', () => {
    expect(buildRangeData([{ groups: ['A'], values: [8, 2] }])[0]).toEqual({
      name: 'A',
      start: 2,
      end: 8,
    });
    expect(
      buildBidirectionalData([
        { groups: ['A'], values: ['bad' as any, -3] },
      ])[0],
    ).toEqual({ name: 'A', left: 0, right: -3 });
    expect(
      buildProgressData([{ groups: ['A'], values: [120] }], 100)[0],
    ).toEqual({ name: 'A', value: 120, max: 100 });
  });

  it('filters invalid coordinates and creates circle points', () => {
    expect(
      buildGeoHeatmapData([
        { groups: [], values: [120, 30, 4] },
        { groups: [], values: ['x' as any, 30, 4] },
      ]),
    ).toEqual([[120, 30, 4]]);
    expect(
      buildFlowData([{ groups: ['A'], values: [120, 30, 121, 31, 2] }]),
    ).toHaveLength(1);
    expect(
      buildCirclePackingPoints([{ name: 'A', value: 1 }])[0],
    ).toMatchObject({ name: 'A', level: 1 });
  });
});
