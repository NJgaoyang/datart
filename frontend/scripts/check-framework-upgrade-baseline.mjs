/** Guard the required versions and compatibility pairs before CI attempts a build.
 * This checks the dependency intent, not the installed lock or runtime.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const major = (name, source = pkg.dependencies) => {
  const value = source[name];
  if (!value) throw Error('Missing dependency: ' + name);
  return Number(value.replace(/^[^0-9]*/, '').split('.')[0]);
};
const expected = [
  ['react', 19], ['react-dom', 19], ['antd', 6],
  ['@ant-design/icons', 6], ['echarts', 6], ['@reduxjs/toolkit', 2],
  ['@ant-design/pro-components', 3],
];
for (const [name, version] of expected) {
  if (major(name) !== version) throw Error(name + ' must use major ' + version);
}
for (const [name, version] of [
  ['vite', 8], ['@vitejs/plugin-react', 6], ['typescript', 5],
  ['vitest', 5], ['@vitest/coverage-v8', 5],
]) {
  if (major(name, pkg.devDependencies) !== version) {
    throw Error(name + ' must use major ' + version);
  }
}
if (pkg.dependencies.react !== pkg.dependencies['react-dom']) {
  throw Error('react and react-dom must have the same pinned version');
}
if (pkg.devDependencies.vitest !== pkg.devDependencies['@vitest/coverage-v8']) {
  throw Error('vitest and coverage-v8 must have the same pinned version');
}
console.log('Framework upgrade version pairs OK (manifest only).');
