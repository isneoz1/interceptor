/* Description OpenAPI 3.1 deduite du trafic — SWIFT (by NeoZ)
 *
 * Les appels d API captures, regroupes en operations (methode + chemin) et
 * decrits en OpenAPI 3.1.0 : parametres d URL, corps envoyes et recus, codes
 * de statut, schemes d authentification. Le document s ouvre dans Swagger UI,
 * Redoc, Postman, Insomnia, ou sert a generer un client.
 *
 * Il ne decrit QUE ce qui a ete vu, et le dit dans sa description :
 *   - un segment de chemin devient parametre s il a la forme d un identifiant
 *     (entier, UUID, au moins seize chiffres hexadecimaux) — rien d autre
 *     n est deduit ;
 *   - un parametre d URL n est jamais marque obligatoire : l avoir vu a chaque
 *     appel ne prouve pas que le serveur l exige ;
 *   - les schemas viennent de ui/lib/schema-json.js, sans exemples : aucune
 *     valeur capturee (jeton, adresse, identifiant) ne quitte la capture par
 *     ce fichier ;
 *   - un corps tronque a la capture n est pas lu, son type reste annonce.
 *
 * Une description OpenAPI vaut pour une origine : quand la selection en
 * melange plusieurs, l origine la plus representee est decrite, et le
 * document dit combien de requetes d autres origines il laisse de cote.
 */
import { schemaDeValeurs } from '../../ui/lib/schema-json.js';
import { STATUTS } from '../../ui/lib/ref-http.js';

const TYPES_API = new Set(['xmlhttprequest', 'beacon', 'ping', 'other']);
const ORDRE_METHODES = ['get', 'put', 'post', 'delete', 'options', 'head', 'patch', 'trace'];
const NOMS_STATUTS = new Map(STATUTS.map(s => [s.code, s.nom]));
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const HEXA = /^[0-9a-f]{16,}$/i;
const ENTIER = /^[0-9]+$/;

const enteteDe = (liste, nom) => {
  const h = (liste || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '') : '';
};
const typeDeBase = t => String(t || '').split(';')[0].trim().toLowerCase();
const estJson = t => t === 'application/json' || /\+json$/.test(t);

/** Un appel d API, et non une page, une image ou un preflight CORS. */
export function estAppelApi(rec) {
  if (!rec || !/^https?:/i.test(String(rec.url || ''))) return false;
  if (!TYPES_API.has(rec.type)) return false;
  if (String(rec.method || '').toUpperCase() === 'OPTIONS'
      && enteteDe(rec.requestHeaders, 'access-control-request-method')) return false;
  return true;
}

/* --------------------------- Chemins et parametres ------------------------ */
function formeDuSegment(segment) {
  if (ENTIER.test(segment)) return 'entier';
  if (UUID.test(segment)) return 'uuid';
  if (HEXA.test(segment)) return 'hexa';
  return null;
}

/**
 * Le gabarit d un chemin : « /v2/users/42 » devient « /v2/users/{usersId} ».
 * Le nom vient du segment fixe qui precede ; il est rendu unique.
 */
export function gabaritDuChemin(chemin) {
  const segments = String(chemin || '/').split('/');
  const noms = new Set();
  const parametres = [];
  const sortie = segments.map((segment, i) => {
    let brut = segment;
    try { brut = decodeURIComponent(segment); } catch { /* segment mal encode : garde tel quel */ }
    const forme = i > 0 ? formeDuSegment(brut) : null;
    if (!forme) return segment;
    const precedent = (segments[i - 1] || '').replace(/[^A-Za-z0-9_]/g, '');
    let nom = (precedent && !/^\d/.test(precedent) ? precedent : 'param') + 'Id';
    for (let k = 2; noms.has(nom); k++) nom = nom.replace(/\d*$/, '') + k;
    noms.add(nom);
    parametres.push({ nom, forme, valeur: brut });
    return '{' + nom + '}';
  });
  return { gabarit: sortie.join('/') || '/', parametres };
}

const SCHEMA_DE_FORME = {
  entier: { type: 'integer' },
  uuid: { type: 'string', format: 'uuid' },
  hexa: { type: 'string' }
};

