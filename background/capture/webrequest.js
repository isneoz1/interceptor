/* Capture webRequest — cycle de vie COMPLET (9 evenements) — INTERCEPTOR (by NeoZ)
 *
 * onBeforeRequest -> onBeforeSendHeaders -> onSendHeaders -> onHeadersReceived
 *   -> [onAuthRequired] -> [onBeforeRedirect] -> onResponseStarted -> onCompleted
 *                                                              \-> onErrorOccurred
 *
 * Un seul enregistrement par requestId : les redirections restent dans la meme
 * ligne (chaine `redirects`), ce qui elimine par construction les doublons de
 * redirection que produisent la plupart des outils.
 */
import { B, headerGet, parseContentType, hostOf, pathOf, schemeOf } from '../lib/util.js';
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { correlator } from '../core/dedup.js';
import { decodeRequestBody } from './bodies.js';
import { attachFilter, filterState } from './streamfilter.js';
import { captureSecurity } from './security.js';
import { applyRules, delayFor } from '../rules/engine.js';
import { shouldIntercept, hold } from '../rules/intercept.js';
import { analyze } from '../core/analyzer.js';
import { resolveHost } from './dnsinfo.js';
import { drainProxyInfo } from './proxy.js';

const FILTER = { urls: ['<all_urls>'] };   // http, https, ws, wss, ftp, file, data
const SELF = B.runtime.getURL('');

let started = false;

function ignorable(details) {
  if (!config.get('capturing')) return true;
  if (config.get('ignoreOwnRequests') && details.url && details.url.startsWith(SELF)) return true;
  if (!config.allowType(details.type)) return true;
  if (!config.allowUrl(details.url)) return true;
  return false;
}

/**
 * Classification native de Firefox (protection contre le pistage) : liste des
 * categories reconnues pour la requete, en premiere et en tierce partie.
 * C'est le verdict du navigateur lui-meme, independant de notre propre liste.
 */
function classification(details) {
  const c = details.urlClassification;
  if (!c) return null;
  const first = c.firstParty || [];
  const third = c.thirdParty || [];
  if (!first.length && !third.length) return null;
  return { firstParty: first, thirdParty: third };
}

function isThirdParty(url, originUrl) {
  if (!originUrl) return false;
  const a = hostOf(url), b = hostOf(originUrl);
  if (!a || !b) return false;
  const base = h => h.split('.').slice(-2).join('.');
  return base(a) !== base(b);
}

/** Recupere ou cree l'enregistrement associe a un requestId. */
function upsert(details, phase) {
  let rec = store.byRid(details.requestId);
  if (rec) return rec;

  rec = store.create({
    requestId: details.requestId,
    sources: ['webRequest'],
    url: details.url,
    finalUrl: details.url,
    method: (details.method || 'GET').toUpperCase(),
    type: details.type || 'other',
    tabId: details.tabId != null ? details.tabId : -1,
    frameId: details.frameId != null ? details.frameId : -1,
    parentFrameId: details.parentFrameId != null ? details.parentFrameId : -1,
    cookieStoreId: details.cookieStoreId || null,
    incognito: !!details.incognito,
    originUrl: details.originUrl || null,
    documentUrl: details.documentUrl || null,
    // Firefox fournit lui-meme le verdict « tierce partie » depuis la version 68 ;
    // le calcul maison ne sert que de repli sur les versions plus anciennes.
    thirdParty: typeof details.thirdParty === 'boolean'
      ? details.thirdParty
      : isThirdParty(details.url, details.originUrl || details.documentUrl),
    frameAncestors: details.frameAncestors || null,
    urlClassification: classification(details),
    startTime: details.timeStamp || Date.now(),
    proxy: details.proxyInfo || null
  });
  correlator.register(rec);
  drainProxyInfo(rec);
  store.mark(rec, 'created:' + phase, details.timeStamp || Date.now());
  if (config.get('captureDns')) resolveHost(rec);
  return rec;
}

export function parseSetCookie(line) {
  const parts = String(line).split(';');
  const [name, ...rest] = (parts.shift() || '').split('=');
  const attrs = {};
  for (const p of parts) {
    const [k, ...v] = p.split('=');
    attrs[k.trim().toLowerCase()] = v.length ? v.join('=').trim() : true;
  }
  return {
    name: (name || '').trim(),
    value: rest.join('='),
    domain: attrs.domain || null,
    path: attrs.path || null,
    expires: attrs.expires || null,
    maxAge: attrs['max-age'] || null,
    secure: !!attrs.secure,
    httpOnly: !!attrs.httponly,
    sameSite: attrs.samesite || null
  };
}

