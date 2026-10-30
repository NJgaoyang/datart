import { createHash } from 'node:crypto';
import { expect, type Locator, type Page, type TestInfo } from '@playwright/test';

export async function expectNoPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  })).then(size => Math.max(size.document, size.body) - size.viewport), {
    message: 'Horizontal scrolling must stay inside data tables, not the document',
  }).toBeLessThanOrEqual(2);
}

export async function expectReadableThemeText(label: Locator) {
  await expect(label).toBeVisible();
  const colors = await label.evaluate(element => {
    type Color = [number, number, number, number];
    const parse = (value: string): Color => {
      const parts = value.match(/[\d.]+/g)?.map(Number);
      if (!parts || parts.length < 3) throw new Error(`Unsupported computed color: ${value}`);
      const scale = value.startsWith('color(srgb ') ? 255 : 1;
      return [parts[0] * scale, parts[1] * scale, parts[2] * scale, parts[3] ?? 1];
    };
    const composite = (foreground: Color, background: Color): Color => [
      foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
      foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
      foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
      1,
    ];
    const luminance = (color: Color) => {
      const linear = color.slice(0, 3).map(channel => {
        const value = channel / 255;
        return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
      });
      return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
    };
    // Headings are usually transparent. Resolve the actual enclosing panel
    // background, including translucent layers, instead of assuming white.
    const layers: Color[] = [];
    for (let current: Element | null = element; current; current = current.parentElement) {
      const background = parse(getComputedStyle(current).backgroundColor);
      layers.push(background);
      if (background[3] === 1) break;
    }
    const background = layers.reverse().reduce(
      (underneath, layer) => composite(layer, underneath),
      [255, 255, 255, 1] as Color,
    );
    const foreground = composite(parse(getComputedStyle(element).color), background);
    const light = Math.max(luminance(foreground), luminance(background));
    const dark = Math.min(luminance(foreground), luminance(background));
    return {
      text: element.textContent?.trim(), foreground, background,
      contrast: (light + 0.05) / (dark + 0.05),
    };
  });
  expect(colors.contrast, `Heading must be readable on its rendered panel: ${JSON.stringify(colors)}`)
    .toBeGreaterThanOrEqual(4.5);
}

export async function expectShortLabelUnclipped(label: Locator, text: string) {
  await expect(label).toHaveText(text);
  await expect(label).toBeVisible();
  await expect.poll(() => label.evaluate(element => ({
    client: element.clientWidth,
    scroll: element.scrollWidth,
  })).then(size => size.client > 0 && size.client >= size.scroll), {
    message: `The short header “${text}” must fit beside its field actions without ellipsis`,
  }).toBe(true);
}

export async function captureDatasetScreenshot(page: Page, testInfo: TestInfo, name: string) {
  const viewport = page.viewportSize() || await page.evaluate(() => ({
    width: innerWidth, height: innerHeight,
  }));
  // Leave hover targets as a user would. Never hide tooltip DOM/CSS to make a
  // screenshot look correct; wait for the application's close animation.
  await page.mouse.move(viewport.width - 1, viewport.height - 1);
  await expect(page.locator('[role="tooltip"]:visible')).toHaveCount(0, { timeout: 5_000 });
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
