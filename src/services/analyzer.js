const axios = require('axios');
const { URL } = require('url');
const { validateDestination } = require('./security');

const MAX_REDIRECTS = parseInt(process.env.MAX_REDIRECTS || '10', 10);
const TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS || '10000', 10);
const MAX_BODY = parseInt(process.env.MAX_RESPONSE_SIZE || '51200', 10);

const SHORTENER_DOMAINS = new Set([
  'bit.ly', 'tinyurl.com', 't.co', 'goo.gl', 'ow.ly', 'is.gd', 'buff.ly',
  'adf.ly', 'shorte.st', 'tiny.cc', 'short.io', 'rebrand.ly', 'cutt.ly'
]);

const GOOGLE_SHARE_PATTERNS = [
  /google\.com\/url/i,
  /google\.com\/search/i,
  /accounts\.google\.com/i
];

function isShortener(hostname) {
  return SHORTENER_DOMAINS.has(hostname.toLowerCase());
}

function isGoogleShare(url) {
  return GOOGLE_SHARE_PATTERNS.some(p => p.test(url));
}

function extractMetaRefresh(html) {
  if (!html) return null;
  const match = html.match(/<meta[^>]*http-equiv=["']refresh["'][^>]*content=["'][^;]*;\s*url=([^"']+)["']/i);
  return match ? match[1].trim() : null;
}

function extractJsRedirects(html) {
  if (!html) return [];
  const indicators = [];
  const patterns = [
    /window\.location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /location\.href\s*=\s*["']([^"']+)["']/gi,
    /location\.replace\s*\(\s*["']([^"']+)["']/gi,
    /document\.location\s*=\s*["']([^"']+)["']/gi
  ];
  for (const re of patterns) {
    let m;
    while ((m = re.exec(html)) !== null) {
      indicators.push(m[1]);
    }
  }
  return [...new Set(indicators)];
}

async function followRedirects(startUrl) {
  const chain = [];
  const seen = new Set();
  let current = startUrl;
  let hop = 0;
  const startTime = Date.now();

  while (hop < MAX_REDIRECTS) {
    if (Date.now() - startTime > TIMEOUT) {
      throw new Error('Overall timeout exceeded');
    }

    const normalized = current.toLowerCase().replace(/\/$/, '');
    if (seen.has(normalized)) {
      chain.push({
        hop,
        url: current,
        status: null,
        type: 'loop_detected',
        error: 'Redirect loop detected'
      });
      break;
    }
    seen.add(normalized);

    let validated;
    try {
      validated = await validateDestination(current);
    } catch (err) {
      chain.push({
        hop,
        url: current,
        status: null,
        type: 'blocked',
        error: err.message
      });
      break;
    }

    const step = {
      hop,
      url: current,
      resolvedIp: validated.ip,
      status: null,
      location: null,
      type: 'request',
      metaRefresh: null,
      jsIndicators: [],
      isShortener: isShortener(validated.url.hostname),
      isGoogleShare: isGoogleShare(current),
      domainChanged: false,
      error: null
    };

    if (chain.length > 0) {
      try {
        const prevHost = new URL(chain[chain.length - 1].url).hostname;
        step.domainChanged = prevHost !== validated.url.hostname;
      } catch {}
    }

    try {
      const response = await axios.get(current, {
        maxRedirects: 0,
        timeout: TIMEOUT,
        maxContentLength: MAX_BODY,
        maxBodyLength: MAX_BODY,
        validateStatus: () => true,
        headers: {
          'User-Agent': 'RedirectChainAnalyzer/1.0',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        },
        responseType: 'text'
      });

      step.status = response.status;
      step.headers = {
        'content-type': response.headers['content-type'],
        'content-length': response.headers['content-length']
      };

      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(response.status) && location) {
        step.type = 'http_redirect';
        step.location = location;
        try {
          current = new URL(location, current).href;
        } catch {
          step.error = 'Invalid Location header';
          chain.push(step);
          break;
        }
        chain.push(step);
        hop++;
        continue;
      }

      const body = typeof response.data === 'string' ? response.data.slice(0, MAX_BODY) : '';
      step.metaRefresh = extractMetaRefresh(body);
      step.jsIndicators = extractJsRedirects(body);

      if (step.metaRefresh) {
        step.type = 'meta_refresh_detected';
        try {
          current = new URL(step.metaRefresh, current).href;
          chain.push(step);
          hop++;
          continue;
        } catch {
          step.error = 'Invalid meta refresh URL';
        }
      }

      if (step.jsIndicators.length > 0) {
        step.type = step.type === 'request' ? 'js_indicator_detected' : step.type;
        step.note = 'JavaScript redirects detected via static inspection only — not executed';
      }

      chain.push(step);
      break;
    } catch (err) {
      step.error = err.code === 'ECONNABORTED' ? 'Request timeout' : (err.message || 'Request failed');
      step.type = 'error';
      chain.push(step);
      break;
    }
  }

  if (hop >= MAX_REDIRECTS && chain.length > 0 && !chain[chain.length - 1].error) {
    chain[chain.length - 1].warning = `Maximum redirect limit (${MAX_REDIRECTS}) reached`;
  }

  const final = chain.length ? chain[chain.length - 1] : null;
  return {
    originalUrl: startUrl,
    finalUrl: final && !final.error && final.type !== 'loop_detected' && final.type !== 'blocked' ? final.url : null,
    chain,
    totalHops: chain.length,
    hasLoop: chain.some(s => s.type === 'loop_detected'),
    hasExternal: chain.some(s => s.domainChanged),
    warnings: chain.filter(s => s.warning || s.error || s.jsIndicators?.length).map(s => ({
      hop: s.hop,
      message: s.warning || s.error || (s.jsIndicators?.length ? 'JS redirect indicators found (static only)' : null)
    })).filter(w => w.message)
  };
}

module.exports = { followRedirects, extractMetaRefresh, extractJsRedirects };
