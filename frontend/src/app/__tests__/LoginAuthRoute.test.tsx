import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { LoginAuthRoute } from '../LoginAuthRoute';

const state = vi.hoisted(() => ({ token: '', failed: false, info: null as any, dispatch: vi.fn() }));
vi.mock('utils/auth', () => ({ getToken: () => state.token }));
vi.mock('react-redux', () => ({ useSelector: selector => selector({ app: { systemInfo: state.info, systemInfoFailed: state.failed } }) }));
vi.mock('redux/hooks', () => ({ useAppDispatch: () => state.dispatch }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../slice/selectors', () => ({ selectSystemInfo: (store: any) => store.app.systemInfo }));
vi.mock('../slice/thunks', () => ({ getSystemInfo: () => ({ type: 'retry' }) }));
vi.mock('../pages/MainPage/Loadable', () => ({ LazyMainPage: () => <div>main page</div> }));

describe('LoginAuthRoute', () => {
  beforeEach(() => { state.token = ''; state.failed = false; state.info = null; state.dispatch.mockClear(); });

  it('shows a retry action when system information fails', () => {
    state.failed = true;
    render(<MemoryRouter><LoginAuthRoute /></MemoryRouter>);
    expect(screen.getByText('global.systemInfoError')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'global.retry' }));
    expect(state.dispatch).toHaveBeenCalledWith({ type: 'retry' });
  });

  it('still redirects an unauthenticated user to login', () => {
    state.info = { initialized: true };
    render(<MemoryRouter initialEntries={['/']}><Routes><Route path="/" element={<LoginAuthRoute />} /><Route path="/login" element={<div>login page</div>} /></Routes></MemoryRouter>);
    expect(screen.getByText('login page')).toBeInTheDocument();
  });
});
