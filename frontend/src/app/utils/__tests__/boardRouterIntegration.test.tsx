import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { unstable_HistoryRouter as HistoryRouter, Link, Route, Routes } from 'react-router-dom';
import { appHistory } from '../../appHistory';
import { blockBoardNavigation } from '../blockBoardNavigation';

describe('BrowserRouter replacement SPA navigation integration', () => {
  afterEach(() => {
    cleanup();
    appHistory.replace('/test-reset');
  });

  it('blocks real Router Link navigation and retries after explicit discard', () => {
    appHistory.replace('/boardEditor');
    let approve: (() => void) | undefined;
    const stop = blockBoardNavigation(appHistory, {
      dirty: true,
      saving: false,
      confirmExit: yes => { approve = yes; },
      onBlockedWhileSaving: () => undefined,
      onLeave: () => undefined,
    });
    render(
      <HistoryRouter history={appHistory}>
        <Routes>
          <Route path="/boardEditor" element={<Link to="/dashboard">离开编辑器</Link>} />
          <Route path="/dashboard" element={<div>已离开编辑器</div>} />
        </Routes>
      </HistoryRouter>,
    );
    fireEvent.click(screen.getByText('离开编辑器'));
    expect(appHistory.location.pathname).toBe('/boardEditor');
    expect(screen.queryByText('已离开编辑器')).toBeNull();
    act(() => { approve?.(); });
    expect(appHistory.location.pathname).toBe('/dashboard');
    expect(screen.getByText('已离开编辑器')).toBeTruthy();
    stop();
  });
});