/* Resolution DNS (nom canonique + adresses) — INTERCEPTOR (by D4RK)
 * Cache par hote : une seule resolution, quel que soit le volume de requetes.
 */
import { B } from '../lib/util.js';
import { store } from '../core/store.js';

const cache = new Map();     // host -> {addresses, canonicalName, ts} | Promise
export const dnsStats = { resolved: 0, failed: 0, cached: 0 };

const SKIP = /^(localhost|127\.|::1|0\.0\.0\.0|\[)/i;

export function resolveHost(rec) {
  const host = rec.host;
  if (!host || SKIP.test(host) || !B.dns || !B.dns.resolve) return;

  const hit = cache.get(host);
  if (hit && !(hit instanceof Promise)) {
    dnsStats.cached++;
    rec.dns = hit;
    return;
  }
  if (hit instanceof Promise) { hit.then(v => { if (v) { rec.dns = v; store.touch(rec.id); } }); return; }

  const p = B.dns.resolve(host, ['canonical_name'])
    .then(res => {
      const value = {
        addresses: res.addresses || [],
        canonicalName: res.canonicalName || null,
        ts: Date.now()
      };
      cache.set(host, value);
      dnsStats.resolved++;
      rec.dns = value;
      store.touch(rec.id);
      return value;
    })
    .catch(() => { cache.delete(host); dnsStats.failed++; return null; });

  cache.set(host, p);
}

export function clearDnsCache() { cache.clear(); }
