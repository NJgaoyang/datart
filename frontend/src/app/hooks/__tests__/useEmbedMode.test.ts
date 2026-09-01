import { getEmbedMode } from '../useEmbedMode';

describe('getEmbedMode', () => {
  it('recognizes the explicit weapp embed query', () => {
    expect(getEmbedMode('?embed=weapp')).toBe('weapp');
  });

  it('does not treat other query values as an embed mode', () => {
    expect(getEmbedMode('?embed=wechat')).toBe('none');
    expect(getEmbedMode('')).toBe('none');
  });
});
