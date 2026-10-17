# Historical automatic-grid migration (offline, explicit)

This is a **separate migration tool**, not a compatibility hook in the RGL v2
renderer. The new runtime uses **version 3** grid coordinates only.

## Input

Export a single dashboard JSON with `dashboard.config` and `widgets[]`, or
a dashboard object with `config` and `widgets[]`. Widget configs and dashboard
config may each be JSON strings (as Datart's API supplies) or JSON objects.
Include **all** layout widgets and their configs in the exported JSON.

## Commands

```bash
# Read-only: prints a coordinate diff and any overlap/geometry warnings.
node tools/grid-layout-migration.mjs --input dashboard-export.json

# Write an independent converted export and immutable .bak copy.
node tools/grid-layout-migration.mjs --input dashboard-export.json --output dashboard-v3.json --apply

# Only after reviewing reported overlap/geometry warnings:
node tools/grid-layout-migration.mjs --input dashboard-export.json --output dashboard-v3.json --apply --accept-warnings

# Restore a backup into a NEW file, never overwrite the export.
node tools/grid-layout-migration.mjs --rollback dashboard-export.json.bak --output restored.json

# Focused offline verification (requires Node 18+).
node --test tools/grid-layout-migration.test.mjs
```

This tool **does not write to the Datart database or call the API**.
The converted export must be imported by an explicitly authorized deployment
process. Do not point production dashboards at legacy geometry without
migrating, and **do not copy v3 records over production data without a database
backup, explicit acceptance and environment-level validation**.

## Conversion rules

- Version 1 desktop: scale 12 columns to 72.
- Version 2 desktop: already uses 72 columns; unchanged.
- Version 1 mobile with version 1 desktop: the legacy 12-column basis is
  converted to 24 columns.
- Version 1 mobile with version 2 desktop: scale 6 columns to 24.
- Version 2 mobile: already 24 columns; unchanged.
- Version 1 PC row units: multiply y/height by 4 (32px to 8px units).
- Version 2 PC row units: already 8px; unchanged.
- Clamp invalid out-of-bounds positions and report that change.
- Report potential desktop/mobile widget overlaps for review. Free layouts
  pass through unchanged.

Versions above v3 are rejected. Re-running on an already-v3 export leaves
geometry unchanged. Everything unrelated to pRect/mRect or layout version is
preserved. This intentionally does not guess how legacy nested group pixel
coordinates should migrate; inspect group widgets before importing.

## Acceptance

On a staging system: export/backup, preview changes, validate collision
warnings, migrate, import, open editor, drag/resize, save/reopen, check desktop
and mobile, verify links/filters/group widgets, and practice a restore.
