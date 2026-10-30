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
  DatabaseOutlined,
  FieldStringOutlined,
  MoreOutlined,
  NumberOutlined,
  SearchOutlined,
  TableOutlined,
} from '@ant-design/icons';
import { Button, Dropdown, Input, Menu, TreeDataNode } from 'antd';
import { Tree } from 'app/components';
import { DataViewFieldType } from 'app/constants';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import useResizeObserver from 'app/hooks/useResizeObserver';
import { useSearchAndExpand } from 'app/hooks/useSearchAndExpand';
import { updateBy } from 'app/utils/mutation';
import { DEFAULT_DEBOUNCE_WAIT } from 'globalConstants';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';
import { memo, useCallback, useContext, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useAppDispatch } from 'redux/hooks';
import styled from 'styled-components';
import { SPACE_MD, SPACE_XS } from 'styles/StyleConstants';
import { RootState } from 'types';
import { getFieldDisplayName } from 'utils/utils';
import { EditorContext } from '../../EditorContext';
import { DatasetCommentLabel } from '../../components/DatasetCommentLabel';
import {
  selectCurrentEditingViewAttr,
  selectDatabaseSchemaLoading,
  selectSourceDatabaseSchemas,
} from '../../slice/selectors';
import { getEditorProvideCompletionItems } from '../../slice/thunks';
import { DatabaseSchema } from '../../slice/types';
import {
  buildAntdTreeNodeModel,
  getSchemaColumnName,
  matchesResourceSearch,
} from '../../utils';
import Container from './Container';

export const Resource = memo(() => {
  const t = useI18NPrefix('view.resource');
  const dispatch = useAppDispatch();
  const { editorCompletionItemProviderRef } = useContext(EditorContext);
  const isDatabaseSchemaLoading = useSelector(selectDatabaseSchemaLoading);
  const sourceId = useSelector<RootState>(state =>
    selectCurrentEditingViewAttr(state, { name: 'sourceId' }),
  ) as string;
  const databaseSchemas = useSelector(state =>
    selectSourceDatabaseSchemas(state, { id: sourceId }),
  );
  const [databaseTreeModel, setDatabaseTreeModel] = useState<TreeDataNode[]>(
    [],
  );

  const { height, ref: treeWrapperRef } = useResizeObserver({
    debounceMs: 200,
  });

  const buildTableNode = useCallback((database: DatabaseSchema) => {
    const children =
      database?.tables?.map(table => {
        return buildTableColumnNode([database.dbName], table);
      }) || [];

    return buildAntdTreeNodeModel([], database.dbName, children, false);
  }, []);

  const buildTableColumnNode = (ancestors: string[] = [], table) => {
    const children =
      table?.columns?.map(column => {
        return Object.assign(
          buildAntdTreeNodeModel(
            ancestors.concat(table.tableName),
            getSchemaColumnName(column?.name),
            [],
            true,
          ),
          {
            type: column?.type,
            originalName: getSchemaColumnName(column?.name),
            comment: column?.comment,
            title: getFieldDisplayName({
              name: getSchemaColumnName(column?.name),
              comment: column?.comment,
            }),
          },
        );
      }) || [];
    return buildAntdTreeNodeModel(ancestors, table.tableName, children, false);
  };

  useEffect(() => {
    setDatabaseTreeModel((databaseSchemas || []).map(buildTableNode));
  }, [buildTableNode, databaseSchemas]);

  const { filteredData, onExpand, debouncedSearch, expandedRowKeys } =
    useSearchAndExpand(
      databaseTreeModel,
      matchesResourceSearch,
      DEFAULT_DEBOUNCE_WAIT,
      true,
    );

  useEffect(() => {
    if (databaseTreeModel && editorCompletionItemProviderRef) {
      editorCompletionItemProviderRef.current?.dispose();
      dispatch(
        getEditorProvideCompletionItems({
          sourceId,
          resolve: getItem => {
            editorCompletionItemProviderRef.current =
              monaco.languages.registerCompletionItemProvider('sql', {
                provideCompletionItems: getItem,
              });
          },
        }),
      );
    }
  }, [dispatch, sourceId, databaseTreeModel, editorCompletionItemProviderRef]);

  const renderIcon = useCallback(({ value, type }: any) => {
    if (Array.isArray(value)) {
      switch (value.length) {
        case 1:
          return <DatabaseOutlined />;
        case 2:
          return <TableOutlined />;
        case 3:
          switch (type as DataViewFieldType) {
            case DataViewFieldType.STRING:
              return <FieldStringOutlined />;
            case DataViewFieldType.NUMERIC:
              return <NumberOutlined />;
            case DataViewFieldType.DATE:
            case DataViewFieldType.DATETIME:
              return <CalendarOutlined />;
          }
      }
    }
  }, []);

  const renderTitle = (node: TreeDataNode) => {
    const field = node as TreeDataNode & {
      originalName?: string;
      comment?: string;
      value?: string[];
    };
    const label = String(node.title || '');
    return (
      <DatasetCommentLabel
        label={label}
        comment={field.comment}
        secondaryLabel={field.originalName}
        source={field.value?.join('.') || field.originalName}
        focusable
      />
    );
  };

  const sortListOrTree = useCallback((list, sortType, sortKey) => {
    return updateBy(list, draft => {
      draft.sort((a, b) => {
        let aname = a[sortKey],
          bname = b[sortKey];
        return String(aname).localeCompare(String(bname));
      });
      draft.forEach(item => {
        if (item.children) {
          item.children = sortListOrTree(item.children, sortType, sortKey);
        }
      });
    });
  }, []);

  const handleMenuClick = useCallback(
    ({ key }) => {
      if (key === 'byNameSort') {
        setDatabaseTreeModel(sortListOrTree(databaseTreeModel, key, 'title'));
      } else {
        setDatabaseTreeModel((databaseSchemas || []).map(buildTableNode));
      }
    },
    [databaseTreeModel, sortListOrTree, databaseSchemas, buildTableNode],
  );

  const getOverlays = useCallback(() => {
    return (
      <Menu
        onClick={handleMenuClick}
        items={[
          {
            key: String('sort'),
            label: t('sortType'),
            children: [
              { key: String('byNameSort'), label: t('byName') },
              { key: String('byOriginalFieldSort'), label: t('byField') },
            ],
          },
        ]}
      />
    );
  }, [handleMenuClick, t]);

  return (
    <Container title="reference">
      <SearchBar>
        <Input
          allowClear
          prefix={<SearchOutlined className="icon" />}
          placeholder={t('searchBilingual')}
          aria-label={t('searchBilingual')}
          onChange={debouncedSearch}
        />
        <Dropdown
          key="more"
          trigger={['click']}
          placement="bottomRight"
          popupRender={() => getOverlays()}
        >
          <Button
            type="text"
            aria-label={t('sortType')}
            title={t('sortType')}
            icon={<MoreOutlined />}
          />
        </Dropdown>
      </SearchBar>
      <TreeWrapper ref={treeWrapperRef}>
        <Tree
          className="medium"
          treeData={filteredData}
          loading={isDatabaseSchemaLoading}
          icon={renderIcon}
          titleRender={renderTitle}
          selectable={false}
          defaultExpandedKeys={expandedRowKeys}
          height={height}
          itemHeight={40}
          onExpand={onExpand}
        />
      </TreeWrapper>
    </Container>
  );
});

