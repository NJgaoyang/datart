import { group, metric, simpleChartConfig } from '../chartConfig';
export default simpleChartConfig([group(), metric('sides', 2)], '双向条形图');
