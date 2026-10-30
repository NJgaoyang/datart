import { ViewViewModelStages } from '../../constants';
import type { ViewViewModel } from '../../slice/types';

export function hasPreviewResult({
  stage,
  previewFields,
  previewResults,
}: Pick<ViewViewModel, 'stage' | 'previewFields' | 'previewResults'>): boolean {
  // A successful fragment returns to Initialized, even when it has no rows.
  // Its previewFields array distinguishes that response from an unrun editor.
  // Saving clears that array, but retains the result and advances the stage.
  return (
    Array.isArray(previewFields) ||
    stage >= ViewViewModelStages.Saveable ||
    Boolean(previewResults?.length)
  );
}
