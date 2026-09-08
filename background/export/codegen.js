/* Generation de code a partir d'une requete capturee — INTERCEPTOR (by NeoZ)
 *
 * Registre central : les generateurs bruts et « ligne de commande » vivent ici,
 * les clients par langage dans codegen-clients.js. Chaque generateur produit du
 * texte pret a coller dans un terminal ou un editeur : rien n est execute ici.
 */
import {
  NL, target, usableHeaders, headerMap, bodyText, shQuote, psQuote, cmdQuote, jsQuote
} from './codegen-util.js';
import { CLIENTS, CLIENT_MENU } from './codegen-clients.js';

/* ------------------------------ Ligne de commande ------------------------- */
export function toCurl(rec, { platform = 'sh' } = {}) {
  const q = platform === 'powershell' ? psQuote : platform === 'cmd' ? cmdQuote : shQuote;
  // Continuation de ligne reelle selon la plateforme.
  const cont = platform === 'powershell' ? ' `' + NL + '  '
             : platform === 'cmd' ? ' ^' + NL + '  '
             : ' \\' + NL + '  ';
  const parts = ['curl -i -X ' + rec.method + ' ' + q(target(rec))];
  for (const h of usableHeaders(rec)) parts.push('-H ' + q(h.name + ': ' + h.value));
  const body = bodyText(rec);
  if (body) parts.push('--data-raw ' + q(body));
  else if (rec.requestBody && rec.requestBody.base64) {
    parts.push('# corps binaire : ' + rec.requestBody.size + ' octets, non transposable en ligne de commande');
  }
  if (rec.redirects.length) parts.push('-L');
  return parts.join(cont);
}

export function toWget(rec) {
  const parts = ['wget --method=' + rec.method + ' ' + shQuote(target(rec))];
  for (const h of usableHeaders(rec)) parts.push('--header=' + shQuote(h.name + ': ' + h.value));
  const body = bodyText(rec);
  if (body) parts.push('--body-data=' + shQuote(body));
  parts.push('-O -');
  return parts.join(' \\' + NL + '  ');
}

export function toHttpie(rec) {
  const parts = ['http ' + (rec.method === 'GET' ? '' : rec.method + ' ') + shQuote(target(rec))];
  for (const h of usableHeaders(rec)) parts.push(shQuote(h.name + ':' + h.value));
  const body = bodyText(rec);
  if (body) return parts.join(' ') + NL + '# corps : echo ' + shQuote(body) + ' | ' + parts.join(' ');
  return parts.join(' ');
}

export function toPowerShell(rec, { cmdlet = 'Invoke-WebRequest' } = {}) {
  const lines = ['$headers = @{'];
  for (const h of usableHeaders(rec)) lines.push('  ' + psQuote(h.name) + ' = ' + psQuote(h.value));
  lines.push('}');
  const body = bodyText(rec);
  const args = ['-Uri ' + psQuote(target(rec)), '-Method ' + rec.method, '-Headers $headers'];
  if (body) { lines.push('$body = ' + psQuote(body)); args.push('-Body $body'); }
  lines.push(cmdlet + ' ' + args.join(' '));
  return lines.join(NL);
}

/* --------------------------- JavaScript et Python ------------------------- */
export function toFetch(rec) {
  const init = { method: rec.method, headers: headerMap(rec) };
  const body = bodyText(rec);
  if (body) init.body = body;
  if (rec.pageMeta) {
    if (rec.pageMeta.credentials) init.credentials = rec.pageMeta.credentials;
    if (rec.pageMeta.mode) init.mode = rec.pageMeta.mode;
    if (rec.pageMeta.referrer) init.referrer = rec.pageMeta.referrer;
  }
  return 'await fetch(' + jsQuote(target(rec)) + ', ' + JSON.stringify(init, null, 2) + ');';
}

export function toNode(rec) {
  const init = { method: rec.method, headers: headerMap(rec) };
  const body = bodyText(rec);
  if (body) init.body = body;
  return [
    '// Node 18+ : fetch est natif',
    'const res = await fetch(' + jsQuote(target(rec)) + ', ' + JSON.stringify(init, null, 2) + ');',
    'console.log(res.status);',
    'console.log(await res.text());'
  ].join(NL);
}

export function toPython(rec) {
  const headers = headerMap(rec);
  const lines = ['import requests', '', 'headers = ' + JSON.stringify(headers, null, 4)];
  const body = bodyText(rec);
  if (body) {
    lines.push('data = ' + JSON.stringify(body));
    lines.push('r = requests.request(' + JSON.stringify(rec.method) + ', ' +
               JSON.stringify(target(rec)) + ', headers=headers, data=data)');
  } else {
    lines.push('r = requests.request(' + JSON.stringify(rec.method) + ', ' +
               JSON.stringify(target(rec)) + ', headers=headers)');
  }
  lines.push('print(r.status_code)', 'print(r.text)');
  return lines.join(NL);
}

