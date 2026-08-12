import { Avatar as AntdAvatar, AvatarProps } from 'antd';
import endsWith from 'lodash/endsWith';
import { CSSProperties, useCallback, useState } from 'react';
import styled from 'styled-components';

export function Avatar(props: AvatarProps) {
  let style: CSSProperties = {};
  let { src, size, ...rest } = props;
  const [safeSrc, setSafeSrc] = useState<any>(src);
  const [imageError, setImageError] = useState(false);

  const handleError = useCallback(() => {
    setImageError(true);
    setSafeSrc('');
    return false;
  }, []);

  if (typeof size === 'number') {
    style.fontSize = `${size * 0.375}px`;
  }
  if (
    typeof safeSrc === 'string' &&
    (endsWith(safeSrc, 'null') || endsWith(safeSrc, 'undefined'))
  ) {
    setSafeSrc('');
  }

  // 图片加载失败时，src 设为 undefined，让 antd Avatar 显示 children 而不是裂图
  const finalSrc = imageError || !safeSrc ? undefined : safeSrc;

  return (
    <StyledAvatar
      {...rest}
      src={finalSrc}
      size={size}
      style={style}
      onError={handleError}
    >
      {props.children}
    </StyledAvatar>
  );
}

const StyledAvatar = styled(AntdAvatar)`
  &.ant-avatar {
    color: ${p => p.theme.textColorLight};
    background-color: ${p => p.theme.emphasisBackground};
  }
`;
