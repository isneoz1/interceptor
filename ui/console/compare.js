/* Vue « Comparaison » — deux requetes cote a cote — SWIFT (by D4RK)
 *
 * Selectionnez exactement deux lignes (Ctrl+clic) puis « Comparer ».
 * Les entetes et les corps sont confrontes ligne a ligne : ce qui est identique
 * est grise, ce qui change est marque. Rien n est resume ni tronque : les
 * longues comparaisons se dessinent par lots, et « Copier » les porte en entier.
 *
 * Les corps passent par le moteur de la boite a outils (lib/diff.js, Myers) :
 * exact quelle que soit la taille. L ancienne version basculait au-dela de
 * 1200 lignes sur une difference d ensembles, qui perdait toute ligne presente
 * ailleurs dans l autre corps : un « }, » retire passait inapercu, et deux
 * corps differents pouvaient etre dits identiques.
 *
 * Deux corps JSON se comparent aussi par leur structure : le JSON Patch
 * (RFC 6902) qui mene de l un a l autre, sans tenir compte de la mise en forme
 * ni de l ordre des membres (lib/json-patch.js).
 */
import { $, el, clear, sec, button, kv, add, vide } from '../lib/dom.js';
import { bytes, ms, clock, pretty } from '../lib/format.js';
import { t, tp, deuxPoints } from '../lib/i18n.js';
import { comparerLignes } from '../lib/diff.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { lireJsonExact, ecrireJsonExact } from '../lib/json-exact.js';
import { produirePatch, patchEnArbre } from '../lib/json-patch.js';
import { SENS_OPERATIONS } from './patch-detail.js';
import { state, cmd, toast, copy } from '../app.js';

let left = null;
let right = null;
let loading = false;
/* Les listes rendues par lots du dernier dessin : un nouveau dessin les coupe. */
let rendus = [];

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
/* Chaque occurrence d un en-tete garde sa ligne : Set-Cookie ne se combine
   pas (RFC 9110 §5.3), et deux valeurs jointes par une virgule se liraient
   comme une seule. Les valeurs d un meme nom sont confrontees dans l ordre,
   par le meme moteur que les corps. */
function occurrences(list) {
  const map = new Map();
  for (const h of list || []) {
    const key = String(h.name || '').toLowerCase();
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(String(h.value ?? ''));
  }
  return map;
}

/**
 * @returns { lignes: [{ kind: 'same'|'add'|'del', key, value }], noms, differents }
 *          `noms` : nombre de noms d en-tete, `differents` : ceux qui changent
 */
export function comparerEntetes(a, b) {
  const A = occurrences(a), B = occurrences(b);
  const keys = [...new Set([...A.keys(), ...B.keys()])].sort();
  const lignes = [];
  let differents = 0;
  for (const key of keys) {
    const { operations } = comparerLignes(A.get(key) || [], B.get(key) || []);
    if (operations.some(o => o.type !== 'egal')) differents++;
    for (const o of operations) {
      lignes.push({ kind: o.type === 'egal' ? 'same' : o.type === 'ajout' ? 'add' : 'del', key, value: o.texte });
    }
  }
  return { lignes, noms: keys.length, differents };
}

/**
 * Deux corps, mis en forme de la meme facon (sans perte : lib/json-exact.js),
 * compares ligne a ligne. Les lignes gardent leur CR : deux corps qui ne
 * different que par leurs fins de ligne ne sont pas dits identiques.
 */
export function comparerCorps(a, b, mime) {
  const brutA = String(a || ''), brutB = String(b || '');
  const textA = pretty(brutA, mime), textB = pretty(brutB, mime);
  const { operations, minimal } = comparerLignes(textA.split('\n'), textB.split('\n'));
  const lignes = operations.map(o => ({ kind: o.type === 'egal' ? 'same' : o.type === 'ajout' ? 'add' : 'del', line: o.texte }));
  const changees = lignes.filter(r => r.kind !== 'same').length;
  return {
    lignes,
    changees,
    minimal,
    identiques: brutA === brutB,
    /* Rien ne change une fois mis en forme, et pourtant les octets different :
       espaces, ou ecriture des memes valeurs. */
    memeFond: brutA !== brutB && textA === textB,
    finsDeLigne: textA !== textB && textA.replace(/\r\n/g, '\n') === textB.replace(/\r\n/g, '\n')
  };
}

