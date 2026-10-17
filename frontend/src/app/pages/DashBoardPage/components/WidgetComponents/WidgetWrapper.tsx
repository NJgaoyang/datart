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
  BackgroundConfig,
  BorderConfig,
  WidgetPadding,
} from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { memo, ReactNode } from 'react';
import styled from 'styled-components';
import { getWidgetSomeStyle } from '../../utils/widget';

export const WidgetWrapper: React.FC<{
  background: BackgroundConfig;
  padding: WidgetPadding;
  border: BorderConfig;
  className?: string;
  children?: ReactNode;
}> = memo(props => {
  const { children, className, ...rest } = props;
  const style = getWidgetSomeStyle(rest);
  return <Wrapper className={className} style={style}>{children}</Wrapper>;
});
const Wrapper = styled.div`
  /* Give absolute toolbar its own stable local positioning context. */
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;

  /* Controller toolbar belongs in a true flex column, not painted over the
     DatePicker suffix. Its width automatically includes status/lock icons. */
  &.controller-widget {
    align-items: center;

    .controller-widget-content {
      flex: 1 1 auto;
      min-width: 0;
      max-width: 100%;
      width: auto;
      height: 100%;
    }

    .widget-action-toolbar {
      position: relative;
      top: auto;
      right: auto;
      flex: 0 0 auto;
      align-self: center;
      overflow: visible;
    }
  }

  &:hover .widget-tool-dropdown {
    visibility: visible;
  }
`;
