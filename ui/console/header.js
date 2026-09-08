/* Barre d en-tete de la console — INTERCEPTOR (by NeoZ)
 *
 * Libelles traduits, bouton de capture, perimetre, langue, menus Exporter et
 * Actions, imports de fichiers. La coquille (console.js) fournit ce dont ce
 * module a besoin pour agir sur les vues : `api`.
 */
import { $, el, clear } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { B, cmd, state, toast, copy, dropdown, saveConfig } from '../app.js';
import * as requests from './requests.js';
import * as detail from './detail.js';
import * as compare from './compare.js';
import * as stats from './stats.js';
import { renderFoot } from './statusbar.js';
import { GENERATOR_MENU } from '../../background/export/codegen.js';
import { bindDock } from './dock.js';

let api = {};
let tabsCache = [];

/** Injecte les actions de la coquille : changement de vue, rendu, barre laterale. */
export function initHeader(shell) {
  api = shell;
  applyStaticLabels();
  bindHeader();
}

export { applyStaticLabels };

/* Les libelles ecrits dans le HTML passent aussi par la traduction : un seul
   endroit decide de la langue de toute l interface. */
export function applyCaptureButton() {
  const on = !state.config || state.config.capturing;
  const btn = $('#capture');
  btn.classList.toggle('paused', !on);
  $('#capture-label').textContent = on ? t('Capture') : t('En pause');
  btn.title = on ? 'Capture active — cliquer pour mettre en pause'
                 : 'Capture en pause — cliquer pour reprendre';
}

export async function buildScope() {
  const select = $('#scope');
  const previous = state.scope;
  const res = await cmd('tabsList', {});
  tabsCache = (res && res.tabs) || [];

  clear(select);
  select.appendChild(el('option', { value: 'tab', text: t('Onglet actif') }));
  select.appendChild(el('option', { value: 'all', text: t('Tout Firefox') }));
  const group = el('optgroup', { label: t('Onglets ouverts') });
  for (const tab of tabsCache) {
    const label = '[' + tab.id + '] ' + (tab.title || tab.url || '').slice(0, 60);
    group.appendChild(el('option', { value: String(tab.id), text: label }));
  }
  if (tabsCache.length) select.appendChild(group);
  select.value = previous;
  if (select.value !== previous) {
    // L onglet observe a ete ferme : on bascule sur la vue globale plutot que
    // de laisser un perimetre qui ne correspond plus a rien.
    select.value = 'all';
    state.scope = 'all';
  }
}

function applyStaticLabels() {
  const set = (selector, text, title) => {
    const node = $(selector);
    if (!node) return;
    if (text != null) node.textContent = t(text);
    if (title != null) node.title = t(title);
  };
  set('#export', 'Exporter');
  set('#more', 'Actions');
  set('#clear', 'Vider', 'Vider toute la capture');
  set('#columns', 'Colonnes');
  set('#sort', 'Tri');
  set('#follow', null, 'Suivre le flux en direct');
  set('#sel-all', 'Tout selectionner');
  set('#sel-none', 'Deselectionner');
  set('#sel-delete', 'Supprimer');
  set('#compare', 'Comparer', 'Comparer exactement deux lignes selectionnees');
  set('#d-open', 'Ouvrir', 'Ouvrir l URL dans un onglet');
  set('#d-block', 'Bloquer', 'Creer une regle de blocage');
  set('#d-copy', 'Copier');
  set('#d-close', null, 'Fermer le detail');
  set('#d-prev', null, 'Ligne precedente');
  set('#d-next', null, 'Ligne suivante');
  set('#d-flag', null, 'Epingler');
  set('#keys-close', 'Fermer');
  set('#dock', null, 'Emplacement de la console');
  set('#lang', null, 'Francais / Anglais');
  set('#prefs', null, 'Reglages');
  $('#scope').title = t('Perimetre observe');
  $('#q').placeholder = t('Filtrer :  method:POST   status:5xx   host:api.   size:>100000   -image   /regex/');
  const deepLabel = $('#deep-label');
  if (deepLabel) deepLabel.textContent = t('corps');
  const langBtn = $('#lang');
  if (langBtn) langBtn.textContent = (state.config && state.config.lang === 'en') ? 'EN' : 'FR';
}

