/* Interception en direct — points d arret — INTERCEPTOR (by D4RK)
 *
 * Met une requete en attente avant son depart (ou sa reponse avant qu elle
 * n atteigne la page), et laisse l utilisateur la laisser passer, l abandonner
 * ou la modifier. C est le seul mecanisme du projet qui suspend reellement le
 * trafic : il est donc entoure de garde-fous stricts.
 *
 * Quatre protections, dans cet ordre :
 *   1. desactive par defaut (`interceptEnabled`) ;
 *   2. inactif si AUCUNE console n est ouverte — sans interface, personne ne
 *      pourrait relacher la requete, alors on ne la retient jamais ;
 *   3. un filtre explicite (`interceptFilter`) limite la portee ;
 *   4. une echeance (`interceptTimeoutMs`) laisse toujours repartir la requete,
 *      meme si l utilisateur ferme la console ou ne repond pas.
 *
 * Toute erreur interne relache la requete : jamais de navigation bloquee a
 * cause d une panne de l extension.
 */
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { debug } from '../core/debug.js';

export const interceptStats = {
  held: 0, forwarded: 0, dropped: 0, modified: 0, timedOut: 0, released: 0
};

/** File d attente : identifiant -> requete suspendue. */
const attente = new Map();
let sequence = 0;

/* Fournis par api/rpc.js : le module ne connait ni les ports ni la diffusion. */
let interfaceOuverte = () => false;
let prevenir = () => {};

export function configurerIntercepteur({ hasListener, notify }) {
  if (typeof hasListener === 'function') interfaceOuverte = hasListener;
  if (typeof notify === 'function') prevenir = notify;
}

let motifCompile = null;
let motifSource = null;

function motif() {
  const source = String(config.get('interceptFilter') || '').trim();
  if (source !== motifSource) {
    motifSource = source;
    try { motifCompile = source ? new RegExp(source, 'i') : null; }
    catch { motifCompile = null; }
  }
  return motifCompile;
}

/** Decide si cette requete doit etre suspendue a cette phase. */
export function shouldIntercept(rec, phase, details) {
  if (!config.get('interceptEnabled')) return false;
  // Sans console ouverte, personne ne peut relacher : on n intercepte pas.
  if (!interfaceOuverte()) return false;
  if (phase === 'onBeforeSendHeaders' && !config.get('interceptRequests')) return false;
  if (phase === 'onHeadersReceived' && !config.get('interceptResponses')) return false;
  const re = motif();
  if (re && !re.test(details.url || rec.url || '')) return false;
  return true;
}

function echeance() {
  const n = Number(config.get('interceptTimeoutMs'));
  return Number.isFinite(n) && n > 0 ? n : 30000;
}

/**
 * Suspend la requete et rend la promesse que Firefox attendra.
 * La promesse est TOUJOURS resolue : par l utilisateur, ou par l echeance.
 */
export function hold(rec, phase, details) {
  const id = ++sequence;

  return new Promise(resolve => {
    let fini = false;
    const terminer = verdict => {
      if (fini) return;
      fini = true;
      clearTimeout(minuteur);
      attente.delete(id);
      prevenir();
      resolve(verdict || {});
    };

    const minuteur = setTimeout(() => {
      interceptStats.timedOut++;
      store.mark(rec, 'intercept:timeout', Date.now(), { phase });
      debug.alerte('intercept', 'echeance atteinte, requete relachee', { id: rec.id, phase });
      terminer({});
    }, echeance());

    attente.set(id, {
      id,
      recordId: rec.id,
      phase,
      at: Date.now(),
      method: rec.method,
      url: details.url || rec.finalUrl || rec.url,
      host: rec.host,
      type: rec.type,
      tabId: rec.tabId,
      statusCode: phase === 'onHeadersReceived' ? details.statusCode : null,
      requestHeaders: phase === 'onBeforeSendHeaders'
        ? (details.requestHeaders || rec.requestHeaders || []).map(h => ({ name: h.name, value: h.value }))
        : null,
      responseHeaders: phase === 'onHeadersReceived'
        ? (details.responseHeaders || []).map(h => ({ name: h.name, value: h.value }))
        : null,
      terminer
    });

    interceptStats.held++;
    store.mark(rec, 'intercept:hold', Date.now(), { phase });
    debug.trace('intercept', 'requete suspendue', { id: rec.id, phase });
    prevenir();
  });
}

