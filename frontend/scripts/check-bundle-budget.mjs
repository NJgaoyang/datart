/**
 * Guard initial browser JavaScript without re-introducing risky manualChunks.
 * Vite's manifest "imports" are eager; "dynamicImports" are deferred.
 * No time/throughput extrapolation: this is a deterministic raw-byte budget.
 */
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const DEFAULT_BUNDLE_BUDGET = Object.freeze({
  // Baseline (2026-10-18) app + vendor: ~12.7M raw bytes.
  // Deliberate ~18-26% headroom for normal development, not a target FPS.
  initialBytes: 15_000_000,
  allJsBytes: 16_000_000,
  largestChunkBytes: 10_500_000,
});

const isJs = filename => typeof filename === 'string' && filename.endsWith('.js');

export function evaluateBundleBudget(manifest, fileBytes, budget = DEFAULT_BUNDLE_BUDGET) {
  const entries = Object.entries(manifest).filter(([, asset]) => asset.isEntry);
  if (entries.length === 0) throw new Error('Vite manifest contains no entrypoints');

  const jsFiles = new Set();
  const maxChunk = { name: '', bytes: 0 };
  for (const asset of Object.values(manifest)) {
    if (!isJs(asset.file)) continue;
    const basename = asset.file.split('/').pop();
    if (basename?.startsWith('admin-tools.')) {
      throw new Error('Unsafe admin-tools chunk reintroduced: cross-chunk TDZ risk');
    }
    jsFiles.add(asset.file);
    const bytes = fileBytes(asset.file);
    if (!Number.isFinite(bytes) || bytes < 0) {
      throw new Error('Invalid bundle file size for ' + asset.file);
    }
    if (bytes > maxChunk.bytes) {
      maxChunk.name = asset.file;
      maxChunk.bytes = bytes;
    }
  }

  const entrySizes = {};
  for (const [key] of entries) {
    const seen = new Set();
    const visit = name => {
      if (seen.has(name)) return;
      const item = manifest[name];
      if (!item) throw new Error('Missing eager Vite import: ' + name);
      seen.add(name);
      for (const dependency of item.imports || []) visit(dependency);
      // dynamicImports are intentionally NOT included in initial transfer.
    };
    visit(key);
    const bytes = [...new Set([...seen].map(name => manifest[name].file).filter(isJs))]
      .reduce((total, file) => total + fileBytes(file), 0);
    entrySizes[key] = bytes;
    if (bytes > budget.initialBytes) {
      throw new Error('Initial JS budget exceeded for ' + key + ': ' +
        bytes + ' > ' + budget.initialBytes + ' bytes');
    }
  }

  const allJsBytes = [...jsFiles].reduce((total, file) => total + fileBytes(file), 0);
  if (maxChunk.bytes > budget.largestChunkBytes) {
    throw new Error('Single JS chunk budget exceeded: ' + maxChunk.name +
      ' ' + maxChunk.bytes + ' > ' + budget.largestChunkBytes);
  }
  if (allJsBytes > budget.allJsBytes) {
    throw new Error('All JS bundle budget exceeded: ' +
      allJsBytes + ' > ' + budget.allJsBytes + ' bytes');
  }

  return { entries: entrySizes, allJsBytes, maxChunk };
}

function loadBuildManifest(root) {
  const file = [join(root, 'manifest.json'), join(root, '.vite', 'manifest.json')]
    .find(candidate => existsSync(candidate));
  if (!file) throw new Error('Missing Vite manifest: run npm run build first');
  return JSON.parse(readFileSync(file, 'utf8'));
}

export function checkBuildBudget(root = resolve(process.cwd(), 'build')) {
  const manifest = loadBuildManifest(root);
  const bytes = relative => {
    const target = resolve(root, relative);
    if (!target.startsWith(root + sep)) throw new Error('Unsafe manifest asset path');
    if (!existsSync(target)) throw new Error('Missing built asset: ' + relative);
    return statSync(target).size;
  };
  return evaluateBundleBudget(manifest, bytes);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const report = checkBuildBudget();
    for (const [entry, size] of Object.entries(report.entries)) {
      console.log('ENTRY_JS_BUDGET', entry, size + ' bytes');
    }
    console.log('ALL_JS_BUDGET', report.allJsBytes + ' bytes');
    console.log('LARGEST_CHUNK', report.maxChunk.name, report.maxChunk.bytes + ' bytes');
    console.log('Bundle size regression guard passed (raw JS bytes, not runtime FPS).');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
