/* Schema JSON deduit d exemples — SWIFT (by NeoZ)
 *
 * A partir de valeurs JSON reellement observees, le schema JSON (version
 * 2020-12, celle qu emploie OpenAPI 3.1) qui les accepte toutes :
 *
 *   - un type par valeur, et l union des types quand ils different (« string »
 *     puis null donnent ["null", "string"]) ; un entier et un decimal au meme
 *     endroit donnent « number », dont l entier fait partie ;
 *   - les proprietes d un objet, et en `required` celles presentes dans TOUS
 *     les exemples : une seule absence suffit a les rendre facultatives ;
 *   - les elements d un tableau fusionnes en un seul schema ;
 *   - un format (date-time, date, uuid, uri) seulement quand chaque chaine
 *     observee a cet endroit le respecte strictement.
 *
 * Rien n est devine au-dela : ni enum, ni bornes, ni exemples. Un exemple
 * recopierait dans le schema des valeurs capturees — jetons, adresses — qui
 * n ont rien a faire dans un document qu on partage.
 *
 * Quand une valeur est trop grosse pour etre lue en entier, l endroit ou la
 * lecture s arrete ne recoit aucune contrainte : un schema qui refuserait une
 * valeur reellement observee serait faux, un schema plus large ne l est pas.
 */

const PROFONDEUR_MAX = 64;
const BUDGET = 250000;             // valeurs lues, au total, pour un schema
const DIALECTE = 'https://json-schema.org/draft/2020-12/schema';

/* ------------------------------- Formats ---------------------------------- */
/* RFC 3339 §5.6 : date-time et full-date. */
const DATE_HEURE = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|[+-](\d{2}):(\d{2}))$/;
const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
/* Une URI absolue http ou https faite des seuls caracteres de la RFC 3986 :
   non reserves, reserves, et « % » suivi de deux chiffres hexadecimaux. */
const URI_HTTP = /^https?:\/\/(?:[A-Za-z0-9\-._~:/?#[\]@!$&'()*+,;=]|%[0-9A-Fa-f]{2})+$/;

const JOURS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const bissextile = a => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;
function jourValide(a, m, j) {
  if (m < 1 || m > 12 || j < 1) return false;
  return j <= (m === 2 && !bissextile(a) ? 28 : JOURS[m - 1]);
}

/** Le format strict d une chaine, ou null. */
export function formatDe(s) {
  let m = DATE_HEURE.exec(s);
  if (m) {
    const [, a, mo, j, h, mi, se, , , dh, dm] = m;
    /* Pas de seconde intercalaire (:60) : les validateurs ne s accordent pas
       sur elle — la suite de tests de JSON Schema l accepte a 23:59 UTC,
       rfc3339-validator la refuse toujours. Sans format, le schema reste vrai
       pour tous. */
    const ok = jourValide(+a, +mo, +j) && +h <= 23 && +mi <= 59 && +se <= 59
      && (dh === undefined || (+dh <= 23 && +dm <= 59));
    return ok ? 'date-time' : null;
  }
  m = DATE.exec(s);
  if (m) return jourValide(+m[1], +m[2], +m[3]) ? 'date' : null;
  if (UUID.test(s)) return 'uuid';
  if (URI_HTTP.test(s)) {
    try { new URL(s); return 'uri'; } catch { return null; }
  }
  return null;
}

/* ----------------------------- Observation -------------------------------- */
const vide = () => ({
  types: new Set(), n: 0, format: undefined,
  proprietes: null, requises: null, elements: null, incomplet: false
});

function observateur() {
  let restant = BUDGET;
  const observer = (s, v, profondeur) => {
    s.n++;
    if (--restant < 0) { s.incomplet = true; return; }
    if (v === null) { s.types.add('null'); return; }
    if (Array.isArray(v)) {
      s.types.add('array');
      if (profondeur >= PROFONDEUR_MAX) { s.incomplet = true; return; }
      if (!s.elements) s.elements = vide();
      for (const x of v) {
        if (restant <= 0) { s.incomplet = true; return; }
        observer(s.elements, x, profondeur + 1);
      }
      return;
    }
    switch (typeof v) {
      case 'boolean': s.types.add('boolean'); return;
      case 'number': s.types.add(Number.isInteger(v) ? 'integer' : 'number'); return;
      case 'string': {
        s.types.add('string');
        const f = formatDe(v);
        s.format = s.format === undefined ? f : (s.format === f ? f : null);
        return;
      }
      case 'object': {
        s.types.add('object');
        if (profondeur >= PROFONDEUR_MAX) { s.incomplet = true; return; }
        const cles = Object.keys(v);
        if (!s.proprietes) { s.proprietes = new Map(); s.requises = new Set(cles); }
        else for (const c of [...s.requises]) if (!Object.prototype.hasOwnProperty.call(v, c)) s.requises.delete(c);
        for (const c of cles) {
          if (restant <= 0) { s.incomplet = true; return; }
          if (!s.proprietes.has(c)) s.proprietes.set(c, vide());
          observer(s.proprietes.get(c), v[c], profondeur + 1);
        }
        return;
      }
      default: s.incomplet = true;          // undefined, fonction : pas du JSON
    }
  };
  return observer;
}

/* ------------------------------- Ecriture --------------------------------- */
const ORDRE = ['null', 'boolean', 'integer', 'number', 'string', 'array', 'object'];

function versSchema(s) {
  /* Un endroit lu en partie ne contraint rien, pas meme son type : la valeur
     non lue pouvait en avoir un autre. Plus large, le schema reste vrai. */
  if (!s.n || s.incomplet) return {};
  const types = ORDRE.filter(x => s.types.has(x) && !(x === 'integer' && s.types.has('number')));
  const out = {};
  if (types.length === 1) out.type = types[0];
  else if (types.length > 1) out.type = types;
  if (s.types.has('string') && s.format) out.format = s.format;
  if (s.types.has('array') && s.elements && s.elements.n) out.items = versSchema(s.elements);
  if (s.types.has('object') && s.proprietes) {
    /* Object.fromEntries cree des proprietes propres : une cle « __proto__ »
       reste une cle, elle ne change pas le prototype. */
    out.properties = Object.fromEntries([...s.proprietes].map(([k, v]) => [k, versSchema(v)]));
    const requises = [...s.requises].filter(k => s.proprietes.has(k));
    if (requises.length) out.required = requises;
  }
  return out;
}

/**
 * Le schema qui accepte chacune des valeurs donnees.
 * @param {unknown[]} valeurs  des valeurs JSON deja lues
 * @returns {object} un schema JSON 2020-12, sans `$schema`
 */
export function schemaDeValeurs(valeurs) {
  const racine = vide();
  const observer = observateur();
  for (const v of valeurs) observer(racine, v, 0);
  return versSchema(racine);
}

/** Le meme, avec la declaration du dialecte en tete. */
export function schemaJson(valeurs) {
  return { $schema: DIALECTE, ...schemaDeValeurs(valeurs) };
}

/**
 * Boite a outils : un texte JSON, ou plusieurs exemples en JSON Lines (une
 * valeur par ligne), vers le schema qui les accepte tous.
 */
export function jsonVersSchema(texte) {
  const source = String(texte || '').trim();
  if (!source) throw new Error('JSON vide');
  let valeurs;
  try { valeurs = [JSON.parse(source)]; }
  catch {
    const lignes = source.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    try { valeurs = lignes.map(l => JSON.parse(l)); }
    catch (e) { throw new Error('JSON invalide : ' + (e && e.message ? e.message : e)); }
  }
  return JSON.stringify(schemaJson(valeurs), null, 2);
}
