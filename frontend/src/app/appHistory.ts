import { createBrowserHistory, createPath, type BrowserHistory } from 'history';
import type { History as RouterHistory } from '@remix-run/router';

/**
 * React Router v6's HistoryRouter expects @remix-run/router's History
 * interface, while history@5 provides transition blocking. The adapter
 * keeps ONE browser history and normalizes its listener updates for Router.
 */
export type BlockableRouterHistory = RouterHistory & Pick<BrowserHistory, 'block'>;
const native = createBrowserHistory();

const createURL: RouterHistory['createURL'] = to => {
  const path = typeof to === 'string' ? to : createPath(to);
  return new URL(path, window.location.origin);
};

export const appHistory: BlockableRouterHistory = {
  get action() {
    return native.action as unknown as RouterHistory['action'];
  },
  get location() {
    return native.location;
  },
  createHref: to => native.createHref(to),
  createURL,
  encodeLocation: to => {
    const url = createURL(to);
    return { pathname: url.pathname, search: url.search, hash: url.hash };
  },
  push: (to, state) => native.push(to, state),
  replace: (to, state) => native.replace(to, state),
  go: delta => native.go(delta),
  listen: listener => native.listen(({ action, location }) =>
    listener({ action: action as unknown as RouterHistory['action'], location, delta: null }),
  ),
  block: native.block.bind(native),
};