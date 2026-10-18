/** Inspect production HTTP cache behavior, never mutate the deployment. */
const base = process.env.DATART_TEST_BASE_URL;
if (!base) {
  console.error('Set DATART_TEST_BASE_URL to the authorized deployment.');
  process.exitCode = 2;
} else {
  try {
    const htmlResponse = await fetch(new URL('/login', base), { cache: 'no-store' });
    if (!htmlResponse.ok) throw new Error('Login HTML did not respond HTTP 200');
    const htmlCache = htmlResponse.headers.get('cache-control') || '';
    if (!/no-cache|no-store|max-age=0/i.test(htmlCache)) {
      throw new Error('Login HTML may be cached across deployments: ' + htmlCache);
    }
    const html = await htmlResponse.text();
    const urls = [...html.matchAll(/\/static\/(?:js|css)\/[a-zA-Z0-9_-]+\.[a-f0-9]{8,}\.(?:js|css)/g)]
      .map(match => match[0]);
    if (!urls.some(url => url.endsWith('.js'))) {
      throw new Error('No content-hashed JS entry found');
    }
    for (const assetPath of [...new Set(urls)]) {
      const response = await fetch(new URL(assetPath, base), { method: 'HEAD' });
      if (!response.ok) throw new Error('Static asset missing: ' + response.status);
      const cache = response.headers.get('cache-control') || '';
      if (!/max-age=31536000/.test(cache) || !/immutable/.test(cache)) {
        throw new Error('Missing immutable cache policy: ' + cache);
      }
      console.log('IMMUTABLE_ASSET ' + assetPath.split('/').pop() + ' ' + cache);
    }
    console.log('ENTRY_HTML ' + htmlCache);
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}