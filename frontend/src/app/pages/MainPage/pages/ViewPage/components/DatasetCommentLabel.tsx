import { Tooltip } from 'antd';
import { memo } from 'react';
import styled from 'styled-components';
import { CODE_FAMILY, FONT_SIZE_LABEL } from 'styles/StyleConstants';

/** Compact, tail-truncated comment display. Only presentation is truncated:
 * callers retain the full comment in the view/source metadata.
 */
export function getDatasetCommentPreview(
  label: string,
  comment?: string,
  hasCustomName = false,
  maxCharacters = 22,
): { preview: string; tooltip?: string } {
  const fullComment = comment?.trim() || '';
  const visible =
    !hasCustomName && Array.from(fullComment).length > maxCharacters
      ? fullComment
      : label;
  const chars = Array.from(visible);
  const truncated = chars.length > maxCharacters;
  return {
    preview: truncated ? chars.slice(0, maxCharacters).join('') + '…' : visible,
    // A long custom name must reveal itself, not an unrelated source comment.
    // The supplied label may already have been shortened by the field helper.
    tooltip: truncated
      ? visible
      : fullComment && fullComment !== visible
      ? fullComment
      : undefined,
  };
}

interface DatasetCommentLabelProps {
  label: string;
  comment?: string;
  hasCustomName?: boolean;
  maxCharacters?: number;
  secondaryLabel?: string;
  source?: string;
  focusable?: boolean;
}

export const DatasetCommentLabel = memo(
  ({
    label,
    comment,
    hasCustomName,
    maxCharacters,
    secondaryLabel,
    source,
    focusable = false,
  }: DatasetCommentLabelProps) => {
    const { preview, tooltip } = getDatasetCommentPreview(
      label,
      comment,
      hasCustomName,
      maxCharacters,
    );
    const fullName = hasCustomName ? label : tooltip || label;
    const sourceName = source || secondaryLabel;
    const showSecondary = secondaryLabel && secondaryLabel !== label;
    return (
      <Tooltip
        title={
          <TooltipContent>
            <span>{fullName}</span>
            {sourceName && sourceName !== fullName && <code>{sourceName}</code>}
            {comment?.trim() && comment.trim() !== fullName && (
              <span>{comment.trim()}</span>
            )}
          </TooltipContent>
        }
        placement="topLeft"
        trigger={['hover', 'focus']}
        mouseEnterDelay={0.3}
      >
        <Label tabIndex={focusable ? 0 : undefined}>
          <span className="field-label-primary">{preview}</span>
          {showSecondary && (
            <span className="field-label-secondary">{secondaryLabel}</span>
          )}
        </Label>
      </Tooltip>
    );
  },
);

const Label = styled.span`
  display: inline-flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  vertical-align: middle;

  .field-label-primary,
  .field-label-secondary {
    display: block;
    overflow: hidden;
    line-height: 20px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .field-label-secondary {
    font-family: ${CODE_FAMILY};
    font-size: ${FONT_SIZE_LABEL};
    line-height: 16px;
    color: ${p => p.theme.textColorSnd};
  }

  &:focus-visible {
    outline: 2px solid ${p => p.theme.primary};
    outline-offset: -2px;
    border-radius: 3px;
  }
`;

const TooltipContent = styled.span`
  display: flex;
  flex-direction: column;
  gap: 4px;
  white-space: normal;
  overflow-wrap: anywhere;

  code {
    font-family: ${CODE_FAMILY};
    font-size: ${FONT_SIZE_LABEL};
  }
`;
