import { createHash } from 'node:crypto';
import { expect, type Page, type TestInfo } from '@playwright/test';

export async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  })).then(size => Math.max(size.document, size.body) - size.viewport), {
    message: 'Horizontal scrolling must stay inside data tables, not the document',
  }).toBeLessThanOrEqual(2);
}

export async function captureDatasetScreenshot(page: Page, testInfo: TestInfo, name: string) {
  await page.evaluate(async () => {
    await document.fonts.ready;
    await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));
  });
  const png = await page.screenshot({
    path: testInfo.outputPath(`${name}.png`), fullPage: false,
    animations: 'disabled', caret: 'hide',
  });
  await testInfo.attach(name, { body: png, contentType: 'image/png' });

  // Dedicated synthetic-only CI jobs may opt in so screenshot bytes can also
  // be recovered from job logs when downloading an artifact is unavailable.
  if (process.env.DATART_UI_SCREENSHOTS_BASE64 === '1') {
    const id = `${testInfo.testId}-${name}`;
    const encoded = png.toString('base64');
    const chunkSize = 8_000;
    const count = Math.ceil(encoded.length / chunkSize);
    console.log('DATASET_UI_SCREENSHOT_BEGIN ' + JSON.stringify({
      id, name, bytes: png.length, chunks: count,
      sha256: createHash('sha256').update(png).digest('hex'),
      width: png.readUInt32BE(16), height: png.readUInt32BE(20),
    }));
    for (let index = 0; index < count; index++) {
      console.log(`DATASET_UI_SCREENSHOT_CHUNK ${id} ${index + 1}/${count} ${encoded.slice(index * chunkSize, (index + 1) * chunkSize)}`);
    }
    console.log(`DATASET_UI_SCREENSHOT_END ${id}`);
  }
}