/** Le JSON Patch qui mene d un corps a l autre, ou null s ils ne sont pas
 *  tous deux du JSON. */
export function patchEntreCorps(a, b) {
  let x, y;
  try { x = lireJsonExact(String(a || '')); y = lireJsonExact(String(b || '')); }
  catch { return null; }
  return produirePatch(x, y);
}

/* Au-dela, la difference de structure se calcule a la demande : elle relit
   les deux corps en entier. */
const STRUCTURE_IMMEDIATE = 1000000;

/** Ecart de deux mesures, seulement si les deux sont connues. */
export function ecart(a, b) {
  if (a == null || b == null || !Number.isFinite(a) || !Number.isFinite(b)) return null;
  return a - b;
}

const SIGN = { add: '+', del: '−', mod: '~', same: ' ' };

function lineNode(kind, text) {
  return el('div', { class: 'dline ' + kind }, [
    el('span', { class: 'sign', text: SIGN[kind] || ' ' }),
    el('span', { text })
  ]);
}

/* Une liste de lignes, par lots : un corps de cent mille lignes ne fige pas. */
function lignesParLots(box, lignes, fabriquer) {
  const hote = el('div');
  box.appendChild(hote);
  rendus.push(listeProgressive(hote, lignes, fabriquer));
}

function arreterRendus() {
  for (const r of rendus) { try { r.arreter(); } catch { /* deja arrete */ } }
  rendus = [];
}

/* -------------------------------- Rendu ---------------------------------- */
export function render() {
  arreterRendus();
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
    actions.appendChild(button('Copier la comparaison', () => copy(texteComparaison(left, right), 'Comparaison copiee')));
  }
  box.appendChild(actions);

  if (loading) { box.appendChild(el('p', { class: 'note', text: t('Lecture des deux enregistrements…') })); return; }

  if (!left || !right) {
    box.appendChild(vide('Selectionnez deux lignes',
      'Dans le tableau : Ctrl+clic sur une premiere ligne, Ctrl+clic sur une seconde, puis cliquez sur « Comparer ». Vous pouvez aussi comparer une requete avec son rejeu.'));
    return;
  }

  /* --- Identite cote a cote --- */
  const cols = el('div', { class: 'diff' });
  for (const [rec, side] of [[left, 'Gauche'], [right, 'Droite']]) {
    const col = el('div', { class: 'diff-col' });
    col.appendChild(el('h4', { text: t(side) + ' · #' + rec.id }));
    add(col, kv('Methode', rec.method, { hl: true }));
    /* L URL entiere : coupee au milieu, deux URL qui ne different que la
       paraissaient identiques. */
    add(col, kv('URL', rec.finalUrl || rec.url, { copy: true }));
    add(col, kv('Statut', rec.statusLine || rec.statusCode || rec.error || t('en cours')));
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

  /* --- Ecarts mesures : seulement entre deux mesures connues ; une duree
         absente d un cote n est pas zero. --- */
  box.appendChild(sec('Ecarts mesures'));
  const deltaDuration = ecart(left.duration, right.duration);
  const deltaSize = ecart(left.size, right.size);
  add(box, kv('Difference de duree', deltaDuration == null ? t('inconnue d un cote')
    : (deltaDuration >= 0 ? '+' : '−') + ms(Math.abs(deltaDuration))));
  add(box, kv('Difference de taille', deltaSize == null ? t('inconnue d un cote')
    : (deltaSize >= 0 ? '+' : '−') + bytes(Math.abs(deltaSize))));
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
  const { lignes, noms, differents } = comparerEntetes(a, b);
  box.appendChild(sec(title, tp('{n} difference(s) sur {total} entetes', { n: differents, total: noms })));
  if (!lignes.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun entete capture des deux cotes.') }));
    return;
  }
  lignesParLots(box, lignes, l => lineNode(l.kind, deuxPoints(l.key, l.value)));
}

