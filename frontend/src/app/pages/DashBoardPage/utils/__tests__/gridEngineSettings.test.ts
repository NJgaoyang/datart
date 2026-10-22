import { initAutoBoardConfig } from '../autoBoard';
import { ensureGridEngineSettings } from '../gridEngineSettings';

describe('grid engine settings for existing dashboards', () => {
  it('adds missing compaction and guide controls to an existing AUTO board', () => {
    const config = initAutoBoardConfig();
    const group = config.jsonConfig.props.find(row => row.key === 'basic')!;
    group.rows = group.rows?.filter(row =>
      row.key !== 'compactType' && row.key !== 'showGrid' && row.key !== 'seamlessSpacing',
    );
    const result = ensureGridEngineSettings(config);
    const rows = result.jsonConfig.props.find(row => row.key === 'basic')!.rows!;
    expect(rows.find(row => row.key === 'compactType')?.value).toBe('vertical');
    expect(rows.find(row => row.key === 'showGrid')?.value).toBe(false);
    expect(rows.find(row => row.key === 'seamlessSpacing')?.value).toBe(true);
    expect(result.jsonConfig.i18ns[0].translation).toHaveProperty('basic.compactType');
    expect(result.jsonConfig.i18ns[0].translation).toHaveProperty('basic.seamlessSpacing');
  });

  it('preserves user-selected strategy and is idempotent', () => {
    const config = initAutoBoardConfig();
    const group = config.jsonConfig.props.find(row => row.key === 'basic')!;
    group.rows!.find(row => row.key === 'compactType')!.value = 'horizontal';
    group.rows!.find(row => row.key === 'showGrid')!.value = true;
    group.rows!.find(row => row.key === 'seamlessSpacing')!.value = false;
    const beforeCount = group.rows!.length;
    ensureGridEngineSettings(ensureGridEngineSettings(config));
    expect(group.rows!.length).toBe(beforeCount);
    expect(group.rows!.find(row => row.key === 'compactType')!.value).toBe('horizontal');
    expect(group.rows!.find(row => row.key === 'showGrid')!.value).toBe(true);
    expect(group.rows!.find(row => row.key === 'seamlessSpacing')!.value).toBe(false);
  });

  it('does not attach AUTO controls to free-layout dashboards', () => {
    const config = initAutoBoardConfig();
    config.type = 'free';
    const group = config.jsonConfig.props.find(row => row.key === 'basic')!;
    group.rows = group.rows!.filter(row => row.key !== 'compactType' && row.key !== 'seamlessSpacing');
    ensureGridEngineSettings(config);
    expect(group.rows!.some(row => row.key === 'compactType')).toBe(false);
    expect(group.rows!.some(row => row.key === 'seamlessSpacing')).toBe(false);
  });
});
