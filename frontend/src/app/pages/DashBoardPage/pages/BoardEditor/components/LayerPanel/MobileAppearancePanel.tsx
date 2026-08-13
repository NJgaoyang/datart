/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 */

import { Checkbox } from 'antd';
import widgetManager from 'app/pages/DashBoardPage/components/WidgetManager';
import { DeviceType } from 'app/pages/DashBoardPage/pages/Board/slice/types';
import { isMobileWidgetVisible } from 'app/pages/DashBoardPage/utils/autoLayout';
import { FC, memo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import styled from 'styled-components';
import { editBoardStackActions } from '../../slice';
import { selectDeviceType, selectMobileLayoutWidgets } from '../../slice/selectors';

export const MobileAppearancePanel: FC = memo(() => {
  const deviceType = useSelector(selectDeviceType);
  const dispatch = useDispatch();
  const widgets = useSelector(selectMobileLayoutWidgets);

  const changeVisible = useCallback(
    (id: string, visible: boolean) => {
      dispatch(
        editBoardStackActions.updateWidgetConfigByKey({
          wid: id,
          key: 'mVisible',
          val: visible,
        }),
      );
    },
    [dispatch],
  );

  if (deviceType !== DeviceType.Mobile) return null;

  return (
    <Panel onClick={event => event.stopPropagation()}>
      <Title>移动端展示</Title>
      <Hint>选择需要在移动端显示的组件</Hint>
      <List>
        {widgets.map(widget => (
          <Item key={widget.id}>
            <Checkbox
              checked={isMobileWidgetVisible(widget)}
              onChange={event => changeVisible(widget.id, event.target.checked)}
            >
              <Name title={widget.config.name || undefined}>
                {widget.config.name || '未命名组件'}
              </Name>
            </Checkbox>
            <Type>
              {widgetManager.toolkit(widget.config.originalType).getName()}
            </Type>
          </Item>
        ))}
      </List>
    </Panel>
  );
});

const Panel = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  padding: 16px;
  background: ${p => p.theme.componentBackground};
  box-sizing: border-box;
  overflow: hidden;
`;

const Title = styled.div`
  flex: 0 0 auto;
  color: ${p => p.theme.textColor};
  font-size: 14px;
  font-weight: 600;
`;

const Hint = styled.div`
  flex: 0 0 auto;
  margin-top: 8px;
  color: ${p => p.theme.textColorSnd};
  font-size: 12px;
`;

const List = styled.div`
  flex: 1;
  min-height: 0;
  margin-top: 12px;
  overflow-y: auto;
`;

const Item = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  padding: 8px 0;
  border-bottom: 1px solid ${p => p.theme.borderColorSplit};

  .ant-checkbox-wrapper {
    display: flex;
    flex: 1;
    min-width: 0;
    align-items: center;
  }
`;

const Name = styled.span`
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const Type = styled.span`
  flex: 0 0 auto;
  margin-left: 8px;
  color: ${p => p.theme.textColorLight};
  font-size: 11px;
`;
