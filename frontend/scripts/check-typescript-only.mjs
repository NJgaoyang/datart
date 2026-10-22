// Keep all browser/application sources in TypeScript; Node tool scripts may
// remain .js/.mjs for compatibility with their execution environments.
import { readdirSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../src/', import.meta.url));
const untypedSources = [];

function inspect(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = join(directory, entry.name);
    if (entry.isDirectory()) {
      inspect(absolutePath);
    } else if (entry.isFile() && /\.(jsx|js)$/.test(entry.name)) {
      untypedSources.push(relative(root, absolutePath));
    }
  }
}

inspect(root);
if (untypedSources.length > 0) {
  console.error('JavaScript/JSX remains in frontend/src:');
  for (const file of untypedSources.sort()) console.error('  ' + file);
  process.exitCode = 1;
} else {
  console.log('frontend/src contains no .js or .jsx files');
}
