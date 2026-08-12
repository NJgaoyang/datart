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
  ApartmentOutlined,
  CopyFilled,
  DeleteOutlined,
  EditOutlined,
  MonitorOutlined,
  MoreOutlined,
} from '@ant-design/icons';
import {
  Button,
  Empty,
  List,
  Menu,
  message,
  Modal,
  Popconfirm,
  TreeDataNode,
} from 'antd';
import { MenuListItem, Popup, Tree, TreeTitle } from 'app/components';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { getCascadeAccess, useAccess } from 'app/pages/MainPage/Access';
import {
  selectIsOrgOwner,
  selectModuleAccessMap,
  selectOrgId,
  selectPermissionMap,
} from 'app/pages/MainPage/slice/selectors';
import { CommonFormTypes } from 'globalConstants';
import React, {
  memo,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { request2 } from 'utils/request';
import { getInsertedNodeIndex, onDropTreeFn, stopPPG } from 'utils/utils';
import { isParentIdEqual } from '../../../slice/utils';
import {
  PermissionLevels,
  ResourceTypes,
} from '../../PermissionPage/constants';
import { useSaveAsView } from '../hooks/useSaveAsView';
import { useStartAnalysis } from '../hooks/useStartAnalysis';
import { SaveFormContext } from '../SaveFormContext';
import {
  selectCurrentEditingViewKey,
  selectViewListLoading,
  selectViews,
} from '../slice/selectors';
import {
  deleteView,
  getViews,
  removeEditingView,
  updateViewBase,
} from '../slice/thunks';

interface FolderTreeProps {
  treeData?: TreeDataNode[];
}

interface LineageItem {
  id: string;
  name: string;
}

interface ViewLineage {
  sources: LineageItem[];
  views: LineageItem[];
  dashboards: LineageItem[];
  analyses: LineageItem[];
}

export const FolderTree = memo(({ treeData }: FolderTreeProps) => {
  const dispatch = useDispatch();
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [lineage, setLineage] = useState<ViewLineage>();
  const [lineageVisible, setLineageVisible] = useState(false);
  const [lineageLoading, setLineageLoading] = useState(false);
  const navigate = useNavigate();
  const { showSaveForm } = useContext(SaveFormContext);
  const loading = useSelector(selectViewListLoading);
  const currentEditingViewKey = useSelector(selectCurrentEditingViewKey);
  const orgId = useSelector(selectOrgId);
  const viewsData = useSelector(selectViews);
  const isOwner = useSelector(selectIsOrgOwner);
  const permissionMap = useSelector(selectPermissionMap);
  const moduleAccessMap = useSelector(selectModuleAccessMap);
  const t = useI18NPrefix('view');
  const tg = useI18NPrefix('global');
  const saveAsView = useSaveAsView();
  const startAnalysis = useStartAnalysis();
  const allowEnableViz = useAccess({
    type: 'module',
    module: ResourceTypes.Viz,
    id: '',
    level: PermissionLevels.Enable,
  })(true);

  useEffect(() => {
    dispatch(getViews(orgId));
  }, [dispatch, orgId]);

  // Sync expandedKeys with treeData to clean up stale keys
  // (keys of nodes that no longer exist in the tree)
  useEffect(() => {
    if (!treeData || treeData.length === 0) return;
    const collectKeys = (nodes: any[]): string[] => {
      return nodes.reduce<string[]>((acc, node) => {
        acc.push(node.key);
        if (node.children) {
          acc.push(...collectKeys(node.children));
        }
        return acc;
      }, []);
    };
    const validKeys = new Set(collectKeys(treeData));
    setExpandedKeys(prev => prev.filter(k => validKeys.has(k)));
  }, [treeData]);

  const redirect = useCallback(
    currentEditingViewKey => {
      if (currentEditingViewKey) {
        navigate(`/organizations/${orgId}/views/${currentEditingViewKey}`);
      } else {
        navigate(`/organizations/${orgId}/views`);
      }
    },
    [navigate, orgId],
  );

  const archive = useCallback(
    (id, isFolder) => e => {
      e.stopPropagation();
      dispatch(
        deleteView({
          id,
          archive: !isFolder,
          resolve: () => {
            dispatch(removeEditingView({ id, resolve: redirect }));
            message.success(
              isFolder
                ? tg('operation.deleteSuccess')
                : tg('operation.archiveSuccess'),
            );
          },
        }),
      );
    },
    [dispatch, redirect, tg],
  );

  const showLineage = useCallback(async (id: string) => {
    setLineageVisible(true);
    setLineageLoading(true);
    try {
      const { data } = await request2<ViewLineage>(`/views/${id}/lineage`);
      setLineage(data);
    } finally {
      setLineageLoading(false);
    }
  }, []);

  const moreMenuClick = useCallback(
    ({ id, name, parentId, index, isFolder }) =>
      ({ key, domEvent }) => {
        domEvent.stopPropagation();
        switch (key) {
          case 'info':
            showSaveForm({
              type: CommonFormTypes.Edit,
              visible: true,
              simple: isFolder,
              initialValues: {
                id,
                name,
                parentId,
              },
              parentIdLabel: t('saveForm.folder'),
              onSave: (values, onClose) => {
                if (isParentIdEqual(parentId, values.parentId)) {
                  index = getInsertedNodeIndex(values, viewsData);
                }

                dispatch(
                  updateViewBase({
                    view: {
                      id,
                      ...values,
                      parentId: values.parentId || null,
                      index,
                    },
                    resolve: onClose,
                  }),
                );
              },
            });
            break;
          case 'delete':
            break;
          case 'saveAs':
            saveAsView(id);
            break;
          case 'startAnalysis':
            startAnalysis(id);
            break;
          case 'lineage':
            showLineage(id);
            break;
          default:
            break;
        }
      },
    [
      dispatch,
      showSaveForm,
      viewsData,
      t,
      saveAsView,
      startAnalysis,
      showLineage,
    ],
  );

  const renderTreeTitle = useCallback(
    node => {
      const { title, path, isFolder, id } = node;
      const isAuthorized = getCascadeAccess(
        isOwner,
        permissionMap,
        moduleAccessMap,
        ResourceTypes.View,
        path,
        PermissionLevels.Manage,
      );
      return (
        <TreeTitle>
          <h4>{`${title}`}</h4>
          {isAuthorized || allowEnableViz || !isFolder ? (
            <Popup
              trigger={['click']}
              placement="bottom"
              content={
                <Menu
                  prefixCls="ant-dropdown-menu"
                  selectable={false}
                  onClick={moreMenuClick(node)}
                >
                  {isAuthorized && (
                    <MenuListItem
                      key="info"
                      prefix={<EditOutlined className="icon" />}
                    >
                      {tg('button.info')}
                    </MenuListItem>
                  )}

                  {isAuthorized && !isFolder && (
                    <MenuListItem
                      key="saveAs"
                      prefix={<CopyFilled className="icon" />}
                    >
                      {tg('button.saveAs')}
                    </MenuListItem>
                  )}

                  {allowEnableViz && !isFolder && (
                    <MenuListItem
                      prefix={<MonitorOutlined className="icon" />}
                      key="startAnalysis"
                    >
                      {t('editor.startAnalysis')}
                    </MenuListItem>
                  )}

                  {!isFolder && (
                    <MenuListItem
                      prefix={<ApartmentOutlined className="icon" />}
                      key="lineage"
                    >
                      {t('lineage.title')}
                    </MenuListItem>
                  )}

                  {isAuthorized && (
                    <MenuListItem
                      key="delete"
                      prefix={<DeleteOutlined className="icon" />}
                    >
                      <Popconfirm
                        title={
                          isFolder
                            ? tg('operation.deleteConfirm')
                            : tg('operation.archiveConfirm')
                        }
                        onConfirm={archive(id, isFolder)}
                      >
                        {isFolder ? tg('button.delete') : tg('button.archive')}
                      </Popconfirm>
                    </MenuListItem>
                  )}
                </Menu>
              }
            >
              <span className="action" onClick={stopPPG}>
                <MoreOutlined />
              </span>
            </Popup>
          ) : (
            ''
          )}
        </TreeTitle>
      );
    },
    [
      archive,
      moreMenuClick,
      tg,
      allowEnableViz,
      t,
      isOwner,
      permissionMap,
      moduleAccessMap,
    ],
  );

  const treeSelect = useCallback(
    (_, { node }) => {
      if (node.isFolder) {
        if (expandedKeys?.includes(node.key)) {
          setExpandedKeys(expandedKeys.filter(k => k !== node.key));
        } else {
          setExpandedKeys([node.key].concat(expandedKeys));
        }
      }
      if (!node.isFolder && node.id !== currentEditingViewKey) {
        navigate(`/organizations/${orgId}/views/${node.id}`);
      }
    },
    [navigate, orgId, currentEditingViewKey, expandedKeys],
  );

  const onDrop = info => {
    onDropTreeFn({
      info,
      treeData,
      callback: (id, parentId, index) => {
        dispatch(
          updateViewBase({
            view: {
              id,
              parentId,
              index: index,
              name: info.dragNode.name,
            },
            resolve: () => {},
          }),
        );
      },
    });
  };

  const handleExpandTreeNode = expandedKeys => {
    setExpandedKeys(expandedKeys);
  };

  return (
    <>
      <Tree
        loading={loading}
        treeData={treeData}
        titleRender={renderTreeTitle}
        selectedKeys={[currentEditingViewKey]}
        onSelect={treeSelect}
        onDrop={onDrop}
        expandedKeys={expandedKeys}
        onExpand={handleExpandTreeNode}
        draggable={{ icon: false }}
      />
      <Modal
        title={t('lineage.title')}
        visible={lineageVisible}
        footer={null}
        confirmLoading={lineageLoading}
        onCancel={() => setLineageVisible(false)}
      >
        {!lineageLoading &&
        lineage &&
        lineage.sources.length +
          lineage.views.length +
          lineage.dashboards.length +
          lineage.analyses.length ===
          0 ? (
          <Empty description={t('lineage.empty')} />
        ) : (
          <>
            {!!lineage?.sources.length && (
              <List
                header={t('lineage.sources')}
                dataSource={lineage.sources}
                renderItem={item => (
                  <List.Item>
                    {item.name}
                  </List.Item>
                )}
              />
            )}
            {!!lineage?.views.length && (
              <List
                header={t('lineage.views')}
                dataSource={lineage.views}
                renderItem={item => (
                  <List.Item
                    onClick={() => {
                      setLineageVisible(false);
                      navigate(`/organizations/${orgId}/views/${item.id}`);
                    }}
                  >
                    <Button type="link">{item.name}</Button>
                  </List.Item>
                )}
              />
            )}
            {!!lineage?.dashboards.length && (
              <List
                header={t('lineage.dashboards')}
                dataSource={lineage.dashboards}
                renderItem={item => (
                  <List.Item
                    onClick={() =>
                      navigate(
                        `/organizations/${orgId}/vizs/${item.id}/boardEditor`,
                      )
                    }
                  >
                    <Button type="link">{item.name}</Button>
                  </List.Item>
                )}
              />
            )}
            {!!lineage?.analyses.length && (
              <List
                header={t('lineage.analyses')}
                dataSource={lineage.analyses}
                renderItem={item => (
                  <List.Item
                    onClick={() =>
                      navigate({
                        pathname: `/organizations/${orgId}/vizs/chartEditor`,
                        search: `dataChartId=${item.id}&chartType=dataChart&container=dataChart`,
                      })
                    }
                  >
                    <Button type="link">{item.name}</Button>
                  </List.Item>
                )}
              />
            )}
          </>
        )}
      </Modal>
    </>
  );
});
