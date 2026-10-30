import { describe, expect, it } from 'vitest';
import { DataViewFieldType } from 'app/constants';
import { ViewFieldMeta } from 'app/types/View';
import { initialState, reducer, viewActions } from '../index';
import { runSql, saveView } from '../thunks';
import { ColumnRole } from '../types';
import { ViewViewModelStages } from '../../constants';
import { generateEditingView, getSavedViewModel } from '../../utils';

const field: ViewFieldMeta = {
  fieldId: 'amount-field',
  originName: 'amount',
  sourcePath: ['analytics', 'orders', 'amount'],
  sourceComment: '订单金额',
  customName: '旧名称',
  displayName: '旧名称',
};

const makeView = () =>
  generateEditingView({
    id: 'orders-view',
    type: 'SQL',
    script: 'select amount from orders',
    fields: [field],
    stage: ViewViewModelStages.Saved,
    model: {
      columns: {
        amount: {
          name: ['amount'],
          fieldId: field.fieldId,
          type: DataViewFieldType.NUMERIC,
          customName: field.customName,
        },
      },
      hierarchy: {
        metrics: {
          name: 'metrics',
          role: ColumnRole.Hierarchy,
          type: DataViewFieldType.STRING,
          children: [{
            name: 'amount',
            path: ['amount'],
            fieldId: field.fieldId,
            type: DataViewFieldType.NUMERIC,
            customName: field.customName,
          }],
        },
      },
    },
  });