export function toPythonHttp(rec) {
  let host = rec.host, path = '/';
  try { const u = new URL(target(rec)); host = u.host; path = (u.pathname || '/') + (u.search || ''); } catch {}
  const secure = rec.scheme === 'https' || /^https:/i.test(target(rec));
  const lines = ['import http.client', '',
    'conn = http.client.' + (secure ? 'HTTPSConnection' : 'HTTPConnection') + '(' + JSON.stringify(host) + ')',
    'headers = ' + JSON.stringify(headerMap(rec), null, 4)];
  const body = bodyText(rec);
  lines.push('conn.request(' + JSON.stringify(rec.method) + ', ' + JSON.stringify(path) + ', ' +
    (body ? JSON.stringify(body) : 'None') + ', headers)',
    'res = conn.getresponse()', 'print(res.status, res.reason)', 'print(res.read().decode())');
  return lines.join(NL);
}

/* -------------------------------- Brut ------------------------------------ */
export function toHttpRaw(rec) {
  let dest = target(rec);
  let line;
  try {
    const url = new URL(dest);
    line = rec.method + ' ' + (url.pathname + url.search) + ' HTTP/1.1';
    dest = url.host;
  } catch {
    line = rec.method + ' ' + dest + ' HTTP/1.1';
    dest = rec.host || '';
  }
  const lines = [line, 'Host: ' + dest];
  for (const h of rec.requestHeaders || []) {
    if (String(h.name).toLowerCase() === 'host') continue;
    lines.push(h.name + ': ' + h.value);
  }
  lines.push('');
  const body = bodyText(rec);
  if (body) lines.push(body);
  return lines.join('\r\n');
}

/** Reponse brute telle que le serveur l a renvoyee, entetes compris. */
export function toHttpResponse(rec) {
  const lines = [rec.statusLine || ('HTTP/1.1 ' + (rec.statusCode ?? 0))];
  for (const h of rec.responseHeaders || []) lines.push(h.name + ': ' + h.value);
  lines.push('');
  if (rec.responseBody && rec.responseBody.text) lines.push(rec.responseBody.text);
  else if (rec.responseBody && rec.responseBody.base64) lines.push('[corps binaire, ' + rec.responseBody.size + ' octets]');
  return lines.join('\r\n');
}

export function toMarkdown(rec) {
  const lines = [
    '### ' + rec.method + ' ' + target(rec),
    '',
    '| Champ | Valeur |',
    '|---|---|',
    '| Statut | ' + (rec.statusLine || rec.statusCode || rec.error || 'en cours') + ' |',
    '| Type | ' + rec.type + ' |',
    '| MIME | ' + (rec.mime || '-') + ' |',
    '| Taille | ' + (rec.size || 0) + ' octets |',
    '| Duree | ' + (rec.duration != null ? rec.duration + ' ms' : '-') + ' |',
    '| Serveur | ' + (rec.ip || '-') + ' |',
    '| Couches | ' + (rec.sources || []).join(', ') + ' |',
    ''
  ];
  if (rec.analysis && rec.analysis.findings.length) {
    lines.push('**Alertes**', '');
    for (const f of rec.analysis.findings) {
      lines.push('- `' + f.severity + '` ' + f.title + ' (' + f.where + ')');
    }
    lines.push('');
  }
  return lines.join(NL);
}

/* ------------------------------- Registre --------------------------------- */
export const GENERATORS = {
  curl: toCurl,
  'curl-powershell': rec => toCurl(rec, { platform: 'powershell' }),
  'curl-cmd': rec => toCurl(rec, { platform: 'cmd' }),
  wget: toWget,
  httpie: toHttpie,
  powershell: toPowerShell,
  'powershell-irm': rec => toPowerShell(rec, { cmdlet: 'Invoke-RestMethod' }),
  fetch: toFetch,
  node: toNode,
  python: toPython,
  'python-http': toPythonHttp,
  http: toHttpRaw,
  'http-response': toHttpResponse,
  markdown: toMarkdown,
  json: rec => JSON.stringify(rec, (k, v) => (k === '_tlKeys' ? undefined : v), 2),
  ...CLIENTS
};

