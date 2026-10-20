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


// Test-only view of the chart's internal column sizing contract. Keeping
// production members private avoids exposing implementation as public API.
type TableWidthTestSurface = {
  getTextWidth: (...args: unknown[]) => number;
  calculateFieldsMaxWidth: (
    fields: unknown,
    rows: unknown,
    styles: unknown,
    context: unknown,
    settings: unknown,
    isMobile: boolean,
  ) => Record<string, { columnWidthValue: number }>;
};

describe('<BasicTableChart />', () => {
  let component: BasicTableChart;
  let internal: TableWidthTestSurface;
  beforeEach(() => {
    component = new BasicTableChart();
    internal = component as unknown as TableWidthTestSurface;
  });
  test('1000 string-valued metric rows do not make columns thousands of pixels wide', () => {
    const fields = [
      { uid: 'city', type: 'STRING', label: '城市' },
      { uid: 'orders', type: 'NUMERIC', label: '48V订单数', aggregate: 'SUM' },
    ];
    const rows = Array.from({ length: 1000 }, (_, index) => {
      const data = { city: index % 2 ? '南通市' : '南京市', orders: '98278' };
      return { getCell: (field: { uid: 'city' | 'orders' }) => data[field.uid] };
    });
    Object.assign(rows, { getFieldKey: (field: { label: string }) => field.label });
    // Deterministic 8px per character; excludes fonts/browser availability.
    internal.getTextWidth = (_, value) => String(value).length * 8;
    const summarySettings = [{
      key: 'summary',
      rows: [{ key: 'aggregateFields', value: ['orders'] }],
    }];
    const widths = internal.calculateFieldsMaxWidth(
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
      return { getCell: (field: { uid: 'city' | 'orders' }) => data[field.uid] };
    });
    Object.assign(rows, { getFieldKey: (field: { aggregate?: string; colName: string }) =>
      field.aggregate
        ? `SUM(${field.colName})`
        : field.colName });
    internal.getTextWidth = (_, value) => String(value).length * 8;
    const widths = internal.calculateFieldsMaxWidth(
      fields, rows, [], { translator: () => '合计' }, [], false,
    );
    expect(widths['s_order_daily_report.city'].columnWidthValue).toBe(88);
    expect(
      widths['SUM(s_order_daily_report.order_48v)'].columnWidthValue,
    ).toBe(112);
  });

  test('It should mount', () => {
    (expect(component) as unknown as { toBeDatartChartModel(): void }).toBeDatartChartModel();
  });

  test('It should keep mobile columns compact without collapsing content', () => {
    expect(clampMobileTableColumnWidth(40)).toBe(72);
    expect(clampMobileTableColumnWidth(100)).toBe(100);
    expect(clampMobileTableColumnWidth(300)).toBe(144);
  });
});
