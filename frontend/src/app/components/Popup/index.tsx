import { Popover, PopoverProps } from 'antd';
import {
  cloneElement,
  isValidElement,
  useCallback,
  useMemo,
  useState,
} from 'react';
import { mergeClassNames } from 'utils/utils';

export function Popup({
  content,
  classNames,
  onOpenChange,
  ...rest
}: PopoverProps) {
  const [visible, setVisible] = useState(false);

  const visibleChange = useCallback(
    v => {
      setVisible(v);
      onOpenChange?.(v);
    },
    [onOpenChange],
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

  return (
    <Popover
      {...rest}
      classNames={info => {
        const names =
          typeof classNames === 'function' ? classNames(info) : classNames;
        return { ...names, root: mergeClassNames(names?.root, 'datart-popup') };
      }}
      content={injectedContent}
      open={visible}
      onOpenChange={visibleChange}
    />
  );
}

export { MenuItemLabel } from './MenuItemLabel';
export { MenuWrapper } from './MenuWrapper';
