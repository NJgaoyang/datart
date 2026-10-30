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
  AlignCenterOutlined,
  CaretRightOutlined,
  CopyOutlined,
  DownOutlined,
  EllipsisOutlined,
  MonitorOutlined,
  SaveOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Select, Tooltip } from 'antd';
import { Chronograph } from 'app/components/Chronograph';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { CommonFormTypes } from 'globalConstants';
import { memo, useCallback, useContext, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'redux/hooks';
import { useLocation } from 'react-router-dom';
import { format } from 'sql-formatter';
import styled from 'styled-components';
import { LEVEL_1 } from 'styles/StyleConstants';
import { getInsertedNodeIndex } from 'utils/utils';
import { isParentIdEqual } from '../../../../slice/utils';
import { selectSources } from '../../../SourcePage/slice/selectors';
import {
  PREVIEW_SIZE_LIST,
  ViewStatus,
  ViewViewModelStages,
} from '../../constants';
import { EditorContext } from '../../EditorContext';
import { useSaveAsView } from '../../hooks/useSaveAsView';
import { useStartAnalysis } from '../../hooks/useStartAnalysis';
import { SaveFormContext } from '../../SaveFormContext';
import { useViewSlice } from '../../slice';
import {
  selectCurrentEditingViewAttr,
  selectViews,
} from '../../slice/selectors';
import { saveView } from '../../slice/thunks';
import { isNewView } from '../../utils';
interface ToolbarProps {
  allowManage: boolean;
  allowEnableViz: boolean | undefined;
  type: 'STRUCT' | 'SQL';
}

export const Toolbar = memo(
  ({ allowManage, allowEnableViz, type }: ToolbarProps) => {
    const { actions } = useViewSlice();
    const dispatch = useAppDispatch();
    const { onRun, onSave } = useContext(EditorContext);
    const { showSaveForm } = useContext(SaveFormContext);
    const sources = useSelector(selectSources);
    const location = useLocation();
    const histState = location.state as any;
    const viewsData = useSelector(selectViews);
    const t = useI18NPrefix('view.editor');
    const saveAsView = useSaveAsView();
    const startAnalysis = useStartAnalysis();
    const id = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'id' }),
    ) as string;
    const name = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'name' }),
    ) as string;
    const parentId = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'parentId' }),
    ) as string;
    const config = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'config' }),
    ) as object;
    const sourceId = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'sourceId' }),
    ) as string;
    const stage = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'stage' }),
    ) as ViewViewModelStages;
    const status = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'status' }),
    ) as ViewStatus;
    const script = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'script' }),
    ) as string;
    const fragment = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'fragment' }),
    ) as string;
    const size = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'size' }),
    ) as number;
    const error = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'error' }),
    ) as string;
    const ViewIndex = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'index' }),
    ) as number;
    const touched = useSelector(state =>
      selectCurrentEditingViewAttr(state, { name: 'touched' }),
    ) as boolean;
    const isArchived = status === ViewStatus.Archived;
    const running = stage === ViewViewModelStages.Running;
    const saving = stage === ViewViewModelStages.Saving;

    const formatSQL = useCallback(() => {
      dispatch(
        actions.changeCurrentEditingView({
          script: format(script, {
            denseOperators: true,
            logicalOperatorNewline: 'before',
          }),
        }),
      );
    }, [dispatch, actions, script]);

    const showEdit = useCallback(() => {
      showSaveForm({
        type: CommonFormTypes.Edit,
        open: true,
        initialValues: {
          name,
          parentId,
          config,
        },
        parentIdLabel: t('folder'),
        onSave: (values, onClose) => {
          let index = ViewIndex;

          if (isParentIdEqual(parentId, values.parentId)) {
            index = getInsertedNodeIndex(values, viewsData);
          }

          dispatch(
            actions.changeCurrentEditingView({
              ...values,
              parentId: values.parentId || null,
              index,
            }),
          );
          dispatch(saveView({ resolve: onClose }));
        },
      });
    }, [
      showSaveForm,
      actions,
      dispatch,
      name,
      parentId,
      config,
      viewsData,
      ViewIndex,
      t,
    ]);

    const sourceChange = useCallback(
      value => {
        dispatch(actions.changeCurrentEditingView({ sourceId: value }));
      },
      [dispatch, actions],
    );

    const sizeMenuClick = useCallback(
      ({ key }) => {
        dispatch(actions.changeCurrentEditingView({ size: Number(key) }));
      },
      [dispatch, actions],
    );

    useEffect(() => {
      if (histState?.sourcesId && sources) {
        sourceChange(histState.sourcesId);
      }
    }, [histState?.sourcesId, sourceChange, sources]);

    const moreItems = allowManage
      ? [
          {
            key: 'settings',
            label: t('info'),
            icon: <SettingOutlined />,
            disabled: isArchived || isNewView(id),
            onClick: showEdit,
          },
          {
            key: 'saveAs',
            label: t('saveAs'),
            icon: <CopyOutlined />,
            disabled: isNewView(id),
            onClick: () => saveAsView(id),
          },
        ]
      : [];

    return (
      <Container role="group" aria-label={t('toolbar')}>
        <Operates>
          {type === 'SQL' && allowManage && (
            <SourceControl>
              <span className="control-label">{t('sourceLabel')}</span>
              <Select
                aria-label={t('sourceLabel')}
                placeholder={t('source')}
                value={sourceId}
                disabled={isArchived}
                onChange={sourceChange}
                className="source"
                showSearch={{ optionFilterProp: 'label' }}
                options={(sources || []).map(({ id, name }) => ({
                  value: id,
                  label: name,
                }))}
              />
            </SourceControl>
          )}
          <ActionGroup>
            {type === 'SQL' && (
              <>
                <Tooltip
                  title={
                    <TipTitle
                      title={running
                        ? [t('running')]
                        : [fragment ? t('runSelection') : t('run'), t('runWinTip'), t('runMacTip')]}
                    />
                  }
                  placement="bottom"
                >
                  <Button
                    type="primary"
                    loading={running}
                    disabled={running}
                    icon={<CaretRightOutlined />}
                    onClick={onRun}
                    aria-label={running ? t('running') : fragment ? t('runSelection') : t('run')}
                  >
                    {running ? t('running') : fragment ? t('runSelection') : t('run')}
                  </Button>
                </Tooltip>
                <Tooltip title={t('beautify')} placement="bottom">
                  <Button
                    type="text"
                    icon={<AlignCenterOutlined />}
                    aria-label={t('beautify')}
                    disabled={isArchived || !allowManage}
                    onClick={formatSQL}
                  />
                </Tooltip>
              </>
            )}
            <Dropdown
              trigger={['click']}
              menu={{
                selectedKeys: [String(size)],
                onClick: sizeMenuClick,
                items: PREVIEW_SIZE_LIST.map(limit => ({
                  key: String(limit),
                  label: limit.toLocaleString(),
                })),
              }}
            >
              <Button type="text" className="preview-limit" aria-label={t('previewLimit')}>
                {t('previewLimit')}: {size?.toLocaleString()}
                <DownOutlined />
              </Button>
            </Dropdown>
            <Chronograph
              running={running}
              status={error ? 'error' : running ? 'processing' : stage >= ViewViewModelStages.Running ? 'success' : 'default'}
            />
          </ActionGroup>
        </Operates>
        <Actions>
          <SaveState role="status">
            {!allowManage || isArchived
              ? t('readOnly')
              : saving
              ? t('saving')
              : touched || isNewView(id)
              ? t('unsaved')
              : t('saved')}
          </SaveState>
          {allowManage && (
            <Tooltip title={<TipTitle title={[t('save'), t('saveWinTip'), t('saveMacTip')]} />} placement="bottom">
              <Button
                icon={<SaveOutlined />}
                loading={saving}
                disabled={isArchived || stage !== ViewViewModelStages.Saveable}
                onClick={onSave}
              >
                {t('save')}
              </Button>
            </Tooltip>
          )}
          {allowEnableViz && (
            <Button
              type="text"
              icon={<MonitorOutlined />}
              disabled={isNewView(id)}
              onClick={() => startAnalysis(id)}
            >
              {t('startAnalysis')}
            </Button>
          )}
          {moreItems.length > 0 && (
            <Dropdown trigger={['click']} menu={{ items: moreItems }}>
              <Button type="text" icon={<EllipsisOutlined />} aria-label={t('moreActions')} title={t('moreActions')} />
            </Dropdown>
          )}
        </Actions>
      </Container>
    );
  },
);

