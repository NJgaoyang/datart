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
  CloudDownloadOutlined,
  CopyFilled,
  DeleteOutlined,
  FileAddOutlined,
  ReloadOutlined,
  ShareAltOutlined,
  VerticalAlignBottomOutlined,
} from '@ant-design/icons';
import { Menu, Popconfirm } from 'antd';
import { DownloadFileType } from 'app/constants';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { FC, memo } from 'react';
import styled from 'styled-components';

const VizOperationMenu: FC<{
  onShareLinkClick?;
  onDownloadDataLinkClick?;
  onSaveAsVizs?;
  onReloadData?;
  onAddToDashBoard?;
  onPublish?;
  onRecycleViz?;
  openMockData?;
  allowDownload?: boolean;
  allowShare?: boolean;
  allowManage?: boolean;
}> = memo(
  ({
    onShareLinkClick,
    onDownloadDataLinkClick,
    openMockData,
    onSaveAsVizs,
    onReloadData,
    onAddToDashBoard,
    onPublish,
    allowDownload,
    allowShare,
    allowManage,
    onRecycleViz,
  }) => {
    const t = useI18NPrefix(`viz.action`);
    const tg = useI18NPrefix(`global`);

    const moreActionMenu = () => {
      const menus: any[] = [];

      if (onReloadData) {
        menus.push(
          {
            key: String('reloadData'),
            icon: <ReloadOutlined />,
            onClick: onReloadData,
            label: t('syncData'),
          },
          { type: 'divider' as const, key: String('reloadDataLine') },
        );
      }

      if (allowManage && onSaveAsVizs) {
        menus.push({
          key: String('saveAs'),
          icon: <CopyFilled />,
          onClick: onSaveAsVizs,
          label: tg('button.saveAs'),
        });
      }

      if (allowManage && onSaveAsVizs) {
        menus.push(
          {
            key: String('addToDash'),
            icon: <FileAddOutlined />,
            onClick: () => onAddToDashBoard(true),
            label: t('addToDash'),
          },
          { type: 'divider' as const, key: String('addToDashLine') },
        );
      }

      if (allowShare && onShareLinkClick) {
        menus.push({
          key: String('shareLink'),
          icon: <ShareAltOutlined />,
          onClick: onShareLinkClick,
          label: t('share.shareLink'),
        });
      }

      if (allowDownload && onDownloadDataLinkClick) {
        menus.push(
          {
            key: String('exportData'),
            icon: <CloudDownloadOutlined />,
            label: (
              <Popconfirm
                placement="left"
                title={t('common.confirm')}
                onConfirm={() => {
                  onDownloadDataLinkClick(DownloadFileType.Excel);
                }}
                okText={t('common.ok')}
                cancelText={t('common.cancel')}
              >
                {t('share.exportData')}
              </Popconfirm>
            ),
          },
          {
            key: String('exportPDF'),
            icon: <CloudDownloadOutlined />,
            label: (
              <Popconfirm
                placement="left"
                title={t('common.confirm')}
                onConfirm={() => {
                  onDownloadDataLinkClick(DownloadFileType.Pdf);
                }}
                okText={t('common.ok')}
                cancelText={t('common.cancel')}
              >
                {t('share.exportPDF')}
              </Popconfirm>
            ),
          },
          {
            key: String('exportPicture'),
            icon: <CloudDownloadOutlined />,
            label: (
              <Popconfirm
                placement="left"
                title={t('common.confirm')}
                onConfirm={() => {
                  onDownloadDataLinkClick(DownloadFileType.Image);
                }}
                okText={t('common.ok')}
                cancelText={t('common.cancel')}
              >
                {t('share.exportPicture')}
              </Popconfirm>
            ),
          },
          {
            key: String('exportTpl'),
            icon: <CloudDownloadOutlined />,
            label: (
              <Popconfirm
                placement="left"
                title={t('common.confirm')}
                okText={t('common.ok')}
                cancelText={t('common.cancel')}
                onConfirm={openMockData}
              >
                {t('share.exportTpl')}
              </Popconfirm>
            ),
          },
          { type: 'divider' as const },
          { type: 'divider' as const, key: String('downloadDataLine') },
        );
      }

      if (allowManage && onPublish) {
        menus.push({
          key: String('publish'),
          icon: <VerticalAlignBottomOutlined />,
          onClick: onPublish,
          label: t('unpublish'),
        });
      }

      if (allowManage && onRecycleViz) {
        menus.push({
          key: String('delete'),
          icon: <DeleteOutlined />,
          label: (
            <Popconfirm
              title={tg('operation.archiveConfirm')}
              onConfirm={onRecycleViz}
            >
              {tg('button.archive')}
            </Popconfirm>
          ),
        });
      }

      return <Menu items={[...menus]} />;
    };

    return <StyleVizOperationMenu>{moreActionMenu()}</StyleVizOperationMenu>;
  },
);

export default VizOperationMenu;

const StyleVizOperationMenu = styled.div``;
