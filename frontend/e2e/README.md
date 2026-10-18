# Datart dashboard browser acceptance

The suites intentionally separate **CI-safe smoke checks** from **authorized
real-data acceptance**. A build/test success does not imply mobile editing,
saving/reopening, or cross-browser behavior passed.

## 1. Production bundle smoke (no login, safe for CI)

The GitHub Actions dashboard-grid-v2 workflow builds the frontend, starts a
local Vite preview, and runs Chromium against `/login` and
`/shareDashboard.html`. This detects entry-chunk initialization crashes
(including the previous `admin-tools` TDZ white-screen regression).

```bash
cd frontend
npm ci --legacy-peer-deps
npm run build
npm run preview -- --host 127.0.0.1 --port 4173
# In another terminal:
cd frontend/e2e
npm ci
npx playwright install chromium
DATART_TEST_BASE_URL=http://127.0.0.1:4173 npx playwright test --project=chromium-smoke
```

Vite preview has **no Datart API backend**. These smoke tests verify browser
startup, not authentication, dataset queries or successful shared-data loading.

## 2. Actual mobile shared-dashboard acceptance (opt-in)

Use an authorized, non-production Datart test deployment and a share **you own
and are permitted to test**, containing widgets, a date filter, and ideally a
scrollable table. Set the path privately (never commit tokens or print them
into build logs):

```bash
cd frontend/e2e
npm ci
npx playwright install chromium
export DATART_TEST_BASE_URL=http://127.0.0.1:8080
export DATART_TEST_SHARED_DASHBOARD_PATH=/shareDashboard/<AUTHORIZED_TEST_SHARE_TOKEN>
npx playwright test --project=chromium-share-mobile --project=chromium-share-desktop
```

Mobile checks cover the **same saved 24-column mRect** at 320, 375, 430, 768,
900 and 960 CSS pixels, compare document/viewport widths, ensure shared
queries never use login-only data-provider endpoints, and open an existing date
filter when available. The desktop check verifies resize back to pRect above
960px. Missing date/table widgets are reported as **skipped**. No dashboard
coordinates or data are modified by these tests.

## Cross-browser authenticated share acceptance (opt-in)

The same read-only mobile share assertions can also run under Firefox and
WebKit. These projects are **not** part of the no-credentials CI smoke job,
and require the test deployment + authorized share path described above.
WebKit is the browser-engine check, not a substitute for a physical iPhone.

```bash
cd frontend/e2e
npx playwright install firefox webkit
npx playwright test   --project=firefox-share-mobile --project=firefox-share-desktop   --project=webkit-share-mobile --project=webkit-share-desktop
```

## 3. Authenticated dashboard editor acceptance (opt-in)

This requires a dedicated test account. Never use production login credentials
and never store browser auth state under a tracked directory.

```bash
export DATART_TEST_BASE_URL=http://127.0.0.1:8080
export DATART_TEST_STORAGE_STATE=/private/path/to/test-account-storage.json
export DATART_TEST_DASHBOARD_EDITOR_PATH=/organizations/<org>/vizs/<...>/boardEditor/<...>
npx playwright test --project=chromium-editor
```

Editor checks verify the visible widget actions SVG click, distinct filter
hit areas and widget identity/width across 1920/1366/1024/768px. They do not
modify the existing dashboard. Follow with **separate authorized manual or
isolated-fixture** drag/save/reopen tests before declaring those flows accepted.

## Privacy and reporting

- `e2e/.gitignore` excludes test artifacts, auth state and local packages.
- Traces and screenshots can contain business data and share URLs. Keep them
  local to the authorized test machine. Never upload auth-suite traces to a
  public CI artifact.
- If the required editor or share path is unset, tests explicitly skip rather
  than attempting to bypass authentication or invent test availability.
- Chromium is the initial baseline; Firefox, WebKit, physical touch devices,
  non-default DPR and genuine 100/500/1000-widget performance remain open.