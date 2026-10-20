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
import { Divider, Dropdown, Menu, Space } from 'antd';
import { CopyOutlined, DeleteOutlined, MoreOutlined, SnippetsOutlined, VerticalAlignBottomOutlined, VerticalAlignTopOutlined } from '@ant-design/icons';
import { ToolbarButton } from 'app/components';
import { useSelector } from 'react-redux';
import { selectClipboardWidgets, selectSelectedIds } from '../../slice/selectors';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { BoardActionContext } from 'app/pages/DashBoardPage/components/ActionProvider/BoardActionProvider';
import useBoardEditorHotkeys from 'app/pages/DashBoardPage/hooks/useBoardEditorHotkeys';
import React, { useContext } from 'react';
import styled from 'styled-components';
import { DASHBOARD_UI_TOKENS as T } from 'app/pages/DashBoardPage/styles/dashboardUiTokens';
import { DASHBOARD_DESIGN_TOKENS as D } from 'app/pages/DashBoardPage/styles/dashboardDesignTokens';
import { WidgetActionContext } from '../../../../components/ActionProvider/WidgetActionProvider';
import { AddChart } from './AddChart/AddChart';
import { AddContainer } from './AddContainer/AddContainer';
import { AddController } from './AddControler/AddControler';
import { AddMedia } from './AddMedia/AddMedia';
import { BoardToolRights } from './BoardToolRights';
import { BoardToolBarContext } from './context/BoardToolBarContext';
import { CopyBtn, PasteBtn } from './CopyPaste/CopyPaste';
import { DelWidgetsBtn } from './DelWidgetsBtn';
import { DeviceSwitcher } from './DeviceSwitch/DeviceSwitcher';
import { ToBottomBtn, ToTopBtn } from './ToTopToBottom/ToTopToBottom';
import { RedoBtn, UndoBtn } from './UndoRedo/UndoRedo';

export const ToolBar = () => {
  const ssp = e => {
    e.stopPropagation();
  };
  const { boardType } = useContext(BoardToolBarContext);
  const selectedIds = useSelector(selectSelectedIds);
  const clipboardWidgets = useSelector(selectClipboardWidgets);
  const hasSelection = Boolean(selectedIds);
  const hasClipboard = Object.keys(clipboardWidgets).length > 0;
  const {
    onEditLayerToTop,
    onEditLayerToBottom,
    onEditCopyWidgets,
    onEditPasteWidgets,
    onEditDeleteActiveWidgets,
  } = useContext(WidgetActionContext);
  const { undo, redo } = useContext(BoardActionContext);
  //
  useBoardEditorHotkeys();

  const t = useI18NPrefix(`viz.board.action`);
  const compactActions = (
    <Menu onClick={({ key }) => {
      switch (key) {
        case 'delete': onEditDeleteActiveWidgets(); break;
        case 'top': onEditLayerToTop(); break;
        case 'bottom': onEditLayerToBottom(); break;
        case 'copy': onEditCopyWidgets(); break;
        case 'paste': onEditPasteWidgets(); break;
      }
    }}>
      <Menu.Item key="delete" disabled={!hasSelection} icon={<DeleteOutlined />} danger>{t('delete')}</Menu.Item>
      <Menu.Item key="top" disabled={!hasSelection} icon={<VerticalAlignTopOutlined />}>{t('toTop')}</Menu.Item>
      <Menu.Item key="bottom" disabled={!hasSelection} icon={<VerticalAlignBottomOutlined />}>{t('toBottom')}</Menu.Item>
      <Menu.Item key="copy" disabled={!hasSelection} icon={<CopyOutlined />}>{t('copy')}</Menu.Item>
      <Menu.Item key="paste" disabled={!hasClipboard} icon={<SnippetsOutlined />}>{t('paste')}</Menu.Item>
    </Menu>
  );
  return (
    <Wrapper onClick={ssp}>
      <Space className="toolbar-primary" size={D.spacing.card}>
        <AddChart />

        <AddController />

        <AddMedia />

        <AddContainer />

        <Divider type="vertical" />

        <UndoBtn fn={undo} title={t('undo')} />
        <RedoBtn fn={redo} title={t('redo')} />

        <span className="toolbar-secondary-desktop">
          <Divider type="vertical" />
          <DelWidgetsBtn fn={onEditDeleteActiveWidgets} title={t('delete')} />
          <Divider type="vertical" />
          <ToTopBtn fn={onEditLayerToTop} title={t('toTop')} />
          <ToBottomBtn fn={onEditLayerToBottom} title={t('toBottom')} />
          <CopyBtn fn={onEditCopyWidgets} title={t('copy')} />
          <PasteBtn fn={onEditPasteWidgets} title={t('paste')} />
        </span>
        <span className="toolbar-secondary-compact">
          <Dropdown overlay={compactActions} placement="bottomRight" trigger={['click']}>
            <ToolbarButton icon={<MoreOutlined />} title="更多编辑操作" aria-label="更多编辑操作" />
          </Dropdown>
        </span>

        {boardType === 'auto' && (
          <>
            <Divider type="vertical" />

            <DeviceSwitcher />
          </>
        )}
      </Space>

      <BoardToolRights />
    </Wrapper>
  );
};
const Wrapper = styled.div`
  z-index: 0;
  display: flex;
  flex: 1;
  justify-content: space-between;
  align-items: center;
  min-width: 0;
  gap: ${D.spacing.page}px;

  .toolbar-primary {
    flex: 1 1 auto;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    white-space: nowrap;
  }

  .toolbar-secondary-desktop {
    display: inline-flex;
    align-items: center;
  }

  .toolbar-secondary-compact {
    display: none;
  }

  @container board-toolbar (max-width: ${T.compactToolbarWidth}px) {
    .toolbar-secondary-desktop {
      display: none;
    }

    .toolbar-secondary-compact {
      display: inline-flex;
      align-items: center;
    }

    .toolbar-primary {
      overflow-x: auto;
    }
  }

  > :last-child {
    flex: 0 0 auto;
  }
`;
