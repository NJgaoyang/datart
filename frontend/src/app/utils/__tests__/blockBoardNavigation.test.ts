import { vi } from 'vitest';
import { createMemoryHistory } from 'history';
import { blockBoardNavigation } from '../blockBoardNavigation';

describe('unsaved dashboard navigation guard', () => {
  it('holds PUSH until discard is confirmed and does not double-prompt', () => {
    const history = createMemoryHistory({ initialEntries: ['/boardEditor'] });
    let proceed: (() => void) | undefined;
    let stay: (() => void) | undefined;
    const confirmExit = vi.fn((yes, no) => { proceed = yes; stay = no; });
    const leave = vi.fn();
    const stop = blockBoardNavigation(history, {
      dirty: true, saving: false, confirmExit,
      onBlockedWhileSaving: vi.fn(), onLeave: leave,
    });
    history.push('/other');
    expect(history.location.pathname).toBe('/boardEditor');
    expect(confirmExit).toHaveBeenCalledTimes(1);
    history.push('/another');
    expect(confirmExit).toHaveBeenCalledTimes(1);
    stay?.();
    history.replace('/replace');
    expect(history.location.pathname).toBe('/boardEditor');
    expect(confirmExit).toHaveBeenCalledTimes(2);
    proceed?.();
    expect(history.location.pathname).toBe('/replace');
    expect(leave).toHaveBeenCalledTimes(1);
    history.push('/after');
    expect(history.location.pathname).toBe('/after');
    stop();
  });

  it('blocks browser history POP and preserves the current editor until approval', () => {
    const history = createMemoryHistory({ initialEntries: ['/list', '/boardEditor'], initialIndex: 1 });
    let approve: (() => void) | undefined;
    blockBoardNavigation(history, {
      dirty: true, saving: false,
      confirmExit: (yes) => { approve = yes; },
      onBlockedWhileSaving: vi.fn(), onLeave: vi.fn(),
    });
    history.back();
    expect(history.location.pathname).toBe('/boardEditor');
    approve?.();
    expect(history.location.pathname).toBe('/list');
  });

  it('refuses to leave during an in-flight save without showing a discard prompt', () => {
    const history = createMemoryHistory({ initialEntries: ['/boardEditor'] });
    const warned = vi.fn(), confirmExit = vi.fn();
    const dispose = blockBoardNavigation(history, {
      dirty: true, saving: true, confirmExit,
      onBlockedWhileSaving: warned, onLeave: vi.fn(),
    });
    history.push('/home');
    expect(history.location.pathname).toBe('/boardEditor');
    expect(warned).toHaveBeenCalledTimes(1);
    expect(confirmExit).not.toHaveBeenCalled();
    dispose();
    history.push('/home');
    expect(history.location.pathname).toBe('/home');
  });

  it('does not block a clean editor and never modifies its route', () => {
    const history = createMemoryHistory({ initialEntries: ['/boardEditor'] });
    blockBoardNavigation(history, {
      dirty: false, saving: false,
      confirmExit: vi.fn(), onBlockedWhileSaving: vi.fn(), onLeave: vi.fn(),
    });
    history.replace('/dashboard');
    expect(history.location.pathname).toBe('/dashboard');
  });
});