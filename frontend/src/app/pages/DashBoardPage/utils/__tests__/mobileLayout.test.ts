import {
  compactMobileLayout,
  findVisibleMobilePresentation,
  getInitiallyVisibleWidgetIds,
  getMobileGridSpan,
  getNestedWidgetIds,
  markMobileTableLayoutReady,
  prepareMobileTableLayout,
} from '../mobileLayout';
import { Widget } from '../../types/widgetTypes';

const makeMeasurable = (element: HTMLElement, height: number) => {
  Object.defineProperty(element, 'scrollHeight', {
    configurable: true,
    value: height,
  });
  element.getClientRects = () => {
    const rect = {} as DOMRect;
    return {
      0: rect,
      length: 1,
      item: () => rect,
      *[Symbol.iterator]() {
        yield rect;
      },
    } as DOMRectList;
  };
  element.getBoundingClientRect = () => ({ width: 300, height } as DOMRect);
};

describe('findVisibleMobilePresentation', () => {
  it('ignores a rendered but inactive tab and measures the active tab', () => {
    const root = document.createElement('div');
    root.innerHTML = `
      <div class="ant-tabs-tabpane">
        <div id="inactive" class="mobile-table-presentation"></div>
      </div>
      <div class="ant-tabs-tabpane ant-tabs-tabpane-active">
        <div id="active" class="mobile-table-presentation"></div>
      </div>
    `;
    const inactive = root.querySelector<HTMLElement>('#inactive')!;
    const active = root.querySelector<HTMLElement>('#active')!;
    makeMeasurable(inactive, 500);
    makeMeasurable(active, 120);

    expect(findVisibleMobilePresentation(root)).toBe(active);
  });

  it('supports a presentation that is not wrapped in tabs', () => {
    const root = document.createElement('div');
    const presentation = document.createElement('div');
    presentation.className = 'mobile-table-presentation';
    makeMeasurable(presentation, 72);
    root.appendChild(presentation);

    expect(findVisibleMobilePresentation(root)).toBe(presentation);
  });
});

describe('getInitiallyVisibleWidgetIds', () => {
  it('loads the first tab tree and leaves inactive tabs for first click', () => {
    const makeWidget = (
      id: string,
      parentId = '',
      content?: Record<string, unknown>,
    ) =>
      ({
        id,
        parentId,
        config: { children: [], content },
      } as unknown as Widget);
    const tab = makeWidget('tab', '', {
      itemMap: {
        second: { index: 2, childWidgetId: 'second' },
        first: { index: 1, childWidgetId: 'first' },
      },
    });
    const widgetMap = {
      tab,
      first: makeWidget('first', 'tab'),
      firstChild: makeWidget('firstChild', 'first'),
      second: makeWidget('second', 'tab'),
    };

    expect(getInitiallyVisibleWidgetIds(tab, widgetMap)).toEqual([
      'tab',
      'first',
      'firstChild',
    ]);
    expect(getNestedWidgetIds(tab, widgetMap)).toEqual([
      'tab',
      'first',
      'firstChild',
      'second',
    ]);
  });
});

describe('mobile table readiness', () => {
  it('hides a newly selected table until its measured layout is ready', () => {
    const root = document.createElement('div');
    markMobileTableLayoutReady(root, 'first-tab');

    expect(prepareMobileTableLayout(root, 'second-tab')).toBe(false);
    expect(root.classList.contains('mobile-table-layout-ready')).toBe(false);

    markMobileTableLayoutReady(root, 'second-tab');
    expect(prepareMobileTableLayout(root, 'second-tab')).toBe(true);
  });
});

describe('getMobileGridSpan', () => {
  it('allocates enough pixels for five complete table rows', () => {
    const requiredHeight = 32 + 54 + 5 * 54 + 8 + 54;
    const span = getMobileGridSpan(requiredHeight, 24, 2, 6, 2);
    const allocatedHeight = span * 24 + (span - 1) * 2;

    expect(allocatedHeight).toBeGreaterThanOrEqual(requiredHeight + 2);
  });

  it('keeps the minimum card height for a short result', () => {
    expect(getMobileGridSpan(80, 24, 2, 6, 2)).toBe(6);
  });
});

describe('compactMobileLayout', () => {
  it('shrinks a measured card and moves later rows up by the saved space', () => {
    const result = compactMobileLayout(
      [
        { id: 'table', rect: { x: 0, y: 0, width: 24, height: 16 } },
        { id: 'next', rect: { x: 0, y: 18, width: 24, height: 8 } },
      ],
      { table: 8 },
    );

    expect(result[0].rect.height).toBe(8);
    expect(result[1].rect.y).toBe(10);
  });

  it('grows a measured card and moves later rows down to avoid clipping it', () => {
    const result = compactMobileLayout(
      [
        { id: 'table', rect: { x: 0, y: 0, width: 24, height: 8 } },
        { id: 'next', rect: { x: 0, y: 10, width: 24, height: 8 } },
      ],
      { table: 16 },
    );

    expect(result[0].rect.height).toBe(16);
    expect(result[1].rect.y).toBe(18);
  });
});
