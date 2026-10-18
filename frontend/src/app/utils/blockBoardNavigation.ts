import type { History } from 'history';

export interface BoardNavigationGuardOptions {
  dirty: boolean;
  saving: boolean;
  confirmExit: (proceed: () => void, stay: () => void) => void;
  onBlockedWhileSaving: () => void;
  onLeave: () => void;
}

/**
 * Prevents accidental in-app PUSH/REPLACE/POP departures from an unsaved
 * dashboard. Blocked transitions must be retried only after unblocking;
 * otherwise the history index (especially browser Back) can become stale.
 *
 * Call dispose() on editor unmount, and before an explicitly approved
 * "save / discard and leave" navigation to prevent a duplicate prompt.
 */
export function blockBoardNavigation(
  history: Pick<History, 'block'>,
  options: BoardNavigationGuardOptions,
): () => void {
  if (!options.dirty && !options.saving) return () => undefined;
  let disposed = false;
  let promptOpen = false;

  const unblock = history.block(transition => {
    if (disposed) return;
    if (options.saving) {
      options.onBlockedWhileSaving();
      return;
    }
    if (!options.dirty || promptOpen) return;
    promptOpen = true;
    options.confirmExit(
      () => {
        if (disposed) return;
        promptOpen = false;
        dispose();
        options.onLeave();
        transition.retry();
      },
      () => { promptOpen = false; },
    );
  });

  function dispose() {
    if (disposed) return;
    disposed = true;
    unblock();
  }
  return dispose;
}