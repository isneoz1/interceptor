/* Promotion des observations orphelines — INTERCEPTOR (by NeoZ)
 *
 * Une observation venue du monde page ou de PerformanceObserver qui ne trouve
 * aucune requete reseau correspondante dans la fenetre de correlation devient
 * une ligne a part entiere. C est la garantie que rien n est jamais perdu :
 * reponses servies par un Service Worker, cache memoire, requetes bloquees.
 */
import { store } from '../core/store.js';
import { correlator } from '../core/dedup.js';
import { analyze } from '../core/analyzer.js';
import { hostOf, pathOf, schemeOf } from '../lib/util.js';
import { pageStats } from './page.js';

correlator.onPromote = (pending) => {
  const meta = pending.meta || {};

  if (pending.layer === 'perf') {
    const rec = createFromPerf(meta.entry, meta.ctx, pending.ts);
    pending.apply(rec);
    analyze(rec);
    pageStats.promoted++;
    return;
  }

  if (pending.layer !== 'page' || !meta.ev) return;
  const rec = createFromPageEvent(meta.ev, meta.ctx);
  pending.apply(rec);
  pageStats.promoted++;
};

function baseRecord(url, method, ctx, ts, extra) {
  const rec = store.create({
    sources: extra.sources,
    url, finalUrl: url,
    method: (method || 'GET').toUpperCase(),
    type: extra.type || 'other',
    tabId: ctx ? ctx.tabId : -1,
    frameId: ctx ? ctx.frameId : -1,
    documentUrl: ctx ? ctx.frameUrl : null,
    originUrl: ctx ? ctx.frameUrl : null,
    incognito: ctx ? ctx.incognito : false,
    cookieStoreId: ctx ? ctx.cookieStoreId : null,
    startTime: ts,
    thirdParty: isCrossOrigin(url, ctx && ctx.frameUrl)
  });
  rec.scheme = schemeOf(url); rec.host = hostOf(url); rec.path = pathOf(url);
  correlator.register(rec);
  return rec;
}

function createFromPageEvent(ev, ctx) {
  const type = ev.api === 'ws' ? 'websocket'
             : ev.api === 'sse' ? 'xmlhttprequest'
             : ev.api === 'beacon' ? 'beacon'
             : 'xmlhttprequest';
  const rec = baseRecord(ev.url, ev.method, ctx, ev.ts, { sources: ['page'], type });
  store.mark(rec, 'created:pageOnly', ev.ts, { api: ev.api });
  rec.networkless = true;   // aucune trace reseau : cache, Service Worker, ou requete bloquee
  return rec;
}

function createFromPerf(entry, ctx, ts) {
  const rec = baseRecord(entry.name, 'GET', ctx, ts, {
    sources: ['perf'], type: entry.initiatorType || 'other'
  });
  store.mark(rec, 'created:perfOnly', ts, { initiator: entry.initiatorType });
  rec.networkless = true;
  return rec;
}

function isCrossOrigin(url, ref) {
  if (!ref) return false;
  try { return new URL(url).origin !== new URL(ref).origin; } catch { return false; }
}
