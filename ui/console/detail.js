/* Panneau de detail — INTERCEPTOR (by NeoZ)
 *
 * Douze onglets couvrant la totalite d un enregistrement, dont un onglet
 * « Brut » qui affiche l objet complet : aucune donnee capturee ne peut
 * echapper a l affichage.
 */
import { $, el, clear } from '../lib/dom.js';
import { middle } from '../lib/format.js';
import { t } from '../lib/i18n.js';
import { state, cmd, toast, copy, dropdown, B, saveConfig } from '../app.js';
import * as parts from './detail-parts.js';
import * as more from './detail-more.js';
import { replayPanel } from './replay.js';
import { currentRows } from './requests.js';
import { GENERATOR_MENU } from '../../background/export/codegen.js';

const TABS = [
  { key: 'resume',   label: 'Resume',      render: parts.resume },
  { key: 'headers',  label: 'En-tetes',    render: parts.headers,
    count: r => (r.requestHeaders || []).length + (r.responseHeaders || []).length },
  { key: 'request',  label: 'Requete',     render: parts.requestBody,
    count: r => (r.requestBody && r.requestBody.size) ? 1 : 0 },
  { key: 'response', label: 'Reponse',     render: parts.responseBody,
    count: r => (r.responseBody && r.responseBody.size) ? 1 : 0 },
  { key: 'cookies',  label: 'Cookies',     render: more.cookies,
    count: r => ((r.cookies && r.cookies.set) || []).length + ((r.cookies && r.cookies.changed) || []).length },
  { key: 'security', label: 'Securite',    render: more.security },
  { key: 'analysis', label: 'Alertes',     render: more.analysis,
    count: r => (r.analysis && r.analysis.findings.length) || 0 },
  { key: 'streams',  label: 'Flux',        render: more.streams,
    count: r => ((r.ws && r.ws.frames.length) || 0) + ((r.sse && r.sse.messages.length) || 0) },
  { key: 'timeline', label: 'Chronologie', render: more.timeline,
    count: r => (r.timeline || []).length },
  { key: 'stack',    label: 'Pile JS',     render: more.stack, count: r => (r.stack ? 1 : 0) },
  { key: 'replay',   label: 'Rejouer',     render: rec => replayPanel(rec, refresh) },
  { key: 'raw',      label: 'Brut',        render: more.raw }
];

/* Section « Contenu » du menu Copier. La section « Code » est construite a
   partir du registre de generateurs : ajouter un generateur le fait apparaitre
   ici sans toucher a l interface. */
const COPY_CONTENT = [
  { kind: 'head', label: 'Contenu' },
  { key: 'url', label: 'URL seule' },
  { key: 'reqbody', label: 'Corps envoye' },
  { key: 'resbody', label: 'Corps recu' },
  { key: 'headers', label: 'Tous les entetes' }
];

function copyItems() {
  const items = COPY_CONTENT.map(item =>
    item.kind ? item : { label: t(item.label), action: () => copyAs(item.key) });
  for (const entry of GENERATOR_MENU) {
    if (Array.isArray(entry)) items.push({ label: entry[1], action: () => copyAs(entry[0]) });
    else items.push({ kind: 'sep' }, { kind: 'head', label: t(entry.head) });
  }
  return items;
}

let current = null;      // enregistrement complet affiche
let tab = 'resume';
let blockArmed = false;
let onChange = null;

export function init(deps = {}) {
  onChange = deps.onChange;
  $('#d-close').addEventListener('click', close);
  $('#d-prev').addEventListener('click', () => step(-1));
  $('#d-next').addEventListener('click', () => step(1));
  $('#d-flag').addEventListener('click', toggleFlag);
  $('#d-open').addEventListener('click', openUrl);
  $('#d-block').addEventListener('click', blockHost);
  dropdown($('#d-copy'), copyItems, { up: true });
}

export function isOpen() { return !$('#detail').hidden; }

export function close() {
  $('#detail').hidden = true;
  $('#resizer').hidden = true;
  state.selected = null;
  current = null;
  disarmBlock();
  onChange && onChange();
}

export async function open(id) {
  const res = await cmd('record', { id });
  if (res.error || !res.record) { toast(res.error || 'enregistrement introuvable', false); return; }
  state.selected = id;
  state.seen.detail = true;
  current = res.record;
  $('#detail').hidden = false;
  $('#resizer').hidden = false;
  disarmBlock();
  paint();
  $('#dbody').scrollTop = 0;
  onChange && onChange();
}

