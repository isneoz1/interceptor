/* Vue « Flux temps reel » — WebSocket et Server-Sent Events — INTERCEPTOR (by NeoZ)
 *
 * Les trames arrivent en continu : cette vue suit un flux choisi et affiche
 * chaque message dans l ordre, sans en masquer aucun.
 */
import { $, el, clear, sec, button, kv, add } from '../lib/dom.js';
import { bytes, clock, middle } from '../lib/format.js';
import { state, cmd, toast, copy } from '../app.js';
import { t } from '../lib/i18n.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { decrireFermetureWs } from '../lib/ref-reseau.js';

let selected = null;
let record = null;
let auto = true;
let dirFilter = 'all';
let needle = '';
let lastFetch = 0;

function streamRows() {
  const out = [];
  for (const id of state.order) {
    const rec = state.records.get(id);
    if (!rec) continue;
    if (state.scope !== 'all') {
      const wanted = state.scope === 'tab' ? state.tabId : Number(state.scope);
      if (wanted != null && rec.tabId !== wanted) continue;
    }
    if (rec.wsFrames > 0 || rec.sseEvents > 0 || rec.type === 'websocket') out.push(rec);
  }
  return out.reverse();
}

async function load(force) {
  if (selected == null) return;
  if (!force && Date.now() - lastFetch < 900) return;
  lastFetch = Date.now();
  const res = await cmd('record', { id: selected });
  if (res.error) { toast(res.error, false); return; }
  record = res.record;
  render();
}

/* Un seul rendu progressif a la fois : changer de perimetre coupe le precedent. */
let rendu = null;
function arreterRendu() { if (rendu) { rendu.arreter(); rendu = null; } }

export function render() {
  const pane = clear($('#view-streams'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  const rows = streamRows();
  box.appendChild(sec('Flux ouverts et fermes', rows.length + ' flux'));

  if (!rows.length) {
    box.appendChild(el('div', { class: 'empty' }, [
      el('b', { text: 'Aucun flux' }),
      'Aucun WebSocket ni Server-Sent Event sur le perimetre observe.'
    ]));
    return;
  }

  /* Rendu par lots : aucune connexion n est ecartee, et la vue ne fige pas
     quand une session en compte des milliers. */
  const list = el('div', { class: 'tiles' });
  box.appendChild(list);
  arreterRendu();
  rendu = listeProgressive(list, rows, rec => {
    const tile = el('div', {
      class: 'tile' + (selected === rec.id ? ' ok' : ''),
      title: rec.url
    }, [
      el('b', { text: String(rec.wsFrames || rec.sseEvents || 0) }),
      el('label', { text: (rec.wsFrames ? 'trames · ' : 'messages · ') + middle(rec.host, 26) }),
      el('label', { text: middle(rec.path, 30) + '  ·  ' + rec.state })
    ]);
    tile.addEventListener('click', () => { selected = rec.id; record = null; load(true); render(); });
    return tile;
  });

  if (selected == null) {
    box.appendChild(el('p', { class: 'note', text: 'Choisissez un flux pour voir ses messages.' }));
    return;
  }

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Rafraichir', () => load(true)));
  const autoBtn = button(auto ? 'Suivi automatique : oui' : 'Suivi automatique : non', () => {
    auto = !auto; render(); if (auto) load(true);
  }, { class: auto ? 'on' : '' });
  actions.appendChild(autoBtn);
  for (const [key, label] of [['all', 'Tout'], ['send', 'Envoyees'], ['recv', 'Recues']]) {
    actions.appendChild(button(label, () => { dirFilter = key; render(); }, { class: dirFilter === key ? 'on' : '' }));
  }
  actions.appendChild(button('Ouvrir la requete', () => {
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id: selected } }));
  }));
  box.appendChild(actions);

  const search = el('input', { type: 'search', class: 'field', placeholder: 'Filtrer les messages…', value: needle });
  search.addEventListener('input', () => { needle = search.value; render(); });
  box.appendChild(search);

  if (auto) load(false);

  if (!record) {
    box.appendChild(el('p', { class: 'note', text: 'Lecture du flux…' }));
    return;
  }

  box.appendChild(sec('Flux #' + record.id, record.method + ' ' + middle(record.finalUrl || record.url, 90)));
  add(box, kv('Etat', record.state));
  if (record.ws) {
    add(box, kv('Trames', record.ws.sent + ' envoyees / ' + record.ws.received + ' recues'));
    add(box, kv('Volume', bytes(record.ws.bytesSent) + ' envoyes / ' + bytes(record.ws.bytesReceived) + ' recus'));
    if (record.ws.close) {
      add(box, kv('Fermeture', 'code ' + record.ws.close.code + ' · ' + (record.ws.close.reason || 'sans motif')));
      // Un code de fermeture nu n apprend rien : la table de reference le dit.
      const fin = decrireFermetureWs(record.ws.close.code);
      if (fin) add(box, kv('Sens du code', t(fin.nom) + ' — ' + t(fin.sens)));
    }
  }

  const frames = collectFrames(record);
  const shown = frames.filter(f =>
    (dirFilter === 'all' || f.dir === dirFilter) &&
    (!needle || String(f.text).toLowerCase().includes(needle.toLowerCase())));

  box.appendChild(sec('Messages', shown.length + ' sur ' + frames.length));
  box.appendChild(el('div', { class: 'actions' },
    button('Copier les messages affiches', () =>
      copy(shown.map(f => (f.dir === 'send' ? '> ' : '< ') + f.text).join('\n'), shown.length + ' messages copies'))));

  for (const f of shown) {
    box.appendChild(el('div', { class: 'frame full ' + (f.dir === 'send' ? 'send' : 'recv') }, [
      el('b', { text: (f.dir === 'send' ? '↑ ' : '↓ ') + clock(f.ts) }),
      el('span', { text: f.text })
    ]));
  }
}

function collectFrames(rec) {
  const out = [];
  for (const f of (rec.ws && rec.ws.frames) || []) {
    out.push({
      dir: f.dir, ts: f.ts,
      text: (f.data != null ? f.data : '[' + f.opcode + ' ' + bytes(f.size) + ']') + (f.truncated ? ' …tronque' : '')
    });
  }
  for (const m of (rec.sse && rec.sse.messages) || []) {
    out.push({ dir: 'recv', ts: m.ts, text: '[' + m.event + '] ' + m.data });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
