/* Ingestion des observations du contexte page — INTERCEPTOR (by NeoZ)
 *
 * Cette couche voit ce que webRequest ne peut PAS voir :
 *   - trames WebSocket (webRequest ne voit que la poignee de main)
 *   - messages Server-Sent Events
 *   - piles d'appel JavaScript a l'origine de chaque requete
 *   - requetes servies par un Service Worker / cache memoire sans aller au reseau
 *   - navigator.sendBeacon, Worker, SharedWorker, WebRTC
 *   - PerformanceResourceTiming (chronometrage precis, protocole, tailles reelles)
 *
 * Tout passe par le correlateur : une observation rejoint la requete existante,
 * ou devient sa propre ligne si elle n'a aucun equivalent reseau. Jamais de doublon.
 */
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { correlator, signatureOf } from '../core/dedup.js';
import { normalizePageBody } from '../capture/bodies.js';
import { analyze } from '../core/analyzer.js';
import { truncateText } from '../lib/util.js';

export const pageStats = { events: 0, merged: 0, promoted: 0, frames: 0 };

/** cle "tab:frame:pid" -> id d'enregistrement, une fois la correlation resolue */
const pidToRecord = new Map();
/** evenements de fin arrives avant la resolution de leur debut */
const orphanEnds = new Map();

function cap(limit) { return (!limit || limit <= 0) ? Infinity : limit; }
const keyOf = (ctx, pid) => ctx.tabId + ':' + ctx.frameId + ':' + pid;

/* ------------------------------------------------------------------ */
/* Point d'entree : un lot d'evenements venant d'un content script      */
/* ------------------------------------------------------------------ */
export function ingestBatch(batch, sender) {
  if (!config.get('capturing') || !config.get('capturePageHooks')) return { ok: false, reason: 'paused' };
  const ctx = {
    tabId: sender.tab ? sender.tab.id : -1,
    frameId: sender.frameId != null ? sender.frameId : -1,
    frameUrl: sender.url || null,
    incognito: sender.tab ? !!sender.tab.incognito : false,
    cookieStoreId: sender.tab ? (sender.tab.cookieStoreId || null) : null
  };
  let handled = 0;
  for (const ev of batch) {
    try { dispatch(ev, ctx); handled++; pageStats.events++; }
    catch (e) { console.error('[INTERCEPTOR] ingest', ev && ev.t, e); }
  }
  return { ok: true, handled };
}

/** Ecarte les evenements dont la couche est desactivee dans les reglages. */
function allowed(ev) {
  if (/^sse:/.test(ev.t) && !config.get('captureSse')) return false;
  if (ev.t === 'ctx') {
    const kind = String(ev.kind || '');
    if (kind.startsWith('rtc:') && !config.get('captureWebRtc')) return false;
    if (/^(worker|sharedworker|serviceWorker)/.test(kind) && !config.get('captureWorkers')) return false;
    if (kind === 'cookie:js' && !config.get('captureJsCookies')) return false;
    if (kind.startsWith('webtransport:') && !config.get('captureWebTransport')) return false;
    if (kind.startsWith('vitals:') && !config.get('capturePageVitals')) return false;
  }
  return true;
}

function dispatch(ev, ctx) {
  if (!allowed(ev)) return;
  if (ev.stack && !config.get('captureStacks')) ev.stack = null;
  switch (ev.t) {
    case 'req:start':  return onRequestStart(ev, ctx);
    case 'req:body':   return onRequestBody(ev, ctx);
    case 'req:end':    return onRequestEnd(ev, ctx);
    case 'ws:open':    return onWsOpen(ev, ctx);
    case 'ws:protocol': return onWsProtocol(ev, ctx);
    case 'ws:frame':   return onWsFrame(ev, ctx);
    case 'ws:close':   return onWsClose(ev, ctx);
    case 'sse:open':   return onSseOpen(ev, ctx);
    case 'sse:msg':    return onSseMessage(ev, ctx);
    case 'sse:close':  return onSseClose(ev, ctx);
    case 'perf':       return onPerf(ev, ctx);
    case 'ctx':        return onContextEvent(ev, ctx);
    default: return;
  }
}

