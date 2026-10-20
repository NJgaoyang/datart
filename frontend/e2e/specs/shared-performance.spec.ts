import { test, expect, type Request } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Real read-only measurement on an authorized shared dashboard. It never
// invents 100/500/1000 widgets or sends synthetic SQL to an unknown source.
// Output intentionally omits business values, share URL, headers, tokens.
const share = process.env.DATART_TEST_SHARED_DASHBOARD_PATH;
test.describe('real shared dashboard browser load baseline', () => {
  test.skip(!share, 'Set authorized DATART_TEST_SHARED_DASHBOARD_PATH');

  for (const width of [375, 1200]) {
    test('records real network and render timing at ' + width + ' CSS px', async ({ page }) => {
      await page.setViewportSize({ width, height: 820 });
      const queries: Array<{ ms: number; code: number }> = [];
      let failedApi = 0;
      const startedAt = new Map<Request, number>();
      page.on('request', request => startedAt.set(request, Date.now()));
      page.on('requestfinished', request => {
        const url = new URL(request.url());
        if (/\/api\/v1\//.test(url.pathname) &&
            /(execute|data-provider|shares)/.test(url.pathname)) {
          const elapsed = Math.max(1, Date.now() - (startedAt.get(request) ?? Date.now()));
          const response = request.response();
          void response.then(res => {
            if (res) queries.push({ ms: elapsed, code: res.status() });
          });
        }
      });
      page.on('response', response => {
        if (/\/api\/v1\//.test(new URL(response.url()).pathname) && response.status() >= 400) {
          failedApi++;
        }
      });
      const began = Date.now();
      await page.goto(share!, { waitUntil: 'domcontentloaded' });
      if (width <= 960) {
        await expect(page.locator('.datart-mobile-share .mobile-widget').first()).toBeVisible();
      } else {
        await expect(page.locator('.react-grid-layout').first()).toBeVisible();
      }
      await page.waitForTimeout(2200);
      const measured = await page.evaluate(async () => {
        const paint = performance.getEntriesByType('paint') as PerformanceEntry[];
        const nav = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
        let frames = 0;
        const started = performance.now();
        await new Promise<void>(resolve => {
          const frame = () => {
            frames++;
            if (performance.now() - started >= 1000) resolve();
            else requestAnimationFrame(frame);
          };
          requestAnimationFrame(frame);
        });
        return {
          firstContentfulPaintMs: Math.round(paint.find(entry => entry.name === 'first-contentful-paint')?.startTime ?? 0),
          domContentLoadedMs: Math.round(nav?.domContentLoadedEventEnd ?? 0),
          loadEventEndMs: Math.round(nav?.loadEventEnd ?? 0),
          sampledAnimationFps: Number((frames / ((performance.now() - started) / 1000)).toFixed(1)),
          jsHeapUsedBytes: (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize ?? null,
          domNodes: document.querySelectorAll('*').length,
          renderedWidgets: document.querySelectorAll('.mobile-widget, .react-grid-item').length,
          horizontalOverflowPx: Math.max(0, document.documentElement.scrollWidth - document.documentElement.clientWidth),
        };
      });
      const durations = queries.map(q => q.ms).sort((a, b) => a - b);
      const report = {
        kind: 'real read-only browser baseline',
        width,
        wallMs: Date.now() - began,
        ...measured,
        queryHttpCount: durations.length,
        queryMsMedian: durations.length ? durations[Math.floor(durations.length / 2)] : null,
        queryMsP95: durations.length ? durations[Math.min(durations.length - 1, Math.ceil(durations.length * 0.95) - 1)] : null,
        queryErrors: queries.filter(q => q.code >= 400).length,
        failedApi,
        // This count is observed. No extrapolation to 100/500/1000 dashboards.
        benchmarkedWidgetCount: measured.renderedWidgets,
      };
      await writeFile(test.info().outputPath('baseline-' + width + '.json'), JSON.stringify(report, null, 2));
      console.log('DASHBOARD_PERF_BASELINE ' + JSON.stringify(report));
      expect(measured.renderedWidgets).toBeGreaterThan(0);
      expect(failedApi).toBe(0);
    });
  }
});