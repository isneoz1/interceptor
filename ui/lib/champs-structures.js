/* Champs structures HTTP (RFC 9651) — INTERCEPTOR (by NeoZ)
 *
 * La syntaxe commune des en-tetes HTTP recents : `Accept-CH`, `Priority`,
 * `Cache-Status`, `Signature-Input`, `Client-Hints`… Au lieu que chaque
 * en-tete invente sa grammaire, la RFC 9651 en definit trois formes de haut
 * niveau — liste, dictionnaire, article — construites sur huit types de base.
 *
 * La RFC 9651 remplace la 8941 et ajoute deux de ces huit : la Date, et la
 * chaine destinee a l affichage. Un lecteur qui les ignore ne se contente pas
 * de les manquer — il rejette l en-tete entier pour un seul membre.
 *
 * Sans ce module, `Priority: u=1, i` restait une chaine ; on peut maintenant
 * dire que c est un dictionnaire de deux membres, dont un booleen implicite.
 *
 * Verifie contre les exemples publies aux sections 3 et 4 de la RFC.
 */

/* Un article de base porte son type : c est la que se trouve l information.
   `42` et `"42"` ne sont pas la meme chose, et le dire est le but du module. */
const TYPES = ['entier', 'decimal', 'chaine', 'jeton', 'suite d octets', 'booleen',
  'date', 'chaine affichee'];
export const TYPES_DE_BASE = TYPES;

class Curseur {
  constructor(texte) { this.t = String(texte == null ? '' : texte); this.i = 0; }
  fini() { return this.i >= this.t.length; }
  voir() { return this.t[this.i]; }
  lire() { return this.t[this.i++]; }
  sauterEspaces() { while (this.t[this.i] === ' ' || this.t[this.i] === '\t') this.i++; }
  sauterEspacesSp() { while (this.t[this.i] === ' ') this.i++; }
  erreur(quoi) {
    return new Error(quoi + ' (position ' + this.i + ' : « '
      + this.t.slice(Math.max(0, this.i - 8), this.i + 8) + ' »)');
  }
}

/* ----------------------------- Articles de base --------------------------- */
function lireEntierOuDecimal(c) {
  let signe = 1;
  if (c.voir() === '-') { c.lire(); signe = -1; }
  if (c.fini() || !/[0-9]/.test(c.voir())) throw c.erreur('chiffre attendu');
  let chiffres = '';
  let decimal = false;
  while (!c.fini()) {
    const ch = c.voir();
    if (/[0-9]/.test(ch)) { chiffres += c.lire(); continue; }
    if (ch === '.' && !decimal) {
      if (chiffres.length > 12) throw c.erreur('partie entiere trop longue pour un decimal');
      decimal = true;
      chiffres += c.lire();
      continue;
    }
    break;
  }
  if (!decimal && chiffres.length > 15) throw c.erreur('entier de plus de 15 chiffres');
  if (decimal) {
    const apres = chiffres.split('.')[1] || '';
    if (!apres.length) throw c.erreur('decimal sans chiffre apres le point');
    if (apres.length > 3) throw c.erreur('decimal a plus de trois chiffres apres le point');
    return { type: 'decimal', valeur: signe * parseFloat(chiffres) };
  }
  return { type: 'entier', valeur: signe * parseInt(chiffres, 10) };
}

function lireChaine(c) {
  c.lire();                       // le guillemet ouvrant
  let sortie = '';
  while (!c.fini()) {
    const ch = c.lire();
    if (ch === '\\') {
      if (c.fini()) throw c.erreur('antislash en fin de chaine');
      const suivant = c.lire();
      if (suivant !== '"' && suivant !== '\\') throw c.erreur('echappement interdit : \\' + suivant);
      sortie += suivant;
      continue;
    }
    if (ch === '"') return { type: 'chaine', valeur: sortie };
    const code = ch.charCodeAt(0);
    if (code < 0x20 || code > 0x7e) throw c.erreur('caractere interdit dans une chaine');
    sortie += ch;
  }
  throw c.erreur('chaine non fermee');
}