/* ------------------------------------------------------------------ */
/* Requetes JS : fetch / XHR / sendBeacon                               */
/* ------------------------------------------------------------------ */
function onRequestStart(ev, ctx) {
  const sig = signatureOf(ev.method, ev.url, ctx.tabId, ctx.frameId);
  const key = keyOf(ctx, ev.pid);

  const apply = rec => {
    pidToRecord.set(key, rec.id);
    applyStart(rec, ev, ctx);
    // La file peut contenir une fin, mais aussi un corps lu de maniere
    // asynchrone : on rejoue chaque evenement par son type reel.
    const queued = orphanEnds.get(key);
    if (queued) {
      orphanEnds.delete(key);
      for (const q of queued) dispatch(q, ctx);
    }
  };

  const merged = correlator.offer('page', sig, ev.ts, apply, { ev, ctx });
  if (merged) pageStats.merged++;
}

function applyStart(rec, ev, ctx) {
  rec.pageMeta = {
    ...(rec.pageMeta || {}),
    api: ev.api,                       // 'fetch' | 'xhr' | 'beacon'
    initiatorUrl: ctx.frameUrl,
    credentials: ev.credentials || null,
    mode: ev.mode || null,
    cache: ev.cache || null,
    redirect: ev.redirect || null,
    referrer: ev.referrer || null,
    referrerPolicy: ev.referrerPolicy || null,
    integrity: ev.integrity || null,
    keepalive: !!ev.keepalive,
    destination: ev.destination || null,
    async: ev.async !== false,
    startedAt: ev.ts
  };
  if (ev.stack && !rec.stack) rec.stack = ev.stack;
  if (ev.headers && ev.headers.length) {
    rec.pageMeta.requestHeaders = ev.headers;
    if (!rec.requestHeaders) rec.requestHeaders = ev.headers;
  }
  if (ev.body && !rec.requestBody) {
    rec.requestBody = normalizePageBody(ev.body);
    store.stats.bytesUp += rec.requestBody.size || 0;
  }
  store.mark(rec, 'js:' + (ev.api || 'call'), ev.ts, { method: ev.method });
}

function onRequestEnd(ev, ctx) {
  const key = keyOf(ctx, ev.pid);
  const recId = pidToRecord.get(key);
  if (recId != null) {
    const rec = store.get(recId);
    if (rec) { applyEnd(rec, ev); pidToRecord.delete(key); return; }
  }
  // Le debut n'est pas encore correle : on met la fin en file d'attente.
  if (!orphanEnds.has(key)) orphanEnds.set(key, []);
  orphanEnds.get(key).push(ev);
}

/** Corps de requete lu de maniere asynchrone apres l emission du debut. */
function onRequestBody(ev, ctx) {
  withPageRecord(ev, ctx, rec => {
    if (!ev.body) return;
    const body = normalizePageBody(ev.body);
    if (!rec.requestBody || !rec.requestBody.text) {
      rec.requestBody = body;
      store.stats.bytesUp += body.size || 0;
      store.mark(rec, 'js:body:request', ev.ts, { bytes: body.size });
      if (rec.analysis) analyze(rec, { force: true });
      store.touch(rec.id);
    }
  });
}

function applyEnd(rec, ev) {
  rec.pageMeta = { ...(rec.pageMeta || {}), endedAt: ev.ts, jsDuration: ev.duration ?? null };

  if (ev.error) {
    rec.pageMeta.error = ev.error;
    if (!rec.error) { rec.error = 'JS: ' + ev.error; store.finalize(rec, 'error'); }
    store.mark(rec, 'js:error', ev.ts, { error: ev.error });
  }
  if (ev.status != null) {
    if (rec.statusCode == null) rec.statusCode = ev.status;
    rec.pageMeta.status = ev.status;
    rec.pageMeta.statusText = ev.statusText || null;
    rec.pageMeta.responseType = ev.responseType || null;
    rec.pageMeta.responseUrl = ev.responseUrl || null;
    rec.pageMeta.fromServiceWorker = !!ev.fromServiceWorker;
    if (ev.fromServiceWorker) store.mark(rec, 'serviceWorker:served', ev.ts);
  }
  if (ev.headers && ev.headers.length && !rec.responseHeaders) rec.responseHeaders = ev.headers;

  // Corps de reponse de secours : utile quand StreamFilter n'a rien pu capturer
  // (reponse servie par un Service Worker, cache memoire, requete inter-origines).
  if (ev.bodyText != null && (!rec.responseBody || !rec.responseBody.text)) {
    const t = truncateText(ev.bodyText, cap(config.get('maxResponseBodyBytes')));
    rec.responseBody = {
      kind: 'text', text: t.text, base64: null, preview: null,
      size: ev.bodySize != null ? ev.bodySize : t.size, stored: t.text.length,
      truncated: t.truncated, mime: ev.mime || '', charset: '',
      contentEncoding: '', decompressed: false, source: 'pageHook'
    };
    if (!rec.size) rec.size = rec.responseBody.size;
    store.mark(rec, 'js:body', ev.ts, { bytes: rec.responseBody.size });
  }
  if (rec.state === 'pending' && !ev.error) {
    rec.endTime = ev.ts;
    store.finalize(rec, 'complete');
  }
  analyze(rec, { force: !!rec.analysis });
  store.touch(rec.id);
}

