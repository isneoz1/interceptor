/* Magasin memoire des enregistrements reseau — INTERCEPTOR (by NeoZ) */
import { Emitter } from '../lib/emitter.js';
import { config } from './config.js';
import { hostOf, pathOf, schemeOf, throttleFlush } from '../lib/util.js';

let SEQ = 0;

/** Repositionne le compteur au-dessus des identifiants restaures depuis le
 *  stockage, faute de quoi les nouvelles requetes ecraseraient les anciennes. */
export function reserveIds(maxId) {
  if (Number.isFinite(maxId) && maxId > SEQ) SEQ = maxId;
}

export function newRecord(init = {}) {
  return {
    id: ++SEQ,
    requestId: null,
    sources: [],
    url: '',
    finalUrl: '',
    method: 'GET',
    type: 'other',
    scheme: '',
    host: '',
    path: '',
    tabId: -1,
    frameId: -1,
    parentFrameId: -1,
    windowId: -1,
    cookieStoreId: null,
    incognito: false,
    originUrl: null,
    documentUrl: null,
    thirdParty: false,
    frameAncestors: null,
    urlClassification: null,

    requestHeaders: null,
    requestBody: null,
    statusCode: null,
    statusLine: null,
    responseHeaders: null,
    responseBody: null,
    mime: '',

    ip: null,
    dns: null,
    wireRequestSize: 0,
    wireResponseSize: 0,
    fromCache: false,
    networkless: false,
    proxy: null,
    security: null,
    auth: null,
    error: null,
    redirects: [],
    cookies: { set: [], changed: [] },
    ws: null,
    sse: null,
    perf: null,
    stack: null,
    pageMeta: null,
    rulesApplied: [],
    replay: null,
    analysis: null,
    flag: false,
    note: '',                 // annotation libre saisie par l utilisateur
    color: '',                // marquage couleur : '' | rouge | orange | jaune | vert | bleu | violet
    imported: false,

    startTime: 0,
    endTime: 0,
    duration: null,
    size: 0,
    state: 'pending',
    timeline: [],
    _tlKeys: new Set(),
    dedup: { signature: '', merged: 0, mergedFrom: [] },
    ...init
  };
}

class Store extends Emitter {
  constructor() {
    super();
    this.records = new Map();
    this.order = [];
    this.byRequestId = new Map();
    this.dirty = new Set();
    this.stats = {
      total: 0, complete: 0, errors: 0, dropped: 0, removed: 0,
      merged: 0, bytesDown: 0, bytesUp: 0, startedAt: Date.now()
    };
    this._flush = throttleFlush(() => this._emitDelta(), 120);
  }

  create(init) {
    const rec = newRecord(init);
    rec.scheme = schemeOf(rec.url);
    rec.host = hostOf(rec.url);
    rec.path = pathOf(rec.url);
    this.records.set(rec.id, rec);
    this.order.push(rec.id);
    if (rec.requestId != null) this.byRequestId.set(rec.requestId, rec.id);
    this.stats.total++;
    this.touch(rec.id);
    this._evict();
    this.emit('create', rec);
    return rec;
  }

  get(id) { return this.records.get(id); }

  byRid(requestId) {
    const id = this.byRequestId.get(requestId);
    return id == null ? undefined : this.records.get(id);
  }

  bindRequestId(rec, requestId) {
    if (requestId == null || rec.requestId === requestId) return;
    rec.requestId = requestId;
    this.byRequestId.set(requestId, rec.id);
  }

  addSource(rec, source) {
    if (!rec.sources.includes(source)) { rec.sources.push(source); this.touch(rec.id); }
  }

  mark(rec, event, ts, detail) {
    const key = event + '@' + (ts | 0);
    if (rec._tlKeys.has(key)) return false;
    rec._tlKeys.add(key);
    rec.timeline.push({ event, ts: ts || Date.now(), detail: detail || null });
    rec.timeline.sort((a, b) => a.ts - b.ts);
    this.touch(rec.id);
    return true;
  }

  touch(id) { this.dirty.add(id); this._flush(); }

  finalize(rec, state) {
    rec.state = state;
    rec.endTime = rec.endTime || Date.now();
    rec.duration = rec.startTime ? Math.max(0, rec.endTime - rec.startTime) : null;
    if (state === 'complete') this.stats.complete++;
    if (state === 'error' || state === 'aborted') this.stats.errors++;
    this.touch(rec.id);
    this.emit('finalize', rec);
  }

