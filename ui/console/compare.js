/* Vue « Comparaison » — deux requetes cote a cote — INTERCEPTOR (by NeoZ)
 *
 * Selectionnez exactement deux lignes (Ctrl+clic) puis « Comparer ».
 * Les entetes et les corps sont confrontes ligne a ligne : ce qui est identique
 * est grise, ce qui change est marque. Rien n est resume ni tronque en silence.
 */
import { $, el, clear, sec, button, kv, add, vide } from '../lib/dom.js';
import { bytes, ms, clock, middle, pretty } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { state, cmd, toast, copy } from '../app.js';

const MAX_DIFF_LINES = 1200;

let left = null;
let right = null;
let loading = false;

/** Charge les deux enregistrements complets a partir de la selection. */
export async function loadSelection() {
  const ids = [...state.selection].slice(0, 2);
  if (ids.length !== 2) { left = right = null; render(); return; }
  loading = true;
  render();
  const [a, b] = await Promise.all([
    cmd('record', { id: ids[0] }),
    cmd('record', { id: ids[1] })
  ]);
  loading = false;
  if (a.error || b.error) { toast(a.error || b.error, false); left = right = null; }
  else { left = a.record; right = b.record; }
  render();
}

/* ----------------------------- Comparaisons ------------------------------ */
function headerMap(list) {
  const map = new Map();
  for (const h of list || []) {
    const key = String(h.name || '').toLowerCase();
    map.set(key, map.has(key) ? map.get(key) + ', ' + h.value : String(h.value ?? ''));
  }
  return map;
}

function diffHeaders(a, b) {
  const A = headerMap(a);
  const B = headerMap(b);
  const keys = [...new Set([...A.keys(), ...B.keys()])].sort();
  return keys.map(key => {
    const va = A.get(key);
    const vb = B.get(key);
    if (va === undefined) return { key, kind: 'add', a: '', b: vb };
    if (vb === undefined) return { key, kind: 'del', a: va, b: '' };
    if (va !== vb) return { key, kind: 'mod', a: va, b: vb };
    return { key, kind: 'same', a: va, b: vb };
  });
}

/** Diff de lignes par plus longue sous-sequence commune. */
function diffLines(a, b) {
  const A = String(a || '').split('\n');
  const B = String(b || '').split('\n');
  if (A.length > MAX_DIFF_LINES || B.length > MAX_DIFF_LINES) {
    const setB = new Set(B);
    const setA = new Set(A);
    return [
      ...A.filter(l => !setB.has(l)).map(line => ({ kind: 'del', line })),
      ...B.filter(l => !setA.has(l)).map(line => ({ kind: 'add', line }))
    ];
  }

  const n = A.length, m = B.length;
  const table = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i][j] = A[i] === B[j] ? table[i + 1][j + 1] + 1
                                  : Math.max(table[i + 1][j], table[i][j + 1]);
    }
  }

  const out = [];
  let i = 0, j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) { out.push({ kind: 'same', line: A[i] }); i++; j++; }
    else if (table[i + 1][j] >= table[i][j + 1]) { out.push({ kind: 'del', line: A[i] }); i++; }
    else { out.push({ kind: 'add', line: B[j] }); j++; }
  }
  while (i < n) out.push({ kind: 'del', line: A[i++] });
  while (j < m) out.push({ kind: 'add', line: B[j++] });
  return out;
}

const SIGN = { add: '+', del: '−', mod: '~', same: ' ' };

function lineNode(kind, text) {
  return el('div', { class: 'dline ' + kind }, [
    el('span', { class: 'sign', text: SIGN[kind] || ' ' }),
    el('span', { text })
  ]);
}

