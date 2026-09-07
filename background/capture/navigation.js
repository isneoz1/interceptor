/* Contexte de navigation (webNavigation, 7 evenements) — INTERCEPTOR (by D4RK)
 * Fournit le contexte de page : qui a declenche quoi, transitions, erreurs,
 * navigations d'historique et fragments — invisible pour webRequest.
 */
import { B } from '../lib/util.js';
import { config } from '../core/config.js';
import { Emitter } from '../lib/emitter.js';
import { store } from '../core/store.js';

export const navEvents = new Emitter();

/** Journal des evenements de navigation, sans doublon (cle evenement+tab+frame+url+ts). */
export const navLog = [];
const navKeys = new Set();
let started = false;

function push(kind, d, extra) {
  if (!config.get('capturing') || !config.get('captureNavigation')) return;
  const key = kind + '|' + d.tabId + '|' + d.frameId + '|' + d.url + '|' + Math.round(d.timeStamp || 0);
  if (navKeys.has(key)) return;
  navKeys.add(key);
  const entry = {
    kind,
    tabId: d.tabId,
    frameId: d.frameId,
    parentFrameId: d.parentFrameId != null ? d.parentFrameId : -1,
    url: d.url,
    ts: d.timeStamp || Date.now(),
    ...(extra || {})
  };
  navLog.push(entry);
  navEvents.emit('nav', entry);
}

export function startNavigation() {
  if (started || !B.webNavigation) return;
  started = true;
  const wn = B.webNavigation;

  wn.onBeforeNavigate.addListener(d => push('beforeNavigate', d));
  wn.onCommitted.addListener(d => {
    push('committed', d, { transitionType: d.transitionType, transitionQualifiers: d.transitionQualifiers });
    // Option « vider a la navigation » : seules les lignes de l onglet qui
    // navigue sont retirees, et uniquement sur une navigation de page entiere.
    if (d.frameId === 0 && config.get('clearOnNavigate')) {
      const doomed = [];
      for (const id of store.order) {
        const rec = store.records.get(id);
        if (rec && rec.tabId === d.tabId && rec.startTime < (d.timeStamp || Date.now())) doomed.push(id);
      }
      if (doomed.length) store.remove(doomed);
    }
  });
  wn.onDOMContentLoaded.addListener(d => push('domContentLoaded', d));
  wn.onCompleted.addListener(d => push('completed', d));
  wn.onErrorOccurred.addListener(d => push('error', d, { error: d.error }));
  wn.onCreatedNavigationTarget.addListener(d => push('newTarget', d, { sourceTabId: d.sourceTabId, sourceFrameId: d.sourceFrameId }));
  wn.onReferenceFragmentUpdated.addListener(d => push('fragmentUpdated', d, { transitionType: d.transitionType }));
  wn.onHistoryStateUpdated.addListener(d => push('historyStateUpdated', d, { transitionType: d.transitionType }));

  console.info('[INTERCEPTOR] webNavigation actif — 8 evenements');
}

export function clearNavLog() { navLog.length = 0; navKeys.clear(); }
