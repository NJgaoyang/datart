import { expect, test } from '@playwright/test';

const sharePath = process.env.DATART_TEST_SHARED_DASHBOARD_PATH;

test.describe('authorized shared dashboard uses one responsive mRect layout', () => {
  test.skip(!sharePath, 'Set DATART_TEST_SHARED_DASHBOARD_PATH for a dedicated, authorized test share');

  test('mobile layouts at 320–960px never turn into a wide desktop canvas', async ({ page }) => {
    const exceptions: string[] = [];
    const wrongQueryPaths: string[] = [];
    const failingApiStatuses: number[] = [];
    page.on('pageerror', e => exceptions.push(e.message));
    page.on('response', response => {
      if (new URL(response.url()).pathname.includes('/api/') && response.status() >= 400) {
        failingApiStatuses.push(response.status());
      }
    });
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (/\/data-provider\/execute(\/|$)/.test(path)) wrongQueryPaths.push(path);
    });

    await page.goto(sharePath!, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.datart-mobile-share')).toBeVisible();
    await expect(page.locator('.datart-mobile-share .mobile-widget').first()).toBeVisible();

    for (const width of [320, 375, 430, 768, 900, 960]) {
      await page.setViewportSize({ width, height: 760 });
      await expect(page.locator('.datart-mobile-share')).toBeVisible();
      const metrics = await page.evaluate(() => ({
        pageWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        mobileWidth: document.querySelector('.datart-mobile-share')?.getBoundingClientRect().width || 0,
      }));
      expect(metrics.pageWidth, `unexpected page-level overflow at ${width}px`).toBeLessThanOrEqual(width + 2);
      expect(metrics.mobileWidth).toBeGreaterThan(0);
      expect(metrics.mobileWidth).toBeLessThanOrEqual(width + 2);
      await page.screenshot({ path: test.info().outputPath(`share-mobile-${width}.png`) });
    }

    expect(wrongQueryPaths, 'shared widgets should never use login-only query endpoints').toEqual([]);
    expect(exceptions).toEqual([]);
    expect(failingApiStatuses, 'shared data API calls should not fail').toEqual([]);
  });

  test('mobile page does not steal the table horizontal scroll from the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto(sharePath!);
    await expect(page.locator('.datart-mobile-share .mobile-widget').first()).toBeVisible();

    const table = page.locator('.datart-mobile-share .ant-table-body').first();
    if ((await table.count()) === 0) {
      test.skip(true, 'Test share has no scrollable data table; validate another share separately');
    }
    const sizes = await table.evaluate(el => ({
      scrollWidth: el.scrollWidth,
      clientWidth: el.clientWidth,
    }));
    expect(sizes.clientWidth).toBeGreaterThan(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(377);
    if (sizes.scrollWidth > sizes.clientWidth + 5) {
      await table.evaluate(el => { el.scrollLeft = 64; });
      expect(await table.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
    } else {
      test.skip(true, 'Test table fits the phone viewport; no horizontal scroll to exercise');
    }
  });

  test('date range popover opens and remains interactive on narrow mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 760 });
    await page.goto(sharePath!);
    await expect(page.locator('.datart-mobile-share .mobile-widget').first()).toBeVisible();

    const picker = page.locator('.datart-mobile-share .ant-picker').first();
    if (!(await picker.count())) {
      test.skip(true, 'No date picker in this share; use the test dashboard containing rangeTime');
    }
    await picker.click();
    await expect(page.locator('.ant-picker-dropdown:visible').first()).toBeVisible();
    await page.keyboard.press('Escape');
  });
});
