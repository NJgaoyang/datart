import { Chart as G2Chart } from '@antv/g2';
import React, { useEffect, useRef } from 'react';
import ReactChart from 'app/models/ReactChart';
import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { BrokerContext, BrokerOption } from 'app/types/ChartLifecycleBroker';
import { getStyles, transformToDataSet } from 'app/utils/chartHelper';
import Config from './config';

const LiquidAdapter = ({
  ratio,
  color,
  shape,
  size,
  showLabel,
  font,
}: {
  ratio: number;
  color: string;
  shape: string;
  size: number;
  showLabel: boolean;
  font?: { fontSize?: number; color?: string };
}) => {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!container.current) return;
    const chart = new G2Chart({ container: container.current, autoFit: true });
    chart.options({
      type: 'liquid',
      data: ratio,
      padding: Math.max(0, (100 - size) / 2),
      theme: { color },
      style: {
        shape,
        contentText: showLabel ? `${Math.round(ratio * 100)}%` : '',
        contentFill: font?.color || '#fff',
        contentFontSize: font?.fontSize,
        outlineBorder: 2,
        outlineDistance: 4,
      },
    });
    chart.render();
    return () => chart.destroy();
  }, [ratio, color, shape, size, showLabel, font]);
  return <div ref={container} style={{ width: '100%', height: '100%' }} />;
};

export const getLiquidRatio = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const dataSet = transformToDataSet(
    dataset.rows || [],
    dataset.columns || [],
    config.datas || [],
  );
  const metric = (config.datas || []).find(
    section => section.type === 'aggregate',
  )?.rows?.[0];
  const [max] = getStyles(config.styles || [], ['chart'], ['max']);
  const value = Number(metric ? dataSet[0]?.getCell(metric) : 0);
  return Math.max(
    0,
    Math.min(
      1,
      (Number.isFinite(value) ? value : 0) / Math.max(1, Number(max ?? 100)),
    ),
  );
};

class LiquidChart extends ReactChart {
  config = Config;
  useIFrame = false;
  constructor() {
    super(LiquidAdapter, {
      id: 'liquid-chart',
      name: 'viz.palette.graph.names.liquidChart',
      icon: 'gauge',
    });
    this.meta.requirements = [{ aggregate: 1 }];
  }
  onMount(options: BrokerOption, context: BrokerContext) {
    if (options.containerId && context.document)
      this.adapter.mounted(
        context.document.getElementById(options.containerId),
        this.getOptions(options.dataset, options.config),
      );
  }
  onUpdated(options: BrokerOption) {
    if (
      options.dataset &&
      options.config &&
      this.isMatchRequirement(options.config)
    )
      this.adapter.updated(this.getOptions(options.dataset, options.config));
  }
  onUnMount() {
    this.adapter.unmount();
  }
  onResize(options: BrokerOption) {
    this.onUpdated(options);
  }
  getOptions(dataset?: ChartDataSetDTO, config?: ChartConfig) {
    const [color, shape, size] = getStyles(
      config?.styles || [],
      ['chart'],
      ['color', 'shape', 'size'],
    );
    const [showLabel, font] = getStyles(
      config?.styles || [],
      ['label'],
      ['showLabel', 'font'],
    );
    return {
      ratio: dataset && config ? getLiquidRatio(dataset, config) : 0,
      color: (color as string) || '#4e79a7',
      shape: (shape as string) || 'circle',
      size: Math.max(10, Math.min(100, Number(size ?? 80))),
      showLabel: showLabel !== false,
      font,
    };
  }
}
export default LiquidChart;
