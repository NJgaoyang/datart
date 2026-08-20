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

import { ChartDataSectionType, DataViewFieldType } from 'app/constants';
import { ChartDataSectionField, ChartStyleConfig } from 'app/types/ChartConfig';
import { ChartStyleConfigDTO } from 'app/types/ChartConfigDTO';
import {
  diffHeaderRows,
  flattenHeaderRowsWithoutGroupRow,
  getColumnRenderOriginName,
  getUpdatedChartStyleValue,
  isInRange,
  isUnderUpperBound,
  mergeChartDataConfigs,
  mergeChartStyleConfigs,
  reachLowerBoundCount,
  reconcileChartConfigFieldMeta,
  transferChartConfigs,
  transformHierarchyMeta,
  transformMeta,
} from '../internalChartHelper';

describe('Internal Chart Helper ', () => {
  describe.each([
    [0, 0, true],
    [0, 1, false],
    [1, 1, true],
    [0, null, true],
    [1, null, true],
    [0, undefined, true],
    [1, undefined, true],
    [1, '[1, 999]', true],
    [0, '[1, 999]', true],
    [0, [1, 999], false],
    [1, [1, 999], true],
    [999, [1, 999], true],
    [1000, [1, 999], false],
    [1, '1', true],
    [0, '1', false],
    [1, ['1', '999'], true],
    [0, ['1', '999'], false],
  ])('isInRange Test - ', (count, limit, ifInRange) => {
    test(`length ${count} in ${limit} limit is ${ifInRange}`, () => {
      expect(isInRange(limit, count)).toBe(ifInRange);
    });
  });

  describe.each([
    [0, 0, true],
    [0, 1, true],
    [1, 1, true],
    [0, null, true],
    [1, null, true],
    [0, undefined, true],
    [1, undefined, true],
    [1, '[1, 999]', true],
    [0, '[1, 999]', true],
    [0, [1, 999], true],
    [1, [1, 999], true],
    [999, [1, 999], true],
    [1000, [1, 999], false],
    [1, '1', true],
    [0, '1', true],
    [1, ['1', '999'], true],
    [0, ['1', '999'], true],
  ])('isUnderUpperBound Test - ', (count, limit, ifInRange) => {
    test(`length ${count} in ${limit} limit under uppper bound is ${ifInRange}`, () => {
      expect(isUnderUpperBound(limit, count)).toBe(ifInRange);
    });
  });

  describe.each([
    [0, 0, 0],
    [0, 1, 1],
    [1, 1, 0],
    [0, null, 0],
    [1, null, 0],
    [0, undefined, 0],
    [1, undefined, 0],
    [1, '[1, 999]', 0],
    [0, '[1, 999]', 0],
    [0, [1, 999], 1],
    [1, [1, 999], 0],
    [999, [1, 999], -998],
    [1000, [1, 999], -999],
    [1, '1', 0],
    [0, '1', 1],
    [1, ['1', '999'], 0],
    [0, ['1', '999'], 1],
  ])('reachLowerBoundCount Test - ', (count, limit, distance) => {
    test(`length ${count} reach ${limit} limit is ${distance}`, () => {
      expect(reachLowerBoundCount(limit, count)).toBe(distance);
    });
  });

  describe.each([
    [[{}], [{}], [{}]],
    [[{}], [null], [{}]],
    [[{}], [undefined], [{}]],
    [[{ a: 1 }], [{ a: 2 }], [{ a: 1 }]],
    [[{ value: 1 }], [{ value: 2 }], [{ value: 2 }]],
    [[{ value: 1 }], [{ value: 2, b: 1 }], [{ value: 2 }]],
    [[{ value: 1 }], [{ value: 2, b: 1 }, { value: 3 }], [{ value: 2 }]],
    [
      [{ value: 1, default: 'no change' }],
      [{ value: 2, default: 2 }],
      [{ value: 2, default: 'no change' }],
    ],
    [
      [{ value: 1 }, { value: 1 }],
      [{ value: 2, b: 1 }],
      [{ value: 2 }, { value: 1 }],
    ],
    [
      [{ value: 1 }, { value: 1 }],
      [{ value: 2 }, { value: 2, b: 1 }],
      [{ value: 2 }, { value: 2 }],
    ],
    [
      [{ value: 1, rows: [{ value: 1 }] }],
      [{ value: 2 }, { value: 3, rows: [{ value: 3 }] }],
      [{ value: 2, rows: [{ value: 1 }] }],
    ],
    [
      [{ value: 1, rows: [{ value: 1 }] }],
      [
        { value: 2, rows: [{ value: 2, b: 2 }] },
        { value: 3, rows: [{ value: 3 }] },
      ],
      [{ value: 2, rows: [{ value: 2 }] }],
    ],
    [
      [{ value: 1, rows: null }],
      [
        { value: 2, rows: [{ value: 2, b: 2 }] },
        { value: 3, rows: [{ value: 3 }] },
      ],
      [{ value: 2, rows: [{ value: 2, b: 2 }] }],
    ],
    [
      [{ value: 1, rows: [] }],
      [
        { value: 2, rows: [{ value: 2, b: 2, c: 2, d: 2 }] },
        { value: 3, rows: [{ value: 3 }] },
      ],
      [{ value: 2, rows: [{ value: 2, b: 2, c: 2, d: 2 }] }],
    ],
    [
      [{ key: 'a', value: 1 }],
      [{ key: 'a', value: 2 }],
      [{ key: 'a', value: 2 }],
    ],
    [
      [{ key: 'a', value: 1 }],
      [{ key: 'b', value: 2 }],
      [{ key: 'a', value: 1 }],
    ],
    [
      [{ key: 'a', value: 1 }],
      [
        { key: 'b', value: 2 },
        { key: 'a', value: 3 },
      ],
      [{ key: 'a', value: 3 }],
    ],
    [
      [{ key: 'a', value: 1 }],
      [{ value: 2 }, { value: 3 }],
      [{ key: 'a', value: 1 }],
    ],
    [
      [{ key: 'a', value: 1, rows: [{ key: 'aa', value: 1 }] }],
      [
        { key: 'a', value: 2, rows: [{ key: 'aa', value: 2 }] },
        { value: 3, rows: [{ key: 'aa', value: 3 }] },
      ],
      [{ key: 'a', value: 2, rows: [{ key: 'aa', value: 2 }] }],
    ],
    [
      [{ key: 'a', value: 1, rows: [{ key: 'aa', value: 1 }] }],
      [
        { key: 'b', value: 2, rows: [{ key: 'aa', value: 2 }] },
        { key: 'a', value: 3, rows: [{ key: 'aa', value: 3 }] },
      ],
      [{ key: 'a', value: 3, rows: [{ key: 'aa', value: 3 }] }],
    ],
    [
      [
        {
          label: 'a',
          key: 'a',
          comType: 'tabs',
          template: {
            label: 'a-t-l',
            key: 'a-t-k',
            comType: 'group',
            rows: [
              {
                label: 'a-t-1-l',
                key: 'a-t-1-k',
                comType: 'group',
                options: {
                  translateItemLabel: true,
                },
                rows: [
                  {
                    label: 'a-t-1-1-l',
                    key: 'a-t-1-1-k',
                    default: false,
                    comType: 'checkbox',
                    options: {
                      getItems: cols => {
                        return cols?.map(c => c.name)?.includes('id');
                      },
                    },
                  },
                  {
                    label: 'a-t-1-2-l',
                    key: 'a-t-1-2-k',
                    default: false,
                    comType: 'checkbox',
                    watcher: {
                      deps: ['a-t-1-1-k'],
                      action: props => {
                        return {
                          disabled: !props.disabled,
                        };
                      },
                    },
                  },
                ],
              },
            ],
          },
        },
      ],
      [
        {
          label: 'a',
          key: 'a',
          value: 'a',
          comType: 'tabs',
          rows: [
            {
              label: 'a-t-l',
              key: 'a-k', // this level key could be change
              value: 'a-1',
              comType: 'group',
              rows: [
                {
                  label: 'a-t-1-l',
                  key: 'a-t-1-k', // this level key could not be change, use template key
                  value: 'a-1-1',
                  comType: 'group',
                  rows: [
                    {
                      label: 'a-t-1-1-l',
                      key: 'a-t-1-1-k',
                      value: true,
                      default: false,
                      disabled: false,
                      comType: 'checkbox',
                    },
                    {
                      label: 'a-t-1-2-l',
                      key: 'a-t-1-2-k',
                      default: false,
                      comType: 'checkbox',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      [
        {
          label: 'a',
          key: 'a',
          value: 'a',
          comType: 'tabs',
          template: {
            label: 'a-t-l',
            key: 'a-t-k',
            comType: 'group',
            rows: [
              {
                label: 'a-t-1-l',
                key: 'a-t-1-k',
                comType: 'group',
                options: {
                  translateItemLabel: true,
                },
                rows: [
                  {
                    label: 'a-t-1-1-l',
                    key: 'a-t-1-1-k',
                    default: false,
                    comType: 'checkbox',
                    options: {
                      getItems: expect.any(Function),
                    },
                  },
                  {
                    label: 'a-t-1-2-l',
                    key: 'a-t-1-2-k',
                    default: false,
                    comType: 'checkbox',
                    watcher: {
                      deps: ['a-t-1-1-k'],
                      action: expect.any(Function),
                    },
                  },
                ],
              },
            ],
          },
          rows: [
            {
              label: 'a-t-l',
              key: 'a-k',
              value: 'a-1',
              comType: 'group',
              rows: [
                {
                  label: 'a-t-1-l',
                  key: 'a-t-1-k',
                  value: 'a-1-1',
                  comType: 'group',
                  options: {
                    translateItemLabel: true,
                  },
                  rows: [
                    {
                      label: 'a-t-1-1-l',
                      key: 'a-t-1-1-k',
                      value: true,
                      default: false,
                      disabled: false,
                      comType: 'checkbox',
                      options: {
                        getItems: expect.any(Function),
                      },
                    },
                    {
                      label: 'a-t-1-2-l',
                      key: 'a-t-1-2-k',
                      default: false,
                      comType: 'checkbox',
                      watcher: {
                        deps: ['a-t-1-1-k'],
                        action: expect.any(Function),
                      },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
      { useDefault: false },
    ],
  ])('mergeChartStyleConfigs Test - ', (target, source, expected, options?) => {
    test(`deep merge target: ${JSON.stringify(
      target,
    )} from source: ${JSON.stringify(source)} result is ${JSON.stringify(
      expected,
    )} - options ${options ? JSON.stringify(options) : ''}`, () => {
      const result = mergeChartStyleConfigs(
        target as ChartStyleConfig[],
        source as ChartStyleConfigDTO[],
        options,
      );
      expect(result).toEqual(expected);
    });
  });

  describe.each([
    [
      [{ key: 'a', type: 't1', rows: [] }],
      [
        {
          key: 'a',
          type: 't2',
          rows: [{ colName: 'aa', type: 'STRING', category: 'field' }],
        },
      ],
      [
        {
          key: 'a',
          type: 't1',
          rows: [{ colName: 'aa', type: 'STRING', category: 'field' }],
        },
      ],
    ],
    [
      [{ key: 'a', type: 't1', rows: [] }],
      [
        {
          key: 'b',
          type: 't2',
          rows: [{ colName: 'aa', type: 'STRING', category: 'field' }],
        },
      ],
      [
        {
          key: 'a',
          type: 't1',
          rows: [],
        },
      ],
    ],
    [
      [{ key: 'a', rows: [] }],
      [],
      [
        {
          key: 'a',
          rows: [],
        },
      ],
    ],
  ])('mergeChartDataConfigs Test - ', (target, source, expected, options?) => {
    test(`deep merge target: ${JSON.stringify(
      target,
    )} from source: ${JSON.stringify(source)} result is ${JSON.stringify(
      expected,
    )} - options ${options ? JSON.stringify(options) : ''}`, () => {
      const result = mergeChartDataConfigs(target, source as any);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
    });
  });

  describe('transferChartConfigs Test', () => {
    test('should not transfer data when source config is empty', () => {
      const targetConfig = { datas: [], styles: [] };
      const sourceConfig = undefined;
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual(targetConfig);
    });

    test('should not transfer data when target config is empty', () => {
      const targetConfig = undefined;
      const sourceConfig = { datas: [], styles: [] };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual(sourceConfig);
    });

    test('should transfer data configs when section type is group', () => {
      const targetConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            rows: [
              {
                colName: 'label',
                id: '["label"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual(targetConfig);
      expect(result).toEqual(sourceConfig);
    });

    test('should transfer data configs when section type is group and target max row limitation is less then target rows', () => {
      const targetConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            limit: 1,
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            rows: [
              {
                colName: 'label',
                id: '["label"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result?.datas?.[0]?.rows).toEqual([
        {
          colName: 'label',
          id: '["label"]',
          type: DataViewFieldType.STRING,
          category: 'field' as any,
        },
      ]);
    });

    test('should transfer data configs when section type is group and with multi target limitation', () => {
      const targetConfig = {
        datas: [
          {
            key: 'group1',
            type: ChartDataSectionType.Group,
            limit: [0, 1],
            rows: [],
          },
          {
            key: 'group2',
            type: ChartDataSectionType.Group,
            limit: [1, 2],
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label5',
                id: '["label5"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result?.datas?.[0]?.key).toEqual('group1');
      expect(result?.datas?.[0]?.rows).toEqual([
        {
          colName: 'label2',
          id: '["label2"]',
          type: DataViewFieldType.STRING,
          category: 'field' as any,
        },
      ]);
      expect(result?.datas?.[1]?.key).toEqual('group2');
      expect(result?.datas?.[1]?.rows).toEqual([
        {
          colName: 'label1',
          id: '["label1"]',
          type: DataViewFieldType.STRING,
          category: 'field' as any,
        },
        {
          colName: 'label3',
          id: '["label3"]',
          type: DataViewFieldType.STRING,
          category: 'field' as any,
        },
      ]);
    });

    test('should transfer data configs when section type is aggregate, color, info, size, filter, mixed', () => {
      const targetConfig = {
        datas: [
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            rows: [],
          },
          {
            key: 'color',
            type: ChartDataSectionType.Color,
            rows: [],
          },
          {
            key: 'info',
            type: ChartDataSectionType.Info,
            rows: [],
          },
          {
            key: 'size',
            type: ChartDataSectionType.Size,
            rows: [],
          },
          {
            key: 'filter',
            type: ChartDataSectionType.Filter,
            rows: [],
          },
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'color',
            type: ChartDataSectionType.Color,
            rows: [
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'info',
            type: ChartDataSectionType.Info,
            rows: [
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'size',
            type: ChartDataSectionType.Size,
            rows: [
              {
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'filter',
            type: ChartDataSectionType.Filter,
            rows: [
              {
                colName: 'label5',
                id: '["label5"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            rows: [
              {
                colName: 'label6',
                id: '["label6"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual(sourceConfig);
    });

    test('should transfer data configs when section from mixed type to non mixed types', () => {
      const targetConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            limit: [0, 2],
            rows: [],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            limit: [0, 1],
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
              {
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
              {
                colName: 'label5',
                id: '["label5"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual({
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            limit: [0, 2],
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            limit: [0, 1],
            rows: [
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      });
    });

    test('should transfer data configs when section from non mixed type to mixed types and target config only mixed type', () => {
      const targetConfig = {
        datas: [
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            limit: [0, 3],
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            rows: [
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
              {
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual({
        datas: [
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            limit: [0, 3],
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      });
    });

    test('should transfer data configs when section from non mixed type to mixed types and target config with multi-mixed type', () => {
      const targetConfig = {
        datas: [
          {
            key: 'mixed1',
            type: ChartDataSectionType.Mixed,
            limit: 1,
            rows: [],
          },
          {
            key: 'mixed2',
            type: ChartDataSectionType.Mixed,
            limit: [0, 2],
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            rows: [
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
              {
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual({
        datas: [
          {
            key: 'mixed1',
            type: ChartDataSectionType.Mixed,
            limit: 1,
            rows: [
              {
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'mixed2',
            type: ChartDataSectionType.Mixed,
            limit: [0, 2],
            rows: [
              {
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
              {
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      });
    });

    test('should transfer data configs when section from non mixed type to mixed types and target config with other section type', () => {
      const targetConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            limit: [0, 1],
            rows: [],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            limit: 1,
            rows: [],
          },
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            limit: [0, 3],
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            limit: [1, 2],
            rows: [
              {
                uid: '1',
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
              {
                uid: '2',
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            rows: [
              {
                uid: '3',
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
              {
                uid: '4',
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);

      expect(result).toEqual({
        datas: [
          {
            key: 'group',
            type: ChartDataSectionType.Group,
            limit: [0, 1],
            rows: [
              {
                uid: '1',
                colName: 'label1',
                id: '["label1"]',
                type: DataViewFieldType.STRING,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'aggregate',
            type: ChartDataSectionType.Aggregate,
            limit: 1,
            rows: [
              {
                uid: '3',
                colName: 'label3',
                id: '["label3"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
          {
            key: 'mixed',
            type: ChartDataSectionType.Mixed,
            limit: [0, 3],
            rows: [
              {
                uid: '2',
                colName: 'label2',
                id: '["label2"]',
                type: DataViewFieldType.DATE,
                category: 'field' as any,
              },
              {
                uid: '4',
                colName: 'label4',
                id: '["label4"]',
                type: DataViewFieldType.NUMERIC,
                category: 'field' as any,
              },
            ],
          },
        ],
      });
    });

    test('should transfer style configs', () => {
      const targetConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                default: false,
                comType: 'checkbox',
              },
              {
                label: 'common.fontColor',
                key: 'fontColor',
                comType: 'fontColor',
                default: '#495057',
                watcher: {
                  deps: ['enableTotal'],
                  action: props => {
                    return {
                      disabled: props.showLabel,
                    };
                  },
                },
              },
            ],
          },
        ],
      };
      const sourceConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                default: false,
                comType: 'checkbox',
                value: true,
              },
              {
                label: 'common.fontColor',
                key: 'fontColor',
                comType: 'fontColor',
                default: '#495057',
                watcher: {
                  deps: ['enableTotal'],
                  action: props => {
                    return {
                      disabled: props.showLabel,
                    };
                  },
                },
                value: '#333333',
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result?.styles[0].rows?.[0].value).toEqual(true);
      expect(result?.styles[0].rows?.[1].value).toEqual('#333333');
    });

    test('should transfer style configs even if no comType', () => {
      const targetConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                default: false,
              },
              {
                label: 'common.fontColor',
                key: 'fontColor',
                default: '#495057',
                watcher: {
                  deps: ['enableTotal'],
                  action: props => {
                    return {
                      disabled: props.showLabel,
                    };
                  },
                },
              },
            ],
          },
        ],
      };
      const sourceConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                default: false,
                comType: 'checkbox',
                value: true,
              },
              {
                label: 'common.fontColor',
                key: 'fontColor',
                comType: 'fontColor',
                default: '#495057',
                watcher: {
                  deps: ['enableTotal'],
                  action: props => {
                    return {
                      disabled: props.showLabel,
                    };
                  },
                },
                value: '#333333',
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig as any, sourceConfig);
      expect(result?.styles[0].rows?.[0].value).toEqual(true);
      expect(result?.styles[0].rows?.[1].value).toEqual('#333333');
    });

    test('should transfer style configs by using target default value', () => {
      const targetConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                default: false,
                comType: 'checkbox',
              },
            ],
          },
        ],
      };
      const sourceConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                comType: 'checkbox',
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result?.styles[0].rows?.[0].value).toEqual(false);
    });

    test('should transfer all style configs when target rows is empty', () => {
      const targetConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [],
          },
        ],
      };
      const sourceConfig = {
        styles: [
          {
            label: 'stack.title',
            key: 'stack',
            comType: 'group',
            rows: [
              {
                label: 'stack.enable',
                key: 'enable',
                default: false,
                comType: 'checkbox',
                value: true,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result?.styles[0].rows?.[0]).toEqual({
        label: 'stack.enable',
        key: 'enable',
        default: false,
        comType: 'checkbox',
        value: true,
      });
    });

    test('should transfer setting configs', () => {
      const targetConfig = {
        settings: [
          {
            label: 'viz.palette.setting.paging.title',
            key: 'paging',
            comType: 'group',
            rows: [
              {
                label: 'viz.palette.setting.paging.pageSize',
                key: 'pageSize',
                default: 1000,
                comType: 'inputNumber',
                options: {
                  needRefresh: true,
                  step: 1,
                  min: 0,
                },
              },
            ],
          },
        ],
      };
      const sourceConfig = {
        settings: [
          {
            label: 'viz.palette.setting.paging.title',
            key: 'paging',
            comType: 'group',
            rows: [
              {
                label: 'viz.palette.setting.paging.pageSize',
                key: 'pageSize',
                default: 1000,
                comType: 'inputNumber',
                options: {
                  needRefresh: true,
                  step: 1,
                  min: 0,
                },
                value: 1100,
              },
            ],
          },
        ],
      };
      const result = transferChartConfigs(targetConfig, sourceConfig);
      expect(result).toEqual(sourceConfig);
    });
  });

  describe('diffHeaderRows Test', () => {
    test('should verify two different rows with different length', () => {
      const oldRows = [{ colName: 'a' }, { colName: 'b' }];
      const newRows = [{ colName: 'a' }];
      const isDifferent = diffHeaderRows(oldRows, newRows);
      expect(isDifferent).toBeTruthy();
    });

    test('should be different when have different values', () => {
      const oldRows = [{ colName: 'a' }, { colName: 'b' }];
      const newRows = [{ colName: 'a' }, { colName: 'c' }];
      const isDifferent = diffHeaderRows(oldRows, newRows);
      expect(isDifferent).toBeTruthy();
    });

    test('should be same even if order is different', () => {
      const oldRows = [{ colName: 'a' }, { colName: 'b' }];
      const newRows = [{ colName: 'b' }, { colName: 'a' }];
      const isDifferent = diffHeaderRows(oldRows, newRows);
      expect(isDifferent).toBeFalsy();
    });
  });

  describe('flattenHeaderRowsWithoutGroupRow Test', () => {
    test('should flatten to get all rows without children', () => {
      const groupHeaderRow = {
        colName: 'a',
        isGroup: undefined,
      };
      const results = flattenHeaderRowsWithoutGroupRow(groupHeaderRow);
      expect(results).toEqual([{ colName: 'a', isGroup: undefined }]);
    });

    test('should flatten to get all rows with children', () => {
      const groupHeaderRow = {
        colName: 'a',
        id: '["a"]',
        isGroup: true,
        children: [
          { colName: 'a-1', id: '["a-1"]', isGroup: false, children: [] },
          {
            colName: 'a-b',
            id: '["a-b"]',
            isGroup: true,
            children: [
              {
                colName: 'a-b-1',
                id: '["a-b-1"]',
                isGroup: false,
                children: [],
              },
            ],
          },
        ],
      };
      const results = flattenHeaderRowsWithoutGroupRow(groupHeaderRow);
      expect(results).toEqual([
        { colName: 'a-1', id: '["a-1"]', isGroup: false, children: [] },
        { colName: 'a-b-1', id: '["a-b-1"]', isGroup: false, children: [] },
      ]);
    });
  });

  describe('transformMeta Test', () => {
    test('should not transform meta when config model is empty', () => {
      const model = undefined;
      const metas = transformMeta(model);
      expect(metas).toEqual(undefined);
    });

    test('should transform meta without hierarchy and no children', () => {
      const model = JSON.stringify({ a: { type: 'STRING' } });
      const metas = transformMeta(model);
      expect(metas).toEqual([{ category: 'field', path: 'a', type: 'STRING' }]);
    });

    test('should transform meta without hierarchy but have children', () => {
      const model = JSON.stringify({
        a: {
          type: 'STRING',
          children: [
            { name: 1, path: [1] },
            { name: 2, path: [2] },
          ],
        },
      });
      const metas = transformMeta(model);
      expect(metas).toEqual([
        { name: 1, path: [1], category: 'field' },
        { name: 2, path: [2], category: 'field' },
      ]);
    });

    test('should transform meta with hierarchy', () => {
      const model = JSON.stringify({
        hierarchy: {
          someFiled: {
            name: 'a',
            children: [
              { name: 'b', value: 1, path: ['b'] },
              { name: 'c', value: 2, path: ['c'] },
            ],
          },
        },
      });
      const metas = transformMeta(model);
      expect(metas).toEqual([
        { name: 'b', value: 1, path: ['b'], category: 'field' },
        { name: 'c', value: 2, path: ['c'], category: 'field' },
      ]);
    });

    test('should use column comments for flat controller metadata', () => {
      const model = JSON.stringify({
        columns: {
          available_battery_per_non_storage_user_ratio: {
            name: ['available_battery_per_non_storage_user_ratio'],
            displayName: 'available_battery_per_non_storage_user_ratio',
            comment: '非储能用户可用电池比例',
          },
        },
        hierarchy: {
          battery: {
            children: [
              {
                name: 'available_battery_per_non_storage_user_ratio',
              },
            ],
          },
        },
      });

      expect(transformMeta(model)?.[0]).toMatchObject({
        comment: '非储能用户可用电池比例',
      });
      expect(transformMeta(model)?.[0].displayName).toBeUndefined();
    });
  });

  describe('getColumnRenderOriginName Test', () => {
    test('should get unknown name when config is empty', () => {
      const config = undefined;
      const result = getColumnRenderOriginName(config);
      expect(result).toEqual('[unknown]');
    });

    test('should get name without aggregate', () => {
      const config = {
        colName: 'a',
      };
      const result = getColumnRenderOriginName(config as ChartDataSectionField);
      expect(result).toEqual('a');
    });

    test('should fall back to the legacy comment when displayName is the origin name', () => {
      const result = getColumnRenderOriginName({
        colName: 'created_date',
        displayName: 'created_date',
        comment: '创建时间',
        isDisplayNameCustom: false,
      } as ChartDataSectionField);

      expect(result).toEqual('创建时间');
    });

    test('should keep the origin name when no trusted display metadata exists', () => {
      const result = getColumnRenderOriginName({
        colName: 'cabinet_efficiency',
        displayName: 'cabinet_efficiency',
        isDisplayNameCustom: false,
      } as ChartDataSectionField);

      expect(result).toEqual('cabinet_efficiency');
    });

    test('should get name with aggregate', () => {
      const config = {
        colName: 'a',
        aggregate: 'AVG',
      };
      const result = getColumnRenderOriginName(config as ChartDataSectionField);
      expect(result).toEqual('AVG(a)');
    });
  });

  describe('transformHierarchyMeta Test', () => {
    test('should get empty array when metas is null', () => {
      const metas = transformHierarchyMeta(undefined);
      expect(metas).toEqual([]);
    });

    test('uses SQL output names as query paths even when model has physical paths', () => {
      const model = {
        columns: {
          recommender_city_name_std: {
            name: 'recommender_city_name_std',
            path: ['ads', 'daily', 'recommender_city_name_std'],
            fieldId: 'field-1',
          },
        },
      };
      const metas = transformHierarchyMeta(
        JSON.stringify(model),
        [
          {
            fieldId: 'field-1',
            originName: 'recommender_city_name_std',
            displayName: '推荐官城市',
            sourcePath: ['ads', 'daily', 'recommender_city_name_std'],
          },
        ],
        'SQL',
      );

      expect(metas[0].path).toEqual(['recommender_city_name_std']);
      expect(metas[0].displayName).toBe('推荐官城市');
    });

    test('keeps physical paths for STRUCT views', () => {
      const metas = transformHierarchyMeta(
        JSON.stringify({
          columns: {
            city: {
              name: ['ads', 'daily', 'city'],
              path: ['ads', 'daily', 'city'],
            },
          },
        }),
        undefined,
        'STRUCT',
      );

      expect(metas[0].path).toEqual(['ads', 'daily', 'city']);
    });

    test('should get columns when hierarchy is null or empty', () => {
      const model = {
        hierarchy: {},
        columns: {
          a: {
            name: 'a',
            primaryKey: true,
            type: 'STRING',
            category: 'UNCATEGORIZED',
            role: 'role',
          },
          b: {
            name: 'b',
            primaryKey: false,
            type: 'NUMERIC',
            category: 'UNCATEGORIZED',
            role: 'role',
          },
        },
      };
      const metas = transformHierarchyMeta(JSON.stringify(model));
      expect(metas).toEqual([
        {
          name: 'a',
          primaryKey: true,
          type: 'STRING',
          category: 'field',
          role: 'role',
          subType: 'UNCATEGORIZED',
        },
        {
          name: 'b',
          primaryKey: false,
          type: 'NUMERIC',
          category: 'field',
          role: 'role',
          subType: 'UNCATEGORIZED',
        },
      ]);
    });

    test('should prioritize custom name, comment, then field name for display', () => {
      const model = {
        columns: {
          custom: {
            name: ['custom'],
            type: 'STRING',
            category: 'UNCATEGORIZED',
            displayName: '自定义名称',
            comment: '字段注释',
          },
          commented: {
            name: ['commented'],
            type: 'STRING',
            category: 'UNCATEGORIZED',
            comment: '字段注释',
          },
          defaultName: {
            name: ['defaultName'],
            type: 'STRING',
            category: 'UNCATEGORIZED',
            displayName: 'defaultName',
            comment: '字段注释',
          },
        },
      };

      const metas = transformHierarchyMeta(JSON.stringify(model));

      expect(metas.map(meta => meta.displayName)).toEqual([
        '自定义名称',
        undefined,
        undefined,
      ]);
      expect(metas.map(meta => meta.comment)).toEqual([
        '字段注释',
        '字段注释',
        '字段注释',
      ]);
    });

    test('should reuse column display metadata for hierarchy fields', () => {
      const model = {
        hierarchy: {
          battery: {
            name: 'battery',
            type: 'STRING',
            children: [
              {
                name: 'available_battery_per_non_storage_user_ratio',
                type: 'NUMERIC',
                category: 'UNCATEGORIZED',
              },
            ],
          },
        },
        columns: {
          available_battery_per_non_storage_user_ratio: {
            name: ['available_battery_per_non_storage_user_ratio'],
            type: 'NUMERIC',
            comment: '非储能用户可用电池比例',
          },
        },
      };

      const metas = transformHierarchyMeta(JSON.stringify(model));

      expect(metas[0].children?.[0].comment).toBe('非储能用户可用电池比例');
    });

    test('should not reuse ambiguous same-name column metadata', () => {
      const model = {
        hierarchy: {
          battery: {
            children: [
              { name: 'ratio', path: ['table_a', 'ratio'] },
              { name: 'ratio', path: ['table_b', 'ratio'] },
            ],
          },
        },
        columns: {
          'table_a.ratio': {
            name: ['table_a', 'ratio'],
            comment: '表A比例',
          },
          'table_b.ratio': {
            name: ['table_b', 'ratio'],
            comment: '表B比例',
          },
        },
      };

      const children = transformHierarchyMeta(JSON.stringify(model))[0]
        .children;
      expect(children?.map(child => child.comment)).toEqual([
        '表A比例',
        '表B比例',
      ]);
    });

    test('should get hierarchy metas', () => {
      const model = {
        hierarchy: {
          a: {
            name: 'a',
            primaryKey: true,
            type: 'STRING',
            category: 'UNCATEGORIZED',
            role: 'hierarchy',
            children: [
              {
                name: 'a-1',
                primaryKey: true,
                type: 'STRING',
                category: 'UNCATEGORIZED',
                role: 'role',
              },
              {
                name: 'a-2',
                primaryKey: true,
                type: 'NUMERIC',
                category: 'UNCATEGORIZED',
                role: 'role',
              },
            ],
          },
          b: {
            name: 'b',
            primaryKey: true,
            type: 'STRING',
            category: 'UNCATEGORIZED',
            role: 'hierarchy',
            children: [
              {
                name: 'b-1',
                primaryKey: true,
                type: 'DATE',
                category: 'UNCATEGORIZED',
                role: 'role',
              },
            ],
          },
          c: {
            name: 'c',
            primaryKey: true,
            type: 'NUMERIC',
            category: 'UNCATEGORIZED',
            role: 'role',
          },
        },
        columns: {
          x: {
            name: 'x',
            primaryKey: true,
            type: 'STRING',
            category: 'UNCATEGORIZED',
            role: 'role',
          },
        },
      };
      const metas = transformHierarchyMeta(JSON.stringify(model));
      expect(metas).toEqual([
        {
          name: 'a',
          primaryKey: true,
          type: 'STRING',
          category: 'hierarchy',
          role: 'hierarchy',
          children: [
            {
              name: 'a-1',
              primaryKey: true,
              type: 'STRING',
              category: 'field',
              role: 'role',
              subType: 'UNCATEGORIZED',
              children: undefined,
            },
            {
              name: 'a-2',
              primaryKey: true,
              type: 'NUMERIC',
              category: 'field',
              role: 'role',
              subType: 'UNCATEGORIZED',
              children: undefined,
            },
          ],
          subType: 'UNCATEGORIZED',
        },
        {
          name: 'b',
          primaryKey: true,
          type: 'STRING',
          category: 'hierarchy',
          role: 'hierarchy',
          children: [
            {
              name: 'b-1',
              primaryKey: true,
              type: 'DATE',
              category: 'field',
              role: 'role',
              subType: 'UNCATEGORIZED',
              children: undefined,
            },
          ],
          subType: 'UNCATEGORIZED',
        },
        {
          name: 'c',
          primaryKey: true,
          type: 'NUMERIC',
          category: 'field',
          role: 'role',
          subType: 'UNCATEGORIZED',
          children: undefined,
        },
      ]);
    });
  });

  test('falls back when a chart fieldId is stale', () => {
    const config = {
      datas: [
        {
          rows: [{ category: 'field', colName: 'id', fieldId: 'stale' }],
        },
      ],
    } as any;
    const fields = [
      {
        name: 'id',
        fieldId: 'current',
        path: ['users', 'id'],
        displayName: '用户编号',
      },
    ] as any;

    const result = reconcileChartConfigFieldMeta(config as any, fields);

    expect(result.datas?.[0].rows?.[0]).toMatchObject({
      fieldId: 'current',
      path: ['users', 'id'],
      displayName: '用户编号',
    });
  });

  test('synchronizes cached chart displayName from the latest ViewField metadata', () => {
    const config = {
      datas: [
        {
          rows: [
            {
              category: 'field',
              colName: 'net_increase_users',
              displayName: '在租用户较昨日净增人数',
              isDisplayNameCustom: true,
            },
          ],
        },
      ],
    } as any;
    const fields = [
      {
        name: 'net_increase_users',
        fieldId: 'current',
        displayName: 'net_increase_users',
        isDisplayNameCustom: false,
      },
    ] as any;

    const result = reconcileChartConfigFieldMeta(config, fields);

    expect(result.datas?.[0].rows?.[0]).toMatchObject({
      fieldId: 'current',
      displayName: 'net_increase_users',
    });
  });

  test('keeps chart alias while synchronizing field identity', () => {
    const config = {
      datas: [
        {
          rows: [
            {
              category: 'field',
              colName: 'net_increase_users',
              alias: { name: '净增' },
              displayName: '历史字段名',
              isDisplayNameCustom: true,
            },
          ],
        },
      ],
    } as any;
    const fields = [
      {
        name: 'net_increase_users',
        fieldId: 'current',
        displayName: '在租用户较昨日净增人数',
        isDisplayNameCustom: false,
      },
    ] as any;

    const result = reconcileChartConfigFieldMeta(config, fields);

    expect(result.datas?.[0].rows?.[0]).toMatchObject({
      fieldId: 'current',
      alias: { name: '净增' },
      displayName: '在租用户较昨日净增人数',
    });
  });

  test('ignores non-array view field metadata', () => {
    const metas = transformHierarchyMeta(
      JSON.stringify({ columns: { id: { name: 'id' } } }),
      { $ref: '$.data.views[0].fields' } as any,
    );

    expect(metas[0].name).toBe('id');
  });

  describe.each([
    [false, 0, false],
    [false, true, true],

    [0, '11', '11'],
    ['0', 12, 12],
    [0, 13, 13],
    ['0', '14', '14'],

    [{ font: 'default1' }, { font: 'Ping Fang1' }, { font: 'Ping Fang1' }],
    [{ font: 'default2' }, { font: 'Ping Fang2' }, { font: 'Ping Fang2' }],
    [[1, 2, 3], { font: 'Ping Fang' }, [1, 2, 3]],
    [{ font: 'default3' }, [4, 5, 6], { font: 'default3' }],
    [{ font: 'default4' }, '[4,5,6]', { font: 'default4' }],
    [[7, 8, 9], '789', [7, 8, 9]],

    [null, '111', '111'],
    [null, 123, 123],
    [null, [10, 11, 12], [10, 11, 12]],
    [null, { abc: 'abc' }, { abc: 'abc' }],
    [null, false, false],
    [null, undefined, undefined],
    [null, null, null],

    [undefined, undefined, undefined],
    [undefined, null, null],
    [undefined, 'abcd', 'abcd'],
    [undefined, 54321, 54321],
    [undefined, [21, 22, 23], [21, 22, 23]],
    [undefined, { esc: 'esc' }, { esc: 'esc' }],
  ])('determineCanUpdateValueByType Test - ', (target, source, expected) => {
    test(`deep merge target: ${JSON.stringify(
      target,
    )} from source: ${JSON.stringify(source)} result is ${JSON.stringify(
      expected,
    )}`, () => {
      const result = getUpdatedChartStyleValue(target, source);
      expect(JSON.stringify(result)).toBe(JSON.stringify(expected));
    });
  });
});
