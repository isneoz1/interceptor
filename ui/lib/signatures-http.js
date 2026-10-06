/* Signatures de messages HTTP (RFC 9421) — SWIFT (by NeoZ)
 *
 * Un emetteur signe une partie choisie du message : `Signature-Input` dit
 * laquelle (les composants couverts et les parametres), `Signature` porte la
 * signature. Pour la verifier, il faut reconstruire octet pour octet la
 * « base de signature » que l emetteur a signee — c est ce que fait ce module,
 * a partir de ce que Firefox a rapporte de la requete et de la reponse.
 *
 * Tout ce qui ne peut pas etre reconstruit est dit, avec la raison : un champ
 * absent des en-tetes rapportes, un trailer (jamais expose aux extensions), un
 * parametre inconnu. Une base inventee donnerait un « signature invalide » faux.
 *
 * La verification passe par crypto.subtle ; rien n est reimplemente.
 * Verifie contre les exemples de l annexe B de la RFC 9421.
 */
import {
  lireDictionnaire, serialiserArticleDeBase, serialiserParametres, serialiserMembre,
  serialiserListe, serialiserDictionnaire, membreDuDictionnaire, lireListe, FORMES_CONNUES
} from './champs-structures.js';
import { texteVersOctets, base64VersOctets, hexVersOctets } from './bytes.js';
import { sujetCrypto, importerClePublique } from './cles-publiques.js';

/* Registre IANA « HTTP Signature Algorithms » (RFC 9421, 6.2.2). */
export const ALGORITHMES_SIGNATURE = {
  'rsa-pss-sha512': { cle: { name: 'RSA-PSS', hash: 'SHA-512' }, verif: { name: 'RSA-PSS', saltLength: 64 }, genre: 'RSA' },
  'rsa-v1_5-sha256': { cle: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verif: { name: 'RSASSA-PKCS1-v1_5' }, genre: 'RSA' },
  'hmac-sha256': { cle: { name: 'HMAC', hash: 'SHA-256' }, verif: { name: 'HMAC' }, genre: 'secret' },
  'ecdsa-p256-sha256': { cle: { name: 'ECDSA', namedCurve: 'P-256' }, verif: { name: 'ECDSA', hash: 'SHA-256' }, genre: 'EC' },
  'ecdsa-p384-sha384': { cle: { name: 'ECDSA', namedCurve: 'P-384' }, verif: { name: 'ECDSA', hash: 'SHA-384' }, genre: 'EC' },
  'ed25519': { cle: { name: 'Ed25519' }, verif: { name: 'Ed25519' }, genre: 'OKP' }
};

/* Les phrases, traduites a l affichage ; exportees pour le controle de traduction. */
export const FAITS_SIGNATURE = {
  vide: 'aucun composant couvert : cette signature ne lie rien du message (RFC 9421, 7.2.1)',
  contenuNonCouvert: 'le contenu n est pas couvert : aucun Content-Digest ni Repr-Digest parmi les composants (RFC 9421, 7.2.8)',
  expiree: 'expiree au moment de la capture (expires {date})',
  future: 'creee {n} s apres la capture (created {date})',
  sansValeur: 'le libelle {libelle} figure dans Signature-Input mais pas dans Signature',
  sansEntree: 'le libelle {libelle} figure dans Signature mais pas dans Signature-Input',
  algInconnu: 'algorithme {alg} absent du registre IANA des signatures HTTP',
  symetrique: 'algorithme symetrique : quiconque peut verifier peut aussi signer (RFC 9421, 7.3.3)',
  redirigee: 'requete redirigee : la base est construite sur le dernier saut ({url})'
};

/* Pourquoi une base ne peut pas etre construite. */
export const ERREURS_BASE = {
  absent: 'le champ {nom} est absent des en-tetes rapportes par Firefox',
  trailer: 'le composant {nom} est un trailer : Firefox ne les expose pas aux extensions',
  inconnu: 'composant derive inconnu : {nom}',
  parametre: 'parametre {param} inconnu sur le composant {nom}',
  incompatibles: 'parametres incompatibles sur le composant {nom}',
  reqSurRequete: 'le parametre req ne s applique qu a une reponse ({nom})',
  sansRequete: 'la requete de cette reponse n est pas connue ({nom})',
  statutRequete: '@status ne s applique qu a une reponse',
  doublon: 'le composant {nom} figure deux fois',
  parametreRequete: 'le parametre {param} manque ou figure plusieurs fois dans l URL',
  nomManquant: 'le composant {nom} ne dit pas quel parametre il couvre (name absent)',
  pasUneChaine: 'le composant {nom} n est pas une chaine : la RFC 9421 nomme chaque composant entre guillemets',
  listeAttendue: 'liste interne attendue pour {libelle}',
  cleAbsente: 'la cle {cle} est absente du dictionnaire {nom}',
  typeInconnu: 'le type structure du champ {nom} n est pas connu : sf ne peut pas etre applique',
  nonAscii: 'la valeur de {nom} n est pas en ASCII : ses octets exacts ne sont pas connus'
};

