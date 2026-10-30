import type { Locator, Page } from '@playwright/test';
import {
  test, expect, openDataset, UI_ORG_ID, UI_VIEW_ID, UI_VIEW_NAME,
  UI_SECOND_VIEW_NAME, UI_QUERY_ERROR, UI_SCRIPT, UI_SECOND_SCRIPT,
} from '../fixtures/dataset-ui';
import {
  captureDatasetScreenshot, expectNoPageOverflow,
  expectReadableThemeText, expectShortLabelUnclipped,
} from '../fixtures/dataset-ui-screenshot';

const preview = (page: Page) => page.getByRole('region', { name: '数据预览', exact: true });
const execute = (page: Page) => page.getByRole('button', { name: '执行', exact: true });
const saveButton = (page: Page) => page.locator('[aria-label="数据集编辑工具栏"]')
  .getByRole('button', { name: /保存$/ });

async function chooseOption(page: Page, control: Locator, label: string) {
  await control.click();
  const popup = page.locator('.ant-select-dropdown:visible').last();
  await popup.getByText(label, { exact: true }).last().click();
}

for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
  for (const uiTheme of ['light', 'dark'] as const) {
    test.describe(`${viewport.width}px ${uiTheme} dataset workspace`, () => {
      test.use({ viewport, uiTheme });

      test('real bundle executes and saves, with an accessible field panel and no page overflow', async ({ page, dataset }, testInfo) => {
        await openDataset(page);
        await expect(page.getByRole('combobox', { name: '数据源', exact: true })).toBeVisible();
        await expect(saveButton(page)).toBeDisabled();
        await expectNoPageOverflow(page);
        await execute(page).click();
        await expect(preview(page).getByText('示例城市 A', { exact: true })).toBeVisible();
        expect(dataset.queries).toHaveLength(1);
        expect(dataset.queries[0].script).toBe(UI_SCRIPT);
        await expect(page.locator('[aria-label="数据集编辑工具栏"] .ant-badge-status-text'))
          .toHaveText(/^\d{2}:\d{2}:\d{2}\.\d{2}$/);

        const fieldsButton = page.getByRole('button', { name: '数据模型', exact: true });
        await fieldsButton.focus();
        await page.keyboard.press('Enter');
        await expect(fieldsButton).toHaveAttribute('aria-pressed', 'true');
        await expect(page.getByRole('button', { name: /更新字段注释$/ })).toBeInViewport();
        await expect(page.getByRole('button', { name: '设置显示名: 成交金额', exact: true })).toBeVisible();
        await expectReadableThemeText(page.getByRole('heading', { name: '数据视图列表', exact: true }));
        await expectReadableThemeText(page.getByRole('heading', { name: '数据模型', exact: true }));
        await expectShortLabelUnclipped(
          preview(page).getByRole('columnheader').filter({ hasText: '城市' }).locator('.field-label-primary'),
          '城市',
        );
        await expectNoPageOverflow(page);
        const editor = await page.locator('.monaco-editor').first().boundingBox();
        expect(editor?.width || 0, 'The field panel must leave a usable SQL editor').toBeGreaterThan(240);
        if (uiTheme === 'dark') {
          await expect(page.locator('.monaco-editor.vs-dark').first()).toBeVisible();
        } else {
          await expect(page.locator('.monaco-editor.vs-dark')).toHaveCount(0);
        }

        const save = saveButton(page);
        await expect(save).toBeEnabled();
        await save.click();
        await expect.poll(() => dataset.saves.length).toBe(1);
        await expect(save).toBeDisabled();
        expect(dataset.saves[0].name).toBe(UI_VIEW_NAME);
        await captureDatasetScreenshot(page, testInfo, `dataset-${viewport.width}-${uiTheme}-fields`);
      });
    });
  }
}

test.describe('readonly dataset', () => {
  test.use({ uiRole: 'readonly', viewport: { width: 1366, height: 768 } });

  test('can preview saved SQL but cannot edit fields, type SQL, or save via shortcuts', async ({ page, dataset }, testInfo) => {
    await openDataset(page);
    await expect(saveButton(page)).toHaveCount(0);
    await expect(page.getByRole('button', { name: '更多操作', exact: true })).toHaveCount(0);
    await expect(page.getByRole('combobox', { name: '数据源', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(数据模型|变量配置|列权限)$/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /更新字段注释$/ })).toHaveCount(0);
    await execute(page).click();
    await expect(preview(page).getByText('示例城市 A', { exact: true })).toBeVisible();
    await expect(preview(page).locator('thead button')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^(设置显示名|类型与分类|更多字段操作):/ })).toHaveCount(0);

    // Exercise the Monaco command and the page-level hotkey after a preview
    // makes the normal editor Saveable. Hidden buttons alone are insufficient.
    await page.locator('.monaco-editor .view-lines').click();
    await page.keyboard.press('Control+End');
    await page.keyboard.type(' -- forbidden UI edit');
    await page.keyboard.press('Control+s');
    await execute(page).focus();
    await page.keyboard.press('Control+s');
    await execute(page).click();
    await expect.poll(() => dataset.queries.length).toBe(2);
    expect(dataset.queries[1].script).toBe(UI_SCRIPT);
    expect(dataset.saves).toHaveLength(0);
    await expect(page.locator('.ant-modal:visible')).toHaveCount(0);
    await expectNoPageOverflow(page);
    await captureDatasetScreenshot(page, testInfo, 'dataset-1366-readonly');
  });
});

