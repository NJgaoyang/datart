/**
 * Measure actual compressed wire bytes (works for Tomcat chunked responses
 * without Content-Length). DATART_TEST_BASE_URL required.
 * Read-only check: never logs auth tokens, cookies or business data.
 */
import { gunzipSync } from 'node:zlib';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const requestRaw = url => new Promise((resolve, reject) => {
  const parsed = new URL(url);
  const transport = parsed.protocol === 'https:' ? httpsRequest : httpRequest;
  const req = transport(parsed, { headers: { 'Accept-Encoding': 'gzip' } }, response => {
    const chunks = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () => resolve({
      status: response.statusCode,
      headers: response.headers,
      body: Buffer.concat(chunks),
    }));
    response.on('error', reject);
  });
  req.on('error', reject);
  req.end();
});

const base = process.env.DATART_TEST_BASE_URL;
if (!base) {
  console.error('Set DATART_TEST_BASE_URL to the authorized deployment.');
  process.exitCode = 2;
} else {
  try {
    const entry = await fetch(new URL('/login', base));
    if (!entry.ok) throw new Error('Login entry HTTP ' + entry.status);
    const html = await entry.text();
    const match = html.match(/\/static\/js\/app\.[a-zA-Z0-9]+\.js/);
    if (!match) throw new Error('Versioned app entry not found');
    const wire = await requestRaw(new URL(match[0], base));
    const type = wire.headers['content-type'] || '';
    const encoding = wire.headers['content-encoding'] || '';
    if (wire.status !== 200) throw new Error('JS HTTP ' + wire.status);
    if (!type.includes('javascript')) throw new Error('Unexpected JS content type');
    if (encoding !== 'gzip') throw new Error('JS is not compressed with gzip');
    const rawSize = gunzipSync(wire.body).byteLength;
    const compressedBytes = wire.body.byteLength;
    const transferRatio = compressedBytes / rawSize;
    console.log(JSON.stringify({
      status: wire.status, mime: type, contentEncoding: encoding,
      compressedBytes, uncompressedBytes: rawSize,
      transferRatio: Number(transferRatio.toFixed(3)),
      bundleFile: match[0].split('/').pop(),
    }, null, 2));
    if (!(compressedBytes > 0 && transferRatio < 0.8)) {
      throw new Error('JavaScript compression ratio is not effective');
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}