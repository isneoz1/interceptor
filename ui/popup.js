/* ============================================================
 * INTERCEPTOR — fenetre compacte  (cree par D4RK)
 *
 * Poste de veille : etat de la capture, chiffres cles, dernieres requetes,
 * filtres rapides. Tout le detail se trouve dans la console complete, qui
 * s ouvre d un clic (ou automatiquement si le reglage le demande).
 * ============================================================ */
import { $, el, clear } from './lib/dom.js';
import { bytes, ms, statusClass, statusText } from './lib/format.js';
import { parseQuery } from './lib/filters.js';
import { t } from './lib/i18n.js';
import {
  B, cmd, state, toast, dropdown, connect, bootstrap, visibleRecords, scopeCount
} from './app.js';

const MAX_ROWS = 120;

const QUICK = [
  ['Alertes', 'risk:critical'],
  ['Erreurs', 'status:>=400'],
  ['API', 'type:xmlhttprequest'],
  ['Flux', 'ws:>0'],
  ['Tiers', 'third:oui'],
  ['Epinglees', 'flag:oui']
];

let pending = null;

function scheduleRender() {
  if (pending) return;
  pending = setTimeout(() => { pending = null; render(); }, 160);
}

/* -------------------------------- Affichage ------------------------------- */
function render() {
  const rows = visibleRecords();
  const total = scopeCount();
  $('#s-total').textContent = String(rows.length);
  $('#s-total-label').textContent = rows.length === total ? t('requetes') : t('sur') + ' ' + total;

  const list = clear($('#list'));
  if (!rows.length) {
    list.appendChild(el('li', { class: 'empty' }, [
      el('b', { text: t('Aucune requete') }),
      state.scope === 'tab'
        ? 'Rien sur cet onglet. Naviguez, ou basculez sur « Tout Firefox ».'
        : 'Rien de capture pour le moment.'
    ]));
    return;
  }

  const slice = rows.length > MAX_ROWS ? rows.slice(-MAX_ROWS) : rows;
  const frag = document.createDocumentFragment();
  for (let i = slice.length - 1; i >= 0; i--) frag.appendChild(buildRow(slice[i]));
  list.appendChild(frag);

  if (rows.length > MAX_ROWS) {
    list.appendChild(el('li', { class: 'empty', text:
      (rows.length - MAX_ROWS) + ' lignes plus anciennes — la console complete les affiche toutes.' }));
  }
}

function buildRow(rec) {
  const li = el('li', { class: 'row', dataset: { id: rec.id }, title: rec.url });
  li.appendChild(el('span', { class: 'risk ' + (rec.risk && rec.risk !== 'none' ? rec.risk : '') }));
  li.appendChild(el('span', { class: 'meth m-' + rec.method, text: rec.method }));
  li.appendChild(el('span', {
    class: 'st ' + statusClass(rec) + (rec.state === 'pending' ? ' pending' : ''),
    text: statusText(rec)
  }));
  const u = el('span', { class: 'u' }, [
    el('span', { class: 'h', text: rec.host || rec.scheme || '—' }),
    el('span', { class: 'p', text: rec.path || '/' })
  ]);
  li.appendChild(u);
  const meta = el('span', { class: 'sz' }, rec.size ? bytes(rec.size) : '—');
  meta.appendChild(el('i', { text: rec.duration != null ? ms(rec.duration) : '' }));
  li.appendChild(meta);
  return li;
}

function renderStats() {
  const s = state.stats;
  if (!s) return;
  $('#s-rate').textContent = String(state.rate);
  $('#s-merged').textContent = String(s.dedup.merged);
  $('#s-alerts').textContent = String(s.analyzer.findings);
  const hot = s.analyzer.bySeverity.critical + s.analyzer.bySeverity.high > 0;
  document.querySelector('.tile.alert').classList.toggle('hot', hot);
}

function applyCapture() {
  const on = !state.config || state.config.capturing;
  const btn = $('#capture');
  btn.classList.toggle('paused', !on);
  $('#capture-label').textContent = on ? t('Capture') : t('En pause');
  btn.title = on ? 'Capture active — cliquer pour mettre en pause'
                 : 'En pause — cliquer pour reprendre';
}

function buildQuick() {
  const host = clear($('#quick'));
  for (const [label, query] of QUICK) {
    const chip = el('div', { class: 'chip', title: t('Filtre') + ' : ' + query }, t(label));
    chip.addEventListener('click', () => {
      const input = $('#q');
      input.value = input.value === query ? '' : query;
      state.terms = parseQuery(input.value);
      render();
    });
    host.appendChild(chip);
  }
  const all = el('div', { class: 'chip', title: t('Effacer le filtre') }, t('Tout'));
  all.addEventListener('click', () => { $('#q').value = ''; state.terms = []; render(); });
  host.appendChild(all);
}

