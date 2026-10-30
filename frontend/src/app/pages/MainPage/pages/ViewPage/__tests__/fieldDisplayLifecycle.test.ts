import { describe, expect, it } from 'vitest';
import { DataViewFieldType } from 'app/constants';
import { ViewFieldMeta } from 'app/types/View';
import { HierarchyModel } from '../slice/types';
import { UNPERSISTED_ID_PREFIX } from '../constants';
import {
  findViewFieldMeta,
  generateEditingView,
  getViewColumnDisplayMeta,
  getViewPreviewFields,
  hydrateViewColumnDisplayMeta,
  matchesResourceSearch,
  refreshPreviewFieldComments,
  setViewModelFieldCustomName,
} from '../utils';

describe('dataset labels across editor surfaces', () => {
  const field: ViewFieldMeta = {
    fieldId: 'amount-field',
    originName: 'amount',
    sourcePath: ['db', 'orders', 'amount'],
    sourceComment: '旧注释',
    customName: '人工名称',
    displayName: '人工名称',
  };

  it('hydrates a missing canonical ID while preserving the SQL name and path', () => {
    const column = {
      name: 'amount',
      path: ['amount'],
      type: DataViewFieldType.NUMERIC,
    };
    expect(hydrateViewColumnDisplayMeta(column, [field])).toMatchObject({
      ...column,
      fieldId: field.fieldId,
      customName: '人工名称',
      sourceComment: '旧注释',
    });
  });

  it('does not bind a new joined table column to a persisted same-name field', () => {
    const column = {
      name: 'amount',
      path: ['db', 'refunds', 'amount'],
      type: DataViewFieldType.NUMERIC,
      customName: '退款金额',
    };
    expect(findViewFieldMeta(column, [field])).toBeUndefined();
    const hydrated = hydrateViewColumnDisplayMeta(column, [field]);
    expect(hydrated.fieldId).toBeUndefined();
    expect(hydrated.customName).toBe('退款金额');
  });

  it('can still match SQL output names without a full physical path', () => {
    expect(findViewFieldMeta({ name: ['amount'] }, [field])?.fieldId).toBe(field.fieldId);
    expect(findViewFieldMeta({ name: 'amount', path: ['amount'] }, [field])?.fieldId).toBe(field.fieldId);
  });

  it('disambiguates aliases only within an exact matching source path', () => {
    const fields = [field, { ...field, fieldId: 'other-alias', originName: 'total_amount' }];
    expect(findViewFieldMeta({ name: 'total_amount', path: field.sourcePath }, fields)?.fieldId).toBe('other-alias');
    expect(findViewFieldMeta({ name: 'unknown', path: field.sourcePath }, fields)).toBeUndefined();
  });

  it('uses fresh preview comments while keeping the persisted custom name', () => {
    const preview = {
      originName: 'amount',
      sourceComment: '新来源注释',
      displayName: '新来源注释',
    };
    expect(getViewColumnDisplayMeta({ name: 'amount' }, [field], [preview])).toMatchObject({
      fieldId: field.fieldId,
      customName: '人工名称',
      sourceComment: '新来源注释',
      comment: '新来源注释',
    });
  });

  it('does not resurrect stale custom names or comments after metadata clears them', () => {
    const column = { name: 'amount', customName: '旧名称', comment: '旧注释' };
    const cleared = { ...field, customName: undefined, sourceComment: undefined, displayName: 'amount' };
    expect(getViewColumnDisplayMeta(column, [cleared], [{ originName: 'amount', displayName: 'amount' }])).toMatchObject({
      customName: undefined,
      sourceComment: undefined,
      comment: undefined,
      displayName: 'amount',
    });
  });

  it('preserves an unsaved custom name on a new field when preview metadata arrives', () => {
    expect(getViewColumnDisplayMeta(
      { name: 'amount', customName: '草稿中文' },
      undefined,
      [{ originName: 'amount', sourceComment: '源注释', displayName: '源注释' }],
    )).toMatchObject({ customName: '草稿中文', sourceComment: '源注释' });
  });

  it('refreshes a matching preview source but preserves a preview of unsaved SQL from another source', () => {
    const refreshed = { ...field, sourceComment: undefined, customName: undefined, displayName: 'amount' };
    const matching = { originName: 'amount', sourcePath: field.sourcePath, sourceComment: '旧注释', displayName: '旧注释' };
    expect(refreshPreviewFieldComments([matching], [refreshed])?.[0]).toMatchObject({
      sourceComment: undefined,
      displayName: 'amount',
    });
    const unsaved = { ...matching, sourcePath: ['db', 'refunds', 'amount'], sourceComment: '退款金额' };
    expect(refreshPreviewFieldComments([unsaved], [refreshed])?.[0]).toEqual(unsaved);
  });

  it('changes only the selected full path when two tables have the same field name', () => {
    const model: HierarchyModel = {
      columns: {
        'a.id': { name: ['a', 'id'], type: DataViewFieldType.NUMERIC },
        'b.id': { name: ['b', 'id'], type: DataViewFieldType.NUMERIC },
      },
      hierarchy: {
        'a.id': { name: 'a.id', path: ['a', 'id'], type: DataViewFieldType.NUMERIC },
        'b.id': { name: 'b.id', path: ['b', 'id'], type: DataViewFieldType.NUMERIC },
      },
    };
    const changed = setViewModelFieldCustomName(model, { name: 'b.id', path: ['b', 'id'] }, '订单编号');
    expect(changed.columns?.['a.id'].customName).toBeUndefined();
    expect(changed.columns?.['b.id'].customName).toBe('订单编号');
    expect(changed.hierarchy?.['b.id'].customName).toBe('订单编号');
    expect(changed.columns?.['b.id'].name).toEqual(['b', 'id']);
  });
});