function lireJeton(c) {
  let sortie = c.lire();
  while (!c.fini() && /[A-Za-z0-9!#$%&'*+\-.^_`|~:/]/.test(c.voir())) sortie += c.lire();
  return { type: 'jeton', valeur: sortie };
}

function lireOctets(c) {
  c.lire();                       // le deux-points ouvrant
  let base64 = '';
  while (!c.fini()) {
    const ch = c.lire();
    if (ch === ':') {
      try {
        const binaire = atob(base64);
        const octets = Uint8Array.from(binaire, x => x.charCodeAt(0));
        return { type: 'suite d octets', valeur: octets, base64 };
      } catch { throw c.erreur('base64 illisible dans une suite d octets'); }
    }
    if (!/[A-Za-z0-9+/=]/.test(ch)) throw c.erreur('caractere interdit dans une suite d octets');
    base64 += ch;
  }
  throw c.erreur('suite d octets non fermee');
}

function lireBooleen(c) {
  c.lire();                       // le point d interrogation
  const ch = c.lire();
  if (ch !== '0' && ch !== '1') throw c.erreur('booleen attendu : ?0 ou ?1');
  return { type: 'booleen', valeur: ch === '1' };
}

/** Un article de base, sans ses parametres (RFC 9651 section 4.2.3.1). */
export function lireArticleDeBase(c) {
  if (c.fini()) throw c.erreur('article attendu');
  const ch = c.voir();
  if (ch === '-' || /[0-9]/.test(ch)) return lireEntierOuDecimal(c);
  if (ch === '"') return lireChaine(c);
  if (ch === ':') return lireOctets(c);
  if (ch === '?') return lireBooleen(c);
  /* RFC 9651 : deux types que la 8941 ne connaissait pas. */
  if (ch === '@') return lireDate(c);
  if (ch === '%') return lireChaineAffichee(c);
  if (/[A-Za-z*]/.test(ch)) return lireJeton(c);
  throw c.erreur('debut d article inattendu « ' + ch + ' »');
}

/* ------------------------- Date (RFC 9651, 4.2.9) ------------------------- */
/* « @1659578233 » : un entier de secondes depuis 1970, precede d une arobase.
   Un decimal est explicitement refuse — un instant ne se fractionne pas ici. */
const DATE_MIN = -62135596800;   /* 0001-01-01T00:00:00Z */
const DATE_MAX = 253402214400;   /* 9999-12-31T23:59:59Z */

function lireDate(c) {
  c.lire();                                   /* l arobase */
  const nombre = lireEntierOuDecimal(c);
  if (nombre.type !== 'entier') {
    throw c.erreur('une date porte un entier de secondes, pas un decimal');
  }
  /* La RFC impose de couvrir les annees 1 a 9999. Au-dela, ce n est plus une
     date mais un entier qui se fait passer pour telle. */
  if (nombre.valeur < DATE_MIN || nombre.valeur > DATE_MAX) {
    throw c.erreur('date hors des bornes imposees (annees 1 a 9999)');
  }
  return {
    type: 'date',
    valeur: nombre.valeur,
    /* L instant lisible se calcule ici : le lire suppose sinon de savoir que
       la valeur est en secondes, pas en millisecondes comme partout en JS. */
    iso: new Date(nombre.valeur * 1000).toISOString()
  };
}

/* ------------------ Chaine affichee (RFC 9651, 4.2.10) ------------------- */
/* « %"pour les %c3%bcsers" » : de l UTF-8 pourcent-encode, destine a etre lu
   par un humain. A ne pas confondre avec une chaine ordinaire, qui ne porte
   que de l ASCII : c est precisement la distinction que le type apporte. */
function lireChaineAffichee(c) {
  c.lire();                                   /* le pourcent */
  if (c.fini() || c.voir() !== '"') throw c.erreur('un guillemet est attendu apres « % »');
  c.lire();

  const octets = [];
  for (;;) {
    if (c.fini()) throw c.erreur('chaine affichee non terminee');
    const ch = c.lire();

    if (ch === '"') {
      /* Les octets accumules ne sont de l UTF-8 valide que si l emetteur a
         respecte la specification : on le verifie plutot que de rendre des
         caracteres de remplacement silencieux. */
      const texte = new TextDecoder('utf-8', { fatal: true })
        .decode(new Uint8Array(octets));
      return { type: 'chaine affichee', valeur: texte };
    }

    if (ch === '%') {
      const a = c.lire();
      const b = c.lire();
      /* Minuscules seulement : la RFC l impose, pour que deux emetteurs
         produisent la meme suite d octets pour la meme chaine. */
      if (!/^[0-9a-f]$/.test(a || '') || !/^[0-9a-f]$/.test(b || '')) {
        throw c.erreur('un pourcent doit etre suivi de deux chiffres hexadecimaux minuscules');
      }
      octets.push(parseInt(a + b, 16));
      continue;
    }

    /* Tout le reste passe tel quel, sauf ce que la RFC exige d encoder. */
    const code = ch.charCodeAt(0);
    if (code <= 0x1f || code >= 0x7f) {
      throw c.erreur('ce caractere doit etre pourcent-encode dans une chaine affichee');
    }
    octets.push(code);
  }
}

/* ------------------------------- Parametres ------------------------------- */
function lireCle(c) {
  if (c.fini() || !/[a-z*]/.test(c.voir())) throw c.erreur('cle attendue');
  let cle = c.lire();
  while (!c.fini() && /[a-z0-9_\-.*]/.test(c.voir())) cle += c.lire();
  return cle;
}

/**
 * `;cle` ou `;cle=valeur`, repete. Une cle sans valeur vaut vrai.
 *
 * L ABNF de la section 3.1.2 est `*( ";" *SP parameter )` : aucun espace n est
 * permis AVANT le point-virgule. En sauter un ici mangerait le separateur des
 * membres d une liste interne, ou (« a » « b »).
 */
function lireParametres(c) {
  const params = [];
  for (;;) {
    if (c.voir() !== ';') break;
    c.lire();
    c.sauterEspacesSp();
    const cle = lireCle(c);
    if (c.voir() === '=') { c.lire(); params.push({ cle, ...lireArticleDeBase(c) }); }
    else params.push({ cle, type: 'booleen', valeur: true, implicite: true });
  }
  return params;
}

function lireArticle(c) {
  const base = lireArticleDeBase(c);
  return { ...base, parametres: lireParametres(c) };
}

/* --------------------------- Listes internes ------------------------------ */
function lireListeInterne(c) {
  c.lire();                       // la parenthese ouvrante
  const membres = [];
  for (;;) {
    c.sauterEspacesSp();
    if (c.voir() === ')') { c.lire(); break; }
    if (c.fini()) throw c.erreur('liste interne non fermee');
    membres.push(lireArticle(c));
    if (c.voir() !== ' ' && c.voir() !== ')') throw c.erreur('espace ou parenthese attendue');
  }
  return { type: 'liste interne', valeur: membres, parametres: lireParametres(c) };
}

function lireMembre(c) {
  return c.voir() === '(' ? lireListeInterne(c) : lireArticle(c);
}

/* ------------------------------ Trois formes ------------------------------ */
/** Liste : membres separes par des virgules (section 4.2.1). */
export function lireListe(entree) {
  const c = new Curseur(entree);
  const membres = [];
  c.sauterEspaces();
  if (c.fini()) return membres;
  for (;;) {
    membres.push(lireMembre(c));
    c.sauterEspaces();
    if (c.fini()) return membres;
    if (c.lire() !== ',') throw c.erreur('virgule attendue entre deux membres');
    c.sauterEspaces();
    if (c.fini()) throw c.erreur('virgule finale interdite');
  }
}

/** Dictionnaire : `cle=valeur` separes par des virgules (section 4.2.2). */
export function lireDictionnaire(entree) {
  const c = new Curseur(entree);
  const membres = [];
  c.sauterEspaces();
  if (c.fini()) return membres;
  for (;;) {
    const cle = lireCle(c);
    if (c.voir() === '=') { c.lire(); membres.push({ cle, ...lireMembre(c) }); }
    else membres.push({ cle, type: 'booleen', valeur: true, implicite: true, parametres: lireParametres(c) });
    c.sauterEspaces();
    if (c.fini()) return membres;
    if (c.lire() !== ',') throw c.erreur('virgule attendue entre deux membres');
    c.sauterEspaces();
    if (c.fini()) throw c.erreur('virgule finale interdite');
  }
}

/** Article seul, parametres compris (section 4.2.3). */
export function lireArticleSeul(entree) {
  const c = new Curseur(entree);
  c.sauterEspaces();
  const article = lireArticle(c);
  c.sauterEspaces();
  if (!c.fini()) throw c.erreur('texte en trop apres l article');
  return article;
}

/* --------------------- En-tetes connus et leur forme ---------------------- */
/* Forme attendue par en-tete, d apres la specification qui le definit. Un
   en-tete absent de cette table est essaye dans les trois formes. */
export const FORMES_CONNUES = {
  'accept-ch': 'liste',
  'cache-status': 'liste',
  'client-hints': 'liste',
  'content-digest': 'dictionnaire',
  'repr-digest': 'dictionnaire',
  'want-content-digest': 'dictionnaire',
  'want-repr-digest': 'dictionnaire',
  'priority': 'dictionnaire',
  'signature': 'dictionnaire',
  'signature-input': 'dictionnaire',
  'proxy-status': 'liste',
  'accept-signature': 'dictionnaire',
  'cdn-cache-control': 'dictionnaire'
};

/**
 * Lit une valeur d en-tete. Quand la forme n est pas connue, on essaie les
 * trois et on rend celles qui tiennent : c est a l operateur de trancher, pas
 * a l outil de deviner.
 */
export function analyserChampStructure(valeur, nomEntete = '') {
  const attendue = FORMES_CONNUES[String(nomEntete).toLowerCase()] || null;
  const essais = attendue ? [attendue] : ['dictionnaire', 'liste', 'article'];
  const lectures = [];

  for (const forme of essais) {
    try {
      if (forme === 'liste') lectures.push({ forme, membres: lireListe(valeur) });
      else if (forme === 'dictionnaire') lectures.push({ forme, membres: lireDictionnaire(valeur) });
      else lectures.push({ forme, article: lireArticleSeul(valeur) });
    } catch (e) {
      lectures.push({ forme, erreur: String(e.message || e) });
    }
  }
  return { formeAttendue: attendue, lectures, valides: lectures.filter(l => !l.erreur) };
}

/** Rend un article lisible : « 5 (entier) », « "a" (chaine) »… */
export function decrireArticle(article) {
  if (!article) return '';
  if (article.type === 'suite d octets') return ':' + article.base64 + ': (' + article.valeur.length + ' octets)';
  if (article.type === 'liste interne') {
    return '(' + article.valeur.map(decrireArticle).join(' ') + ')';
  }
  if (article.type === 'chaine') return JSON.stringify(article.valeur);
  return String(article.valeur);
}
