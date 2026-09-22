/* Astra design endpoint bridge.
 *
 * The production Astra function was created in a deployment that was newer
 * than the connected GitHub snapshot. Keep the proven function online while
 * the recovered source is brought back under version control. The fixed
 * deployment URL is immutable, so promoting a new deployment cannot create a
 * proxy loop. If that deployment is ever unreachable, the recovered legacy
 * image generator remains available as a graceful fallback.
 */
const legacyDesign = require('./design-legacy');

const ASTRA_ORIGIN = 'https://handsofgoldny-ni1tdlenc-hands-of-gold.vercel.app';

function requestBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return undefined;
  if (Buffer.isBuffer(req.body) || typeof req.body === 'string') return req.body;
  if (req.body == null) return undefined;
  return JSON.stringify(req.body);
}

module.exports = async function handler(req, res) {
  const query = req.url && req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const headers = {
    accept: req.headers.accept || 'application/json',
    'content-type': req.headers['content-type'] || 'application/json'
  };
  if (req.headers['x-forwarded-for']) headers['x-forwarded-for'] = req.headers['x-forwarded-for'];

  try {
    const upstream = await fetch(ASTRA_ORIGIN + '/api/design' + query, {
      method: req.method,
      headers,
      body: requestBody(req),
      redirect: 'manual'
    });
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    const cacheControl = upstream.headers.get('cache-control');
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', contentType);
    if (cacheControl) res.setHeader('Cache-Control', cacheControl);
    res.setHeader('X-HOG-Astra-Bridge', 'active');

    const data = Buffer.from(await upstream.arrayBuffer());
    return res.end(data);
  } catch (error) {
    console.error('[hog-astra-bridge]', error && error.message ? error.message : error);
    return legacyDesign(req, res);
  }
};
