import { ChartStyleConfig } from 'app/types/ChartConfig';
import { getStyles } from 'app/utils/chartHelper';
import ScatterOutlineMapChart from '../ScatterOutlineMapChart';
import Config from './config';

class SymbolicMapChart extends ScatterOutlineMapChart {
  config = Config;
  constructor() {
    super();
    this.meta.id = 'symbolic-map-chart';
    this.meta.name = 'viz.palette.graph.names.symbolicMapChart';
  }
  protected getMetricAndSizeSeries(...args: any[]) {
    const series: any = super.getMetricAndSizeSeries(
      args[0],
      args[1],
      args[2],
      args[3],
      args[4],
      args[5],
    );
    const styles = args[4] as ChartStyleConfig[];
    const [symbol, opacity] = getStyles(
      styles || [],
      ['symbol'],
      ['type', 'opacity'],
    );
    return series.map(item => ({
      ...item,
      symbol: symbol || 'circle',
      itemStyle: { ...item.itemStyle, opacity: opacity ?? 0.8 },
    }));
  }
}
export default SymbolicMapChart;