const SearchBar = styled.div`
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 4px;
  padding: 0 ${SPACE_XS} ${SPACE_XS};

  .ant-input-affix-wrapper {
    flex: 1;
    min-width: 0;
  }

  .icon {
    color: ${p => p.theme.textColorSnd};
  }

  .ant-btn {
    flex-shrink: 0;
  }

  .ant-btn:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 1px;
  }
`;

const TreeWrapper = styled.div`
  flex: 1;
  min-width: 0;
  min-height: 0;
  padding-bottom: ${SPACE_MD};
  overflow: hidden;

  .ant-tree.medium {
    background: transparent;

    .ant-tree-treenode {
      box-sizing: border-box;
      min-width: 0;
      padding: 2px 6px;
      border-radius: 4px;

      &:hover,
      &:focus-within {
        background: ${p => p.theme.emphasisBackground};
      }
    }

    .ant-tree-switcher {
      line-height: 36px;
    }

    .ant-tree-indent-unit {
      width: 14px;
    }

    .ant-tree-node-content-wrapper {
      flex: 1;
      min-width: 0;
      min-height: 36px;
      line-height: 20px;
      color: ${p => p.theme.textColor};

      .ant-tree-iconEle {
        color: ${p => p.theme.textColorSnd};
      }

      .ant-tree-title {
        display: flex;
        min-width: 0;
      }
    }

    .ant-tree-treenode-active .ant-tree-node-content-wrapper {
      outline: 2px solid ${p => p.theme.primary};
      outline-offset: -2px;
      border-radius: 4px;
    }
  }
`;