const Container = styled.div`
  z-index: ${LEVEL_1};
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
  padding: 10px 12px;
  background-color: ${p => p.theme.componentBackground};
  border-bottom: 1px solid ${p => p.theme.borderColorSplit};

  .ant-btn {
    height: 32px;
    font-size: 13px;
    border-radius: 4px;
  }

  .ant-btn:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 2px;
  }

  .preview-limit {
    color: ${p => p.theme.textColorSnd};
    font-size: 12px;
  }
`;

const Operates = styled.div`
  display: flex;
  flex: 1 1 400px;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  min-width: 0;
`;

const SourceControl = styled.div`
  display: flex;
  flex: 0 1 260px;
  align-items: center;
  gap: 8px;
  min-width: 180px;

  .control-label {
    flex: none;
    color: ${p => p.theme.textColorSnd};
    font-size: 12px;
  }

  .source {
    flex: 1;
    min-width: 0;
    font-size: 13px;
  }
`;

const ActionGroup = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
`;

const Actions = styled(ActionGroup)`
  justify-content: flex-end;
  margin-left: auto;
`;

const SaveState = styled.span`
  margin-right: 4px;
  color: ${p => p.theme.textColorSnd};
  font-size: 12px;
  white-space: nowrap;
`;

const TipTitle = ({ title }: { title: string[] }) => {
  return (
    <TipTitleWrapper>
      {title.map((s, index) => (
        <p key={index}>{s}</p>
      ))}
    </TipTitleWrapper>
  );
};

const TipTitleWrapper = styled.div`
  display: flex;
  flex-direction: column;
`;
