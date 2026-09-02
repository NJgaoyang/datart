import { Chart as G2Chart } from '@antv/g2';
import React, { useEffect, useRef } from 'react';
import ReactChart from 'app/models/ReactChart';
import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { BrokerContext, BrokerOption } from 'app/types/ChartLifecycleBroker';
import { getChartDataParts } from '../BasicEChartsChart';
import { buildHierarchy } from '../chartBuilders';
import Config from './config';

const CirclePackingAdapter = ({ data }: { data: any[] }) => {
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!container.current) return;
    const chart = new G2Chart({ container: container.current, autoFit: true });
    chart.options({
      type: 'pack',
      data: { name: '全部', children: data },
      encode: {
        value: 'value',
        color: (datum: any) => datum.data?.name || datum.name,
      },
      labels: [{ text: (datum: any) => datum.data?.name || datum.name }],
      tooltip: { items: [{ field: 'value' }] },
      style: { stroke: '#fff', lineWidth: 1 },
      layout: { padding: 4 },
    });
    chart.render();
    return () => chart.destroy();
  }, [data]);

  return <div ref={container} style={{ width: '100%', height: '100%' }} />;
};

export const getCirclePackingData = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
) => {
  const { dataSet, groups, metrics } = getChartDataParts(dataset, config);
  return buildHierarchy(
    dataSet.map(row => ({
      groups: groups.map(group => row.getCell(group) as string),
      values: [Number(row.getCell(metrics[0]))],
    })),
  );
};

class CirclePackingChart extends ReactChart {
  config = Config;
  useIFrame = false;

  constructor() {
    super(CirclePackingAdapter, {
      id: 'circle-packing-chart',
      name: 'viz.palette.graph.names.circlePackingChart',
      icon: 'graph-circular',
    });
    this.meta.requirements = [{ group: [1, 999], aggregate: 1 }];
  }

  onMount(options: BrokerOption, context: BrokerContext) {
    if (options.containerId && context.document) {
      this.adapter.mounted(
        context.document.getElementById(options.containerId),
        this.getOptions(options.dataset, options.config),
      );
    }
  }

  onUpdated(options: BrokerOption) {
    if (
      options.dataset &&
      options.config &&
      this.isMatchRequirement(options.config)
    ) {
      this.adapter.updated(this.getOptions(options.dataset, options.config));
    }
  }

  onUnMount() {
    this.adapter.unmount();
  }

  onResize(options: BrokerOption) {
    this.onUpdated(options);
  }

  getOptions(dataset?: ChartDataSetDTO, config?: ChartConfig) {
    return {
      data: dataset && config ? getCirclePackingData(dataset, config) : [],
    };
  }
}

export default CirclePackingChart;
