/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
  AggregateFieldActionType,
  ChartDataSectionType,
  DataViewFieldType,
} from 'app/constants';
import { ChartDataSet } from 'app/models/ChartDataSet';
import { buildClickEventBaseFilters } from 'app/utils/internalChartHelper';
import PivotSheetChart from '../PivotSheetChart';

describe('<PivotSheetChart />', () => {
  let component: InstanceType<typeof PivotSheetChart>;
  beforeEach(() => {
    component = new PivotSheetChart();
  });
  test('It should mount', () => {
    (expect(component) as unknown as { toBeDatartChartModel(): void }).toBeDatartChartModel();
  });

  test('keeps technical identities in selections and linked filters when Chinese labels repeat', () => {
    const origin = {
      colName: 'origin_city',
      fieldId: 'origin-city',
      displayName: '城市',
      type: DataViewFieldType.STRING,
    };
    const destination = {
      colName: 'destination_city',
      fieldId: 'destination-city',
      displayName: '城市',
      type: DataViewFieldType.STRING,
    };
    const amount = {
      colName: 'amount',
      fieldId: 'amount',
      aggregate: AggregateFieldActionType.Sum,
      alias: { name: '总金额' },
    };
    const dataset = new ChartDataSet(
      [['上海', '北京', '100']],
      [
        { name: ['origin_city'] },
        { name: ['destination_city'] },
        { name: ['SUM(amount)'] },
      ] as any,
      [origin, destination, amount] as any,
    );
    const onClick = jest.fn();
    (component as any).mouseEvents = [{ name: 'click', callback: onClick }];

    component.changeSelectedItems(
      [
        {
          getMeta: () => ({
            rowQuery: { origin_city: '上海' },
            colQuery: { destination_city: '北京' },
            data: {
              origin_city: '上海',
              destination_city: '北京',
              'SUM(amount)': '100',
            },
          }),
        },
      ] as any,
      dataset,
    );

    expect(onClick).toHaveBeenCalledTimes(1);
    const rowData = onClick.mock.calls[0][0].selectedItems[0].data.rowData;
    expect(rowData).toEqual({
      origin_city: '上海',
      destination_city: '北京',
      'SUM(amount)': '100',
    });
    const filters = buildClickEventBaseFilters(
      [rowData],
      undefined,
      undefined,
      [
        { type: ChartDataSectionType.Group, rows: [origin, destination] },
      ] as any,
    );
    expect(filters.map(filter => filter.column)).toEqual([
      'origin_city',
      'destination_city',
    ]);
    expect(filters.map(filter => filter.values)).toEqual([
      [{ value: '上海', valueType: DataViewFieldType.STRING }],
      [{ value: '北京', valueType: DataViewFieldType.STRING }],
    ]);
  });
});
