import { act, cleanup, render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { DashboardForShare } from '../DashboardForShare';

vi.mock('react-redux', () => ({
  useDispatch: () => vi.fn(),
  useSelector: () => ({
    needFetchItems: [],
    hasFetchItems: [],
    boardWidthHeight: [0, 0],
  }),
}));
vi.mock('react-dnd', () => ({
  DndProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('app/pages/DashBoardPage/components/BoardProvider/BoardInitProvider', () => ({
  BoardInitProvider: ({ isMobile, children }: { isMobile: boolean; children: React.ReactNode }) =>
    <section data-testid="board-provider" data-mobile={String(Boolean(isMobile))}>{children}</section>,
}));
vi.mock('app/pages/DashBoardPage/pages/Board/MobileBoard', () => ({
  SharedMobileBoardCore: () => <div data-testid="mobile-share-layout">mobile mRect layout</div>,
}));
vi.mock('app/pages/DashBoardPage/pages/Board/AutoDashboard/AutoBoardCore', () => ({
  AutoBoardCore: () => <div data-testid="desktop-share-layout">desktop pRect layout</div>,
}));
vi.mock('app/pages/DashBoardPage/pages/Board/FreeDashboard/FreeBoardCore', () => ({
  FreeBoardCore: () => <div data-testid="free-share-layout">free layout</div>,
}));
vi.mock('app/pages/DashBoardPage/components/FullScreenPanel/FullScreenPanel', () => ({
  FullScreenPanel: () => null,
}));
vi.mock('../components/TitleForShare', () => ({
  default: () => null,
}));
vi.mock('app/pages/SharePage/components/TitleForShare', () => ({
  default: () => null,
}));
vi.mock('app/pages/SharePage/components/HeadlessBrowserIdentifier', () => ({
  HeadlessBrowserIdentifier: () => null,
}));
vi.mock('app/pages/SharePage/components/DownloadTaskContainer', () => ({
  DownloadTaskContainer: () => null,
}));

const props = {
  dashboard: { id: 'board-share', name: '分享测试', config: { type: 'auto' } } as any,
  renderMode: 'share' as const,
  filterSearchUrl: '',
  allowDownload: false,
  loadVizData: vi.fn(),
  onLoadShareTask: vi.fn() as any,
  onDownloadFile: vi.fn(),
  onMakeShareDownloadDataTask: vi.fn(),
};

const width = (value: number) => {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value });
  act(() => window.dispatchEvent(new Event('resize')));
};

describe('shared board viewport renderer', () => {
  afterEach(() => {
    cleanup();
    width(1200);
  });

  it('uses mRect at mobile width and switches back to pRect on desktop', () => {
    width(375);
    render(<DashboardForShare {...props} />);
    expect(screen.getByTestId('mobile-share-layout')).toBeTruthy();
    expect(screen.getByTestId('board-provider').getAttribute('data-mobile')).toBe('true');
    act(() => width(1200));
    expect(screen.getByTestId('desktop-share-layout')).toBeTruthy();
    expect(screen.getByTestId('board-provider').getAttribute('data-mobile')).toBe('false');
  });

  it('never changes scheduled exports to mobile layout', () => {
    width(375);
    render(<DashboardForShare {...props} renderMode="schedule" />);
    expect(screen.getByTestId('desktop-share-layout')).toBeTruthy();
  });
});