/* ------------------------------ Interactions ------------------------------ */
function bind() {
  $('#capture').addEventListener('click', async () => {
    const res = await cmd('toggleCapture', {});
    if (res.error) return toast(res.error, false);
    if (state.config) state.config.capturing = res.capturing;
    applyCapture();
    toast(res.capturing ? 'Capture reprise' : 'Capture en pause');
  });

  let timer = null;
  $('#q').addEventListener('input', ev => {
    clearTimeout(timer);
    const value = ev.target.value;
    timer = setTimeout(() => { state.terms = parseQuery(value); render(); }, 170);
  });

  $('#scope').addEventListener('change', ev => { state.scope = ev.target.value; render(); });

  $('#list').addEventListener('click', ev => {
    const row = ev.target.closest('.row');
    if (!row) return;
    // La popup se ferme des qu on ouvre un onglet : on delegue au noyau.
    cmd('openConsole', { view: 'requests', id: Number(row.dataset.id) });
    window.close();
  });

  $('#console').addEventListener('click', () => {
    cmd('openConsole', { view: 'requests' });
    window.close();
  });

  $('#sidebar').addEventListener('click', async () => {
    try { await B.sidebarAction.open(); window.close(); }
    catch { toast('Ouvrez le panneau avec Alt+Shift+S', false); }
  });

  $('#clear').addEventListener('click', async () => {
    const res = await cmd('clear', {});
    if (res.error) return toast(res.error, false);
    state.records.clear();
    state.order.length = 0;
    render();
    toast('Capture videe');
  });

  dropdown($('#export'), () => [
    { kind: 'head', label: 'Requetes filtrees' },
    { label: 'HAR 1.2', action: () => exportAs('har') },
    { label: 'JSON complet', action: () => exportAs('json') },
    { label: 'Tableau CSV', action: () => exportAs('csv') },
    { label: 'Rapport d alertes', action: () => exportAs('findings') },
    { label: 'Script cURL', action: () => exportAs('curl') },
    { label: 'Liste d URL', action: () => exportAs('urls') },
    { kind: 'sep' },
    { label: 'Ouvrir la boite a outils', action: () => { cmd('openConsole', { view: 'tools' }); window.close(); } },
    { label: 'Ouvrir les reglages', action: () => { cmd('openConsole', { view: 'settings' }); window.close(); } },
    { label: 'Ouvrir l aide', action: () => { cmd('openConsole', { view: 'help' }); window.close(); } }
  ], { up: true });

  document.addEventListener('keydown', ev => {
    if (ev.target.matches('input, select')) return;
    if (ev.key === '/') { ev.preventDefault(); $('#q').focus(); }
  });
}

async function exportAs(format) {
  const rows = visibleRecords();
  if (!rows.length) return toast('Rien a exporter', false);
  toast('Preparation de l export…');
  const res = await cmd('exportFile', { format, ids: rows.map(r => r.id) });
  if (res.error) return toast(res.error, false);
  toast(res.count + ' requetes exportees');
}

/* -------------------------------- Demarrage ------------------------------- */
/* Libelles statiques de la fenetre compacte, dans la langue choisie. */
function applyLabels() {
  const set = (selector, text, title) => {
    const node = $(selector);
    if (!node) return;
    if (text != null) node.textContent = t(text);
    if (title != null) node.title = t(title);
  };
  set('#console', 'Console complete', 'Ouvrir la console complete dans un onglet');
  set('#sidebar', 'Panneau', 'Ouvrir le panneau lateral');
  set('#export', 'Exporter');
  set('#clear', 'Vider');

  const labels = document.querySelectorAll('.tile label');
  const texts = ['requetes', 'req/s', 'fusions', 'alertes'];
  for (let i = 1; i < labels.length; i++) {
    if (texts[i]) labels[i].textContent = t(texts[i]);
  }

  const scope = $('#scope');
  if (scope && scope.options && scope.options.length >= 2) {
    scope.options[0].textContent = t('Cet onglet');
    scope.options[1].textContent = t('Tout Firefox');
  }
  const q = $('#q');
  if (q) q.placeholder = t('Filtrer…  method:POST  status:5xx');
}

(async function boot() {
  bind();
  buildQuick();

  connect({
    onDelta: scheduleRender,
    onStats: renderStats,
    onClear: render,
    onRemoved: render,
    onConfig: () => { applyCapture(); }
  });

  const ok = await bootstrap();
  if (!ok) toast('Noyau indisponible', false);
  applyLabels();
  buildQuick();
  $('#scope').value = state.scope;
  applyCapture();
  renderStats();
  render();
})();