class ErreurBase extends Error {
  constructor(gabarit, valeurs) { super(gabarit); this.gabarit = gabarit; this.valeurs = valeurs; }
}
const echouer = (cle, valeurs) => { throw new ErreurBase(ERREURS_BASE[cle], valeurs); };

/* ------------------------------ Valeurs de champs ------------------------- */
function valeursDuChamp(entetes, nom) {
  return (entetes || [])
    .filter(h => String(h.name || '').toLowerCase() === nom)
    .map(h => String(h.value == null ? '' : h.value).trim().replace(/\r?\n[ \t]+/g, ' '));
}

function lireStructure(valeur, nom) {
  const forme = FORMES_CONNUES[nom];
  if (forme === 'dictionnaire') return { forme, membres: lireDictionnaire(valeur) };
  if (forme === 'liste') return { forme, membres: lireListe(valeur) };
  return echouer('typeInconnu', { nom });
}

function valeurDeChamp(entetes, nom, params) {
  const valeurs = valeursDuChamp(entetes, nom);
  if (!valeurs.length) echouer('absent', { nom });
  if (valeurs.some(v => /[^\x20-\x7e\t]/.test(v))) echouer('nonAscii', { nom });
  if (params.bs) {
    if (params.sf || params.key !== undefined) echouer('incompatibles', { nom });
    return valeurs.map(v => serialiserArticleDeBase({ type: 'suite d octets', valeur: texteVersOctets(v) })).join(', ');
  }
  const combinee = valeurs.join(', ');
  if (params.key !== undefined) {
    const membres = lireDictionnaire(combinee);
    const membre = membreDuDictionnaire(membres, params.key);
    if (!membre) echouer('cleAbsente', { cle: params.key, nom });
    /* La valeur du membre seule : un booleen vrai s ecrit ici « ?1 » (2.1.2). */
    return serialiserMembre(membre);
  }
  if (params.sf) {
    const s = lireStructure(combinee, nom);
    return s.forme === 'dictionnaire' ? serialiserDictionnaire(s.membres) : serialiserListe(s.membres);
  }
  return combinee;
}

/* ---------------------------- Composants derives -------------------------- */
/* Le jeu « application/x-www-form-urlencoded » de l URL Standard : tout sauf
   les alphanumeriques et « *-._ ». L espace devient %20, comme dans l exemple
   de la RFC 9421 (2.2.8). */
function encoderParametre(texte) {
  let sortie = '';
  for (const o of new TextEncoder().encode(texte)) {
    const garde = (o >= 0x30 && o <= 0x39) || (o >= 0x41 && o <= 0x5a) || (o >= 0x61 && o <= 0x7a)
      || o === 0x2a || o === 0x2d || o === 0x2e || o === 0x5f;
    sortie += garde ? String.fromCharCode(o) : '%' + o.toString(16).toUpperCase().padStart(2, '0');
  }
  return sortie;
}

function valeurDerivee(message, nom, params) {
  let u;
  if (nom !== '@status' && nom !== '@method') {
    try { u = new URL(message.url); } catch { echouer('absent', { nom }); }
  }
  switch (nom) {
    case '@method': return String(message.methode);
    /* Assemblee comme la cible d une requete HTTP : sans identifiants
       « user:pass@ » ni fragment, que le navigateur n envoie jamais. */
    case '@target-uri': return u.protocol + '//' + u.host + u.pathname + u.search;
    case '@authority': return u.host.toLowerCase();
    case '@scheme': return u.protocol.slice(0, -1).toLowerCase();
    case '@request-target': return u.pathname + u.search;
    case '@path': return u.pathname || '/';
    case '@query': return u.search || '?';
    case '@query-param': {
      if (typeof params.name !== 'string') echouer('nomManquant', { nom });
      const trouves = [...new URLSearchParams(u.search)].filter(([n]) => encoderParametre(n) === params.name);
      if (trouves.length !== 1) echouer('parametreRequete', { param: params.name });
      return encoderParametre(trouves[0][1]);
    }
    case '@status':
      if (message.statut == null) echouer('statutRequete', {});
      return String(message.statut);
    default: return echouer('inconnu', { nom });
  }
}

/* Parametres reconnus par composant (RFC 9421, 6.5.2). */
const PARAMS_CHAMP = new Set(['sf', 'key', 'bs', 'req', 'tr']);
const PARAMS_DERIVE = new Set(['req']);

