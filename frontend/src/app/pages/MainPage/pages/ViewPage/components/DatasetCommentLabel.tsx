import { Tooltip } from 'antd';
import { memo } from 'react';
import styled from 'styled-components';

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
  const visible = !hasCustomName && Array.from(fullComment).length > maxCharacters
    ? fullComment
    : label;
  const chars = Array.from(visible);
  return {
    preview: chars.length > maxCharacters
      ? chars.slice(0, maxCharacters).join('') + '…'
      : visible,
    tooltip: fullComment && (
      fullComment.length > maxCharacters ||
      visible !== label
    ) ? fullComment : chars.length > maxCharacters ? visible : undefined,
  };
}

interface DatasetCommentLabelProps {
  label: string;
  comment?: string;
  hasCustomName?: boolean;
  maxCharacters?: number;
}

export const DatasetCommentLabel = memo(
  ({ label, comment, hasCustomName, maxCharacters }: DatasetCommentLabelProps) => {
    const { preview, tooltip } = getDatasetCommentPreview(
      label,
      comment,
      hasCustomName,
      maxCharacters,
    );
    return (
      <Tooltip title={tooltip} placement="topLeft" mouseEnterDelay={0.3}>
        <Label>{preview}</Label>
      </Tooltip>
    );
  },
);

const Label = styled.span`
  display: inline-block;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  vertical-align: middle;
`;