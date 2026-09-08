/* Pont de communication content script <-> coeur <-> interface
 * INTERCEPTOR (by NeoZ)
 *
 * Durcissement :
 *   - toute commande d'interface exige un expediteur interne a l'extension ;
 *   - les lots venant d'une page sont acceptes uniquement s'ils proviennent
 *     d'un content script (sender.tab present) et sont traites en donnees inertes ;
 *   - aucune commande n'evalue de code.
 *
 * Une seule sortie reseau existe dans tout le projet : la commande `replay`,
 * desactivee par defaut et toujours declenchee par un clic explicite.
 */
import { B } from '../lib/util.js';
import { correlator } from '../core/dedup.js';
import { purge, countStored } from '../core/persist.js';
import { runProbe } from '../capture/probe.js';
import { analyze, analyzeAll } from '../core/analyzer.js';
import { clearSecurityCache } from '../capture/security.js';
import { clearDnsCache } from '../capture/dnsinfo.js';
import { ingestBatch, contextLog, clearPageState } from '../ingest/page.js';
import { invalidateRuleCache } from '../rules/engine.js';
import { configurerIntercepteur, relacherTout } from '../rules/intercept.js';
import { replay } from './replay.js';
import { collectStats, capabilities } from './status.js';
import { FILE_COMMANDS } from './files.js';
import { TOOLING_COMMANDS } from './tooling.js';
import { SURFACE_COMMANDS, ouvrirSurface } from './surface.js';
import { config, DEFAULTS } from '../core/config.js';
import { journal } from '../core/debug.js';
import { store, detail, summarize } from '../core/store.js';
import { generate } from '../export/codegen.js';
import { navLog, clearNavLog } from '../capture/navigation.js';
import { cookieLog, clearCookieLog } from '../capture/cookies.js';

const ports = new Set();
const EXT_PREFIX = B.runtime.getURL('');
const CONSOLE_URL = B.runtime.getURL('ui/console.html');

function isInternal(sender) {
  return !!sender && typeof sender.url === 'string' && sender.url.startsWith(EXT_PREFIX);
}

export { collectStats, capabilities };

/* L intercepteur ne retient une requete que si une console est ouverte pour la
   relacher, et previent l interface des qu une requete entre ou sort de la file. */
configurerIntercepteur({
  hasListener: () => ports.size > 0,
  notify: () => broadcast({ t: 'intercept' })
});

/* ------------------------------ Diffusion ------------------------------ */
export function startBroadcast() {
  store.on('delta', list => broadcast({ t: 'delta', records: list }));
  store.on('clear', () => broadcast({ t: 'cleared' }));
  store.on('removed', ids => broadcast({ t: 'removed', ids }));
  store.on('evict', id => broadcast({ t: 'removed', ids: [id] }));
  config.on('change', values => broadcast({ t: 'config', config: values }));
  setInterval(() => { if (ports.size) broadcast({ t: 'stats', stats: collectStats() }); }, 1000);
}

function broadcast(msg) {
  for (const port of ports) {
    try { port.postMessage(msg); } catch { ports.delete(port); }
  }
}