/* ------------------------------------------------------------------ */
/* WebSocket : la poignee de main vient de webRequest, les TRAMES d'ici */
/* ------------------------------------------------------------------ */
function onWsOpen(ev, ctx) {
  const sig = signatureOf('GET', ev.url, ctx.tabId, ctx.frameId);
  const key = keyOf(ctx, ev.pid);
  const apply = rec => {
    pidToRecord.set(key, rec.id);
    rec.ws = rec.ws || { frames: [], protocols: ev.protocols || null, openedAt: null, closedAt: null, close: null, sent: 0, received: 0, bytesSent: 0, bytesReceived: 0 };
    rec.ws.protocols = ev.protocols || rec.ws.protocols;
    rec.ws.openedAt = ev.ts;
    if (ev.stack && !rec.stack) rec.stack = ev.stack;
    store.mark(rec, 'ws:open', ev.ts, { url: ev.url });
    const queued = orphanEnds.get(key);
    if (queued) { orphanEnds.delete(key); for (const q of queued) dispatch(q, ctx); }
  };
  if (correlator.offer('page', sig, ev.ts, apply, { ev, ctx })) pageStats.merged++;
}

function withPageRecord(ev, ctx, fn) {
  const key = keyOf(ctx, ev.pid);
  const recId = pidToRecord.get(key);
  const rec = recId != null ? store.get(recId) : null;
  if (rec) { fn(rec); return; }
  if (!orphanEnds.has(key)) orphanEnds.set(key, []);
  orphanEnds.get(key).push(ev);          // rejoue des que la correlation aboutit
}

/* Le sous-protocole retenu par le serveur. La vue « Flux » s en sert pour
   choisir comment decouper chaque trame. */
function onWsProtocol(ev, ctx) {
  const rec = ctx.byPid(ev.pid);
  if (!rec || !ev.protocol) return;
  rec.ws = rec.ws || { frames: [], protocols: null, openedAt: null, closedAt: null, close: null, sent: 0, received: 0, bytesSent: 0, bytesReceived: 0 };
  rec.ws.protocol = String(ev.protocol);
  store.touch(rec.id);
}

function onWsFrame(ev, ctx) {
  if (!config.get('captureWebSocketFrames')) return;
  withPageRecord(ev, ctx, rec => {
    rec.ws = rec.ws || { frames: [], protocols: null, openedAt: null, closedAt: null, close: null, sent: 0, received: 0, bytesSent: 0, bytesReceived: 0 };
    const limit = cap(config.get('maxWebSocketFrames'));
    const frame = {
      dir: ev.dir,                      // 'send' | 'recv'
      ts: ev.ts,
      opcode: ev.opcode || 'text',
      size: ev.size || 0,
      data: ev.data != null ? ev.data : null,
      truncated: !!ev.truncated
    };
    if (rec.ws.frames.length < limit) rec.ws.frames.push(frame);
    if (ev.dir === 'send') { rec.ws.sent++; rec.ws.bytesSent += frame.size; store.stats.bytesUp += frame.size; }
    else { rec.ws.received++; rec.ws.bytesReceived += frame.size; store.stats.bytesDown += frame.size; }
    pageStats.frames++;
    store.touch(rec.id);
  });
}

function onWsClose(ev, ctx) {
  withPageRecord(ev, ctx, rec => {
    rec.ws = rec.ws || { frames: [], sent: 0, received: 0, bytesSent: 0, bytesReceived: 0 };
    rec.ws.closedAt = ev.ts;
    rec.ws.close = { code: ev.code, reason: ev.reason || '', wasClean: !!ev.wasClean };
    store.mark(rec, 'ws:close', ev.ts, rec.ws.close);
    if (rec.state === 'pending') store.finalize(rec, 'complete');
    analyze(rec, { force: !!rec.analysis });
    pidToRecord.delete(keyOf(ctx, ev.pid));
  });
}

