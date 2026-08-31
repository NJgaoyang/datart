import type { EChartsOption } from 'echarts';

export interface MobileChartContext {
  isMobile: boolean;
  isEmbedded?: boolean;
}

const mapOption = <T, R>(
  value: T | T[] | undefined,
  mapper: (item: T) => R,
): R | R[] | undefined => {
  if (Array.isArray(value)) return value.map(mapper);
  return value === undefined ? undefined : mapper(value);
};

/** Apply presentation-only defaults for narrow mobile chart canvases. */
export function applyMobileChartOption(
  option: any,
  context: MobileChartContext,
): EChartsOption {
  if (!context.isMobile) return option;

  const grid = mapOption(option.grid, item => ({
    ...item,
    left: 8,
    right: 8,
    top: item?.top ?? 32,
    bottom: item?.bottom ?? 24,
    containLabel: true,
  }));
  const tooltip = mapOption(option.tooltip, item => ({
    ...item,
    confine: true,
  }));
  const legend = mapOption(option.legend, item => ({
    ...item,
    type: 'scroll' as const,
    itemWidth: 10,
    itemHeight: 6,
    textStyle: {
      ...item?.textStyle,
      fontSize: 11,
    },
  }));
  const adaptAxis = axis =>
    mapOption(axis, item => ({
      ...item,
      axisLabel: {
        ...item?.axisLabel,
        fontSize: 10,
        hideOverlap: true,
      },
    }));

  return {
    ...option,
    grid: grid || {
      left: 8,
      right: 8,
      top: 32,
      bottom: 24,
      containLabel: true,
    },
    tooltip: tooltip || { confine: true },
    legend: legend || option.legend,
    xAxis: adaptAxis(option.xAxis) || option.xAxis,
    yAxis: adaptAxis(option.yAxis) || option.yAxis,
  };
}
