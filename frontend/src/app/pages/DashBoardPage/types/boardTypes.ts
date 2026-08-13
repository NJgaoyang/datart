import {
  ChartI18NSectionConfig,
  ChartStyleConfig,
} from 'app/types/ChartConfig';
import { BoardType } from '../pages/Board/slice/types';

export interface BoardConfig {
  version: string;
  type: BoardType;
  /** Layout schema version. Missing/1 means the legacy 12-column auto grid. */
  layoutVersion?: number;
  /** Mobile layout schema version. Missing/1 means the legacy 6-column grid. */
  mobileLayoutVersion?: number;
  /** PC row schema version. Missing/1 uses the legacy coarse vertical grid. */
  pcRowLayoutVersion?: number;
  jsonConfig: {
    props: ChartStyleConfig[];
    i18ns: ChartI18NSectionConfig[];
  };
}
