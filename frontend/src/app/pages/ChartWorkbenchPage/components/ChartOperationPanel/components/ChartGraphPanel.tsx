/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import ChartManager from 'app/models/ChartManager';
import ChartI18NContext from 'app/pages/ChartWorkbenchPage/contexts/Chart18NContext';
import { IChart } from 'app/types/Chart';
import { ChartConfig } from 'app/types/ChartConfig';
import { transferChartDataConfig } from 'app/utils/internalChartHelper';
import { FC, memo, useLayoutEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { BORDER_RADIUS, SPACE_MD, SPACE_XS } from 'styles/StyleConstants';
import { CloneValueDeep } from 'utils/object';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import ChartGraphIcon from './ChartGraphIcon';

const CHART_GROUPS = [
  {
    key: 'quota',
    ids: ['react-scorecard', 'gauge', 'liquid-chart'],
  },
  {
    key: 'table',
    ids: ['mingxi-table', 'piovt-sheet'],
  },
  {
    key: 'trend',
    ids: ['line-chart', 'area-chart', 'stack-area-chart', 'stock-line-chart'],
  },
  {
    key: 'compare',
    ids: [
      'cluster-column-chart',
      'cluster-bar-chart',
      'stack-column-chart',
      'stack-bar-chart',
      'percentage-stack-column-chart',
      'percentage-stack-bar-chart',
      'waterfall-chart',
      'group-stack-column-chart',
      'bidirectional-bar-chart',
      'bullet-chart',
      'progress-bar-chart',
      'range-bar-chart',
    ],
  },
  {
    key: 'distribute',
    ids: [
      'pie-chart',
      'doughnut-chart',
      'rose-chart',
      'donut-rose-chart',
      'radar',
      'treemap-chart',
      'word-cloud',
    ],
  },
  {
    key: 'map',
    ids: [
      'normal-outline-map-chart',
      'scatter-outline-map-chart',
      'flow-map-chart',
      'geo-heatmap-chart',
      'symbolic-map-chart',
    ],
  },
  {
    key: 'relation',
    ids: [
      'scatter',
      'quadrant-chart',
      'funnel-chart',
      'sankey-chart',
      'circle-packing-chart',
    ],
  },
  {
    key: 'dualAxes',
    ids: [
      'double-y',
      'chart-mix-bar-line',
      'chart-mix-group',
      'chart-mix-stack',
      'chart-mix-dual-line',
    ],
  },
  {
    key: 'other',
    ids: ['react-rich-text', 'picture-group-chart'],
  },
];

const getChartGroup = (id?: string) => {
  const group = CHART_GROUPS.find(item => item.ids.includes(id || ''));
  return group?.key || 'other';
};

const ChartGraphPanel: FC<{
  chart?: IChart;
  chartConfig?: ChartConfig;
  onChartChange: (chart: IChart) => void;
}> = memo(({ chart, chartConfig, onChartChange }) => {
  const translate = useI18NPrefix('viz.palette.graph');
  const chartManager = ChartManager.instance();
  const [allCharts] = useState<IChart[]>(chartManager.getAllCharts());
  const [requirementsStates, setRequirementStates] = useState<object>({});

  useLayoutEffect(() => {
    if (allCharts) {
      const dict = allCharts?.reduce((acc, cur) => {
        const transferedChartConfig = transferChartDataConfig(
          { datas: CloneValueDeep(cur?.config?.datas || []) },
          { datas: chartConfig?.datas },
        );
        acc[cur.meta.id] = cur?.isMatchRequirement(transferedChartConfig);
        return acc;
      }, {});
      setRequirementStates(dict);
    }
  }, [allCharts, chartConfig]);

  const chartGroups = useMemo(() => {
    const grouped = new Map<string, IChart[]>();
    allCharts.forEach(chart => {
      const key = getChartGroup(chart.meta.id);
      grouped.set(key, [...(grouped.get(key) || []), chart]);
    });
    return CHART_GROUPS.map(group => ({
      ...group,
      charts: grouped.get(group.key) || [],
    })).filter(group => group.charts.length > 0);
  }, [allCharts]);

  return (
    <StyledChartGraphPanel>
      {chartGroups.map(group => (
        <ChartGroup key={group.key}>
          <ChartGroupTitle>
            {translate(`categories.${group.key}`)}
          </ChartGroupTitle>
          <ChartGroupItems>
            {group.charts.map(c => (
              <ChartI18NContext.Provider
                key={c?.meta?.id}
                value={{ i18NConfigs: c?.config?.i18ns }}
              >
                <ChartGraphIcon
                  chart={c}
                  isActive={c?.meta?.id === chart?.meta?.id}
                  isMatchRequirement={!!requirementsStates?.[c?.meta?.id]}
                  onChartChange={onChartChange}
                />
              </ChartI18NContext.Provider>
            ))}
          </ChartGroupItems>
        </ChartGroup>
      ))}
    </StyledChartGraphPanel>
  );
});

export default ChartGraphPanel;

const StyledChartGraphPanel = styled.div`
  height: 200px;
  box-sizing: border-box;
  flex-shrink: 0;
  overflow-y: auto;
  padding: ${SPACE_XS};
  margin-bottom: ${SPACE_MD};
  color: ${p => p.theme.textColorLight};
  background-color: ${p => p.theme.componentBackground};
  border-radius: ${BORDER_RADIUS};
`;

const ChartGroup = styled.section`
  & + & {
    margin-top: ${SPACE_XS};
    padding-top: ${SPACE_XS};
    border-top: 1px solid ${p => p.theme.borderColorSplit};
  }
`;

const ChartGroupTitle = styled.div`
  padding: 0 ${SPACE_XS};
  font-size: 12px;
  line-height: 20px;
  color: ${p => p.theme.textColorSnd};
`;

const ChartGroupItems = styled.div`
  display: flex;
  flex-flow: row wrap;
`;
