import { ChartDataSectionType } from 'app/constants';
import { ChartConfig, SelectedItem } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import {
  getColumnRenderName,
  getDrillableRows,
  getExtraSeriesRowData,
  getSelectedItemStyles,
  getStyles,
  transformToDataSet,
} from 'app/utils/chartHelper';
import BasicBarChart from '../BasicBarChart';
import { finiteNumber, safeName } from '../BasicEChartsChart';
import Config from './config';

const getRows = (config: ChartConfig, type: ChartDataSectionType) =>
  (config.datas || [])
    .filter(section => section.type === type)
    .flatMap(section => section.rows || []);

export const buildGroupStackOption = (
  dataset: ChartDataSetDTO,
  config: ChartConfig,
  selectedItems: SelectedItem[] = [],
) => {
  const dataConfigs = config.datas || [];
  const chartDataSet = transformToDataSet(
    dataset.rows || [],
    dataset.columns || [],
    dataConfigs,
  );
  const groups = getDrillableRows(dataConfigs, undefined);
  const colors = getRows(config, ChartDataSectionType.Color);
  const metrics = getRows(config, ChartDataSectionType.Aggregate);
  const category = groups[0];
  const outerGroup = groups[1];
  const stackField = colors[0];
  const metric = metrics[0];
  const categories = [
    ...new Set(chartDataSet.map(row => safeName(row.getCell(category)))),
  ];
  const outerNames = [
    ...new Set(
      chartDataSet.map(row =>
        safeName(outerGroup ? row.getCell(outerGroup) : '全部'),
      ),
    ),
  ];
  const stackNames = stackField
    ? [...new Set(chartDataSet.map(row => safeName(row.getCell(stackField))))]
    : [getColumnRenderName(metric)];
  const [stackEnabled] = getStyles(config.styles || [], ['chart'], ['stack']);
  const stack = stackEnabled !== false;
  const series = outerNames.flatMap((outer, outerIndex) =>
    stackNames.map((stackName, stackIndex) => {
      const name =
        outerNames.length > 1 || stackField
          ? `${outer} - ${stackName}`
          : stackName;
      return {
        name,
        type: 'bar',
        stack: stack ? `group-${outerIndex}` : undefined,
        itemStyle: stackField?.color?.colors?.find(
          item => item.key === stackName,
        )
          ? {
              color: stackField.color.colors.find(
                item => item.key === stackName,
              )?.value,
            }
          : undefined,
        data: categories.map((categoryName, categoryIndex) => {
          const row = chartDataSet.find(
            item =>
              safeName(item.getCell(category)) === categoryName &&
              safeName(outerGroup ? item.getCell(outerGroup) : '全部') ===
                outer &&
              (!stackField || safeName(item.getCell(stackField)) === stackName),
          );
          return {
            ...(row ? getExtraSeriesRowData(row) : { rowData: {} }),
            value:
              row && metric ? finiteNumber(row.getCell(metric), NaN) : null,
            ...getSelectedItemStyles(
              outerIndex * stackNames.length + stackIndex,
              categoryIndex,
              selectedItems,
            ),
          };
        }),
      };
    }),
  );
  return {
    tooltip: { trigger: 'axis' },
    legend: { data: series.map(item => item.name) },
    xAxis: { type: 'category', data: categories },
    yAxis: { type: 'value' },
    series,
  };
};

class GroupStackColumnChart extends BasicBarChart {
  config = Config;

  constructor() {
    super({
      id: 'group-stack-column-chart',
      name: 'viz.palette.graph.names.groupStackColumnChart',
      icon: 'fsux_tubiao_zhuzhuangtu',
      requirements: [{ group: [1, 2], aggregate: 1 }],
    });
  }

  getOptions(
    dataset: ChartDataSetDTO,
    config: ChartConfig,
    _drillOption?: unknown,
    selectedItems?: SelectedItem[],
  ): any {
    return buildGroupStackOption(dataset, config, selectedItems);
  }
}

export default GroupStackColumnChart;
