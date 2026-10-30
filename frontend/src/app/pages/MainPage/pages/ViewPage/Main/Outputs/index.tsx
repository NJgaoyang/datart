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

import { DownOutlined, GithubOutlined, TableOutlined, UpOutlined } from '@ant-design/icons';
import { Alert, Button, Popover, Space, Spin, Tooltip } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import useResizeObserver from 'app/hooks/useResizeObserver';
import { selectSystemInfo } from 'app/slice/selectors';
import { transparentize } from 'polished';
import { memo, useCallback } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'redux/hooks';
import styled from 'styled-components';
import { SPACE_MD, SPACE_TIMES, SPACE_XS } from 'styles/StyleConstants';
import { newIssueUrl } from 'utils/utils';
import { ViewViewModelStages } from '../../constants';
import { useViewSlice } from '../../slice';
import { selectCurrentEditingViewAttr } from '../../slice/selectors';
import { ViewViewModel } from '../../slice/types';
import { Error } from './Error';
import { Results } from './Results';
import { hasPreviewResult } from './previewState';

interface OutputsProps {
  hidden?: boolean;
  allowManage?: boolean;
  expanded?: boolean;
  onToggleSize?: () => void;
}

export const Outputs = memo(({ hidden = false, allowManage = false, expanded = false, onToggleSize }: OutputsProps) => {
  const { actions } = useViewSlice();
  const dispatch = useAppDispatch();
  const systemInfo = useSelector(selectSystemInfo);
  const t = useI18NPrefix('view');

  const error = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'error' }),
  ) as string;
  const stage = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'stage' }),
  ) as ViewViewModelStages;
  const warnings = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'warnings' }),
  ) as string[];

  const previewResults = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'previewResults' }),
  ) as ViewViewModel['previewResults'];
  const previewFields = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'previewFields' }),
  ) as ViewViewModel['previewFields'];
  const model = useSelector(state =>
    selectCurrentEditingViewAttr(state, { name: 'model' }),
  ) as ViewViewModel['model'];
  const columnCount = Object.keys(model?.columns || {}).length;
  const hasPreview = hasPreviewResult({ stage, previewFields, previewResults });

  const { width, height, ref } = useResizeObserver({
    debounceMs: 200,
  });

  const removeViewWarnings = useCallback(() => {
    dispatch(
      actions.changeCurrentEditingView({
        warnings: null,
      }),
    );
  }, [dispatch, actions]);

  const submitIssue = useCallback(
    type => {
      let params: any = {
        type: type,
        title: 'Sql parse bug',
      };
      if (type === 'github') {
        params.body = `version: ${systemInfo?.version}\n` + warnings.join('');
      } else {
        params.description =
          `version: ${systemInfo?.version}\n` + warnings.join('');
      }
      let url = newIssueUrl(params);
      window.open(url);
    },
    [warnings, systemInfo],
  );

  return (
    <Wrapper hidden={hidden} role="region" aria-label={t('preview.title')}>
      <PreviewHeader>
        <span className="preview-title"><TableOutlined />{t('preview.title')}</span>
        <PreviewSummary aria-live="polite">
          {stage === ViewViewModelStages.Running
            ? t('preview.running')
            : hasPreview
            ? t('preview.summary', false, { rows: previewResults?.length || 0, columns: columnCount })
            : t('preview.ready')}
        </PreviewSummary>
        {onToggleSize && (
          <Tooltip title={t(expanded ? 'preview.restore' : 'preview.expand')}>
            <Button
              type="text"
              size="small"
              icon={expanded ? <DownOutlined /> : <UpOutlined />}
              aria-label={t(expanded ? 'preview.restore' : 'preview.expand')}
              onClick={onToggleSize}
            />
          </Tooltip>
        )}
      </PreviewHeader>
      {Boolean(warnings?.length) && (
        <Alert
          className="warningBox"
          title=""
          description={
            <p>
              {t('sqlRunWraning')}
              <Popover
                trigger={['click']}
                placement="top"
                styles={{ root: { width: SPACE_TIMES(96) } }}
                content={t('warningDescription')}
              >
                <Button className="detail" type="link" size="small">
                  {t('detail')}
                </Button>
              </Popover>
            </p>
          }
          type="warning"
          closable={false}
          action={
            <Space wrap>
              <Button
                size="small"
                icon={<GithubOutlined />}
                onClick={() => submitIssue('github')}
              >
                Github
              </Button>
              <Button size="small" onClick={() => submitIssue('gitee')}>
                Gitee
              </Button>
              <Button size="small" onClick={removeViewWarnings}>{t('close')}</Button>
            </Space>
          }
        />
      )}

      <PreviewBody ref={ref}>
        <Results width={width} height={height} allowManage={allowManage} />
        {error && <Error />}
        {stage === ViewViewModelStages.Running && (
          <LoadingMask role="status" aria-live="polite">
            <Spin />
            <span>{t('preview.running')}</span>
          </LoadingMask>
        )}
      </PreviewBody>
    </Wrapper>
  );
});

const Wrapper = styled.div`
  position: relative;
  display: flex;
  /* The height is controlled by the vertical split, not flex expansion. */
  flex: none;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  border-top: 1px solid ${p => p.theme.borderColorSplit};

  &[hidden] { display: none; }

  .warningBox {
    padding: ${SPACE_XS} ${SPACE_MD};

    .detail {
      padding: 0;
    }
  }
`;

const PreviewHeader = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: 12px;
  min-height: 40px;
  padding: 6px 12px;
  background-color: ${p => p.theme.componentBackground};
  border-bottom: 1px solid ${p => p.theme.borderColorSplit};

  .preview-title {
    display: inline-flex;
    flex: none;
    align-items: center;
    gap: 7px;
    color: ${p => p.theme.textColor};
    font-size: 13px;
    font-weight: 600;
  }

  button:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 1px;
  }
`;

const PreviewSummary = styled.span`
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: ${p => p.theme.textColorSnd};
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PreviewBody = styled.div`
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
`;

const LoadingMask = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 12px;
  color: ${p => p.theme.textColorSnd};
  font-size: 13px;
  background-color: ${p => transparentize(0.5, p.theme.componentBackground)};
`;
