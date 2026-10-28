import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { Form } from 'antd';
import { ControllerFacadeTypes, TimeFilterValueCategory } from 'app/constants';
import { getTheWidgetFiltersAndParams } from 'app/pages/DashBoardPage/utils';
import { FilterSqlOperator } from 'globalConstants';
import { vi } from 'vitest';
import { RelatedViewForm } from '../RelatedViewForm';

it('keeps the view and field type when saving a date association', async () => {
  const onFinish = vi.fn();
  const association = {
    viewId: 'daily-view',
    relatedCategory: 'field',
    fieldValue: '日期',
    fieldValueType: 'DATE',
  };
  const TestForm = () => {
    const [form] = Form.useForm();
    return (
      <Form
        form={form}
        initialValues={{ relatedViews: [association] }}
        onFinish={onFinish}
      >
        <RelatedViewForm
          form={form}
          controllerType={ControllerFacadeTypes.Time}
          viewMap={
            {
              'daily-view': {
                id: 'daily-view',
                name: '日报',
                meta: [{ name: '日期', type: 'DATE' }],
              },
            } as any
          }
          queryVariables={[]}
          getFormRelatedViews={() => form.getFieldValue('relatedViews')}
        />
        <button type="submit">保存</button>
      </Form>
    );
  };
  render(<TestForm />);
  fireEvent.click(screen.getByText('保存'));
  await waitFor(() => expect(onFinish).toHaveBeenCalled());
  const relatedViews = onFinish.mock.calls[0][0].relatedViews;
  expect(relatedViews).toEqual([association]);

  const chartWidget = {
    id: 'chart',
    viewIds: ['daily-view'],
    config: { type: 'chart' },
  };
  const controllerWidget = {
    config: {
      type: 'controller',
      content: {
        type: ControllerFacadeTypes.Time,
        relatedViews,
        config: {
          sqlOperator: FilterSqlOperator.Equal,
          controllerDate: {
            pickerType: 'date',
            startTime: {
              relativeOrExact: TimeFilterValueCategory.Exact,
              exactValue: '2026-10-27',
            },
          },
        },
      },
    },
    relations: [{ targetId: 'chart' }],
  };
  expect(
    getTheWidgetFiltersAndParams({
      chartWidget,
      widgetMap: { chart: chartWidget, controller: controllerWidget },
      params: undefined,
    } as any).filterParams,
  ).toEqual([
    expect.objectContaining({
      column: '日期',
      values: [{ value: '2026-10-27', valueType: 'DATE' }],
    }),
  ]);
});
