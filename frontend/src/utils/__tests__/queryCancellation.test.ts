import { vi } from 'vitest';
import { request2 } from '../request';
import { startQuery } from '../queryCancellation';

vi.mock('../request', () => ({ request2: vi.fn().mockResolvedValue({}) }));

test('replacing a shared query aborts the older request with the share token', () => {
  const first = startQuery('shared-board-test', 'token-one');
  const second = startQuery('shared-board-test', 'token-two');
  expect(first.signal.aborted).toBe(true);
  expect(second.signal.aborted).toBe(false);
  expect(request2).toHaveBeenCalledWith(expect.objectContaining({
    url: `shares/execute/cancel/${first.queryId}`,
    params: { executeToken: 'token-one' },
  }));
  first.finish();
  const third = startQuery('shared-board-test', 'token-three');
  expect(second.signal.aborted).toBe(true);
  third.finish();
});
