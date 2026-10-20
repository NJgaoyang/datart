import { getBoardSaveStatus } from '../boardSaveStatus';

describe('dashboard save feedback', () => {
  it('prioritizes in-flight saves over stale error and unsaved flags', () => {
    expect(getBoardSaveStatus(true, true, true)).toBe('saving');
  });

  it('keeps failed saves visible and retryable until the next attempt', () => {
    expect(getBoardSaveStatus(false, true, true)).toBe('failed');
    expect(getBoardSaveStatus(false, true, false)).toBe('unsaved');
  });

  it('shows a saved state when the editor has no local changes', () => {
    expect(getBoardSaveStatus(false, false, false)).toBe('saved');
  });
});
