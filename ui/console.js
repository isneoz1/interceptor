/* ============================================================
 * INTERCEPTOR — console complete  (cree par D4RK)
 *
 * Coquille de l application : en-tete, navigation laterale, routage des
 * vues, pied de page temps reel et raccourcis clavier.
 * La meme page sert d onglet plein ecran, de panneau lateral et de page
 * d options : la mise en page s adapte a la largeur disponible.
 * ============================================================ */
import { $, el, clear } from './lib/dom.js';
import { t } from './lib/i18n.js';
import {
  B, cmd, state, toast, copy, dropdown, closeMenus, connect, bootstrap, saveConfig
} from './app.js';
import * as requests from './console/requests.js';
import * as detail from './console/detail.js';
import * as alerts from './console/alerts.js';
import * as streams from './console/streams.js';
import * as journal from './console/journal.js';
import * as stats from './console/stats.js';
import * as rules from './console/rules.js';
import * as settings from './console/settings.js';
import * as help from './console/help.js';
import * as tutorial from './console/tutorial.js';
import * as summary from './console/summary.js';
import * as compare from './console/compare.js';
import * as tools from './console/tools.js';
import * as sitemap from './console/sitemap.js';
import * as debugview from './console/debug.js';
import * as intercept from './console/intercept.js';
import { renderFoot, renderSpark } from './console/statusbar.js';
import { initHeader, applyStaticLabels, applyCaptureButton, buildScope, saveFilter } from './console/header.js';

/* Les vues, dans l ordre ou elles apparaissent dans la barre laterale.
 *
 * `hint` est une phrase en clair, affichee au survol : elle dit ce que la vue
 * MONTRE, pas comment elle marche. C est ce qui permet a quelqu un qui ouvre
 * INTERCEPTOR pour la premiere fois de savoir ou aller sans lire l aide.
 *
 * Les noms evitent le jargon interne : « Sites et chemins » plutot que
 * « Cible », « Etat du systeme » plutot que « Diagnostic », qui se confondait
 * avec « Journal interne ». */
const VIEWS = {
  /* ------------------------------- Le trafic ------------------------------ */
  requests:   { label: 'Requetes', ico: '▤', group: 'Trafic',
                hint: 'Tout le trafic, requete par requete',
                render: () => requests.render() },
  alerts:     { label: 'Securite', ico: '⚠', group: 'Trafic',
                hint: 'Ce qui est risque : secrets, cookies mal proteges, HTTP en clair',
                render: () => alerts.render() },
  summary:    { label: 'Synthese', ico: '◫', group: 'Trafic',
                hint: 'Les chiffres d ensemble : statuts, types, domaines, debit',
                render: () => summary.render() },
  sitemap:    { label: 'Sites et chemins', ico: '⌂', group: 'Trafic', advanced: true,
                hint: 'Ce qui existe sur les sites visites, hote par hote',
                render: () => sitemap.render() },
  streams:    { label: 'Flux temps reel', ico: '≈', group: 'Trafic', advanced: true,
                hint: 'WebSocket et Server-Sent Events, message par message',
                render: () => streams.render() },
  compare:    { label: 'Comparaison', ico: '⇄', group: 'Trafic', hidden: true,
                hint: 'Deux requetes confrontees ligne a ligne',
                render: () => compare.render() },

  /* ------------------------------ Les journaux ---------------------------- */
  cookies:    { label: 'Cookies', ico: '◍', group: 'Journaux', advanced: true,
                hint: 'Chaque cookie pose, modifie ou supprime',
                render: () => journal.render('cookies') },
  navigation: { label: 'Navigation', ico: '→', group: 'Journaux', advanced: true,
                hint: 'Les changements de page et de cadre',
                render: () => journal.render('navigation') },
  context:    { label: 'Workers et WebRTC', ico: '◇', group: 'Journaux', advanced: true,
                hint: 'Workers, Service Workers, WebRTC et mesures de page',
                render: () => journal.render('context') },

  /* -------------------------------- Les outils ---------------------------- */
  tools:      { label: 'Boite a outils', ico: '⚒', group: 'Outils',
                hint: 'Decoder, hacher, mesurer ou inspecter une valeur',
                render: () => tools.render() },

  /* -------------------------- Agir sur le trafic -------------------------- */
  rules:      { label: 'Regles', ico: '⛨', group: 'Agir sur le trafic', advanced: true,
                hint: 'Bloquer, rediriger, modifier le trafic automatiquement',
                render: () => rules.render() },
  intercept:  { label: 'Interception', ico: '⏸', group: 'Agir sur le trafic', advanced: true,
                hint: 'Suspendre une requete pour la modifier avant son depart',
                render: () => intercept.render() },

  /* ------------------------------- Le systeme ----------------------------- */
  stats:      { label: 'Etat du systeme', ico: '▣', group: 'Systeme', advanced: true,
                hint: 'Ce que chaque couche capture reellement, et les chiffres du noyau',
                render: () => stats.render() },
  debug:      { label: 'Journal interne', ico: '≡', group: 'Systeme', advanced: true,
                hint: 'Les erreurs d INTERCEPTOR lui-meme, et ses commandes',
                render: () => debugview.render() },
  settings:   { label: 'Reglages', ico: '⚙', group: 'Systeme',
                hint: 'Toutes les options, et quatre profils tout prets',
                render: () => settings.render() },

  /* ------------------------------- Apprendre ------------------------------ */
  tutorial:   { label: 'Tutoriel', ico: '★', group: 'Apprendre',
                hint: 'Douze lecons pour prendre l outil en main',
                render: () => tutorial.render() },
  help:       { label: 'Aide', ico: '?', group: 'Apprendre',
                hint: 'Le mode d emploi complet, hors ligne',
                render: () => help.render() }
};

