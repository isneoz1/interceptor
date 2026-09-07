/* Mutations de cookies (cookies.onChanged) — INTERCEPTOR (by D4RK)
 * Capture aussi les cookies poses en JavaScript, invisibles dans Set-Cookie.
 */
import { B } from '../lib/util.js';
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { Emitter } from '../lib/emitter.js';

export const cookieEvents = new Emitter();
export const cookieLog = [];
const seen = new Set();
let started = false;

export function startCookies() {
  if (started || !B.cookies || !B.cookies.onChanged) return;
  started = true;

  B.cookies.onChanged.addListener(change => {
    if (!config.get('capturing') || !config.get('captureCookies')) return;
    const c = change.cookie || {};
    const key = [change.cause, change.removed, c.domain, c.path, c.name, c.value, c.storeId].join('|');
    if (seen.has(key)) return;      // anti-doublon strict
    seen.add(key);
    if (seen.size > 200000) seen.clear();

    const entry = {
      ts: Date.now(),
      cause: change.cause,
      removed: !!change.removed,
      name: c.name,
      value: c.value,
      domain: c.domain,
      path: c.path,
      secure: !!c.secure,
      httpOnly: !!c.httpOnly,
      sameSite: c.sameSite || null,
      session: !!c.session,
      expirationDate: c.expirationDate || null,
      storeId: c.storeId || null,
      firstPartyDomain: c.firstPartyDomain || null,
      partitionKey: c.partitionKey || null
    };
    cookieLog.push(entry);
    cookieEvents.emit('cookie', entry);
    attachToRecentRecord(entry);
  });

  console.info('[INTERCEPTOR] cookies.onChanged actif');
}

/** Rattache la mutation a la requete la plus recente du meme domaine (fenetre 3 s). */
function attachToRecentRecord(entry) {
  const domain = String(entry.domain || '').replace(/^\./, '');
  if (!domain) return;
  const cutoff = entry.ts - 3000;
  for (let i = store.order.length - 1; i >= 0; i--) {
    const rec = store.records.get(store.order[i]);
    if (!rec) continue;
    if (rec.startTime < cutoff) break;
    if (rec.host === domain || rec.host.endsWith('.' + domain)) {
      if (!rec.cookies.changed.some(c => c.name === entry.name && c.ts === entry.ts)) {
        rec.cookies.changed.push(entry);
        store.touch(rec.id);
      }
      return;
    }
  }
}

export function clearCookieLog() { cookieLog.length = 0; seen.clear(); }
