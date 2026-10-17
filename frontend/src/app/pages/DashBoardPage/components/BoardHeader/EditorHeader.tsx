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
import { FC, memo, PropsWithChildren, useContext } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import type { HistoryEditBoard } from 'app/pages/DashBoardPage/pages/BoardEditor/slice/types';
import { hasUnsavedBoardChanges } from 'app/pages/DashBoardPage/utils/boardUnsavedState';
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
  const dispatch = useDispatch();
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
  const title = useStatusTitle(name, status);
  const closeWithoutPrompt = () => {
    const pathName = location.pathname;
    const prePath = pathName.split('/boardEditor')[0];
    navigate(`${prePath}`);
    dispatch(clearEditBoardState());
  };
  const onCloseBoardEditor = () => {
    if (saving) return;
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
    onEditClearActiveWidgets();
    setImmediate(() => {
      updateBoard?.(closeWithoutPrompt);
    });
  };

  return (
    <Wrapper onClick={onEditClearActiveWidgets}>
      <h1 className={classnames({ disabled: status < 2 })}>
        <LeftOutlined onClick={onCloseBoardEditor} />
        {title}
      </h1>
      <Space>
        <span aria-live="polite" role="status" style={{ fontSize: 12 }}>
          {saving ? '保存中…' : hasUnsavedChanges ? '● 有未保存的修改' : ''}
        </span>
        {children}
        <>
          <Button
            key="cancel"
            icon={<CloseOutlined />}
            onClick={onCloseBoardEditor}
            disabled={saving}
          >
            {t('common.cancel')}
          </Button>

          <Button
            key="update"
            type="primary"
            loading={saving}
            icon={<SaveOutlined />}
            onClick={onUpdateBoard}
          >
            {t('common.save')}
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
