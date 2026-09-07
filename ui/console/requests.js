/* Vue « Requetes » — tableau virtualise — INTERCEPTOR (by D4RK)
 *
 * Le tableau n impose aucune limite d affichage : seules les lignes visibles
 * sont construites, ce qui permet de garder des centaines de milliers
 * d enregistrements a l ecran sans jamais en masquer un seul.
 */
import { $, el, clear, frag } from '../lib/dom.js';
import { parseQuery } from '../lib/filters.js';
import { COLUMNS, COLUMN_ORDER, normalize, template, columnLabel, columnTitle } from '../lib/columns.js';
import { t } from '../lib/i18n.js';
import { state, cmd, toast, dropdown, visibleRecords, scopeCount, saveConfig } from '../app.js';
import { openRowMenu, closeContextMenu, grip } from './rowmenu.js';
import { hauteurLigne as mesureLigne, invaliderHauteur, recalerHauteur } from './rowsize.js';

const OVERSCAN = 12;

const FACETS = [
  { key: 'xhr',    label: 'API',        test: r => r.type === 'xmlhttprequest' || r.type === 'fetch' },
  { key: 'doc',    label: 'Pages',      test: r => r.type === 'main_frame' || r.type === 'sub_frame' },
  { key: 'asset',  label: 'Ressources', test: r => ['image', 'media', 'font', 'stylesheet', 'script', 'imageset'].includes(r.type) },
  { key: 'flux',   label: 'Flux',       test: r => r.type === 'websocket' || r.wsFrames > 0 || r.sseEvents > 0 },
  { key: 'err',    label: 'Erreurs',    test: r => !!r.error || r.statusCode >= 400 },
  { key: 'risk',   label: 'Alertes',    test: r => r.risk && r.risk !== 'none' && r.risk !== 'info', warn: true },
  { key: 'third',  label: 'Tiers',      test: r => r.thirdParty },
  { key: 'body',   label: 'Avec corps', test: r => r.hasResBody || r.hasReqBody },
  { key: 'flag',   label: 'Epinglees',  test: r => r.flag },
  { key: 'slow',   label: 'Lentes',     test: r => r.duration != null && r.duration > 1000 },
  { key: 'nonet',  label: 'Sans reseau', test: r => r.networkless },
  { key: 'classe', label: 'Pistage Firefox', test: r => !!r.classified, warn: true },
  { key: 'import', label: 'Importees',  test: r => r.imported }
];

let onOpen = null;
let lastHeightPercent = null;
let rows = [];
let follow = true;
let lastAnchor = null;

/* ------------------------------- Demarrage ------------------------------- */
export function init(deps) {
  onOpen = deps.onOpen;
  buildFacets();

  dropdown($('#columns'), () => COLUMN_ORDER.map(key => ({
    label: columnLabel(key) + (COLUMNS[key].title ? ' — ' + columnTitle(key) : ''),
    checked: activeColumns().includes(key),
    keepOpen: true,
    action: () => toggleColumn(key)
  })), { left: true });

  dropdown($('#sort'), () => activeColumns().map(key => ({
    label: t('Trier par') + ' ' + columnLabel(key) + (state.sort.key === key ? (state.sort.dir === 'asc' ? '  ↑' : '  ↓') : ''),
    action: () => setSort(key)
  })), { left: true });

  $('#follow').addEventListener('click', toggleFollow);
  $('#sel-all').addEventListener('click', () => {
    state.seen.selection = true;
    for (const r of rows) state.selection.add(r.id);
    renderRows(); updateCount();
  });
  $('#sel-none').addEventListener('click', () => { state.selection.clear(); renderRows(); updateCount(); });
  $('#sel-delete').addEventListener('click', deleteSelection);

  let scrollFrame = null;
  let finDefile = null;
  $('#tablewrap').addEventListener('scroll', () => {
    // Sortir du mode « suivre » des que l utilisateur remonte volontairement.
    const wrap = $('#tablewrap');
    const atBottom = wrap.scrollHeight - wrap.scrollTop - wrap.clientHeight < 24;
    if (!atBottom && follow) setFollow(false);
    closeContextMenu();
    // Pendant le defilement, on coupe survol et transitions (sinon la ligne sous
    // le curseur « bave »), retablis a l arret. Un seul redessin par image.
    wrap.classList.add('defile');
    clearTimeout(finDefile);
    finDefile = setTimeout(() => wrap.classList.remove('defile'), 90);
    if (scrollFrame) return;
    scrollFrame = requestAnimationFrame(() => { scrollFrame = null; renderRows(); });
  }, { passive: true });

  $('#tbody').addEventListener('click', onRowClick);
  $('#tbody').addEventListener('contextmenu', ev => openRowMenu(ev, {
    open: id => onOpen && onOpen(id),
    flag: toggleFlag,
    filter: applyFilter,
    select: id => {
      state.seen.selection = true;
      state.selection.add(id);
      renderRows(); updateCount();
    },
    columns: activeColumns
  }));
  // Le redimensionnement peut changer l echelle, donc la hauteur des lignes.
  window.addEventListener('resize', () => { invaliderHauteur(); renderRows(); });
  bindResizer();
  setFollow(true);
  applyConfig();
}