/* ------------------------------- Les corps -------------------------------- */
/* Un corps lu comme valeur JSON, ou undefined : tronque, absent, illisible. */
function jsonDuCorps(corps, type) {
  if (!corps || corps.truncated || typeof corps.text !== 'string' || !corps.text) return undefined;
  if (!estJson(type)) return undefined;
  try { return JSON.parse(corps.text); } catch { return undefined; }
}

/* Un formulaire : des champs texte, un tableau quand un nom revient. */
function formulaireDe(corps) {
  if (!corps || !corps.formData || typeof corps.formData !== 'object') return undefined;
  const sortie = {};
  for (const [nom, valeurs] of Object.entries(corps.formData)) {
    sortie[nom] = Array.isArray(valeurs) && valeurs.length > 1 ? valeurs.map(String) : String((valeurs || [])[0] ?? '');
  }
  return sortie;
}

/* Les exemples d un contenu, regroupes par type de media. */
function noterContenu(table, type, valeur) {
  if (!type) return;
  if (!table.has(type)) table.set(type, []);
  if (valeur !== undefined) table.get(type).push(valeur);
}

function contenuOpenApi(table) {
  const sortie = {};
  for (const [type, exemples] of table) {
    sortie[type] = exemples.length ? { schema: schemaDeValeurs(exemples) } : {};
  }
  return sortie;
}

/* ----------------------------- Construction ------------------------------- */
function origineDe(url) {
  try { return new URL(url).origin; } catch { return null; }
}

/**
 * La description OpenAPI 3.1 des appels d API parmi les enregistrements.
 * @param {object[]} records  enregistrements complets du magasin
 * @param {{ maintenant?: Date }} [options]
 * @returns {{ document: object|null, operations: number, decrites: number, ecartees: number, origine: string|null }}
 */
