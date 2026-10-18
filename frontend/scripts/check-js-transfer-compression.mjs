/**
 * Real HTTP transfer check. Run only against a running Datart instance:
 * DATART_TEST_BASE_URL=http://127.0.0.1:8080 npm run check:js-compression
 * Does not modify data, log credentials or assume a specific bundle hash.
 */
const base = process.env.DATART_TEST_BASE_URL;
if (!base) {
  console.error('Set DATART_TEST_BASE_URL to the authorized deployment.');
  process.exitCode = 2;
} else {
  try {
    const html = await fetch(new URL('/login', base)).then(async response => {
      if (!response.ok) throw new Error(`login entry HTTP ${response.status}`);
      return response.text();
    });
    const match = html.match(/\/static\/js\/app\.[a-zA-Z0-9]+\.js/);
    if (!match) throw new Error('Could not find the versioned app script in /login');
    const url = new URL(match[0], base);
    const response = await fetch(url, { headers: { 'Accept-Encoding': 'gzip' } });
    if (!response.ok) throw new Error(`JS HTTP ${response.status}`);
    const type = response.headers.get('content-type') || '';
    const encoding = response.headers.get('content-encoding') || '';
    // node fetch transparently decompresses; measure transfer size from
    // Content-Length, not from decoded response bytes.
    const networkLength = Number(response.headers.get('content-length') || '0');
    const decoded = await response.arrayBuffer();
    const rawSize = decoded.byteLength;
    console.log(JSON.stringify({
      status: response.status,
      mime: type,
      contentEncoding: encoding,
      compressedBytes: networkLength || null,
      uncompressedBytes: rawSize,
      transferRatio: networkLength ? Number((networkLength / rawSize).toFixed(3)) : null,
      bundleFile: match[0].split('/').pop(),
    }, null, 2));
    if (!type.includes('javascript')) throw new Error('Unexpected JS content type');
    if (encoding !== 'gzip') throw new Error('JS gzip not enabled on the running service');
    if (!(networkLength > 0 && networkLength < rawSize * 0.8)) {
      throw new Error('Missing Content-Length or ineffective JS compression');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}