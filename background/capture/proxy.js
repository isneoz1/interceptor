/* Couche proxy (proxy.onRequest / proxy.onError) — INTERCEPTOR (by NeoZ)
 *
 * Point d'observation le PLUS precoce de Firefox : declenche avant meme
 * onBeforeRequest, et donne la decision de proxy appliquee a chaque requete.
 *
 * ATTENTION : ce listener participe a la resolution de proxy du navigateur.
 * Il est donc strictement passif (il ne retourne jamais de ProxyInfo, laissant
 * Firefox appliquer sa configuration par defaut) et reste desactive par defaut :
 * il n'apporte AUCUNE requete que webRequest ne voit deja, uniquement des
 * metadonnees de routage.
 */
import { B } from '../lib/util.js';
import { config } from '../core/config.js';
import { store } from '../core/store.js';

export const proxyStats = { observed: 0, errors: 0, enabled: false };

const pendingProxyInfo = new Map();   // requestId -> infos observees avant le record
let listener = null;
let errorListener = null;

export function startProxy() {
  if (listener || !B.proxy || !B.proxy.onRequest) return;
  if (!config.get('captureProxy')) return;

  listener = details => {
    if (!config.get('capturing')) return;
    proxyStats.observed++;
    const info = {
      ts: details.timeStamp || Date.now(),
      type: details.type,
      method: details.method,
      url: details.url,
      tabId: details.tabId,
      frameId: details.frameId,
      cookieStoreId: details.cookieStoreId || null,
      incognito: !!details.incognito,
      proxyInfo: details.proxyInfo || null
    };
    const rec = store.byRid(details.requestId);
    if (rec) { rec.proxy = info; store.addSource(rec, 'proxy'); store.touch(rec.id); }
    else {
      pendingProxyInfo.set(details.requestId, info);
      if (pendingProxyInfo.size > 5000) {
        const oldest = pendingProxyInfo.keys().next().value;
        pendingProxyInfo.delete(oldest);
      }
    }
    // Aucun retour : Firefox conserve integralement sa configuration de proxy.
  };

  errorListener = err => { proxyStats.errors++; console.warn('[INTERCEPTOR] proxy error', err); };

  B.proxy.onRequest.addListener(listener, { urls: ['<all_urls>'] });
  if (B.proxy.onError) B.proxy.onError.addListener(errorListener);
  proxyStats.enabled = true;
  console.info('[INTERCEPTOR] proxy.onRequest actif (observation passive)');
}

export function stopProxy() {
  if (listener && B.proxy && B.proxy.onRequest) B.proxy.onRequest.removeListener(listener);
  if (errorListener && B.proxy && B.proxy.onError) B.proxy.onError.removeListener(errorListener);
  listener = null; errorListener = null;
  proxyStats.enabled = false;
}

/** Consomme l'info proxy memorisee avant l'existence du record. */
export function drainProxyInfo(rec) {
  if (rec.requestId == null) return;
  const info = pendingProxyInfo.get(rec.requestId);
  if (info) {
    rec.proxy = info;
    store.addSource(rec, 'proxy');
    pendingProxyInfo.delete(rec.requestId);
  }
}
