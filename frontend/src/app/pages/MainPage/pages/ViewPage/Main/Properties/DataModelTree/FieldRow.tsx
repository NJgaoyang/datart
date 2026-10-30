import { Button } from 'antd';
import styled from 'styled-components';
import { FONT_SIZE_BODY, FONT_SIZE_TITLE } from 'styles/StyleConstants';

export const FieldRow = styled.div<{ $isDragging?: boolean }>`
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  min-height: 38px;
  padding: 4px 6px;
  margin: 2px 8px;
  font-size: ${FONT_SIZE_BODY};
  color: ${p => p.theme.textColor};
  user-select: none;
  background: ${p =>
    p.$isDragging ? p.theme.highlightBackground : 'transparent'};
  border: 1px solid transparent;
  border-radius: 6px;

  &:hover,
  &:focus-within {
    background: ${p => p.theme.emphasisBackground};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: -2px;
  }

  &.in-hierarchy {
    margin-right: 0;
    margin-left: 0;
  }

  .field-content {
    display: flex;
    flex: 1;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }

  .field-actions {
    display: flex;
    flex-shrink: 0;
    align-items: center;
    margin-left: auto;
  }

  .field-action.ant-btn {
    width: 26px;
    min-width: 26px;
    height: 28px;
    padding: 0;
    color: ${p => p.theme.textColorSnd};
  }

  .field-action.ant-btn-dangerous {
    color: ${p => p.theme.error};
  }

  .ant-btn:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: 1px;
  }
`;

export const FieldTypeButton = styled(Button)<{ $kind: string }>`
  flex-shrink: 0;
  width: 26px;
  min-width: 26px;
  height: 28px;
  padding: 0;
  font-size: ${FONT_SIZE_TITLE};
  color: ${p =>
    p.$kind === 'NUMERIC'
      ? p.theme.success
      : ['STRING', 'DATE', 'DATETIME'].includes(p.$kind)
      ? p.theme.info
      : p.theme.warning};
  border: 1px solid ${p => p.theme.borderColorBase};
  border-radius: 5px;
`;

export const FieldTypeIcon = styled.span`
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 28px;
  font-size: ${FONT_SIZE_TITLE};
  color: ${p => p.theme.warning};
`;
