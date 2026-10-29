/* ============================================================
 * SWIFT — noyau  (cree par D4RK)
 * Demarrage entierement automatique : aucune action requise.
 * ============================================================ */
import { B } from './lib/util.js';
import { config } from './core/config.js';
import { installerDebug, debug } from './core/debug.js';
import { store } from './core/store.js';
import { correlator } from './core/dedup.js';
import { analyze, analyzerStats } from './core/analyzer.js';
import { startWebRequest } from './capture/webrequest.js';
import { startNavigation } from './capture/navigation.js';
import { startCookies } from './capture/cookies.js';
import { startProxy, stopProxy } from './capture/proxy.js';
import { startPersistence } from './core/persist.js';
import { startRpc, startBroadcast, collectStats } from './api/rpc.js';
import { ouvrirSurface, suivreFenetre, normaliserEmplacement } from './api/surface.js';
import { MENUS_SWIFT } from './api/menus.js';
import { setLang, lang, t, tp } from '../ui/lib/i18n.js';
// Installe la promotion des observations orphelines : une observation sans
// equivalent reseau devient sa propre ligne plutot que d etre perdue.
import './ingest/promote.js';

const BADGE_ON = '#00DDFF';
const BADGE_OFF = '#7A7A8C';
const BADGE_ALERT = '#FF4F5E';
const CONSOLE_URL = B.runtime.getURL('ui/console.html');
const MENUS = B.menus || B.contextMenus;

async function boot() {
  await config.ready;
  // La langue de l interface vaut aussi pour ce que le noyau ecrit : menus,
  // notifications, fichiers exportes.
  setLang(config.get('lang'));

  // 0. Journal de diagnostic : installe avant tout le reste, pour que les
  //    erreurs des couches elles-memes soient capturees des le demarrage.
  installerDebug();

  // 1. Couches de capture — demarrees dans l'ordre du cycle de vie reseau.
  startProxy();          // le plus precoce (optionnel, passif)
  startWebRequest();     // 9 evenements webRequest + corps + TLS
  startNavigation();     // contexte de page
  startCookies();        // mutations de cookies, y compris en JavaScript

  // 2. Correlateur : verification permanente de l'absence de doublons.
  correlator.start();
  debug.trace('noyau', 'couches de capture demarrees');

  // 3. Communication et diffusion temps reel vers les interfaces.
  startRpc();
  startBroadcast();

  // 4. Persistance optionnelle (rechargee au demarrage si activee).
  await startPersistence();

  // 5. Automatisations periodiques et surfaces d'interaction.
  startBadge();
  startAutoAnalysis();
  startNotifications();
  applyIconBehaviour();
  suivreFenetre();
  buildMenus();

  config.on('change', values => {
    const langue = lang();
    setLang(values.lang);
    if (lang() !== langue) titrerMenus();
    if (values.captureProxy) startProxy(); else stopProxy();
    if (values.persist) startPersistence();
    correlator.start();
    applyIconBehaviour();
    updateBadge(true);
  });

  console.info('%cSWIFT actif — cree par D4RK', 'color:#FF6611;font-weight:bold');
  console.info('[SWIFT] console complete :', CONSOLE_URL);
  console.info('[SWIFT] etat initial', collectStats());
}

/* ---------------- Badge : compteur temps reel sur l'icone ---------------- */
let lastBadge = null;
function startBadge() {
  updateBadge(true);
  setInterval(() => updateBadge(false), 1000);
  store.on('clear', () => updateBadge(true));
}

function compactNumber(n) {
  if (n > 99999) return '99k+';
  if (n > 999) return Math.floor(n / 1000) + 'k';
  return String(n || '');
}

function updateBadge(force) {
  const capturing = config.get('capturing');
  const mode = config.get('badgeMode');
  let text = '';
  let color = capturing ? BADGE_ON : BADGE_OFF;

  if (!capturing) text = '||';
  else if (mode === 'alerts') {
    const alerts = analyzerStats.bySeverity.critical + analyzerStats.bySeverity.high;
    text = compactNumber(alerts);
    if (alerts) color = BADGE_ALERT;
  } else if (mode === 'requests') {
    text = compactNumber(store.order.length);
  }

  const signature = text + '|' + color;
  if (!force && signature === lastBadge) return;
  lastBadge = signature;
  try {
    B.browserAction.setBadgeText({ text });
    B.browserAction.setBadgeBackgroundColor({ color });
    if (B.browserAction.setBadgeTextColor) B.browserAction.setBadgeTextColor({ color: '#0B0B14' });
  } catch {}
}

