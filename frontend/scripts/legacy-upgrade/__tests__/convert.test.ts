import { upgradeTemplate } from '../convert';

it('upgrades a chart template without changing IDs, data or files; conversion is repeatable', () => {
  const source = {
    type: 'datart.server.base.transfer.model.DatachartTemplateModel',
    formatVersion: 1,
    payload: {
      datachart: {
        id: 'chart',
        config: JSON.stringify({
          chartConfig: {
            datas: [
              { key: 'metrics', rows: [] },
              { key: 'deminsion', rows: [] },
            ],
          },
          computedFields: [],
        }),
        data: [[1, 'city']],
      },
      files: { logo: 'YWJj' },
    },
  };
  const converted = upgradeTemplate(source);
  expect(source.formatVersion).toBe(1);
  expect(converted.formatVersion).toBe(2);
  expect(converted.payload.datachart.id).toBe('chart');
  expect(converted.payload.datachart.data).toEqual(
    source.payload.datachart.data,
  );
  expect(converted.payload.files).toEqual(source.payload.files);
  expect(
    JSON.parse(converted.payload.datachart.config).chartConfig.datas.map(
      data => data.key,
    ),
  ).toEqual(['dimension', 'metrics']);
  expect(upgradeTemplate(converted)).toEqual(converted);
});

it('refuses damaged templates and resource packages', () => {
  expect(() =>
    upgradeTemplate({ dashboard: { config: '{' }, widgets: [] }),
  ).toThrow();
  expect(() =>
    upgradeTemplate({
      payload: { datachart: { config: '{}' } },
      type: 'OrganizationTransferModel',
    }),
  ).toThrow('不是报表模板');
});

it('rejects future versions without rewriting them as older formats', () => {
  expect(() => upgradeTemplate({ formatVersion: 3, payload: {} })).toThrow(
    '更新版本',
  );
  expect(() =>
    upgradeTemplate({ datachart: { config: '{"version":"99.0.0"}' } }),
  ).toThrow('未知配置版本');
});

it('preserves dashboard widgets, embedded data, relations and attachments through the upgrade', () => {
  const source = {
    type: 'datart.server.base.transfer.model.DashboardTemplateModel',
    payload: {
      dashboard: {
        id: 'board',
        config: JSON.stringify({
          type: 'auto',
          version: '1.0.0-RC.4',
          jsonConfig: { props: [] },
          layoutVersion: 3,
          mobileLayoutVersion: 3,
          pcRowLayoutVersion: 3,
        }),
      },
      widgets: [
        {
          id: 'widget',
          config: JSON.stringify({
            version: '1.0.0-RC.4',
            type: 'chart',
            originalType: 'ownedChart',
            pRect: { x: 1, y: 2, width: 12, height: 8 },
            customConfig: { props: [] },
            content: {
              dataChart: {
                config: { version: '1.0.0-RC.2', chartConfig: { datas: [] } },
                data: [[1, 'saved']],
              },
            },
          }),
          relations: [{ id: 'relation', config: '{"target":"widget"}' }],
        },
      ],
      files: { image: 'YXNk' },
    },
  };
  const upgraded = upgradeTemplate(source);
  expect(upgraded.payload.dashboard.id).toBe('board');
  expect(upgraded.payload.widgets).toEqual(source.payload.widgets);
  expect(upgraded.payload.files).toEqual(source.payload.files);
  expect(upgradeTemplate(upgraded)).toEqual(upgraded);
  expect(upgraded.payload).not.toHaveProperty('formatVersion');
  expect(upgraded.payload).not.toHaveProperty('packageType');
});

it('accepts early alpha configurations while refusing a mismatched template envelope', () => {
  const chart = {
    config:
      '{"version":"1.0.0-alpha.3","chartConfig":{"datas":[]},"computedFields":[]}',
  };
  expect(() => upgradeTemplate({ datachart: chart })).not.toThrow();
  expect(() =>
    upgradeTemplate({
      type: 'datart.server.base.transfer.model.DashboardTemplateModel',
      payload: { datachart: chart },
    }),
  ).toThrow('不是报表模板');
});
