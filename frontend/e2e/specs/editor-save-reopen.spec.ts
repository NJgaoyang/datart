import { expect, test } from '@playwright/test';

// Destructive tests are opt-in on an isolated, dedicated test dashboard.
// They must NEVER be run against a user's existing production dashboard.
const editor = process.env.DATART_TEST_DASHBOARD_EDITOR_PATH;
const auth = process.env.DATART_TEST_STORAGE_STATE;
const allowMutation = process.env.DATART_TEST_ALLOW_EDITOR_MUTATION === 'true';

test.describe('authenticated isolated dashboard drag / failure / retry / reopen', () => {
  test.skip(!editor || !auth || !allowMutation,
    'Requires a dedicated disposable editor path, authenticated state, and explicit mutation consent');

  test('drag persists after a failed save, retry, and reopen', async ({ page }) => {
    await page.setViewportSize({ width: 1366, height: 900 });
    await page.goto(editor!);
    const widget = page.locator('[data-dashboard-widget-id]').first();
    await expect(widget).toBeVisible();
    const widgetId = await widget.getAttribute('data-dashboard-widget-id');
    expect(widgetId).toBeTruthy();

    // Drag the native RGL v2 handle, not the chart surface/filter control.
    const handle = widget.locator('.widget-draggableHandle').first();
    await expect(handle).toBeVisible();
    const first = await widget.boundingBox();
    const grip = await handle.boundingBox();
    expect(first).toBeTruthy();
    expect(grip).toBeTruthy();
    if (!first || !grip) return;

    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2);
    await page.mouse.down();
    await page.mouse.move(grip.x + grip.width / 2 + 100, grip.y + grip.height / 2 + 130, { steps: 12 });
    await page.mouse.up();
    await expect.poll(async () => {
      const next = await widget.boundingBox();
      return next ? Math.abs(next.x - first.x) + Math.abs(next.y - first.y) : 0;
    }).toBeGreaterThan(10);

    const dragged = await widget.boundingBox();
    expect(dragged).not.toBeNull();

    let blockedSave = false;
    await page.route('**/api/v1/viz/dashboards/**', async route => {
      if (!blockedSave && ['PUT', 'POST', 'PATCH'].includes(route.request().method())) {
        blockedSave = true;
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, errCode: 500, message: 'test only' }),
        });
      } else {
        await route.continue();
      }
    });

    await page.getByRole('button', { name: /保存/ }).last().click();
    await expect(page.getByRole('status')).toContainText('保存失败');
    expect(blockedSave, 'the first save should have been intercepted').toBe(true);
    await expect(widget).toBeVisible();

    await page.getByRole('button', { name: '重试保存' }).click();
    await expect(page).not.toHaveURL(editor!);
    await page.unrouteAll({ behavior: 'wait' });
    await page.goto(editor!);
    // Ensure original widget identity survived server round-trip.
    await expect(page.locator('[data-dashboard-widget-id="' + widgetId + '"]')).toBeVisible();
    const after = await page.locator('[data-dashboard-widget-id="' + widgetId + '"]').boundingBox();
    expect(after).not.toBeNull();
    expect(Math.abs(after!.x - dragged!.x) + Math.abs(after!.y - dragged!.y))
      .toBeLessThan(12);
  });
});