/* ------- Analyse automatique des enregistrements restes en attente ------- */
function startAutoAnalysis() {
  setInterval(() => {
    if (!config.get('analyzerEnabled')) return;
    const cutoff = Date.now() - 30000;
    let done = 0;
    for (let i = store.order.length - 1; i >= 0 && done < 200; i--) {
      const rec = store.records.get(store.order[i]);
      if (!rec) continue;
      if (rec.startTime < cutoff && !rec.analysis) { analyze(rec); done++; }
      if (rec.startTime < cutoff - 120000) break;
    }
  }, 5000);
}

/* ------------- Notification bureau sur alerte critique (option) ----------- */
function startNotifications() {
  store.on('finalize', async rec => {
    if (!config.get('notifyCritical')) return;
    const risk = rec.analysis && rec.analysis.risk;
    if (risk !== 'critical') return;
    if (!B.notifications) return;
    try {
      const granted = await B.permissions.contains({ permissions: ['notifications'] });
      if (!granted) return;
      const first = rec.analysis.findings.find(f => f.severity === 'critical');
      await B.notifications.create('swift-' + rec.id, {
        type: 'basic',
        iconUrl: B.runtime.getURL('icons/icon.svg'),
        title: t('SWIFT — alerte critique'),
        message: (first ? t(first.title) : t('Alerte critique')) + '\n' + rec.method + ' ' + rec.host
      });
    } catch {}
  });
}

/* ---------------- Comportement du clic sur l icone (option) -------------- */
function applyIconBehaviour() {
  const emplacement = normaliserEmplacement(config.get('iconOpens'));
  try {
    // Un popup vide rend le clic « cliquable » : onClicked prend alors le relais
    // et ouvre l onglet, le panneau lateral ou la fenetre detachee.
    B.browserAction.setPopup({ popup: emplacement === 'popup' ? 'ui/popup.html' : '' });
  } catch {}
}

if (B.browserAction && B.browserAction.onClicked) {
  B.browserAction.onClicked.addListener(() => openConsole());
}

/* -------------------------- Menus contextuels ---------------------------- */
function buildMenus() {
  if (!MENUS) return;
  try { MENUS.removeAll(); } catch {}
  for (const [id, title, contexts] of MENUS_SWIFT) {
    try { MENUS.create({ id, title: t(title), contexts }); } catch {}
  }

  if (!MENUS.onClicked) return;
  MENUS.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === 'ic-console') return openConsole();
    if (info.menuItemId === 'ic-console-tab') {
      const host = hostOfUrl(tab && tab.url);
      return openConsole({ view: 'requests', query: host ? 'host:' + host : null });
    }
    if (info.menuItemId === 'ic-toggle') {
      await config.set({ capturing: !config.get('capturing') });
      return updateBadge(true);
    }
    if (info.menuItemId === 'ic-block-host') {
      const host = hostOfUrl(info.linkUrl || info.srcUrl || info.pageUrl || (tab && tab.url));
      if (!host) return;
      const rules = [...(config.get('rules') || [])];
      const id = 'block-' + host;
      if (!rules.some(r => r.id === id)) {
        rules.push({ id, enabled: true, name: tp('Bloquer {hote}', { hote: host }), match: { host }, action: 'block' });
        await config.set({ rules, rulesEnabled: true });
      }
    }
  });
}

/* Les menus deja crees changent de langue avec l interface. */
function titrerMenus() {
  if (!MENUS || !MENUS.update) return;
  for (const [id, title] of MENUS_SWIFT) {
    try { MENUS.update(id, { title: t(title) }); } catch {}
  }
}

function hostOfUrl(url) {
  try { return new URL(url).host; } catch { return ''; }
}

/** L emplacement est celui que l utilisateur a choisi ; `forcer` le contourne. */
async function openConsole(intent, forcer) {
  const r = await ouvrirSurface(intent || null, forcer || null);
  if (!r.ok) console.warn('[SWIFT] ouverture de la console impossible', r.erreur);
  return r;
}

/* ----------------------------- Raccourcis ------------------------------- */
if (B.commands && B.commands.onCommand) {
  B.commands.onCommand.addListener(async name => {
    if (name === 'open-console') return openConsole(null, 'onglet');
    if (name === 'toggle-capture') {
      await config.set({ capturing: !config.get('capturing') });
      updateBadge(true);
    }
  });
}

B.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    console.info('[SWIFT] installe — la capture demarre automatiquement.');
    openConsole({ view: 'help' });
  }
});

boot().catch(e => console.error('[SWIFT] echec de demarrage', e));
