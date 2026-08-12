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

import { useContext } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { BoardActionContext } from '../components/ActionProvider/BoardActionProvider';
import { WidgetActionContext } from '../components/ActionProvider/WidgetActionProvider';

export default function useBoardEditorHotkeys() {
  const { undo, redo } = useContext(BoardActionContext);
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
  // TODO: Implement widget movement hotkeys (up/down/left/right)
  // TODO: Implement widget lock/unlock hotkeys
}
