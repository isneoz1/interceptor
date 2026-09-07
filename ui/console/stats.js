/* Vue « Diagnostic » — INTERCEPTOR (by D4RK)
 * Chiffres lus en direct dans le noyau : rien n est simule, rien n est estime.
 */
import { $, el, clear, sec, grid, button } from '../lib/dom.js';
import { bytes, uptime, ms } from '../lib/format.js';
import { state, cmd, toast } from '../app.js';

let about = null;
let probeStatus = null;
let storageStatus = null;

/* Couches : reglage, disponibilite reelle de l API, activite mesuree. */
function layerRows(s, caps, config) {
  const yn = v => (v ? 'oui' : 'non');
  return [
    ['webRequest (9 evenements)', yn(config.captureWebRequest) + ' · API ' + yn(caps.webRequest), config.captureWebRequest && caps.webRequest ? 'ok' : 'warn'],
    ['Corps de reponse (StreamFilter)', yn(config.captureResponseBodies) + ' · API ' + yn(caps.streamFilter), caps.streamFilter ? 'ok' : 'ko'],
    ['Sondes du monde page', yn(config.capturePageHooks) + ' · ' + s.page.events + ' evenements', config.capturePageHooks ? 'ok' : 'warn'],
    ['Trames WebSocket', yn(config.captureWebSocketFrames) + ' · ' + s.page.frames + ' trames', config.captureWebSocketFrames ? 'ok' : 'warn'],
    ['Server-Sent Events', yn(config.captureSse), config.captureSse ? 'ok' : 'warn'],
    ['PerformanceObserver', yn(config.capturePerformance), config.capturePerformance ? 'ok' : 'warn'],
    ['TLS et certificats', yn(config.captureSecurityInfo) + ' · API ' + yn(caps.securityInfo), caps.securityInfo ? 'ok' : 'ko'],
    ['Resolution DNS', yn(config.captureDns) + ' · API ' + yn(caps.dns), caps.dns ? 'ok' : 'ko'],
    ['Navigation', yn(config.captureNavigation) + ' · API ' + yn(caps.webNavigation), caps.webNavigation ? 'ok' : 'ko'],
    ['Cookies', yn(config.captureCookies) + ' · API ' + yn(caps.cookies), caps.cookies ? 'ok' : 'ko'],
    ['Proxy (facultatif)', yn(config.captureProxy) + ' · API ' + yn(caps.proxy), config.captureProxy ? 'ok' : null],
    ['Piles JavaScript', yn(config.captureStacks), config.captureStacks ? 'ok' : 'warn'],
    ['Cookies poses en JavaScript', yn(config.captureJsCookies), config.captureJsCookies ? 'ok' : 'warn'],
    ['WebTransport', yn(config.captureWebTransport), config.captureWebTransport ? 'ok' : 'warn'],
    ['Mesures de perception de page', yn(config.capturePageVitals), config.capturePageVitals ? 'ok' : 'warn'],
    ['WebRTC', yn(config.captureWebRtc), config.captureWebRtc ? 'ok' : 'warn'],
    ['Workers et Service Workers', yn(config.captureWorkers), config.captureWorkers ? 'ok' : 'warn'],
    ['Decompression gzip / deflate', yn(caps.decompression), caps.decompression ? 'ok' : 'warn'],
    ['Persistance IndexedDB', yn(config.persist) + ' · API ' + yn(caps.indexedDb), config.persist ? 'ok' : null],
    ['Notifications bureau', yn(config.notifyCritical) + ' · API ' + yn(caps.notifications), config.notifyCritical ? 'ok' : null],
    ['Moteur de regles', yn(config.rulesEnabled) + ' · ' + (config.rules || []).length + ' regle(s)', config.rulesEnabled ? 'warn' : null],
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
    box.appendChild(el('div', { class: 'empty' }, [el('b', { text: 'En attente du noyau' }), 'Connexion en cours…']));
    return;
  }

  /* --- Bandeau de chiffres cles --- */
  const tiles = el('div', { class: 'tiles' });
  const tile = (value, label, cls) => tiles.appendChild(
    el('div', { class: 'tile' + (cls ? ' ' + cls : '') }, [el('b', { text: String(value) }), el('label', { text: label })]));
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
      ['Etat', s.capturing ? 'CAPTURE ACTIVE' : 'EN PAUSE', s.capturing ? 'ok' : 'warn']
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
    ['StreamFilter', s.streamFilter.supported ? 'disponible' : 'indisponible', s.streamFilter.supported ? 'ok' : 'ko'],
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
    ['TLS interroges', s.tls.queried + ' (cache ' + s.tls.cached + ')'],
    ['TLS en echec', s.tls.failed, s.tls.failed ? 'warn' : null],
    ['DNS resolus', s.dns.resolved + ' (cache ' + s.dns.cached + ')'],
    ['DNS en echec', s.dns.failed, s.dns.failed ? 'warn' : null],
    ['Proxy', s.proxy.enabled ? s.proxy.observed + ' observations' : 'desactive'],
    ['Regles', s.rules.blocked + ' bloquees · ' + s.rules.redirected + ' redirigees · ' +
                 (s.rules.upgraded || 0) + ' forcees en https · ' + s.rules.headersModified + ' entetes · ' +
                 (s.rules.mocked || 0) + ' simulees'],
    ['Regles : latence', (s.rules.delayed || 0) + ' retardees · ' +
                 ms(s.rules.delayMsTotal || 0) + ' au total', s.rules.delayed ? 'warn' : null],
    ['Regles : substitutions', (s.rules.replaced || 0) + ' appliquees · ' +
                 (s.rules.replaceSkipped || 0) + ' ecartees',
                 (s.rules.replaced || s.rules.replaceSkipped) ? 'warn' : null],
    ['Rejeux', s.replay.sent + ' envoyes · ' + s.replay.failed + ' echoues'],
    ['Fichiers exportes', s.save.files + ' (' + bytes(s.save.bytes) + ')'],
    ['Persistance', s.persist.enabled ? s.persist.written + ' ecrits · ' + s.persist.restored + ' restaures' : 'desactivee'],
    ['Journaux', s.logs.navigation + ' nav · ' + s.logs.cookies + ' cookies · ' + s.logs.context + ' contexte']
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
    right.appendChild(el('p', { class: 'note ko', text: 'Motifs personnels invalides, ignores : ' + invalid.join(' | ') }));
  }

  /* --- Verification de couverture --- */
  box.appendChild(sec('Verification de couverture'));
  box.appendChild(el('p', { class: 'note', text:
    'Declenche de vraies requetes depuis l onglet actif, vers sa propre origine uniquement : fetch GET, ' +
    'fetch POST avec corps, XMLHttpRequest, image, sendBeacon, EventSource, WebSocket et balise script. ' +
    'Aucun service externe n est contacte.' }));
  const probeActions = el('div', { class: 'actions' });
  probeActions.appendChild(button('Lancer le test', () => runProbe()));
  box.appendChild(probeActions);
  box.appendChild(el('p', { class: 'note ' + (probeStatus ? probeStatus.tone : ''), text: probeStatus ? probeStatus.text : '' }));

  /* --- Stockage --- */
  box.appendChild(sec('Stockage sur disque'));
  box.appendChild(el('p', { class: 'note', text:
    'La persistance ecrit les requetes terminees dans IndexedDB, local a Firefox. Elle se regle dans Reglages -> Stockage.' }));
  const storeActions = el('div', { class: 'actions' });
  storeActions.appendChild(button('Compter les enregistrements', async () => {
    const res = await cmd('storageCount', {});
    storageStatus = res.error
      ? { tone: 'ko', text: res.error }
      : { tone: 'ok', text: res.count === 0 ? 'Base vide (la persistance est-elle activee ?).' : res.count + ' enregistrement(s) sur disque.' };
    render();
  }));
  let armed = false;
  const purge = button('Purger le stockage', async () => {
    if (!armed) {
      armed = true;
      purge.textContent = 'Confirmer la purge ?';
      purge.classList.add('armed');
      setTimeout(() => { armed = false; purge.textContent = 'Purger le stockage'; purge.classList.remove('armed'); }, 4000);
      return;
    }
    const res = await cmd('purgeStorage', {});
    storageStatus = (res.error || res.ok === false)
      ? { tone: 'ko', text: res.error || 'Purge impossible' }
      : { tone: 'ok', text: 'Base videe. La capture en memoire est conservee.' };
    render();
  }, { class: 'danger' });
  storeActions.appendChild(purge);
  box.appendChild(storeActions);
  if (storageStatus) box.appendChild(el('p', { class: 'note ' + storageStatus.tone, text: storageStatus.text }));
}

export async function runProbe() {
  probeStatus = { tone: '', text: 'Injection des sondes en cours…' };
  if (state.view === 'stats') render();

  const before = state.stats ? state.stats.store.total : 0;
  const res = await cmd('probe', {});
  if (res.error) {
    probeStatus = { tone: 'ko', text: res.error };
    if (state.view === 'stats') render();
    return;
  }
  toast(res.fired.length + ' sondes emises');
  // Les sondes lentes (SSE, WebSocket) ont besoin de quelques secondes.
  setTimeout(async () => {
    const after = await cmd('stats', {});
    const delta = after.stats ? after.stats.store.total - before : 0;
    probeStatus = {
      tone: 'ok',
      text: res.fired.length + ' sondes emises sur ' + res.url + ' — ' + delta +
            ' nouvelles lignes capturees. (' + res.fired.join(', ') + ')'
    };
    if (state.view === 'stats') render();
  }, 2600);
}