/* -------------------------------- Rendu ---------------------------------- */
export function render() {
  const pane = clear($('#view-compare'));
  const box = el('div', { class: 'pane' });
  pane.appendChild(box);

  box.appendChild(sec('Comparaison de deux requetes',
    left && right ? '#' + left.id + '  vs  #' + right.id : ''));

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Reprendre la selection', loadSelection, { class: 'accent' }));
  if (left && right) {
    actions.appendChild(button('Echanger', () => { const garde = left; left = right; right = garde; render(); }));
    actions.appendChild(button('Ouvrir la gauche', () =>
      document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id: left.id } }))));
    actions.appendChild(button('Ouvrir la droite', () =>
      document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id: right.id } }))));
    actions.appendChild(button('Copier la comparaison', () => copy(textDiff(), 'Comparaison copiee')));
  }
  box.appendChild(actions);

  if (loading) { box.appendChild(el('p', { class: 'note', text: 'Lecture des deux enregistrements…' })); return; }

  if (!left || !right) {
    box.appendChild(vide('Selectionnez deux lignes',
      'Dans le tableau : Ctrl+clic sur une premiere ligne, Ctrl+clic sur une seconde, puis cliquez sur « Comparer ». Vous pouvez aussi comparer une requete avec son rejeu.'));
    return;
  }

  /* --- Identite cote a cote --- */
  const cols = el('div', { class: 'diff' });
  for (const [rec, side] of [[left, 'Gauche'], [right, 'Droite']]) {
    const col = el('div', { class: 'diff-col' });
    col.appendChild(el('h4', { text: side + ' · #' + rec.id }));
    add(col, kv('Methode', rec.method, { hl: true }));
    add(col, kv('URL', middle(rec.finalUrl || rec.url, 90)));
    add(col, kv('Statut', rec.statusLine || rec.statusCode || rec.error || 'en cours'));
    add(col, kv('Heure', clock(rec.startTime)));
    add(col, kv('Duree', rec.duration != null ? ms(rec.duration) : null));
    add(col, kv('Taille', rec.size ? bytes(rec.size) : null));
    add(col, kv('Serveur', rec.ip));
    add(col, kv('Protocole', rec.perf && rec.perf.nextHopProtocol));
    add(col, kv('TLS', rec.security && rec.security.protocolVersion));
    add(col, kv('Couches', (rec.sources || []).join(' + ')));
    add(col, kv('Alertes', rec.analysis ? rec.analysis.findings.length : 0));
    cols.appendChild(col);
  }
  box.appendChild(cols);

  /* --- Ecarts mesures --- */
  box.appendChild(sec('Ecarts mesures'));
  const deltaDuration = (left.duration ?? 0) - (right.duration ?? 0);
  const deltaSize = (left.size || 0) - (right.size || 0);
  add(box, kv('Difference de duree', (deltaDuration >= 0 ? '+' : '−') + ms(Math.abs(deltaDuration))));
  add(box, kv('Difference de taille', (deltaSize >= 0 ? '+' : '−') + bytes(Math.abs(deltaSize))));
  add(box, kv('Meme URL', (left.finalUrl || left.url) === (right.finalUrl || right.url) ? t('oui') : t('non'), { hl: true }));
  add(box, kv('Meme statut', left.statusCode === right.statusCode ? t('oui') : t('non'), { hl: true }));

  /* --- Entetes --- */
  renderHeaderDiff(box, 'Entetes envoyees', left.requestHeaders, right.requestHeaders);
  renderHeaderDiff(box, 'Entetes recues', left.responseHeaders, right.responseHeaders);

  /* --- Corps --- */
  renderBodyDiff(box, 'Corps envoye',
    left.requestBody && left.requestBody.text, right.requestBody && right.requestBody.text,
    left.requestBody && left.requestBody.contentType);
  renderBodyDiff(box, 'Corps recu',
    left.responseBody && left.responseBody.text, right.responseBody && right.responseBody.text,
    left.mime);
}

function renderHeaderDiff(box, title, a, b) {
  const rows = diffHeaders(a, b);
  const changed = rows.filter(r => r.kind !== 'same');
  box.appendChild(sec(title, changed.length + ' difference(s) sur ' + rows.length + ' entetes'));
  if (!rows.length) {
    box.appendChild(el('p', { class: 'note', text: 'Aucun entete capture des deux cotes.' }));
    return;
  }
  for (const row of rows) {
    if (row.kind === 'same') {
      box.appendChild(lineNode('same', row.key + ': ' + row.a));
    } else if (row.kind === 'mod') {
      box.appendChild(lineNode('del', row.key + ': ' + row.a));
      box.appendChild(lineNode('add', row.key + ': ' + row.b));
    } else if (row.kind === 'add') {
      box.appendChild(lineNode('add', row.key + ': ' + row.b));
    } else {
      box.appendChild(lineNode('del', row.key + ': ' + row.a));
    }
  }
}

function renderBodyDiff(box, title, a, b, mime) {
  if (!a && !b) return;
  const textA = pretty(a || '', mime);
  const textB = pretty(b || '', mime);
  const rows = diffLines(textA, textB);
  const changed = rows.filter(r => r.kind !== 'same').length;
  box.appendChild(sec(title, changed ? changed + ' ligne(s) differente(s)' : 'identiques'));
  if (!changed) {
    box.appendChild(el('p', { class: 'note ok', text: 'Les deux corps sont rigoureusement identiques.' }));
    return;
  }
  for (const row of rows.slice(0, 4000)) box.appendChild(lineNode(row.kind, row.line));
  if (rows.length > 4000) {
    box.appendChild(el('p', { class: 'note', text: (rows.length - 4000) + ' lignes supplementaires non affichees.' }));
  }
}

function textDiff() {
  const lines = ['INTERCEPTOR — comparaison', '', 'A : #' + left.id + ' ' + left.method + ' ' + (left.finalUrl || left.url),
                 'B : #' + right.id + ' ' + right.method + ' ' + (right.finalUrl || right.url), ''];
  for (const row of diffHeaders(left.responseHeaders, right.responseHeaders)) {
    if (row.kind === 'same') continue;
    lines.push((SIGN[row.kind] || '') + ' ' + row.key + ' : ' + (row.a || '—') + '  ->  ' + (row.b || '—'));
  }
  const body = diffLines(
    pretty((left.responseBody && left.responseBody.text) || '', left.mime),
    pretty((right.responseBody && right.responseBody.text) || '', right.mime)
  ).filter(r => r.kind !== 'same');
  if (body.length) {
    lines.push('', 'Corps :');
    for (const row of body.slice(0, 500)) lines.push(SIGN[row.kind] + ' ' + row.line);
  }
  return lines.join('\n');
}