let pendingRender = null;

/* ------------------------------- Routage -------------------------------- */
export function setView(name) {
  if (!VIEWS[name]) name = 'requests';
  state.view = name;
  state.seen.views.add(name);
  if (state.config && state.config.lastView !== name && name !== 'compare') {
    saveConfig({ lastView: name });
  }
  for (const key of Object.keys(VIEWS)) {
    const node = $('#view-' + key);
    if (node) node.hidden = key !== name;
  }
  for (const btn of document.querySelectorAll('.navbtn')) {
    btn.classList.toggle('on', btn.dataset.view === name);
  }
  renderView();
}

function renderView() {
  const view = VIEWS[state.view];
  if (!view) return;
  // Les vues se redessinent entierement a chaque changement : on conserve la
  // position de lecture, sans quoi un simple reglage renverrait en haut de page.
  const before = document.querySelector('#view-' + state.view + ' .pane');
  const top = before ? before.scrollTop : 0;
  view.render();
  if (top) {
    const after = document.querySelector('#view-' + state.view + ' .pane');
    if (after) after.scrollTop = top;
  }
}

function scheduleRender() {
  if (pendingRender) return;
  pendingRender = setTimeout(() => { pendingRender = null; renderView(); }, 150);
}

/* ------------------------------ Navigation ------------------------------ */
function buildSidebar() {
  const side = clear($('#side'));
  const simple = !!(state.config && state.config.simpleMode);
  let currentGroup = null;
  for (const [key, view] of Object.entries(VIEWS)) {
    if (view.hidden) continue;
    if (simple && view.advanced) continue;
    if (view.group !== currentGroup) {
      currentGroup = view.group;
      side.appendChild(el('div', { class: 'group', text: t(currentGroup) }));
    }
    const btn = el('button', {
      class: 'navbtn', type: 'button', dataset: { view: key },
      title: view.hint ? t(view.hint) : null
    }, [
      el('span', { class: 'ico', text: view.ico }),
      el('span', { class: 'lbl', text: t(view.label) }),
      el('span', { class: 'badge', id: 'badge-' + key, hidden: true })
    ]);
    btn.addEventListener('click', () => setView(key));
    side.appendChild(btn);
  }
}

function setBadge(view, value, hot) {
  const node = $('#badge-' + view);
  if (!node) return;
  node.hidden = !value;
  node.textContent = String(value || '');
  node.classList.toggle('hot', !!hot);
}

function refreshBadges() {
  const s = state.stats;
  if (!s) return;
  setBadge('requests', s.store.live);
  const hot = s.analyzer.bySeverity.critical + s.analyzer.bySeverity.high;
  setBadge('alerts', s.analyzer.findings, hot > 0);
  setBadge('cookies', s.logs.cookies);
  setBadge('navigation', s.logs.navigation);
  setBadge('context', s.logs.context);
  setBadge('rules', (state.config && state.config.rules || []).length);
  const erreursInternes = debugview.erreurs();
  setBadge('debug', erreursInternes, erreursInternes > 0);
  const suspendues = intercept.attente();
  setBadge('intercept', suspendues, suspendues > 0);
  setBadge('tutorial', tutorial.remaining());
}

/* --------------------------- Aide clavier -------------------------------- */
const SHORTCUTS = [
  ['/', 'Placer le curseur dans la recherche'],
  ['Fleche haut / bas', 'Requete precedente / suivante'],
  ['Echap', 'Fermer le detail, un menu ou cette fenetre'],
  ['P', 'Mettre la capture en pause ou la reprendre'],
  ['F', 'Suivre le flux ou le figer'],
  ['C', 'Comparer les deux lignes selectionnees'],
  ['S', 'Enregistrer le filtre courant'],
  ['1 a 9', 'Basculer sur une vue'],
  ['?', 'Afficher cette aide'],
  ['Ctrl+clic', 'Ajouter une ligne a la selection'],
  ['Maj+clic', 'Selectionner une plage de lignes'],
  ['Clic droit', 'Menu contextuel de la ligne'],
  ['Ctrl+Shift+Y', 'Ouvrir la fenetre compacte'],
  ['Alt+Shift+S', 'Ouvrir le panneau lateral'],
  ['Alt+Shift+I', 'Ouvrir la console dans un onglet'],
  ['Ctrl+Shift+U', 'Pause / reprise, meme hors de la console']
];