/** Etat de la file, pour l interface. */
export function listeAttente() {
  const out = [];
  for (const e of attente.values()) {
    out.push({
      id: e.id, recordId: e.recordId, phase: e.phase, at: e.at,
      method: e.method, url: e.url, host: e.host, type: e.type, tabId: e.tabId,
      statusCode: e.statusCode,
      requestHeaders: e.requestHeaders, responseHeaders: e.responseHeaders
    });
  }
  out.sort((a, b) => a.at - b.at);
  return out;
}

export function enAttente() { return attente.size; }

/**
 * Tranche le sort d une requete suspendue.
 * @param {number} id
 * @param {'forward'|'drop'|'modify'} decision
 * @param {object} [changements] { url, requestHeaders, responseHeaders }
 */
export function resoudre(id, decision, changements = {}) {
  const e = attente.get(Number(id));
  if (!e) return { error: 'cette requete n est plus en attente' };
  const rec = store.get(e.recordId);

  if (decision === 'drop') {
    interceptStats.dropped++;
    if (rec) store.mark(rec, 'intercept:drop', Date.now(), { phase: e.phase });
    e.terminer({ cancel: true });
    return { ok: true, decision: 'drop' };
  }

  if (decision === 'modify') {
    const verdict = {};
    let quoi = [];

    if (e.phase === 'onBeforeSendHeaders') {
      const nouvelleUrl = String(changements.url || '').trim();
      // Une redirection et une reecriture d entetes ne peuvent pas voyager
      // dans la meme reponse : l URL l emporte, les entetes seront rejouees
      // sur la requete redirigee.
      if (nouvelleUrl && nouvelleUrl !== e.url) {
        if (!/^https?:\/\//i.test(nouvelleUrl)) {
          return { error: 'seules les URL http et https sont acceptees' };
        }
        verdict.redirectUrl = nouvelleUrl;
        quoi.push('url');
      } else if (Array.isArray(changements.requestHeaders)) {
        verdict.requestHeaders = nettoyerEntetes(changements.requestHeaders);
        quoi.push('entetes de requete');
      }
    } else if (e.phase === 'onHeadersReceived') {
      if (Array.isArray(changements.responseHeaders)) {
        verdict.responseHeaders = nettoyerEntetes(changements.responseHeaders);
        quoi.push('entetes de reponse');
      }
    }

    if (!quoi.length) {           // rien de modifiable : on laisse passer
      interceptStats.forwarded++;
      e.terminer({});
      return { ok: true, decision: 'forward' };
    }
    interceptStats.modified++;
    if (rec) {
      rec.rulesApplied.push({
        id: 'intercept', name: 'Interception manuelle', action: 'intercept:modify',
        phase: e.phase, to: quoi.join(' + ')
      });
      store.mark(rec, 'intercept:modify', Date.now(), { phase: e.phase, quoi: quoi.join('+') });
    }
    e.terminer(verdict);
    return { ok: true, decision: 'modify', applique: quoi };
  }

  interceptStats.forwarded++;
  if (rec) store.mark(rec, 'intercept:forward', Date.now(), { phase: e.phase });
  e.terminer({});
  return { ok: true, decision: 'forward' };
}

function nettoyerEntetes(liste) {
  const out = [];
  for (const h of liste) {
    const name = String((h && h.name) || '').trim();
    if (!name) continue;
    out.push({ name, value: String((h && h.value) != null ? h.value : '') });
  }
  return out;
}

/** Relache tout : bouton de secours de l interface, et arret de la capture. */
export function relacherTout() {
  const n = attente.size;
  for (const e of [...attente.values()]) {
    interceptStats.released++;
    e.terminer({});
  }
  return n;
}

/* Une console qui se ferme, ou l interception qu on desactive, ne doit jamais
   laisser une requete suspendue derriere elle. */
config.on('change', values => {
  if (!values.interceptEnabled && attente.size) relacherTout();
});