/* ------------------------------------------------------------------ */
/* Server-Sent Events                                                   */
/* ------------------------------------------------------------------ */
function onSseOpen(ev, ctx) {
  const sig = signatureOf('GET', ev.url, ctx.tabId, ctx.frameId);
  const key = keyOf(ctx, ev.pid);
  const apply = rec => {
    pidToRecord.set(key, rec.id);
    rec.sse = rec.sse || { messages: [], openedAt: ev.ts, closedAt: null, withCredentials: !!ev.withCredentials };
    if (ev.stack && !rec.stack) rec.stack = ev.stack;
    store.mark(rec, 'sse:open', ev.ts, { url: ev.url });
    const queued = orphanEnds.get(key);
    if (queued) { orphanEnds.delete(key); for (const q of queued) dispatch(q, ctx); }
  };
  if (correlator.offer('page', sig, ev.ts, apply, { ev, ctx })) pageStats.merged++;
}

function onSseMessage(ev, ctx) {
  withPageRecord(ev, ctx, rec => {
    rec.sse = rec.sse || { messages: [], openedAt: null, closedAt: null };
    if (rec.sse.messages.length >= cap(config.get('maxSseMessages'))) {
      rec.sse.dropped = (rec.sse.dropped || 0) + 1;   // plafond atteint : on compte sans stocker
      store.touch(rec.id);
      return;
    }
    rec.sse.messages.push({
      ts: ev.ts, event: ev.event || 'message',
      data: ev.data != null ? ev.data : '', lastEventId: ev.lastEventId || null,
      size: ev.size || 0, truncated: !!ev.truncated
    });
    store.stats.bytesDown += ev.size || 0;
    store.touch(rec.id);
  });
}

function onSseClose(ev, ctx) {
  withPageRecord(ev, ctx, rec => {
    rec.sse = rec.sse || { messages: [] };
    rec.sse.closedAt = ev.ts;
    rec.sse.error = ev.error || null;
    store.mark(rec, 'sse:close', ev.ts);
    if (rec.state === 'pending') store.finalize(rec, 'complete');
    analyze(rec, { force: !!rec.analysis });
    pidToRecord.delete(keyOf(ctx, ev.pid));
  });
}

/* ------------------------------------------------------------------ */
/* PerformanceResourceTiming : filet de securite ultime                 */
/* Toute ressource chargee par la page y apparait, meme servie par un   */
/* Service Worker ou le cache memoire, donc invisible pour webRequest.  */
/* ------------------------------------------------------------------ */
function onPerf(ev, ctx) {
  if (!config.get('capturePerformance')) return;
  for (const entry of ev.entries || []) {
    const apply = rec => {
      rec.perf = {
        initiatorType: entry.initiatorType || null,
        nextHopProtocol: entry.nextHopProtocol || null,
        transferSize: entry.transferSize ?? null,
        encodedBodySize: entry.encodedBodySize ?? null,
        decodedBodySize: entry.decodedBodySize ?? null,
        duration: entry.duration ?? null,
        startTime: entry.startTime ?? null,
        redirectCount: entry.redirectCount ?? null,
        renderBlockingStatus: entry.renderBlockingStatus || null,
        deliveryType: entry.deliveryType || null,
        serverTiming: entry.serverTiming || null,
        timings: entry.timings || null,
        workerStart: entry.workerStart ?? null
      };
      if (!rec.size && entry.transferSize) rec.size = entry.transferSize;
      if (rec.duration == null && entry.duration) rec.duration = Math.round(entry.duration);
      if (entry.workerStart) store.mark(rec, 'serviceWorker:handled', ev.ts);
      store.touch(rec.id);
    };
    if (correlator.offerByUrl('perf', entry.name, ctx.tabId, ev.ts, apply, { entry, ctx, kind: 'perf' })) {
      pageStats.merged++;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Evenements de contexte : Worker, ServiceWorker, WebRTC, navigation   */
/* ------------------------------------------------------------------ */
export const contextLog = [];
const contextSeen = new Set();

function onContextEvent(ev, ctx) {
  const key = ev.kind + '|' + (ev.url || '') + '|' + Math.round(ev.ts / 50) + '|' + ctx.tabId + '|' + ctx.frameId;
  if (contextSeen.has(key)) return;      // anti-doublon strict
  contextSeen.add(key);
  contextLog.push({
    kind: ev.kind, url: ev.url || null, detail: ev.detail || null,
    tabId: ctx.tabId, frameId: ctx.frameId, frameUrl: ctx.frameUrl,
    stack: ev.stack || null, ts: ev.ts
  });
}

export function clearPageState() {
  pidToRecord.clear(); orphanEnds.clear();
  contextLog.length = 0; contextSeen.clear();
}