function lireParams(article, nom) {
  const params = {};
  for (const p of article.parametres || []) {
    const permis = nom === '@query-param' ? p.cle === 'name' || p.cle === 'req'
      : nom.startsWith('@') ? PARAMS_DERIVE.has(p.cle) : PARAMS_CHAMP.has(p.cle);
    if (!permis) echouer('parametre', { param: p.cle, nom });
    params[p.cle] = p.valeur;
  }
  return params;
}

/** L identifiant d un composant tel qu il s ecrit dans la base. */
export function identifiantDe(article) {
  return serialiserArticleDeBase(article) + serialiserParametres(article.parametres);
}

/**
 * La base de signature (RFC 9421, 2.5).
 *
 * @param message  { sens: 'requete' | 'reponse', methode, url, entetes, statut,
 *                   requete: { methode, url, entetes } | null }
 * @param entree   le membre de Signature-Input : liste interne et parametres
 * @returns la base, en texte ASCII ; leve une ErreurBase sinon
 */
export function baseDeSignature(message, entree) {
  const lignes = [];
  const vus = new Set();
  for (const article of entree.valeur) {
    const identifiant = identifiantDe(article);
    /* Chaque composant se nomme par une chaine (2.5) : « "@method" », jamais
       un jeton ni un nombre. */
    if (article.type !== 'chaine') echouer('pasUneChaine', { nom: identifiant });
    const nom = article.valeur;
    if (vus.has(identifiant)) echouer('doublon', { nom: identifiant });
    vus.add(identifiant);
    const params = lireParams(article, nom);
    if (params.tr) echouer('trailer', { nom });
    let contexte = message;
    if (params.req) {
      if (message.sens !== 'reponse') echouer('reqSurRequete', { nom });
      if (!message.requete) echouer('sansRequete', { nom });
      contexte = { ...message.requete, sens: 'requete', statut: null };
    }
    const valeur = nom.startsWith('@') ? valeurDerivee(contexte, nom, params) : valeurDeChamp(contexte.entetes, nom, params);
    lignes.push(identifiant + ': ' + valeur);
  }
  lignes.push('"@signature-params": ' + serialiserMembre(entree));
  return lignes.join('\n');
}

/* -------------------------------- Lecture --------------------------------- */
function parametresDe(entree) {
  const connus = {};
  const autres = [];
  for (const p of entree.parametres || []) {
    if (['created', 'expires', 'nonce', 'alg', 'keyid', 'tag'].includes(p.cle)) connus[p.cle] = p.valeur;
    else autres.push(p.cle);
  }
  return { ...connus, autres };
}

const dateIso = s => new Date(s * 1000).toISOString();

function lireUnSens(message, entetes, instant, avecContenu) {
  const brutEntree = valeursDuChamp(entetes, 'signature-input').join(', ');
  const brutSignature = valeursDuChamp(entetes, 'signature').join(', ');
  if (!brutEntree && !brutSignature) return [];
  let entrees = [];
  let signatures = [];
  /* Une erreur de lecture garde son en-tete et son message a part : le
     message du lecteur se traduit a l affichage (te). */
  const illisible = (entete, e) => [{ sens: message.sens, erreurLecture: { entete, texte: '{erreur}', valeurs: { erreur: String(e.message || e) } } }];
  try { entrees = brutEntree ? lireDictionnaire(brutEntree) : []; }
  catch (e) { return illisible('Signature-Input', e); }
  try { signatures = brutSignature ? lireDictionnaire(brutSignature) : []; }
  catch (e) { return illisible('Signature', e); }

  const sorties = [];
  for (const entree of new Map(entrees.map(m => [m.cle, m])).values()) {
    const faits = [];
    const libelle = entree.cle;
    if (entree.type !== 'liste interne') {
      sorties.push({ sens: message.sens, libelle,
        erreurLecture: { entete: 'Signature-Input', texte: ERREURS_BASE.listeAttendue, valeurs: { libelle } } });
      continue;
    }
    const sig = membreDuDictionnaire(signatures, libelle);
    const parametres = parametresDe(entree);
    const composants = entree.valeur.map(identifiantDe);
    let base = null;
    let erreurBase = null;
    try { base = baseDeSignature(message, entree); }
    catch (e) {
      erreurBase = e instanceof ErreurBase ? { texte: e.gabarit, valeurs: e.valeurs }
        : { texte: '{erreur}', valeurs: { erreur: String(e.message || e) } };
    }
    if (!entree.valeur.length) faits.push({ texte: FAITS_SIGNATURE.vide, valeurs: {} });
    /* Seuls les composants du message lui-meme couvrent son contenu : un
       « content-digest;req » dans une reponse couvre celui de la requete. */
    const propres = entree.valeur.filter(a => !(a.parametres || []).some(p => p.cle === 'req')).map(a => a.valeur);
    if (avecContenu && entree.valeur.length && !propres.includes('content-digest') && !propres.includes('repr-digest')) {
      faits.push({ texte: FAITS_SIGNATURE.contenuNonCouvert, valeurs: {} });
    }
    if (instant && Number.isInteger(parametres.expires) && parametres.expires * 1000 <= instant) {
      faits.push({ texte: FAITS_SIGNATURE.expiree, valeurs: { date: dateIso(parametres.expires) } });
    }
    if (instant && Number.isInteger(parametres.created) && parametres.created * 1000 > instant + 1000) {
      faits.push({ texte: FAITS_SIGNATURE.future,
        valeurs: { n: Math.round((parametres.created * 1000 - instant) / 1000), date: dateIso(parametres.created) } });
    }
    if (parametres.alg && !ALGORITHMES_SIGNATURE[parametres.alg]) {
      faits.push({ texte: FAITS_SIGNATURE.algInconnu, valeurs: { alg: parametres.alg } });
    }
    if (parametres.alg === 'hmac-sha256') faits.push({ texte: FAITS_SIGNATURE.symetrique, valeurs: {} });
    if (!sig) faits.push({ texte: FAITS_SIGNATURE.sansValeur, valeurs: { libelle } });
    if (message.redirigee) faits.push({ texte: FAITS_SIGNATURE.redirigee, valeurs: { url: message.url } });
    sorties.push({
      sens: message.sens, libelle, composants, parametres,
      signature: sig && sig.type === 'suite d octets' ? sig.valeur : null,
      base, erreurBase, faits
    });
  }
  for (const s of signatures) {
    if (!entrees.some(e => e.cle === s.cle)) {
      sorties.push({ sens: message.sens, libelle: s.cle, composants: [], parametres: { autres: [] },
        signature: null, base: null, erreurBase: null,
        faits: [{ texte: FAITS_SIGNATURE.sansEntree, valeurs: { libelle: s.cle } }] });
    }
  }
  return sorties;
}

