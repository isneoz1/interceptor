/* Faits constates, et nonce CSP reutilise — SWIFT (by NeoZ)
 *
 * Suite d analyzer-regles.js, dont elle suit la regle : une ALERTE ne sort que
 * pour une faille demontrable ; ce qui est exact sans etre une faille reste un
 * FAIT, affiche avec sa preuve mais jamais compte comme alerte.
 *
 *   Parametre renvoye dans la reponse (fait)
 *     La valeur d un parametre de la requete figure telle quelle dans le corps
 *     de la reponse. C est ce que cherche en premier quiconque teste une
 *     injection ; ce n est pas une faille a soi seul, car rien ne dit dans
 *     quel contexte la valeur retombe. On dit ou, combien de fois, et si des
 *     caracteres speciaux sont revenus SANS echappement.
 *
 *   Redirection vers la valeur d un parametre (fait)
 *     La cible d une redirection est exactement la valeur d un parametre de
 *     l URL qui l a produite. C est la forme d une redirection ouverte ; on ne
 *     pretend pas que le serveur accepterait n importe quelle valeur.
 *
 *   Mutation GraphQL executee sur une requete GET (fait)
 *     GraphQL over HTTP (§4.3) interdit d executer une mutation recue en GET ;
 *     le serveur l a pourtant fait, avec un statut 2xx. Une requete GET part
 *     d un simple lien ou d une image : c est la forme d une CSRF, que seuls
 *     les cookies et l absence d autre protection rendraient exploitable.
 *
 *   Schema GraphQL livre par introspection (fait)
 *     La reponse contient data.__schema : le schema entier de l API, avec ses
 *     types et ses mutations. Beaucoup d API publiques le veulent ainsi.
 *
 *   Nonce CSP reutilise (alerte)
 *     Un nonce n autorise un script que parce qu il est imprevisible : il doit
 *     changer a chaque reponse. Le meme nonce dans deux reponses distinctes se
 *     constate, et il suffit a un script injecte de le reprendre.
 */
import { addFinding } from './analyzer-regles.js';
import { graphqlDe } from './store.js';
import { lireReponseGraphql } from '../../ui/lib/graphql-http.js';

/* Une valeur plus courte se retrouve partout par hasard (« fr », « 1 », « true ») :
   la dire « renvoyee » ne dirait rien. */
