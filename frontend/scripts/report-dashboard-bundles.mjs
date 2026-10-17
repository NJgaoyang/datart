import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Vite manifest models static entry imports separately from deferred imports.
// Only graph reachability is reported, not hypothetical gzip transfer times.
const root = resolve(process.cwd(), 'build');
// Vite 4 emits build/manifest.json; newer Vite versions use build/.vite/manifest.json.
const path = [join(root, 'manifest.json'), join(root, '.vite', 'manifest.json')]
  .find(candidate => existsSync(candidate));
if (!path) {
  console.error('No Vite manifest. Run npm run build first.');
  process.exitCode = 1;
} else {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const entries = Object.entries(manifest).filter(([, asset]) => asset.isEntry);
  const kb = size => (size / 1024).toFixed(1) + ' KiB';
  const visit = (key, seen) => {
    if (seen.has(key) || !manifest[key]) return;
    seen.add(key);
    for (const next of manifest[key].imports || []) visit(next, seen);
  };
  const fileSize = key => {
    const rel = manifest[key]?.file;
    if (!rel || !rel.endsWith('.js')) return 0;
    const file = join(root, rel);
    return existsSync(file) ? statSync(file).size : 0;
  };
  console.log('\nDashboard UI bundle report (uncompressed JavaScript):');
  for (const [key, asset] of entries) {
    const staticChunks = new Set();
    visit(key, staticChunks);
    const initialSize = [...staticChunks].reduce((total, child) => total + fileSize(child), 0);
    console.log(`  ${asset.name || key}: initial=${kb(initialSize)}, static chunks=${staticChunks.size}`);
  }
  const js = Object.entries(manifest).filter(([, asset]) =>
    asset.file?.endsWith('.js'));
  const uniqueJs = new Set(js.map(([, asset]) => asset.file));
  const aggregate = [...uniqueJs].reduce((total, rel) =>
    total + statSync(join(root, rel)).size, 0);
  console.log(`  all unique JS files: ${kb(aggregate)} (${uniqueJs.size} files)`);
  console.log('Note: entry static imports exclude lazy-loaded route chunks; numbers are not gzip or runtime FPS.\n');
}
