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
import { APP_CURRENT_VERSION } from 'app/migration/constants';
import {
  AUTO_LAYOUT_VERSION,
  MOBILE_LAYOUT_VERSION,
  MOBILE_MIN_MARGIN,
  MOBILE_MIN_PADDING,
  PC_ROW_LAYOUT_VERSION,
} from '../constants';
import { BoardConfig } from '../types/boardTypes';

export const initAutoBoardConfig = () => {
  const config: BoardConfig = {
    type: 'auto',
    version: APP_CURRENT_VERSION,
    layoutVersion: AUTO_LAYOUT_VERSION,
    mobileLayoutVersion: MOBILE_LAYOUT_VERSION,
    pcRowLayoutVersion: PC_ROW_LAYOUT_VERSION,

    jsonConfig: {
      props: [
        {
          label: 'basic.basic',
          key: 'basic',
          comType: 'group',
          rows: [
            {
              label: 'basic.initialQuery',
              key: 'initialQuery',
              value: true,
              comType: 'switch',
            },
            {
              label: 'basic.allowOverlap',
              key: 'allowOverlap',
              value: false,
              comType: 'switch',
            },
          ],
        },
        {
          label: 'space.space',
          key: 'space',
          comType: 'group',
          rows: [
            {
              label: 'space.paddingTB',
              key: 'paddingTB',
              default: 16,
              value: 16,
              comType: 'inputNumber',
            },
            {
              label: 'space.paddingLR',
              key: 'paddingLR',
              default: 16,
              value: 16,
              comType: 'inputNumber',
            },
            {
              label: 'space.marginTB',
              key: 'marginTB',
              default: 8,
              value: 8,
              comType: 'inputNumber',
            },
            {
              label: 'space.marginLR',
              key: 'marginLR',
              default: 8,
              value: 8,
              comType: 'inputNumber',
            },
          ],
        },
        {
          label: 'mSpace.mSpace',
          key: 'mSpace',
          comType: 'group',
          rows: [
            {
              label: 'mSpace.paddingTB',
              key: 'paddingTB',
              default: MOBILE_MIN_PADDING,
              value: MOBILE_MIN_PADDING,
              comType: 'inputNumber',
            },
            {
              label: 'mSpace.paddingLR',
              key: 'paddingLR',
              default: MOBILE_MIN_PADDING,
              value: MOBILE_MIN_PADDING,
              comType: 'inputNumber',
            },
            {
              label: 'mSpace.marginTB',
              key: 'marginTB',
              default: MOBILE_MIN_MARGIN,
              value: MOBILE_MIN_MARGIN,
              comType: 'inputNumber',
            },
            {
              label: 'mSpace.marginLR',
              key: 'marginLR',
              default: MOBILE_MIN_MARGIN,
              value: MOBILE_MIN_MARGIN,
              comType: 'inputNumber',
            },
          ],
        },
        {
          label: 'background.background',
          key: 'background',
          comType: 'group',
          rows: [
            {
              label: 'background.background',
              key: 'background',
              default: {
                color: '#F0F2F5',
                image: '',
                size: '100% 100%',
                repeat: 'no-repeat',
              },
              value: {
                color: '#F0F2F5',
                image: '',
                size: '100% 100%',
                repeat: 'no-repeat',
              },
              comType: 'background',
            },
          ],
        },
      ],
      i18ns: [
        {
          lang: 'zh-CN',
          translation: {
            basic: {
              basic: '基本属性',
              initialQuery: '开启初始化查询',
              allowOverlap: '允许组件重叠',
            },
            space: {
              space: '间距',
              paddingTB: '画布上下间距',
              paddingLR: '画布左右间距',
              marginTB: '组件上下间距',
              marginLR: '组件左右间距',
            },
            mSpace: {
              mSpace: '移动端间距',
              paddingTB: '画布上下间距',
              paddingLR: '画布左右间距',
              marginTB: '组件上下间距',
              marginLR: '组件左右间距',
            },
            background: {
              background: '背景',
            },
          },
        },
        {
          lang: 'en-US',
          translation: {
            basic: {
              basic: 'Basic',
              initialQuery: 'Open Init Query',
              allowOverlap: 'Allow Overlap',
            },
            space: {
              space: 'Space',
              paddingTB: 'Board Padding TB',
              paddingLR: 'Board Padding LR',
              marginTB: 'Widget Margin TB',
              marginLR: 'Widget Margin LR',
            },
            mSpace: {
              mSpace: 'Mobile Space',
              paddingTB: 'Board Padding TB',
              paddingLR: 'Board Padding LR',
              marginTB: 'Widget Margin TB',
              marginLR: 'Widget Margin LR',
            },
            background: {
              background: 'Background',
            },
          },
        },
      ],
    },
  };
  return config;
};