function renderBodyDiff(box, title, a, b, mime) {
  if (!a && !b) return;
  const r = comparerCorps(a, b, mime);
  box.appendChild(sec(title, r.changees ? tp('{n} ligne(s) differente(s)', { n: r.changees }) : 'identiques'));
  if (r.identiques) {
    box.appendChild(el('p', { class: 'note ok', text: t('Les deux corps sont rigoureusement identiques.') }));
    return;
  }
  if (r.memeFond) {
    box.appendChild(el('p', { class: 'note', text: t('Identiques une fois mis en forme, mais pas octet pour octet : seuls les espaces entre les valeurs different.') }));
    return;
  }
  if (r.finsDeLigne) {
    box.appendChild(el('p', { class: 'note', text: t('Les corps ne different que par leurs fins de ligne : CRLF d un cote, LF de l autre.') }));
  }
  if (!r.minimal) {
    box.appendChild(el('p', { class: 'note', text: t('Les deux corps different trop pour chercher la plus courte liste de changements : la comparaison reste exacte, chaque ligne y figure une fois, mais un bloc peut etre montre retire puis rajoute.') }));
  }
  blocStructure(box, a, b);
  lignesParLots(box, r.lignes, row => lineNode(row.kind, row.line));
}

/* La difference de structure de deux corps JSON, operation par operation. */
function blocStructure(box, a, b) {
  const zone = el('div');
  box.appendChild(zone);
  const dessiner = () => {
    const ops = patchEntreCorps(a, b);
    if (!ops) return;
    zone.appendChild(el('h4', { text: tp('Difference de structure : {n} operation(s) JSON Patch (RFC 6902)', { n: ops.length }) }));
    zone.appendChild(el('p', { class: 'note', text: t('Sans tenir compte de la mise en forme ni de l ordre des membres.') }));
    const texte = ecrireJsonExact(patchEnArbre(ops), '  ');
    zone.appendChild(el('div', { class: 'actions' }, button('Copier le JSON Patch', () => copy(texte, 'JSON Patch copie'))));
    const hote = el('div');
    zone.appendChild(hote);
    rendus.push(listeProgressive(hote, ops, o => el('p', { class: 'note', text: '•  ' + tp(SENS_OPERATIONS[o.op],
      { chemin: o.path === '' ? '""' : o.path, de: o.from || '', valeur: o.value ? ecrireJsonExact(o.value, '') : '' }) })));
  };
  if (String(a || '').length + String(b || '').length <= STRUCTURE_IMMEDIATE) { dessiner(); return; }
  const bouton = button('Calculer la difference de structure (JSON Patch)', () => { bouton.remove(); dessiner(); });
  zone.appendChild(el('div', { class: 'actions' }, bouton));
}

/** Le texte copie : tout ce qui differe, entetes et corps, sans coupe. */
export function texteComparaison(gauche, droite) {
  const lines = [t('SWIFT — comparaison'), '',
    deuxPoints('A', '#' + gauche.id + ' ' + gauche.method + ' ' + (gauche.finalUrl || gauche.url)),
    deuxPoints('B', '#' + droite.id + ' ' + droite.method + ' ' + (droite.finalUrl || droite.url)), ''];
  for (const [titre, a, b] of [['Entetes envoyees', gauche.requestHeaders, droite.requestHeaders],
    ['Entetes recues', gauche.responseHeaders, droite.responseHeaders]]) {
    const changees = comparerEntetes(a, b).lignes.filter(l => l.kind !== 'same');
    if (!changees.length) continue;
    lines.push(deuxPoints(t(titre)));
    for (const l of changees) lines.push(SIGN[l.kind] + ' ' + deuxPoints(l.key, l.value));
    lines.push('');
  }
  for (const [titre, a, b, mime] of [
    ['Corps envoye', gauche.requestBody && gauche.requestBody.text, droite.requestBody && droite.requestBody.text,
      gauche.requestBody && gauche.requestBody.contentType],
    ['Corps recu', gauche.responseBody && gauche.responseBody.text, droite.responseBody && droite.responseBody.text, gauche.mime]]) {
    if (!a && !b) continue;
    const changees = comparerCorps(a, b, mime).lignes.filter(r => r.kind !== 'same');
    if (!changees.length) continue;
    lines.push(deuxPoints(t(titre)));
    for (const row of changees) lines.push(SIGN[row.kind] + ' ' + row.line);
    lines.push('');
  }
  return lines.join('\n');
}