/** Ajoute ou retire une colonne, en en gardant toujours au moins une. */
function toggleColumn(key) {
  const current = new Set(activeColumns());
  if (current.has(key)) {
    if (current.size === 1) { toast(t('Gardez au moins une colonne'), false); return; }
    current.delete(key);
  } else {
    current.add(key);
  }
  const next = COLUMN_ORDER.filter(k => current.has(k));
  saveConfig({ columns: next });
  applyConfig();
}

/** Applique les reglages d affichage (colonnes, densite, format d heure). */
export function applyConfig() {
  const table = $('#table');
  const widths = (state.config && state.config.columnWidths) || {};
  table.style.setProperty('--cols', template(activeColumns(), widths));
  const detail = $('#detail');
  if (state.config && state.config.detailHeight) detail.style.height = state.config.detailHeight + '%';
  invaliderHauteur();   // densite/taille du texte changent la hauteur des lignes
  // Les puces et le bouton de suivi sont construits avant que le noyau ait
  // livre la configuration : sans ce rappel, ils gardent la langue de depart
  // alors que le reste de l interface a change.
  buildFacets();
  setFollow(follow);
  buildHead();
  renderRows();
}

function activeColumns() {
  return normalize(state.config ? state.config.columns : null);
}

function rowHeight() {   // hauteur reelle, suit echelle et densite (voir rowsize.js)
  return mesureLigne((state.config && state.config.density) === 'compact' ? 'compact' : 'confort');
}

/* --------------------------------- En-tete -------------------------------- */
function buildHead() {
  const head = clear($('#thead'));
  for (const key of activeColumns()) {
    const col = COLUMNS[key];
    const cell = el('div', {
      class: (state.sort.key === key ? 'sorted ' : '') + (col.num ? 'num' : ''),
      title: columnTitle(key) + ' — ' + t('cliquer pour trier'),
      dataset: { col: key }
    }, columnLabel(key) + (state.sort.key === key ? (state.sort.dir === 'asc' ? ' ↑' : ' ↓') : ''));
    cell.addEventListener('click', () => setSort(key));
    cell.appendChild(grip(key, cell, { columns: activeColumns }));
    head.appendChild(cell);
  }
}

function setSort(key) {
  state.seen.sort = true;
  if (state.sort.key === key) state.sort.dir = state.sort.dir === 'asc' ? 'desc' : 'asc';
  else state.sort = { key, dir: key === 'time' ? 'asc' : 'desc' };
  saveConfig({ sortKey: state.sort.key, sortDir: state.sort.dir });
  buildHead();
  render();
}

/* --------------------------------- Facettes ------------------------------- */
function buildFacets() {
  const host = clear($('#facets'));
  for (const f of FACETS) {
    // Les puces sont reconstruites a chaque changement de configuration (la
    // langue en fait partie) : leur etat actif vient donc de `state.facets`,
    // jamais du seul clic qui l a pose.
    const actif = state.facets.has(f.key);
    const chip = el('div', {
      class: 'chip' + (actif ? ' on' : '') + (actif && f.warn ? ' warn' : ''),
      dataset: { key: f.key }, title: 'Filtre rapide'
    }, [
      el('span', { text: t(f.label) }),
      el('span', { class: 'n' })
    ]);
    chip.addEventListener('click', () => {
      state.seen.facet = true;
      if (state.facets.has(f.key)) { state.facets.delete(f.key); chip.classList.remove('on', 'warn'); }
      else { state.facets.add(f.key); chip.classList.add('on'); if (f.warn) chip.classList.add('warn'); }
      render();
    });
    host.appendChild(chip);
  }
}

