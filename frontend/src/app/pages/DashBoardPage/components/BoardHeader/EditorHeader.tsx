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

import { CloseOutlined, LeftOutlined, SaveOutlined } from '@ant-design/icons';
import { Button, Modal, Space } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import classnames from 'classnames';
import { FC, memo, PropsWithChildren, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'redux/hooks';
import type { HistoryEditBoard } from 'app/pages/DashBoardPage/pages/BoardEditor/slice/types';
import { hasUnsavedBoardChanges } from 'app/pages/DashBoardPage/utils/boardUnsavedState';
import { getBoardSaveStatus } from 'app/pages/DashBoardPage/utils/boardSaveStatus';
import { appHistory } from 'app/appHistory';
import { DASHBOARD_DESIGN_TOKENS as D } from 'app/pages/DashBoardPage/styles/dashboardDesignTokens';
import { blockBoardNavigation } from 'app/utils/blockBoardNavigation';
import { useLocation, useNavigate } from 'react-router-dom';
import styled from 'styled-components';
import {
  FONT_SIZE_ICON_SM,
  FONT_WEIGHT_MEDIUM,
  LINE_HEIGHT_ICON_SM,
  SPACE_LG,
  SPACE_SM,
} from 'styles/StyleConstants';
import { useStatusTitle } from '../../hooks/useStatusTitle';
import { clearEditBoardState } from '../../pages/BoardEditor/slice/actions/actions';
import { BoardActionContext } from '../ActionProvider/BoardActionProvider';
import { WidgetActionContext } from '../ActionProvider/WidgetActionProvider';
import { BoardInfoContext } from '../BoardProvider/BoardInfoProvider';
import { BoardContext } from '../BoardProvider/BoardProvider';

const EditorHeader: FC<PropsWithChildren> = memo(({ children }) => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const t = useI18NPrefix(`viz.action`);
  const { updateBoard } = useContext(BoardActionContext);
  const { onEditClearActiveWidgets } = useContext(WidgetActionContext);
  const { name, status, boardId } = useContext(BoardContext);
  const hasUnsavedChanges = useSelector((state: { editBoard: HistoryEditBoard }) =>
    hasUnsavedBoardChanges(state.editBoard?.stack?.past, boardId),
  );
  const { saving } = useContext(BoardInfoContext);
  const [saveAttempt, setSaveAttempt] = useState<'idle' | 'saving' | 'failed' | 'saved'>('idle');
  const isSaving = saving || saveAttempt === 'saving';
  const saveStatus = getBoardSaveStatus(isSaving, hasUnsavedChanges, saveAttempt === 'failed');
  // Dispose the blocked transition before any approved explicit exit; otherwise
  // the user sees the editor's own confirmation followed by another prompt.
  const unblockNavigationRef = useRef<() => void>(() => undefined);
  const clearEditor = useCallback(() => {
    dispatch(clearEditBoardState());
  }, [dispatch]);
  useEffect(() => {
    const dispose = blockBoardNavigation(appHistory, {
      dirty: hasUnsavedChanges,
      saving: isSaving,
      confirmExit: (proceed, stay) => {
        Modal.confirm({
          title: '离开仪表板编辑？',
          content: '当前修改尚未保存。离开后这些修改将丢失。',
          okText: '不保存并离开',
          cancelText: '继续编辑',
          okButtonProps: { danger: true },
          onOk: proceed,
          onCancel: stay,
        });
      },
      onBlockedWhileSaving: () => {
        Modal.warning({
          title: '正在保存',
          content: '请等待保存完成后再切换页面。',
        });
      },
      onLeave: clearEditor,
    });
    unblockNavigationRef.current = dispose;
    return () => {
      dispose();
      if (unblockNavigationRef.current === dispose) {
        unblockNavigationRef.current = () => undefined;
      }
    };
  }, [hasUnsavedChanges, isSaving, clearEditor]);


  // Hard reload / tab close still needs the browser-native confirmation;
  // the shared history blocker above handles SPA PUSH/REPLACE/POP.
  useEffect(() => {
    if (!hasUnsavedChanges && !isSaving) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges, isSaving]);

  const title = useStatusTitle(name, status);
  const closeWithoutPrompt = () => {
    unblockNavigationRef.current();
    const pathName = location.pathname;
    const prePath = pathName.split('/boardEditor')[0];
    navigate(`${prePath}`);
    clearEditor();
  };
  const onCloseBoardEditor = () => {
    if (isSaving) return;
    if (hasUnsavedChanges) {
      Modal.confirm({
        title: '退出仪表板编辑？',
        content: '当前修改尚未保存。退出后这些修改将丢失。',
        okText: '不保存并退出',
        okButtonProps: { danger: true },
        cancelText: '继续编辑',
        onOk: closeWithoutPrompt,
      });
    } else {
      closeWithoutPrompt();
    }
  };

  const onUpdateBoard = () => {
    if (isSaving) return;
    onEditClearActiveWidgets();
    setSaveAttempt('saving');
    // Let the current form input blur before taking its final save snapshot.
    setImmediate(async () => {
      try {
        const succeeded = await updateBoard?.();
        if (succeeded) {
          setSaveAttempt('saved');
          closeWithoutPrompt();
        } else {
          setSaveAttempt('failed');
        }
      } catch {
        setSaveAttempt('failed');
      }
    });
  };

  return (
    <Wrapper onClick={onEditClearActiveWidgets}>
      <h1 className={classnames({ disabled: status < 2 })}>
        <button
          type="button"
          className="editor-exit-button"
          aria-label="退出仪表板编辑"
          onClick={onCloseBoardEditor}
          disabled={isSaving}
        >
          <LeftOutlined aria-hidden="true" />
        </button>
        {title}
      </h1>
      <Space>
        <span aria-live="polite" role="status" style={{ fontSize: D.typography.caption }}>
          {saveStatus === 'saving'
            ? '保存中…'
            : saveStatus === 'failed'
            ? '保存失败，请重试'
            : saveStatus === 'unsaved'
            ? '● 有未保存的修改'
            : '已保存'}
        </span>
        {children}
        <>
          <Button
            key="cancel"
            icon={<CloseOutlined />}
            onClick={onCloseBoardEditor}
            disabled={isSaving}
          >
            {t('common.cancel')}
          </Button>

          <Button
            key="update"
            type="primary"
            loading={isSaving}
            icon={<SaveOutlined />}
            onClick={onUpdateBoard}
          >
            {saveStatus === 'failed' ? '重试保存' : t('common.save')}
          </Button>
        </>
      </Space>
    </Wrapper>
  );
});

export default EditorHeader;
const Wrapper = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  padding: ${SPACE_SM} ${SPACE_LG};
  background-color: ${p => p.theme.componentBackground};
  box-shadow: ${p => p.theme.shadowSider};

  .editor-exit-button {
    padding: 4px;
    margin-right: 8px;
    border: 0;
    background: transparent;
    color: inherit;
    cursor: pointer;

    &:focus-visible {
      outline: 2px solid currentColor;
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  h1 {
    flex: 1;
    font-size: ${FONT_SIZE_ICON_SM};
    font-weight: ${FONT_WEIGHT_MEDIUM};
    line-height: ${LINE_HEIGHT_ICON_SM};

    &.disabled {
      color: ${p => p.theme.textColorLight};
    }
  }
`;