import ReactChart from 'app/models/ReactChart';
import { ChartConfig } from 'app/types/ChartConfig';
import ChartDataSetDTO from 'app/types/ChartDataSet';
import { BrokerContext, BrokerOption } from 'app/types/ChartLifecycleBroker';
import { getStyles, transformToDataSet } from 'app/utils/chartHelper';
import PictureGroupAdapter from './PictureGroupAdapter';
import Config from './config';

class PictureGroup extends ReactChart {
  config = Config;
  useIFrame = false;
  constructor() {
    super(PictureGroupAdapter, {
      id: 'picture-group-chart',
      name: 'viz.palette.graph.names.pictureGroupChart',
      icon: 'image-widget',
    });
    this.meta.requirements = [{ group: [1, 2] }];
  }
  onMount(options: BrokerOption, context: BrokerContext) {
    if (options.containerId && context.document)
      this.adapter.mounted(
        context.document.getElementById(options.containerId),
        options,
        context,
      );
  }
  onUpdated(options: BrokerOption, context: BrokerContext) {
    if (
      !options.dataset ||
      !options.config ||
      !this.isMatchRequirement(options.config)
    )
      return;
    this.adapter.updated(this.getOptions(options.dataset, options.config));
  }
  onUnMount() {
    this.adapter.unmount();
  }
  onResize(options: BrokerOption, context: BrokerContext) {
    this.onUpdated(options, context);
  }
  getOptions(dataset: ChartDataSetDTO, config: ChartConfig) {
    const parts = transformToDataSet(
      dataset.rows || [],
      dataset.columns || [],
      config.datas || [],
    );
    const groups = (config.datas || [])
      .filter(section => section.type === 'group')
      .flatMap(section => section.rows || []);
    const [columns] = getStyles(config.styles || [], ['chart'], ['columns']);
    const [fit] = getStyles(config.styles || [], ['chart'], ['fit']);
    const [radius] = getStyles(config.styles || [], ['chart'], ['radius']);
    return {
      items: parts
        .map(row => ({
          url: row.getCell(groups[0]),
          label: groups[1] ? row.getCell(groups[1]) : '',
        }))
        .filter(item => item.url),
      columns: Number(columns || 4),
      fit: fit || 'cover',
      radius: Number(radius || 4),
    };
  }
}
export default PictureGroup;
