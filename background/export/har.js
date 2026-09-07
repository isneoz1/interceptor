/* Export HAR 1.2 — INTERCEPTOR (by D4RK)
 * Format standard, relisible par Firefox DevTools, Charles, Fiddler, Postman...
 */
import { headerGet, parseContentType } from '../lib/util.js';

const VERSION = '1.0.0';

function toHeaders(list) {
  return (list || []).map(h => ({ name: h.name, value: String(h.value ?? '') }));
}

function queryOf(url) {
  try {
    const u = new URL(url);
    return [...u.searchParams.entries()].map(([name, value]) => ({ name, value }));
  } catch { return []; }
}

function cookiesOf(rec) {
  const raw = headerGet(rec.requestHeaders, 'cookie');
  if (!raw) return [];
  return String(raw).split(';').map(p => {
    const i = p.indexOf('=');
    return { name: p.slice(0, i).trim(), value: p.slice(i + 1).trim() };
  }).filter(c => c.name);
}

function postDataOf(rec) {
  if (!rec.requestBody) return undefined;
  const mime = rec.requestBody.contentType || 'application/octet-stream';
  const out = { mimeType: mime, text: rec.requestBody.text || '' };
  if (rec.requestBody.formData) {
    out.params = Object.entries(rec.requestBody.formData).flatMap(
      ([name, vals]) => vals.map(value => ({ name, value: String(value) }))
    );
  }
  if (rec.requestBody.base64) { out.encoding = 'base64'; out.text = rec.requestBody.base64; }
  return out;
}

function contentOf(rec) {
  const body = rec.responseBody;
  const { mime } = parseContentType(headerGet(rec.responseHeaders, 'content-type'));
  if (!body) return { size: rec.size || 0, mimeType: mime || '', text: '' };
  const content = {
    size: body.size || 0,
    compression: 0,
    mimeType: body.mime || mime || '',
    text: body.text || body.base64 || ''
  };
  if (body.base64) content.encoding = 'base64';
  if (body.truncated) content.comment = 'tronque par INTERCEPTOR';
  return content;
}

/** Chronologie approximee : webRequest n'expose pas le detail DNS/connect. */
function timingsOf(rec) {
  const perf = rec.perf && rec.perf.timings;
  if (perf) {
    return {
      blocked: num(perf.blocked), dns: num(perf.dns), connect: num(perf.connect),
      send: num(perf.send), wait: num(perf.wait), receive: num(perf.receive),
      ssl: num(perf.ssl)
    };
  }
  const total = rec.duration != null ? rec.duration : -1;
  const marks = Object.fromEntries(rec.timeline.map(t => [t.event, t.ts]));
  const sent = marks['request:sent'] || marks['request:start'] || rec.startTime;
  const received = marks['headers:received'] || marks['response:started'] || rec.endTime;
  const wait = sent && received ? Math.max(0, received - sent) : -1;
  const receive = received && rec.endTime ? Math.max(0, rec.endTime - received) : -1;
  return {
    blocked: -1, dns: -1, connect: -1, ssl: -1,
    send: 0,
    wait: wait >= 0 ? wait : (total >= 0 ? total : -1),
    receive: receive >= 0 ? receive : 0
  };
}
const num = v => (typeof v === 'number' && v >= 0 ? v : -1);

export function buildHar(records, meta = {}) {
  const entries = records.map(rec => {
    const timings = timingsOf(rec);
    const time = Object.values(timings).reduce((a, b) => a + (b > 0 ? b : 0), 0);
    return {
      pageref: 'page_' + (rec.tabId ?? -1),
      startedDateTime: new Date(rec.startTime || Date.now()).toISOString(),
      time: rec.duration != null ? rec.duration : time,
      request: {
        method: rec.method,
        url: rec.finalUrl || rec.url,
        httpVersion: (rec.perf && rec.perf.nextHopProtocol) || 'HTTP/1.1',
        cookies: cookiesOf(rec),
        headers: toHeaders(rec.requestHeaders),
        queryString: queryOf(rec.finalUrl || rec.url),
        postData: postDataOf(rec),
        headersSize: -1,
        bodySize: rec.requestBody ? rec.requestBody.size : 0
      },
      response: {
        status: rec.statusCode || 0,
        statusText: (rec.statusLine || '').replace(/^\S+\s+\d+\s*/, '') || '',
        httpVersion: (rec.perf && rec.perf.nextHopProtocol) || 'HTTP/1.1',
        cookies: rec.cookies.set.map(c => ({
          name: c.name, value: c.value, path: c.path || undefined,
          domain: c.domain || undefined, expires: c.expires || undefined,
          httpOnly: c.httpOnly, secure: c.secure
        })),
        headers: toHeaders(rec.responseHeaders),
        content: contentOf(rec),
        redirectURL: rec.redirects.length ? rec.redirects[rec.redirects.length - 1].to : '',
        headersSize: -1,
        bodySize: rec.size || 0,
        _transferSize: rec.perf ? rec.perf.transferSize : undefined
      },
      cache: rec.fromCache ? { afterRequest: {} } : {},
      timings,
      serverIPAddress: rec.ip || undefined,
      connection: rec.requestId ? String(rec.requestId) : undefined,
      comment: rec.error || undefined,
      // Extensions proprietaires : prefixe _ conforme a la specification HAR.
      _interceptor: {
        id: rec.id,
        sources: rec.sources,
        type: rec.type,
        tabId: rec.tabId,
        frameId: rec.frameId,
        thirdParty: rec.thirdParty,
        fromCache: rec.fromCache,
        networkless: !!rec.networkless,
        urlClassification: rec.urlClassification || null,
        frameAncestors: rec.frameAncestors || null,
        transferSize: rec.perf ? rec.perf.transferSize : null,
        wireRequestSize: rec.wireRequestSize || 0,
        wireResponseSize: rec.wireResponseSize || 0,
        imported: !!rec.imported,
        dns: rec.dns || null,
        security: rec.security || null,
        proxy: rec.proxy || null,
        auth: rec.auth || null,
        redirects: rec.redirects,
        stack: rec.stack || null,
        analysis: rec.analysis || null,
        websocket: rec.ws || null,
        sse: rec.sse || null,
        cookiesChanged: rec.cookies.changed,
        timeline: rec.timeline,
        dedup: rec.dedup,
        rulesApplied: rec.rulesApplied
      }
    };
  });

  const pages = [...new Set(records.map(r => r.tabId))].map(tabId => ({
    startedDateTime: new Date(meta.startedAt || Date.now()).toISOString(),
    id: 'page_' + tabId,
    title: 'tab ' + tabId,
    pageTimings: { onContentLoad: -1, onLoad: -1 }
  }));

  return {
    log: {
      version: '1.2',
      creator: { name: 'INTERCEPTOR', version: VERSION, comment: 'cree par D4RK' },
      browser: { name: 'Firefox', version: meta.browserVersion || 'unknown' },
      pages,
      entries,
      comment: 'Export INTERCEPTOR — ' + entries.length + ' requetes, sans doublon.'
    }
  };
}
