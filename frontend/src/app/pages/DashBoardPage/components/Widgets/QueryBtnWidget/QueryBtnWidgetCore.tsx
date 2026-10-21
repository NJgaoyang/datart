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

import { darken, getLuminance, lighten } from 'polished';
import { memo, useContext } from 'react';
import styled from 'styled-components';
import { WidgetActionContext } from '../../ActionProvider/WidgetActionProvider';
import {
  getWidgetBaseStyle,
  getWidgetTitle,
} from '../../WidgetManager/utils/utils';
import { WidgetContext } from '../../WidgetProvider/WidgetProvider';

export const QueryBtnWidgetCore: React.FC<{}> = memo(() => {
  const widget = useContext(WidgetContext);

  const { onWidgetsQuery } = useContext(WidgetActionContext);

  const onQuery = e => {
    e.stopPropagation();
    onWidgetsQuery();
  };

  const title = getWidgetTitle(widget.config.customConfig.props);
  title.title = widget.config.name;
  const { background } = getWidgetBaseStyle(widget.config.customConfig.props);
  return (
    <Wrapper
      className="dashboard-modern-query-button"
      $bgColor={background.color}
      onClick={onQuery}
    >
      <span
        style={{
          color: title.font.color,
          fontSize: title.font.fontSize,
          fontWeight: title.font.fontWeight,
          fontFamily: title.font.fontFamily,
        }}
      >
        {title.title}
      </span>
    </Wrapper>
  );
});

const Wrapper = styled.div<{ $bgColor: string }>`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 32px;
  border-radius: 8px;
  background: ${p => p.$bgColor || '#1677ff'};
  box-shadow: 0 3px 10px rgba(22, 119, 255, 0.17);
  transition: background 0.18s ease, box-shadow 0.18s ease;
  cursor: pointer;

  span {
    font-size: 14px !important;
    font-weight: 600 !important;
  }

  &:hover {
    background: ${p => {
      const color = p.$bgColor || '#1677ff';
      return getLuminance(color) > 0.5
        ? darken(0.05, color)
        : lighten(0.05, color);
    }};
    box-shadow: 0 4px 12px rgba(22, 119, 255, 0.22);
  }

  &:focus-within {
    outline: 2px solid rgba(22, 119, 255, 0.3);
    outline-offset: 2px;
  }
`;
