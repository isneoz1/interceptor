/* Vue « Diagnostic » — INTERCEPTOR (by NeoZ)
 * Chiffres lus en direct dans le noyau : rien n est simule, rien n est estime.
 */
import { $, el, clear, sec, grid, button, vide } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { bytes, uptime, ms } from '../lib/format.js';
import { state, cmd, toast } from '../app.js';

let about = null;
let probeStatus = null;
let storageStatus = null;

/* Couches : reglage, disponibilite reelle de l API, activite mesuree. */
function layerRows(s, caps, config) {
  const yn = v => t(v ? 'oui' : 'non');
  /* Les valeurs composees passent par un gabarit : « oui · API oui » assemble
     a coups de « + » ne correspondrait a aucune cle et resterait en francais. */
  const avecApi = (reglage, api) => tp('{r} · API {a}', { r: yn(reglage), a: yn(api) });
  return [
    ['webRequest (9 evenements)', avecApi(config.captureWebRequest, caps.webRequest), config.captureWebRequest && caps.webRequest ? 'ok' : 'warn'],
    ['Corps de reponse (StreamFilter)', avecApi(config.captureResponseBodies, caps.streamFilter), caps.streamFilter ? 'ok' : 'ko'],
    ['Sondes du monde page', tp('{r} · {n} evenements', { r: yn(config.capturePageHooks), n: s.page.events }), config.capturePageHooks ? 'ok' : 'warn'],
    ['Trames WebSocket', tp('{r} · {n} trames', { r: yn(config.captureWebSocketFrames), n: s.page.frames }), config.captureWebSocketFrames ? 'ok' : 'warn'],
    ['Server-Sent Events', yn(config.captureSse), config.captureSse ? 'ok' : 'warn'],
    ['PerformanceObserver', yn(config.capturePerformance), config.capturePerformance ? 'ok' : 'warn'],
    ['TLS et certificats', avecApi(config.captureSecurityInfo, caps.securityInfo), caps.securityInfo ? 'ok' : 'ko'],
    ['Resolution DNS', avecApi(config.captureDns, caps.dns), caps.dns ? 'ok' : 'ko'],
    ['Navigation', avecApi(config.captureNavigation, caps.webNavigation), caps.webNavigation ? 'ok' : 'ko'],
    ['Cookies', avecApi(config.captureCookies, caps.cookies), caps.cookies ? 'ok' : 'ko'],
    ['Proxy (facultatif)', avecApi(config.captureProxy, caps.proxy), config.captureProxy ? 'ok' : null],
    ['Piles JavaScript', yn(config.captureStacks), config.captureStacks ? 'ok' : 'warn'],
    ['Cookies poses en JavaScript', yn(config.captureJsCookies), config.captureJsCookies ? 'ok' : 'warn'],
    ['WebTransport', yn(config.captureWebTransport), config.captureWebTransport ? 'ok' : 'warn'],
    ['Mesures de perception de page', yn(config.capturePageVitals), config.capturePageVitals ? 'ok' : 'warn'],
    ['WebRTC', yn(config.captureWebRtc), config.captureWebRtc ? 'ok' : 'warn'],
    ['Workers et Service Workers', yn(config.captureWorkers), config.captureWorkers ? 'ok' : 'warn'],
    ['Decompression gzip / deflate', yn(caps.decompression), caps.decompression ? 'ok' : 'warn'],
    ['Persistance IndexedDB', avecApi(config.persist, caps.indexedDb), config.persist ? 'ok' : null],
    ['Notifications bureau', avecApi(config.notifyCritical, caps.notifications), config.notifyCritical ? 'ok' : null],
    ['Moteur de regles', tp('{r} · {n} regle(s)', { r: yn(config.rulesEnabled), n: (config.rules || []).length }), config.rulesEnabled ? 'warn' : null],
    ['Rejeu autorise', yn(config.replayEnabled), config.replayEnabled ? 'warn' : null]
  ];
}