function bindHeader() {
  $('#lang').addEventListener('click', async () => {
    const next = (state.config && state.config.lang) === 'en' ? 'fr' : 'en';
    await saveConfig({ lang: next });
    applyStaticLabels();
    api.buildSidebar();
    applyCaptureButton();
    requests.applyConfig();
    buildScope();
    renderFoot();
    api.renderView();
    toast(next === 'en' ? 'Language: English' : 'Langue : francais');
  });

  $('#capture').addEventListener('click', async () => {
    const res = await cmd('toggleCapture', {});
    if (res.error) return toast(res.error, false);
    if (state.config) state.config.capturing = res.capturing;
    applyCaptureButton();
    toast(res.capturing ? 'Capture reprise' : 'Capture en pause');
  });

  $('#clear').addEventListener('click', async () => {
    const res = await cmd('clear', {});
    if (res.error) return toast(res.error, false);
    state.records.clear();
    state.order.length = 0;
    state.selection.clear();
    state.deepIds = null;
    detail.close();
    api.renderView();
    toast('Capture videe');
  });

  $('#scope').addEventListener('change', ev => {
    state.scope = ev.target.value;
    api.renderView();
  });

  $('#q-help').addEventListener('click', () => api.setView('help'));

  // Icone de droite de la barre : acces direct aux reglages, comme dans
  // n importe quel outil moderne. Elle double l entree de la barre laterale,
  // qui disparait justement en mode simple et en fenetre etroite.
  const prefs = $('#prefs');
  if (prefs) prefs.addEventListener('click', () => api.setView('settings'));

  bindDock();

  dropdown($('#q-saved'), () => {
    const config = state.config || {};
    const saved = config.savedFilters || [];
    const history = config.searchHistory || [];
    const items = [{ kind: 'head', label: 'Filtres enregistres' }];

    if (!saved.length) items.push({ label: 'Aucun filtre enregistre', action: () => {} });
    for (const filter of saved) {
      items.push({ label: '★  ' + filter.name, action: () => applyQuery(filter.query) });
    }
    items.push({ kind: 'sep' });
    items.push({
      label: 'Enregistrer le filtre courant', action: saveFilter
    });
    if (saved.length) items.push({ label: 'Oublier le dernier filtre enregistre', action: forgetLastFilter });

    if (history.length) {
      items.push({ kind: 'sep' }, { kind: 'head', label: 'Recherches recentes' });
      for (const query of history) items.push({ label: query, action: () => applyQuery(query) });
    }
    return items;
  }, { left: true });

  $('#compare').addEventListener('click', () => {
    if (state.selection.size !== 2) {
      return toast('Selectionnez exactement deux lignes avec Ctrl+clic', false);
    }
    api.setView('compare');
    compare.loadSelection();
  });

  let timer = null;
  $('#q').addEventListener('input', ev => {
    clearTimeout(timer);
    const value = ev.target.value;
    timer = setTimeout(() => requests.runQuery(value), 190);
  });

  // La recherche validee (Entree, ou sortie du champ) entre dans l historique :
  // on n enregistre pas chaque frappe.
  $('#q').addEventListener('change', ev => rememberQuery(ev.target.value));

  $('#deep').addEventListener('change', ev => {
    state.deep = ev.target.checked;
    requests.runQuery($('#q').value);
    toast(state.deep ? 'Recherche etendue aux corps, entetes, trames et piles'
                     : 'Recherche sur les metadonnees');
  });

  dropdown($('#export'), () => {
    const items = [
      { kind: 'head', label: t('Lignes filtrees ou selectionnees') },
      { label: 'HAR 1.2 (DevTools, Charles…)', action: () => exportAs('har') },
      { label: t('JSON complet'), action: () => exportAs('json') },
      { label: 'Collection Postman v2.1', action: () => exportAs('postman') },
      { label: t('Tableau CSV'), action: () => exportAs('csv') },
      { label: t('Rapport d alertes (Markdown)'), action: () => exportAs('findings') },
      { label: t('Liste d URL (.txt)'), action: () => exportAs('urls') },
      { kind: 'sep' },
      { label: t('Copier les URL filtrees'), action: copyUrls },
      { kind: 'sep' },
      { label: t('Exporter les reglages'), action: () => exportAs('config') }
    ];
    // Un script par langage : la liste vient du registre de generateurs, donc
    // tout langage ajoutable a une requete devient exportable pour un lot.
    for (const entry of GENERATOR_MENU) {
      if (Array.isArray(entry)) {
        items.push({ label: t('Script') + ' ' + entry[1], action: () => exportAs(entry[0]) });
      } else {
        items.push({ kind: 'sep' }, { kind: 'head', label: t('Script') + ' — ' + t(entry.head) });
      }
    }
    return items;
  });

  dropdown($('#more'), () => [
    { kind: 'head', label: 'Apprendre' },
    { label: 'Ouvrir le tutoriel', action: () => api.setView('tutorial') },
    { kind: 'sep' },
    { kind: 'head', label: 'Analyse' },
    { label: 'Tout reanalyser', action: reanalyze },
    { label: 'Test de couverture', action: () => { api.setView('stats'); stats.runProbe(); } },
    { kind: 'sep' },
    { kind: 'head', label: 'Fenetres' },
    { label: 'Ouvrir dans un onglet', action: () => cmd('openConsole', {}) },
    { label: 'Ouvrir le panneau lateral', action: openSidebar },
    { kind: 'sep' },
    { kind: 'head', label: 'Maintenance' },
    { label: 'Importer un fichier HAR', action: importHar },
    { label: 'Importer une session JSON', action: importSession },
    { label: 'Voir les raccourcis clavier', action: () => api.toggleKeys(true) },
    { label: 'Rafraichir la liste des onglets', action: buildScope },
    { label: 'Purger le stockage sur disque', action: purgeStorage },
    { label: 'Redemarrer l extension', action: reloadExtension }
  ]);
}

