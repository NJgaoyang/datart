import { PlusOutlined } from '@ant-design/icons';
import { Dropdown, Menu, Tooltip } from 'antd';
import { ReactElement } from 'react';
import { ToolbarButton } from '../ToolbarButton';

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
      popupRender={() => (
        <Menu
          onClick={callback}
          items={[
            ...(safeItems.flatMap(({ key, text }) => [
              { key: String(key), label: text },
            ]) || []),
          ]}
        />
      )}
    >
      <ToolbarButton size="small" icon={icon || <PlusOutlined />} />
    </Dropdown>
  );
}
