# Datart Grid Layout v2 - Development baseline (2026-10-17)

## Scope

This branch (`dev20261017`) starts from `dev202609232` and establishes React-Grid-Layout **2.2.4** as the new automatic dashboard layout engine.

- Use the native v2 `GridLayout`, `useContainerWidth`, configuration objects, and pluggable compactors.
- **Do not use** the `react-grid-layout/legacy` runtime layer, or introduce dual v1/v2 widget rendering paths.
- Use `LayoutItem` for an individual grid item, `Layout` for the complete layout, and `ResponsiveLayouts` for breakpoint maps.
- Treat `pRect` (desktop), `mRect` (mobile), and `rect` (free layout) as **new-system runtime domain data** for now. This is not a historical-data migration contract.
- Leave free dashboard interaction separate: it uses `react-draggable` and `react-resizable` rather than the automatic dashboard's grid engine.

## Interaction model

1. Let RGL v2 own drag motion, transforms, snapping, collision processing, and resize handles; do not write competing `element.style.transform` values.
2. During interaction, RGL holds the preview layout.
3. On drag/resize stop, compare positions and sizes; submit one `changeAutoBoardWidgetsRect` action only when a position changed.
4. Keep the existing `redux-undo` action boundary, so one completed gesture is one history step.
5. Compute the grid width from its actual content box via `useContainerWidth`; allow the existing row-height calculation to evolve separately.
6. When overlap is enabled, use `noOverlapCompactor`; otherwise use `verticalCompactor`. Explicitly test saved positioning and locking.

## Migration system (separate future project)

The new automatic-dashboard layout schema is explicitly marked as version **3** (desktop, mobile and row-layout versions). Historical dashboards must **not** be silently converted while using the new editor. A future migration system should have:

1. Source version detection and snapshot/backup.
2. Deterministic conversion of coordinates, columns, row heights, and mobile rules.
3. Preview/diff of resulting rectangles and collision/constraint validation.
4. An explicit one-time migration command, audit record, and rollback procedure.
5. Post-migration validation for nested widgets, filters, chart links, and saved dashboards.

The new layout engine should remain unaware of previous schema versions. Historical auto-layout conversion helpers have been removed from the new layout runtime; implement them later only inside the separate migration subsystem.

## Validation before production

- Run `cd frontend && npm ci --legacy-peer-deps` to verify the updated `package-lock.json` with RGL 2.2.4, then `npm run checkTs` and the frontend tests/build.
- Check 72-column desktop and 24-column mobile dashboards; editing, viewing, locking, overlap, groups, resize from every handle, and switching devices.
- Check dragging at browser zoom/DPI scales and varying container widths.
- Confirm undo/redo, save/reopen, filters, and chart interactions.
- Benchmark dense dashboards before enabling a fast compactor by default.

## Deliberately deferred

- Legacy dashboard import or automated compatibility conversion.
- Reimplementing the pixel-based free dashboard with a grid.
- Production rollout until an actual install, build, and regression tests are completed.

## Additional correctness changes

- The editor and viewer now use one `DashboardGridLayout` wrapper, which owns width observation and native RGL v2 settings.
- Geometry checks and reducers discard duplicate drag/resize results before writing an undo snapshot.
- New desktop widgets are placed below the occupied desktop geometry, even when the mobile editor was selected when they were added. The editor's temporary `boardInfo.layouts` is no longer used as the desktop placement source.
- New widget batches are packed left-to-right with explicit wrapping; this intentionally replaces the previous y-only insertion heuristic.

## Local validation commands

After pulling `dev20261017`:

```bash
git checkout dev20261017
git pull origin dev20261017
cd frontend
npm ci --legacy-peer-deps
npm run check:grid
npm run build
```

The new `check:grid` command runs the project's full TypeScript check followed by focused v2 layout tests. It does not replace browser verification: exercise adding charts in desktop and mobile editor modes, drag/resize handles, locked widgets, overlap, group widgets, undo/redo, save/reopen, and browser scaling.

No compatibility layer or automatic historical-data conversion is enabled. Existing dashboards from older versions must be migrated later through the dedicated migration service before production adoption.

## Compiler fixes from initial local verification (2026-10-17)

- The ordinary widget parsing pipeline no longer calls the removed `migrateAutoWidgetsLayout`. Historical grid geometry is left unchanged on read; it requires an explicit migration process before use in the new editor.
- The RGL v2 `useContainerWidth` ref is narrowed to the project's React 18 ref type for the host `div`; runtime behavior is unchanged.
- The Redux board-info state keeps a writable `LayoutItem[]`; RGL v2 `Layout` is readonly and must not be used for mutable Immer state.

These changes address the three TypeScript diagnostics reported for `npm run check:grid`. Re-run the command locally to confirm that compilation proceeds to the test stage.

## Container-width spacing and delete-query fixes (2026-10-17)

- Dashboard deletion reference checks normalize both storyboard identifiers to `utf8mb4_unicode_ci` after explicit conversion to `utf8mb4`. No database-wide collation rewrite is required for this targeted fix, but both Java and frontend deployments must be refreshed.
- The automatic grid scales configured pixel margins/padding based on the *measured grid container width*, so a narrow browser or split-pane editor has smaller visible gaps without rewriting saved grid-unit coordinates. Mobile preview retains its own dedicated spacing settings.
- New automatically laid-out dashboards default to 4px widget gutters and 8px canvas padding. Explicit user spacing settings are still respected on wide screens and proportionally reduced on narrow desktop containers.
- The old 769px desktop editor minimum width was removed so the container can actually shrink; on sub-768px widths, the active mobile layout is used and drag/resize updates write to `mRect`, not `pRect`.
- New untouched controller widgets receive compact desktop 18x6 and mobile 12x2 rectangles instead of the generic chart template 36x24; chart widgets and already customized controller rectangles are preserved.

## P0–P2 implementation and verification gate (2026-10-17)

- P0: an explicitly invoked offline migration tool under `tools/` transforms
  v1/v2 dashboard JSON exports to v3 with dry-run diffs, warnings, immutable
  backup, recorded SHA-256 audit and rollback. This does **not** silently
  transform or import a production dashboard, and it does not provide automatic
  legacy rendering on the new engine.
- P1: live gesture preview is owned by native RGL v2. Final layout commit is
  a single `changeAutoBoardWidgetsRect` action per changed drag/resize.
  `BoardInfo.layouts` is updated after commit instead of every preview
  frame. Desktop/mobile widget rectangles remain independent. Each widget
  receives a memoized React shell.
- P2: the dashboard settings now expose vertical/horizontal/no compaction
  plus a CSS grid-guide toggle. For read-only dashboards the browser can
  skip offscreen widget paint with `content-visibility:auto`; this keeps
  widget subscriptions mounted and is **not** React virtualization.
- `npm run bench:grid` runs a repeatable native-core CPU compaction benchmark
  at 100/500/1000 widgets; benchmark values are environment-specific and do
  not measure browser drag FPS. Record React/paint profiles with DevTools
  before claiming production-scale performance.
- GitHub Actions workflow `dashboard-grid-v2.yml` runs locked dependency
  installation, TypeScript, grid-specific tests, production frontend build,
  Java backend package, and offline migration tests. Browser acceptance
  still requires an actual Datart instance with real dashboards and database.
