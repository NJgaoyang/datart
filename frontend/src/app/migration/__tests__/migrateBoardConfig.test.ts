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
  MOBILE_MIN_MARGIN,
  MOBILE_MIN_PADDING,
} from 'app/pages/DashBoardPage/constants';
import { DashboardConfigBeta3 } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import {
  beta0,
  migrateBoardConfig,
  parseBoardConfig,
} from '../BoardConfig/migrateBoardConfig';
import {
  APP_CURRENT_VERSION,
  APP_VERSION_BETA_0,
  APP_VERSION_BETA_1,
} from '../constants';
describe('test migrateBoard ', () => {
  test('parse board.config', () => {
    const config = '{}';
    expect(parseBoardConfig(config)).toMatchObject({ type: 'auto' });
  });
  test('Only versions prior to Beta1 can be processed', () => {
    const config = {
      version: APP_VERSION_BETA_1,
    } as DashboardConfigBeta3;
    expect(beta0(config)).toMatchObject({
      version: APP_VERSION_BETA_1,
    });
  });
  test('add config.initialQuery=true if no initialQuery', () => {
    const config = {} as DashboardConfigBeta3;
    expect(beta0(config)).toMatchObject({
      initialQuery: true,
    });
    const config1 = { initialQuery: false } as DashboardConfigBeta3;
    expect(beta0(config1)).toMatchObject(config1);
  });

  test('handle config.mobileMargin', () => {
    const config = {} as DashboardConfigBeta3;
    expect(beta0(config)).toMatchObject({
      mobileMargin: [MOBILE_MIN_MARGIN, MOBILE_MIN_MARGIN],
    });
    const config1 = { mobileMargin: [22, 22] } as DashboardConfigBeta3;
    expect(beta0(config1)).toMatchObject(config1);
  });

  test('handle config.mobileContainerPadding', () => {
    const config = {} as DashboardConfigBeta3;
    expect(beta0(config)).toMatchObject({
      mobileContainerPadding: [MOBILE_MIN_PADDING, MOBILE_MIN_PADDING],
    });
    const config1 = {
      mobileContainerPadding: [22, 22],
    } as DashboardConfigBeta3;
    expect(beta0(config1)).toMatchObject(config1);
  });

  test('test hasQueryControl', () => {
    const config = {} as DashboardConfigBeta3;
    expect(beta0(config)).toMatchObject({
      hasQueryControl: false,
    });
    const config1 = { hasQueryControl: false } as DashboardConfigBeta3;
    expect(beta0(config1)).toMatchObject(config1);

    const config2 = { hasQueryControl: true } as DashboardConfigBeta3;
    expect(beta0(config2)).toMatchObject(config2);
  });

  test('test beta0 version', () => {
    const config = {} as DashboardConfigBeta3;
    expect(beta0(config)).toMatchObject({
      version: APP_VERSION_BETA_0,
    });
    const config1 = { version: APP_VERSION_BETA_0 } as DashboardConfigBeta3;
    expect(beta0(config1)).toMatchObject(config1);
  });

  test('test migrateBoardConfig', () => {
    const config = '{}';
    expect(migrateBoardConfig(config)).toMatchObject({
      type: 'auto',
      version: APP_CURRENT_VERSION,
    } as DashboardConfigBeta3);
  });

  test('preserve legacy auto layout marker after config replacement', () => {
    const config = JSON.stringify({
      type: 'auto',
      version: '',
      background: '#fff',
      initialQuery: true,
      allowOverlap: false,
      margin: [16, 16],
      containerPadding: [16, 16],
      mobileMargin: [8, 8],
      mobileContainerPadding: [8, 8],
    });
    expect(migrateBoardConfig(config)).toMatchObject({
      type: 'auto',
      layoutVersion: 1,
      pcRowLayoutVersion: 1,
    });
  });
});
