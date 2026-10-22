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
    /* Refined light filter card, scoped to dashboard controllers only. */
    padding: 5px 10px !important;
    border: 1px solid #e6ebf3 !important;
    border-radius: 9px !important;
    background: #f8fafc !important;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.045) !important;
    transition: border-color 0.18s ease, box-shadow 0.18s ease;

    &:hover,
    &:focus-within {
      border-color: #d0def2 !important;
      box-shadow: 0 2px 8px rgba(23, 55, 103, 0.07) !important;
    }

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

    /* Unlike a floating overlay, this action has a predictable visible
       target on touchscreens and narrow desktop inputs. */
    .widget-tool-dropdown {
      opacity: 1;
      pointer-events: auto;
    }
  }

  /* Auto dashboards share the exact same flat filters in edit and view
     modes. Keep the full grid hit area for editor selection/drag behavior,
     but remove the old oversized card decoration from the actual widget. */
  &.controller-widget.dashboard-inline-filter {
    padding: 1px 4px !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    background-image: none !important;
    box-shadow: none !important;
    transition: none;

    &:hover,
    &:focus-within {
      border: 0 !important;
      background: transparent !important;
      box-shadow: none !important;
    }

    .widget-action-toolbar {
      margin-left: 0;
    }

    @media (pointer: fine) {
      .widget-tool-dropdown {
        width: 28px;
        min-width: 28px;
      }
    }
  }

  &.dashboard-action-widget {
    border-radius: 8px;
  }

  /* Action widgets retain their grid positions; only their surfaces change. */
  &.dashboard-query-action,
  &.dashboard-reset-action {
    padding: 6px 0 !important;
    border: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
  }

  /* Auto-board action buttons are compact in BOTH editor and viewer.
     The grid cells remain unchanged; the buttons are vertically centered. */
  &.dashboard-auto-action .dashboard-modern-query-button,
  &.dashboard-auto-action .dashboard-modern-reset-button {
    flex: 0 0 auto !important;
    align-self: center;
    box-sizing: border-box;
    height: min(40px, 100%) !important;
    min-height: 0 !important;
    max-height: 40px;
    border-radius: 7px;
    box-shadow: none !important;
  }

  @media (pointer: coarse) {
    &.controller-widget {
      padding: 4px 6px !important;
    }

    &.controller-widget.dashboard-inline-filter {
      padding: 1px 2px !important;
    }
  }

  &:hover .widget-tool-dropdown,
  &:focus-within .widget-tool-dropdown {
    opacity: 1;
    pointer-events: auto;
  }

  @media (pointer: coarse) {
    .widget-tool-dropdown {
      opacity: 1;
      pointer-events: auto;
    }
  }
`;
