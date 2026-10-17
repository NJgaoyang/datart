/** Redux-undo records the current dashboard in history on the first
 * real edit; the initial loading action only contains the empty dashboard.
 * Undoing all changes removes the edited dashboard snapshot again.
 */
export const hasUnsavedBoardChanges = (
  past: ReadonlyArray<{ dashBoard?: { id?: string } }> | undefined,
  boardId: string,
): boolean => Boolean(
  boardId && past?.some(snapshot => snapshot.dashBoard?.id === boardId),
);
