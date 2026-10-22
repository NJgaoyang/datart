import { vi } from 'vitest';
import { request2 } from 'utils/request';
import { fetchChartDataSet } from '../fetch';

vi.mock('utils/request', () => ({
  request2: vi.fn(),
  requestWithHeader: vi.fn(),
}));

const request = vi.mocked(request2);

describe('shared/regular chart data envelope processing', () => {
  afterEach(() => request.mockReset());

  it('keeps shared query permissions in the structured business error', async () => {
    request.mockResolvedValueOnce({
      success: false, errCode: 403, data: null,
    } as any);
    await expect(fetchChartDataSet({ vizId: 'test-view' }, { token: 'test' } as any))
      .rejects.toMatchObject({ errCode: 403, message: '数据查询失败，请重试' });
    expect((request.mock.calls[0][0] as any).url).toBe('shares/execute');
  });

  it('preserves Axios 403 when shared queries fail at HTTP level', async () => {
    const forbidden = { response: { status: 403, data: { success: false } } };
    request.mockRejectedValueOnce(forbidden);
    await expect(fetchChartDataSet({}, { token: 'test' } as any)).rejects.toBe(forbidden);
  });

  it('passes through successful regular query rows', async () => {
    request.mockResolvedValueOnce({
      success: true, data: { rows: [['ok']] },
    } as any);
    await expect(fetchChartDataSet({ vizId: 'test-view' })).resolves.toEqual({ rows: [['ok']] });
    expect((request.mock.calls[0][0] as any).url).toBe('data-provider/execute');
  });

  it('treats non-permission business failures as generic query errors', async () => {
    request.mockResolvedValueOnce({ success: false, errCode: 0, data: null } as any);
    await expect(fetchChartDataSet({ vizId: 'test-view' }))
      .rejects.toThrow('数据查询失败，请重试');
  });
});
describe('undefined report query API response', () => {
  it('rejects missing HTTP response instead of returning undefined data', async () => {
    request.mockResolvedValueOnce(undefined as any);
    await expect(fetchChartDataSet({ vizId: 'daily-detail' }))
      .rejects.toThrow('数据查询失败，请重试');
  });

  it('rejects success without data instead of displaying empty results', async () => {
    request.mockResolvedValueOnce({ success: true } as any);
    await expect(fetchChartDataSet({ vizId: 'daily-detail' }))
      .rejects.toThrow('数据查询失败，请重试');
  });
});