/** Menu groupe affiche dans « Copier » et « Exporter » : { head } ou [cle, libelle]. */
export const GENERATOR_MENU = [
  { head: 'Ligne de commande' },
  ['curl', 'cURL (bash)'], ['curl-powershell', 'cURL (PowerShell)'], ['curl-cmd', 'cURL (cmd.exe)'],
  ['wget', 'wget'], ['httpie', 'HTTPie'],
  ['powershell', 'PowerShell Invoke-WebRequest'], ['powershell-irm', 'PowerShell Invoke-RestMethod'],
  { head: 'JavaScript et Python' },
  ['fetch', 'fetch (JavaScript)'], ['node', 'Node.js'],
  ['python', 'Python requests'], ['python-http', 'Python http.client'],
  ...CLIENT_MENU,
  { head: 'Brut et documentation' },
  ['http', 'Requete HTTP brute'], ['http-response', 'Reponse HTTP brute'],
  ['markdown', 'Fiche Markdown'], ['json', 'Enregistrement JSON complet']
];

/** Liste a plat [cle, libelle] : conservee pour compatibilite. */
export const GENERATOR_LABELS = GENERATOR_MENU.filter(Array.isArray);

/**
 * Ecriture sur disque d un lot de requetes : [ extension, type MIME,
 * prefixe de commentaire, premiere ligne facultative ].
 * Chaque generateur en a une : un langage exportable en une requete l est
 * aussi en cent (export/files.js).
 */
export const GENERATOR_FILES = {
  curl: ['sh', 'text/x-shellscript', '#', '#!/bin/sh'],
  'curl-powershell': ['ps1', 'text/plain', '#'],
  'curl-cmd': ['bat', 'text/plain', 'REM'],
  wget: ['sh', 'text/x-shellscript', '#', '#!/bin/sh'],
  httpie: ['sh', 'text/x-shellscript', '#', '#!/bin/sh'],
  powershell: ['ps1', 'text/plain', '#'],
  'powershell-irm': ['ps1', 'text/plain', '#'],
  fetch: ['js', 'text/javascript', '//'],
  node: ['mjs', 'text/javascript', '//'],
  python: ['py', 'text/x-python', '#'],
  'python-http': ['py', 'text/x-python', '#'],
  http: ['http', 'text/plain', '#'],
  'http-response': ['http', 'text/plain', '#'],
  markdown: ['md', 'text/markdown', ''],
  json: ['json', 'application/json', ''],
  ruby: ['rb', 'text/x-ruby', '#'],
  httparty: ['rb', 'text/x-ruby', '#'],
  php: ['php', 'text/x-php', '//'],
  guzzle: ['php', 'text/x-php', '//'],
  go: ['go', 'text/x-go', '//'],
  rust: ['rs', 'text/rust', '//'],
  java: ['java', 'text/x-java', '//'],
  okhttp: ['java', 'text/x-java', '//'],
  kotlin: ['kt', 'text/x-kotlin', '//'],
  csharp: ['cs', 'text/plain', '//'],
  restsharp: ['cs', 'text/plain', '//'],
  swift: ['swift', 'text/x-swift', '//'],
  dart: ['dart', 'text/x-dart', '//'],
  elixir: ['exs', 'text/x-elixir', '#'],
  r: ['R', 'text/x-r', '#'],
  perl: ['pl', 'text/x-perl', '#'],
  clojure: ['clj', 'text/x-clojure', ';;'],
  objc: ['m', 'text/x-objectivec', '//'],
  axios: ['mjs', 'text/javascript', '//'],
  jquery: ['js', 'text/javascript', '//'],
  xhr: ['js', 'text/javascript', '//'],
  httpx: ['py', 'text/x-python', '#'],
  k6: ['js', 'text/javascript', '//'],
  ansible: ['yml', 'text/yaml', '#']
};

/**
 * Script complet pour un lot de requetes, dans le langage demande.
 * Rend null si la cle n est pas un generateur connu.
 */
export function generateScript(kind, records) {
  const desc = GENERATOR_FILES[kind];
  if (!desc || !GENERATORS[kind]) return null;
  const [extension, mime, comment, shebang] = desc;

  // Le JSON ne se concatene pas : un lot devient un tableau valide.
  if (kind === 'json') {
    const body = '[' + NL + records.map(r => generate('json', r)).join(',' + NL) + NL + ']';
    return { content: body, extension, mime };
  }

  const head = [];
  if (shebang) head.push(shebang);
  const title = 'INTERCEPTOR (by NeoZ) — ' + records.length + ' requetes';
  head.push(comment ? comment + ' ' + title : title, '');
  const parts = records.map(r => generate(kind, r) + NL);
  return { content: head.concat(parts).join(NL), extension, mime };
}

export function generate(kind, rec) {
  const fn = GENERATORS[kind];
  if (!fn) throw new Error('generateur inconnu : ' + kind);
  return fn(rec);
}
