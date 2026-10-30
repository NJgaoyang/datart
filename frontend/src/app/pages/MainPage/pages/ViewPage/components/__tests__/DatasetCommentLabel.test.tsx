import { render, screen } from '@testing-library/react';
import { DatasetCommentLabel, getDatasetCommentPreview } from '../DatasetCommentLabel';
import { getFieldCommentDisplayName } from 'utils/utils';

describe('dataset field comment display', () => {
  const comment = '这是一段特别长的源数据字段业务注释，描述它在日报统计中如何计算以及特殊口径';

  it('shows only the leading portion and truncates the tail without losing the full text', () => {
    const result = getDatasetCommentPreview('字段', comment, false, 12);
    expect(result.preview).toBe('这是一段特别长的源数据字…');
    expect(result.tooltip).toBe(comment);
    expect(result.preview.startsWith(comment.slice(0, 12))).toBe(true);
  });

  it('keeps short comments and custom names unchanged', () => {
    expect(getDatasetCommentPreview('城市', '城市', false, 22).preview).toBe('城市');
    expect(getDatasetCommentPreview('业务别名', comment, true, 22).preview).toBe('业务别名');
    expect(getDatasetCommentPreview('常规字段')).toEqual({ preview: '常规字段', tooltip: undefined });
  });

  it('renders a focusable text target containing the tail ellipsis', () => {
    render(<DatasetCommentLabel label="字段" comment={comment} maxCharacters={12} />);
    expect(screen.getByText('这是一段特别长的源数据字…')).toBeTruthy();
  });

  it.each([17, 22])('reveals comments already shortened at 16 characters (length %s)', length => {
    const fullComment = '中'.repeat(length);
    const label = getFieldCommentDisplayName(fullComment);
    const result = getDatasetCommentPreview(label, fullComment);
    expect(result.preview).toBe('中'.repeat(16) + '…');
    expect(result.tooltip).toBe(fullComment);
  });

  it('reveals the explanation after punctuation even for a short comment', () => {
    const fullComment = '订单金额：单位元';
    const result = getDatasetCommentPreview(getFieldCommentDisplayName(fullComment), fullComment);
    expect(result.preview).toBe('订单金额');
    expect(result.tooltip).toBe(fullComment);
  });

  it('reveals the full custom name when both the name and source comment are long', () => {
    const customName = '业务'.repeat(15);
    const result = getDatasetCommentPreview(customName, comment, true);
    expect(result.preview).toBe(Array.from(customName).slice(0, 22).join('') + '…');
    expect(result.tooltip).toBe(customName);
  });
});
