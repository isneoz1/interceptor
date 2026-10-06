/* GraphQL sur HTTP — SWIFT (by NeoZ)
 *
 * Sur le reseau, toutes les requetes GraphQL se ressemblent : POST /graphql,
 * statut 200. Ce module lit ce qu elles portent vraiment.
 *
 *   La requete  les quatre parametres (query, operationName, variables,
 *               extensions) en GET ou en POST JSON, un lot (tableau JSON),
 *               le document brut (application/graphql) ou le formulaire
 *               multipart des envois de fichiers ; les operations du
 *               document et celle qui sera executee ; la requete persistee
 *               d Apollo, dont le hachage se verifie.
 *   La reponse  data et errors, et ce qu ils disent ensemble : resultat
 *               complet ou partiel, erreur d execution, erreur de requete ;
 *               le schema livre a une introspection.
 *
 * Sources, lues dans le texte :
 *   GraphQL (octobre 2021) §6.1 GetOperation, §7.1 format de la reponse
 *   GraphQL over HTTP (brouillon) §4.1 parametres, §4.3 GET, §5 reponse
 *     https://graphql.github.io/graphql-over-http/draft/
 *   Apollo, Automatic Persisted Queries : extensions.persistedQuery
 *   GraphQL multipart request (jaydenseric) : champs operations et map
 *
 * La lecture du document est lexicale : elle suit accolades et parentheses
 * en sautant chaines, blocs de texte et commentaires. Elle ne valide rien
 * contre un schema — elle dit ce que le document demande.
 */

const OPERATIONS = new Set(['query', 'mutation', 'subscription']);
const NOM = /[_A-Za-z][_0-9A-Za-z]*/y;
const NOMBRE = /-?[0-9][0-9.eE+-]*/y;
const IGNORE = /[\s,﻿]/;
/* Un document plus long n est plus une requete ecrite par un client : on
   ne le relit pas a chaque affichage d une ligne. */
const DOCUMENT_MAX = 512 * 1024;
const HACHAGE = /^[0-9a-f]{64}$/i;
const CLES_GRAPHQL = /"(?:query|extensions)"\s*:/;

const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const FAITS_GRAPHQL = {
  getMutation: 'mutation envoyee en GET : GraphQL over HTTP (§4.3) interdit d executer une mutation sur une requete GET et demande un statut 4xx, 405 recommande',
  getMutationExecutee: 'le serveur l a executee (statut {statut}) : une requete GET part d un simple lien ou d une image, avec les cookies du site',
  getMutationRefusee: 'le serveur l a refusee (statut {statut}), comme le demande la specification',
  ambigu: 'le document contient {n} operations et aucun operationName : le serveur ne peut pas choisir laquelle executer (GraphQL §6.1)',
  introuvable: 'operationName « {nom} » ne designe aucune operation du document (GraphQL §6.1)',
  illisible: 'le parametre {nom} n est pas du JSON valide',
  introspection: 'requete d introspection : elle demande le schema de l API (__schema ou __type)',
  persisteeSeule: 'requete persistee : seul le hachage SHA-256 du document est envoye, le serveur doit deja le connaitre',
  lot: 'lot de {n} operations dans une seule requete HTTP (pratique d Apollo et d autres serveurs, hors de la specification GraphQL over HTTP)',
  statut200Erreurs: 'statut HTTP {statut}, mais {n} erreur(s) GraphQL dans le corps : le verdict est dans la reponse, pas dans le statut',
  sansDataEn2xx: 'reponse sans entree data servie avec le statut {statut} : pour application/graphql-response+json, GraphQL over HTTP (§5) demande un statut 4xx ou 5xx',
  dataEnErreur: 'reponse avec des donnees servie avec le statut {statut} : pour application/graphql-response+json, GraphQL over HTTP (§5) demande un statut 2xx quand data n est pas null',
  typeMediaNouveau: 'type application/graphql-response+json : celui que definit GraphQL over HTTP pour les reponses',
  typeMediaAncien: 'type application/json : accepte pour les clients qui n annoncent pas application/graphql-response+json (GraphQL over HTTP §5)',
  persisteeInconnue: 'le serveur ne connait pas ce hachage (PERSISTED_QUERY_NOT_FOUND) : le client renvoie normalement la requete avec son texte complet',
  schemaLivre: 'le serveur a repondu a l introspection : son schema ({n} types) est livre a qui le demande',
  complete: 'resultat complet : des donnees, aucune erreur',
  partielle: 'resultat partiel : des champs ont echoue, les autres sont la (GraphQL §7.1)',
  erreurExecution: 'erreur d execution : data vaut null, aucun resultat n a pu etre produit (GraphQL §7.1)',
  erreurRequete: 'erreur de requete : aucune entree data, rien n a ete execute (GraphQL §7.1)'
};

