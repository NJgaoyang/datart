import { ChartConfig } from 'app/types/ChartConfig';
import { getStyles } from 'app/utils/chartHelper';
import BasicScatterChart from '../BasicScatterChart';
import Config from './config';

class QuadrantChart extends BasicScatterChart {
  config = Config;
  constructor() {
    super();
    this.meta.id = 'quadrant-chart';
    this.meta.name = 'viz.palette.graph.names.quadrantChart';
  }
  protected getAdditionalOption(styles: ChartConfig['styles']) {
    const [xSplit] = getStyles(styles || [], ['quadrant'], ['xSplit']);
    const [ySplit] = getStyles(styles || [], ['quadrant'], ['ySplit']);
    const x = Number.isFinite(Number(xSplit)) ? Number(xSplit) : 0;
    const y = Number.isFinite(Number(ySplit)) ? Number(ySplit) : 0;
    return {
      xAxis: { splitLine: { show: true } },
      yAxis: { splitLine: { show: true } },
      series: {
        markLine: {
          silent: true,
          symbol: 'none',
          data: [{ xAxis: x }, { yAxis: y }],
        },
        markArea: {
          silent: true,
          data: [
            [
              { xAxis: x, yAxis: y },
              { xAxis: 'max', yAxis: 'max' },
            ],
            [
              { xAxis: 'min', yAxis: y },
              { xAxis: x, yAxis: 'max' },
            ],
            [
              { xAxis: 'min', yAxis: 'min' },
              { xAxis: x, yAxis: y },
            ],
            [
              { xAxis: x, yAxis: 'min' },
              { xAxis: 'max', yAxis: y },
            ],
          ],
          itemStyle: { opacity: 0.08 },
        },
      },
      graphic: [
        { type: 'text', left: '25%', top: '25%', style: { text: 'Ⅰ' } },
        { type: 'text', right: '25%', top: '25%', style: { text: 'Ⅱ' } },
        { type: 'text', left: '25%', bottom: '25%', style: { text: 'Ⅲ' } },
        { type: 'text', right: '25%', bottom: '25%', style: { text: 'Ⅳ' } },
      ],
    };
  }
}
export default QuadrantChart;