const LONGUEUR_MIN = 6;
const REPONSE_TEXTE = /^(text\/|application\/(json|[\w.+-]*\+json|javascript|x-javascript|ecmascript|xml|[\w.+-]*\+xml|xhtml\+xml))/i;
const SPECIAUX = /[<>"']/;
const OCCURRENCES_MAX = 1000;
/* Le parcours coute (parametres × taille du corps) : sans borne, un formulaire
   de 5 000 champs face a un corps de 20 Mo figeait la capture dix secondes.
   Au-dela, un compte n est plus qu un minimum, et il est dit comme tel. */
const PARAMETRES_MAX = 64;
const CORPS_MAX = 2 * 1024 * 1024;

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const GABARITS_FAITS = {
  reflexionBrute: 'le parametre {nom} ({ou}) revient {n} fois dans la reponse, avec ses caracteres speciaux non echappes',
  reflexion: 'le parametre {nom} ({ou}) revient {n} fois tel quel dans la reponse',
  redirection: 'la redirection {statut} mene exactement a la valeur du parametre {nom} : {cible}',
  graphqlGetMutation: 'mutation GraphQL executee sur une requete GET (statut {statut}) : GraphQL over HTTP (§4.3) l interdit, et un simple lien ou une image peut la declencher avec les cookies du site',
  graphqlSchema: 'le serveur a repondu a une introspection GraphQL : son schema ({n} types) est livre a qui le demande',
  ouUrl: 'URL',
  ouCorps: 'corps de la requete'
};

/** Les parametres de la requete : l URL, puis le corps de formulaire ou JSON. */
export function parametresDe(rec) {
  const out = [];
  try {
    for (const [nom, valeur] of new URL(rec.finalUrl || rec.url).searchParams) out.push({ nom, valeur, ou: 'url' });
  } catch { /* URL illisible : aucun parametre */ }
  const corps = rec.requestBody;
  if (corps && corps.kind === 'formData' && corps.formData) {
    for (const [nom, valeurs] of Object.entries(corps.formData)) {
      for (const valeur of valeurs) out.push({ nom, valeur: String(valeur), ou: 'corps' });
    }
  } else if (corps && typeof corps.text === 'string' && corps.text) {
    const type = String(corps.contentType || '').toLowerCase();
    if (type.includes('x-www-form-urlencoded')) {
      for (const [nom, valeur] of new URLSearchParams(corps.text)) out.push({ nom, valeur, ou: 'corps' });
    } else if (type.includes('json')) {
      try {
        const objet = JSON.parse(corps.text);
        if (objet && typeof objet === 'object' && !Array.isArray(objet)) {
          for (const [nom, valeur] of Object.entries(objet)) {
            if (typeof valeur === 'string') out.push({ nom, valeur, ou: 'corps' });
          }
        }
      } catch { /* corps JSON invalide : rien a en tirer */ }
    }
  }
  return out;
}

function compter(texte, motif) {
  let n = 0;
  for (let i = texte.indexOf(motif); i >= 0 && n < OCCURRENCES_MAX; i = texte.indexOf(motif, i + motif.length)) n++;
  return n;
}

/** Parametres renvoyes tels quels dans le corps de la reponse. */
export function constaterReflexions(rec, faits, tags) {
  const corps = rec.responseBody;
  if (!corps || typeof corps.text !== 'string' || !corps.text || corps.base64) return;
  if (!REPONSE_TEXTE.test(String(rec.mime || ''))) return;
  const texte = corps.text.length > CORPS_MAX ? corps.text.slice(0, CORPS_MAX) : corps.text;
  const partiel = texte.length < corps.text.length;
  const vus = new Set();
  for (const p of parametresDe(rec)) {
    const valeur = p.valeur;
    if (valeur.length < LONGUEUR_MIN || !/[a-z]/i.test(valeur)) continue;
    if (vus.has(p.nom + '\n' + valeur)) continue;
    if (vus.size >= PARAMETRES_MAX) break;
    vus.add(p.nom + '\n' + valeur);
    const n = compter(texte, valeur);
    if (!n) continue;
    const brut = SPECIAUX.test(valeur);
    faits.push({
      type: 'reflexion',
      texte: brut ? GABARITS_FAITS.reflexionBrute : GABARITS_FAITS.reflexion,
      valeurs: { nom: p.nom, ou: p.ou === 'url' ? GABARITS_FAITS.ouUrl : GABARITS_FAITS.ouCorps,
        n: partiel || n >= OCCURRENCES_MAX ? n + '+' : n },
      aTraduire: ['ou']
    });
    tags.add(brut ? 'reflete-brut' : 'reflete');
  }
}

/** Redirections dont la cible est exactement la valeur d un parametre. */
export function constaterRedirections(rec, faits, tags) {
  for (const r of rec.redirects || []) {
    let source;
    try { source = new URL(r.from); } catch { continue; }
    for (const [nom, valeur] of source.searchParams) {
      if (!valeur) continue;
      let resolue = null;
      try { resolue = new URL(valeur, r.from).href; } catch { /* valeur qui n est pas une URL */ }
      if (valeur !== r.to && resolue !== r.to) continue;
      faits.push({
        type: 'redirection',
        texte: GABARITS_FAITS.redirection,
        valeurs: { statut: r.statusCode, nom, cible: r.to }
      });
      tags.add('redirection-parametree');
    }
  }
}

/** Les faits d une requete GraphQL : marqueur, mutation en GET, schema livre. */
export function constaterGraphql(rec, faits, tags) {
  const requete = graphqlDe(rec);
  if (!requete) return;
  tags.add('graphql');
  const statut = rec.statusCode;
  const enGet = String(rec.method || '').toUpperCase() === 'GET';
  if (enGet && statut >= 200 && statut < 300
      && requete.requetes.some(r => r.operation && r.operation.type === 'mutation')) {
    faits.push({ type: 'graphql', texte: GABARITS_FAITS.graphqlGetMutation, valeurs: { statut } });
    tags.add('graphql-mutation-get');
  }
  /* Le corps de la reponse n est relu que si la requete demandait le schema :
     une reponse GraphQL ordinaire peut peser des megaoctets. */
  if (!requete.requetes.some(r => r.introspection)) return;
  const corps = rec.responseBody;
  if (!corps || typeof corps.text !== 'string' || !corps.text || corps.text.length > CORPS_MAX) return;
  const reponse = lireReponseGraphql(corps.text);
  const schema = reponse && reponse.resultats.map(r => r.schema).find(Boolean);
  if (!schema) return;
  faits.push({ type: 'graphql', texte: GABARITS_FAITS.graphqlSchema, valeurs: { n: schema.types } });
  tags.add('graphql-introspection');
}

/* ------------------------------ Nonce CSP --------------------------------- */
/* nonce -> { id, url, debut } de la premiere reponse ou il a ete vu. */
const nonces = new Map();
const NONCES_MAX = 20000;

export function oublierNonces() { nonces.clear(); }

function noncesDe(rec) {
  const out = new Set();
  for (const h of rec.responseHeaders || []) {
    const nom = String(h.name || '').toLowerCase();
    if (nom !== 'content-security-policy' && nom !== 'content-security-policy-report-only') continue;
    for (const m of String(h.value || '').matchAll(/'nonce-([^'\s]+)'/gi)) out.add(m[1]);
  }
  return out;
}

export function verifierNonces(rec, findings, seen) {
  /* Une reponse servie par le cache, ou un 304, repete legitimement la
     precedente : ce n est pas une nouvelle reponse. */
  if (rec.fromCache || rec.statusCode === 304) return;
  for (const nonce of noncesDe(rec)) {
    const deja = nonces.get(nonce);
    if (!deja) {
      if (nonces.size >= NONCES_MAX) nonces.delete(nonces.keys().next().value);
      nonces.set(nonce, { id: rec.id, url: rec.finalUrl || rec.url, debut: rec.startTime });
      continue;
    }
    if (deja.id === rec.id) continue;
    /* Le meme fichier HAR importe deux fois donne deux copies d une meme
       reponse : meme URL, meme instant. Ce n est pas une reutilisation. */
    if (deja.url === (rec.finalUrl || rec.url) && deja.debut === rec.startTime) continue;
    addFinding(findings, seen, {
      rule: 'csp', severity: 'medium', title: 'Nonce CSP reutilise',
      where: 'responseHeaders', sample: nonce,
      preuve: 'le nonce {nonce} figure deja dans la politique CSP de la reponse n° {id} ({url}) : '
        + 'un nonce n autorise un script que s il est imprevisible, donc different a chaque reponse — '
        + 'un script injecte peut reprendre celui-ci',
      preuveValeurs: { nonce, id: deja.id, url: deja.url }
    });
  }
}