/* Les formes de transport, nommees pour l affichage. */
export const FORMES_GRAPHQL = {
  url: 'GET, parametres d URL',
  json: 'POST, corps JSON',
  lot: 'POST, lot JSON',
  document: 'POST, document brut (application/graphql)',
  multipart: 'POST, formulaire multipart (envoi de fichiers)'
};

/* ------------------------------ Le document ------------------------------- */
/**
 * Les jetons significatifs d un document : noms, nombres, ponctuation. Une
 * chaine devient un jeton opaque ; espaces, virgules et commentaires sont
 * ignores, comme le veut la grammaire (« ignored tokens »).
 * @param {string} source
 * @returns {{t:string, v:string}[]}
 */
export function jetonsGraphql(source) {
  const s = String(source || '').slice(0, DOCUMENT_MAX);
  const sortie = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (IGNORE.test(c)) { i++; continue; }
    if (c === '#') {
      while (i < s.length && s[i] !== '\n' && s[i] !== '\r') i++;
      continue;
    }
    if (c === '"') {
      if (s.startsWith('"""', i)) {
        /* Bloc de texte : sa seule sequence d echappement est \""" . */
        let j = i + 3;
        while (j < s.length && !s.startsWith('"""', j)) j += s.startsWith('\\"""', j) ? 4 : 1;
        i = Math.min(s.length, j + 3);
      } else {
        let j = i + 1;
        while (j < s.length && s[j] !== '"' && s[j] !== '\n') j += s[j] === '\\' ? 2 : 1;
        i = j + 1;
      }
      sortie.push({ t: 'chaine', v: '' });
      continue;
    }
    NOM.lastIndex = i;
    const nom = NOM.exec(s);
    if (nom) { sortie.push({ t: 'nom', v: nom[0] }); i += nom[0].length; continue; }
    NOMBRE.lastIndex = i;
    const nombre = NOMBRE.exec(s);
    if (nombre) { sortie.push({ t: 'nombre', v: nombre[0] }); i += nombre[0].length; continue; }
    sortie.push({ t: 'ponct', v: c });
    i++;
  }
  return sortie;
}

/**
 * Les operations d un document, dans l ordre : type et nom (null si anonyme).
 * Fragments et definitions de schema sont sautes ; une accolade entre les
 * parentheses de niveau zero (valeur par defaut d une variable, argument
 * d une directive) n ouvre pas de selection.
 *
 * Un document qui n est pas du GraphQL donne une liste vide : un parametre
 * « query » portant un objet JSON n est pas pris pour une requete anonyme,
 * car une selection commence par un nom ou « ... », jamais par une chaine.
 * @param {string} source
 * @returns {{type:string, nom:string|null}[]}
 */
export function operationsGraphql(source) {
  const j = jetonsGraphql(source);
  const ops = [];
  let profondeur = 0;
  let parentheses = 0;
  let enCours = null;              // une definition attend son corps
  for (let k = 0; k < j.length; k++) {
    const x = j[k];
    if (profondeur > 0) {
      if (x.v === '{') profondeur++;
      else if (x.v === '}' && --profondeur === 0) enCours = null;
      continue;
    }
    if (parentheses > 0) {
      if (x.v === '(') parentheses++;
      else if (x.v === ')') parentheses--;
      continue;
    }
    if (x.t === 'ponct' && x.v === '(') { parentheses = 1; continue; }
    if (x.t === 'ponct' && x.v === '{') {
      if (enCours === null) {
        const suivant = j[k + 1];
        if (!suivant || !(suivant.t === 'nom' || suivant.v === '.')) return [];
        ops.push({ type: 'query', nom: null });      // forme abregee « { ... } »
      }
      profondeur = 1;
      continue;
    }
    if (x.t === 'nom' && enCours === null) {
      if (OPERATIONS.has(x.v)) {
        const suivant = j[k + 1];
        const nom = suivant && suivant.t === 'nom' ? suivant.v : null;
        ops.push({ type: x.v, nom });
        if (nom) k++;
        enCours = 'operation';
      } else {
        enCours = 'autre';                             // fragment, ou schema
      }
    }
  }
  return ops;
}