describe('dataset field metadata lifecycle', () => {
  it('keeps server-issued IDs after the first save and can immediately rename the field', () => {
    const draft = generateEditingView({ id: 'temporary-view', type: 'SQL' });
    const queried = reducer(
      { ...initialState, editingViews: [draft], currentEditingView: draft.id },
      runSql.fulfilled({
        columns: [{ name: ['amount'], type: DataViewFieldType.NUMERIC }],
        rows: [[100]],
        previewFields: [{
          originName: 'amount',
          sourcePath: field.sourcePath,
          sourceComment: '订单金额',
          displayName: '订单金额',
        }],
      } as any, 'preview', { id: draft.id } as any),
    );
    const previewModel = queried.editingViews[0].model;
    expect(previewModel.columns?.amount.sourceComment).toBe('订单金额');
    expect(previewModel.hierarchy?.amount.sourceComment).toBe('订单金额');
    expect(previewModel.hierarchy?.amount.name).toBe('amount');
    expect(previewModel.hierarchy?.amount.fieldId).toBeUndefined();

    const canonical = { ...field, customName: undefined, displayName: '订单金额' };
    const serverModel = {
      ...previewModel,
      columns: {
        ...previewModel.columns,
        amount: { ...previewModel.columns!.amount, fieldId: field.fieldId },
      },
      hierarchy: {
        ...previewModel.hierarchy,
        amount: { ...previewModel.hierarchy!.amount, fieldId: field.fieldId },
      },
    };
    const saved = reducer(queried, saveView.fulfilled({
      ...queried.editingViews[0],
      id: 'orders-view',
      fields: [canonical],
      model: getSavedViewModel(JSON.stringify(serverModel), previewModel, [canonical]),
      savedFromViewId: draft.id,
    }, 'first-save', {} as any));
    expect(saved.editingViews[0].model.hierarchy?.amount.fieldId).toBe(field.fieldId);
    expect(saved.editingViews[0].model.columns?.amount.fieldId).toBe(field.fieldId);

    const renamed = reducer(saved, viewActions.fieldDisplayNameSaved({
      viewId: 'orders-view',
      field: { ...canonical, customName: '含税金额', displayName: '含税金额' },
    }));
    expect(renamed.editingViews[0].model.hierarchy?.amount.customName).toBe('含税金额');
    expect(renamed.editingViews[0].model.columns?.amount.customName).toBe('含税金额');
    expect(renamed.editingViews[0].touched).toBe(false);
    expect(renamed.editingViews[0].stage).toBe(ViewViewModelStages.Saved);
  });

  it('applies a delayed PATCH to its original tab without losing unrelated dirty edits', () => {
    const view = { ...makeView(), script: 'select amount * 2 from orders', touched: true, stage: ViewViewModelStages.Initialized };
    const other = generateEditingView({ id: 'another-view' });
    const result = reducer({
      ...initialState,
      editingViews: [view, other],
      currentEditingView: other.id,
    }, viewActions.fieldDisplayNameSaved({
      viewId: view.id,
      field: { ...field, customName: '实付金额', displayName: '实付金额' },
    }));
    const updated = result.editingViews[0];
    expect(updated.fields?.[0].customName).toBe('实付金额');
    expect(updated.model.columns?.amount.customName).toBe('实付金额');
    expect(updated.model.hierarchy?.metrics.children?.[0].customName).toBe('实付金额');
    expect(updated.script).toBe(view.script);
    expect(updated.touched).toBe(true);
    expect(updated.stage).toBe(view.stage);
    expect(result.currentEditingView).toBe(other.id);
    expect(result.editingViews[1]).toEqual(other);
  });

  it('clears the old name in every model reference without marking a clean view dirty', () => {
    const view = makeView();
    const result = reducer({ ...initialState, editingViews: [view], currentEditingView: view.id },
      viewActions.fieldDisplayNameSaved({
        viewId: view.id,
        field: { ...field, customName: undefined, sourceComment: '最新来源名称', displayName: '最新来源名称' },
      }));
    const updated = result.editingViews[0];
    expect(updated.model.columns?.amount.customName).toBeUndefined();
    expect(updated.model.hierarchy?.metrics.children?.[0].customName).toBeUndefined();
    expect(updated.model.hierarchy?.metrics.children?.[0].sourceComment).toBe('最新来源名称');
    expect(updated.touched).toBe(false);
    expect(updated.stage).toBe(ViewViewModelStages.Saved);
  });

  it('refreshes comments without replacing unsaved SQL, structure, type or custom names', () => {
    const view = { ...makeView(), script: 'select amount, count(*) from orders', touched: true, stage: ViewViewModelStages.Initialized };
    const other = generateEditingView({ id: 'other' });
    const result = reducer({ ...initialState, editingViews: [view, other], currentEditingView: other.id },
      viewActions.viewFieldsRefreshed({
        viewId: view.id,
        fields: [{ ...field, sourceComment: '最新金额注释' }],
      }));
    const updated = result.editingViews[0];
    expect(updated.script).toBe(view.script);
    expect(updated.model.hierarchy?.metrics.name).toBe('metrics');
    expect(updated.model.hierarchy?.metrics.children?.[0].type).toBe(DataViewFieldType.NUMERIC);
    expect(updated.model.columns?.amount.sourceComment).toBe('最新金额注释');
    expect(updated.model.columns?.amount.customName).toBe('旧名称');
    expect(updated.touched).toBe(true);
    expect(updated.stage).toBe(view.stage);
    expect(result.editingViews[1]).toEqual(other);
  });

  it('ignores PATCH and refresh results when their tab has been closed', () => {
    const other = generateEditingView({ id: 'other' });
    const state = { ...initialState, editingViews: [other], currentEditingView: other.id };
    expect(reducer(state, viewActions.fieldDisplayNameSaved({ viewId: 'closed', field }))).toEqual(state);
    expect(reducer(state, viewActions.viewFieldsRefreshed({ viewId: 'closed', fields: [field] }))).toEqual(state);
  });

  it('recovers only the initiating tab when a save fails after switching tabs', () => {
    const view = { ...makeView(), touched: true, stage: ViewViewModelStages.Saving };
    const other = generateEditingView({ id: 'other', stage: ViewViewModelStages.Saved });
    const action = saveView.rejected(null, 'save-orders', {}, '保存失败', {
      savedFromViewId: view.id,
    });
    const result = reducer({
      ...initialState,
      editingViews: [view, other],
      currentEditingView: other.id,
    }, action);

    expect(action.payload).toBe('保存失败');
    expect(result.editingViews[0].stage).toBe(ViewViewModelStages.Saveable);
    expect(result.editingViews[0].touched).toBe(true);
    expect(result.editingViews[0].model).toEqual(view.model);
    expect(result.editingViews[1]).toEqual(other);
    expect(result.currentEditingView).toBe(other.id);
  });

  it('keeps query failures on their initiating tab after switching tabs', () => {
    const view = { ...makeView(), stage: ViewViewModelStages.Running };
    const other = generateEditingView({ id: 'other', stage: ViewViewModelStages.Saved });
    const result = reducer({
      ...initialState,
      editingViews: [view, other],
      currentEditingView: other.id,
    }, runSql.rejected(null, 'query-orders', {
      id: view.id,
      isFragment: false,
    }, '查询失败'));

    expect(result.editingViews[0].stage).toBe(ViewViewModelStages.Initialized);
    expect(result.editingViews[0].error).toBe('查询失败');
    expect(result.editingViews[0].model).toEqual(view.model);
    expect(result.editingViews[1]).toEqual(other);
    expect(result.currentEditingView).toBe(other.id);
  });

  it('ignores save and query failures after the initiating tab is closed', () => {
    const other = generateEditingView({ id: 'other', stage: ViewViewModelStages.Saved });
    const state = { ...initialState, editingViews: [other], currentEditingView: other.id };
    expect(reducer(state, saveView.rejected(null, 'save-closed', {}, '保存失败', {
      savedFromViewId: 'closed',
    }))).toEqual(state);
    expect(reducer(state, runSql.rejected(null, 'query-closed', {
      id: 'closed',
      isFragment: false,
    }, '查询失败'))).toEqual(state);
  });
});
