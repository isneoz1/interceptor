/* Etat du noyau : statistiques agregees et capacites reelles du navigateur.
 * INTERCEPTOR (by D4RK)
 *
 * Separe de rpc.js pour que la collecte d etat reste lisible et reutilisable :
 * le badge, la console et le journal de demarrage s en servent tous.
 */
import { B } from '../lib/util.js';
import { config } from '../core/config.js';
import { store } from '../core/store.js';
import { correlator } from '../core/dedup.js';
import { pageStats, contextLog } from '../ingest/page.js';
import { analyzerStats, customState } from '../core/analyzer.js';
import { filterState } from '../capture/streamfilter.js';
import { securityStats } from '../capture/security.js';
import { dnsStats } from '../capture/dnsinfo.js';
import { proxyStats } from '../capture/proxy.js';
import { probeStats } from '../capture/probe.js';
import { ruleStats } from '../rules/engine.js';
import { persistStats } from '../core/persist.js';
import { saveStats } from '../export/save.js';
import { navLog } from '../capture/navigation.js';
import { cookieLog } from '../capture/cookies.js';
import { replayStats } from './replay.js';

/** Chiffres reels du noyau. Aucune valeur n est estimee ni simulee. */
export function collectStats() {
  return {
    store: { ...store.stats, live: store.order.length },
    dedup: correlator.stats(),
    page: { ...pageStats },
    analyzer: { ...analyzerStats, custom: { ...customState } },
    streamFilter: { ...filterState },
    tls: { ...securityStats },
    dns: { ...dnsStats },
    proxy: { ...proxyStats },
    rules: { ...ruleStats },
    replay: { ...replayStats },
    save: { ...saveStats },
    probe: { ...probeStats },
    persist: { ...persistStats },
    logs: { navigation: navLog.length, cookies: cookieLog.length, context: contextLog.length },
    uptimeMs: Date.now() - store.stats.startedAt,
    capturing: config.get('capturing')
  };
}

/** Disponibilite reelle des API dans ce Firefox : la vue Diagnostic n affiche
 *  que du verifie, jamais une promesse du manifest. */
export function capabilities() {
  const has = (obj, key) => !!(obj && obj[key]);
  return {
    webRequest: has(B, 'webRequest'),
    blocking: !!(B.webRequest && B.webRequest.onBeforeRequest),
    streamFilter: !!(B.webRequest && B.webRequest.filterResponseData),
    securityInfo: !!(B.webRequest && B.webRequest.getSecurityInfo),
    webNavigation: has(B, 'webNavigation'),
    cookies: has(B, 'cookies'),
    dns: !!(B.dns && B.dns.resolve),
    proxy: !!(B.proxy && B.proxy.onRequest),
    downloads: has(B, 'downloads'),
    notifications: has(B, 'notifications'),
    sidebar: has(B, 'sidebarAction'),
    menus: !!(B.menus || B.contextMenus),
    indexedDb: typeof indexedDB !== 'undefined',
    decompression: typeof DecompressionStream !== 'undefined'
  };
}