/**
 * Le document demande-t-il le schema ? Les champs __schema et __type sont
 * ceux de l introspection (GraphQL §4) ; __typename n en est pas : il ne
 * dit que le type d un objet deja demande.
 * @param {string} source
 */
export function introspectionGraphql(source) {
  const j = jetonsGraphql(source);
  for (let k = 0; k < j.length; k++) {
    const x = j[k];
    if (x.t !== 'nom' || (x.v !== '__schema' && x.v !== '__type')) continue;
    const apres = j[k + 1];
    const avant = j[k - 1];
    if (apres && apres.v === ':') continue;                          // un alias
    if (avant && (avant.v === '$' || avant.v === '@' || avant.v === '.')) continue;
    return true;
  }
  return false;
}

/**
 * L operation executee, selon GetOperation (GraphQL §6.1) : celle que nomme
 * operationName, sinon la seule du document. Un operationName vide est traite
 * comme absent, comme le font les serveurs courants.
 */
export function choisirOperation(operations, operationName) {
  if (typeof operationName === 'string' && operationName !== '') {
    const trouvee = operations.find(o => o.nom === operationName);
    return trouvee ? { operation: trouvee, probleme: null } : { operation: null, probleme: 'introuvable' };
  }
  if (operations.length === 1) return { operation: operations[0], probleme: null };
  return { operation: null, probleme: operations.length > 1 ? 'ambigu' : null };
}

/* ------------------------------ La requete -------------------------------- */
function jsonDe(texte) {
  if (typeof texte !== 'string') return undefined;
  const s = texte.trim();
  if (!s || (s[0] !== '{' && s[0] !== '[')) return undefined;
  try { return JSON.parse(s); } catch { return undefined; }
}

/* `variables` et `extensions` sont des objets en POST JSON, des chaines JSON
   en GET (§4.3) — et certains clients les envoient en chaine meme en POST. */
function parametreJson(valeur, nom, illisibles) {
  if (valeur === undefined || valeur === null || valeur === '') return null;
  if (typeof valeur !== 'string') return valeur;
  try { return JSON.parse(valeur); } catch { illisibles.push(nom); return null; }
}

function persisteeDe(extensions) {
  const p = estObjet(extensions) && estObjet(extensions.persistedQuery) ? extensions.persistedQuery : null;
  if (!p || typeof p.sha256Hash !== 'string') return null;
  return { version: p.version ?? null, hash: p.sha256Hash, formeValide: HACHAGE.test(p.sha256Hash) };
}

/** Une requete GraphQL lue depuis ses quatre parametres, ou null. */
function requeteDepuis(params) {
  if (!estObjet(params)) return null;
  const illisibles = [];
  const query = typeof params.query === 'string' ? params.query : null;
  const extensions = parametreJson(params.extensions, 'extensions', illisibles);
  const persistee = persisteeDe(extensions);
  const operations = query !== null ? operationsGraphql(query) : [];
  if (!operations.length && !persistee) return null;
  const operationName = typeof params.operationName === 'string' ? params.operationName : null;
  const variables = parametreJson(params.variables, 'variables', illisibles);
  const { operation, probleme } = choisirOperation(operations, operationName);
  return {
    query, operationName, variables, extensions, operations, operation, probleme,
    persistee, illisibles,
    introspection: query !== null && introspectionGraphql(query)
  };
}

/**
 * La requete GraphQL que porte un echange HTTP, ou null s il n y en a pas.
 * @param {{ methode?:string, url?:string, corps?:object }} echange
 *        corps : { text, contentType, formData } comme dans un enregistrement
 */
