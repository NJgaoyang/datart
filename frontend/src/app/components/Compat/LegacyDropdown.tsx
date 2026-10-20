import { Dropdown, type DropdownProps } from 'antd';
import type { CSSProperties, ReactNode } from 'react';

/**
 * Temporary AntD 5 -> 6 bridge for menu overlays.
 * Datart's existing JSX <Menu> nodes retain their onClick handlers and keyboard behavior.
 * New callsites should prefer antd Dropdown.menu instead.
 */
export type LegacyDropdownProps = DropdownProps & {
  overlay?: ReactNode | (() => ReactNode);
  overlayClassName?: string;
  overlayStyle?: CSSProperties;
  destroyPopupOnHide?: boolean;
  onVisibleChange?: (open: boolean) => void;
};

export default function LegacyDropdown({
  overlay,
  overlayClassName,
  overlayStyle,
  destroyPopupOnHide,
  onVisibleChange,
  ...props
}: LegacyDropdownProps) {
  const renderOverlay = () =>
    typeof overlay === 'function' ? overlay() : overlay;
  return (
    <Dropdown
      {...props}
      menu={overlay === undefined ? props.menu : { items: [] }}
      popupRender={overlay === undefined ? props.popupRender : renderOverlay}
      onOpenChange={onVisibleChange ?? props.onOpenChange}
      destroyOnHidden={destroyPopupOnHide ?? props.destroyOnHidden}
      classNames={overlayClassName ? { ...props.classNames, root: overlayClassName } : props.classNames}
      styles={overlayStyle ? { ...props.styles, root: overlayStyle } : props.styles}
    />
  );
}
