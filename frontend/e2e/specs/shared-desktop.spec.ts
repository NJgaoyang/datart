import { expect, test } from '@playwright/test';

const sharePath = process.env.DATART_TEST_SHARED_DASHBOARD_PATH;
test.describe('desktop share keeps existing desktop pRect presentation', () => {
  test.skip(!sharePath, 'Set DATART_TEST_SHARED_DASHBOARD_PATH for an authorized test dashboard');
  test('wider than 960px restores desktop layout after resizing from mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(sharePath!);
    await expect(page.locator('.datart-mobile-share')).toBeVisible();
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.datart-mobile-share')).toHaveCount(0);
    await expect(page.locator('.react-grid-layout').first()).toBeVisible();
    const width = await page.locator('.react-grid-layout').first().evaluate(el => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(0);
  });
});