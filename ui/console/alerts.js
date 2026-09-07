/* Vue « Securite » — toutes les alertes de la capture — INTERCEPTOR (by D4RK) */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { clock, middle, preuveLisible } from '../lib/format.js';
import { state, cmd, toast, copy } from '../app.js';
import { t } from '../lib/i18n.js';

const LEVELS = [
  ['critical', 'Critiques'], ['high', 'Elevees'], ['medium', 'Moyennes'],
  ['low', 'Faibles'], ['info', 'Information']
];

let severityFilter = null;
let ruleFilter = null;
let cache = { findings: [], counts: {} };
let loading = false;
let loaded = false;

function scopeTab() {
  if (state.scope === 'all') return null;
  if (state.scope === 'tab') return state.tabId;
  const n = Number(state.scope);
  return Number.isFinite(n) ? n : null;
}

async function load() {
  if (loading) return;
  loading = true;
  const res = await cmd('findings', { tabId: scopeTab(), limit: 20000 });
  loading = false;
  loaded = true;
  if (res.error) { toast(res.error, false); return; }
  cache = res;
  render();
}

export function render() {
  const pane = clear($('#view-alerts'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  box.appendChild(sec('Alertes detectees', 'analyse automatique de chaque requete'));

  const tiles = el('div', { class: 'tiles' });
  const counts = cache.counts || {};
  for (const [key, label] of LEVELS) {
    const tile = el('div', {
      class: 'tile' + (key === 'critical' || key === 'high' ? ' alert' : '') + (key === 'critical' && counts[key] ? ' hot' : ''),
      title: 'Cliquer pour ne garder que ce niveau'
    }, [
      el('b', { text: String(counts[key] || 0) }),
      el('label', { text: t(label) })
    ]);
    tile.addEventListener('click', () => {
      severityFilter = severityFilter === key ? null : key;
      render();
    });
    if (severityFilter === key) tile.style.borderColor = 'var(--accent)';
    tiles.appendChild(tile);
  }
  box.appendChild(tiles);

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Actualiser', load));
  actions.appendChild(button('Tout reanalyser', async () => {
    toast('Analyse en cours…');
    const res = await cmd('analyzeAll', {});
    if (res.error) return toast(res.error, false);
    toast(res.analyzed + ' requetes reanalysees');
    load();
  }));
  actions.appendChild(button('Exporter le rapport', async () => {
    const res = await cmd('exportFile', { format: 'findings', tabId: scopeTab() });
    if (res.error) return toast(res.error, false);
    toast('Rapport ecrit — ' + res.filename);
  }));
  actions.appendChild(button('Copier la synthese', () => {
    const lines = filtered().map(f => f.severity + '\t' + f.title + '\t' + f.where + '\t' + f.url);
    copy(lines.join('\n'), lines.length + ' alertes copiees');
  }));
  if (severityFilter || ruleFilter) {
    actions.appendChild(button('Retirer les filtres', () => { severityFilter = null; ruleFilter = null; render(); }));
  }
  box.appendChild(actions);

  if (!cache.findings.length) {
    box.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: 'Aucune alerte' }),
      loading ? 'Lecture en cours…' : 'Aucune alerte sur le perimetre observe. Cliquez sur « Actualiser » apres avoir navigue.'
    ]));
    if (!loading && !loaded) load();
    return;
  }

  // Familles de regles presentes : filtre secondaire.
  const rules = [...new Set(cache.findings.map(f => f.rule))].sort();
  const chips = el('div', { class: 'facets' });
  for (const rule of rules) {
    const chip = el('div', { class: 'chip' + (ruleFilter === rule ? ' on' : '') }, [
      el('span', { text: rule }),
      el('span', { class: 'n', text: String(cache.findings.filter(f => f.rule === rule).length) })
    ]);
    chip.addEventListener('click', () => { ruleFilter = ruleFilter === rule ? null : rule; render(); });
    chips.appendChild(chip);
  }
  box.appendChild(chips);

  const list = filtered();
  box.appendChild(sec('Detail', list.length + ' alerte(s)'));
  if (!list.length) {
    box.appendChild(el('p', { class: 'note', text: 'Aucune alerte ne correspond aux filtres choisis.' }));
    return;
  }

  for (const f of list.slice(0, 2000)) {
    const card = el('div', { class: 'find ' + f.severity, title: 'Cliquer pour ouvrir la requete' }, [
      el('h4', { text: t(f.title) }),
      el('p', { text: f.severity.toUpperCase() + '  ·  ' + f.where + (f.sample ? '  ·  ' + f.sample : '') }),
      f.preuve ? el('p', { class: 'note', text: t('Preuve : ') + preuveLisible(f) }) : null,
      el('p', { text: f.method + ' ' + middle(f.url, 110) + '   ·   ' + clock(f.startTime) + '   ·   #' + f.id })
    ]);
    card.addEventListener('click', () => {
      document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id: f.id } }));
    });
    box.appendChild(card);
  }
  if (list.length > 2000) {
    box.appendChild(el('p', { class: 'note', text: (list.length - 2000) + ' alertes supplementaires : affinez le filtre ou exportez le rapport complet.' }));
  }
}

function filtered() {
  return cache.findings.filter(f =>
    (!severityFilter || f.severity === severityFilter) &&
    (!ruleFilter || f.rule === ruleFilter));
}