export function buildOpenApi(records, { maintenant = new Date() } = {}) {
  const appels = records.filter(estAppelApi);
  const parOrigine = new Map();
  for (const r of appels) {
    const o = origineDe(r.finalUrl || r.url);
    if (!o) continue;
    if (!parOrigine.has(o)) parOrigine.set(o, []);
    parOrigine.get(o).push(r);
  }
  if (!parOrigine.size) return { document: null, operations: 0, decrites: 0, ecartees: 0, origine: null };
  const [origine, retenus] = [...parOrigine].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))[0];
  const ecartees = appels.length - retenus.length;

  /* Les operations : methode + gabarit de chemin. */
  const operations = new Map();
  const schemes = new Set();
  let debut = Infinity;
  let fin = -Infinity;
  for (const r of retenus) {
    let url;
    try { url = new URL(r.finalUrl || r.url); } catch { continue; }
    const methode = String(r.method || 'GET').toLowerCase();
    if (!ORDRE_METHODES.includes(methode)) continue;
    const { gabarit, parametres } = gabaritDuChemin(url.pathname);
    const cle = methode + ' ' + gabarit;
    if (!operations.has(cle)) {
      operations.set(cle, {
        methode, gabarit, n: 0,
        chemin: new Map(), requete: new Map(), corps: new Map(), reponses: new Map(), securite: new Set()
      });
    }
    const op = operations.get(cle);
    op.n++;
    if (Number.isFinite(r.startTime)) { debut = Math.min(debut, r.startTime); fin = Math.max(fin, r.startTime); }

    for (const p of parametres) {
      const deja = op.chemin.get(p.nom);
      op.chemin.set(p.nom, deja && deja !== p.forme ? 'hexa' : p.forme);
    }
    for (const nom of url.searchParams.keys()) op.requete.set(nom, true);

    /* Le corps envoye. */
    const corps = r.requestBody;
    if (corps) {
      const type = typeDeBase(corps.contentType || enteteDe(r.requestHeaders, 'content-type'));
      if (corps.formData) noterContenu(op.corps, type || 'application/x-www-form-urlencoded', formulaireDe(corps));
      else noterContenu(op.corps, type || null, jsonDuCorps(corps, type));
    }

    /* La reponse, par code de statut puis par type de contenu. */
    if (Number.isInteger(r.statusCode) && r.statusCode >= 100) {
      const code = String(r.statusCode);
      if (!op.reponses.has(code)) op.reponses.set(code, new Map());
      const type = typeDeBase(r.mime || enteteDe(r.responseHeaders, 'content-type'));
      const aCorps = r.responseBody && (r.responseBody.size > 0 || (r.responseBody.text || '').length > 0);
      if (type && aCorps) noterContenu(op.reponses.get(code), type, jsonDuCorps(r.responseBody, type));
    }

    /* L authentification annoncee par l entete Authorization : son schema
       seulement, jamais sa valeur. */
    const auth = enteteDe(r.requestHeaders, 'authorization').trim().split(/\s+/)[0].toLowerCase();
    if (auth === 'bearer') op.securite.add('bearerAuth');
    else if (auth === 'basic') op.securite.add('basicAuth');
    for (const s of op.securite) schemes.add(s);
  }

  const paths = {};
  const cles = [...operations.keys()].sort((a, b) => {
    const [ma, ga] = a.split(' ');
    const [mb, gb] = b.split(' ');
    return ga.localeCompare(gb) || ORDRE_METHODES.indexOf(ma) - ORDRE_METHODES.indexOf(mb);
  });
  for (const cle of cles) {
    const op = operations.get(cle);
    const sortie = { summary: op.methode.toUpperCase() + ' ' + op.gabarit };
    const parametres = [
      ...[...op.chemin].map(([nom, forme]) => ({ name: nom, in: 'path', required: true, schema: SCHEMA_DE_FORME[forme] })),
      ...[...op.requete.keys()].sort().map(nom => ({ name: nom, in: 'query', schema: { type: 'string' } }))
    ];
    if (parametres.length) sortie.parameters = parametres;
    if (op.corps.size) sortie.requestBody = { content: contenuOpenApi(op.corps) };
    sortie.responses = {};
    for (const code of [...op.reponses.keys()].sort()) {
      const contenu = op.reponses.get(code);
      sortie.responses[code] = {
        description: NOMS_STATUTS.get(Number(code)) || 'Status ' + code,
        ...(contenu.size ? { content: contenuOpenApi(contenu) } : {})
      };
    }
    /* OpenAPI exige au moins une reponse : une operation sans reponse
       observee (echec reseau, requete en cours) le dit telle quelle. */
    if (!Object.keys(sortie.responses).length) {
      sortie.responses.default = { description: 'No response observed' };
    }
    if (op.securite.size) sortie.security = [...op.securite].sort().map(s => ({ [s]: [] }));
    sortie['x-swift-observations'] = op.n;
    if (!paths[op.gabarit]) paths[op.gabarit] = {};
    paths[op.gabarit][op.methode] = sortie;
  }

  const hote = (() => { try { return new URL(origine).host; } catch { return origine; } })();
  const date = d => new Date(d).toISOString();
  const document = {
    openapi: '3.1.0',
    info: {
      title: hote,
      version: maintenant.toISOString().slice(0, 10),
      description: 'Description deduced by SWIFT from ' + retenus.length + ' observed API call(s)'
        + (Number.isFinite(debut) ? ' between ' + date(debut) + ' and ' + date(fin) : '') + '. '
        + 'It only holds what crossed the network: an endpoint, a parameter or a response that was not observed '
        + 'is absent. Path segments become parameters only when shaped like identifiers (integers, UUIDs, '
        + 'hexadecimal strings of 16 digits or more). Query parameters are never marked required. Schemas carry '
        + 'no examples: no captured value leaves the capture through this file.'
        + (ecartees ? ' ' + ecartees + ' call(s) to other origins were left out: filter by host to describe them.' : '')
    },
    servers: [{ url: origine }],
    paths
  };
  if (schemes.size) {
    document.components = { securitySchemes: {} };
    if (schemes.has('basicAuth')) document.components.securitySchemes.basicAuth = { type: 'http', scheme: 'basic' };
    if (schemes.has('bearerAuth')) document.components.securitySchemes.bearerAuth = { type: 'http', scheme: 'bearer' };
  }
  return { document, operations: operations.size, decrites: retenus.length, ecartees, origine };
}
