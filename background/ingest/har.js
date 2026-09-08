/* Import d un fichier HAR — INTERCEPTOR (by NeoZ)
 *
 * Permet de relire une capture faite ailleurs (DevTools, Charles, Fiddler…)
 * dans la meme interface. Les fichiers exportes par INTERCEPTOR contiennent
 * l extension `_interceptor` : ils sont alors restaures a l identique, couches
 * de capture, TLS, analyse, trames WebSocket et chronologie comprises.
 *
 * Les lignes importees sont marquees `imported` et portent la couche `import` :
 * elles ne peuvent jamais etre confondues avec une capture en direct.
 */
import { store } from '../core/store.js';
import { analyze } from '../core/analyzer.js';
import { hostOf, pathOf, schemeOf } from '../lib/util.js';

function headerList(list) {
  return (list || []).map(h => ({ name: String(h.name || ''), value: String(h.value ?? '') }));
}

function bodyFromPostData(post) {
  if (!post) return null;
  const text = post.text || '';
  const formData = {};
  for (const p of post.params || []) {
    const key = String(p.name || '');
    if (!key) continue;
    (formData[key] = formData[key] || []).push(String(p.value ?? ''));
  }
  return {
    kind: post.params && post.params.length ? 'formData' : 'raw',
    text,
    size: text.length,
    truncated: false,
    contentType: post.mimeType || '',
    formData: post.params && post.params.length ? formData : undefined
  };
}

function bodyFromContent(content) {
  if (!content) return null;
  const text = content.encoding === 'base64' ? '' : (content.text || '');
  return {
    kind: content.encoding === 'base64' ? 'binary' : 'text',
    text,
    base64: content.encoding === 'base64' ? (content.text || null) : null,
    preview: null,
    size: content.size || text.length,
    stored: text.length,
    truncated: /tronque/i.test(content.comment || ''),
    mime: content.mimeType || '',
    charset: '',
    contentEncoding: '',
    decompressed: false,
    source: 'har'
  };
}

/**
 * @param {object} har  contenu JSON d un fichier HAR 1.2
 * @returns {{ imported:number, skipped:number, errors:string[] }}
 */
export function importHar(har) {
  const log = har && har.log;
  if (!log || !Array.isArray(log.entries)) {
    return { error: 'fichier HAR invalide : la cle log.entries est absente' };
  }

  let imported = 0;
  let skipped = 0;
  const errors = [];

  for (const entry of log.entries) {
    try {
      const req = entry.request || {};
      const res = entry.response || {};
      const url = req.url || '';
      if (!url) { skipped++; continue; }

      const extra = entry._interceptor || {};
      const started = Date.parse(entry.startedDateTime || '') || Date.now();
      const duration = typeof entry.time === 'number' && entry.time >= 0 ? Math.round(entry.time) : null;

      const rec = store.create({
        requestId: null,
        sources: ['import', ...(extra.sources || [])].filter((v, i, a) => a.indexOf(v) === i),
        url,
        finalUrl: url,
        method: String(req.method || 'GET').toUpperCase(),
        type: extra.type || 'other',
        tabId: extra.tabId != null ? extra.tabId : -1,
        frameId: extra.frameId != null ? extra.frameId : -1,
        thirdParty: !!extra.thirdParty,
        startTime: started,
        imported: true
      });

      rec.scheme = schemeOf(url);
      rec.host = hostOf(url);
      rec.path = pathOf(url);
      rec.requestHeaders = headerList(req.headers);
      rec.requestBody = bodyFromPostData(req.postData);
      rec.statusCode = res.status || null;
      rec.statusLine = res.statusText ? (res.httpVersion || 'HTTP/1.1') + ' ' + res.status + ' ' + res.statusText : null;
      rec.responseHeaders = headerList(res.headers);
      rec.responseBody = bodyFromContent(res.content);
      rec.mime = (res.content && res.content.mimeType) || '';
      rec.size = (res.content && res.content.size) || 0;
      rec.ip = entry.serverIPAddress || null;
      rec.duration = duration;
      rec.endTime = started + (duration || 0);
      rec.fromCache = !!extra.fromCache;
      rec.networkless = !!extra.networkless;

      if (entry.timings) {
        rec.perf = {
          initiatorType: null,
          nextHopProtocol: res.httpVersion || null,
          transferSize: extra.transferSize ?? null,
          encodedBodySize: null, decodedBodySize: null,
          duration, startTime: null, redirectCount: (extra.redirects || []).length,
          renderBlockingStatus: null, deliveryType: null, serverTiming: null,
          timings: entry.timings, workerStart: null
        };
      }

      // Extensions INTERCEPTOR : restauration fidele de nos propres exports.
      rec.dns = extra.dns || null;
      rec.security = extra.security || null;
      rec.proxy = extra.proxy || null;
      rec.auth = extra.auth || null;
      rec.redirects = extra.redirects || [];
      rec.stack = extra.stack || null;
      rec.ws = extra.websocket || null;
      rec.sse = extra.sse || null;
      rec.rulesApplied = extra.rulesApplied || [];
      rec.urlClassification = extra.urlClassification || null;
      rec.frameAncestors = extra.frameAncestors || null;
      if (extra.cookiesChanged) rec.cookies.changed = extra.cookiesChanged;
      for (const c of res.cookies || []) {
        rec.cookies.set.push({
          raw: c.name + '=' + (c.value ?? ''), name: c.name, value: c.value ?? '',
          domain: c.domain || null, path: c.path || null, expires: c.expires || null,
          maxAge: null, secure: !!c.secure, httpOnly: !!c.httpOnly, sameSite: c.sameSite || null
        });
      }
      for (const t of extra.timeline || []) store.mark(rec, t.event, t.ts, t.detail);

      store.mark(rec, 'import:har', started, { fichier: log.creator ? log.creator.name : 'inconnu' });
      rec.state = res.status ? 'complete' : 'error';
      analyze(rec, { force: true });
      imported++;
    } catch (e) {
      errors.push(String(e && e.message || e));
      skipped++;
    }
  }

  return { imported, skipped, errors: errors.slice(0, 10), creator: log.creator || null };
}
