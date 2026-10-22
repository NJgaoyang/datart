import { expect, test } from '@playwright/test';

const sharePath = process.env.DATART_TEST_SHARED_DASHBOARD_PATH;
test.describe('desktop share keeps existing desktop pRect presentation', () => {
  test.skip(
    !sharePath,
    'Set DATART_TEST_SHARED_DASHBOARD_PATH for an authorized test dashboard',
  );
  test('wider than 960px restores desktop layout after resizing from mobile', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto(sharePath!);
    await expect(page.locator('.datart-mobile-share')).toBeVisible();
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('.datart-mobile-share')).toHaveCount(0);
    await expect(page.locator('.react-grid-layout').first()).toBeVisible();
    const width = await page
      .locator('.react-grid-layout')
      .first()
      .evaluate(el => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(0);
  });

  test('tabbed charts retain measurable content after switching tabs', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1600, height: 1000 });
    await page.goto(sharePath!);
    await expect(page.locator('.react-grid-layout').first()).toBeVisible();
    const groups = page.locator('.TabsBoxWrap');
    const groupCount = await groups.count();
    test.skip(
      groupCount === 0,
      'Use a dedicated share containing tabbed charts',
    );
    for (let groupIndex = 0; groupIndex < groupCount; groupIndex++) {
      const tabs = groups.nth(groupIndex);
      const buttons = tabs.getByRole('tab');
      const count = await buttons.count();
      for (let index = 0; index < count; index++) {
        await buttons.nth(index).click();
        const panel = tabs.getByRole('tabpanel');
        await expect(panel).toBeVisible();
        await expect
          .poll(() => panel.evaluate(el => el.clientHeight))
          .toBeGreaterThan(1);
        const chart = panel.locator('.chart-drill-menu-container').first();
        await expect(chart).toBeVisible();
        await expect
          .poll(() => chart.evaluate(el => el.clientHeight))
          .toBeGreaterThan(1);
        await expect(
          panel.getByText('图表容器尚未完成布局，请检查仪表板图表尺寸'),
        ).toHaveCount(0);
      }
    }
  });
});
