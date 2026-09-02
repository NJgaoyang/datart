import { finiteNumber, safeName } from './BasicEChartsChart';

export type FlatChartRow = {
  groups: string[];
  values: number[];
};

export const buildHierarchy = (rows: FlatChartRow[]) => {
  const root = { name: '全部', children: [] as any[] };
  rows.forEach(row => {
    const value = Math.max(0, finiteNumber(row.values[0]));
    let parent = root;
    row.groups.forEach((group, index) => {
      const name = safeName(group);
      let child = parent.children.find(item => item.name === name);
      if (!child) {
        child = { name, children: [] as any[], value: 0 };
        parent.children.push(child);
      }
      child.value += value;
      if (index === row.groups.length - 1) {
        delete child.children;
      } else {
        parent = child;
      }
    });
  });
  return root.children;
};

export const buildSankeyData = (
  rows: Array<{ source: unknown; target: unknown; value: unknown }>,
) => {
  const nodes = new Set<string>();
  const links = new Map<
    string,
    { source: string; target: string; value: number }
  >();
  rows.forEach(row => {
    const source = `${row.source ?? ''}`.trim();
    const target = `${row.target ?? ''}`.trim();
    const value = finiteNumber(row.value);
    if (!source || !target || source === target || value <= 0) {
      return;
    }
    nodes.add(source);
    nodes.add(target);
    const key = `${source}\u0000${target}`;
    const link = links.get(key) || { source, target, value: 0 };
    link.value += value;
    links.set(key, link);
  });
  return {
    nodes: [...nodes].map(name => ({ name })),
    links: [...links.values()],
  };
};

export const buildRangeData = (rows: FlatChartRow[]) =>
  rows.map(row => {
    const first = finiteNumber(row.values[0]);
    const second = finiteNumber(row.values[1]);
    return {
      name: safeName(row.groups[0]),
      start: Math.min(first, second),
      end: Math.max(first, second),
    };
  });

export const buildBidirectionalData = (rows: FlatChartRow[]) =>
  rows.map(row => ({
    name: safeName(row.groups[0]),
    left: finiteNumber(row.values[0]),
    right: finiteNumber(row.values[1]),
  }));

export const buildProgressData = (rows: FlatChartRow[], max: number) =>
  rows.map(row => ({
    name: safeName(row.groups[0]),
    value: finiteNumber(row.values[0]),
    max,
  }));

export const buildGeoHeatmapData = (rows: FlatChartRow[]) =>
  rows
    .map(row => [
      finiteNumber(row.values[0], NaN),
      finiteNumber(row.values[1], NaN),
      finiteNumber(row.values[2]),
    ])
    .filter(row => Number.isFinite(row[0]) && Number.isFinite(row[1]));

export const buildFlowData = (rows: FlatChartRow[]) =>
  rows
    .map(row => ({
      start: [
        finiteNumber(row.values[0], NaN),
        finiteNumber(row.values[1], NaN),
      ],
      end: [finiteNumber(row.values[2], NaN), finiteNumber(row.values[3], NaN)],
      value: finiteNumber(row.values[4], 1),
      name: [safeName(row.groups[0], ''), safeName(row.groups[1], '')]
        .filter(Boolean)
        .join(' → '),
      startName: safeName(row.groups[0], ''),
      endName: safeName(row.groups[1], ''),
    }))
    .filter(
      row => row.start.every(Number.isFinite) && row.end.every(Number.isFinite),
    );

export const buildCirclePackingPoints = (tree: any[]) => {
  const points: Array<{
    name: string;
    value: number;
    x: number;
    y: number;
    level: number;
  }> = [];
  const walk = (
    nodes: any[],
    level: number,
    parentX: number,
    parentY: number,
  ) => {
    const count = Math.max(nodes.length, 1);
    nodes.forEach((node, index) => {
      const angle = (index / count) * Math.PI * 2;
      const distance = level * 25;
      const x = parentX + Math.cos(angle) * distance;
      const y = parentY + Math.sin(angle) * distance;
      points.push({
        name: node.name,
        value: finiteNumber(node.value),
        x,
        y,
        level,
      });
      if (node.children?.length) walk(node.children, level + 1, x, y);
    });
  };
  walk(tree, 1, 0, 0);
  return points;
};
