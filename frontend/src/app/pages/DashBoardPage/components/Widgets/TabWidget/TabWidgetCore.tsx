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
import { Tabs, type TabsProps } from 'antd';
import { TabWidgetContent } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { dispatchResize } from 'app/utils/dispatchResize';
import {
  memo,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import { useDispatch } from 'react-redux';
import styled from 'styled-components';
import { PRIMARY } from 'styles/StyleConstants';
import { uuidv4 } from 'utils/utils';
import { editBoardStackActions } from '../../../pages/BoardEditor/slice';
import { WidgetActionContext } from '../../ActionProvider/WidgetActionProvider';
import { BoardContext } from '../../BoardProvider/BoardProvider';
import { DropHolder } from '../../WidgetComponents/DropHolder';
import { WidgetMapper } from '../../WidgetMapper/WidgetMapper';
import { WidgetInfoContext } from '../../WidgetProvider/WidgetInfoProvider';
import { WidgetContext } from '../../WidgetProvider/WidgetProvider';
import { WidgetWrapProvider } from '../../WidgetProvider/WidgetWrapProvider';
import tabProto, { TabToolkit } from './tabConfig';

export const TabWidgetCore: React.FC<{}> = memo(() => {
  const dispatch = useDispatch();
  const widget = useContext(WidgetContext);
  const { align, position } = (tabProto.toolkit as TabToolkit).getCustomConfig(
    widget.config.customConfig.props,
  );
  const { editing } = useContext(WidgetInfoContext);
  const { onEditSelectWidget } = useContext(WidgetActionContext);
  const {
    boardType,
    editing: boardEditing,
    boardId,
  } = useContext(BoardContext);
  const { itemMap } = widget.config.content as TabWidgetContent;
  const tabsCons = useMemo(
    () => Object.values(itemMap || {}).sort((a, b) => a.index - b.index),
    [itemMap],
  );
  // Ant Design 6 uses string item keys. Keep both edit/read tabs controlled.
  const [activeKey, setActiveKey] = useState<string>(
    String(tabsCons[0]?.index ?? ''),
  );
  const resolvedActiveKey = tabsCons.some(t => String(t.index) === activeKey)
    ? activeKey
    : String(tabsCons[0]?.index ?? '');

  useEffect(() => {
    const tab = tabsCons.find(t => String(t.index) === resolvedActiveKey);
    if (tab && editing) {
      onEditSelectWidget({
        multipleKey: false,
        id: tab.childWidgetId,
        selected: true,
      });
    }
  }, [resolvedActiveKey, editing, onEditSelectWidget, tabsCons]);

  const onTabChange = useCallback((activeKey: string) => {
    setActiveKey(activeKey);
  }, []);

  // 标签内容提交后同步一次尺寸，避免通过多个定时器重复补偿布局。
  useLayoutEffect(() => {
    const frame = requestAnimationFrame(dispatchResize);
    return () => cancelAnimationFrame(frame);
  }, [resolvedActiveKey]);

  const tabAdd = useCallback(() => {
    const newTabId = `tab_${uuidv4()}`;
    const maxIndex = tabsCons[tabsCons.length - 1]?.index || 0;
    const nextIndex = maxIndex + 1;
    dispatch(
      editBoardStackActions.tabsWidgetAddTab({
        parentId: widget.id,
        tabItem: {
          index: nextIndex,
          name: 'tab',
          tabId: newTabId,
          childWidgetId: '',
        },
      }),
    );
    setActiveKey(String(nextIndex));
  }, [dispatch, tabsCons, widget.id]);

  const tabRemove = useCallback(
    targetKey => {
      const tabId =
        tabsCons.find(tab => String(tab.index) === targetKey)?.tabId || '';
      dispatch(
        editBoardStackActions.tabsWidgetRemoveTab({
          parentId: widget.id,
          sourceTabId: tabId,
          mode: boardType,
        }),
      );
      if (resolvedActiveKey === String(targetKey)) {
        const remaining = tabsCons.filter(
          tab => String(tab.index) !== String(targetKey),
        );
        setActiveKey(String(remaining[0]?.index ?? ''));
      }
    },

    [dispatch, widget.id, boardType, tabsCons, resolvedActiveKey],
  );

  const tabEdit = useCallback(
    (targetKey, action: 'add' | 'remove') => {
      action === 'add' ? tabAdd() : tabRemove(targetKey);
    },
    [tabAdd, tabRemove],
  );

  const tabItems: TabsProps['items'] = tabsCons.map(tab => ({
    key: String(tab.index),
    label: tab.name || 'tab',
    className: 'TabPane',
    children: tab.childWidgetId ? (
      <WidgetWrapProvider
        id={tab.childWidgetId}
        boardEditing={boardEditing}
        boardId={boardId}
      >
        <MapWrapper>
          <WidgetMapper boardEditing={boardEditing} hideTitle={true} />
        </MapWrapper>
      </WidgetWrapProvider>
    ) : boardEditing ? (
      <DropHolder tabItem={tab} tabWidgetId={widget.id} />
    ) : null,
  }));

  return (
    <TabsBoxWrap className="TabsBoxWrap" tabsAlign={align}>
      <Tabs
        items={tabItems}
        onChange={onTabChange}
        size="small"
        tabBarGutter={1}
        tabPlacement={
          (position === 'left'
            ? 'start'
            : position === 'right'
            ? 'end'
            : position) as TabsProps['tabPlacement']
        }
        activeKey={resolvedActiveKey}
        tabBarStyle={{ fontSize: '16px' }}
        type={editing ? 'editable-card' : undefined}
        onEdit={editing ? tabEdit : undefined}
        destroyOnHidden
      />
    </TabsBoxWrap>
  );
});
const MapWrapper = styled.div`
  position: relative;
  box-sizing: border-box;
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
`;
const TabsBoxWrap = styled.div<{ tabsAlign: string }>`
  width: 100%;
  height: 100%;

  & .ant-tabs {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: none;
  }

  & .ant-tabs-body-holder {
    display: flex;
    flex: 1 1 auto;
    min-height: 0;
    overflow: hidden;
  }

  & .ant-tabs-body {
    display: flex;
    flex: 1 1 auto;
    width: 100%;
    height: 100%;
    min-height: 0;
    padding: 0 !important;
    margin: 0 !important;
  }

  & .ant-tabs-body-holder,
  & .ant-tabs-content,
  & .TabPane,
  & .MapWrapper {
    box-sizing: border-box;
    min-height: 0;
    padding: 0 !important;
    margin: 0 !important;
  }

  & .ant-tabs-content {
    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    width: 100%;
    height: 100%;
  }

  .ant-tabs-nav {
    margin: 0;
  }

  .ant-tabs-tab {
    padding: 0 !important;
    /* antd5 的 CSS-in-JS 会对 .ant-tabs-tab + .ant-tabs-tab 设 margin:0 0 0 32px（specificity 更高），
       覆盖掉本规则导致只有首个 tab 有 margin-right、其余 tab 间距塌成 1px（视觉上 tab 宽窄/排布不一）。
       加 !important 使所有 tab 间距一致（恢复 antd4 表现）。 */
    margin-right: 30px !important;
  }
  & .ant-tabs.ant-tabs-card.ant-tabs-card > .ant-tabs-nav .ant-tabs-tab {
    margin: 0 10px;
  }
  & .TabPane {
    width: 100%;
    height: 100%;
  }
  & .ant-tabs-tab-remove {
    background-color: ${PRIMARY};
  }

  & .ant-tabs > .ant-tabs-nav .ant-tabs-nav-add {
    padding: 0;
    /* color: ${PRIMARY}; */
    margin: 0 20px;
    background: none;
    border: none;
  }

  & .ant-tabs .ant-tabs-nav-wrap {
    justify-content: ${p => p.tabsAlign};

    & > .ant-tabs-nav-list {
      flex: none;
    }
  }
`;