function toggleKeys(show) {
  const box = $('#keys');
  if (show === undefined) show = box.hidden;
  if (show) {
    const list = clear($('#keys-list'));
    for (const [key, what] of SHORTCUTS) {
      list.appendChild(el('b', { text: key }));
      list.appendChild(el('span', { text: what }));
    }
  }
  box.hidden = !show;
}

/* Navigation demandee par une autre vue (clic sur une alerte, sur un flux…). */
document.addEventListener('ic:goto', ev => {
  const { view, query, id } = ev.detail || {};
  if (query != null) { $('#q').value = query; requests.runQuery(query); }
  if (view) setView(view);
  if (id != null) detail.open(id);
});

/* L echelle d affichage a change (fenetre redimensionnee, taille du texte
   modifiee) : le tableau doit remesurer la hauteur de ses lignes, sinon son
   defilement virtuel se decale du contenu reel. */
document.addEventListener('ic:echelle', () => requests.applyConfig());

/* ------------------------------- Clavier --------------------------------- */
function bindKeyboard() {
  document.addEventListener('keydown', ev => {
    const typing = ev.target.matches('input, textarea, select');

    if (ev.key === 'Escape') {
      closeMenus();
      if (!$('#keys').hidden) { toggleKeys(false); return; }
      if (!typing && detail.isOpen()) detail.close();
      return;
    }
    if (typing) return;

    if (ev.key === '/') { ev.preventDefault(); setView('requests'); $('#q').focus(); return; }
    if (ev.key === '?') { ev.preventDefault(); toggleKeys(); return; }
    if (ev.key.toLowerCase() === 'c' && !ev.ctrlKey && state.selection.size === 2) {
      setView('compare'); compare.loadSelection(); return;
    }
    if (ev.key.toLowerCase() === 's' && !ev.ctrlKey) { saveFilter(); return; }
    if (ev.key === 'ArrowDown' && state.view === 'requests') { ev.preventDefault(); detail.step(1); return; }
    if (ev.key === 'ArrowUp' && state.view === 'requests') { ev.preventDefault(); detail.step(-1); return; }
    if (ev.key.toLowerCase() === 'p' && !ev.ctrlKey) { $('#capture').click(); return; }
    if (ev.key.toLowerCase() === 'f' && !ev.ctrlKey) { requests.toggleFollow(); return; }

    const index = Number(ev.key);
    if (index >= 1 && index <= 9) {
      const key = Object.keys(VIEWS)[index - 1];
      if (key) setView(key);
    }
  });
}

/* ------------------------------- Demarrage ------------------------------- */
(async function boot() {
  buildSidebar();
  initHeader({ setView, renderView, buildSidebar, toggleKeys });
  bindKeyboard();
  $('#keys-close').addEventListener('click', () => toggleKeys(false));
  $('#keys').addEventListener('click', ev => { if (ev.target.id === 'keys') toggleKeys(false); });
  requests.init({ onOpen: id => detail.open(id) });
  detail.init({ onChange: () => requests.renderRows() });

  connect({
    onDelta: () => { refreshBadges(); if (state.view === 'requests' || state.view === 'streams' || state.view === 'alerts') scheduleRender(); },
    onStats: () => { renderFoot(); renderSpark(); refreshBadges(); debugview.tick(); intercept.charger();
                     if (state.view === 'stats') scheduleRender(); },
    // Une requete suspendue doit apparaitre tout de suite, pas a la seconde suivante.
    onIntercept: () => { intercept.charger(); refreshBadges(); },
    onClear: () => { detail.close(); renderView(); },
    onRemoved: () => renderView(),
    onConfig: () => { applyStaticLabels(); buildSidebar(); applyCaptureButton(); requests.applyConfig(); if (state.view === 'settings' || state.view === 'rules') renderView(); },
    onDisconnect: () => toast('Lien avec le noyau interrompu — rechargez la page', false)
  });

  const ok = await bootstrap();
  if (!ok) toast('Instantane indisponible : le noyau demarre peut-etre encore', false);

  applyStaticLabels();
  buildSidebar();
  applyCaptureButton();
  requests.applyConfig();
  await buildScope();
  $('#scope').value = state.scope;
  renderFoot();
  renderSpark();
  refreshBadges();

  // Intention deposee par un menu contextuel, la popup ou l installation.
  const intent = await cmd('takeIntent', {});
  if (intent && intent.intent) {
    if (intent.intent.query) {
      $('#q').value = intent.intent.query;
      await requests.runQuery(intent.intent.query);
    }
    setView(intent.intent.view || 'requests');
    if (intent.intent.id != null) detail.open(intent.intent.id);
  } else {
    const last = (state.config && state.config.lastView) || 'requests';
    setView(VIEWS[last] && !VIEWS[last].hidden ? last : 'requests');
  }
})();