export function lireRequeteGraphql({ methode = 'GET', url = '', corps = null } = {}) {
  /* 1. Les parametres de l URL : la forme GET (§4.3). */
  let parametres = null;
  try { parametres = new URL(url).searchParams; } catch { /* URL relative ou illisible */ }
  if (parametres && (parametres.has('query') || parametres.has('extensions'))) {
    const r = requeteDepuis({
      query: parametres.get('query'), operationName: parametres.get('operationName'),
      variables: parametres.get('variables'), extensions: parametres.get('extensions')
    });
    if (r) return { methode, forme: 'url', requetes: [r] };
  }
  if (!corps) return null;

  const type = String(corps.contentType || '').toLowerCase();
  const texte = typeof corps.text === 'string' ? corps.text : '';

  /* 2. Le formulaire multipart des envois de fichiers : un champ
        « operations » qui porte le JSON habituel. */
  const champs = corps.formData && Array.isArray(corps.formData.operations) ? corps.formData.operations : null;
  if (champs && champs.length) {
    const lu = depuisJson(jsonDe(String(champs[0])));
    if (lu) return { methode, forme: 'multipart', ...lu };
  }

  /* 3. Le document brut, envoye tel quel. */
  if (/^application\/graphql\b/.test(type) && !/json/.test(type) && texte) {
    const r = requeteDepuis({ query: texte });
    if (r) return { methode, forme: 'document', requetes: [r] };
  }

  /* 4. Le corps JSON : un objet, ou un lot. Le noyau lit chaque corps POST :
        sans cle « query » ni « extensions », il n y a rien a analyser, et un
        parcours lineaire coute bien moins qu une analyse JSON complete. */
  if (!CLES_GRAPHQL.test(texte)) return null;
  const lu = depuisJson(jsonDe(texte));
  return lu ? { methode, forme: lu.requetes.length > 1 || lu.lot ? 'lot' : 'json', ...lu } : null;
}

function depuisJson(valeur) {
  if (Array.isArray(valeur)) {
    if (!valeur.length) return null;
    const requetes = valeur.map(requeteDepuis);
    return requetes.every(Boolean) ? { requetes, lot: true } : null;
  }
  const r = requeteDepuis(valeur);
  return r ? { requetes: [r], lot: false } : null;
}

/**
 * Le resume d une requete pour le tableau : l operation executee de chaque
 * requete, ou null pour une requete persistee envoyee sans son texte.
 */
export function resumeGraphql(lu) {
  if (!lu) return null;
  return {
    lot: lu.requetes.length > 1 || lu.forme === 'lot',
    ops: lu.requetes.map(r => (r.operation ? { type: r.operation.type, nom: r.operation.nom } : null)),
    persistee: lu.requetes.some(r => r.persistee && r.query === null)
  };
}

/**
 * Le texte d un resume, pour le tableau et la recherche : « query GetUser »,
 * « mutation Save, query Me » pour un lot. Une requete persistee envoyee sans
 * son texte n a pas d operation lisible : elle prend le mot fourni.
 */
export function texteGraphql(resume, motPersistee = 'persisted') {
  if (!resume || !Array.isArray(resume.ops)) return '';
  return resume.ops.map(o => (o ? o.type + (o.nom ? ' ' + o.nom : '') : motPersistee)).join(', ');
}

/* ------------------------------ La reponse -------------------------------- */
const estResultat = r => estObjet(r) && ('data' in r || 'errors' in r);

function erreursDe(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.map(e => {
    const o = estObjet(e) ? e : {};
    const extensions = estObjet(o.extensions) ? o.extensions : {};
    return {
      message: typeof o.message === 'string' ? o.message : String(o.message ?? ''),
      chemin: Array.isArray(o.path) ? o.path.join('.') : null,
      lieux: Array.isArray(o.locations)
        ? o.locations.filter(estObjet).map(l => l.line + ':' + l.column).join(', ') || null
        : null,
      code: typeof extensions.code === 'string' ? extensions.code : null
    };
  });
}

/** Ce que dit un schema livre par introspection : de quoi juger d un coup d oeil. */
function schemaDe(s) {
  if (!estObjet(s)) return null;
  const nomDe = v => (estObjet(v) && typeof v.name === 'string' ? v.name : null);
  const types = Array.isArray(s.types) ? s.types.filter(estObjet) : [];
  return {
    types: types.length,
    propres: types.filter(x => typeof x.name === 'string' && !x.name.startsWith('__')).length,
    requete: nomDe(s.queryType),
    mutation: nomDe(s.mutationType),
    abonnement: nomDe(s.subscriptionType),
    directives: Array.isArray(s.directives) ? s.directives.length : 0
  };
}

