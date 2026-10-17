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

import BasicTableChart, {
  clampMobileTableColumnWidth,
} from '../BasicTableChart';

describe('<BasicTableChart />', () => {
  let component;
  beforeEach(() => {
    component = new BasicTableChart();
  });
  test('1000 string-valued metric rows do not make columns thousands of pixels wide', () => {
    const fields = [
      { uid: 'city', type: 'STRING', label: '城市' },
      { uid: 'orders', type: 'NUMERIC', label: '48V订单数', aggregate: 'SUM' },
    ];
    const rows = Array.from({ length: 1000 }, (_, index) => {
      const data = { city: index % 2 ? '南通市' : '南京市', orders: '98278' };
      return { getCell: field => data[field.uid] };
    });
    rows.getFieldKey = field => field.label;
    // Deterministic 8px per character; excludes fonts/browser availability.
    component.getTextWidth = (_, value) => String(value).length * 8;
    const summarySettings = [{
      key: 'summary',
      rows: [{ key: 'aggregateFields', value: ['orders'] }],
    }];
    const widths = component.calculateFieldsMaxWidth(
      fields,
      rows,
      [],
      { translator: () => '合计' },
      summarySettings,
      false,
    );
    expect(widths['城市'].columnWidthValue).toBe(88);
    expect(widths['48V订单数'].columnWidthValue).toBe(112);
    expect(widths['48V订单数'].columnWidthValue).toBeLessThan(220);
  });

  test('uses the visible column label rather than the long SQL key for sizing', () => {
    const fields = [
      {
        uid: 'city', type: 'STRING',
        fieldId: 'city-field', originName: 'city', displayName: '城市',
        colName: 's_order_daily_report.city',
      },
      {
        uid: 'orders', type: 'NUMERIC',
        fieldId: 'orders-field', originName: 'order_48v',
        colName: 's_order_daily_report.order_48v', aggregate: 'SUM',
        alias: { name: '48V订单数' },
      },
    ];
    const rows = Array.from({ length: 1000 }, (_, index) => {
      const data = { city: index % 2 ? '南通市' : '南京市', orders: '98278' };
      return { getCell: field => data[field.uid] };
    });
    rows.getFieldKey = field =>
      field.aggregate
        ? `SUM(${field.colName})`
        : field.colName;
    component.getTextWidth = (_, value) => String(value).length * 8;
    const widths = component.calculateFieldsMaxWidth(
      fields, rows, [], { translator: () => '合计' }, [], false,
    );
    expect(widths['s_order_daily_report.city'].columnWidthValue).toBe(88);
    expect(
      widths['SUM(s_order_daily_report.order_48v)'].columnWidthValue,
    ).toBe(112);
  });

  test('It should mount', () => {
    expect(component).toBeDatartChartModel();
  });

  test('It should keep mobile columns compact without collapsing content', () => {
    expect(clampMobileTableColumnWidth(40)).toBe(72);
    expect(clampMobileTableColumnWidth(100)).toBe(100);
    expect(clampMobileTableColumnWidth(300)).toBe(144);
  });
});
