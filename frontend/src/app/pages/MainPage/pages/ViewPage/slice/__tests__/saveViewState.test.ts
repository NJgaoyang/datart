import { describe, expect, it } from 'vitest';
import { reducer, initialState } from '../index';
import { saveView, getViewDetail } from '../thunks';
import { ViewViewModelStages } from '../../constants';
import { generateEditingView } from '../../utils';

describe('save/query view tab state recovery', () => {
  const current = generateEditingView({
    id: 'temporary-local',
    name: 'New dataset',
    stage: ViewViewModelStages.Saveable,
  });
  const other = generateEditingView({
    id: 'other-open-view',
    name: 'Other dataset',
    stage: ViewViewModelStages.Saved,
  });

  it('replaces the saved temporary ID without deleting another tab', () => {
    const state = {
      ...initialState,
      editingViews: [current, other],
      currentEditingView: 'temporary-local',
    };
    const payload = {
      ...current,
      id: 'server-issued-id',
      savedFromViewId: 'temporary-local',
      variables: undefined as any,
      columnPermissions: undefined as any,
    };
    const result = reducer(
      state,
      saveView.fulfilled(payload, 'save-request', {} as any),
    );
    expect(result.editingViews.map(v => v.id)).toEqual([
      'server-issued-id',
      'other-open-view',
    ]);
    expect(result.currentEditingView).toBe('server-issued-id');
    expect(result.editingViews[0].originVariables).toEqual([]);
    expect(result.editingViews[0].originColumnPermissions).toEqual([]);
  });

  it('does not change the active tab if the user switched during save', () => {
    const state = {
      ...initialState,
      editingViews: [current, other],
      currentEditingView: 'other-open-view',
    };
    const result = reducer(
      state,
      saveView.fulfilled(
        { ...current, id: 'server-issued-id', savedFromViewId: 'temporary-local' },
        'save-request',
        {} as any,
      ),
    );
    expect(result.currentEditingView).toBe('other-open-view');
    expect(result.editingViews.map(v => v.id)).toEqual([
      'server-issued-id',
      'other-open-view',
    ]);
  });

  it('ignores stale detail results after the tab is closed', () => {
    const state = {
      ...initialState,
      editingViews: [other],
      currentEditingView: other.id,
    };
    const result = reducer(
      state,
      getViewDetail.fulfilled(current, 'load-request', { viewId: current.id }),
    );
    expect(result.editingViews.map(v => v.id)).toEqual(['other-open-view']);
    expect(result.currentEditingView).toBe(other.id);
  });
});
