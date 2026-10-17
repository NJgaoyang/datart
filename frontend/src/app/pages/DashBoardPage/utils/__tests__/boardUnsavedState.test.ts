import { hasUnsavedBoardChanges } from '../boardUnsavedState';

describe('dashboard editor unsaved-change indicator', () => {
  it('does not warn on initial load without user edits', () => {
    expect(hasUnsavedBoardChanges([], 'board-1')).toBe(false);
    expect(hasUnsavedBoardChanges([{ dashBoard: {} }], 'board-1')).toBe(false);
  });
  it('warns when a real board snapshot was added to history', () => {
    expect(hasUnsavedBoardChanges([
      { dashBoard: {} },
      { dashBoard: { id: 'board-1' } },
    ], 'board-1')).toBe(true);
    expect(hasUnsavedBoardChanges([{ dashBoard: { id: 'board-2' } }], 'board-1')).toBe(false);
  });
});
