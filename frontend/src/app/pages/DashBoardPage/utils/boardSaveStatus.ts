/** Save feedback is independent from navigation and Redux undo history. */
export type BoardSaveStatus = 'saving' | 'failed' | 'unsaved' | 'saved';

export const getBoardSaveStatus = (
  saving: boolean,
  hasUnsavedChanges: boolean,
  failed: boolean,
): BoardSaveStatus => {
  if (saving) return 'saving';
  if (failed) return 'failed';
  return hasUnsavedChanges ? 'unsaved' : 'saved';
};
