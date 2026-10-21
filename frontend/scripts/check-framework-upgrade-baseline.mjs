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
  ['react', 19],
  ['react-dom', 19],
  ['antd', 6],
  ['@ant-design/icons', 6],
  ['echarts', 6],
  ['@reduxjs/toolkit', 2],
  ['@ant-design/pro-components', 3],
];
for (const [name, version] of expected) {
  if (major(name) !== version) throw Error(name + ' must use major ' + version);
}
for (const [name, version] of [
  ['vite', 8],
  ['@vitejs/plugin-react', 6],
  ['typescript', 5],
  ['vitest', 5],
  ['@vitest/coverage-v8', 5],
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

// Historical converters belong to the offline tool, never the browser bundle.
const { readdirSync } = await import('node:fs');
const ts = (await import('typescript')).default;
const removedProps = new Set([
  'overlay',
  'overlayClassName',
  'overlayStyle',
  'destroyPopupOnHide',
  'destroyTooltipOnHide',
  'destroyInactiveTabPane',
  'destroyInactivePanel',
  'destroyOnClose',
  'dropdownMatchSelectWidth',
  'dropdownRender',
  'onAfterChange',
  'expandIconPosition',
  'dropdownStyle',
  'bodyStyle',
  'maskClosable',
  'operations',
  'wrapperClassName',
  'onDropdownVisibleChange',
  'onVisibleChange',
  'tabPosition',
]);
function checkSource(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') checkSource(path);
      continue;
    }
    if (!/\.tsx?$/.test(entry.name)) continue;
    const source = readFileSync(path, 'utf8');
    if (/\b(?:isDisplayNameCustom|LEGACY_AUTO_LAYOUT_VERSION|LEGACY_PC_ROW_LAYOUT_VERSION)\b/.test(source))
      throw Error('Historical field or layout metadata belongs to the offline tool: ' + path);
    if (/declare module ['"]react-redux['"]/.test(source))
      throw Error('Use typed Redux hooks instead of global overloads: ' + path);
    const file = ts.createSourceFile(
      path,
      source,
      ts.ScriptTarget.Latest,
      true,
    );
    function visit(node) {
      if (
        ts.isImportDeclaration(node) &&
        /(?:Compat\/|react-monaco-editor|react-resize-detector|app\/migration|legacy-upgrade)/.test(
          node.moduleSpecifier.text,
        )
      ) {
        throw Error(
          'Runtime imports a removed adapter or historical converter: ' + path,
        );
      }
      if (ts.isJsxAttribute(node) && removedProps.has(node.name.text)) {
        throw Error('Removed UI property ' + node.name.text + ': ' + path);
      }
      if (
        (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
        /^(Menu\.(Item|SubMenu|Divider|ItemGroup)|Select\.(Option|OptGroup)|Collapse\.Panel|TabPane)$/.test(
          node.tagName.getText(file),
        )
      ) {
        throw Error('Removed JSX children API: ' + path);
      }
      ts.forEachChild(node, visit);
    }
    visit(file);
    if (/ant-tabs-(content-holder|tabpane)/.test(source)) {
      throw Error('Removed Tabs DOM selector: ' + path);
    }
  }
}
if (pkg.dependencies['react-monaco-editor'])
  throw Error('Use the native Monaco editor API');
if (pkg.devDependencies['react-test-renderer'] || pkg.devDependencies['@types/react-test-renderer'])
  throw Error('Use Testing Library instead of the removed test renderer');
for (const name of ['@types/react', '@types/react-dom']) {
  if (major(name, pkg.devDependencies) !== 19)
    throw Error(name + ' must use React 19 types');
  if (pkg.resolutions?.[name] && major(name, pkg.resolutions) !== 19)
    throw Error(name + ' resolution must use React 19 types');
}
checkSource(join(root, 'src'));
console.log('Runtime uses native UI APIs and excludes historical converters.');
