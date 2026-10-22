import { APP_VERSION_BETA_2 } from '../constants';
import MigrationEvent from '../MigrationEvent';
import MigrationEventDispatcher from '../MigrationEventDispatcher';

export const beta2 = viewConfig => {
  if (!viewConfig) {
    return viewConfig;
  }

  try {
    if (viewConfig) {
      viewConfig.expensiveQuery = false;
    }

    return viewConfig;
  } catch (error) {
    console.error('Migration ViewConfig Errors | beta.2 | ', error);
    return viewConfig;
  }
};

export const migrateViewConfig = (viewConfig: string | object): string => {
  if (viewConfig == null) {
    return '';
  }

  let config: any;
  if (typeof viewConfig === 'string') {
    if (!viewConfig.trim().length) {
      return viewConfig;
    }
    try {
      config = JSON.parse(viewConfig);
    } catch (err) {
      console.error('migrateViewConfig JSON.parse error:', err);
      return viewConfig;
    }
  } else {
    config = viewConfig;
  }

  const event2 = new MigrationEvent(APP_VERSION_BETA_2, beta2);
  const dispatcher = new MigrationEventDispatcher(event2);
  const result = dispatcher.process(config);

  return JSON.stringify(result);
};
