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
  BranchesOutlined,
  CalendarOutlined,
  DeleteOutlined,
  EditOutlined,
  FieldStringOutlined,
  FileUnknownOutlined,
  MoreOutlined,
  NumberOutlined,
  SisternodeOutlined,
} from '@ant-design/icons';
import { Draggable } from '@hello-pangea/dnd';
import { Button, Dropdown, Tooltip } from 'antd';
import { DataViewFieldType } from 'app/constants';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { FC, memo } from 'react';
import { getFieldDisplayName } from 'utils/utils';
import { DatasetCommentLabel } from '../../../components/DatasetCommentLabel';
import SetFieldType from '../../../components/SetFieldType';
import { Column, ColumnRole } from '../../../slice/types';
import { ALLOW_COMBINE_COLUMN_TYPES } from './constant';
import { FieldRow, FieldTypeButton } from './FieldRow';

const DataModelNode: FC<{
  node: Column;
  className?: string;
  branchRole?: ColumnRole;
  onNodeTypeChange: (type: string[], name: string) => void;
  onMoveToHierarchy: (node: Column) => void;
  onCreateHierarchy?: (node: Column) => void;
  onDeleteFromHierarchy?: (node: Column) => void;
  onEditDisplayName?: (node: Column) => void;
}> = memo(
  ({
    node,
    className,
    onCreateHierarchy,
    onMoveToHierarchy,
    onNodeTypeChange,
    onDeleteFromHierarchy,
    onEditDisplayName,
  }) => {
    const t = useI18NPrefix('view.model');
    const label = getFieldDisplayName(node);
    const source = node.path?.join('.') || node.name;
    const canJoinHierarchy = ALLOW_COMBINE_COLUMN_TYPES.includes(node.type);
    const hierarchyActions = [
      ...(canJoinHierarchy && onCreateHierarchy
        ? [
            {
              key: 'create',
              icon: <BranchesOutlined aria-hidden="true" />,
              label: t('newHierarchy'),
              onClick: () => onCreateHierarchy(node),
            },
          ]
        : []),
      ...(canJoinHierarchy
        ? [
            {
              key: 'move',
              icon: <SisternodeOutlined aria-hidden="true" />,
              label: t('addToHierarchy'),
              onClick: () => onMoveToHierarchy(node),
            },
          ]
        : []),
      ...(onDeleteFromHierarchy
        ? [
            {
              key: 'remove',
              icon: <DeleteOutlined aria-hidden="true" />,
              label: t('delete'),
              onClick: () => onDeleteFromHierarchy(node),
            },
          ]
        : []),
    ];

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
      <Draggable
        key={node?.name}
        draggableId={node?.name}
        index={node?.index ?? 0}
      >
        {(draggableProvided, draggableSnapshot) => (
          <FieldRow
            $isDragging={draggableSnapshot.isDragging}
            className={className}
            style={draggableProvided.draggableProps.style}
            ref={draggableProvided.innerRef}
            {...draggableProvided.draggableProps}
            {...draggableProvided.dragHandleProps}
          >
            <div className="field-content">
              <SetFieldType
                field={node}
                onChange={onNodeTypeChange}
                hasCategory
                icon={
                  <FieldTypeButton
                    type="text"
                    $kind={node.type}
                    aria-label={`${t('typeAndCategory')}: ${label}`}
                    disabled={draggableSnapshot.isDragging}
                    icon={icon}
                  />
                }
              />
              <DatasetCommentLabel
                label={label}
                comment={node.sourceComment || node.comment}
                hasCustomName={Boolean(node.customName)}
                secondaryLabel={source}
                source={source}
                focusable
              />
            </div>
            <div className="field-actions">
              {onEditDisplayName && (
                <Tooltip title={t('setDisplayName')}>
                  <Button
                    className="field-action"
                    type="text"
                    aria-label={`${t('setDisplayName')}: ${label}`}
                    disabled={draggableSnapshot.isDragging}
                    onClick={() => onEditDisplayName(node)}
                    icon={<EditOutlined />}
                  />
                </Tooltip>
              )}
              {!!hierarchyActions.length && (
                <Dropdown
                  trigger={['click']}
                  placement="bottomRight"
                  menu={{ items: hierarchyActions }}
                  disabled={draggableSnapshot.isDragging}
                >
                  <Button
                    className="field-action"
                    type="text"
                    aria-label={`${t('moreActions')}: ${label}`}
                    title={t('moreActions')}
                    disabled={draggableSnapshot.isDragging}
                    icon={<MoreOutlined />}
                  />
                </Dropdown>
              )}
            </div>
          </FieldRow>
        )}
      </Draggable>
    );
  },
);

export default DataModelNode;
