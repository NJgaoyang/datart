import { DataViewFieldType } from 'app/constants';
import {
  resolveMobilePresentation,
  resolveMobileTableDisplayMode,
} from '../MobilePresentationResolver';

const field = (type: DataViewFieldType, colName: string, aggregate?: string) =>
  ({ type, colName, category: 'field', uid: colName, aggregate } as any);

describe('MobilePresentationResolver', () => {
  it('uses KPI grid for one row with multiple measures', () => {
    expect(
      resolveMobileTableDisplayMode({ rows: [['1', '2']] }, [
        field(DataViewFieldType.NUMERIC, '销售额', 'SUM'),
        field(DataViewFieldType.NUMERIC, '订单数', 'COUNT'),
      ]),
    ).toBe('kpi-grid');
  });

  it('uses ranking list when a rank field is present', () => {
    expect(
      resolveMobileTableDisplayMode(
        {
          rows: [
            ['1', '上海店', '100'],
            ['2', '苏州店', '90'],
          ],
        },
        [
          field(DataViewFieldType.NUMERIC, '排名'),
          field(DataViewFieldType.STRING, '门店'),
          field(DataViewFieldType.NUMERIC, '销售额', 'SUM'),
        ],
      ),
    ).toBe('ranking-list');
  });

  it('uses card list for a small entity table', () => {
    expect(
      resolveMobilePresentation(
        {
          rows: [
            ['上海店', '100'],
            ['苏州店', '90'],
          ],
        },
        {
          datas: [
            {
              key: 'mixed',
              rows: [
                field(DataViewFieldType.STRING, '门店'),
                field(DataViewFieldType.NUMERIC, '销售额', 'SUM'),
              ],
            },
          ],
        } as any,
      ),
    ).toBe('card-list');
  });

  it('uses aggregate KPI grid for multiple cities', () => {
    expect(
      resolveMobileTableDisplayMode(
        {
          rows: [
            ['南京市', '100', '20'],
            ['苏州市', '80', '10'],
          ],
        },
        [
          field(DataViewFieldType.STRING, '城市'),
          field(DataViewFieldType.NUMERIC, '在租用户数', 'SUM'),
          field(DataViewFieldType.NUMERIC, '净增用户数', 'SUM'),
        ],
      ),
    ).toBe('kpi-grid');
  });

  it('falls back to table for date detail data', () => {
    expect(
      resolveMobileTableDisplayMode({ rows: [['2026-08-31', '100']] }, [
        field(DataViewFieldType.DATE, '日期'),
        field(DataViewFieldType.NUMERIC, '收入', 'SUM'),
      ]),
    ).toBe('table');
  });
});