export function render() {
  const pane = clear($('#view-stats'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  const s = state.stats;
  const caps = state.caps || {};
  const config = state.config || {};

  if (!about) {
    cmd('about', {}).then(res => { if (res && !res.error) { about = res; if (state.view === 'stats') render(); } });
  }
  if (!s) {
    box.appendChild(vide('En attente du noyau', 'Connexion en cours…'));
    return;
  }

  /* --- Bandeau de chiffres cles --- */
  const tiles = el('div', { class: 'tiles' });
  const tile = (value, label, cls) => tiles.appendChild(
    el('div', { class: 'tile' + (cls ? ' ' + cls : '') }, [el('b', { text: String(value) }), el('label', { text: t(label) })]));
  tile(s.store.total, 'enregistrees');
  tile(s.store.live, 'en memoire');
  tile(s.store.complete, 'terminees', 'ok');
  tile(s.store.errors, 'en erreur', s.store.errors ? 'alert hot' : '');
  tile(s.dedup.merged, 'fusions');
  tile(s.analyzer.findings, 'alertes', s.analyzer.bySeverity.critical ? 'alert hot' : 'alert');
  tile(bytes(s.store.bytesDown), 'entrant');
  tile(bytes(s.store.bytesUp), 'sortant');
  box.appendChild(tiles);

  const cols = el('div', { class: 'cols2' });
  box.appendChild(cols);

  /* --- Extension --- */
  const left = el('div');
  cols.appendChild(left);
  if (about) {
    left.appendChild(sec('Extension'));
    left.appendChild(grid([
      ['Version', about.version],
      ['Auteur', about.author],
      ['Actif depuis', uptime(Date.now() - about.startedAt)],
      ['Etat', t(s.capturing ? 'CAPTURE ACTIVE' : 'EN PAUSE'), s.capturing ? 'ok' : 'warn']
    ]));
  }

  left.appendChild(sec('Anti-doublon'));
  left.appendChild(grid([
    ['Fusions realisees', s.dedup.merged, 'ok'],
    ['Signatures suivies', s.dedup.signatures],
    ['Cles URL', s.dedup.urlKeys],
    ['Observations en attente', s.dedup.pending],
    ['Fenetre de correlation', (config.dedupWindowMs || 0) + ' ms'],
    ['Balayage', (config.dedupSweepMs || 0) + ' ms']
  ]));

  left.appendChild(sec('Corps de reponse'));
  left.appendChild(grid([
    ['StreamFilter', t(s.streamFilter.supported ? 'disponible' : 'indisponible'), s.streamFilter.supported ? 'ok' : 'ko'],
    ['Point d ancrage', s.streamFilter.anchor],
    ['Corps captures', s.streamFilter.captured],
    ['Reponses simulees', s.streamFilter.mocked || 0, s.streamFilter.mocked ? 'warn' : null],
    ['Echecs', s.streamFilter.failed, s.streamFilter.failed ? 'warn' : null],
    ['Filtres actifs', s.streamFilter.active]
  ]));

  left.appendChild(sec('Sondes du monde page'));
  left.appendChild(grid([
    ['Evenements recus', s.page.events],
    ['Fusionnes', s.page.merged, 'ok'],
    ['Promus en ligne autonome', s.page.promoted],
    ['Trames et messages', s.page.frames]
  ]));

  /* --- Colonne droite --- */
  const right = el('div');
  cols.appendChild(right);

  right.appendChild(sec('Etat des couches', 'reglage · API'));
  right.appendChild(grid(layerRows(s, caps, config), 'minmax(150px,1fr) auto'));

  right.appendChild(sec('Couches complementaires'));
  right.appendChild(grid([
    ['TLS interroges', tp('{n} (cache {c})', { n: s.tls.queried, c: s.tls.cached })],
    ['TLS en echec', s.tls.failed, s.tls.failed ? 'warn' : null],
    ['DNS resolus', tp('{n} (cache {c})', { n: s.dns.resolved, c: s.dns.cached })],
    ['DNS en echec', s.dns.failed, s.dns.failed ? 'warn' : null],
    ['Proxy', s.proxy.enabled ? tp('{n} observations', { n: s.proxy.observed }) : t('desactive')],
    ['Regles', tp('{b} bloquees · {r} redirigees · {h} forcees en https · {e} entetes · {s} simulees', {
      b: s.rules.blocked, r: s.rules.redirected, h: s.rules.upgraded || 0,
      e: s.rules.headersModified, s: s.rules.mocked || 0 })],
    ['Regles : latence', tp('{n} retardees · {d} au total', {
      n: s.rules.delayed || 0, d: ms(s.rules.delayMsTotal || 0) }), s.rules.delayed ? 'warn' : null],
    ['Regles : substitutions', tp('{a} appliquees · {e} ecartees', {
      a: s.rules.replaced || 0, e: s.rules.replaceSkipped || 0 }),
                 (s.rules.replaced || s.rules.replaceSkipped) ? 'warn' : null],
    ['Rejeux', tp('{e} envoyes · {f} echoues', { e: s.replay.sent, f: s.replay.failed })],
    ['Fichiers exportes', tp('{n} ({t})', { n: s.save.files, t: bytes(s.save.bytes) })],
    ['Persistance', s.persist.enabled
      ? tp('{e} ecrits · {r} restaures', { e: s.persist.written, r: s.persist.restored })
      : t('desactivee')],
    ['Journaux', tp('{n} nav · {c} cookies · {x} contexte', {
      n: s.logs.navigation, c: s.logs.cookies, x: s.logs.context })]
  ]));

  right.appendChild(sec('Analyse automatique'));
  right.appendChild(grid([
    ['Requetes analysees', s.analyzer.analyzed],
    ['Alertes', s.analyzer.findings, s.analyzer.findings ? 'warn' : 'ok'],
    ['Critiques', s.analyzer.bySeverity.critical, s.analyzer.bySeverity.critical ? 'ko' : null],
    ['Elevees', s.analyzer.bySeverity.high, s.analyzer.bySeverity.high ? 'warn' : null],
    ['Moyennes', s.analyzer.bySeverity.medium],
    ['Faibles', s.analyzer.bySeverity.low],
    ['Information', s.analyzer.bySeverity.info],
    ['Motifs personnels', s.analyzer.custom ? s.analyzer.custom.patterns : 0],
    ['Pisteurs ajoutes', s.analyzer.custom ? s.analyzer.custom.trackers : 0]
  ]));
  const invalid = s.analyzer.custom && s.analyzer.custom.invalid;
  if (invalid && invalid.length) {
    right.appendChild(el('p', { class: 'note ko',
      text: tp('Motifs personnels invalides, ignores : {liste}', { liste: invalid.join(' | ') }) }));
  }

  /* --- Verification de couverture --- */
  box.appendChild(sec('Verification de couverture'));
  box.appendChild(el('p', { class: 'note', text: t(
    'Declenche de vraies requetes depuis l onglet actif, vers sa propre origine uniquement : fetch GET, fetch POST avec corps, XMLHttpRequest, image, sendBeacon, EventSource, WebSocket et balise script. Aucun service externe n est contacte.') }));
  const probeActions = el('div', { class: 'actions' });
  probeActions.appendChild(button('Lancer le test', () => runProbe()));
  box.appendChild(probeActions);
  box.appendChild(el('p', { class: 'note ' + (probeStatus ? probeStatus.tone : ''), text: probeStatus ? probeStatus.text : '' }));

  /* --- Stockage --- */
  box.appendChild(sec('Stockage sur disque'));
  box.appendChild(el('p', { class: 'note', text: t(
    'La persistance ecrit les requetes terminees dans IndexedDB, local a Firefox. Elle se regle dans Reglages -> Stockage.') }));
  const storeActions = el('div', { class: 'actions' });
  storeActions.appendChild(button('Compter les enregistrements', async () => {
    const res = await cmd('storageCount', {});
    storageStatus = res.error
      ? { tone: 'ko', text: res.error }
      : { tone: 'ok', text: res.count === 0
          ? t('Base vide (la persistance est-elle activee ?).')
          : tp('{n} enregistrement(s) sur disque.', { n: res.count }) };
    render();
  }));
  let armed = false;
  const purge = button('Purger le stockage', async () => {
    if (!armed) {
      armed = true;
      purge.textContent = t('Confirmer la purge ?');
      purge.classList.add('armed');
      setTimeout(() => { armed = false; purge.textContent = t('Purger le stockage'); purge.classList.remove('armed'); }, 4000);
      return;
    }
    const res = await cmd('purgeStorage', {});
    storageStatus = (res.error || res.ok === false)
      ? { tone: 'ko', text: res.error || t('Purge impossible') }
      : { tone: 'ok', text: t('Base videe. La capture en memoire est conservee.') };
    render();
  }, { class: 'danger' });
  storeActions.appendChild(purge);
  box.appendChild(storeActions);
  if (storageStatus) box.appendChild(el('p', { class: 'note ' + storageStatus.tone, text: storageStatus.text }));
}

export async function runProbe() {
  probeStatus = { tone: '', text: t('Injection des sondes en cours…') };
  if (state.view === 'stats') render();

  const before = state.stats ? state.stats.store.total : 0;
  const res = await cmd('probe', {});
  if (res.error) {
    probeStatus = { tone: 'ko', text: res.error };
    if (state.view === 'stats') render();
    return;
  }
  toast(tp('{n} sondes emises', { n: res.fired.length }));
  // Les sondes lentes (SSE, WebSocket) ont besoin de quelques secondes.
  setTimeout(async () => {
    const after = await cmd('stats', {});
    const delta = after.stats ? after.stats.store.total - before : 0;
    probeStatus = {
      tone: 'ok',
      text: tp('{n} sondes emises sur {url} — {d} nouvelles lignes capturees. ({liste})', {
        n: res.fired.length, url: res.url, d: delta, liste: res.fired.join(', ') })
    };
    if (state.view === 'stats') render();
  }, 2600);
}