test('SQL typed immediately before switching tabs stays with its original dataset', async ({ page, dataset }) => {
  await openDataset(page);
  await page.locator('.dataset-navigation').getByText(UI_SECOND_VIEW_NAME, { exact: true }).click();
  const firstTab = page.getByRole('tab').filter({ hasText: UI_VIEW_NAME });
  const secondTab = page.getByRole('tab').filter({ hasText: UI_SECOND_VIEW_NAME });
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(UI_SECOND_SCRIPT);
  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('rental_orders');
  const input = page.locator('.monaco-editor textarea.inputarea');
  await input.focus();
  await page.keyboard.press('Control+End');
  const suffix = ' -- immediate-tab-edit';

  // execCommand inserts through the focused browser input and Monaco's real
  // input handler. The subsequent native tab click happens in the SAME JS
  // task: no 200ms timer can fire between the edit and navigation. Separate
  // Playwright type/click awaits could accidentally let the old debounce pass.
  const edited = await secondTab.evaluate((tab, text) => {
    const textarea = document.querySelector<HTMLTextAreaElement>('.monaco-editor textarea.inputarea');
    if (!textarea || document.activeElement !== textarea) {
      throw new Error('The SQL input must own focus before the immediate tab switch.');
    }
    let inputEvents = 0;
    const onInput = () => { inputEvents += 1; };
    textarea.addEventListener('input', onInput);
    const inserted = document.execCommand('insertText', false, text);
    (tab as HTMLElement).click();
    textarea.removeEventListener('input', onInput);
    return { inserted, inputEvents };
  }, suffix);
  expect(edited.inserted, 'The browser must perform an actual text insertion').toBe(true);
  expect(edited.inputEvents, 'The edit must go through the real Monaco input path').toBeGreaterThan(0);
  await expect(secondTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(UI_SECOND_SCRIPT);
  await expect(page.locator('.monaco-editor .view-lines')).not.toContainText(suffix);
  await firstTab.click();
  await expect(firstTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.monaco-editor .view-lines')).toContainText(suffix);
  await execute(page).click();
  await expect.poll(() => dataset.queries.length).toBe(1);
  expect(dataset.queries[0].script).toBe(UI_SCRIPT + suffix);
  expect(dataset.saves).toHaveLength(0);
});

test('an empty SQL fragment keeps fields and a zero-row summary; errors can be retried', async ({ page, dataset }, testInfo) => {
  await openDataset(page);
  dataset.queryMode = 'empty';
  const input = page.locator('.monaco-editor textarea.inputarea');
  await input.focus();
  await page.keyboard.press('Control+Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Home');
  await page.keyboard.press('Control+Shift+End');
  await page.getByRole('button', { name: '执行片段', exact: true }).click();
  await expect.poll(() => dataset.queries.length).toBe(1);
  expect(dataset.queries[0].script).toBe(UI_SCRIPT.split('\n').slice(1).join('\n'));
  await expect(preview(page).locator('.ant-empty')).toBeVisible();
  await expect(preview(page).getByRole('columnheader').filter({ hasText: '城市' })).toBeVisible();
  await expect(preview(page).getByText('0 行 · 6 列', { exact: true })).toBeVisible();
  await expect(preview(page).getByText('运行后查看结果', { exact: true })).toHaveCount(0);
  await expect(saveButton(page)).toBeDisabled();
  await captureDatasetScreenshot(page, testInfo, 'dataset-empty-fragment');

  // Clear the selection so the error/retry path below executes the full SQL.
  await input.focus();
  await page.keyboard.press('Control+Home');
  await expect(execute(page)).toBeEnabled();
  dataset.queryMode = 'error';
  await execute(page).click();
  await expect(preview(page).getByText(UI_QUERY_ERROR, { exact: true })).toBeVisible();
  await expect(execute(page)).toBeEnabled();
  await expectNoPageOverflow(page);
  await captureDatasetScreenshot(page, testInfo, 'dataset-query-error');
  dataset.queryMode = 'normal';
  await execute(page).click();
  await expect(preview(page).getByText('示例城市 A', { exact: true })).toBeVisible();
  await expect(preview(page).getByText(UI_QUERY_ERROR, { exact: true })).toHaveCount(0);
});

test.describe('advanced settings in dark theme', () => {
  test.use({ uiTheme: 'dark' });
  test('advanced settings open by keyboard, preserve collapsed values and fit the dialog', async ({ page, dataset }, testInfo) => {
    await openDataset(page);
    await page.getByRole('button', { name: '更多操作', exact: true }).click();
    await page.getByRole('menuitem', { name: /详情设置$/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('名称', { exact: true })).toHaveValue(UI_VIEW_NAME);
    await expectReadableThemeText(dialog.getByRole('heading', { name: '基本信息', exact: true }));
    const advanced = dialog.getByRole('button', { name: /高级配置/ });
    await expect(advanced).toHaveAttribute('aria-expanded', 'false');
    await advanced.focus();
    await page.keyboard.press('Enter');
    await expect(advanced).toHaveAttribute('aria-expanded', 'true');
    const cache = dialog.getByRole('switch', { name: '缓存', exact: true });
    const expires = dialog.getByRole('spinbutton', { name: '有效期(秒)', exact: true });
    await expect(expires).toBeDisabled();
    await cache.click();
    await expect(expires).toBeEnabled();
    await expires.fill('180');
    await advanced.click();
    await expect(expires).not.toBeVisible();
    await advanced.click();
    await expect(expires).toHaveValue('180');
    await expectNoPageOverflow(page);
    const bounds = await dialog.boundingBox();
    const viewport = page.viewportSize()!;
    expect(bounds?.x).toBeGreaterThanOrEqual(0);
    expect((bounds?.x || 0) + (bounds?.width || 0)).toBeLessThanOrEqual(viewport.width);
    await captureDatasetScreenshot(page, testInfo, 'dataset-advanced-settings');
    expect(dataset.saves).toHaveLength(0);
  });
});

test.describe('JOIN builder', () => {
  test.use({ viewport: { width: 1366, height: 768 }, uiTheme: 'dark' });

  test('selects existing views and Chinese fields and opens the generated SQL preview', async ({ page, dataset }, testInfo) => {
    await page.goto(`/organizations/${UI_ORG_ID}/views/GENERATED-ui-fixture-join`);
    await page.getByRole('heading', { name: '视图关联', exact: true }).click();
    await expect(page.getByRole('heading', { name: '创建关联数据视图', exact: true })).toBeVisible();
    await expectReadableThemeText(page.getByRole('heading', { name: '创建关联数据视图', exact: true }));
    await chooseOption(page, page.getByLabel('数据视图 A', { exact: true }), UI_VIEW_NAME);
    await chooseOption(page, page.getByLabel('数据视图 B', { exact: true }), UI_SECOND_VIEW_NAME);
    const condition = page.getByRole('group', { name: '条件 1', exact: true });
    await chooseOption(page, condition.getByLabel('数据视图 A 的字段', { exact: true }), '城市');
    await chooseOption(page, condition.getByLabel('数据视图 B 的字段', { exact: true }), '城市');
    await page.getByRole('button', { name: /添加关联条件$/ }).click();
    await expect(page.getByRole('group', { name: '条件 2', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '移除条件 2', exact: true }).click();
    await expect(page.getByRole('group', { name: '条件 2', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /添加关联条件$/ })).toBeFocused();
    await expectNoPageOverflow(page);
    await captureDatasetScreenshot(page, testInfo, 'dataset-1366-dark-join');
    await page.getByRole('button', { name: '生成并预览 SQL', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: '数据视图 SQL 预览' });
    const generated = dialog.getByRole('textbox', { name: '生成的 SQL', exact: true });
    await expect(generated).toHaveValue(/INNER JOIN/);
    await expect(generated).toHaveAttribute('readonly', '');
    await expectNoPageOverflow(page);
    await captureDatasetScreenshot(page, testInfo, 'dataset-1366-dark-join-preview');
    expect(dataset.calls.filter(call => call.path === '/views/compose')).toHaveLength(1);
    expect(dataset.saves).toHaveLength(0);
  });
});

test.describe('empty and denied navigation', () => {
  test.describe('denied module', () => {
    test.use({ uiRole: 'none' });
    test('denied module does not expose the dataset editor', async ({ page, dataset }) => {
      // The module is disabled despite individual resource READ grants.
      // Exercise actual route/access code rather than injecting Redux state.
      await page.goto(`/organizations/${UI_ORG_ID}/views/${UI_VIEW_ID}`);
      await expect(page).toHaveURL(/\/404$/);
      await expect(page.locator('.monaco-editor')).toHaveCount(0);
      expect(dataset.queries).toHaveLength(0);
      expect(dataset.saves).toHaveLength(0);
    });
  });

  test.describe('no saved datasets', () => {
    test.use({ emptyViews: true, emptySchema: true });
    test('shows an empty workspace without crashing', async ({ page, dataset }, testInfo) => {
      await page.goto(`/organizations/${UI_ORG_ID}/views`);
      await expect(page.getByText('请在左侧列表选择数据视图', { exact: true })).toBeVisible();
      await expect(page.locator('.monaco-editor')).toHaveCount(0);
      await expectNoPageOverflow(page);
      await captureDatasetScreenshot(page, testInfo, 'dataset-empty-workspace');
      expect(dataset.queries).toHaveLength(0);
    });
  });
});
