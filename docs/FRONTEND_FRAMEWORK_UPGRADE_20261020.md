# Frontend major dependency migration — dev202610202 (2026-10-20)

This is a **migration commit**, not a claim that the result has built or passed browser verification.

## Requested version targets
- React / React DOM **19.3.1**, matching `@types/react` / `@types/react-dom` 19.x.
- ECharts **6.1.0**. Custom theme and saved chart options must be checked.
- Vite **8.3.4** / `@vitejs/plugin-react` **6.1.2**; migrate the styled-components Babel pass to `@rolldown/plugin-babel`.
- TypeScript **5.9.3**, retaining current TS config.
- Ant Design **6.6.5** and icons **6.3.4**.
- Redux Toolkit **2.13.0**.
- Necessary companion changes: Vitest/coverage **5.0.5**, React Testing Library 16, Node **>=22.12.0**.
- `@ant-design/pro-components` **3.1.15-3** is an npm **beta** tag (v2 has incompatible antd 4/5 peer dependency). Verify its usage and behavior before production.

## Install, lock, and validation

The original lockfile belongs to the previous major versions. Do **not** use the old
`package-lock.json` with these changed dependencies or report `npm ci` as passed.
A GitHub Actions workflow on this branch generates and commits the new lockfile on
push (if the repo permits Actions to write). If it doesn't run, do this on an
authorized machine with npm registry access:

```sh
cd frontend
node --version                 # >=22.12
npm install --package-lock-only --legacy-peer-deps
npm ci --legacy-peer-deps
npm run check:upgrade-baseline
npm run checkTs
npm run test:grid
npm run test:bundle-budget
npm run build:all
npm run check:bundle-budget
git add package-lock.json
git commit -m "build(frontend): lock upgraded React Vite ECharts and AntD graph"
```

`--legacy-peer-deps` is a temporary bridge for older ecosystem dependencies,
**not proof of peer dependency compatibility**. Review `npm ls` and installed
pairs before production. Do not globally add `overrides` to force a broken API.

## Required focused browser acceptance

- Four entrypoints: login, shareChart, shareDashboard, shareStoryPlayer; no TDZ / blank page.
- AntD 6: Table, Form.List submissions, Tabs, Dropdown, DatePicker, Drawer, ProComponents.
- React 19: mount/unmount, drag/drop, undo/redo, dashboard save/reopen, modal portals.
- ECharts 6: saved bar/line/pie/map charts, tooltips, legends, drill/selection,
  export, chart resize during grid dragging.
- **Known risk:** `echarts-wordcloud@2.x` only advertises ECharts 5 as its peer.
  Test word-cloud registration/render/export; replace or adapt the extension if broken.
- Vite 8 Rolldown: `vendor` isolation, four entrypoints, manifest, CSS,
  `public/task/parser.js` and gzip size relative to the 2.80 MB login baseline.
- Test targeted components first, run the browser smoke once on a built artifact.

## Scope
No backend version, public endpoint, SQL schema or persisted dashboard geometry is
intentionally modified. Keep prior `dev20261020` untouched.