/** Les deux messages d un enregistrement, tels que Firefox les a rapportes. */
export function messagesDe(rec) {
  const url = rec.finalUrl || rec.url;
  const redirigee = !!(rec.redirects && rec.redirects.length);
  const requete = { sens: 'requete', methode: rec.method, url, entetes: rec.requestHeaders || [], statut: null, redirigee };
  const reponse = { sens: 'reponse', methode: rec.method, url, entetes: rec.responseHeaders || [],
    statut: rec.statusCode, requete: { methode: rec.method, url, entetes: rec.requestHeaders || [] } };
  return { requete, reponse };
}

/**
 * Toutes les signatures d un enregistrement, requete puis reponse.
 * @returns [{ sens, libelle, composants, parametres, signature, base, erreurBase, faits }]
 */
export function lireSignaturesHttp(rec) {
  const { requete, reponse } = messagesDe(rec);
  const corpsRequete = rec.requestBody && (rec.requestBody.size > 0 || (rec.requestBody.text || '').length > 0);
  const corpsReponse = rec.responseBody && (rec.responseBody.size > 0);
  /* Chaque message se juge a l instant ou il a ete vu : la requete a son
     depart, la reponse a sa reception. */
  return [
    ...lireUnSens(requete, requete.entetes, rec.startTime, !!corpsRequete),
    ...lireUnSens(reponse, reponse.entetes, rec.endTime || rec.startTime, !!corpsReponse)
  ];
}

/* ------------------------------ Verification ------------------------------ */
/** Un secret partage colle, en texte, base64 ou hexadecimal. */
export function lireSecret(texte, forme) {
  const brut = String(texte || '').trim();
  if (!brut) throw new Error('secret vide');
  if (forme === 'base64') return base64VersOctets(brut.replace(/\s+/g, ''));
  if (forme === 'hex') return hexVersOctets(brut);
  return texteVersOctets(brut);
}

/**
 * Verifie une signature sur sa base.
 * @returns { valide, algorithme }
 */
export async function verifierSignatureHttp({ base, signature, algorithme, cle, formeSecret = 'texte' }) {
  const alg = ALGORITHMES_SIGNATURE[algorithme];
  if (!alg) throw new Error('algorithme non verifiable ici : ' + (algorithme || 'aucun'));
  if (!signature) throw new Error('aucune valeur de signature');
  const sujet = sujetCrypto();
  let importee;
  if (alg.genre === 'secret') {
    importee = await sujet.importKey('raw', lireSecret(cle, formeSecret), alg.cle, false, ['verify']);
  } else {
    try { importee = await importerClePublique(cle, alg.cle); }
    catch (e) {
      if (algorithme === 'ed25519' && /algorithm|not supported|NotSupported/i.test(String(e.name) + String(e.message))) {
        throw new Error('Ed25519 n est pas pris en charge par ce Firefox (il l est a partir de la version 129)');
      }
      throw e;
    }
  }
  const valide = await sujet.verify(alg.verif, importee, signature, texteVersOctets(base));
  return { valide, algorithme };
}
