import { test as base, expect, type Page } from '@playwright/test';
import { captureDatasetScreenshot } from './dataset-ui-screenshot';

// These records are invented UI fixtures. No account, API, database, source
// configuration or business record is copied from an actual deployment.
export const UI_ORG_ID = 'ui-fixture-org';
export const UI_VIEW_ID = 'ui-fixture-orders';
export const UI_SECOND_VIEW_ID = 'ui-fixture-cities';
export const UI_SOURCE_ID = 'ui-fixture-source';
export const UI_VIEW_NAME = '演示租赁交易数据（合成）';
export const UI_SECOND_VIEW_NAME = '演示城市信息（合成）';
export const UI_HOME_FOLDER_ID = 'ui-fixture-home-folder';
export const UI_HOME_FOLDER_NAME = '演示资源目录（合成）';
export const UI_QUERY_ERROR = '演示查询失败：请检查筛选条件后重试';
export const UI_VIEW_PATH = `/organizations/${UI_ORG_ID}/views/${UI_VIEW_ID}`;
export const UI_SCRIPT = [
  '-- UI acceptance fixture: synthetic records only',
  'SELECT city, amount, order_count, rental_days, payment_date, remark',
  'FROM demo.rental_orders',
  'ORDER BY payment_date DESC',
].join('\n');
export const UI_SECOND_SCRIPT = 'SELECT city FROM demo.city_labels';

type UiRole = 'manager' | 'readonly' | 'none';
type QueryMode = 'normal' | 'empty' | 'error';
type JsonObject = Record<string, unknown>;

type Field = {
  fieldId: string;
  originName: string;
  type: 'STRING' | 'NUMERIC' | 'DATE';
  sourcePath: string[];
  sourceComment: string | null;
  customName: string | null;
  displayName: string;
  active: boolean;
};

const definitions = [
  ['city', 'STRING', '城市', null],
  ['amount', 'NUMERIC', '订单实付金额，单位：元；仅用于合成界面验收', '成交金额'],
  ['order_count', 'NUMERIC', '订单数量', null],
  ['rental_days', 'NUMERIC', '租赁天数，包含续租天数；以自然日计算', null],
  ['payment_date', 'DATE', '支付日期', null],
  ['remark', 'STRING', null, null],
] as const;

const makeFields = (): Field[] => definitions.map(([originName, type, sourceComment, customName]) => ({
  fieldId: `ui-field-${originName}`,
  originName,
  type,
  sourcePath: ['demo', 'rental_orders', originName],
  sourceComment,
  customName,
  displayName: customName || sourceComment || originName,
  active: true,
}));

function modelFor(fields: Field[]) {
  const meta = (field: Field) => ({
    fieldId: field.fieldId,
    type: field.type,
    category: 'UNCATEGORIZED',
    sourceComment: field.sourceComment,
    comment: field.sourceComment,
    customName: field.customName,
    displayName: field.displayName,
  });
  return {
    version: '1.0.0-RC.4',
    columns: Object.fromEntries(fields.map(field => [field.originName, {
      ...meta(field), name: [field.originName],
    }])),
    hierarchy: Object.fromEntries(fields.map((field, index) => [field.originName, {
      ...meta(field), name: field.originName, path: [field.originName], index,
    }])),
  };
}

const user = {
  id: 'ui-fixture-user', username: 'ui-fixture-user', name: '界面验收用户',
  email: 'ui-fixture@example.invalid', avatar: '', description: 'Synthetic UI fixture',
};
const organization = {
  id: UI_ORG_ID, name: '界面验收组织（合成）', description: '', avatar: '', migrationMode: 'STRICT',
};
const userSetting = {
  id: 'ui-fixture-setting', userId: user.id,
  relId: UI_ORG_ID, relType: 'LAST_VISITED_ORGANIZATION', config: null,
};

function makeView(id: string, name: string, fields: Field[]) {
  return {
    id, name, orgId: UI_ORG_ID, parentId: null, index: 0,
    isFolder: false, sourceId: UI_SOURCE_ID, status: 1, type: 'SQL',
    description: 'All names and results on this page are synthetic.',
    script: UI_SCRIPT,
    model: JSON.stringify(modelFor(fields)),
    config: JSON.stringify({
      version: '1.0.0-RC.4', concurrencyControl: true,
      concurrencyControlMode: 'DIRTYREAD', cache: false, cacheExpires: 60,
      expensiveQuery: false,
    }),
    fields, variables: [], relVariableSubjects: [], relSubjectColumns: [],
  };
}

function permissions(role: UiRole) {
  const privilege = (resourceType: string, resourceId: string, permission: number) => ({
    orgId: UI_ORG_ID, subjectId: user.id, subjectType: 'USER',
    resourceType, resourceId, permission,
  });
  const level = role === 'manager' ? 6 : 2;
  return {
    orgId: UI_ORG_ID, subjectId: user.id, subjectType: 'USER', orgOwner: false,
    permissionInfos: [
      privilege('VIEW', '*', role === 'none' ? 0 : 1),
      privilege('VIEW', 'VIEW', role === 'manager' ? 134 : level),
      privilege('VIEW', UI_VIEW_ID, level),
      privilege('VIEW', UI_SECOND_VIEW_ID, level),
      privilege('SOURCE', '*', 1), privilege('SOURCE', UI_SOURCE_ID, 2),
      privilege('VIZ', '*', 1),
      privilege('VIZ', UI_HOME_FOLDER_ID, 2),
    ],
    hideInNav: [],
  };
}

