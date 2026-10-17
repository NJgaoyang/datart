/**
 * Offline, opt-in JSON export migration for native dashboard layout v3.
 * Never called from the dashboard renderer. Run on backed-up exports only.
 *
 * Usage:
 *   node tools/grid-layout-migration.mjs --input export.json
 *   node tools/grid-layout-migration.mjs --input export.json --output converted.json --apply
 *   node tools/grid-layout-migration.mjs --rollback export.json.bak --output restored.json
 */
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = 3;
const DESKTOP_COLS = 72;
const MOBILE_COLS = 24;
const asVersion = (value) => Number.isInteger(Number(value)) && Number(value) >= 1
  ? Number(value) : 1;
const num = (v, fallback = 0) => Number.isFinite(Number(v)) ? Number(v) : fallback;
const rounded = (v, min = 0) => Math.max(min, Math.round(num(v)));
const scaleRect = (rect, from, to) => ({
  ...rect,
  x: rounded(num(rect.x) * to / from),
  y: rounded(rect.y),
  width: rounded(num(rect.width) * to / from, 1),
  height: rounded(rect.height, 1),
});
const scaleRows = (rect) => ({
  ...rect, y: rounded(num(rect.y) * 4), height: rounded(num(rect.height) * 4, 1),
});
const clampRect = (rect, cols) => ({
  ...rect,
  width: Math.min(cols, rounded(rect.width, 1)),
  height: rounded(rect.height, 1),
  x: Math.min(cols - Math.min(cols, rounded(rect.width, 1)), rounded(rect.x)),
  y: rounded(rect.y),
});
const unpack = (value, label) => {
  if (typeof value === 'string') {
    try { return [JSON.parse(value), true]; }
    catch { throw new Error(`Cannot parse ${label} as JSON`); }
  }
  if (!value || typeof value !== 'object') throw new Error(`Missing ${label}`);
  return [structuredClone(value), false];
};
const repack = (value, wasString) => wasString ? JSON.stringify(value) : value;
const intersects = (a, b) =>
  a.x < b.x + b.width && a.x + a.width > b.x &&
  a.y < b.y + b.height && a.y + a.height > b.y;

