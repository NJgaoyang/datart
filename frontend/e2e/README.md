# Dashboard UI browser acceptance (opt-in, no production dependency)

These tests need a **running, authorized test Datart instance** with a saved
dashboard containing charts and filter controllers. They are not a substitute
for security, load or accessibility audits.

```bash
cd frontend/e2e
npm install
npx playwright install chromium

# Obtain the login storage state on the test machine by signing in with a
# dedicated test account. Do not commit storage-state JSON or any credentials.
export DATART_TEST_BASE_URL=http://localhost:3000
export DATART_TEST_STORAGE_STATE=/private/path/test-account.json
export DATART_TEST_DASHBOARD_EDITOR_PATH=/organizations/<org>/vizs/<...>/boardEditor/<...>
npm test
```

Use your application's actual editor route for
`DATART_TEST_DASHBOARD_EDITOR_PATH`; the example is illustrative. If this
variable is absent the tests are skipped rather than trying to bypass login.

The checks click the center of the visible ellipsis SVG, verify the popup
appears, prove the date picker and action button do not overlap, and check
widget identity/geometry at 1920, 1366, 1024 and 768px. Failure screenshots
and traces stay in this isolated e2e directory.

Do not use production dashboards or accounts for destructive tests. This
suite deliberately does not drag, delete or save data. Add authenticated
staging-only drag/save/reopen tests once the test deployment is available.
