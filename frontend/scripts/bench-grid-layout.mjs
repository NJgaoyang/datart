/**
 * Reproducible CPU-side baseline for v2 compaction. Does not substitute for a
 * browser benchmark (React rendering, charts, paint, drag FPS).
 *
 * npm run bench:grid
 */
import { performance } from 'node:perf_hooks';
import { getCompactor } from 'react-grid-layout/core';

const scenarios = [100, 500, 1000];
const compactor = getCompactor('vertical', false);
const results = scenarios.map(count => {
  const items = Array.from({ length: count }, (_, i) => ({
    i: `widget-${i}`,
    x: (i % 12) * 6,
    y: Math.floor(i / 12) * 8,
    w: 6,
    h: 6,
  }));
  const durationsMs = [];
  for (let warmup = 0; warmup < 2; warmup++) compactor.compact(items, 72);
  for (let sample = 0; sample < 5; sample++) {
    const start = performance.now();
    const result = compactor.compact(items, 72);
    durationsMs.push(performance.now() - start);
    if (result.length !== count) throw new Error('Widget loss during compaction');
  }
  durationsMs.sort((a, b) => a - b);
  return {
    widgets: count,
    medianMs: Number(durationsMs[2].toFixed(2)),
    maxMs: Number(durationsMs[4].toFixed(2)),
  };
});
process.stdout.write(JSON.stringify({
  engine: 'react-grid-layout@2.2.4',
  kind: 'Node CPU compaction only',
  platform: process.platform,
  node: process.version,
  results,
}, null, 2) + '\n');
