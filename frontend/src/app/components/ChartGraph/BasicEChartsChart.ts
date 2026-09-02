import { ChartDataSectionType } from 'app/constants';
import { ChartSelectionManager } from 'app/models/ChartSelectionManager';
import { ChartConfig, ChartDataSectionField } from 'app/types/ChartConfig';
import ChartDataSetDTO, { IChartDataSet } from 'app/types/ChartDataSet';
import { BrokerContext, BrokerOption } from 'app/types/ChartLifecycleBroker';
import { getStyles, transformToDataSet } from 'app/utils/chartHelper';
import { init } from 'echarts';
import { applyMobileChartOption } from 'app/utils/mobileChartOption';
import Chart from '../../models/Chart';

export type ChartDataParts = {
  dataSet: IChartDataSet<string>;
  groups: ChartDataSectionField[];
  metrics: ChartDataSectionField[];
  colors: ChartDataSectionField[];
  sizes: ChartDataSectionField[];
  infos: ChartDataSectionField[];
};

export const getChartDataParts = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
): ChartDataParts => {
  const dataConfigs = config.datas || [];
  const dataSet = transformToDataSet(
    dataset.rows || [],
    dataset.columns || [],
    dataConfigs,
  );
  const rows = (type: ChartDataSectionType) =>
    dataConfigs
      .filter(section => section.type === type)
      .flatMap(section => section.rows || []);
  return {
    dataSet,
    groups: rows(ChartDataSectionType.Group),
    metrics: rows(ChartDataSectionType.Aggregate),
    colors: rows(ChartDataSectionType.Color),
    sizes: rows(ChartDataSectionType.Size),
    infos: rows(ChartDataSectionType.Info),
  };
};

export const finiteNumber = (value: unknown, fallback = 0): number => {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : fallback;
};

export const safeName = (value: unknown, fallback = '未命名'): string => {
  const name = `${value ?? ''}`.trim();
  return name || fallback;
};

export const getStyleValue = (
  styles: ChartConfig['styles'],
  section: string,
  key: string,
  fallback: any,
) => {
  const [value] = getStyles(styles || [], [section], [key]);
  return value === undefined ? fallback : value;
};

const getLegendPosition = (position: unknown) => {
  switch (position) {
    case 'top':
      return { top: 0, left: 'center', orient: 'horizontal' };
    case 'bottom':
      return { bottom: 0, left: 'center', orient: 'horizontal' };
    case 'left':
      return { left: 0, top: 'middle', orient: 'vertical' };
    default:
      return { right: 0, top: 'middle', orient: 'vertical' };
  }
};

export const applyCommonEChartsStyles = (
  option: Record<string, any>,
  config: ChartConfig,
) => {
  const showLabel = getStyleValue(
    config.styles || [],
    'label',
    'showLabel',
    true,
  );
  const font = getStyleValue(config.styles || [], 'label', 'font', {});
  const showLegend = getStyleValue(
    config.styles || [],
    'legend',
    'showLegend',
    true,
  );
  const legendPosition = getStyleValue(
    config.styles || [],
    'legend',
    'position',
    'right',
  );
  const showTooltip = getStyleValue(
    config.styles || [],
    'tooltip',
    'showTooltip',
    true,
  );
  const animation = getStyleValue(
    config.settings || [],
    'advanced',
    'animation',
    true,
  );
  const showDataZoom = getStyleValue(
    config.settings || [],
    'advanced',
    'showDataZoom',
    false,
  );
  const labelStyle = {
    ...(font?.fontFamily ? { fontFamily: font.fontFamily } : {}),
    ...(font?.fontSize !== undefined
      ? { fontSize: Number(font.fontSize) }
      : {}),
    ...(font?.fontWeight ? { fontWeight: font.fontWeight } : {}),
    ...(font?.fontStyle ? { fontStyle: font.fontStyle } : {}),
    ...(font?.color ? { color: font.color } : {}),
  };
  const series = Array.isArray(option.series)
    ? option.series.map(seriesItem =>
        seriesItem?.silent
          ? seriesItem
          : {
              ...seriesItem,
              label: {
                ...(seriesItem?.label || {}),
                ...labelStyle,
                show: showLabel !== false,
              },
              animation: animation !== false,
            },
      )
    : option.series;

  return {
    ...option,
    animation: animation !== false,
    tooltip: option.tooltip
      ? { ...option.tooltip, show: showTooltip !== false }
      : option.tooltip,
    dataZoom:
      showDataZoom && option.xAxis
        ? option.dataZoom || [{ type: 'inside' }, { type: 'slider' }]
        : option.dataZoom,
    legend: option.legend
      ? {
          ...option.legend,
          ...getLegendPosition(legendPosition),
          show: showLegend !== false,
        }
      : option.legend,
    series,
  };
};

abstract class BasicEChartsChart extends Chart {
  chart: any = null;
  selectionManager?: ChartSelectionManager;

  constructor(props: {
    id: string;
    name: string;
    icon?: string;
    requirements?: any[];
  }) {
    super(props.id, props.name, props.icon);
    this.meta.requirements = props.requirements || [{}];
  }

  protected abstract getChartOption(
    dataset: ChartDataSetDTO,
    config: ChartConfig,
    selectedItems?: any[],
  ): Record<string, any>;

  public getOptions(
    dataset: ChartDataSetDTO,
    config: ChartConfig,
    selectedItems?: any[],
  ) {
    return applyCommonEChartsStyles(
      this.getChartOption(dataset, config, selectedItems),
      config,
    );
  }

  onMount(options: BrokerOption, context: BrokerContext) {
    if (
      options.containerId === undefined ||
      !context.document ||
      !context.window
    ) {
      return;
    }
    const container = context.document.getElementById(options.containerId);
    if (!container) {
      return;
    }
    this.chart = init(container, 'default');
    this.selectionManager = new ChartSelectionManager(this.mouseEvents);
    this.selectionManager.attachWindowListeners(context.window);
    this.selectionManager.attachZRenderListeners(this.chart);
    this.selectionManager.attachEChartsListeners(this.chart);
  }

  onUpdated(options: BrokerOption) {
    if (!options.dataset || !options.config || !this.chart) {
      return;
    }
    if (!this.isMatchRequirement(options.config)) {
      this.chart.clear();
      return;
    }
    this.selectionManager?.updateSelectedItems(options.selectedItems);
    this.chart.setOption(
      applyMobileChartOption(
        this.getOptions(options.dataset, options.config, options.selectedItems),
        {
          isMobile: Boolean(options.widgetSpecialConfig?.isMobile),
          isEmbedded: Boolean(options.widgetSpecialConfig?.isEmbedded),
        },
      ),
      true,
    );
  }

  onUnMount(options: BrokerOption, context: BrokerContext) {
    this.selectionManager?.removeWindowListeners(context.window);
    this.selectionManager?.removeZRenderListeners(this.chart);
    this.chart?.dispose();
    this.chart = null;
  }

  onResize(options: BrokerOption, context: BrokerContext) {
    this.chart?.resize({ width: context.width, height: context.height });
  }
}

export default BasicEChartsChart;
