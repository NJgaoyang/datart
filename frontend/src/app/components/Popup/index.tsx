import { Popover, PopoverProps } from 'antd';
import React, {
  cloneElement,
  isValidElement,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { mergeClassNames } from 'utils/utils';

export function Popup({
  content,
  overlayClassName,
  onVisibleChange,
  ...rest
}: PopoverProps & { overlayClassName?: string; onVisibleChange?: (open: boolean) => void }) {
  const [visible, setVisible] = useState(false);

  const visibleChange = useCallback(
    v => {
      setVisible(v);
      onVisibleChange && onVisibleChange(v);
    },
    [onVisibleChange],
  );

  const onClose = useCallback(() => {
    setVisible(false);
  }, []);

  const injectedContent = useMemo(
    () =>
      isValidElement(content)
        ? cloneElement(content, { onClose } as any)
        : content,
    [content, onClose],
  );

  const className = mergeClassNames(overlayClassName, 'datart-popup');
  return (
    <Popover
      {...rest}
      classNames={{ root: className }}
      content={injectedContent}
      open={visible}
      onOpenChange={visibleChange}
    />
  );
}

export { MenuListItem } from './MenuListItem';
export { MenuWrapper } from './MenuWrapper';