function facetTest(rec) {
  for (const f of FACETS) if (state.facets.has(f.key) && f.test(rec)) return true;
  return false;
}

function updateFacetCounts() {
  const counts = {};
  for (const id of state.order) {
    const rec = state.records.get(id);
    if (!rec) continue;
    if (state.scope !== 'all') {
      const wanted = state.scope === 'tab' ? state.tabId : Number(state.scope);
      if (wanted != null && rec.tabId !== wanted) continue;
    }
    for (const f of FACETS) if (f.test(rec)) counts[f.key] = (counts[f.key] || 0) + 1;
  }
  for (const chip of $('#facets').querySelectorAll('.chip')) {
    const n = counts[chip.dataset.key] || 0;
    chip.querySelector('.n').textContent = n ? String(n) : '';
  }
}

/* -------------------------------- Recherche ------------------------------- */
export async function runQuery(value) {
  state.query = value;
  if (String(value || '').trim()) state.seen.filter = true;
  state.terms = parseQuery(value);
  if (state.deep && value.trim()) {
    const res = await cmd('search', { query: value.trim(), limit: 200000 });
    if (res.error) { toast(res.error, false); state.deepIds = null; }
    else {
      state.deepIds = new Set(res.records.map(r => r.id));
      for (const rec of res.records) {
        if (!state.records.has(rec.id)) state.order.push(rec.id);
        state.records.set(rec.id, rec);
      }
      state.order.sort((a, b) => a - b);
    }
  } else {
    state.deepIds = null;
  }
  render();
}

/* ------------------------------ Rendu du tableau -------------------------- */
export function currentRows() { return rows; }

/** Lignes sur lesquelles agissent les actions : selection si elle existe. */
export function selectionOrRows() {
  if (!state.selection.size) return rows;
  return rows.filter(r => state.selection.has(r.id));
}

export function render() {
  rows = visibleRecords(facetTest);
  const cmp = (COLUMNS[state.sort.key] || COLUMNS.time).cmp;
  rows.sort(cmp);
  if (state.sort.dir === 'desc') rows.reverse();

  updateFacetCounts();
  updateCount();
  renderRows();
}

export function renderRows() {
  const wrap = $('#tablewrap');
  const body = $('#tbody');
  const H = rowHeight();
  const total = rows.length;

  if (!total) {
    clear(body);
    body.style.paddingTop = '0px';
    body.style.paddingBottom = '0px';
    body.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: t('Aucune requete') }),
      state.query || state.facets.size
        ? t('Aucune ligne ne correspond au filtre. Videz la recherche ou changez de perimetre.')
        : t('Naviguez sur un site : les requetes apparaissent ici en direct.')
    ]));
    return;
  }

  const viewport = wrap.clientHeight || 400;
  const visible = Math.ceil(viewport / H) + OVERSCAN * 2;
  // La position de defilement peut depasser le contenu juste apres un filtrage
  // ou une suppression : on la borne pour ne jamais afficher une page vide.
  const maxFirst = Math.max(0, total - Math.ceil(viewport / H));
  const first = Math.min(maxFirst, Math.max(0, Math.floor(wrap.scrollTop / H) - OVERSCAN));
  const last = Math.min(total, first + visible);

  const columns = activeColumns();
  // Reperes de la cascade : premiere requete affichee et duree totale couverte.
  const firstTime = rows.length ? Math.min(rows[0].startTime, rows[rows.length - 1].startTime) : 0;
  const lastTime = rows.reduce((m, r) => Math.max(m, (r.startTime || 0) + (r.duration || 0)), firstTime);
  const ctx = {
    timeFormat: (state.config && state.config.timeFormat) || 'clock',
    first: firstTime,
    span: Math.max(1, lastTime - firstTime)
  };
  const out = frag();

  for (let i = first; i < last; i++) {
    const rec = rows[i];
    const row = el('div', {
      class: 'trow' + (state.selected === rec.id ? ' sel' : '') + (rec.flag ? ' flagged' : '') +
             (rec.color ? ' mark-' + rec.color : ''),
      dataset: { id: rec.id, index: i },
      title: rec.method + ' ' + rec.url
    });
    if (state.selection.has(rec.id)) row.classList.add('sel');
    for (const key of columns) row.appendChild(COLUMNS[key].cell(rec, ctx));
    out.appendChild(row);
  }

  clear(body);
  // Cales arrondies au pixel : des bords nets, jamais de texte flou.
  body.style.paddingTop = Math.round(first * H) + 'px';
  body.style.paddingBottom = Math.round(Math.max(0, total - last) * H) + 'px';
  body.appendChild(out);
  recalerHauteur(body);   // cale la hauteur sur une vraie ligne pour le prochain rendu
  if (follow) wrap.scrollTop = wrap.scrollHeight;
}

