import { BoardConfig } from '../types/boardTypes';

export const MOBILE_TRANSFORM_ENABLED_KEY = 'mobileTransformEnabled';
export const MOBILE_VISIBLE_KEY = 'mobileVisible';

const SETTINGS = [
  {
    key: MOBILE_TRANSFORM_ENABLED_KEY,
    zh: '启用移动端转换',
    en: 'Enable Mobile Conversion',
    defaultValue: true,
  },
  {
    key: MOBILE_VISIBLE_KEY,
    zh: '移动端展示',
    en: 'Show on Mobile',
    defaultValue: false,
  },
];

export const ensureMobileBoardSettings = (config: BoardConfig): BoardConfig => {
  const basic = config.jsonConfig?.props?.find(item => item.key === 'basic');
  if (!basic) return config;
  basic.rows ||= [];
  SETTINGS.forEach(({ key, defaultValue }) => {
    if (!basic.rows?.some(row => row.key === key)) {
      basic.rows?.push({
        label: `basic.${key}`,
        key,
        default: defaultValue,
        value: defaultValue,
        comType: 'switch',
      });
    }
  });
  config.jsonConfig.i18ns?.forEach(i18n => {
    const translation = i18n.translation as Record<string, any>;
    translation.basic ||= {};
    SETTINGS.forEach(({ key, zh, en }) => {
      translation.basic[key] ??= i18n.lang === 'zh-CN' ? zh : en;
    });
  });
  return config;
};

export const getMobileBoardSettings = (config?: BoardConfig) => {
  const rows = config?.jsonConfig?.props?.find(item => item.key === 'basic')
    ?.rows;
  const valueOf = (key: string, defaultValue: boolean) =>
    rows?.find(row => row.key === key)?.value ?? defaultValue;
  return {
    mobileTransformEnabled: valueOf(MOBILE_TRANSFORM_ENABLED_KEY, true),
    mobileVisible: valueOf(MOBILE_VISIBLE_KEY, false),
  };
};

export const getHiddenMobileDashboardIds = (
  dashboards: { id: string; mobileVisible?: boolean }[],
) =>
  new Set(
    dashboards
      .filter(dashboard => dashboard.mobileVisible !== true)
      .map(dashboard => dashboard.id),
  );