export type DatasetUiFixture = {
  queryMode: QueryMode;
  queries: JsonObject[];
  saves: JsonObject[];
  calls: Array<{ method: string; path: string }>;
  unexpectedRequests: string[];
  runtimeErrors: string[];
};

type Options = {
  uiTheme: 'light' | 'dark';
  uiRole: UiRole;
  emptyViews: boolean;
  emptySchema: boolean;
};

export const test = base.extend<Options & { dataset: DatasetUiFixture }>({
  uiTheme: ['light', { option: true }],
  uiRole: ['manager', { option: true }],
  emptyViews: [false, { option: true }],
  emptySchema: [false, { option: true }],
  dataset: async ({ page, baseURL, uiTheme, uiRole, emptyViews, emptySchema }, use, testInfo) => {
    if (!baseURL) throw new Error('The local preview baseURL is required.');
    const origin = new URL(baseURL).origin;
    const state: DatasetUiFixture = {
      queryMode: 'normal', queries: [], saves: [], calls: [],
      unexpectedRequests: [], runtimeErrors: [],
    };
    page.on('pageerror', error => state.runtimeErrors.push(error.message));
    let fields = makeFields();
    let view = makeView(UI_VIEW_ID, UI_VIEW_NAME, fields);
    const secondView = {
      ...makeView(UI_SECOND_VIEW_ID, UI_SECOND_VIEW_NAME, [{
        ...fields[0], fieldId: 'ui-city-field-city', sourcePath: ['demo', 'city_labels', 'city'],
      }]),
      script: UI_SECOND_SCRIPT,
    };
    await page.context().clearCookies();
    await page.context().addCookies([{
      name: 'AUTHORIZATION_TOKEN', value: 'synthetic-ui-fixture-only', url: origin,
    }]);
    await page.addInitScript(({ fixtureUser, theme }) => {
      localStorage.setItem('LOGGED_IN_USER', JSON.stringify(fixtureUser));
      localStorage.setItem('LOCALE', 'zh');
      localStorage.setItem('THEME', theme);
    }, { fixtureUser: user, theme: uiTheme });

    // All API traffic is answered here; unlisted endpoints fail the test.
    // External HTTP requests are blocked, including accidental plugin URLs.
    await page.context().route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      if (url.origin !== origin) {
        state.unexpectedRequests.push(`External ${request.method()} ${url.origin}${url.pathname}`);
        return route.abort('blockedbyclient');
      }
      if (!url.pathname.startsWith('/api/')) return route.continue();
      const path = url.pathname.replace(/^\/api\/v1/, '');
      const method = request.method();
      state.calls.push({ method, path });
      const respond = (data: unknown, status = 200) => route.fulfill({
        status, contentType: 'application/json',
        body: JSON.stringify({ success: status < 400, data }),
      });
      const payload = (): JsonObject => request.postDataJSON() as JsonObject;

      if (method === 'GET') {
        if (path === '/sys/info') return respond({
          initialized: true, mailEnable: false, registerEnable: false,
          tenantManagementMode: 'MULTIPLE', tokenTimeout: '60', version: 'UI fixture',
        });
        if (path === '/settings/user') return respond([userSetting]);
        if (path === '/orgs') return respond([organization]);
        if (path === '/roles/permission/subject') return respond(permissions(uiRole));
        if (path === '/data-provider/providers') return respond([{ type: 'JDBC', name: 'JDBC' }]);
        if (path === '/plugins/custom/charts' || path === '/download/tasks' ||
            path === `/orgs/${UI_ORG_ID}/roles` || path === '/variables/org' ||
            path === '/views/archived' || path === '/viz/storyboards') return respond([]);
        if (path === '/viz/folders') return respond([{
          id: UI_HOME_FOLDER_ID, name: UI_HOME_FOLDER_NAME, orgId: UI_ORG_ID,
          parentId: null, relId: '', relType: 'FOLDER', index: 0, status: 1,
          createBy: user.id, updateBy: user.id,
          createTime: '2026-10-30T08:00:00', updateTime: '2026-10-30T08:00:00',
        }]);
        if (path === `/orgs/${UI_ORG_ID}/members`) return respond([user]);
        if (path === '/views') return respond(emptyViews ? [] : [view, secondView]);
        if (path === `/views/${UI_VIEW_ID}`) return respond(view);
        if (path === `/views/${UI_SECOND_VIEW_ID}`) return respond(secondView);
        if (path === '/sources') return respond([{
          id: UI_SOURCE_ID, orgId: UI_ORG_ID, name: '演示数据源 · 华东租赁分析（合成）',
          type: 'JDBC', config: '{}', parentId: null, index: 0, isFolder: false, status: 1,
        }]);
        if (path === `/sources/schemas/${UI_SOURCE_ID}`) return respond({
          schemaItems: emptySchema ? [] : [{
            dbName: 'demo', tables: [{
              tableName: 'rental_orders', primaryKeys: [],
              columns: fields.map(field => ({
                name: field.sourcePath, type: field.type, comment: field.sourceComment,
                fmt: '', foreignKeys: [],
              })),
            }],
          }],
        });
      }

      // Opening a direct organization URL updates this preference even when
      // its value is already unchanged. This is intentionally mocked too.
      if (method === 'PUT' && path === `/settings/user/${userSetting.id}`) return respond(userSetting);
      if (method === 'POST' && path.startsWith('/data-provider/execute/cancel/')) return respond(true);
      if (method === 'POST' && path === '/data-provider/execute/test') {
        state.queries.push(payload());
        if (state.queryMode === 'error') return route.fulfill({
          status: 500, contentType: 'application/json',
          body: JSON.stringify({ success: false, message: UI_QUERY_ERROR }),
        });
        return respond({
          columns: fields.map(field => ({ name: [field.originName], type: field.type })),
          rows: state.queryMode === 'empty' ? [] : [
            ['示例城市 A', 1280.5, 24, 12, '2026-10-28', '合成记录：含续租'],
            ['示例城市 B', 986.0, 18, 8, '2026-10-27', '合成记录：标准租赁'],
            ['示例城市 C', 2080.0, 31, 16, '2026-10-26', null],
          ],
          pageInfo: { pageNo: 1, pageSize: 1000, total: state.queryMode === 'empty' ? 0 : 3 },
          previewFields: fields.map(({ fieldId, ...field }) => field),
        });
      }
      if (method === 'PUT' && path === `/views/${UI_VIEW_ID}`) {
        const body = payload();
        state.saves.push(body);
        if (uiRole !== 'manager') return respond(null, 403);
        view = {
          ...view,
          name: typeof body.name === 'string' ? body.name : view.name,
          script: typeof body.script === 'string' ? body.script : view.script,
          model: typeof body.model === 'string' ? body.model : view.model,
          config: typeof body.config === 'string' ? body.config : view.config,
          fields,
        };
        return respond(view);
      }
      if (method === 'POST' && path === '/views/check/name') return respond(true);
      if (method === 'POST' && path === `/views/${UI_VIEW_ID}/fields/refresh`) {
        if (uiRole !== 'manager') return respond(null, 403);
        return respond({ ...view, fields });
      }
      if (method === 'PATCH' && path.startsWith(`/views/${UI_VIEW_ID}/fields/`)) {
        if (uiRole !== 'manager') return respond(null, 403);
        const fieldId = path.split('/').at(-1);
        const body = payload();
        const customName = typeof body.customName === 'string' ? body.customName : null;
        fields = fields.map(field => field.fieldId === fieldId ? {
          ...field, customName,
          displayName: customName || field.sourceComment || field.originName,
        } : field);
        view = { ...view, fields };
        return respond(fields.find(field => field.fieldId === fieldId));
      }
      if (method === 'POST' && path === '/views/compose') return respond({
        sourceId: UI_SOURCE_ID,
        script: 'SELECT a.city, a.amount FROM demo.rental_orders a\nINNER JOIN demo.city_labels b ON a.city = b.city',
        config: JSON.stringify({ version: '1.0.0-RC.4' }),
      });

      state.unexpectedRequests.push(`${method} ${path}`);
      return route.fulfill({ status: 501, contentType: 'application/json', body: JSON.stringify({
        success: false, message: `No synthetic fixture for ${method} ${path}`,
      }) });
    });

    await use(state);
    if (!page.isClosed() && (
      testInfo.status !== testInfo.expectedStatus ||
      state.unexpectedRequests.length > 0 || state.runtimeErrors.length > 0
    )) {
      try {
        await captureDatasetScreenshot(page, testInfo, 'failed-state');
      } catch (error) {
        console.log('DATASET_UI_SCREENSHOT_FAILED ' + String(error));
      }
    }
    await testInfo.attach('synthetic-api-observations', {
      body: Buffer.from(JSON.stringify({
        calls: state.calls, unexpectedRequests: state.unexpectedRequests,
        runtimeErrors: state.runtimeErrors, queryCount: state.queries.length, saveCount: state.saves.length,
      }, null, 2)),
      contentType: 'application/json',
    });
    expect(state.unexpectedRequests, 'Every API must be mocked and external network must remain unused').toEqual([]);
    expect(state.runtimeErrors, 'The actual application bundle must render without runtime crashes').toEqual([]);
  },
});

export { expect };

export async function openDataset(page: Page) {
  await page.goto(UI_VIEW_PATH, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: '执行', exact: true })).toBeVisible();
  await expect(page.locator('.monaco-editor').first()).toBeVisible();
  await expect(page.locator('.monaco-editor .view-lines')).toContainText('rental_orders');
}
