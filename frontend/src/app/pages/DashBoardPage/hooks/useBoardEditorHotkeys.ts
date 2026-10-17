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

import { useContext, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { LAYOUT_COLS_MAP } from '../constants';
import { DeviceType } from '../pages/Board/slice/types';
import { editBoardStackActions, editDashBoardInfoActions } from '../pages/BoardEditor/slice';
import { selectDeviceType, selectEditBoard, selectEditingWidgetIds, selectLayoutWidgetMap, selectSelectedIds } from '../pages/BoardEditor/slice/selectors';
import { getDesktopGridLayout, getMobileGridLayout } from '../utils/gridLayout';
import { isTypingTarget, nudgeGridLayout } from '../utils/gridKeyboard';
import { useHotkeys } from 'react-hotkeys-hook';
import { BoardActionContext } from '../components/ActionProvider/BoardActionProvider';
import { WidgetActionContext } from '../components/ActionProvider/WidgetActionProvider';

export default function useBoardEditorHotkeys() {
  const { undo, redo } = useContext(BoardActionContext);
  const dispatch = useDispatch();
  const selectedIdsValue = useSelector(selectSelectedIds);
  const selectedIds = useMemo(
    () => new Set(selectedIdsValue.split(',').filter(Boolean)),
    [selectedIdsValue],
  );
  const editIds = useSelector(selectEditingWidgetIds);
  const boardType = useSelector(selectEditBoard).config?.type;
  const deviceType = useSelector(selectDeviceType);
  const widgetsMap = useSelector(selectLayoutWidgetMap);
  const widgets = useMemo(() => Object.values(widgetsMap), [widgetsMap]);
  const allowOverlap = useSelector(selectEditBoard).config?.allowOverlap === true;

  useEffect(() => {
    if (boardType !== 'auto') return;
    const handleKeyboardMove = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target) || editIds || !selectedIds.size || event.repeat
          || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
      const offsets: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0], ArrowRight: [1, 0],
        ArrowUp: [0, -1], ArrowDown: [0, 1],
      };
      const delta = offsets[event.key];
      if (!delta) return;
      const mobile = deviceType === DeviceType.Mobile;
      const layout = mobile ? getMobileGridLayout(widgets) : getDesktopGridLayout(widgets);
      const next = nudgeGridLayout(
        layout, selectedIds, delta[0], delta[1],
        mobile ? LAYOUT_COLS_MAP.sm : LAYOUT_COLS_MAP.lg, allowOverlap,
      );
      if (next === layout) return;
      event.preventDefault();
      dispatch(editBoardStackActions.changeAutoBoardWidgetsRect({ layouts: next, deviceType }));
      dispatch(editDashBoardInfoActions.adjustDashLayouts(next));
    };
    window.addEventListener('keydown', handleKeyboardMove);
    return () => window.removeEventListener('keydown', handleKeyboardMove);
  }, [allowOverlap, boardType, deviceType, dispatch, editIds, selectedIds, widgets]);

  useEffect(() => {
    const handleLock = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || !event.shiftKey
          || event.key.toLowerCase() !== 'l' || !selectedIds.size
          || isTypingTarget(event.target) || editIds) return;
      const selected = widgets.filter(item => selectedIds.has(item.id));
      if (selected.length !== selectedIds.size) return;
      event.preventDefault();
      const lock = selected.some(item => !item.config.lock);
      dispatch(editBoardStackActions.toggleWidgetsLock({
        ids: selected.map(item => item.id), lock,
      }));
    };
    window.addEventListener('keydown', handleLock);
    return () => window.removeEventListener('keydown', handleLock);
  }, [dispatch, editIds, selectedIds, widgets]);
  const {
    onEditDeleteActiveWidgets,
    onEditLayerToTop,
    onEditLayerToBottom,
    onEditCopyWidgets,
    onEditPasteWidgets,
    onEditComposeGroup,
  } = useContext(WidgetActionContext);

  useHotkeys('delete,backspace', () => onEditDeleteActiveWidgets(), []);

  useHotkeys('ctrl+z,command+z', () => undo());
  useHotkeys('ctrl+shift+z,command+shift+z', () => redo());

  useHotkeys('ctrl+shift+up,command+shift+up', () => onEditLayerToTop());
  useHotkeys('ctrl+shift+down,command+shift+down', () => onEditLayerToBottom());

  useHotkeys('ctrl+c,command+c', () => onEditCopyWidgets());
  useHotkeys('ctrl+v,command+v', () => onEditPasteWidgets());

  useHotkeys('ctrl+g,command+g', e => {
    onEditComposeGroup();
    e.preventDefault();
  });
  // Arrow-key movement and Ctrl/Cmd+Shift+L locking are handled above
  // without stealing keys from editable inputs and embedded controls.
}
