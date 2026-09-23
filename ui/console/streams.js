/* Vue « Flux temps reel » — WebSocket et Server-Sent Events — INTERCEPTOR (by NeoZ)
 *
 * Les trames arrivent en continu : cette vue suit un flux choisi et affiche
 * chaque message dans l ordre, sans en masquer aucun.
 */
import { $, el, clear, sec, button, kv, add, vide } from '../lib/dom.js';
import { redessinerEnPlace } from '../lib/redessin.js';

import { bytes, clock, middle } from '../lib/format.js';
import { state, cmd, toast, copy } from '../app.js';
import { t, tp } from '../lib/i18n.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { decrireFermetureWs } from '../lib/ref-reseau.js';
import { resumerTrame, resumerTrameBinaire, contexteDeConnexion, lectureBinairePossible }
  from '../lib/sous-protocoles.js';
import { base64VersOctets } from '../lib/bytes.js';

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

/* Un seul rendu progressif a la fois par liste : redessiner coupe le precedent.
   Deux listes ici — les flux, puis les messages du flux choisi. */
let rendu = null;
let renduMessages = null;
function arreterRendu() {
  if (rendu) { rendu.arreter(); rendu = null; }
  if (renduMessages) { renduMessages.arreter(); renduMessages = null; }
}

/* Redessiner recree le cadre qui defile et le champ de filtre :
   redessinerEnPlace garde la position du lecteur, le focus et le curseur.
   Sans cela, le lecteur remontait en haut a chaque redessin, et seule la
   premiere lettre tapee dans le filtre comptait. */
/* `enHaut` : l utilisateur change ce qu il regarde — un autre flux, une
   autre direction, un autre filtre — et repart donc du debut. */
export function render(enHaut = false) { return redessinerEnPlace($('#view-streams'), dessiner, enHaut === true); }

function dessiner() {
  const pane = clear($('#view-streams'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  const rows = streamRows();
  box.appendChild(sec('Flux ouverts et fermes', tp('{n} flux', { n: rows.length })));

  if (!rows.length) {
    box.appendChild(vide('Aucun flux',
      'Aucun WebSocket ni Server-Sent Event sur le perimetre observe.'));
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
    tile.addEventListener('click', () => { selected = rec.id; record = null; load(true); render(true); });
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
    actions.appendChild(button(label, () => { dirFilter = key; render(true); }, { class: dirFilter === key ? 'on' : '' }));
  }
  actions.appendChild(button('Ouvrir la requete', () => {
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id: selected } }));
  }));
  box.appendChild(actions);

  const search = el('input', { type: 'search', class: 'field', placeholder: 'Filtrer les messages…', value: needle,
    dataset: { champ: 'flux-filtre' } });
  search.addEventListener('input', () => { needle = search.value; render(true); });
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

  /* Par lots, comme l onglet Flux du detail : une session de dizaines de
     milliers de messages ne fige pas la vue, et aucun n est ecarte — la suite
     arrive au defilement. Le sous-protocole negocie et l URL levent les
     ambiguites : sans eux, une trame « 2 » n est la preuve de rien. */
  const contexte = contexteDeConnexion(record);
  const messages = el('div');
  box.appendChild(messages);
  renduMessages = listeProgressive(messages, shown, f => {
    const resume = f.brute ? lectureMemorisee(f, contexte) : null;
    return el('div', { class: 'frame full ' + (f.dir === 'send' ? 'send' : 'recv') }, [
      el('b', { text: (f.dir === 'send' ? '↑ ' : '↓ ') + clock(f.ts) }),
      /* Le resume du sous-protocole precede la trame, qui reste entiere en
         dessous : on ajoute une lecture, on n en retire jamais. */
      resume ? el('i', { class: 'sous-protocole', text: resume }) : null,
      el('span', { text: f.text })
    ]);
  });
}

/* La ligne de sous-protocole d une trame entiere, texte ou binaire. Une trame
   tronquee a la capture n est pas lue : elle paraitrait incomplete par notre
   fait. Au-dela de 8 Kio, un binaire ne se lit pas du coin de l oeil — et sans
   sous-protocole binaire connu, ses octets ne sont meme pas decodes. */
function lecture(f, contexte) {
  if (f.truncated) return null;
  if (f.data != null) return resumerTrame(f.data, contexte);
  if (!f.base64 || f.size > 8192 || !lectureBinairePossible(contexte)) return null;
  try { return resumerTrameBinaire(base64VersOctets(f.base64), contexte); } catch { return null; }
}

/* Une trame capturee ne change plus : sa lecture se calcule une fois. La vue
   se redessine a chaque frappe dans le filtre et toutes les 900 ms en suivi
   automatique ; sans ce cache, chaque redessin relisait toute la session. La
   cle porte le contexte : un CONNECT MQTT arrive apres coup change la lecture. */
let cacheLectures = new Map();
let cleCache = '';

function lectureMemorisee(f, contexte) {
  const cle = record.id + '|' + contexte.sousProtocole + '|' + contexte.niveauMqtt + '|' + contexte.url;
  if (cle !== cleCache) { cacheLectures = new Map(); cleCache = cle; }
  if (!cacheLectures.has(f.index)) cacheLectures.set(f.index, lecture(f.brute, contexte));
  return cacheLectures.get(f.index);
}

/* Ce dont le filtre a besoin, et rien d autre : la lecture du sous-protocole
   n est calculee que pour les lignes reellement dessinees. */
function collectFrames(rec) {
  const out = [];
  (rec.ws && rec.ws.frames || []).forEach((f, index) => {
    out.push({
      dir: f.dir, ts: f.ts, index, brute: f,
      text: (f.data != null ? f.data : '[' + f.opcode + ' ' + bytes(f.size) + ']') + (f.truncated ? ' …' + t('tronquee') : '')
    });
  });
  for (const m of (rec.sse && rec.sse.messages) || []) {
    out.push({ dir: 'recv', ts: m.ts, text: '[' + m.event + '] ' + m.data });
  }
  return out.sort((a, b) => a.ts - b.ts);
}
