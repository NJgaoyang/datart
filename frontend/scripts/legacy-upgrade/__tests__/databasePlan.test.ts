import { buildDatabasePlan, DatabaseSnapshot } from '../databasePlan';

const currentWidget = {
  version: '1.0.0-RC.4',
  type: 'chart',
  originalType: 'ownedChart',
  pRect: { x: 3, y: 4, width: 18, height: 12 },
  customConfig: {
    props: [{ key: 'paddingGroup', rows: [{ key: 'padding', value: 9 }] }],
  },
};
const snapshot = (): DatabaseSnapshot => ({
  orgId: 'org-a',
  dashboards: [
    {
      id: 'board',
      name: '月报',
      config: JSON.stringify({
        type: 'auto',
        version: '1.0.0-RC.4',
        jsonConfig: { props: [] },
        layoutVersion: 2,
      }),
    },
  ],
  widgets: [
    {
      id: 'widget',
      dashboardId: 'board',
      config: JSON.stringify(currentWidget),
    },
  ],
  datacharts: [
    {
      id: 'chart',
      name: '当前图表',
      config: '{"chartConfig":{"datas":[]},"computedFields":[]}',
    },
  ],
});

it('does not change current reports, including charts saved without a version marker', () => {
  const source = snapshot(),
    original = structuredClone(source);
  expect(buildDatabasePlan(source)).toMatchObject({
    changes: [],
    issues: [],
    counts: { dashboards: 1, widgets: 1, datacharts: 1 },
  });
  expect(source).toEqual(original);
});

it('upgrades an old board while preserving current widgets and their saved positions and styles', () => {
  const source = snapshot();
  source.dashboards[0].config = JSON.stringify({
    type: 'auto',
    version: '1.0.0-RC.3',
    jsonConfig: { props: [] },
    layoutVersion: 2,
  });
  const plan = buildDatabasePlan(source);
  expect(plan.issues).toEqual([]);
  expect(plan.changes).toHaveLength(1);
  expect(plan.changes[0].table).toBe('dashboard');
  expect(JSON.parse(plan.changes[0].after).version).toBe('1.0.0-RC.4');
  expect(source.widgets[0].config).toBe(JSON.stringify(currentWidget));
});

it('upgrades legacy chart dimensions and produces only allowlisted config changes', () => {
  const source = snapshot();
  source.datacharts[0].config =
    '{"version":"1.0.0-alpha.3","chartConfig":{"datas":[{"key":"metrics","rows":[]},{"key":"deminsion","rows":[]}]},"computedFields":[]}';
  const plan = buildDatabasePlan(source);
  expect(plan.issues).toEqual([]);
  expect(plan.changes[0]).toMatchObject({
    table: 'datachart',
    id: 'chart',
    before: source.datacharts[0].config,
  });
  expect(
    JSON.parse(plan.changes[0].after).chartConfig.datas.map(
      section => section.key,
    ),
  ).toEqual(['dimension', 'metrics']);
});

it('reports broken configurations, future versions and orphaned widgets instead of planning a silent replacement', () => {
  const source = snapshot();
  source.dashboards[0].config = '{';
  source.datacharts[0].config = '{"version":"99.0.0"}';
  source.widgets.push({
    id: 'orphan',
    dashboardId: 'another-org-board',
    config: '{}',
  });
  const plan = buildDatabasePlan(source);
  expect(plan.issues).toHaveLength(3);
  expect(plan.changes).toEqual([]);
});

it('blocks future versions inside embedded charts even when the widget itself has the current version', () => {
  const source = snapshot();
  source.widgets[0].config = JSON.stringify({
    ...currentWidget,
    content: {
      dataChart: { config: { version: '99.0.0', chartConfig: { datas: [] } } },
    },
  });
  const result = buildDatabasePlan(source);
  expect(result.issues).toHaveLength(1);
  expect(result.changes).toEqual([]);
});
