/* Formatage d'affichage — INTERCEPTOR (by NeoZ) */

import { t, tp } from './i18n.js';

export function bytes(n) {
  if (n == null || Number.isNaN(n)) return '—';
  // Les unites passent par la traduction : « o » et « Ko » deviennent « B » et
  // « kB » en anglais. Sans cela, une taille reste francaise dans une interface
  // entierement anglaise.
  if (n < 1024) return n + ' ' + t('o');
  const units = ['Ko', 'Mo', 'Go', 'To'];
  let v = n / 1024, i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + ' ' + t(units[i]);
}

export function ms(n) {
  if (n == null) return '—';
  if (n < 1000) return n + ' ms';
  if (n < 60000) return (n / 1000).toFixed(2) + ' s';
  return Math.floor(n / 60000) + 'm' + Math.round((n % 60000) / 1000) + 's';
}

/** Duree longue et lisible : 3 h 12 min, 4 min 8 s, 12 s. */
export function uptime(msTotal) {
  const total = Math.max(0, Math.floor(msTotal / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h) return h + ' h ' + m + ' min';
  if (m) return m + ' min ' + s + ' s';
  return s + ' s';
}

export function clock(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return String(d.getHours()).padStart(2, '0') + ':' +
         String(d.getMinutes()).padStart(2, '0') + ':' +
         String(d.getSeconds()).padStart(2, '0') + '.' +
         String(d.getMilliseconds()).padStart(3, '0');
}

export function iso(ts) { return ts ? new Date(ts).toISOString() : '—'; }

export function relative(ts) {
  if (!ts) return '—';
  const delta = Date.now() - ts;
  if (delta < 1000) return 'a l instant';
  if (delta < 60000) return 'il y a ' + Math.floor(delta / 1000) + ' s';
  if (delta < 3600000) return 'il y a ' + Math.floor(delta / 60000) + ' min';
  if (delta < 86400000) return 'il y a ' + Math.floor(delta / 3600000) + ' h';
  return 'il y a ' + Math.floor(delta / 86400000) + ' j';
}

/** Respecte le reglage « format de l heure ». */
export function timeText(ts, format) {
  if (format === 'iso') return iso(ts);
  if (format === 'relative') return relative(ts);
  return clock(ts);
}

export function statusClass(rec) {
  if (rec.error) return 's-err';
  if (rec.statusCode == null) return 's-0';
  return 's-' + Math.floor(rec.statusCode / 100);
}

export function statusText(rec) {
  if (rec.statusCode != null) return String(rec.statusCode);
  if (rec.error) return 'ERR';
  return rec.state === 'pending' ? '···' : '—';
}

export function pretty(text, mime) {
  const t = String(text ?? '');
  const m = String(mime || '');
  if (/json/i.test(m) || /^\s*[[{]/.test(t.slice(0, 200))) {
    try { return JSON.stringify(JSON.parse(t), null, 2); } catch { return t; }
  }
  return t;
}

/** Raccourcit au milieu : garde le debut et la fin, plus parlant qu une coupe. */
export function middle(text, max = 80) {
  const s = String(text ?? '');
  if (s.length <= max) return s;
  const head = Math.ceil((max - 1) / 2);
  return s.slice(0, head) + '…' + s.slice(s.length - (max - 1 - head));
}

/** Etiquettes courtes des couches de capture, pour la colonne « Couches ». */
const LAYER_SHORT = { webRequest: 'WR', page: 'JS', perf: 'PF', tls: 'TLS', proxy: 'PX', nav: 'NV' };
export function layers(sources) {
  return (sources || []).map(s => LAYER_SHORT[s] || s.slice(0, 2).toUpperCase()).join(' ');
}

export const TYPE_LABELS = {
  main_frame: 'page', sub_frame: 'cadre', stylesheet: 'css', script: 'script',
  image: 'image', object: 'objet', xmlhttprequest: 'xhr', xslt: 'xslt',
  ping: 'ping', csp_report: 'csp', media: 'media', websocket: 'websocket',
  font: 'police', beacon: 'beacon', speculative: 'speculatif', other: 'autre',
  object_subrequest: 'objet', web_manifest: 'manifest', fetch: 'fetch'
};

export function typeLabel(type) { return t(TYPE_LABELS[type] || type || '—'); }

/** Liste complete des types de ressource proposes dans les reglages. */
export const RESOURCE_TYPES = [
  'main_frame', 'sub_frame', 'stylesheet', 'script', 'image', 'imageset', 'object',
  'object_subrequest', 'xmlhttprequest', 'xslt', 'ping', 'beacon', 'csp_report',
  'media', 'font', 'websocket', 'web_manifest', 'speculative', 'other'
];

/**
 * Rend lisible la preuve d une alerte : le gabarit passe par la traduction,
 * puis chaque valeur inseree — un nom d hote reste tel quel, un atome comme
 * « cookie envoye » est traduit a son tour.
 */
export function preuveLisible(finding) {
  if (!finding || !finding.preuve) return '';
  const valeurs = {};
  for (const [cle, valeur] of Object.entries(finding.preuveValeurs || {})) {
    valeurs[cle] = String(valeur).split(' + ')
      .map(atome => t(atome)).join(' + ');
  }
  return tp(finding.preuve, valeurs);
}
