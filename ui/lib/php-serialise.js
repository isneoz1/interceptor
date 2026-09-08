/* Serialisation PHP — INTERCEPTOR (by NeoZ)
 *
 * `serialize()` de PHP se croise partout dans le trafic applicatif : cookies de
 * session, champs caches, files de travail, caches. Sans lecteur, une valeur
 * comme `a:2:{s:3:"uid";i:42;s:4:"role";s:5:"admin";}` reste une chaine opaque.
 *
 * Formes du langage :
 *   N;                       null
 *   b:0;  b:1;               booleen
 *   i:42;                    entier
 *   d:1.5;  d:INF;  d:NAN;   flottant
 *   s:5:"hello";             chaine — la longueur compte des OCTETS
 *   a:2:{cle;valeur;...}     tableau
 *   O:8:"NomClasse":2:{...}  objet
 *   E:11:"Suit:Hearts";      enumeration (PHP 8.1)
 *   R:2;  r:2;               reference, reference d objet
 *
 * Rien n est execute : on lit une structure, on ne reconstruit aucun objet.
 * C est un point qui compte, la deserialisation PHP etant elle-meme une source
 * d execution de code cote serveur.
 */

const ENCODEUR = new TextEncoder();
const DECODEUR = new TextDecoder('utf-8', { fatal: false });

class Lecteur {
  constructor(texte) {
    /* La longueur des chaines est comptee en octets : on travaille donc sur
       les octets, jamais sur les unites UTF-16 de JavaScript. */
    this.o = ENCODEUR.encode(String(texte == null ? '' : texte));
    this.i = 0;
  }
  fini() { return this.i >= this.o.length; }
  voir() { return this.o[this.i]; }
  car() { return String.fromCharCode(this.o[this.i]); }
  avancer(n = 1) { this.i += n; }
  attendre(caractere) {
    if (this.fini() || this.car() !== caractere) throw this.erreur('« ' + caractere +' » attendu');
    this.i++;
  }
  jusqua(caractere) {
    const debut = this.i;
    while (!this.fini() && this.car() !== caractere) this.i++;
    if (this.fini()) throw this.erreur('« ' + caractere + ' » introuvable');
    const texte = DECODEUR.decode(this.o.subarray(debut, this.i));
    this.i++;
    return texte;
  }
  erreur(quoi) {
    const autour = DECODEUR.decode(this.o.subarray(Math.max(0, this.i - 10), this.i + 10));
    return new Error(quoi + ' (octet ' + this.i + ' : « ' + autour + ' »)');
  }
}

function lireEntierPositif(lecteur, quoi) {
  const brut = lecteur.jusqua(':');
  const n = Number(brut);
  if (!Number.isInteger(n) || n < 0) throw lecteur.erreur(quoi + ' invalide : « ' + brut + ' »');
  return n;
}

function lireChaineBrute(lecteur) {
  const longueur = lireEntierPositif(lecteur, 'longueur de chaine');
  lecteur.attendre('"');
  if (lecteur.i + longueur > lecteur.o.length) {
    throw lecteur.erreur('chaine annoncee de ' + longueur + ' octets, mais le texte s arrete');
  }
  const texte = DECODEUR.decode(lecteur.o.subarray(lecteur.i, lecteur.i + longueur));
  lecteur.avancer(longueur);
  lecteur.attendre('"');
  return texte;
}

function lireValeur(lecteur, profondeur) {
  if (profondeur > 64) throw lecteur.erreur('structure imbriquee au-dela de 64 niveaux');
  if (lecteur.fini()) throw lecteur.erreur('valeur attendue');
  const marque = lecteur.car();
  lecteur.avancer();

  switch (marque) {
    case 'N':
      lecteur.attendre(';');
      return { type: 'null', valeur: null };

    case 'b': {
      lecteur.attendre(':');
      const c = lecteur.car();
      if (c !== '0' && c !== '1') throw lecteur.erreur('booleen attendu : b:0; ou b:1;');
      lecteur.avancer();
      lecteur.attendre(';');
      return { type: 'booleen', valeur: c === '1' };
    }

    case 'i': {
      lecteur.attendre(':');
      const brut = lecteur.jusqua(';');
      if (!/^-?\d+$/.test(brut)) throw lecteur.erreur('entier invalide : « ' + brut + ' »');
      return { type: 'entier', valeur: Number(brut), brut };
    }

    case 'd': {
      lecteur.attendre(':');
      const brut = lecteur.jusqua(';');
      const valeur = brut === 'INF' ? Infinity : brut === '-INF' ? -Infinity
        : brut === 'NAN' ? NaN : Number(brut);
      if (Number.isNaN(valeur) && brut !== 'NAN') {
        throw lecteur.erreur('flottant invalide : « ' + brut + ' »');
      }
      return { type: 'flottant', valeur, brut };
    }

    case 's': {
      lecteur.attendre(':');
      const texte = lireChaineBrute(lecteur);
      lecteur.attendre(';');
      return { type: 'chaine', valeur: texte, octets: ENCODEUR.encode(texte).length };
    }

    case 'E': {
      /* PHP 8.1 : « E:11:"Suit:Hearts"; », la classe et le cas separes par
         un deux-points a l interieur de la chaine. */
      lecteur.attendre(':');
      const texte = lireChaineBrute(lecteur);
      lecteur.attendre(';');
      const coupe = texte.indexOf(':');
      return {
        type: 'enumeration',
        classe: coupe < 0 ? texte : texte.slice(0, coupe),
        cas: coupe < 0 ? '' : texte.slice(coupe + 1),
        valeur: texte
      };
    }

    case 'R': case 'r': {
      lecteur.attendre(':');
      const brut = lecteur.jusqua(';');
      return {
        type: marque === 'R' ? 'reference' : 'reference d objet',
        valeur: Number(brut),
        brut
      };
    }

    case 'a': {
      lecteur.attendre(':');
      const nombre = lireEntierPositif(lecteur, 'taille de tableau');
      lecteur.attendre('{');
      const entrees = [];
      for (let n = 0; n < nombre; n++) {
        const cle = lireValeur(lecteur, profondeur + 1);
        const valeur = lireValeur(lecteur, profondeur + 1);
        entrees.push({ cle, valeur });
      }
      lecteur.attendre('}');
      return { type: 'tableau', taille: nombre, entrees };
    }

    case 'O': {
      lecteur.attendre(':');
      const classe = lireChaineBrute(lecteur);
      lecteur.attendre(':');
      const nombre = lireEntierPositif(lecteur, 'nombre de proprietes');
      lecteur.attendre('{');
      const proprietes = [];
      for (let n = 0; n < nombre; n++) {
        const cle = lireValeur(lecteur, profondeur + 1);
        const valeur = lireValeur(lecteur, profondeur + 1);
        proprietes.push({ ...visibilite(cle.valeur, classe), cle, valeur });
      }
      lecteur.attendre('}');
      return { type: 'objet', classe, taille: nombre, proprietes };
    }

    default:
      throw new Error('marque inconnue « ' + marque + ' » a l octet ' + (lecteur.i - 1));
  }
}