  /** Suppression explicite demandee depuis l interface. */
  remove(ids) {
    const set = new Set(ids);
    let n = 0;
    for (const id of set) {
      const rec = this.records.get(id);
      if (!rec) continue;
      if (rec.requestId != null) this.byRequestId.delete(rec.requestId);
      this.records.delete(id);
      this.dirty.delete(id);
      this.stats.removed++;
      n++;
    }
    if (n) {
      this.order = this.order.filter(id => !set.has(id));
      this.emit('removed', [...set]);
    }
    return n;
  }

  _evict() {
    const max = config.get('maxRecords');
    if (!max || max <= 0) return;   // 0 = historique illimite
    while (this.order.length > max) {
      const id = this.order.shift();
      const rec = this.records.get(id);
      if (rec && rec.requestId != null) this.byRequestId.delete(rec.requestId);
      this.records.delete(id);
      this.dirty.delete(id);
      this.stats.dropped++;
      this.emit('evict', id);
    }
  }

  clear() {
    this.records.clear();
    this.order.length = 0;
    this.byRequestId.clear();
    this.dirty.clear();
    this.stats = {
      total: 0, complete: 0, errors: 0, dropped: 0, removed: 0,
      merged: 0, bytesDown: 0, bytesUp: 0, startedAt: Date.now()
    };
    this.emit('clear');
  }

  _emitDelta() {
    if (!this.dirty.size) return;
    const ids = [...this.dirty];
    this.dirty.clear();
    const list = [];
    for (const id of ids) {
      const rec = this.records.get(id);
      if (rec) list.push(summarize(rec));
    }
    if (list.length) this.emit('delta', list);
  }

  recent(limit = 5000, tabId = null) {
    const out = [];
    for (let i = this.order.length - 1; i >= 0 && out.length < limit; i--) {
      const rec = this.records.get(this.order[i]);
      if (!rec) continue;
      if (tabId != null && rec.tabId !== tabId) continue;
      out.push(summarize(rec));
    }
    return out.reverse();
  }

  all() { return this.order.map(id => this.records.get(id)).filter(Boolean); }
}

/** Resume envoye a l interface : tout ce que le tableau sait afficher, sans
 *  jamais transporter les corps ni les entetes (demandes a la selection). */
export function summarize(rec) {
  return {
    id: rec.id,
    requestId: rec.requestId,
    sources: rec.sources,
    url: rec.finalUrl || rec.url,
    method: rec.method,
    type: rec.type,
    scheme: rec.scheme,
    host: rec.host,
    path: rec.path,
    tabId: rec.tabId,
    frameId: rec.frameId,
    incognito: rec.incognito,
    cookieStoreId: rec.cookieStoreId,
    thirdParty: rec.thirdParty,
    classified: rec.urlClassification
      ? [...(rec.urlClassification.firstParty || []), ...(rec.urlClassification.thirdParty || [])].join(' ')
      : '',
    initiator: rec.documentUrl || rec.originUrl || null,
    statusCode: rec.statusCode,
    statusLine: rec.statusLine,
    mime: rec.mime,
    ip: rec.ip,
    fromCache: rec.fromCache,
    networkless: !!rec.networkless,
    protocol: rec.perf ? rec.perf.nextHopProtocol : null,
    size: rec.size,
    transferSize: rec.perf ? rec.perf.transferSize : null,
    wireSize: (rec.wireRequestSize || 0) + (rec.wireResponseSize || 0),
    reqSize: rec.requestBody ? rec.requestBody.size : 0,
    startTime: rec.startTime,
    endTime: rec.endTime,
    duration: rec.duration,
    state: rec.state,
    error: rec.error,
    redirects: rec.redirects.length,
    hasReqBody: !!rec.requestBody,
    hasResBody: !!rec.responseBody,
    hasStack: !!rec.stack,
    hasAuth: !!rec.auth,
    hasProxy: !!rec.proxy,
    setCookies: rec.cookies.set.length,
    tls: rec.security ? rec.security.state : null,
    tlsVersion: rec.security ? rec.security.protocolVersion : null,
    wsFrames: rec.ws ? rec.ws.frames.length : 0,
    sseEvents: rec.sse ? rec.sse.messages.length : 0,
    merged: rec.dedup.merged,
    rules: rec.rulesApplied.length,
    replayed: !!rec.replay,
    imported: !!rec.imported,
    flag: !!rec.flag,
    note: rec.note || '',
    color: rec.color || '',
    risk: rec.analysis ? rec.analysis.risk : null,
    findings: rec.analysis ? rec.analysis.findings.length : 0,
    tags: rec.analysis ? rec.analysis.tags : []
  };
}

export function detail(rec) {
  const { _tlKeys, ...rest } = rec;
  return { ...rest, dedup: { ...rec.dedup } };
}

export const store = new Store();