function collectSetCookies(rec, headers) {
  if (!headers) return;
  for (const h of headers) {
    if (h && h.name && h.name.toLowerCase() === 'set-cookie') {
      const line = h.value || '';
      if (!rec.cookies.set.some(c => c.raw === line)) {
        rec.cookies.set.push({ raw: line, ...parseSetCookie(line) });
      }
    }
  }
}

export function startWebRequest() {
  if (started || !config.get('captureWebRequest')) return;
  started = true;
  const wr = B.webRequest;

  /* ---------- 1. onBeforeRequest : creation + corps de requete ---------- */
  wr.onBeforeRequest.addListener(details => {
    if (ignorable(details)) return {};
    const rec = upsert(details, 'onBeforeRequest');
    store.mark(rec, 'request:start', details.timeStamp);

    if (details.requestBody && config.get('captureRequestBodies') && config.allowBodyForType(rec.type)) {
      const body = decodeRequestBody(details.requestBody, null);
      if (body && body.kind !== 'empty') {
        rec.requestBody = body;
        store.stats.bytesUp += body.size || 0;
      }
    }

    if (filterState.anchor === 'onBeforeRequest') attachFilter(rec, details.requestId, null);

    const verdict = applyRules(rec, 'onBeforeRequest', details);

    // Latence simulee : seul cas ou ce listener repond de maniere asynchrone.
    // Firefox attend la promesse avant de laisser partir la requete, ce qui
    // reproduit un reseau lent sans rien changer d autre.
    const attente = delayFor(rec, details);
    if (attente > 0) {
      return new Promise(resolve => setTimeout(() => resolve(verdict || {}), attente));
    }
    return verdict || {};
  }, FILTER, ['blocking', 'requestBody']);

  /* ---------- 2. onBeforeSendHeaders : entetes sortantes ---------- */
  wr.onBeforeSendHeaders.addListener(details => {
    if (ignorable(details)) return {};
    const rec = upsert(details, 'onBeforeSendHeaders');
    rec.requestHeaders = details.requestHeaders || rec.requestHeaders;
    store.mark(rec, 'headers:prepared', details.timeStamp);

    if (rec.requestBody && !rec.requestBody.contentType) {
      rec.requestBody.contentType = headerGet(details.requestHeaders, 'content-type') || '';
    }

    const verdict = applyRules(rec, 'onBeforeSendHeaders', details);
    if (verdict) return verdict;

    // Point d arret : la requete attend une decision de l interface. La
    // promesse est toujours resolue, au pire par l echeance de securite.
    if (shouldIntercept(rec, 'onBeforeSendHeaders', details)) {
      return hold(rec, 'onBeforeSendHeaders', details);
    }
    return {};
  }, FILTER, ['blocking', 'requestHeaders']);

  /* ---------- 3. onSendHeaders : entetes reellement emises ---------- */
  wr.onSendHeaders.addListener(details => {
    if (ignorable(details)) return;
    const rec = upsert(details, 'onSendHeaders');
    rec.requestHeaders = details.requestHeaders || rec.requestHeaders;
    store.mark(rec, 'request:sent', details.timeStamp);
  }, FILTER, ['requestHeaders']);

  /* ---------- 4. onHeadersReceived : entetes reponse + corps + TLS ---------- */
  wr.onHeadersReceived.addListener(details => {
    if (ignorable(details)) return {};
    const rec = upsert(details, 'onHeadersReceived');
    rec.responseHeaders = details.responseHeaders || rec.responseHeaders;
    rec.statusCode = details.statusCode;
    rec.statusLine = details.statusLine || null;
    rec.mime = parseContentType(headerGet(details.responseHeaders, 'content-type')).mime;
    collectSetCookies(rec, details.responseHeaders);
    store.mark(rec, 'headers:received', details.timeStamp, { status: details.statusCode });

    if (filterState.anchor === 'onHeadersReceived') {
      attachFilter(rec, details.requestId, details.responseHeaders);
    }

    const verdict = applyRules(rec, 'onHeadersReceived', details);

    // Point d arret sur la reponse : on suspend apres avoir laisse la capture
    // TLS se faire, pour ne rien perdre de ce que Firefox n expose qu ici.
    const suspendre = !verdict && shouldIntercept(rec, 'onHeadersReceived', details);

    if (config.get('captureSecurityInfo') && rec.scheme === 'https') {
      // getSecurityInfo n'est exposee que pendant cet evenement : on rend la promesse.
      const suite = () => (suspendre ? hold(rec, 'onHeadersReceived', details) : (verdict || {}));
      return captureSecurity(rec, details).then(suite).catch(suite);
    }
    if (suspendre) return hold(rec, 'onHeadersReceived', details);
    return verdict || {};
  }, FILTER, ['blocking', 'responseHeaders']);

  /* ---------- 5. onAuthRequired : challenges 401 / 407 ---------- */
  wr.onAuthRequired.addListener(details => {
    if (ignorable(details)) return {};
    const rec = upsert(details, 'onAuthRequired');
    rec.auth = {
      scheme: details.scheme,
      realm: details.realm || null,
      isProxy: !!details.isProxy,
      challenger: details.challenger || null,
      statusCode: details.statusCode
    };
    store.mark(rec, 'auth:required', details.timeStamp, rec.auth);
    return {};   // observation pure : aucune interference avec l'authentification
  }, FILTER, ['blocking', 'responseHeaders']);

  /* ---------- 6. onBeforeRedirect : chaine de redirection ---------- */
  wr.onBeforeRedirect.addListener(details => {
    if (ignorable(details)) return;
    const rec = upsert(details, 'onBeforeRedirect');
    rec.redirects.push({
      from: details.url,
      to: details.redirectUrl,
      statusCode: details.statusCode,
      statusLine: details.statusLine || null,
      ip: details.ip || null,
      fromCache: !!details.fromCache,
      headers: details.responseHeaders || null,
      ts: details.timeStamp
    });
    rec.finalUrl = details.redirectUrl;
    rec.host = hostOf(details.redirectUrl);
    rec.path = pathOf(details.redirectUrl);
    rec.scheme = schemeOf(details.redirectUrl);
    collectSetCookies(rec, details.responseHeaders);
    store.mark(rec, 'redirect', details.timeStamp, { to: details.redirectUrl, status: details.statusCode });
  }, FILTER, ['responseHeaders']);

  /* ---------- 7. onResponseStarted : premier octet, IP, cache ---------- */
  wr.onResponseStarted.addListener(details => {
    if (ignorable(details)) return;
    const rec = upsert(details, 'onResponseStarted');
    rec.statusCode = details.statusCode;
    rec.statusLine = details.statusLine || rec.statusLine;
    rec.ip = details.ip || rec.ip;
    rec.fromCache = !!details.fromCache;
    rec.responseHeaders = details.responseHeaders || rec.responseHeaders;
    store.mark(rec, 'response:started', details.timeStamp, { ip: details.ip, cache: details.fromCache });
  }, FILTER, ['responseHeaders']);

  /* ---------- 8. onCompleted ---------- */
  wr.onCompleted.addListener(details => {
    if (ignorable(details)) return;
    const rec = upsert(details, 'onCompleted');
    rec.statusCode = details.statusCode;
    rec.statusLine = details.statusLine || rec.statusLine;
    rec.ip = details.ip || rec.ip;
    rec.fromCache = !!details.fromCache;
    rec.responseHeaders = details.responseHeaders || rec.responseHeaders;
    collectSetCookies(rec, details.responseHeaders);
    const len = parseInt(headerGet(details.responseHeaders, 'content-length') || '', 10);
    if (!rec.size && Number.isFinite(len)) rec.size = len;
    // Tailles reelles sur le fil, entetes comprises : Firefox les expose ici.
    if (Number.isFinite(details.requestSize)) rec.wireRequestSize = details.requestSize;
    if (Number.isFinite(details.responseSize)) rec.wireResponseSize = details.responseSize;
    if (!rec.urlClassification) rec.urlClassification = classification(details);
    rec.endTime = details.timeStamp || Date.now();
    store.mark(rec, 'completed', details.timeStamp, { status: details.statusCode });
    store.finalize(rec, 'complete');
    analyze(rec);
  }, FILTER, ['responseHeaders']);

  /* ---------- 9. onErrorOccurred ---------- */
  wr.onErrorOccurred.addListener(details => {
    if (ignorable(details)) return;
    const rec = upsert(details, 'onErrorOccurred');
    rec.error = details.error || 'unknown error';
    rec.ip = details.ip || rec.ip;
    rec.fromCache = !!details.fromCache;
    rec.endTime = details.timeStamp || Date.now();
    store.mark(rec, 'error', details.timeStamp, { error: rec.error });
    store.finalize(rec, /abort/i.test(rec.error) ? 'aborted' : 'error');
    analyze(rec);
  }, FILTER);

  console.info('[INTERCEPTOR] webRequest actif — 9 evenements sur <all_urls>');
}
