/* Analyse d un entete HTTP — INTERCEPTOR (by D4RK)
 *
 * La table de reference dit a quoi sert un entete ; ce module lit sa valeur.
 * Un Set-Cookie, une politique de securite, un Cache-Control ou un Accept ne
 * se lisent pas a l oeil sans se tromper : on les decoupe, et on signale ce
 * qui est reellement risque — jamais un avis de style.
 */
import { base64VersOctets, octetsVersTexte } from './bytes.js';
import { analyserContentDisposition } from './entetes-parametres.js';
import { analyserChampStructure, decrireArticle, FORMES_CONNUES }
  from './champs-structures.js';

const partie = (cle, valeur, note) => ({ cle, valeur: valeur == null ? '' : String(valeur), note: note || '' });

/* Un risque porte une phrase stable — donc traduisible — et, quand il vient
   d une directive precise, le nom de cette directive a part. */
const risque = (texte, ou) => ({ texte, ou: ou || '' });

/* -------------------------------- Cookies --------------------------------- */
function setCookie(valeur) {
  const morceaux = String(valeur).split(';');
  const premier = morceaux.shift() || '';
  const egal = premier.indexOf('=');
  const nom = egal < 0 ? premier.trim() : premier.slice(0, egal).trim();
  const contenu = egal < 0 ? '' : premier.slice(egal + 1).trim();

  const parties = [partie('Nom', nom), partie('Valeur', contenu)];
  const attributs = new Map();
  for (const m of morceaux) {
    const net = m.trim();
    if (!net) continue;
    const i = net.indexOf('=');
    const cle = (i < 0 ? net : net.slice(0, i)).trim().toLowerCase();
    const val = i < 0 ? true : net.slice(i + 1).trim();
    attributs.set(cle, val);
    parties.push(partie(cle, val === true ? 'present' : val));
  }

  const risques = [];
  if (!attributs.has('secure')) risques.push(risque('sans Secure : le cookie part aussi en HTTP en clair'));
  if (!attributs.has('httponly')) risques.push(risque('sans HttpOnly : un script de la page peut le lire'));
  if (!attributs.has('samesite')) {
    risques.push(risque('sans SameSite : Firefox applique Lax par defaut, mais rien n est declare'));
  } else if (String(attributs.get('samesite')).toLowerCase() === 'none' && !attributs.has('secure')) {
    risques.push(risque('SameSite=None sans Secure : le navigateur refusera le cookie'));
  }
  if (nom.startsWith('__Host-')) {
    if (!attributs.has('secure') || attributs.get('path') !== '/' || attributs.has('domain')) {
      risques.push(risque('prefixe __Host- : exige Secure, Path=/ et aucun Domain'));
    }
  }
  if (nom.startsWith('__Secure-') && !attributs.has('secure')) {
    risques.push(risque('prefixe __Secure- : exige l attribut Secure'));
  }
  if (!attributs.has('expires') && !attributs.has('max-age')) {
    parties.push(partie('Duree', 'cookie de session', 'efface a la fermeture du navigateur'));
  }
  return { parties, risques };
}

/* ------------------------------ Cache-Control ----------------------------- */
const CACHE = {
  'no-store': 'rien n est conserve, nulle part',
  'no-cache': 'conserve, mais revalide a chaque fois',
  'must-revalidate': 'une reponse perimee ne peut plus servir',
  'proxy-revalidate': 'meme regle, pour les caches partages seulement',
  'public': 'les caches partages peuvent conserver',
  'private': 'seul le navigateur peut conserver',
  'immutable': 'ne changera pas : aucune revalidation avant expiration',
  'no-transform': 'aucun intermediaire ne doit modifier le contenu',
  'only-if-cached': 'le client ne veut que du cache'
};

