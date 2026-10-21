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

import React, { useContext } from 'react';
import styled from 'styled-components';
import { WidgetActionContext } from '../../ActionProvider/WidgetActionProvider';
import { getWidgetTitle } from '../../WidgetManager/utils/utils';
import { WidgetContext } from '../../WidgetProvider/WidgetProvider';

export const ResetBtnWidgetCore: React.FC<{}> = () => {
  const widget = useContext(WidgetContext);
  const { onWidgetsReset } = useContext(WidgetActionContext);

  const onQuery = e => {
    e.stopPropagation();
    onWidgetsReset();
  };

  const title = getWidgetTitle(widget.config.customConfig.props);
  title.title = widget.config.name;
  return (
    <Wrapper onClick={onQuery}>
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
};

const Wrapper = styled.div`
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  min-height: 32px;
  border: 1px solid #dce4ef;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.035);
  transition: background 0.18s ease, border-color 0.18s ease;
  cursor: pointer;

  span {
    font-size: 14px !important;
    font-weight: 500 !important;
  }

  &:hover {
    border-color: #bdd0ed;
    background: #f8fbff;
  }

  &:focus-within {
    outline: 2px solid rgba(22, 119, 255, 0.3);
    outline-offset: 2px;
  }
`;