/** Recharge l enregistrement courant (apres un rejeu ou une reanalyse). */
export async function refresh() {
  if (state.selected == null) return;
  const res = await cmd('record', { id: state.selected });
  if (res.error || !res.record) return;
  current = res.record;
  paint();
}

/** Deplacement dans la liste filtree, dans l ordre affiche. */
export function step(direction) {
  const rows = currentRows();
  if (!rows.length) return;
  if (state.selected == null) { open(rows[0].id); return; }
  const index = rows.findIndex(r => r.id === state.selected);
  const target = rows[index + direction];
  if (target) open(target.id);
}

function paint() {
  if (!current) return;
  const rec = current;

  const who = clear($('#detail-who'));
  who.appendChild(el('span', { class: 'm-' + rec.method, text: rec.method + ' ' }));
  who.appendChild(document.createTextNode(middle(rec.finalUrl || rec.url, 120)));
  who.appendChild(el('span', { text: '   #' + rec.id }));

  $('#d-flag').classList.toggle('on', !!rec.flag);
  $('#d-flag').title = rec.flag ? 'Retirer l epingle' : 'Epingler cette ligne';

  const tabsHost = clear($('#dtabs'));
  for (const def of TABS) {
    const n = def.count ? def.count(rec) : null;
    const btn = el('button', { class: 'dtab' + (tab === def.key ? ' on' : ''), type: 'button' }, [
      el('span', { text: t(def.label) }),
      n ? el('span', { class: 'n', text: String(n) }) : null
    ]);
    btn.addEventListener('click', () => { tab = def.key; state.seen.tabs++; paint(); $('#dbody').scrollTop = 0; });
    tabsHost.appendChild(btn);
  }

  const def = TABS.find(t => t.key === tab) || TABS[0];
  const body = clear($('#dbody'));
  body.appendChild(def.render(rec));
}

/* ------------------------------- Actions --------------------------------- */
async function toggleFlag() {
  if (!current) return;
  const res = await cmd('flagRecord', { id: current.id });
  if (res.error) return toast(res.error, false);
  current.flag = res.flag;
  const summary = state.records.get(current.id);
  if (summary) summary.flag = res.flag;
  paint();
  onChange && onChange();
}

async function openUrl() {
  if (!current) return;
  const url = current.finalUrl || current.url;
  if (!/^https?:/.test(url)) return toast('Seules les URL http et https sont ouvrables', false);
  try { await B.tabs.create({ url, active: true }); }
  catch { toast('Ouverture impossible', false); }
}

function disarmBlock() {
  blockArmed = false;
  const btn = $('#d-block');
  if (btn) { btn.classList.remove('armed'); btn.textContent = t('Bloquer'); }
}

/* Creer une regle modifie reellement le trafic : confirmation en deux temps. */
async function blockHost() {
  if (!current || !current.host) return toast('Hote inconnu', false);
  const btn = $('#d-block');

  if (!blockArmed) {
    blockArmed = true;
    btn.classList.add('armed');
    btn.textContent = t('Confirmer ?');
    setTimeout(disarmBlock, 4000);
    return;
  }

  const rules = [...((state.config && state.config.rules) || [])];
  const id = 'block-' + current.host;
  if (rules.some(r => r.id === id)) { disarmBlock(); return toast('Regle deja presente'); }

  rules.push({
    id, enabled: true, name: 'Bloquer ' + current.host,
    match: { host: current.host }, action: 'block'
  });
  const config = await saveConfig({ rules, rulesEnabled: true });
  disarmBlock();
  if (config) toast(current.host + ' bloque — regle active');
}

async function copyAs(kind) {
  if (!current) return;
  let text = null;

  if (kind === 'url') {
    text = current.finalUrl || current.url;
  } else if (kind === 'reqbody') {
    text = current.requestBody && current.requestBody.text;
    if (!text) return toast('Cette requete ne transporte pas de corps texte', false);
  } else if (kind === 'resbody') {
    text = current.responseBody && current.responseBody.text;
    if (!text) return toast('Aucun corps de reponse texte capture', false);
  } else if (kind === 'headers') {
    const lines = [];
    for (const h of current.requestHeaders || []) lines.push('> ' + h.name + ': ' + h.value);
    if (lines.length) lines.push('');
    for (const h of current.responseHeaders || []) lines.push('< ' + h.name + ': ' + h.value);
    if (!lines.length) return toast('Aucun entete capture', false);
    text = lines.join('\n');
  } else {
    const res = await cmd('codegen', { id: current.id, kind });
    if (res.error) return toast(res.error, false);
    text = res.code;
  }
  copy(text);
}
