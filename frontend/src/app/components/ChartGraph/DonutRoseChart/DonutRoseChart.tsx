import RoseChart from '../RoseChart';
import Config from './config';
class DonutRoseChart extends RoseChart {
  config = Config;
  protected isDonutRose = true;
  constructor() {
    super();
    this.meta.id = 'donut-rose-chart';
    this.meta.name = 'viz.palette.graph.names.donutRoseChart';
  }
}
export default DonutRoseChart;
