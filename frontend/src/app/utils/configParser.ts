import {
  BoardTypes,
  ServerWidget,
} from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { BoardConfig } from 'app/pages/DashBoardPage/types/boardTypes';
import { Widget } from 'app/pages/DashBoardPage/types/widgetTypes';

/** Decode the current wire format without changing saved fields or versions. */
export function parseBoardConfig(value: string): BoardConfig {
  const config = JSON.parse(value);
  if (!config || !BoardTypes.includes(config.type) || !config.jsonConfig) {
    throw new Error('报表配置格式无效，请先使用独立升级工具转换旧报表');
  }
  return config;
}

export function parseWidgets(widgets: ServerWidget[]): Widget[] {
  if (!Array.isArray(widgets)) throw new Error('报表组件格式无效');
  return widgets.map(widget => ({
    ...widget,
    config: JSON.parse(widget.config),
    relations: (widget.relations ?? []).map(relation => ({
      ...relation,
      config: JSON.parse(relation.config),
    })),
  })) as Widget[];
}

export function serializeConfig(
  value: string | object | null | undefined,
): string {
  return typeof value === 'string'
    ? value
    : value == null
    ? ''
    : JSON.stringify(value);
}