/* --------------------------- Commandes interface --------------------------- */
const COMMANDS = {
  ...FILE_COMMANDS,
  ...TOOLING_COMMANDS,
  ...SURFACE_COMMANDS,

  snapshot: ({ tabId = null, limit = 0 }) => ({
    records: store.recent(limit && limit > 0 ? limit : Infinity, tabId),
    stats: collectStats(),
    config: config.values,
    capabilities: capabilities()
  }),

  record: ({ id }) => {
    const rec = store.get(id);
    if (!rec) return { error: 'introuvable' };
    if (!rec.analysis) analyze(rec);
    return { record: detail(rec) };
  },

  clear: () => {
    // Remise a zero complete : donnees, index de correlation, journaux et caches.
    store.clear();
    correlator.clear();
    clearPageState();
    clearNavLog();
    clearCookieLog();
    clearDnsCache();
    clearSecurityCache();
    return { ok: true };
  },

  deleteRecords: ({ ids }) => {
    if (!Array.isArray(ids) || !ids.length) return { error: 'aucun identifiant fourni' };
    return { ok: true, removed: store.remove(ids.map(Number)) };
  },

  flagRecord: ({ id, flag }) => {
    const rec = store.get(id);
    if (!rec) return { error: 'introuvable' };
    rec.flag = flag === undefined ? !rec.flag : !!flag;
    store.touch(rec.id);
    return { ok: true, flag: rec.flag };
  },

  getConfig: () => ({ config: config.values, defaults: DEFAULTS }),

  setConfig: async ({ patch }) => {
    if (!patch || typeof patch !== 'object') return { error: 'patch invalide' };
    const safe = {};
    for (const k of Object.keys(patch)) if (k in DEFAULTS) safe[k] = patch[k];
    if (!Object.keys(safe).length) return { error: 'aucun reglage connu dans la demande' };
    if ('rules' in safe) invalidateRuleCache();
    await config.set(safe);
    return { config: config.values };
  },

  resetConfig: async () => { await config.reset(); invalidateRuleCache(); return { config: config.values }; },

  /** Import d une configuration complete (fichier JSON colle dans l interface). */
  importConfig: async ({ values }) => {
    if (!values || typeof values !== 'object') return { error: 'contenu invalide' };
    const safe = {};
    const unknown = [];
    for (const [k, v] of Object.entries(values)) {
      if (k in DEFAULTS) safe[k] = v; else unknown.push(k);
    }
    if (!Object.keys(safe).length) return { error: 'aucun reglage reconnu' };
    invalidateRuleCache();
    await config.set(safe);
    return { config: config.values, applied: Object.keys(safe).length, ignored: unknown };
  },

  toggleCapture: async ({ value }) => {
    const next = typeof value === 'boolean' ? value : !config.get('capturing');
    await config.set({ capturing: next });
    return { capturing: next };
  },

  stats: () => ({ stats: collectStats() }),

  capabilities: () => ({ capabilities: capabilities() }),

  about: () => {
    const m = B.runtime.getManifest();
    return {
      name: m.name, version: m.version, author: m.author,
      startedAt: store.stats.startedAt,
      uptimeMs: Date.now() - store.stats.startedAt,
      consoleUrl: CONSOLE_URL,
      capabilities: capabilities()
    };
  },

  /** Liste des onglets ouverts : sert au selecteur de perimetre de la console. */
  tabsList: async () => {
    try {
      const tabs = await B.tabs.query({});
      return {
        tabs: tabs.map(t => ({
          id: t.id, title: t.title || '', url: t.url || '',
          active: !!t.active, incognito: !!t.incognito, windowId: t.windowId
        }))
      };
    } catch (e) { return { error: String(e && e.message || e) }; }
  },

  /** Ouvre la console a l emplacement choisi par l utilisateur. */
  openConsole: async ({ view = null, query = null, id = null, emplacement = null }) => {
    const r = await ouvrirSurface({ view, query, id }, emplacement);
    return r.ok ? { ok: true, reused: !!r.reutilise, emplacement: r.emplacement }
                : { error: r.erreur || 'ouverture impossible' };
  },

  /** Intention de navigation deposee par un menu contextuel ou la popup. */
  takeIntent: async () => {
    try {
      const got = await B.storage.local.get('consoleIntent');
      if (got && got.consoleIntent) {
        await B.storage.local.remove('consoleIntent');
        return { intent: got.consoleIntent };
      }
    } catch {}
    return { intent: null };
  },

  logs: ({ kind, limit = 5000 }) => {
    const src = kind === 'navigation' ? navLog : kind === 'cookies' ? cookieLog : contextLog;
    return { entries: src.slice(-limit), total: src.length };
  },

  clearLogs: ({ kind }) => {
    if (kind === 'navigation') clearNavLog();
    else if (kind === 'cookies') clearCookieLog();
    else if (kind === 'context') contextLog.length = 0;
    else { clearNavLog(); clearCookieLog(); contextLog.length = 0; }
    return { ok: true };
  },

  /** Alertes de tout le magasin, mises a plat pour la vue Securite. */
  findings: ({ tabId = null, severity = null, limit = 5000 }) => {
    const out = [];
    const counts = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
    for (let i = store.order.length - 1; i >= 0 && out.length < limit; i--) {
      const rec = store.records.get(store.order[i]);
      if (!rec || !rec.analysis || !rec.analysis.findings.length) continue;
      if (tabId != null && rec.tabId !== tabId) continue;
      for (const f of rec.analysis.findings) {
        counts[f.severity] = (counts[f.severity] || 0) + 1;
        if (severity && f.severity !== severity) continue;
        out.push({
          id: rec.id, severity: f.severity, rule: f.rule, title: f.title,
          where: f.where, sample: f.sample || '',
          method: rec.method, url: rec.finalUrl || rec.url, host: rec.host,
          statusCode: rec.statusCode, startTime: rec.startTime
        });
      }
    }
    return { findings: out, counts };
  },

  analyzeAll: () => ({ ok: true, analyzed: analyzeAll(), stats: collectStats() }),

  codegen: ({ id, kind }) => {
    const rec = store.get(id);
    if (!rec) return { error: 'introuvable' };
    try { return { code: generate(kind, rec) }; }
    catch (e) { return { error: String(e.message || e) }; }
  },

  search: ({ query, limit = 500 }) => {
    const raw = String(query || '').trim();
    if (!raw) return { records: [] };
    const q = raw.toLowerCase();

    // Une recherche ecrite entre barres obliques est traitee comme une
    // expression reguliere, exactement comme dans le filtre du tableau.
    let re = null;
    const asRegex = /^\/(.+)\/([a-z]*)$/.exec(raw);
    if (asRegex) {
      try { re = new RegExp(asRegex[1], asRegex[2] || 'i'); }
      catch { re = null; }
    }
    const hit = hay => (re ? re.test(hay) : hay.toLowerCase().includes(q));

    const out = [];
    for (let i = store.order.length - 1; i >= 0 && out.length < limit; i--) {
      const rec = store.records.get(store.order[i]);
      if (!rec) continue;
      const hay = [
        rec.url, rec.method, rec.mime, rec.host,
        rec.requestBody && rec.requestBody.text,
        rec.responseBody && rec.responseBody.text,
        JSON.stringify(rec.requestHeaders || []),
        JSON.stringify(rec.responseHeaders || []),
        rec.ws ? rec.ws.frames.map(f => f.data).join('\n') : '',
        rec.sse ? rec.sse.messages.map(m => m.data).join('\n') : '',
        rec.stack || ''
      ].filter(Boolean).join('\n');
      if (hit(hay)) out.push(summarize(rec));
    }
    return { records: out.reverse() };
  },

  /* Verification de couverture : declenche de vraies requetes dans l onglet
     actif, vers sa propre origine uniquement. */
  probe: async () => runProbe(),

  replay: async args => replay(args || {}),

  purgeStorage: async () => purge(),

  storageCount: async () => ({ count: await countStored() })
};

