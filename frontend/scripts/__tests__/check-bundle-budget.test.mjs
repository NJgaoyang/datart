import assert from 'node:assert/strict';
import { test } from 'node:test';
import { evaluateBundleBudget } from '../check-bundle-budget.mjs';

const manifest = () => ({
  'main.ts': {
    isEntry: true, file: 'static/js/main.abc123.js',
    imports: ['app.js'], dynamicImports: ['lazy.js'],
  },
  'share.ts': { isEntry: true, file: 'static/js/share.def456.js', imports: ['app.js'] },
  'app.js': { file: 'static/js/app.111111.js', imports: ['vendor.js'] },
  'vendor.js': { file: 'static/js/vendor.222222.js' },
  'lazy.js': { file: 'static/js/lazy.333333.js' },
});
const sizes = Object.freeze({
  'static/js/main.abc123.js': 100,
  'static/js/share.def456.js': 110,
  'static/js/app.111111.js': 300,
  'static/js/vendor.222222.js': 600,
  'static/js/lazy.333333.js': 500,
});
const size = file => sizes[file];

test('counts eager imports once per entry and keeps deferred chunks out of startup', () => {
  const result = evaluateBundleBudget(manifest(), size);
  assert.equal(result.entries['main.ts'], 1000);
  assert.equal(result.entries['share.ts'], 1010);
  assert.equal(result.allJsBytes, 1610);
  assert.equal(result.maxChunk.bytes, 600);
});

test('fails if any entry crosses its own initial budget', () => {
  assert.throws(() =>
    evaluateBundleBudget(manifest(), size, {
      initialBytes: 1000, allJsBytes: 2000, largestChunkBytes: 1000,
    }), /Initial JS budget exceeded for share.ts/);
});

test('enforces the tighter login entry budget separately', () => {
  assert.throws(() => evaluateBundleBudget(manifest(), size, {
    initialBytes: 2000, allJsBytes: 2000, largestChunkBytes: 1000,
    entryBudgets: { 'main.ts': 999 },
  }), /Initial JS budget exceeded for main.ts/);
});

test('counts lazy bundles against full site JS total', () => {
  assert.throws(() =>
    evaluateBundleBudget(manifest(), size, {
      initialBytes: 2000, allJsBytes: 1609, largestChunkBytes: 1000,
    }), /All JS bundle budget exceeded/);
});

test('rejects unsafe admin-tools split even if sizes are small', () => {
  const m = manifest();
  m['lazy.js'].file = 'static/js/admin-tools.aabbccdd.js';
  assert.throws(() => evaluateBundleBudget(m, () => 1), /Unsafe admin-tools chunk/);
});

test('fails loudly on missing eager imports or an empty entry manifest', () => {
  const m = manifest();
  m['main.ts'].imports = ['missing.js'];
  assert.throws(() => evaluateBundleBudget(m, size), /Missing eager Vite import/);
  assert.throws(() => evaluateBundleBudget({}, size), /no entrypoints/);
});

test('prevents budget failure from being hidden by invalid file sizes', () => {
  assert.throws(() => evaluateBundleBudget(manifest(), () => NaN), /Invalid bundle file size/);
});
