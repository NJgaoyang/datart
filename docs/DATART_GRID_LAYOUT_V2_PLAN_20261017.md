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

Historical dashboards must **not** be silently converted while using the new editor. A future migration system should have:

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
