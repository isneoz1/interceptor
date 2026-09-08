/* Colonnes du tableau de requetes — INTERCEPTOR (by NeoZ)
 *
 * Chaque colonne sait s afficher et se trier. La liste affichee est libre :
 * elle se choisit dans le menu « Colonnes » et se conserve dans les reglages.
 */
import { el } from './dom.js';
import { bytes, ms, timeText, statusClass, statusText, typeLabel, layers, middle } from './format.js';
import { t } from './i18n.js';

const RISK_ORDER = { critical: 5, high: 4, medium: 3, low: 2, info: 1, none: 0 };
const text = (value, cls) => el('div', { class: cls || null, text: value == null || value === '' ? '—' : String(value) });
const num = (value, cls) => el('div', { class: 'num' + (cls ? ' ' + cls : ''), text: value == null ? '—' : String(value) });
const cmpNum = key => (a, b) => (a[key] == null ? -1 : a[key]) - (b[key] == null ? -1 : b[key]);
const cmpText = key => (a, b) => String(a[key] ?? '').localeCompare(String(b[key] ?? ''));

export const COLUMNS = {
  flag: {
    label: '★', width: '26px', title: 'Epingle',
    cell: rec => el('div', { class: 'star' + (rec.flag ? ' on' : ''), text: rec.flag ? '★' : '☆' }),
    cmp: (a, b) => (a.flag ? 1 : 0) - (b.flag ? 1 : 0)
  },
  risk: {
    label: '!', width: '14px', title: 'Niveau de risque',
    cell: rec => el('div', { class: 'risk-bar' },
      el('i', { class: rec.risk && rec.risk !== 'none' ? rec.risk : '' })),
    cmp: (a, b) => (RISK_ORDER[a.risk] || 0) - (RISK_ORDER[b.risk] || 0)
  },
  id: { label: 'N°', width: '58px', num: true, cell: rec => num(rec.id), cmp: cmpNum('id') },
  time: {
    label: 'Heure', width: '106px',
    cell: (rec, ctx) => text(timeText(rec.startTime, ctx.timeFormat), 'dim'),
    cmp: cmpNum('startTime')
  },
  method: {
    // 68px : « DELETE » et « OPTIONS » doivent tenir sans etre coupes.
    label: 'Meth.', width: '68px',
    cell: rec => el('div', { class: 'm-' + rec.method, text: rec.method }),
    cmp: cmpText('method')
  },
  status: {
    label: 'Statut', width: '58px', num: true,
    cell: rec => el('div', {
      class: 'num ' + statusClass(rec) + (rec.state === 'pending' ? ' pending' : ''),
      text: statusText(rec)
    }),
    cmp: (a, b) => (a.statusCode || 0) - (b.statusCode || 0)
  },
  state: { label: 'Etat', width: '72px', cell: rec => text(rec.state, 'dim'), cmp: cmpText('state') },
  proto: { label: 'Proto', width: '62px', cell: rec => text(rec.protocol, 'dim'), cmp: cmpText('protocol') },
  scheme: { label: 'Schema', width: '62px', cell: rec => text(rec.scheme, 'dim'), cmp: cmpText('scheme') },
  type: { label: 'Type', width: '84px', cell: rec => text(typeLabel(rec.type), 'dim'), cmp: cmpText('type') },
  host: { label: 'Hote', width: 'minmax(130px, 240px)', cell: rec => text(rec.host), cmp: cmpText('host') },
  path: { label: 'Chemin', width: 'minmax(200px, 3fr)', cell: rec => text(rec.path || '/'), cmp: cmpText('path') },
  url: { label: 'URL complete', width: 'minmax(240px, 4fr)', cell: rec => text(rec.url), cmp: cmpText('url') },
  initiator: {
    label: 'Origine', width: 'minmax(140px, 2fr)',
    cell: rec => text(rec.initiator ? middle(rec.initiator, 70) : '—', 'dim'),
    cmp: cmpText('initiator')
  },
  mime: { label: 'MIME', width: '132px', cell: rec => text(rec.mime, 'dim'), cmp: cmpText('mime') },
  size: {
    label: 'Taille', width: '76px', num: true,
    cell: rec => num(rec.size ? bytes(rec.size) : '—'), cmp: cmpNum('size')
  },
  transfer: {
    label: 'Transfere', width: '82px', num: true,
    cell: rec => num(rec.transferSize != null ? bytes(rec.transferSize) : '—'),
    cmp: cmpNum('transferSize')
  },
  reqsize: {
    label: 'Envoye', width: '76px', num: true,
    cell: rec => num(rec.reqSize ? bytes(rec.reqSize) : '—'), cmp: cmpNum('reqSize')
  },
  duration: {
    label: 'Duree', width: '78px', num: true,
    cell: rec => num(rec.duration != null ? ms(rec.duration) : '—'), cmp: cmpNum('duration')
  },
  ip: { label: 'Serveur', width: '128px', cell: rec => text(rec.ip, 'dim'), cmp: cmpText('ip') },
  classified: {
    label: 'Pistage', width: '132px', title: 'Classement de la protection Firefox',
    cell: rec => text(rec.classified || '', rec.classified ? 'risk-medium' : 'dim'),
    cmp: cmpText('classified')
  },
  wire: {
    label: 'Sur le fil', width: '86px', num: true,
    title: 'Octets reellement echanges, entetes comprises',
    cell: rec => num(rec.wireSize ? bytes(rec.wireSize) : '—'), cmp: cmpNum('wireSize')
  },
  tls: { label: 'TLS', width: '78px', cell: rec => text(rec.tlsVersion, 'dim'), cmp: cmpText('tlsVersion') },
  sources: {
    label: 'Couches', width: '96px',
    cell: rec => el('div', { class: 'layers', text: layers(rec.sources) }),
    cmp: (a, b) => (a.sources || []).length - (b.sources || []).length
  },
  findings: {
    label: 'Alertes', width: '66px', num: true,
    cell: rec => num(rec.findings || '', rec.findings ? 'risk-' + rec.risk : 'dim'),
    cmp: cmpNum('findings')
  },
  tags: {
    label: 'Marqueurs', width: 'minmax(140px, 2fr)',
    cell: rec => text((rec.tags || []).join(' '), 'dim'),
    cmp: (a, b) => (a.tags || []).length - (b.tags || []).length
  },
  note: {
    label: 'Note', width: 'minmax(120px, 2fr)', title: 'Annotation libre',
    cell: rec => text(rec.note || '', rec.note ? null : 'dim'),
    cmp: cmpText('note')
  },
  color: {
    label: '●', width: '22px', title: 'Marquage couleur',
    cell: rec => el('div', { class: 'pastille' + (rec.color ? ' c-' + rec.color : '') }),
    cmp: cmpText('color')
  },
  redirects: { label: 'Redir.', width: '58px', num: true, cell: rec => num(rec.redirects || ''), cmp: cmpNum('redirects') },
  ws: { label: 'Trames', width: '64px', num: true, cell: rec => num(rec.wsFrames || ''), cmp: cmpNum('wsFrames') },
  sse: { label: 'SSE', width: '58px', num: true, cell: rec => num(rec.sseEvents || ''), cmp: cmpNum('sseEvents') },
  cookies: { label: 'Cookies', width: '66px', num: true, cell: rec => num(rec.setCookies || ''), cmp: cmpNum('setCookies') },
  merged: { label: 'Fusions', width: '66px', num: true, cell: rec => num(rec.merged || ''), cmp: cmpNum('merged') },
  tab: { label: 'Onglet', width: '62px', num: true, cell: rec => num(rec.tabId), cmp: cmpNum('tabId') },
  frame: { label: 'Cadre', width: '58px', num: true, cell: rec => num(rec.frameId), cmp: cmpNum('frameId') },
  rules: { label: 'Regles', width: '62px', num: true, cell: rec => num(rec.rules || ''), cmp: cmpNum('rules') },
  waterfall: {
    label: 'Cascade', width: 'minmax(140px, 2fr)',
    title: 'Position dans la session et duree reelle',
    cell: (rec, ctx) => {
      const first = ctx.first || rec.startTime || 0;
      const span = ctx.span || 1;
      const offset = Math.min(99, Math.max(0, ((rec.startTime - first) / span) * 100));
      const width = Math.max(0.8, Math.min(100 - offset, ((rec.duration || 0) / span) * 100));
      return el('div', { class: 'wf' }, el('i', {
        class: rec.duration == null ? 'wait' : null,
        style: 'margin-left:' + offset.toFixed(2) + '%;width:' + width.toFixed(2) + '%',
        title: (rec.duration != null ? ms(rec.duration) : 'en cours') +
               '  ·  demarree ' + Math.round((rec.startTime - first) / 1000) + ' s apres la premiere'
      }));
    },
    cmp: cmpNum('startTime')
  }
};

