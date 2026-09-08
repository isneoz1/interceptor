/* Analyse et evaluation des filtres — INTERCEPTOR (by NeoZ)
 *
 * Syntaxe supportee :
 *   texte libre              -> url + hote + chemin + methode + MIME
 *   /expression/i            -> expression reguliere sur l URL
 *   champ:valeur             -> comparaison textuelle (contient)
 *   champ:>1000              -> comparaison numerique (> >= < <= =)
 *   champ:oui                -> champ booleen
 *   -motif                   -> exclusion, valable pour toutes les formes
 *   "deux mots"              -> expression exacte avec espaces
 */

export const FIELDS = {
  method:    { kind: 'text', get: r => r.method,               help: 'verbe HTTP' },
  status:    { kind: 'num',  get: r => r.statusCode,           help: 'code de statut, accepte 2xx a 5xx' },
  type:      { kind: 'text', get: r => r.type,                 help: 'type de ressource' },
  host:      { kind: 'text', get: r => r.host,                 help: 'hote' },
  path:      { kind: 'text', get: r => r.path,                 help: 'chemin et parametres' },
  url:       { kind: 'text', get: r => r.url,                  help: 'URL complete' },
  mime:      { kind: 'text', get: r => r.mime,                 help: 'type de contenu' },
  scheme:    { kind: 'text', get: r => r.scheme,               help: 'protocole (http, https, ws...)' },
  proto:     { kind: 'text', get: r => r.protocol,             help: 'protocole reel (h2, h3...)' },
  ip:        { kind: 'text', get: r => r.ip,                   help: 'adresse du serveur' },
  tag:       { kind: 'text', get: r => (r.tags || []).join(' '), help: 'marqueur pose par l analyse' },
  risk:      { kind: 'text', get: r => r.risk || 'none',       help: 'niveau de risque' },
  src:       { kind: 'text', get: r => (r.sources || []).join(' '), help: 'couche de capture' },
  state:     { kind: 'text', get: r => r.state,                help: 'pending, complete, error, aborted' },
  init:      { kind: 'text', get: r => r.initiator,            help: 'document a l origine' },
  tls:       { kind: 'text', get: r => r.tlsVersion,           help: 'version TLS' },
  error:     { kind: 'text', get: r => r.error,                help: 'message d erreur' },
  classe:    { kind: 'text', get: r => r.classified,           help: 'classement de pistage etabli par Firefox' },
  tab:       { kind: 'num',  get: r => r.tabId,                help: 'identifiant d onglet' },
  frame:     { kind: 'num',  get: r => r.frameId,              help: 'identifiant de cadre' },
  id:        { kind: 'num',  get: r => r.id,                   help: 'identifiant de ligne' },
  size:      { kind: 'num',  get: r => r.size,                 help: 'taille en octets' },
  duration:  { kind: 'num',  get: r => r.duration,             help: 'duree en millisecondes' },
  findings:  { kind: 'num',  get: r => r.findings,             help: 'nombre d alertes' },
  redirects: { kind: 'num',  get: r => r.redirects,            help: 'nombre de redirections' },
  ws:        { kind: 'num',  get: r => r.wsFrames,             help: 'nombre de trames WebSocket' },
  sse:       { kind: 'num',  get: r => r.sseEvents,            help: 'nombre de messages SSE' },
  cookies:   { kind: 'num',  get: r => r.setCookies,           help: 'nombre de Set-Cookie' },
  note:      { kind: 'text', get: r => r.note,                 help: 'annotation libre' },
  color:     { kind: 'text', get: r => r.color,                help: 'marquage couleur' },
  flag:      { kind: 'bool', get: r => r.flag,                 help: 'lignes epinglees' },
  third:     { kind: 'bool', get: r => r.thirdParty,           help: 'requete tierce' },
  cache:     { kind: 'bool', get: r => r.fromCache,            help: 'servi par le cache' },
  body:      { kind: 'bool', get: r => r.hasResBody,           help: 'corps de reponse capture' },
  stack:     { kind: 'bool', get: r => r.hasStack,             help: 'pile JavaScript presente' },
  private:   { kind: 'bool', get: r => r.incognito,            help: 'navigation privee' },
  replayed:  { kind: 'bool', get: r => r.replayed,             help: 'requete rejouee' },
  imported:  { kind: 'bool', get: r => r.imported,             help: 'ligne venue d un fichier HAR importe' },
  wire:      { kind: 'num',  get: r => r.wireSize,             help: 'octets reellement echanges' }
};

const TRUE_WORDS = new Set(['', 'oui', 'true', '1', 'vrai', 'yes']);
const CMP = /^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/;

export function parseQuery(input) {
  const terms = [];
  const raw = String(input || '').trim();
  if (!raw) return terms;

  const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  for (let part of parts) {
    let negate = false;
    if (part.startsWith('-') && part.length > 1) { negate = true; part = part.slice(1); }
    part = part.replace(/^"|"$/g, '');
    if (!part) continue;

    const m = /^([a-z]+):(.*)$/i.exec(part);
    if (m && FIELDS[m[1].toLowerCase()]) {
      const field = m[1].toLowerCase();
      const value = m[2].replace(/^"|"$/g, '');
      const cmp = CMP.exec(value.trim());
      if (cmp && FIELDS[field].kind === 'num') {
        terms.push({ kind: 'cmp', field, op: cmp[1], value: Number(cmp[2]), negate });
      } else {
        terms.push({ kind: 'field', field, value: value.toLowerCase(), negate });
      }
      continue;
    }

    const re = /^\/(.+)\/([a-z]*)$/.exec(part);
    if (re) {
      try { terms.push({ kind: 'regex', re: new RegExp(re[1], re[2] || 'i'), negate }); continue; }
      catch { /* expression invalide : traitee en texte libre */ }
    }
    terms.push({ kind: 'text', value: part.toLowerCase(), negate });
  }
  return terms;
}

function matchStatus(value, pattern) {
  if (/^\dxx$/i.test(pattern)) return value.startsWith(pattern[0]);
  return value.includes(pattern);
}

function compare(actual, op, expected) {
  if (actual == null) return false;
  const v = Number(actual);
  if (Number.isNaN(v)) return false;
  if (op === '>') return v > expected;
  if (op === '>=') return v >= expected;
  if (op === '<') return v < expected;
  if (op === '<=') return v <= expected;
  return v === expected;
}

export function matchTerms(rec, terms) {
  for (const t of terms) {
    let hit = false;

    if (t.kind === 'cmp') {
      hit = compare(FIELDS[t.field].get(rec), t.op, t.value);
    } else if (t.kind === 'field') {
      const def = FIELDS[t.field];
      const raw = def.get(rec);
      if (def.kind === 'bool') {
        hit = TRUE_WORDS.has(t.value) ? !!raw : !raw;
      } else {
        const value = String(raw ?? '').toLowerCase();
        hit = t.field === 'status' ? matchStatus(value, t.value) : value.includes(t.value);
      }
    } else if (t.kind === 'regex') {
      hit = t.re.test(rec.url);
    } else {
      hit = (rec.url + ' ' + rec.host + ' ' + rec.path + ' ' + rec.method + ' ' +
             (rec.mime || '') + ' ' + (rec.tags || []).join(' '))
              .toLowerCase().includes(t.value);
    }

    if (t.negate ? hit : !hit) return false;
  }
  return true;
}

/** Aide affichee dans la console : liste complete, jamais tronquee. */
export function fieldHelp() {
  return Object.entries(FIELDS).map(([name, def]) => ({
    name, kind: def.kind, help: def.help
  }));
}
