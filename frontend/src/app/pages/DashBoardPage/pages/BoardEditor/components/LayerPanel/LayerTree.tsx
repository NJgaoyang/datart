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

import { Tree } from 'app/components';
import { Input } from 'antd';
import { renderIcon } from 'app/hooks/useGetVizIcon';
import useResizeObserver from 'app/hooks/useResizeObserver';
import { WidgetActionContext } from 'app/pages/DashBoardPage/components/ActionProvider/WidgetActionProvider';
import widgetManager from 'app/pages/DashBoardPage/components/WidgetManager';
import { FC, memo, useCallback, useContext, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { stopPPG } from 'utils/utils';
import { dropLayerNodeAction } from '../../slice/actions/actions';
import {
  selectEditingWidgetIds,
  selectLayerTree,
  selectSelectedIds,
} from '../../slice/selectors';
import { EventLayerNode, LayerTreeItem, LayerNode } from './LayerTreeItem';

export const LayerTree: FC<{}> = memo(() => {
  const dispatch = useDispatch();
  const treeData = useSelector(selectLayerTree);
  const [query, setQuery] = useState('');
  const filteredTree = useMemo(() => {
    const needle = query.trim().toLocaleLowerCase();
    if (!needle) return treeData;
    const filter = (nodes: LayerNode[]): LayerNode[] => nodes.flatMap(node => {
      const children = filter(node.children || []);
      const match = String(node.title || '').toLocaleLowerCase().includes(needle);
      return match ? [node] : children.length ? [{ ...node, children }] : [];
    });
    return filter(treeData as LayerNode[]);
  }, [treeData, query]);
  const renderTreeItem = useCallback(n => <LayerTreeItem node={n} />, []);
  const { onEditSelectWidget } = useContext(WidgetActionContext);
  const editingWidgetIds = useSelector(selectEditingWidgetIds);
  const selectedIds = useSelector(selectSelectedIds);

  const { height, ref } = useResizeObserver({
    refreshMode: 'debounce',
    refreshRate: 200,
  });

  const treeSelect = useCallback(
    (_, { node, nativeEvent }) => {
      onEditSelectWidget({
        multipleKey: nativeEvent.shiftKey,
        id: node.key as string,
        selected: true,
      });
    },
    [onEditSelectWidget],
  );

  const icon = useCallback(
    node => renderIcon(widgetManager.meta(node.originalType).icon),
    [],
  );

  const onDrop = useCallback(
    info => {
      const dragNode = info.dragNode as EventLayerNode;
      const targetNode = info.node as EventLayerNode;
      let dropPosition = 'NORMAL';

      if (targetNode.dragOverGapTop) {
        dropPosition = 'TOP';
      }
      if (targetNode.dragOver && !targetNode.isLeaf) {
        dropPosition = 'FOLDER';
      }

      dispatch(dropLayerNodeAction(dragNode, targetNode, dropPosition));
    },
    [dispatch],
  );

  return (
    <div className="layer-tree-search" style={{ display: 'flex', flexDirection: 'column', minHeight: 0, flex: 1 }}>
    <Input.Search
      aria-label="搜索组件图层"
      placeholder="搜索组件"
      allowClear
      value={query}
      onChange={event => setQuery(event.target.value)}
      style={{ padding: '8px 12px', flex: '0 0 auto' }}
    />
    <Tree
      className="medium"
      draggable={!editingWidgetIds ? { icon: false } : false}
      multiple
      loading={false}
      titleRender={renderTreeItem}
      icon={icon}
      onSelect={treeSelect}
      onClick={stopPPG}
      onDrop={onDrop}
      treeData={filteredTree}
      selectedKeys={selectedIds ? selectedIds.split(',') : []}
      height={height}
      wrapperRef={ref}
      defaultExpandAll
    />
    </div>
  );
});
