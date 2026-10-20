import { expect, test } from '@playwright/test';

const fatalRuntimeError = (message: string) =>
  /Cannot access .+ before initialization|ReferenceError:.*(initialization|undefined)|ChunkLoadError|Failed to fetch dynamically imported module/i.test(message);

test.describe('built entry points do not crash on first navigation', () => {
  for (const route of ['/login', '/shareDashboard.html']) {
    test(`production entry ${route} starts without a JS initialization crash`, async ({ page }) => {
      const runtimeErrors: string[] = [];
      const applicationScripts: string[] = [];
      page.on('pageerror', error => runtimeErrors.push(error.message));
      page.on('request', request => {
        if (/\/static\/js\/[^/]+\.js/.test(request.url())) {
          applicationScripts.push(request.url());
        }
      });

      const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
      expect(response?.status()).toBe(200);
      await expect(page.locator('#root')).toBeAttached();
      // Wait for the module entrypoint to execute, not only the HTML shell.
      await page.waitForFunction(() =>
        [...document.scripts].some(script =>
          /\/static\/js\/(main|shareDashboard)\.[^/]+\.js/.test(script.src)),
      );
      await page.waitForTimeout(900);
      expect(runtimeErrors.filter(fatalRuntimeError)).toEqual([]);
      expect(applicationScripts.some(url => /\/admin-tools\./.test(url))).toBe(false);
      if (route === '/login') {
        await expect(page.locator('body')).not.toBeEmpty();
        expect((await page.locator('body').innerText()).trim().length).toBeGreaterThan(25);
      }
    });
  }
});