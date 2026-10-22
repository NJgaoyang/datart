import type { BoardConfig } from '../types/boardTypes';

/**
 * Adds v2 grid-engine controls to saved AUTO dashboards when they are
 * opened in the editor. Existing setting values are never overwritten.
 * Historical layout geometry is not modified.
 */
export const ensureGridEngineSettings = (config: BoardConfig): BoardConfig => {
  if (config.type !== 'auto') return config;
  const group = config.jsonConfig?.props?.find(item => item.key === 'basic');
  if (!group) return config;
  group.rows ||= [];

  if (!group.rows.some(row => row.key === 'compactType')) {
    group.rows.push({
      label: 'basic.compactType',
      key: 'compactType',
      default: 'vertical',
      value: 'vertical',
      comType: 'select',
      options: {
        items: [
          { label: 'Vertical', value: 'vertical' },
          { label: 'Horizontal', value: 'horizontal' },
          { label: 'None', value: 'none' },
        ],
      },
    });
  }
  if (!group.rows.some(row => row.key === 'showGrid')) {
    group.rows.push({
      label: 'basic.showGrid',
      key: 'showGrid',
      default: false,
      value: false,
      comType: 'switch',
    });
  }
  // Keep persisted per-board margins as an opt-out, but make the default
  // grid spacing consistent across old and new automatic dashboards.
  if (!group.rows.some(row => row.key === 'seamlessSpacing')) {
    group.rows.push({
      label: 'basic.seamlessSpacing',
      key: 'seamlessSpacing',
      default: true,
      value: true,
      comType: 'switch',
    });
  }
  config.jsonConfig.i18ns?.forEach(i18n => {
    const translation = i18n.translation as Record<string, any>;
    translation.basic ||= {};
    translation.basic.compactType ??= i18n.lang === 'zh-CN'
      ? '组件压缩方向' : 'Grid Compaction';
    translation.basic.showGrid ??= i18n.lang === 'zh-CN'
      ? '显示栅格辅助线' : 'Show Grid Guides';
    translation.basic.seamlessSpacing ??= i18n.lang === 'zh-CN'
      ? '组件无缝排列' : 'Seamless Widget Spacing';
  });
  return config;
};
