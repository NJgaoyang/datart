import { migrateBoardConfig } from './migrations/BoardConfig/migrateBoardConfig';
import { migrateWidgets } from './migrations/BoardConfig/migrateWidgets';
import migrateWidgetConfig from './migrations/BoardConfig/migrateWidgetConfig';
import migrateWidgetChartConfig from './migrations/BoardConfig/migrateWidgetChartConfig';
import migrateChartConfig from './migrations/ChartConfig/migrateChartConfig';
import { migrateChartConfig as upgradeDimensions } from './migrations';
import { APP_SEMANTIC_VERSIONS } from './migrations/constants';

const objectConfig = (value: unknown, name: string) => {
  const config = typeof value === 'string' ? JSON.parse(value) : value;
  if (!config || typeof config !== 'object' || Array.isArray(config)) {
    throw new Error(`${name} 必须是有效的配置对象`);
  }
  const version = (config as { version?: string }).version;
  if (
    version &&
    !APP_SEMANTIC_VERSIONS.includes(version) &&
    !/^1\.0\.0-alpha\.\d+$/.test(version)
  )
    throw new Error(`${name} 使用未知配置版本：${version}`);
  return config as Record<string, any>;
};

/** Upgrade a copy, keeping IDs, embedded data, filters, relations and files. */
export function upgradeTemplate(source: any) {
  const result = structuredClone(source);
  if (!result || typeof result !== 'object') throw new Error('无效的模板文件');
  if (result.formatVersion && result.formatVersion > 2)
    throw new Error('不支持更新版本的模板文件');
  const payload = result.payload ?? result;
  if (Boolean(payload.dashboard) === Boolean(payload.datachart))
    throw new Error('模板必须且只能包含一种报表');
  if (
    result.payload &&
    result.type !==
      `datart.server.base.transfer.model.${
        payload.dashboard ? 'DashboardTemplateModel' : 'DatachartTemplateModel'
      }`
  )
    throw new Error('文件不是报表模板');
  const upgradeChart = (chart: any) => {
    const config = objectConfig(chart.config, '图表');
    chart.config = JSON.stringify(
      upgradeDimensions(JSON.parse(migrateChartConfig(JSON.stringify(config)))),
    );
  };
  if (payload.dashboard) {
    const config = objectConfig(payload.dashboard.config, '仪表板');
    if (
      !['auto', 'free'].includes(config.type) ||
      !Array.isArray(payload.widgets)
    ) {
      throw new Error('模板缺少仪表板类型或组件列表');
    }
    const boardConfig = migrateBoardConfig(JSON.stringify(config));
    const original = payload.widgets;
    const parsed = original.map((widget: any) => {
      const config = objectConfig(widget.config, '组件');
      const chart = config.content?.dataChart?.config;
      if (chart) objectConfig(chart, '内嵌图表');
      return { ...widget, config: JSON.stringify(config) };
    });
    const widgets = migrateWidgetChartConfig(
      migrateWidgetConfig(migrateWidgets(parsed, boardConfig.type)),
    );
    if (widgets.length !== original.length)
      throw new Error('存在无法转换的组件，已停止输出以防丢失');
    payload.dashboard.config = JSON.stringify(boardConfig);
    payload.widgets = widgets.map((widget, index) => {
      const chart = widget.config.content?.dataChart;
      if (chart?.config) chart.config = upgradeDimensions(chart.config);
      return {
        ...original[index],
        config: JSON.stringify(widget.config),
        ...(original[index].relations
          ? {
              relations: widget.relations?.map(relation => ({
                ...relation,
                config: JSON.stringify(relation.config),
              })),
            }
          : {}),
      };
    });
  } else if (payload.datachart) {
    upgradeChart(payload.datachart);
  } else {
    throw new Error('仅支持仪表板模板和图表模板，不接受组织或资源迁移包');
  }
  if (result.payload) {
    if (
      ![
        'datart.server.base.transfer.model.DashboardTemplateModel',
        'datart.server.base.transfer.model.DatachartTemplateModel',
      ].includes(result.type)
    ) {
      throw new Error('文件不是报表模板');
    }
    result.formatVersion = 2;
    result.packageType = 'RESOURCE';
    delete payload.formatVersion;
    delete payload.packageType;
  }
  return result;
}
