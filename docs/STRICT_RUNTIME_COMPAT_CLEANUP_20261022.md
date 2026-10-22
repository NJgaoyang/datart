# Strict runtime compatibility cleanup — 2026-10-22

Branch: `dev202610221` (derived from `dev202610212`).

## Completed in this change

- Added an explicit STRICT gate in the live dashboard chart query entry
  (`getDataChartRequestParams`). A missing `migrationMode` is rejected,
  just like COMPAT, instead of allowing field-name fallback in the lower-level
  builder.
- Added focused tests for STRICT, COMPAT, undefined and invalid modes.
- **No UI, widget rectangles, grid sizing, schema or persisted resource data
  is modified.** Existing `bin/install-env.sh` remains intact.

## Retained intentionally (not obsolete compatibility shims)

- React 19 chart mounting/unmounting and iframe lifecycle adapters.
- Ant Design 6 Table and the RGL v2 editor/read-only grid implementation.
- Responsive/mobile layout and existing dashboard default-value helpers.
- `vite.config.ts` single-vendor chunk, `events` browser polyfill, CRA
  `PUBLIC_URL` alias, and share-page routing until browser and build smoke
  verification demonstrates a safe alternative. Removing the vendor split
  workaround has historically caused circular-initialization white screens.
- `frontend/scripts/legacy-upgrade/`, `tools/grid-layout-migration.mjs`,
  backend V1 resource import/readers, migration and readiness tooling. These
  are explicit *offline/import* capabilities rather than browser-side
  automatic migration.

## Still to audit before removal

1. **Other request builder callers.** `ChartDataRequestBuilder` still permits
   an absent mode because preview, share, download, drill-through and
   `frontend/src/task.ts` pass partial View payloads. First propagate a
   verified `migrationMode: 'STRICT'` from the server through each caller,
   add end-to-end tests for its path, then tighten the builder constructor.
   Do not simply remove that allowance yet.
2. **Chart display reconciliation.** `internalChartHelper.ts` has an
   originName/path/colName lookup for display metadata when a row has no
   `fieldId`. It currently avoids rebinding the saved `fieldId`; distinguish
   display-only lookup from query field identity before removing it.
3. **Controller field bindings.**
   `DashBoardPage/utils/index.ts::getTheWidgetFiltersAndParams` can construct
   a transient filter from a legacy field name. The controller's persisted
   related-view schema must be migrated to stable `fieldId` identities and
   regression tested before converting this path to strict-only. Do not break
   working controller linkage merely by swapping `fieldValue` for `fieldId`.
4. **Backend COMPAT enum.** `MigrationModeServiceImpl` already rejects any
   organization whose mode is not STRICT. `MigrationMode.COMPAT` is still a
   stored/schema/protocol identifier; remove it only after auditing historical
   SQL, DTOs and import workflows, not as an isolated enum deletion.
5. **Peer-dependency bridge.** The project uses `npm ci --legacy-peer-deps`
   for the React 19 / AntD 6 dependency graph. Investigate with `npm ls` and
   browser tests (particularly wordcloud, ProComponents, rich-text editor)
   before removing the flag or forcing versions.
6. **Build optimizations.** Measure the four Vite HTML entrypoints, circular
   dependency initialization, and real gzip/Brotli transfer sizes before
   changing `manualChunks`, `events`, or `PUBLIC_URL`.

## Verification

```bash
cd frontend
npm ci --legacy-peer-deps
npx vitest run src/app/utils/__tests__/strictChartView.test.ts
npm run check:upgrade-baseline
npm run checkTs
npm run test:grid
npm run build:all
npm ls --all
```

`npm ls --all` is a *diagnostic* that may report peer mismatches; do not
silence its output with a forced package override. On an environment with
historical resources, verify share/chart preview, data exports, filters,
drill-through, and the original automatic-dashboard UI before rolling out.

The stricter dashboard gate assumes the backend is sending `migrationMode`
with each live View, as required by the STRICT-only API contract. Missing
metadata now fails explicitly rather than producing an ambiguous query.
