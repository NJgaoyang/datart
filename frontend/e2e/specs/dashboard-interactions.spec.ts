import { expect, test } from '@playwright/test';

const editorPath = process.env.DATART_TEST_DASHBOARD_EDITOR_PATH;

test.describe('authenticated dashboard editor responsive interaction acceptance', () => {
  test.skip(!editorPath, 'Set DATART_TEST_DASHBOARD_EDITOR_PATH to an authorized test dashboard editor URL');

  test.beforeEach(async ({ page }) => {
    await page.goto(editorPath!);
    await expect(page.locator('.react-grid-layout').first()).toBeVisible();
  });

  test('the visible ellipsis icon is inside its pointer hit area', async ({ page }) => {
    const button = page.getByRole('button', { name: 'Widget actions' }).first();
    await expect(button).toBeVisible();
    const outer = await button.boundingBox();
    const symbol = await button.locator('svg').first().boundingBox();
    expect(outer).not.toBeNull();
    expect(symbol).not.toBeNull();
    if (!outer || !symbol) return;

    const center = { x: symbol.x + symbol.width / 2, y: symbol.y + symbol.height / 2 };
    expect(center.x).toBeGreaterThanOrEqual(outer.x);
    expect(center.x).toBeLessThanOrEqual(outer.x + outer.width);
    expect(center.y).toBeGreaterThanOrEqual(outer.y);
    expect(center.y).toBeLessThanOrEqual(outer.y + outer.height);

    // Click the VISUAL icon, not a guessed coordinate beside it.
    await page.mouse.click(center.x, center.y);
    await expect(page.getByRole('menu').first()).toBeVisible();
  });

  for (const width of [1920, 1366, 1024, 768]) {
    test(`editor keeps its desktop widget identities at viewport width ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      const ids = page.locator('[data-dashboard-widget-id]');
      const before = await ids.evaluateAll(items => items.map(item => item.getAttribute('data-dashboard-widget-id')));
      expect(before.length).toBeGreaterThan(0);
      const grid = page.locator('.react-grid-layout').first();
      await expect(grid).toBeVisible();
      const after = await ids.evaluateAll(items => items.map(item => item.getAttribute('data-dashboard-widget-id')));
      expect(after).toEqual(before);

      // Layout has a real nonzero width; no collapsed or ghost grid.
      const rect = await grid.boundingBox();
      expect(rect?.width || 0).toBeGreaterThan(0);
      await page.screenshot({ path: test.info().outputPath(`dashboard-${width}.png`) });
    });
  }

  test('controls and actions do not share the same pointer target', async ({ page }) => {
    const controller = page.locator('.controller-widget').first();
    await expect(controller).toBeVisible();
    const actions = controller.getByRole('button', { name: 'Widget actions' });
    const picker = controller.locator('.ant-picker, .ant-select').first();
    await expect(actions).toBeVisible();
    await expect(picker).toBeVisible();
    const actionBox = await actions.boundingBox();
    const inputBox = await picker.boundingBox();
    expect(actionBox).not.toBeNull();
    expect(inputBox).not.toBeNull();
    if (!actionBox || !inputBox) return;
    const overlapW = Math.min(actionBox.x + actionBox.width, inputBox.x + inputBox.width)
      - Math.max(actionBox.x, inputBox.x);
    const overlapH = Math.min(actionBox.y + actionBox.height, inputBox.y + inputBox.height)
      - Math.max(actionBox.y, inputBox.y);
    expect(overlapW <= 0 || overlapH <= 0).toBe(true);
  });
});
