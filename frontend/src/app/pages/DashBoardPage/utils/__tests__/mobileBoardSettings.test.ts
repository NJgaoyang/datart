import { initAutoBoardConfig } from '../autoBoard';
import {
  ensureMobileBoardSettings,
  getHiddenMobileDashboardIds,
  getMobileBoardSettings,
  MOBILE_TRANSFORM_ENABLED_KEY,
  MOBILE_VISIBLE_KEY,
} from '../mobileBoardSettings';

describe('mobile board settings', () => {
  it('defaults legacy dashboards to hidden and respects saved switches', () => {
    const config = initAutoBoardConfig();
    const basic = config.jsonConfig.props.find(item => item.key === 'basic')!;
    basic.rows = basic.rows?.filter(
      row =>
        row.key !== MOBILE_TRANSFORM_ENABLED_KEY &&
        row.key !== MOBILE_VISIBLE_KEY,
    );

    ensureMobileBoardSettings(config);
    expect(getMobileBoardSettings(config)).toEqual({
      mobileTransformEnabled: true,
      mobileVisible: false,
    });

    basic.rows!.find(row => row.key === MOBILE_VISIBLE_KEY)!.value = true;
    expect(getMobileBoardSettings(config).mobileVisible).toBe(true);
  });

  it('only hides dashboards explicitly disabled for mobile', () => {
    expect(
      [...getHiddenMobileDashboardIds([
        { id: 'legacy' },
        { id: 'enabled', mobileVisible: true },
        { id: 'disabled', mobileVisible: false },
      ])],
    ).toEqual(['legacy', 'disabled']);
  });
});
