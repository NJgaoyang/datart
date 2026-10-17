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
import { getBoardMarginPadding, getInitBoardConfigBeta3 } from '../board';
import { initAutoBoardConfig } from '../autoBoard';

describe('test getBoardMarginPadding', () => {
  const boardConfig = {
    margin: [10, 10],
    padding: [20, 20],
    mMargin: [12, 12],
    mPadding: [13, 13],
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

describe('zero default spacing for newly created dashboards', () => {
  it('initializes all auto-dashboard desktop and mobile spacing to zero', () => {
    const config = initAutoBoardConfig();
    for (const key of ['space', 'mSpace']) {
      const group = config.jsonConfig.props.find(item => item.key === key);
      expect(group?.rows).toHaveLength(4);
      for (const item of group?.rows || []) {
        expect(item.value).toBe(0);
        expect(item.default).toBe(0);
      }
    }
  });

  it('keeps legacy config defaults zero, without overriding existing custom spacing', () => {
    const config = getInitBoardConfigBeta3('auto');
    expect(config.margin).toEqual([0, 0]);
    expect(config.containerPadding).toEqual([0, 0]);
    expect(config.mobileMargin).toEqual([0, 0]);
    expect(config.mobileContainerPadding).toEqual([0, 0]);
  });

  it('preserves explicit existing spacing and supports zeros', () => {
    const custom = { margin: [9, 5], padding: [6, 8], mMargin: [3, 1], mPadding: [4, 2] } as BoardConfigValue;
    expect(getBoardMarginPadding(custom, 'lg').curMargin).toEqual([9, 5]);
    expect(getBoardMarginPadding(custom, 'sm').curPadding).toEqual([4, 2]);
    const zero = { ...custom, margin: [0, 0], padding: [0, 0], mMargin: [0, 0], mPadding: [0, 0] } as BoardConfigValue;
    expect(getBoardMarginPadding(zero, 'lg').curMargin).toEqual([0, 0]);
    expect(getBoardMarginPadding(zero, 'sm').curPadding).toEqual([0, 0]);
  });
});