/** Ordre propose dans le menu « Colonnes ». */
export const COLUMN_ORDER = [
  'flag', 'risk', 'id', 'time', 'method', 'status', 'state', 'proto', 'scheme', 'type',
  'host', 'path', 'url', 'initiator', 'mime', 'size', 'transfer', 'reqsize', 'duration',
  'ip', 'classified', 'tls', 'sources', 'findings', 'tags', 'wire', 'redirects', 'ws', 'sse', 'cookies',
  'merged', 'tab', 'frame', 'rules', 'note', 'color', 'waterfall'
];

export const DEFAULT_COLUMNS = ['risk', 'time', 'method', 'status', 'host', 'path', 'type', 'size', 'duration', 'sources'];

/** Liste valide de colonnes : filtre les cles inconnues et garde au moins une colonne. */
export function normalize(list) {
  const out = (list || []).filter(k => COLUMNS[k]);
  return out.length ? out : [...DEFAULT_COLUMNS];
}

/** Libelle traduit d une colonne. */
export function columnLabel(key) {
  const col = COLUMNS[key];
  return col ? t(col.label) : key;
}

/** Description traduite d une colonne. */
export function columnTitle(key) {
  const col = COLUMNS[key];
  if (!col) return key;
  return t(col.title || col.label);
}

export function template(list, widths = {}) {
  return normalize(list).map(k => widths[k] || COLUMNS[k].width).join(' ');
}