function pickRecords(ids, tabId) {
  if (ids && ids.length) return ids.map(id => store.get(id)).filter(Boolean);
  const all = store.all();
  return tabId == null ? all : all.filter(r => r.tabId === tabId);
}

/* Les commandes du journal ne se tracent pas elles-memes : la vue Diagnostic
   interne interroge le noyau chaque seconde, et s auto-tracer noierait le
   journal sous ses propres lectures. */
const HORS_TRACE = new Set(['debugJournal', 'clearDebug', 'debugNote']);

function tracerCommande(nom, debut, res) {
  if (config.get('debugCaptureRpc') && !HORS_TRACE.has(nom)) {
    const duree = Date.now() - debut;
    const erreur = res && res.error ? String(res.error) : null;
    journal.note(erreur ? 'warn' : 'trace', 'commande',
                 nom + ' — ' + duree + ' ms' + (erreur ? ' — ' + erreur : ''),
                 { commande: nom, dureeMs: duree, erreur });
    journal.mesure(nom, duree, erreur);
  }
  return res;
}

/* ------------------------------- Ecoute ------------------------------- */
export function startRpc() {
  B.runtime.onMessage.addListener((msg, sender) => {
    if (!msg || typeof msg !== 'object') return;

    // 1. Lot d'observations venant d'un content script.
    if (msg.t === 'batch') {
      if (!sender || !sender.tab) return Promise.resolve({ ok: false, reason: 'origine invalide' });
      if (!Array.isArray(msg.batch)) return Promise.resolve({ ok: false, reason: 'lot invalide' });
      return Promise.resolve(ingestBatch(msg.batch, sender));
    }

    // 2. Le content script demande s'il doit s'activer.
    if (msg.t === 'hello') {
      return Promise.resolve({
        capturing: config.get('capturing') && config.get('capturePageHooks'),
        options: config.pageOptions()
      });
    }

    // 3. Commandes d'interface : reservees aux pages de l'extension.
    if (msg.t === 'cmd') {
      if (!isInternal(sender)) return Promise.resolve({ error: 'acces refuse' });
      const fn = COMMANDS[msg.cmd];
      if (!fn) return Promise.resolve({ error: 'commande inconnue : ' + msg.cmd });

      const debut = Date.now();
      try {
        return Promise.resolve(fn(msg.args || {}))
          .then(res => tracerCommande(msg.cmd, debut, res))
          .catch(e => {
            console.error('[INTERCEPTOR] cmd', msg.cmd, e);
            return tracerCommande(msg.cmd, debut, { error: String(e && e.message || e) });
          });
      } catch (e) {
        console.error('[INTERCEPTOR] cmd', msg.cmd, e);
        return Promise.resolve(tracerCommande(msg.cmd, debut, { error: String(e && e.message || e) }));
      }
    }
  });

  B.runtime.onConnect.addListener(port => {
    if (port.name !== 'interceptor-ui') return;
    if (!isInternal(port.sender)) { try { port.disconnect(); } catch {} return; }
    ports.add(port);
    port.onDisconnect.addListener(() => {
      ports.delete(port);
      // Derniere console fermee : plus personne ne peut trancher, on relache
      // tout plutot que de laisser une navigation suspendue.
      if (!ports.size) relacherTout();
    });
    try {
      port.postMessage({ t: 'hello', stats: collectStats(), config: config.values, capabilities: capabilities() });
    } catch { ports.delete(port); }
  });
}
