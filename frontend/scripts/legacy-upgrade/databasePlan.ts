import { isDeepStrictEqual } from 'node:util';
import { APP_CURRENT_VERSION } from 'app/configVersion';
import { upgradeTemplate } from './convert';
import { APP_SEMANTIC_VERSIONS } from './migrations/constants';

export type ResourceRow = {
  id: string;
  name?: string;
  config: string;
  dashboardId?: string;
};
export type DatabaseSnapshot = {
  orgId: string;
  dashboards: ResourceRow[];
  widgets: ResourceRow[];
  datacharts: ResourceRow[];
};
export type ConfigChange = {
  table: 'dashboard' | 'widget' | 'datachart';
  id: string;
  name: string;
  before: string;
  after: string;
};

function object(value: unknown): any {
  const result = typeof value === 'string' ? JSON.parse(value) : value;
  if (!result || typeof result !== 'object' || Array.isArray(result))
    throw new Error('配置不是有效的 JSON 对象');
  return result;
}

function chartNeedsUpgrade(config: any): boolean {
  config = object(config);
  if (
    config.version &&
    !APP_SEMANTIC_VERSIONS.includes(config.version) &&
    !/^1\.0\.0-alpha\.\d+$/.test(config.version)
  )
    throw new Error('图表配置版本未知，不能自动升级：' + config.version);
  if (
    config.version &&
    !['1.0.0-RC.2', APP_CURRENT_VERSION].includes(config.version)
  )
    return true;
  if (config.computedFields?.some(field => !field.name && field.id))
    return true;
  const fields = [
    ...(config.computedFields ?? []),
    ...(config.chartConfig?.datas ?? []).flatMap(section => section.rows ?? []),
  ];
  return (
    (config.chartConfig?.datas ?? []).some(section =>
      ['deminsion', 'deminsionL', 'deminsionR'].includes(section.key),
    ) ||
    fields.some(
      field =>
        field.category === 'dateLevelComputedField' &&
        !(field.colName ?? field.name ?? '').includes('@date_level_delimiter@'),
    )
  );
}

function widgetNeedsUpgrade(row: ResourceRow) {
  const config = object(row.config);
  if (typeof config.type !== 'string') throw new Error('缺少组件类型');
  const chart = config.content?.dataChart?.config;
  return (
    config.version !== APP_CURRENT_VERSION ||
    (chart && (typeof chart === 'string' || chartNeedsUpgrade(chart)))
  );
}

/** Only configuration columns are planned. Current reports and saved positions remain untouched. */
export function buildDatabasePlan(snapshot: DatabaseSnapshot) {
  const changes: ConfigChange[] = [];
  const issues: { type: string; id: string; name: string; message: string }[] =
    [];
  const add = (
    table: ConfigChange['table'],
    row: ResourceRow,
    after: string,
  ) => {
    if (!isDeepStrictEqual(object(row.config), object(after)))
      changes.push({
        table,
        id: row.id,
        name: row.name || row.id,
        before: row.config,
        after,
      });
  };
  const ids = new Set(snapshot.dashboards.map(board => board.id));
  for (const widget of snapshot.widgets) {
    if (!ids.has(widget.dashboardId!))
      issues.push({
        type: 'widget',
        id: widget.id,
        name: widget.id,
        message: '组件所属报表不在当前组织中',
      });
  }
  for (const board of snapshot.dashboards) {
    try {
      const config = object(board.config);
      if (!['auto', 'free'].includes(config.type))
        throw new Error('报表布局类型无效');
      if (config.jsonConfig && !Array.isArray(config.jsonConfig.props))
        throw new Error('报表配置项结构无效');
      const widgets = snapshot.widgets.filter(
        widget => widget.dashboardId === board.id,
      );
      const updateBoard =
        config.version !== APP_CURRENT_VERSION || !config.jsonConfig;
      const upgradeIds = new Set(
        widgets.filter(widgetNeedsUpgrade).map(widget => widget.id),
      );
      if (!updateBoard && !upgradeIds.size) continue;
      const result = upgradeTemplate({ dashboard: { ...board }, widgets });
      const pending: ConfigChange[] = [];
      if (
        updateBoard &&
        !isDeepStrictEqual(config, object(result.dashboard.config))
      )
        pending.push({
          table: 'dashboard',
          id: board.id,
          name: board.name || board.id,
          before: board.config,
          after: result.dashboard.config,
        });
      for (const widget of result.widgets) {
        const original = widgets.find(row => row.id === widget.id)!;
        if (!upgradeIds.has(widget.id)) continue;
        if (widgetNeedsUpgrade(widget))
          throw new Error('部分组件转换后仍不符合当前格式，请人工核查');
        if (!isDeepStrictEqual(object(original.config), object(widget.config)))
          pending.push({
            table: 'widget',
            id: widget.id,
            name: `${board.name || board.id} / ${widget.id}`,
            before: original.config,
            after: widget.config,
          });
      }
      changes.push(...pending);
    } catch (error) {
      issues.push({
        type: 'dashboard',
        id: board.id,
        name: board.name || board.id,
        message: (error as Error).message,
      });
    }
  }
  for (const chart of snapshot.datacharts) {
    try {
      if (!chartNeedsUpgrade(chart.config)) continue;
      const converted = upgradeTemplate({ datachart: { ...chart } }).datachart;
      if (chartNeedsUpgrade(converted.config))
        throw new Error('图表转换后仍不符合当前格式，请人工核查');
      add('datachart', chart, converted.config);
    } catch (error) {
      issues.push({
        type: 'datachart',
        id: chart.id,
        name: chart.name || chart.id,
        message: (error as Error).message,
      });
    }
  }
  return {
    formatVersion: 1,
    orgId: snapshot.orgId,
    counts: {
      dashboards: snapshot.dashboards.length,
      widgets: snapshot.widgets.length,
      datacharts: snapshot.datacharts.length,
    },
    changes,
    issues,
  };
}
