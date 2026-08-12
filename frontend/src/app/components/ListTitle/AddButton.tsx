import { PlusOutlined } from '@ant-design/icons';
import { Dropdown, Menu, Tooltip } from 'antd';
import { ToolbarButton } from 'app/components';
import React, { ReactElement } from 'react';

interface AddButtonProps {
  dataSource: {
    items: Array<{ key: string; text: string }>;
    icon?: ReactElement;
    callback: (menuClickHandler?: any) => void;
  };
}

export function AddButton({
  dataSource: { items, icon, callback },
}: AddButtonProps) {
  const safeItems = items || [];
  return safeItems.length < 2 ? (
    <Tooltip title={safeItems[0]?.text} placement="bottom">
      <ToolbarButton
        size="small"
        icon={icon || <PlusOutlined />}
        onClick={callback}
      />
    </Tooltip>
  ) : (
    <Dropdown
      trigger={['click']}
      overlay={
        <Menu onClick={callback}>
          {safeItems.map(({ key, text }) => (
            <Menu.Item key={key}>{text}</Menu.Item>
          ))}
        </Menu>
      }
    >
      <ToolbarButton size="small" icon={icon || <PlusOutlined />} />
    </Dropdown>
  );
}
