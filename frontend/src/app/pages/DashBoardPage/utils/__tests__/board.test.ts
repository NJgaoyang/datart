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

import { BoardConfigValue } from '../../components/BoardProvider/BoardConfigProvider';
import { MOBILE_MIN_MARGIN, MOBILE_MIN_PADDING } from '../../constants';
import { initAutoBoardConfig } from '../autoBoard';
import { getAutoBoardRowHeight, getBoardMarginPadding } from '../board';

describe('test getBoardMarginPadding', () => {
  const boardConfig = {
    margin: [10, 10],
    padding: [20, 20],
    mMargin: [12, 12],
    mPadding: [13, 13],
    seamlessSpacing: false,
  };
  it('should colsKey=lg ', () => {
    expect(
      getBoardMarginPadding(boardConfig as BoardConfigValue, 'lg'),
    ).toEqual({
      curMargin: boardConfig.margin,
      curPadding: boardConfig.padding,
    });
  });
  it('should colsKey=sm has mobileData', () => {
    expect(
      getBoardMarginPadding(boardConfig as BoardConfigValue, 'sm'),
    ).toEqual({
      curMargin: boardConfig.mMargin,
      curPadding: boardConfig.mPadding,
    });
  });
  it('should colsKey=sm has no mobileData', () => {
    const config = {
      ...boardConfig,
      mMargin: undefined,
      mPadding: undefined,
    };
    expect(getBoardMarginPadding(config as any, 'sm')).toEqual({
      curMargin: [MOBILE_MIN_MARGIN, MOBILE_MIN_MARGIN],
      curPadding: [MOBILE_MIN_PADDING, MOBILE_MIN_PADDING],
    });
  });
});

describe('one-pixel saved defaults for newly created dashboards', () => {
  it('removes all pixel gutters by default, without changing stored spacing', () => {
    const old = { margin: [12, 16], padding: [8, 24],
      mMargin: [3, 6], mPadding: [5, 9] } as BoardConfigValue;
    expect(getBoardMarginPadding(old, 'lg')).toEqual({
      curMargin: [0, 0], curPadding: [0, 0],
    });
    expect(getBoardMarginPadding(old, 'sm')).toEqual({
      curMargin: [0, 0], curPadding: [0, 0],
    });
    expect(getBoardMarginPadding({ ...old, seamlessSpacing: false }, 'lg'))
      .toEqual({ curMargin: [12, 16], curPadding: [8, 24] });
  });
  it('initializes all auto-dashboard desktop and mobile spacing to one', () => {
    const config = initAutoBoardConfig();
    expect(config.jsonConfig.props.find(item => item.key === 'basic')
      ?.rows?.find(row => row.key === 'seamlessSpacing')?.value).toBe(true);
    for (const key of ['space', 'mSpace']) {
      const group = config.jsonConfig.props.find(item => item.key === key);
      expect(group?.rows).toHaveLength(4);
      for (const item of group?.rows || []) {
        expect(item.value).toBe(1);
        expect(item.default).toBe(1);
      }
    }
  });

  it('preserves explicit existing spacing and supports zeros', () => {
    const custom = {
      seamlessSpacing: false,
      margin: [9, 5],
      padding: [6, 8],
      mMargin: [3, 1],
      mPadding: [4, 2],
    } as BoardConfigValue;
    expect(getBoardMarginPadding(custom, 'lg').curMargin).toEqual([9, 5]);
    expect(getBoardMarginPadding(custom, 'sm').curPadding).toEqual([4, 2]);
    const zero = {
      ...custom,
      margin: [0, 0],
      padding: [0, 0],
      mMargin: [0, 0],
      mPadding: [0, 0],
    } as BoardConfigValue;
    expect(getBoardMarginPadding(zero, 'lg').curMargin).toEqual([0, 0]);
    expect(getBoardMarginPadding(zero, 'sm').curPadding).toEqual([0, 0]);
  });
});

describe('seamless automatic-grid preserves table height', () => {
  const base = {
    margin: [8, 8],
    padding: [16, 16],
    mMargin: [3, 5],
    mPadding: [2, 2],
  } as BoardConfigValue;

  it('preserves the saved desktop row pitch instead of shrinking tables', () => {
    const config = { ...base, seamlessSpacing: true };
    const oldHeight = 10 * 8 + 9 * 8;
    const newRowHeight = getAutoBoardRowHeight(config, 'lg', 8);
    expect(newRowHeight).toBe(16);
    expect(10 * newRowHeight - oldHeight).toBe(8);
    expect(getBoardMarginPadding(config, 'lg').curMargin).toEqual([0, 0]);
  });

  it('compensates mobile spacing too', () => {
    expect(getAutoBoardRowHeight({ ...base, seamlessSpacing: true }, 'sm', 24)).toBe(29);
  });

  it('does not change row height when seamless is off', () => {
    const config = { ...base, seamlessSpacing: false };
    expect(getAutoBoardRowHeight(config, 'lg', 8)).toBe(8);
    expect(getAutoBoardRowHeight(config, 'sm', 24)).toBe(24);
  });

  it('does not inflate a zero-gutter grid', () => {
    const config = {
      ...base,
      seamlessSpacing: true,
      margin: [0, 0],
      mMargin: [0, 0],
    } as BoardConfigValue;
    expect(getAutoBoardRowHeight(config, 'lg', 8)).toBe(8);
    expect(getAutoBoardRowHeight(config, 'sm', 24)).toBe(24);
  });
});
