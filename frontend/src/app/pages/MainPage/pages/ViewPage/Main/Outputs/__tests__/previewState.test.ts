import { describe, expect, it } from 'vitest';
import { DataViewFieldType } from 'app/constants';
import { ViewViewModelStages } from '../../../constants';
import { initialState, reducer } from '../../../slice';
import { runSql } from '../../../slice/thunks';
import { generateEditingView } from '../../../utils';
import { hasPreviewResult } from '../previewState';

describe('dataset preview availability', () => {
  it('does not present a loaded schema as an executed query', () => {
    const view = generateEditingView({
      id: 'orders',
      stage: ViewViewModelStages.Initialized,
      model: {
        columns: { amount: { name: ['amount'], type: DataViewFieldType.NUMERIC } },
      },
    });

    expect(hasPreviewResult(view)).toBe(false);
    expect(hasPreviewResult({ ...view, stage: ViewViewModelStages.Running })).toBe(false);
  });

  it('preserves an empty fragment result and its columns after the query completes', () => {
    const view = generateEditingView({ id: 'orders', type: 'SQL' });
    const result = reducer(
      { ...initialState, currentEditingView: view.id, editingViews: [view] },
      runSql.fulfilled(
        {
          columns: [{ name: ['amount'], type: DataViewFieldType.NUMERIC }],
          rows: [],
          pageInfo: { pageNo: 1, pageSize: 1000, total: 0 },
        } as any,
        'empty-fragment',
        { id: view.id, isFragment: true } as any,
      ),
    );
    const completed = result.editingViews[0];

    expect(completed.stage).toBe(ViewViewModelStages.Initialized);
    expect(completed.previewResults).toEqual([]);
    expect(completed.model.columns?.amount).toBeDefined();
    expect(hasPreviewResult(completed)).toBe(true);
  });

  it('keeps an empty preview visible after save replaces temporary field metadata', () => {
    const saved = generateEditingView({
      stage: ViewViewModelStages.Saved,
      previewFields: undefined,
      previewResults: [],
    });

    expect(hasPreviewResult(saved)).toBe(true);
  });
});
