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
import { WidgetInfo } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import classnames from 'classnames';
import { memo, useCallback, useContext, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { LEVEL_20, LEVEL_5 } from 'styles/StyleConstants';
import { ORIGINAL_TYPE_MAP, WIDGET_DRAG_HANDLE } from '../../constants';
import {
  editDashBoardInfoActions,
  editWidgetInfoActions,
} from '../../pages/BoardEditor/slice';
import { selectShowBlockMask } from '../../pages/BoardEditor/slice/selectors';
import { Widget } from '../../types/widgetTypes';
import { WidgetActionContext } from '../ActionProvider/WidgetActionProvider';

export interface BlockMaskLayerProps {
  widget: Widget;
  widgetInfo: WidgetInfo;
}
export const BlockMaskLayer: React.FC<BlockMaskLayerProps> = memo(
  ({ widget, widgetInfo }) => {
    const dispatch = useDispatch();
    const { onEditSelectWidget } = useContext(WidgetActionContext);
    const showBlockMask = useSelector(selectShowBlockMask);
    const onMouseDown = useCallback(
      (e: React.MouseEvent<HTMLDivElement>) => {
        onEditSelectWidget({
          multipleKey: e.shiftKey,
          id: widget.id,
          selected: true,
        });
      },
      [onEditSelectWidget, widget.id],
    );

    const doubleClick = useCallback(() => {
      if (widget.config.type === 'container') {
        dispatch(editDashBoardInfoActions.changeShowBlockMask(false));
      }
      dispatch(
        editWidgetInfoActions.openWidgetEditing({
          id: widget.id,
        }),
      );
    }, [dispatch, widget.id, widget.config.type]);
    const hideBorder = useMemo(() => {
      if (widget.config.originalType === ORIGINAL_TYPE_MAP.group) {
        if (widget.config.boardType === 'auto' && !widget.parentId) {
          return false;
        }
        return true;
      }
      return false;
    }, [widget.config.boardType, widget.config.originalType, widget.parentId]);
    return (
      <MaskLayer
        front={showBlockMask && !widgetInfo.editing}
        hideBorder={hideBorder}
        className={classnames({
          [WIDGET_DRAG_HANDLE]: showBlockMask,
          selected: widgetInfo.selected,
          editing: widgetInfo.editing,
        })}
        onDoubleClick={doubleClick}
        onMouseDown={onMouseDown}
      ></MaskLayer>
    );
  },
);

const MaskLayer = styled.div<{ front: boolean; hideBorder: boolean }>`
  position: absolute;
  top: 0;
  left: 0;
  z-index: ${p => (p.front ? LEVEL_20 : LEVEL_5)};
  width: 100%;
  height: 100%;
  cursor: move;

  &:hover:not(.selected):not(.editing),
  &:active:not(.selected):not(.editing) {
    outline: 1px dashed ${p => p.theme.primary};
  }

  /* 与 DataEase 的 .shape-selected 一致：描边不参与盒模型，内容区不会被挤出空隙。 */
  &.selected {
    outline: 1px solid ${p => p.theme.primary};
    outline-offset: 0;
  }

  &.editing {
    outline: ${p =>
      p.hideBorder ? 'none' : `1px solid ${p.theme.primary}`};
    outline-offset: 0;
  }
`;
