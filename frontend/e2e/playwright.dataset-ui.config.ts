import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'node:url';

// An isolated production-bundle test: this config never reads account storage
// or shares credentials/configuration with the opt-in real-instance suites.
const baseURL = 'http://127.0.0.1:4173';

export default defineConfig({
  testDir: './specs',
  testMatch: 'dataset-desktop-ui.spec.ts',
  outputDir: './test-results/dataset-ui',
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report/dataset-ui' }]],
  webServer: {
    command: './node_modules/.bin/vite preview --host 127.0.0.1 --port 4173 --strictPort',
    cwd: fileURLToPath(new URL('..', import.meta.url)),
    url: `${baseURL}/login`,
    reuseExistingServer: false,
    timeout: 60_000,
  },
  use: {
    ...devices['Desktop Chrome'],
    baseURL,
    locale: 'zh-CN',
    timezoneId: 'Asia/Shanghai',
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium-dataset-ui' }],
});
