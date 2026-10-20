/**
 * Mechanical React 19 / Ant Design 6 source migration.
 * Idempotent: only converts syntactic patterns known to have changed.
 * Runs with TypeScript AST so unrelated props and string literals are untouched.
 */
import ts from 'typescript';
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
let fileCount = 0;
const skip = new Set(['node_modules', 'build']);

function walk(dir) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { if (!skip.has(e.name)) walk(join(dir, e.name)); continue; }
    if (!/\.tsx?$/.test(e.name)) continue;
    transform(join(dir, e.name));
  }
}

function transform(path) {
  const text = readFileSync(path, 'utf8');
  const sf = ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true,
    path.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const edits = [];
  const push = (start, end, replacement) => edits.push({start, end, replacement});
  const has = (attrs, name) => attrs?.properties?.some(a => ts.isJsxAttribute(a) && a.name.text === name);
  let dropdownConverted = false;

  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) &&
        node.expression.text === 'useRef' && node.arguments.length === 0) {
      // React 19 useRef requires an initial argument.
      push(node.end - 1, node.end - 1, 'undefined');
    }

    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf);
      if (tag === 'Dropdown' && has(node.attributes, 'overlay')) {
        push(node.tagName.getStart(sf), node.tagName.end, 'LegacyDropdown');
        dropdownConverted = true;
      }
      if (tag === 'Popover' || tag === 'Tooltip') {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)) continue;
          const n = attr.name.text;
          const replacements = {
            visible: 'open',
            onVisibleChange: 'onOpenChange',
            destroyTooltipOnHide: 'destroyOnHidden',
            destroyPopupOnHide: 'destroyOnHidden',
          };
          if (replacements[n]) {
            push(attr.name.getStart(sf), attr.name.end, replacements[n]);
          }
          if ((n === 'overlayClassName' || n === 'overlayStyle') && attr.initializer) {
            const initial = attr.initializer.getText(sf);
            const expr = initial.startsWith('{') ? initial.slice(1, -1) : initial;
            const target = n === 'overlayClassName' ? 'classNames' : 'styles';
            push(attr.getStart(sf), attr.end, target + '={{ root: ' + expr + ' }}');
          }
        }
      }
      if (tag === 'Collapse') {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.text !== 'expandIconPosition') continue;
          push(attr.name.getStart(sf), attr.name.end, 'expandIconPlacement');
          if (attr.initializer && ts.isStringLiteral(attr.initializer)) {
            const val=attr.initializer.text;
            if (val==='right'||val==='left') push(attr.initializer.getStart(sf),attr.initializer.end,
              val==='right' ? '"end"' : '"start"');
          }
        }
      }
      if (tag === 'Slider') {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr) || attr.name.text !== 'tooltipVisible' || !attr.initializer) continue;
          const v=attr.initializer.getText(sf);
          push(attr.getStart(sf), attr.end,
            'tooltip={{ open: ' + (v.startsWith('{') ? v.slice(1,-1) : v) + ' }}');
        }
      }
      // react-dnd connector functions return ReactNode, not void, so they can't
      // be passed directly as callback refs under React 19.
      if (/ChartDraggable|DropHolder|WidgetDndHandleMask/.test(path)) {
        for (const attr of node.attributes.properties) {
          if (!ts.isJsxAttribute(attr)|| attr.name.text!=='ref' ||
              !attr.initializer || !ts.isJsxExpression(attr.initializer)) continue;
          const e=attr.initializer.expression;
          if (e && ts.isIdentifier(e) && /^(drag|drop|preview|dragPreview|dragSource|dropTarget)$/.test(e.text)) {
            push(attr.initializer.getStart(sf),attr.initializer.end,
              '{node => { ' + e.text + '(node); }}');
          }
        }
      }
    }

    if (ts.isJsxClosingElement(node) && node.tagName.getText(sf) === 'Dropdown') {
      // Tag-pair conversion only if its opening element contains overlay.
      const parent=node.parent;
      if (ts.isJsxElement(parent) && has(parent.openingElement.attributes,'overlay')) {
        push(node.tagName.getStart(sf), node.tagName.end, 'LegacyDropdown');
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(sf);

  if (dropdownConverted && !text.includes("import LegacyDropdown from")) {
    push(0,0,"import LegacyDropdown from 'app/components/Compat/LegacyDropdown';\n");
  }
  // The old global Jest declaration is no longer accepted by installed matcher types.
  // Keep the runtime matcher, and type its usage structurally at each TS test.
  if (text.includes('.toBeDatartChartModel()')) {
    for (const m of text.matchAll(/expect\(([^()]+)\)\.toBeDatartChartModel\(\)/g)) {
      push(m.index,m.index+m[0].length,
        '(expect(' + m[1] + ') as unknown as { toBeDatartChartModel(): void }).toBeDatartChartModel()');
    }
  }

  // Use the supported public ProComponents v3 monolithic entry.
  if (text.includes("'@ant-design/pro-table'")) {
    const needle="'@ant-design/pro-table'";
    let index=text.indexOf(needle);
    while(index>=0) {
      push(index,index+needle.length,"'@ant-design/pro-components'");
      index=text.indexOf(needle,index+needle.length);
    }
  }

  // rc-field-form is no longer a direct dependency of AntD 6; reference the
  // form rules through the public antd FormItemProps declaration instead.
  const legacy = /import\s*\{\s*(NamePath|Rule)\s*\}\s*from\s*'rc-field-form\/lib\/interface';?/g;
  for (const match of text.matchAll(legacy)) {
    const name=match[1];
    push(match.index, match.index+match[0].length,
      (text.includes('FormItemProps') ? '' : "import type { FormItemProps } from 'antd';\n") + 'type ' + name + ' = ' +
      (name==='NamePath' ? 'NonNullable<FormItemProps[\'name\']>' : 'NonNullable<FormItemProps[\'rules\']>[number]') + ';');
  }
  if (text.includes('React.ReactChild')) {
    for (const m of text.matchAll(/React\.ReactChild\b/g)) push(m.index,m.index+m[0].length,'React.ReactNode');
  }
  if (text.includes('RefObject<HTMLDivElement>')) {
    for (const m of text.matchAll(/RefObject<HTMLDivElement>/g))
      push(m.index,m.index+m[0].length,'RefObject<HTMLDivElement | null>');
  }
  if (text.includes('RefObject<T>') && /useClientRect\.ts$/.test(path)) {
    for (const m of text.matchAll(/RefObject<T>/g)) push(m.index,m.index+m[0].length,'RefObject<T | null>');
  }
  if (edits.length === 0) return;
  edits.sort((a,b)=>b.start-a.start || b.end-a.end);
  let out=text, limit=text.length+1;
  for (const e of edits) {
    if (e.end > limit) throw Error('Overlapping edits in '+path);
    out=out.slice(0,e.start)+e.replacement+out.slice(e.end);
    limit=e.start;
  }
  writeFileSync(path,out);
  fileCount++;
}
walk(root);
console.log('React19/AntD6 mechanical migration updated',fileCount,'files');