function cacheControl(valeur) {
  const parties = [];
  const risques = [];
  for (const brut of String(valeur).split(',')) {
    const net = brut.trim();
    if (!net) continue;
    const i = net.indexOf('=');
    const nom = (i < 0 ? net : net.slice(0, i)).toLowerCase();
    const val = i < 0 ? '' : net.slice(i + 1).replace(/"/g, '');
    if (/^(max-age|s-maxage|stale-while-revalidate|stale-if-error)$/.test(nom)) {
      const secondes = Number(val);
      parties.push(partie(nom, val, Number.isFinite(secondes) ? dureeCourte(secondes) : ''));
      if (nom === 'max-age' && secondes === 0) risques.push(risque('max-age=0 : chaque acces revalide'));
    } else {
      parties.push(partie(nom, val || 'present', CACHE[nom] || ''));
    }
  }
  if (!parties.length) risques.push(risque('aucune directive reconnue'));
  return { parties, risques };
}

function dureeCourte(secondes) {
  if (!Number.isFinite(secondes)) return '';
  if (secondes >= 86400) return Math.round(secondes / 86400) + ' jour(s)';
  if (secondes >= 3600) return Math.round(secondes / 3600) + ' heure(s)';
  if (secondes >= 60) return Math.round(secondes / 60) + ' minute(s)';
  return secondes + ' seconde(s)';
}

/* ----------------------- Politique de securite (CSP) ---------------------- */
function csp(valeur) {
  const parties = [];
  const risques = [];
  let defaut = false;
  for (const brut of String(valeur).split(';')) {
    const net = brut.trim();
    if (!net) continue;
    const [nom, ...sources] = net.split(/\s+/);
    const liste = sources.join(' ');
    parties.push(partie(nom, liste || '(vide)'));
    if (nom === 'default-src') defaut = true;
    if (/script-src|default-src/.test(nom)) {
      if (/'unsafe-inline'/.test(liste)) risques.push(risque("'unsafe-inline' annule l essentiel de la protection", nom));
      if (/'unsafe-eval'/.test(liste)) risques.push(risque("'unsafe-eval' autorise eval()", nom));
      if (/(^|\s)\*(\s|$)/.test(liste)) risques.push(risque('« * » autorise n importe quelle origine', nom));
      if (/data:/.test(liste)) risques.push(risque('« data: » permet d injecter un script encode', nom));
    }
    if (nom === 'frame-ancestors' && /(^|\s)\*(\s|$)/.test(liste)) {
      risques.push(risque('frame-ancestors * : la page peut etre incluse partout'));
    }
  }
  if (!defaut && !parties.some(p => p.cle === 'script-src')) {
    risques.push(risque('ni default-src ni script-src : la politique ne couvre pas les scripts'));
  }
  if (!parties.some(p => p.cle === 'object-src') && !defaut) {
    risques.push(risque('object-src absent : les greffons ne sont pas couverts'));
  }
  return { parties, risques };
}

/* ------------------------------- Transport -------------------------------- */
function hsts(valeur) {
  const parties = [];
  const risques = [];
  let age = null;
  for (const brut of String(valeur).split(';')) {
    const net = brut.trim();
    if (!net) continue;
    const i = net.indexOf('=');
    const nom = (i < 0 ? net : net.slice(0, i)).toLowerCase();
    const val = i < 0 ? 'present' : net.slice(i + 1);
    if (nom === 'max-age') { age = Number(val); parties.push(partie(nom, val, dureeCourte(age))); }
    else parties.push(partie(nom, val));
  }
  if (age === null) risques.push(risque('max-age absent : la directive est ignoree'));
  else if (age === 0) risques.push(risque('max-age=0 : HSTS est desactive pour ce domaine'));
  else if (age < 15552000) risques.push(risque('max-age inferieur a six mois : en dessous des listes de prechargement'));
  if (!parties.some(p => p.cle === 'includesubdomains')) {
    risques.push(risque('includeSubDomains absent : les sous-domaines restent joignables en clair'));
  }
  return { parties, risques };
}

/* ---------------------------- Listes ponderees ---------------------------- */
function listePonderee(valeur) {
  const entrees = [];
  for (const brut of String(valeur).split(',')) {
    const net = brut.trim();
    if (!net) continue;
    const [tete, ...params] = net.split(';').map(x => x.trim());
    let q = 1;
    for (const p of params) {
      const m = p.match(/^q=([0-9.]+)$/i);
      if (m) q = Number(m[1]);
    }
    entrees.push({ valeur: tete, q, params: params.filter(p => !/^q=/i.test(p)) });
  }
  entrees.sort((a, b) => b.q - a.q);
  return {
    parties: entrees.map((e, i) => partie('#' + (i + 1) + '  ' + e.valeur, 'q=' + e.q,
      e.params.join(' ; '))),
    risques: []
  };
}

/* --------------------------- Valeurs a parametres ------------------------- */
function valeurParametree(valeur) {
  const morceaux = String(valeur).split(';').map(x => x.trim()).filter(Boolean);
  const parties = [partie('Valeur', morceaux.shift() || '')];
  for (const m of morceaux) {
    const i = m.indexOf('=');
    parties.push(partie(i < 0 ? m : m.slice(0, i), i < 0 ? 'present' : m.slice(i + 1).replace(/^"|"$/g, '')));
  }
  return { parties, risques: [] };
}

/* Un Content-Disposition porte souvent son nom de fichier sous forme etendue
   (`filename*=UTF-8''...`), decoupee en morceaux, ou herite d un mot code du
   courriel. Rendre la valeur brute laisserait le nom reel illisible. */
function contentDisposition(valeur) {
  let lu;
  try { lu = analyserContentDisposition(valeur); }
  catch { return valeurParametree(valeur); }

  const parties = [partie('Valeur', lu.disposition)];
  for (const p of lu.parametres) {
    const affiche = p.valeurDecodee || p.valeur;
    const notes = [];
    if (p.etendu) notes.push('valeur etendue RFC 8187, jeu ' + (p.jeu || 'utf-8'));
    if (p.langue) notes.push('langue ' + p.langue);
    if (p.morceaux > 1) notes.push(p.morceaux + ' morceaux rassembles');
    if (p.motCode) notes.push('mot code RFC 2047 decode');
    parties.push(partie(p.nom, affiche, notes.join(', ')));
    if (p.etendu && affiche !== p.brut) parties.push(partie(p.nom + ' (brut)', p.brut));
  }
  const risques = lu.risques.map(texte => ({ ou: 'filename', texte }));
  for (const p of lu.parametres) {
    for (const remarque of p.remarques) risques.push({ ou: p.nom, texte: remarque });
  }
  return { parties, risques };
}

/* ---------------------- Champs structures (RFC 8941) ---------------------- */
/* Les en-tetes HTTP recents partagent une grammaire commune : liste,
   dictionnaire ou article, batis sur six types de base. Rendre la valeur brute
   perdrait la seule information qui compte — `42` n est pas `"42"`. */
function champStructure(valeur, nomEntete) {
  let lu;
  try { lu = analyserChampStructure(valeur, nomEntete); }
  catch { return { parties: [partie('Valeur', String(valeur))], risques: [] }; }

  const retenue = lu.valides[0];
  if (!retenue) {
    return {
      parties: [partie('Valeur', String(valeur))],
      risques: [{ ou: nomEntete, texte: 'valeur illisible comme champ structure : '
        + (lu.lectures[0] && lu.lectures[0].erreur || 'forme inconnue') }]
    };
  }

  const parties = [partie('Forme', retenue.forme)];
  if (retenue.article) {
    parties.push(partie('Valeur', decrireArticle(retenue.article), retenue.article.type));
    for (const p of retenue.article.parametres || []) {
      parties.push(partie('  ;' + p.cle, decrireArticle(p), p.type));
    }
  } else {
    for (const membre of retenue.membres) {
      const nom = membre.cle !== undefined ? membre.cle : '·';
      parties.push(partie(nom, decrireArticle(membre), membre.type));
      for (const p of membre.parametres || []) {
        parties.push(partie('  ;' + p.cle, decrireArticle(p), p.type));
      }
    }
  }
  return { parties, risques: [] };
}

/* ------------------------------- Autorisation ----------------------------- */
function autorisation(valeur) {
  const brut = String(valeur).trim();
  const espace = brut.indexOf(' ');
  const schema = espace < 0 ? brut : brut.slice(0, espace);
  const reste = espace < 0 ? '' : brut.slice(espace + 1).trim();
  const parties = [partie('Schema', schema)];
  const risques = [];

  if (/^basic$/i.test(schema)) {
    try {
      const clair = octetsVersTexte(base64VersOctets(reste));
      const i = clair.indexOf(':');
      parties.push(partie('Identifiant', i < 0 ? clair : clair.slice(0, i)));
      parties.push(partie('Mot de passe', i < 0 ? '' : clair.slice(i + 1)));
      risques.push(risque('Basic : identifiant et mot de passe voyagent en base64, donc en clair'));
    } catch { parties.push(partie('Contenu', reste, 'base64 illisible')); }
  } else if (/^bearer$/i.test(schema)) {
    parties.push(partie('Jeton', reste));
    if (reste.split('.').length === 3) {
      parties.push(partie('Forme', 'JWT', 'trois parties : voir l onglet JWT pour le decoder'));
    }
  } else if (/^digest$/i.test(schema)) {
    for (const m of reste.split(',')) {
      const i = m.indexOf('=');
      if (i > 0) parties.push(partie(m.slice(0, i).trim(), m.slice(i + 1).trim().replace(/^"|"$/g, '')));
    }
  } else {
    parties.push(partie('Contenu', reste));
  }
  return { parties, risques };
}

/* -------------------------------- Registre -------------------------------- */
const ANALYSEURS = {
  'set-cookie': setCookie,
  'cookie': v => ({
    parties: String(v).split(';').map(p => {
      const net = p.trim();
      const i = net.indexOf('=');
      return partie(i < 0 ? net : net.slice(0, i), i < 0 ? '' : net.slice(i + 1));
    }).filter(p => p.cle),
    risques: []
  }),
  'cache-control': cacheControl,
  'content-security-policy': csp,
  'content-security-policy-report-only': csp,
  'strict-transport-security': hsts,
  'accept': listePonderee,
  'accept-language': listePonderee,
  'accept-encoding': listePonderee,
  'te': listePonderee,
  'content-type': valeurParametree,
  'content-disposition': contentDisposition,
  /* Un en-tete par entree : la table des formes vit dans champs-structures.js,
     et chacun y est declare avec la forme que sa specification impose. */
  'priority': (v, n) => champStructure(v, n || 'priority'),
  'accept-ch': (v, n) => champStructure(v, n || 'accept-ch'),
  'cache-status': (v, n) => champStructure(v, n || 'cache-status'),
  'proxy-status': (v, n) => champStructure(v, n || 'proxy-status'),
  'content-digest': (v, n) => champStructure(v, n || 'content-digest'),
  'repr-digest': (v, n) => champStructure(v, n || 'repr-digest'),
  'signature': (v, n) => champStructure(v, n || 'signature'),
  'signature-input': (v, n) => champStructure(v, n || 'signature-input'),
  'cdn-cache-control': (v, n) => champStructure(v, n || 'cdn-cache-control'),
  'alt-svc': valeurParametree,
  'permissions-policy': v => ({
    parties: String(v).split(',').map(x => {
      const net = x.trim();
      const i = net.indexOf('=');
      return partie(i < 0 ? net : net.slice(0, i), i < 0 ? '' : net.slice(i + 1));
    }).filter(p => p.cle),
    risques: []
  }),
  'authorization': autorisation,
  'proxy-authorization': autorisation,
  'www-authenticate': autorisation,
  'retry-after': v => {
    const n = Number(String(v).trim());
    if (Number.isFinite(n)) return { parties: [partie('Delai', n, dureeCourte(n))], risques: [] };
    const d = new Date(String(v));
    return {
      parties: [partie('Date', Number.isNaN(d.getTime()) ? String(v) : d.toISOString())],
      risques: Number.isNaN(d.getTime()) ? [risque('valeur ni numerique ni date')] : []
    };
  },
  'x-forwarded-for': v => ({
    parties: String(v).split(',').map((x, i) => partie('saut ' + (i + 1), x.trim())),
    risques: [risque('entete ajoute par un intermediaire : il se falsifie sans difficulte')]
  }),
  'forwarded': v => ({
    parties: String(v).split(',').map((x, i) => partie('saut ' + (i + 1), x.trim())),
    risques: []
  }),
  'server-timing': v => ({
    parties: String(v).split(',').map(x => {
      const [nom, ...params] = x.split(';').map(p => p.trim());
      return partie(nom, params.join(' ; '));
    }),
    risques: []
  }),
  'link': v => ({
    parties: String(v).split(/,(?=\s*<)/).map(x => {
      const m = x.match(/<([^>]*)>(.*)/);
      return partie(m ? m[1] : x.trim(), m ? m[2].trim() : '');
    }),
    risques: []
  }),
  'content-range': v => ({ parties: [partie('Portion', String(v).trim())], risques: [] }),
  'range': v => ({ parties: [partie('Demande', String(v).trim())], risques: [] })
};

/** Entetes que ce module sait decouper, au-dela de leur simple description. */
export const ENTETES_ANALYSABLES = Object.keys(ANALYSEURS).sort();

/**
 * Analyse une ligne « Nom: valeur », ou un nom et une valeur separes.
 * Rend toujours quelque chose : au pire la valeur brute, jamais une erreur.
 */
export function analyserEntete(nom, valeur) {
  let cle = String(nom || '').trim();
  let contenu = valeur;
  if (contenu === undefined) {
    const i = cle.indexOf(':');
    if (i < 0) return { nom: cle, valeur: '', parties: [], risques: [risque('ligne sans deux-points')] };
    contenu = cle.slice(i + 1).trim();
    cle = cle.slice(0, i).trim();
  }
  const analyseur = ANALYSEURS[cle.toLowerCase()];
  if (!analyseur) {
    return { nom: cle, valeur: String(contenu), parties: [], risques: [], sansAnalyse: true };
  }
  // Le nom est passe : les champs structures en deduisent la forme attendue.
  const resultat = analyseur(String(contenu), cle.toLowerCase());
  return { nom: cle, valeur: String(contenu), parties: resultat.parties, risques: resultat.risques };
}

/** Analyse toutes les lignes d un bloc d entetes colle d un coup. */
export function analyserBloc(texte) {
  return String(texte).split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && l.includes(':'))
    .map(l => analyserEntete(l));
}
