import {
  ChartI18NSectionConfig,
  ChartStyleConfig,
} from 'app/types/ChartConfig';
import { BoardType } from '../pages/Board/slice/types';

export interface BoardConfig {
  version: string;
  type: BoardType;
  /** PC horizontal layout schema version. */
  layoutVersion?: number;
  /** Mobile layout schema version. */
  mobileLayoutVersion?: number;
  /** PC vertical layout schema version. */
  pcRowLayoutVersion?: number;
  jsonConfig: {
    props: ChartStyleConfig[];
    i18ns: ChartI18NSectionConfig[];
  };
}