async function exportAs(format) {
  if (format !== 'config') {
    const rows = requests.selectionOrRows();
    if (!rows.length) return toast('Rien a exporter', false);
    toast('Preparation de l export…');
    // L ecriture est faite par la page d arriere-plan : elle survit a la
    // fermeture de cette fenetre.
    const res = await cmd('exportFile', { format, ids: rows.map(r => r.id) });
    if (res.error) return toast(res.error, false);
    return toast(res.count + ' requetes exportees — ' + res.filename);
  }
  const res = await cmd('exportFile', { format: 'config' });
  if (res.error) return toast(res.error, false);
  toast('Reglages exportes — ' + res.filename);
}

function copyUrls() {
  const rows = requests.selectionOrRows();
  if (!rows.length) return toast('Aucune ligne', false);
  copy(rows.map(r => r.url).join('\n'), rows.length + ' URL copiees');
}

async function reanalyze() {
  toast('Analyse en cours…');
  const res = await cmd('analyzeAll', {});
  if (res.error) return toast(res.error, false);
  toast(res.analyzed + ' requetes reanalysees');
  api.renderView();
}

async function openSidebar() {
  try { await B.sidebarAction.open(); }
  catch { toast('Ouvrez le panneau lateral avec Alt+Shift+S', false); }
}

/* Import d une capture externe : le fichier est lu localement puis confie au
   noyau. Rien ne sort du navigateur. */
function importHar() {
  const picker = el('input', { type: 'file', accept: '.har,application/json', style: 'display:none' });
  document.body.appendChild(picker);
  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    if (!file) { picker.remove(); return; }
    toast('Lecture de ' + file.name + '…');
    try {
      const text = await file.text();
      const res = await cmd('importHar', { har: JSON.parse(text) });
      if (res.error) toast(res.error, false);
      else toast(res.imported + ' requetes importees' + (res.skipped ? ', ' + res.skipped + ' ignorees' : ''));
    } catch (e) {
      toast('Fichier illisible : ' + String(e && e.message || e), false);
    }
    picker.remove();
  });
  picker.click();
}

/** Applique une requete de recherche et l inscrit dans l historique. */
function applyQuery(query) {
  $('#q').value = query;
  requests.runQuery(query);
  rememberQuery(query);
}

function rememberQuery(query) {
  const value = String(query || '').trim();
  if (!value || !state.config) return;
  const history = [value, ...(state.config.searchHistory || []).filter(q => q !== value)].slice(0, 12);
  saveConfig({ searchHistory: history });
}

export async function saveFilter() {
  const query = $('#q').value.trim();
  if (!query) return toast('Ecrivez d abord un filtre a enregistrer', false);
  const saved = [...((state.config && state.config.savedFilters) || [])];
  if (saved.some(f => f.query === query)) return toast('Ce filtre est deja enregistre');
  saved.push({ name: query.length > 34 ? query.slice(0, 34) + '…' : query, query });
  await saveConfig({ savedFilters: saved });
  toast('Filtre enregistre — bouton ★ a cote de la recherche');
}

async function forgetLastFilter() {
  const saved = [...((state.config && state.config.savedFilters) || [])];
  if (!saved.length) return;
  saved.pop();
  await saveConfig({ savedFilters: saved });
  toast('Dernier filtre enregistre oublie');
}

/** Import d une session complete exportee en JSON par INTERCEPTOR. */
function importSession() {
  const picker = el('input', { type: 'file', accept: '.json,application/json', style: 'display:none' });
  document.body.appendChild(picker);
  picker.addEventListener('change', async () => {
    const file = picker.files && picker.files[0];
    if (!file) { picker.remove(); return; }
    toast('Lecture de ' + file.name + '…');
    try {
      const res = await cmd('importSession', { session: JSON.parse(await file.text()) });
      if (res.error) toast(res.error, false);
      else toast(res.imported + ' requetes restaurees');
    } catch (e) {
      toast('Fichier illisible : ' + String(e && e.message || e), false);
    }
    picker.remove();
  });
  picker.click();
}

async function purgeStorage() {
  const res = await cmd('purgeStorage', {});
  if (res.error || res.ok === false) return toast(res.error || 'Purge impossible', false);
  toast('Stockage sur disque vide');
}

function reloadExtension() {
  toast('Redemarrage de l extension…');
  setTimeout(() => { try { B.runtime.reload(); } catch (e) { toast('Redemarrage refuse', false); } }, 400);
}
