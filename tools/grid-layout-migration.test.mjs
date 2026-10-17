import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { migrateDashboardExport, runCli } from './grid-layout-migration.mjs';

const fixture = (versions = {}) => ({
  dashboard: {
    id: 'dashboard-1',
    config: JSON.stringify({
      type: 'auto',
      layoutVersion: 1,
      mobileLayoutVersion: 1,
      pcRowLayoutVersion: 1,
      ...versions,
    }),
  },
  widgets: [{
    id: 'chart-1',
    config: JSON.stringify({
      name: 'Sales', lock: true,
      pRect: { x: 2, y: 1, width: 4, height: 6 },
      mRect: { x: 1, y: 0, width: 3, height: 4 },
    }),
  }],
});

test('migrates v1 12-column desktop and historical row units without changing other fields', () => {
  const source = fixture();
  const { output, report } = migrateDashboardExport(source);
  const cfg = JSON.parse(output.widgets[0].config);
  assert.deepEqual(cfg.pRect, { x: 12, y: 4, width: 24, height: 24 });
  assert.deepEqual(cfg.mRect, { x: 2, y: 0, width: 6, height: 4 });
  assert.equal(cfg.lock, true);
  assert.equal(cfg.name, 'Sales');
  assert.equal(JSON.parse(output.dashboard.config).layoutVersion, 3);
  assert.equal(report.changed, 1);
  assert.equal(source.dashboard.config, fixture().dashboard.config);
});

test('migrates v2 mobile 6-column rectangles to 24 columns, keeps desktop', () => {
  const source = fixture({
    layoutVersion: 2, mobileLayoutVersion: 1, pcRowLayoutVersion: 2,
  });
  const { output } = migrateDashboardExport(source);
  const cfg = JSON.parse(output.widgets[0].config);
  assert.deepEqual(cfg.pRect, { x: 2, y: 1, width: 4, height: 6 });
  assert.deepEqual(cfg.mRect, { x: 4, y: 0, width: 12, height: 4 });
});

test('refuses unknown future schema, leaves free layout untouched', () => {
  assert.throws(() =>
    migrateDashboardExport(fixture({ layoutVersion: 4 })), /future/);
  const free = fixture();
  const dashboard = JSON.parse(free.dashboard.config);
  free.dashboard.config = JSON.stringify({ ...dashboard, type: 'free' });
  assert.equal(migrateDashboardExport(free).report.skipped, 'free layout');
});

test('previews, backs up, applies and restores without overwriting files', () => {
  const dir = mkdtempSync(join(tmpdir(), 'grid-migration-'));
  const input = join(dir, 'dashboard.json');
  const output = join(dir, 'converted.json');
  const restored = join(dir, 'restored.json');
  const original = JSON.stringify(fixture());
  writeFileSync(input, original);
  assert.equal(runCli(['--input', input]).changed, 1);
  assert.equal(runCli(['--input', input, '--apply', '--output', output]).changed, 1);
  assert.equal(JSON.parse(readFileSync(output)).widgets.length, 1);
  assert.equal(JSON.parse(readFileSync(output + '.audit.json')).report.changed, 1);
  assert.equal(readFileSync(input, 'utf8'), original);
  assert.throws(() => runCli(['--input', input, '--apply', '--output', output]), /Destination/);
  runCli(['--rollback', input + '.bak', '--output', restored]);
  assert.equal(readFileSync(restored, 'utf8'), original);
});