function updateCount() {
  const total = scopeCount();
  const parts = [rows.length + ' ' + t('affichees')];
  if (rows.length !== total) parts.push(t('sur') + ' ' + total);
  if (state.selection.size) parts.push(state.selection.size + ' ' + t('selectionnees'));
  $('#count').textContent = parts.join(' · ');
}

/* ------------------------------- Interactions ----------------------------- */
function onRowClick(ev) {
  const row = ev.target.closest('.trow');
  if (!row) return;
  const id = Number(row.dataset.id);
  const index = Number(row.dataset.index);

  if (ev.target.closest('.star')) { toggleFlag(id); return; }

  if (ev.ctrlKey || ev.metaKey) {
    state.seen.selection = true;
    if (state.selection.has(id)) state.selection.delete(id); else state.selection.add(id);
    lastAnchor = index;
    renderRows(); updateCount();
    return;
  }
  if (ev.shiftKey && lastAnchor != null) {
    const [a, b] = lastAnchor < index ? [lastAnchor, index] : [index, lastAnchor];
    for (let i = a; i <= b; i++) if (rows[i]) state.selection.add(rows[i].id);
    renderRows(); updateCount();
    return;
  }

  lastAnchor = index;
  state.selected = id;
  onOpen && onOpen(id);
  renderRows();
}

async function toggleFlag(id) {
  const res = await cmd('flagRecord', { id });
  if (res.error) return toast(res.error, false);
  const rec = state.records.get(id);
  if (rec) rec.flag = res.flag;
  renderRows();
}

async function deleteSelection() {
  const target = state.selection.size ? [...state.selection] : [];
  if (!target.length) return toast('Selectionnez d abord des lignes (Ctrl+clic)', false);
  const res = await cmd('deleteRecords', { ids: target });
  if (res.error) return toast(res.error, false);
  state.selection.clear();
  toast(res.removed + ' ligne(s) supprimee(s)');
}

/** Ajoute un critere au filtre courant sans effacer ce qui s y trouve deja. */
function applyFilter(term) {
  const input = $('#q');
  const current = input.value.trim();
  input.value = current.includes(term) ? current : (current ? current + ' ' + term : term);
  runQuery(input.value);
}

export function toggleFollow() { setFollow(!follow); }

function setFollow(value) {
  follow = value;
  const btn = $('#follow');
  btn.classList.toggle('on', follow);
  btn.textContent = follow ? t('Suivre') : t('Fige');
  if (follow) { const wrap = $('#tablewrap'); wrap.scrollTop = wrap.scrollHeight; }
}

/* --------------------- Redimensionnement du panneau ----------------------- */
function bindResizer() {
  const resizer = $('#resizer');
  const detail = $('#detail');
  let dragging = false;

  resizer.addEventListener('mousedown', ev => { dragging = true; ev.preventDefault(); });
  window.addEventListener('mouseup', () => { dragging = false; });
  window.addEventListener('mousemove', ev => {
    if (!dragging) return;
    const split = resizer.parentElement.getBoundingClientRect();
    const height = Math.min(split.height - 90, Math.max(120, split.bottom - ev.clientY));
    detail.style.height = height + 'px';
    lastHeightPercent = Math.round((height / split.height) * 100);
    renderRows();
  });
  window.addEventListener('mouseup', () => {
    if (lastHeightPercent != null) {
      saveConfig({ detailHeight: lastHeightPercent });
      lastHeightPercent = null;
    }
  });
}

/** Etat courant du mode « suivre », utile aux autres vues. */
export function isFollowing() { return follow; }