describe('saved JOIN preview lineage', () => {
  const script = 'select left_view.amount from (select amount from orders) left_view';
  const field: ViewFieldMeta = {
    fieldId: 'joined-amount',
    originName: 'amount',
    sourcePath: ['db', 'orders', 'amount'],
    sourceComment: '上游业务金额',
    customName: '本视图名称',
    displayName: '本视图名称',
  };
  const view = generateEditingView({
    id: 'saved-join',
    type: 'SQL',
    script,
    fields: [field],
    config: {
      lineage: {
        outputFieldSources: { amount: { viewId: 'upstream', columnKey: 'amount' } },
      },
    },
  });
  const unresolved = [{
    originName: 'amount',
    displayName: 'amount',
    category: 'UNRESOLVED',
    sourcePath: [],
  }];

  it('keeps explicit canonical lineage for an unchanged persisted JOIN', () => {
    const preview = getViewPreviewFields(view, unresolved, script, false);
    expect(preview?.[0]).toMatchObject({
      originName: 'amount',
      sourceComment: '上游业务金额',
      sourcePath: field.sourcePath,
      displayName: '上游业务金额',
    });
    expect(getViewColumnDisplayMeta({ name: 'amount' }, view.fields, preview).customName).toBe('本视图名称');
  });

  it('does not revive saved comments for changed SQL, dirty drafts or fragments', () => {
    expect(getViewPreviewFields({ ...view, touched: true }, unresolved, script, false)).toEqual(unresolved);
    expect(getViewPreviewFields({ ...view, script: 'select 1 as amount' }, unresolved, script, false)).toEqual(unresolved);
    expect(getViewPreviewFields(view, unresolved, 'select 1 as amount', false)).toEqual(unresolved);
    expect(getViewPreviewFields(view, unresolved, script, true)).toEqual(unresolved);
  });

  it('requires a persisted view and an explicit mapping for the output field', () => {
    expect(getViewPreviewFields({ ...view, id: `${UNPERSISTED_ID_PREFIX}1` }, unresolved, script, false)).toEqual(unresolved);
    expect(getViewPreviewFields({ ...view, config: {} }, unresolved, script, false)).toEqual(unresolved);
    expect(getViewPreviewFields({ ...view, fields: [] }, unresolved, script, false)).toEqual(unresolved);
  });

  it('keeps verified empty source comments and expressions authoritative', () => {
    for (const preview of [
      { originName: 'amount', displayName: 'amount', category: 'DIRECT', sourcePath: field.sourcePath },
      { originName: 'amount', displayName: 'amount', category: 'EXPRESSION', sourcePath: [] },
    ]) {
      const fields = getViewPreviewFields(view, [preview], script, false);
      expect(fields).toEqual([preview]);
      expect(getViewColumnDisplayMeta({ name: 'amount' }, view.fields, fields).sourceComment).toBeUndefined();
    }
  });
});

describe('source field bilingual search', () => {
  const node = {
    title: '订单编号',
    originalName: 'order_id',
    value: ['analytics', 'orders', 'order_id'],
    comment: '订单编号：外部系统生成',
  };

  it.each(['订单', 'order_id', ' ORDER_ID ', 'orders.order_id', '外部系统'])(
    'finds the same field using %s',
    keyword => expect(matchesResourceSearch(keyword, node)).toBe(true),
  );

  it('does not match an unrelated field', () => {
    expect(matchesResourceSearch('customer_id', node)).toBe(false);
  });
});