/* PHP encode la visibilite dans le nom de la propriete, avec des octets nuls :
     NUL + '*' + NUL + nom          -> protected
     NUL + Classe + NUL + nom       -> private
   Les lire evite d afficher des octets nuls a la place du nom reel. */
function visibilite(nom, classe) {
  const texte = String(nom == null ? '' : nom);
  if (texte.startsWith('\u0000*\u0000')) {
    return { nom: texte.slice(3), portee: 'protected' };
  }
  if (texte.startsWith('\u0000')) {
    const fin = texte.indexOf('\u0000', 1);
    if (fin > 0) {
      return { nom: texte.slice(fin + 1), portee: 'private', declaree: texte.slice(1, fin) };
    }
  }
  return { nom: texte, portee: 'public', classe };
}

/**
 * Lit une valeur serialisee par PHP.
 * @returns { valeur, reste }  `reste` est ce qui suit, s il reste quelque chose
 */
export function lirePhp(entree) {
  const lecteur = new Lecteur(entree);
  const valeur = lireValeur(lecteur, 0);
  const reste = DECODEUR.decode(lecteur.o.subarray(lecteur.i));
  return { valeur, reste };
}

/** Lit une valeur et refuse tout texte en trop : utile pour valider. */
export function lirePhpStrict(entree) {
  const { valeur, reste } = lirePhp(entree);
  if (reste.trim()) throw new Error('texte en trop apres la valeur : « ' + reste.slice(0, 30) + ' »');
  return valeur;
}

/** La structure lue, ramenee a des valeurs JavaScript ordinaires. */
export function versJs(noeud) {
  if (!noeud) return null;
  switch (noeud.type) {
    case 'tableau': {
      /* Un tableau PHP a cles 0..n-1 est une liste ; sinon c est une table. */
      const liste = noeud.entrees.every((e, i) => e.cle.type === 'entier' && e.cle.valeur === i);
      if (liste) return noeud.entrees.map(e => versJs(e.valeur));
      const out = {};
      for (const e of noeud.entrees) out[String(e.cle.valeur)] = versJs(e.valeur);
      return out;
    }
    case 'objet': {
      const out = {};
      for (const p of noeud.proprietes) out[p.nom] = versJs(p.valeur);
      return out;
    }
    case 'enumeration': return noeud.valeur;
    default: return noeud.valeur;
  }
}

/** Ecrit une valeur JavaScript au format PHP. Les chaines comptent en octets. */
export function ecrirePhp(valeur) {
  if (valeur === null || valeur === undefined) return 'N;';
  if (typeof valeur === 'boolean') return 'b:' + (valeur ? 1 : 0) + ';';
  if (typeof valeur === 'number') {
    if (Number.isInteger(valeur)) return 'i:' + valeur + ';';
    if (valeur === Infinity) return 'd:INF;';
    if (valeur === -Infinity) return 'd:-INF;';
    if (Number.isNaN(valeur)) return 'd:NAN;';
    return 'd:' + valeur + ';';
  }
  if (typeof valeur === 'string') {
    return 's:' + ENCODEUR.encode(valeur).length + ':"' + valeur + '";';
  }
  if (Array.isArray(valeur)) {
    const corps = valeur.map((v, i) => 'i:' + i + ';' + ecrirePhp(v)).join('');
    return 'a:' + valeur.length + ':{' + corps + '}';
  }
  if (typeof valeur === 'object') {
    const entrees = Object.entries(valeur);
    const corps = entrees.map(([c, v]) => ecrirePhp(c) + ecrirePhp(v)).join('');
    return 'a:' + entrees.length + ':{' + corps + '}';
  }
  throw new Error('type non serialisable : ' + typeof valeur);
}

/** Vrai si le texte ressemble a une valeur serialisee par PHP. */
export function ressemblePhp(texte) {
  return /^\s*(N;|[bidsaOERr]:)/.test(String(texte == null ? '' : texte));
}
