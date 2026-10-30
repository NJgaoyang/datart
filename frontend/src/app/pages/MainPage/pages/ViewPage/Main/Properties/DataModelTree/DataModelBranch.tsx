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
  DeleteOutlined,
  EditOutlined,
  FolderOpenOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button, Tooltip } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { FC, memo } from 'react';
import { Draggable, Droppable } from '@hello-pangea/dnd';
import styled from 'styled-components';
import { getFieldDisplayName } from 'utils/utils';
import { DatasetCommentLabel } from '../../../components/DatasetCommentLabel';
import { FONT_SIZE_LABEL } from 'styles/StyleConstants';
import { Column, ColumnRole } from '../../../slice/types';
import { ROOT_CONTAINER_ID, TreeNodeHierarchy } from './constant';
import DataModelNode from './DataModelNode';
import { FieldRow, FieldTypeIcon } from './FieldRow';

const DataModelBranch: FC<{
  node: Column;
  onNodeTypeChange: (type: string[], name: string) => void;
  onMoveToHierarchy: (node: Column) => void;
  onEditBranch;
  onDelete: (node: Column) => void;
  onDeleteFromHierarchy: (parent: Column) => (node: Column) => void;
  onCreateHierarchy?: (node: Column) => void;
  onEditDisplayName?: (node: Column) => void;
}> = memo(
  ({
    node,
    onNodeTypeChange,
    onMoveToHierarchy,
    onEditBranch,
    onDelete,
    onDeleteFromHierarchy,
    onCreateHierarchy,
    onEditDisplayName,
  }) => {
    const t = useI18NPrefix('view.model');

    const renderNode = (node, isDragging) => {
      const label = getFieldDisplayName(node);
      const icon =
        node.role === ColumnRole.Hierarchy ? (
          <FolderOpenOutlined />
        ) : (
          <TableOutlined />
        );

      return (
        <>
          <BranchHeader>
            <div className="field-content">
              <FieldTypeIcon
                className={
                  node.role === ColumnRole.Table ? 'table-icon' : undefined
                }
                aria-hidden="true"
              >
                {icon}
              </FieldTypeIcon>
              <DatasetCommentLabel
                label={label}
                comment={node.sourceComment || node.comment}
                hasCustomName={Boolean(node.customName)}
                secondaryLabel={node.name}
                focusable
              />
            </div>
            <span className="branch-count" aria-hidden="true">
              {node.children?.length || 0}
            </span>
            {node.role === ColumnRole.Hierarchy && (
              <div className="field-actions">
                <Tooltip title={t('rename')}>
                  <Button
                    className="field-action"
                    type="text"
                    aria-label={`${t('rename')}: ${label}`}
                    disabled={isDragging}
                    onClick={() => onEditBranch(node)}
                    icon={<EditOutlined />}
                  />
                </Tooltip>
                <Tooltip title={t('delete')}>
                  <Button
                    className="field-action"
                    type="text"
                    aria-label={`${t('delete')}: ${label}`}
                    disabled={isDragging}
                    onClick={() => onDelete(node)}
                    icon={<DeleteOutlined />}
                  />
                </Tooltip>
              </div>
            )}
          </BranchHeader>
          <div className="branch-children">
            {node?.children?.map(childNode => (
              <DataModelNode
                className="in-hierarchy"
                branchRole={node.role}
                node={childNode}
                key={childNode.name}
                onCreateHierarchy={
                  node.role === ColumnRole.Table ? onCreateHierarchy : undefined
                }
                onMoveToHierarchy={onMoveToHierarchy}
                onNodeTypeChange={onNodeTypeChange}
                onDeleteFromHierarchy={
                  node.role === ColumnRole.Hierarchy
                    ? onDeleteFromHierarchy(node)
                    : undefined
                }
                onEditDisplayName={onEditDisplayName}
              />
            ))}
          </div>
        </>
      );
    };

    return (
      <Draggable
        key={node?.name}
        draggableId={node?.name}
        index={node?.index ?? 0}
        isDragDisabled={true}
      >
        {(draggableProvided, draggableSnapshot) => {
          return (
            <StyledDataModelBranch
              ref={draggableProvided.innerRef}
              {...draggableProvided.draggableProps}
              {...draggableProvided.dragHandleProps}
            >
              <Droppable
                droppableId={
                  node.role === ColumnRole.Table
                    ? ROOT_CONTAINER_ID
                    : node?.name
                }
                type={TreeNodeHierarchy.Branch}
                isCombineEnabled={false}
              >
                {(droppableProvided, droppableSnapshot) => (
                  <div ref={droppableProvided.innerRef}>
                    {renderNode(node, draggableSnapshot.isDragging)}
                    {droppableProvided.placeholder}
                  </div>
                )}
              </Droppable>
            </StyledDataModelBranch>
          );
        }}
      </Draggable>
    );
  },
);

export default DataModelBranch;

const StyledDataModelBranch = styled.div`
  min-width: 0;
  margin: 4px 8px 8px;

  .branch-children {
    padding-left: 8px;
    margin-left: 18px;
    border-left: 1px solid ${p => p.theme.borderColorBase};
  }
`;

const BranchHeader = styled(FieldRow)`
  margin: 0;
  font-weight: 500;

  .table-icon {
    color: ${p => p.theme.info};
  }

  .branch-count {
    flex-shrink: 0;
    min-width: 20px;
    padding: 0 5px;
    font-size: ${FONT_SIZE_LABEL};
    font-weight: 400;
    line-height: 20px;
    color: ${p => p.theme.textColorSnd};
    text-align: center;
    background: ${p => p.theme.bodyBackground};
    border-radius: 4px;
  }
`;
