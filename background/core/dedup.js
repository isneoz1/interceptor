/* Moteur de correlation / anti-doublon — INTERCEPTOR (by NeoZ)
 *
 * Principe : une requete reelle = UN enregistrement, quel que soit le nombre de
 * couches de capture qui l'observent.
 *
 *   couche autoritaire : webRequest (requestId unique, y compris a travers les redirections)
 *   couches secondaires : page (fetch/XHR/WS/SSE/beacon), perf (PerformanceObserver),
 *                         proxy, tls, nav, cookies
 *
 * Regles strictes :
 *   1. Deux observations de la MEME couche ne fusionnent jamais entre elles
 *      (deux GET identiques en polling restent deux lignes distinctes).
 *   2. Une observation secondaire ne peut rejoindre un enregistrement que si
 *      celui-ci n'a pas deja consomme cette couche -> appariement 1:1 en FIFO.
 *   3. Une observation qui ne trouve pas de parent dans la fenetre de correlation
 *      devient son propre enregistrement : rien n'est jamais perdu.
 */
import { config } from './config.js';
import { store } from './store.js';
import { normalizeUrl } from '../lib/util.js';

export function signatureOf(method, url, tabId, frameId) {
  return (method || 'GET').toUpperCase() + ' ' + normalizeUrl(url) +
         ' @' + (tabId == null ? -1 : tabId) + '/' + (frameId == null ? -1 : frameId);
}

/** Cle sans methode : utilisee par les couches qui ne connaissent pas le verbe
 *  HTTP (PerformanceObserver notamment). */
export function urlKeyOf(url, tabId) {
  return normalizeUrl(url) + ' @' + (tabId == null ? -1 : tabId);
}

class Correlator {
  constructor() {
    /** signature -> [{ id, ts, claims:Set<string> }] (FIFO) */
    this.index = new Map();
    /** cle URL seule -> memes entrees, partagees par reference */
    this.urlIndex = new Map();
    /** signature -> [{ layer, ev, ctx, ts }] observations orphelines */
    this.pending = new Map();
    this.sweepTimer = null;
    this.onPromote = null;   // injecte par ingest/page.js
    this.onMerge = null;     // injecte par ingest/page.js
  }

  start() {
    this.stop();
    const ms = Math.max(500, config.get('dedupSweepMs') || 2000);
    this.sweepTimer = setInterval(() => this.sweep(), ms);
  }

  stop() { if (this.sweepTimer) { clearInterval(this.sweepTimer); this.sweepTimer = null; } }

  /** Enregistre un record autoritaire et absorbe les orphelins qui l'attendaient. */
  register(rec) {
    const sig = signatureOf(rec.method, rec.url, rec.tabId, rec.frameId);
    rec.dedup.signature = sig;
    const entry = { id: rec.id, ts: rec.startTime || Date.now(), claims: new Set(rec.sources) };
    if (!this.index.has(sig)) this.index.set(sig, []);
    this.index.get(sig).push(entry);

    const ukey = urlKeyOf(rec.url, rec.tabId);
    if (!this.urlIndex.has(ukey)) this.urlIndex.set(ukey, []);
    this.urlIndex.get(ukey).push(entry);   // meme objet : les claims restent synchronises

    this._drainPending(sig);
    this._drainPending('URL::' + ukey);
    return sig;
  }

  _entriesFor(sig) {
    if (sig.startsWith('URL::')) return this.urlIndex.get(sig.slice(5)) || [];
    return this.index.get(sig) || [];
  }

  /** Offre une observation dont on ne connait que l'URL (couche perf). */
  offerByUrl(layer, url, tabId, ts, apply, meta) {
    return this.offer(layer, 'URL::' + urlKeyOf(url, tabId), ts, apply, meta);
  }

  /** Trouve le plus ancien enregistrement compatible qui n'a pas encore cette couche. */
  findHost(sig, layer, ts) {
    if (!config.get('dedupEnabled')) return null;
    const win = config.get('dedupWindowMs') || 15000;
    const entries = this._entriesFor(sig);
    let best = null;
    for (const e of entries) {
      if (e.claims.has(layer)) continue;
      if (Math.abs(e.ts - ts) > win) continue;
      const rec = store.get(e.id);
      if (!rec) continue;
      if (!best || e.ts < best.entry.ts) best = { entry: e, rec };
    }
    return best;
  }

  /** Tente d'attacher une observation secondaire. Sinon la met en attente. */
  offer(layer, sig, ts, apply, meta) {
    const host = this.findHost(sig, layer, ts);
    if (host) {
      host.entry.claims.add(layer);
      host.rec.dedup.merged++;
      if (!host.rec.dedup.mergedFrom.includes(layer)) host.rec.dedup.mergedFrom.push(layer);
      store.stats.merged++;
      store.addSource(host.rec, layer);
      try { apply(host.rec); } catch (e) { console.error('[INTERCEPTOR] merge', e); }
      store.touch(host.rec.id);
      return host.rec;
    }
    if (!this.pending.has(sig)) this.pending.set(sig, []);
    this.pending.get(sig).push({ layer, ts, apply, meta, expires: ts + (config.get('dedupWindowMs') || 15000) });
    return null;
  }

  _drainPending(sig) {
    const list = this.pending.get(sig);
    if (!list || !list.length) return;
    const keep = [];
    for (const p of list) {
      const host = this.findHost(sig, p.layer, p.ts);
      if (host) {
        host.entry.claims.add(p.layer);
        host.rec.dedup.merged++;
        if (!host.rec.dedup.mergedFrom.includes(p.layer)) host.rec.dedup.mergedFrom.push(p.layer);
        store.stats.merged++;
        store.addSource(host.rec, p.layer);
        try { p.apply(host.rec); } catch (e) { console.error('[INTERCEPTOR] drain', e); }
        store.touch(host.rec.id);
      } else keep.push(p);
    }
    if (keep.length) this.pending.set(sig, keep); else this.pending.delete(sig);
  }

  /** Balayage permanent : on retente, puis on promeut les orphelins expires. */
  sweep() {
    const nowTs = Date.now();

    for (const sig of [...this.pending.keys()]) this._drainPending(sig);

    for (const [sig, list] of [...this.pending.entries()]) {
      const keep = [];
      for (const p of list) {
        if (nowTs < p.expires) { keep.push(p); continue; }
        if (this.onPromote) {
          try { this.onPromote(p, sig); } catch (e) { console.error('[INTERCEPTOR] promote', e); }
        }
      }
      if (keep.length) this.pending.set(sig, keep); else this.pending.delete(sig);
    }

    // L'index de correlation (pas les donnees) se purge au-dela de 4x la fenetre :
    // les enregistrements sont conserves integralement, seule l'aptitude a fusionner expire.
    const horizon = nowTs - 4 * (config.get('dedupWindowMs') || 15000);
    for (const map of [this.index, this.urlIndex]) {
      for (const [key, entries] of map.entries()) {
        if (!entries.length) { map.delete(key); continue; }
        const fresh = entries.filter(e => e.ts >= horizon);
        if (!fresh.length) map.delete(key);
        else if (fresh.length !== entries.length) map.set(key, fresh);
      }
    }
  }

  stats() {
    let pendingCount = 0;
    for (const l of this.pending.values()) pendingCount += l.length;
    return {
      signatures: this.index.size, urlKeys: this.urlIndex.size,
      pending: pendingCount, merged: store.stats.merged
    };
  }

  clear() { this.index.clear(); this.urlIndex.clear(); this.pending.clear(); }
}

export const correlator = new Correlator();
