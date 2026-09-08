/* Vues « Cookies », « Navigation » et « Contexte » — INTERCEPTOR (by NeoZ)
 *
 * Trois journaux tenus par le noyau, affiches ici en entier : chaque entree
 * est visible, avec son heure exacte et son detail complet.
 */
import { $, el, clear, sec, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { clock, middle } from '../lib/format.js';
import { cmd, toast, copy } from '../app.js';

const KINDS = {
  cookies: {
    view: '#view-cookies', title: 'Journal des cookies',
    note: 'Toute pose, modification ou suppression de cookie observee par Firefox, y compris celles faites en JavaScript et invisibles dans les entetes.'
  },
  navigation: {
    view: '#view-navigation', title: 'Journal de navigation',
    note: 'Les huit evenements de webNavigation : debut, validation, DOM, chargement, erreurs, nouvelles cibles, fragments et historique.'
  },
  context: {
    view: '#view-context', title: 'Journal de contexte',
    note: 'Workers, Service Workers, WebRTC, etat des sondes de page : ce que le reseau seul ne montre pas.'
  }
};

const cache = {};
const filters = {};

async function load(kind) {
  const res = await cmd('logs', { kind, limit: 20000 });
  if (res.error) { toast(res.error, false); return; }
  cache[kind] = res.entries || [];
  render(kind);
}

export function render(kind) {
  const meta = KINDS[kind];
  if (!meta) return;
  const pane = clear($(meta.view));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  const entries = cache[kind];
  box.appendChild(sec(meta.title, entries ? entries.length + ' entree(s)' : ''));
  box.appendChild(el('p', { class: 'note', text: meta.note }));

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Actualiser', () => load(kind)));
  actions.appendChild(button('Copier', () => {
    const lines = shown(kind).map(e => clock(e.ts) + '\t' + describe(kind, e));
    copy(lines.join('\n'), lines.length + ' lignes copiees');
  }));
  actions.appendChild(button('Vider ce journal', async () => {
    const res = await cmd('clearLogs', { kind });
    if (res.error) return toast(res.error, false);
    cache[kind] = [];
    toast('Journal vide');
    render(kind);
  }, { class: 'danger' }));
  box.appendChild(actions);

  const search = el('input', {
    type: 'search', class: 'field', placeholder: 'Filtrer ce journal…',
    value: filters[kind] || ''
  });
  search.addEventListener('input', () => { filters[kind] = search.value; render(kind); });
  box.appendChild(search);

  if (!entries) {
    box.appendChild(el('p', { class: 'note', text: 'Lecture du journal…' }));
    load(kind);
    return;
  }

  const list = shown(kind);
  if (!list.length) {
    box.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: 'Journal vide' }),
      entries.length ? 'Aucune entree ne correspond au filtre.' : 'Aucun evenement de ce type pour le moment.'
    ]));
    return;
  }

  /* La liste est rendue par lots : la plus recente d abord, la suite quand le
     lecteur descend. Rien n est coupe — une entree journalisee reste
     atteignable, quel qu en soit le nombre. */
  const host = el('div');
  box.appendChild(host);
  const ordre = [...list].reverse();
  arreterRendu();
  rendu = listeProgressive(host, ordre, e => el('div', { class: 'log' }, [
    el('span', { class: 'ts', text: clock(e.ts) }),
    el('b', { text: t(label(kind, e)) }),
    el('span', { text: describe(kind, e) })
  ]));
}

/* Un seul rendu progressif a la fois : changer de journal ou de filtre coupe
   le precedent, sinon deux observateurs continueraient d alimenter la page. */
let rendu = null;
function arreterRendu() { if (rendu) { rendu.arreter(); rendu = null; } }

function shown(kind) {
  const needle = String(filters[kind] || '').toLowerCase();
  const list = cache[kind] || [];
  if (!needle) return list;
  return list.filter(e => (label(kind, e) + ' ' + describe(kind, e)).toLowerCase().includes(needle));
}

function label(kind, e) {
  if (kind === 'cookies') return e.removed ? 'supprime' : (e.cause || 'pose');
  if (kind === 'navigation') return e.kind || '—';
  return e.kind || '—';
}

function describe(kind, e) {
  if (kind === 'cookies') {
    const flags = [e.secure ? 'Secure' : null, e.httpOnly ? 'HttpOnly' : null,
                   e.sameSite ? 'SameSite=' + e.sameSite : 'SameSite absent',
                   e.session ? 'session' : null].filter(Boolean).join(' ');
    return e.name + ' @' + e.domain + (e.path || '') + '  [' + flags + ']' +
           (e.partitionKey ? '  partition ' + JSON.stringify(e.partitionKey) : '') +
           (e.value ? '  =  ' + middle(e.value, 80) : '');
  }
  if (kind === 'navigation') {
    return 'onglet ' + e.tabId + ' / cadre ' + e.frameId + '  ' + middle(e.url || '', 110) +
           (e.transitionType ? '  (' + e.transitionType + ')' : '') +
           (e.transitionQualifiers && e.transitionQualifiers.length ? ' [' + e.transitionQualifiers.join(',') + ']' : '') +
           (e.error ? '  ERREUR ' + e.error : '');
  }
  return middle(e.url || '', 100) +
         (e.detail ? '   ' + middle(JSON.stringify(e.detail), 160) : '') +
         (e.frameUrl && e.frameUrl !== e.url ? '   cadre ' + middle(e.frameUrl, 60) : '');
}
