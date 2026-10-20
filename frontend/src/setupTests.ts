import '@testing-library/jest-dom';
import 'locales/i18n';
import './__tests__/helper.chart';
import './__tests__/MockMatchMedia';

/**
 * Ant Design 6 uses ResizeObserver from its rc-component packages.
 * JSDOM does not implement the browser API. Provide an inert measurement
 * observer for unit tests; real browser ResizeObserver is never replaced.
 */
if (typeof globalThis.ResizeObserver === 'undefined') {
  class TestResizeObserver implements ResizeObserver {
    observe(_target: Element): void {}
    unobserve(_target: Element): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = TestResizeObserver;
}