function natureDe(r, erreurs) {
  if (!('data' in r)) return erreurs.length ? 'erreurRequete' : null;
  if (r.data === null) return erreurs.length ? 'erreurExecution' : null;
  return erreurs.length ? 'partielle' : 'complete';
}

/**
 * Le resultat GraphQL d une reponse, ou null si le corps n en est pas un.
 * @param {string} texte  le corps de la reponse
 */
export function lireReponseGraphql(texte) {
  const valeur = jsonDe(texte);
  const liste = Array.isArray(valeur) ? valeur : [valeur];
  if (!liste.length || !liste.every(estResultat)) return null;
  return {
    lot: Array.isArray(valeur),
    resultats: liste.map(r => {
      const erreurs = erreursDe(r.errors);
      return {
        nature: natureDe(r, erreurs),
        erreurs,
        schema: estObjet(r.data) ? schemaDe(r.data.__schema) : null,
        extensions: estObjet(r.extensions) ? r.extensions : null
      };
    })
  };
}

/**
 * Les faits d un echange complet : la requete lue, la reponse lue, le statut
 * HTTP et le type de la reponse. Chaque fait porte son gabarit et ses valeurs.
 */
export function faitsGraphql(requete, reponse, { statut = null, typeMedia = '' } = {}) {
  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_GRAPHQL[cle], valeurs });
  if (!requete) return faits;

  if (requete.requetes.length > 1 || requete.forme === 'lot') dire('lot', { n: requete.requetes.length });
  for (const r of requete.requetes) {
    if (r.probleme === 'ambigu') dire('ambigu', { n: r.operations.length });
    if (r.probleme === 'introuvable') dire('introuvable', { nom: r.operationName });
    for (const nom of r.illisibles) dire('illisible', { nom });
    if (r.introspection) dire('introspection');
    if (r.persistee && r.query === null) dire('persisteeSeule');
    if (String(requete.methode).toUpperCase() === 'GET' && r.operation && r.operation.type === 'mutation') {
      dire('getMutation');
      if (statut >= 200 && statut < 300) dire('getMutationExecutee', { statut });
      else if (statut >= 400 && statut < 500) dire('getMutationRefusee', { statut });
    }
  }
  if (!reponse) return faits;

  const type = String(typeMedia || '').toLowerCase().split(';')[0].trim();
  if (type === 'application/graphql-response+json') dire('typeMediaNouveau');
  else if (type === 'application/json') dire('typeMediaAncien');

  const erreurs = reponse.resultats.reduce((n, r) => n + r.erreurs.length, 0);
  if (erreurs && statut >= 200 && statut < 300) dire('statut200Erreurs', { statut, n: erreurs });
  for (const r of reponse.resultats) {
    if (r.nature) dire(r.nature);
    if (type === 'application/graphql-response+json' && !reponse.lot && statut != null) {
      if (r.nature === 'erreurRequete' && statut >= 200 && statut < 300) dire('sansDataEn2xx', { statut });
      if ((r.nature === 'complete' || r.nature === 'partielle') && (statut < 200 || statut >= 300)) {
        dire('dataEnErreur', { statut });
      }
    }
    if (r.erreurs.some(e => e.code === 'PERSISTED_QUERY_NOT_FOUND')) dire('persisteeInconnue');
    if (r.schema) dire('schemaLivre', { n: r.schema.types });
  }
  return faits;
}

/* ---------------------------- Requete persistee --------------------------- */
async function sha256Hex(texte) {
  const octets = new TextEncoder().encode(texte);
  const empreinte = await globalThis.crypto.subtle.digest('SHA-256', octets);
  return [...new Uint8Array(empreinte)].map(o => o.toString(16).padStart(2, '0')).join('');
}

/**
 * Le hachage annonce correspond-il au texte envoye ? Apollo hache la chaine
 * `query` telle quelle, en UTF-8, sans la normaliser.
 * @returns {Promise<{annonce:string, calcule:string, egal:boolean}>}
 */
export async function verifierPersistee(query, hash) {
  const calcule = await sha256Hex(String(query));
  return { annonce: String(hash), calcule, egal: calcule === String(hash).toLowerCase() };
}
