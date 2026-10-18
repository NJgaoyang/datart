import { defineConfig, devices } from '@playwright/test';

const storageState = process.env.DATART_TEST_STORAGE_STATE;

// Smoke is CI-safe on a local production build: no account or credentials.
// Editor/shared-business scenarios opt in to a dedicated authorized test
// instance, and must not expose storageState or share tokens to CI artifacts.
export default defineConfig({
  testDir: './specs',
  timeout: 45_000,
  expect: { timeout: 12_000 },
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: process.env.DATART_TEST_BASE_URL || 'http://localhost:3000',
    ...(storageState ? { storageState } : {}),
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium-smoke',
      testMatch: /bundle-entry-smoke\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-editor',
      testMatch: /dashboard-interactions\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'chromium-share-mobile',
      testMatch: /shared-mobile\.spec\.ts/,
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'chromium-share-desktop',
      testMatch: /shared-desktop\.spec\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});