/** Convert one export; leaves all unrelated widget/chart/link data intact. */
export function migrateDashboardExport(source) {
  const doc = structuredClone(source);
  const dashboard = doc.dashboard || doc;
  const widgets = doc.widgets || dashboard.widgets;
  if (!Array.isArray(widgets)) throw new Error('Export must contain widgets[]');
  const [config, stringConfig] = unpack(dashboard.config, 'dashboard.config');
  const warnings = [];
  const changed = [];
  if (config.type && config.type !== 'auto') {
    return { output: doc, report: { changed: 0, warnings, skipped: 'free layout' } };
  }

  const desktopVersion = asVersion(config.layoutVersion);
  const mobileVersion = asVersion(config.mobileLayoutVersion);
  const rowVersion = asVersion(config.pcRowLayoutVersion);
  if ([desktopVersion, mobileVersion, rowVersion].some(v => v > VERSION)) {
    throw new Error('Unknown future layout version; refusing to downgrade');
  }

  widgets.forEach((widget, index) => {
    const [widgetConfig, wasString] = unpack(widget.config, `widgets[${index}].config`);
    const id = widget.id || `index:${index}`;
    let pc = widgetConfig.pRect;
    let mobile = widgetConfig.mRect;
    if (!pc && widgetConfig.rect) pc = widgetConfig.rect;
    if (!pc) {
      warnings.push(`${id}: missing pRect; cannot migrate safely`);
      return;
    }
    if (desktopVersion < 2) {
      // The v1 desktop grid had 12 columns; v2/v3 use 72.
      pc = scaleRect(pc, 12, DESKTOP_COLS);
      // Original v1 mobile coordinates used the same 12-column basis.
      mobile = scaleRect(mobile || widgetConfig.pRect || widgetConfig.rect, 12, MOBILE_COLS);
    } else if (mobileVersion < 2) {
      // The v2 desktop is already 72 columns but the old mobile grid had 6.
      mobile = mobile ? scaleRect(mobile, 6, MOBILE_COLS)
        : scaleRect(pc, DESKTOP_COLS, MOBILE_COLS);
    } else if (!mobile) {
      mobile = scaleRect(pc, DESKTOP_COLS, MOBILE_COLS);
    }

    if (rowVersion < 2) pc = scaleRows(pc);
    const rawPc = pc;
    const rawMobile = mobile;
    pc = clampRect(pc, DESKTOP_COLS);
    mobile = clampRect(mobile, MOBILE_COLS);
    if (JSON.stringify(rawPc) !== JSON.stringify(pc) ||
        JSON.stringify(rawMobile) !== JSON.stringify(mobile)) {
      warnings.push(`${id}: rectangle clamped to grid bounds`);
    }
    const before = { pRect: widgetConfig.pRect, mRect: widgetConfig.mRect };
    widgetConfig.pRect = pc;
    widgetConfig.mRect = mobile;
    if (JSON.stringify(before) !== JSON.stringify({ pRect: pc, mRect: mobile })) {
      changed.push({ id, before, after: { pRect: pc, mRect: mobile } });
    }
    widget.config = repack(widgetConfig, wasString);
  });

  // Rectangles are checked within each device independently. Existing
  // intentional overlaps require review rather than silent repositioning.
  for (const [key, label] of [['pRect', 'desktop'], ['mRect', 'mobile']]) {
    const placed = widgets.flatMap((widget, index) => {
      if (key === 'mRect') {
        const [cfg] = unpack(widget.config, `widgets[${index}].config`);
        if (cfg.mVisible === false) return [];
        if (cfg[key]) return [{ id: widget.id || `index:${index}`, rect: cfg[key] }];
        return [];
      }
      const [cfg] = unpack(widget.config, `widgets[${index}].config`);
      return cfg[key] ? [{ id: widget.id || `index:${index}`, rect: cfg[key] }] : [];
    });
    for (let i = 0; i < placed.length; i++) {
      for (let j = i + 1; j < placed.length; j++) {
        if (intersects(placed[i].rect, placed[j].rect)) {
          warnings.push(`${label}: ${placed[i].id} overlaps ${placed[j].id}`);
        }
      }
    }
  }

  config.layoutVersion = VERSION;
  config.mobileLayoutVersion = VERSION;
  config.pcRowLayoutVersion = VERSION;
  dashboard.config = repack(config, stringConfig);
  return {
    output: doc,
    report: {
      changed: changed.length,
      from: { layoutVersion: desktopVersion, mobileLayoutVersion: mobileVersion, pcRowLayoutVersion: rowVersion },
      to: VERSION,
      changes: changed,
      warnings,
    },
  };
}

function readArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--apply' || arg === '--accept-warnings') out[arg.slice(2)] = true;
    else if (arg === '--input' || arg === '--output' || arg === '--rollback') {
      if (!argv[i + 1]) throw new Error(`Missing value for ${arg}`);
      out[arg.slice(2)] = argv[++i];
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  return out;
}

export function runCli(argv) {
  const args = readArgs(argv);
  if (args.rollback) {
    if (!args.output) throw new Error('--rollback requires --output');
    const backup = resolve(args.rollback);
    const output = resolve(args.output);
    if (backup === output) throw new Error('Backup and destination must differ');
    if (existsSync(output)) throw new Error('Rollback destination exists; refusing to overwrite');
    copyFileSync(backup, output);
    return { restored: output };
  }
  if (!args.input) throw new Error('Expected --input JSON export');
  const input = resolve(args.input);
  const { output, report } = migrateDashboardExport(JSON.parse(readFileSync(input, 'utf8')));
  if (args.apply) {
    if (!args.output) throw new Error('--apply requires --output');
    const destination = resolve(args.output);
    if (destination === input || existsSync(destination)) {
      throw new Error('Destination must be a new path, different from input');
    }
    if (report.warnings.length && !args['accept-warnings']) {
      throw new Error('Migration has warnings; review preview or pass --accept-warnings');
    }
    const backup = input + '.bak';
    if (existsSync(backup)) throw new Error('Backup already exists; refusing to overwrite');
    copyFileSync(input, backup);
    writeFileSync(destination, JSON.stringify(output, null, 2) + '\n');
    return { ...report, backup, output: destination };
  }
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.stdout.write(JSON.stringify(runCli(process.argv.slice(2)), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(String(error.message) + '\n');
    process.exitCode = 1;
  }
}
