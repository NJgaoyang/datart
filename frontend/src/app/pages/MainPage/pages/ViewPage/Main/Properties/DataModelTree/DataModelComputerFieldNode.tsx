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
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FieldStringOutlined,
  FileUnknownOutlined,
  NumberOutlined,
} from '@ant-design/icons';
import { Button, Popconfirm, Tooltip } from 'antd';
import { DataViewFieldType } from 'app/constants';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { ChartDataViewMeta } from 'app/types/ChartDataViewMeta';
import { FC, memo } from 'react';
import { getFieldDisplayName } from 'utils/utils';
import { DatasetCommentLabel } from '../../../components/DatasetCommentLabel';
import { FieldRow, FieldTypeIcon } from './FieldRow';

const DataModelComputerFieldNode: FC<{
  node: ChartDataViewMeta;
  menuClick: (node: ChartDataViewMeta, key: string) => void;
}> = memo(({ node, menuClick }) => {
  const t = useI18NPrefix('view.model');
  const label = getFieldDisplayName(node);
  const icon =
    node.type === DataViewFieldType.NUMERIC ? (
      <NumberOutlined />
    ) : node.type === DataViewFieldType.STRING ? (
      <FieldStringOutlined />
    ) : node.type === DataViewFieldType.DATE ||
      node.type === DataViewFieldType.DATETIME ? (
      <CalendarOutlined />
    ) : (
      <FileUnknownOutlined />
    );

  return (
    <FieldRow>
      <div className="field-content">
        <Tooltip title={t('computedFields')} placement="left">
          <FieldTypeIcon>{icon}</FieldTypeIcon>
        </Tooltip>
        <DatasetCommentLabel
          label={label}
          comment={node.sourceComment || node.comment}
          hasCustomName={Boolean(node.customName)}
          secondaryLabel={node.name}
          focusable
        />
      </div>
      <div className="field-actions">
        <Tooltip title={t('edit')}>
          <Button
            className="field-action"
            type="text"
            aria-label={`${t('edit')}: ${label}`}
            onClick={() => menuClick(node, 'exit')}
            icon={<EditOutlined />}
          />
        </Tooltip>
        <Popconfirm
          title={t('deleteSure')}
          okText={t('delete')}
          okButtonProps={{ danger: true }}
          onConfirm={() => menuClick(node, 'delete')}
        >
          <Button
            className="field-action"
            type="text"
            aria-label={`${t('delete')}: ${label}`}
            title={t('delete')}
            icon={<DeleteOutlined />}
          />
        </Popconfirm>
      </div>
    </FieldRow>
  );
});

export default DataModelComputerFieldNode;
