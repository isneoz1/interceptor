/* JSON sans perte — SWIFT (by NeoZ)
 *
 * JSON.parse convertit chaque nombre en double IEEE 754 : un entier au-dela de
 * 2^53 est arrondi. 1234567890123456789, un identifiant ecrit en nombre, est lu
 * 1234567890123456768 et reecrit « 1234567890123456800 » par JSON.stringify :
 * un affichage qui passe par les deux montre un autre identifiant que celui
 * recu. Au passage, les cles en double disparaissent (la derniere gagne),
 * « 1.0 » devient « 1 », « é » devient « é », et une cle « __proto__ »
 * recopiee par affectation se perd.
 *
 * Ici, le texte est lu selon la grammaire de RFC 8259 — celle de JSON.parse :
 * ce que l un refuse, l autre le refuse — en un arbre qui garde chaque nombre
 * et chaque chaine tels qu ils sont ecrits, chaque membre dans l ordre,
 * doublons compris. Mettre en forme ne change alors que les espaces.
 *
 * Lecture et ecriture sont iteratives : une imbrication de cent mille niveaux
 * n epuise pas la pile d appels.
 *
 * Noeuds :
 *   { type: 'objet', membres: [{ cle, brutCle, valeur }] }
 *   { type: 'tableau', elements: [noeud] }
 *   { type: 'chaine', valeur, brut }       brut : le lexeme, guillemets compris
 *   { type: 'nombre', brut }
 *   { type: 'litteral', brut }             true, false ou null
 */

/** Un nombre qu un double ne represente pas exactement, garde tel qu ecrit. */
export class NombreExact {
  constructor(brut) { this.brut = String(brut); }
  valueOf() { return Number(this.brut); }
  toString() { return this.brut; }
}

const estChiffre = c => c >= 48 && c <= 57;

/** Lit un texte JSON en arbre sans perte. Leve SyntaxError comme JSON.parse. */
export function lireJsonExact(texte) {
  const s = String(texte);
  const n = s.length;
  let i = 0;
  const erreur = quoi => { throw new SyntaxError('JSON illisible : ' + quoi + ' (position ' + i + ')'); };
  const sauter = () => {
    while (i < n) {
      const c = s.charCodeAt(i);
      if (c === 0x20 || c === 0x09 || c === 0x0a || c === 0x0d) i++; else break;
    }
  };

  const chaine = () => {
    const debut = i++;
    let simple = true;
    for (;;) {
      if (i >= n) erreur('chaine non terminee');
      const c = s.charCodeAt(i);
      if (c === 0x22) { i++; break; }
      if (c === 0x5c) {
        simple = false;
        const e = s.charCodeAt(i + 1);
        if (e === 0x75) {                                        // \uXXXX
          if (!/^[0-9a-fA-F]{4}$/.test(s.slice(i + 2, i + 6))) erreur('echappement \\u incomplet');
          i += 6;
        } else if (e === 0x22 || e === 0x5c || e === 0x2f || e === 0x62 || e === 0x66
          || e === 0x6e || e === 0x72 || e === 0x74) {
          i += 2;
        } else erreur('echappement inconnu');
        continue;
      }
      if (c < 0x20) erreur('caractere de controle non echappe');
      i++;
    }
    const brut = s.slice(debut, i);
    return { brut, valeur: simple ? brut.slice(1, -1) : JSON.parse(brut) };
  };

  const nombre = () => {
    const debut = i;
    if (s.charCodeAt(i) === 0x2d) i++;                           // -
    if (s.charCodeAt(i) === 0x30) i++;                           // 0 seul
    else if (s.charCodeAt(i) >= 0x31 && s.charCodeAt(i) <= 0x39) { while (estChiffre(s.charCodeAt(i))) i++; }
    else erreur('chiffre attendu');
    if (s.charCodeAt(i) === 0x2e) {                              // .
      i++;
      if (!estChiffre(s.charCodeAt(i))) erreur('chiffre attendu apres le point');
      while (estChiffre(s.charCodeAt(i))) i++;
    }
    if (s.charCodeAt(i) === 0x65 || s.charCodeAt(i) === 0x45) {  // e E
      i++;
      if (s.charCodeAt(i) === 0x2b || s.charCodeAt(i) === 0x2d) i++;
      if (!estChiffre(s.charCodeAt(i))) erreur('chiffre attendu dans l exposant');
      while (estChiffre(s.charCodeAt(i))) i++;
    }
    return { type: 'nombre', brut: s.slice(debut, i) };
  };

  const scalaire = () => {
    const c = s.charCodeAt(i);
    if (c === 0x22) { const { brut, valeur } = chaine(); return { type: 'chaine', valeur, brut }; }
    if (c === 0x2d || estChiffre(c)) return nombre();
    for (const mot of ['true', 'false', 'null']) {
      if (s.startsWith(mot, i)) { i += mot.length; return { type: 'litteral', brut: mot }; }
    }
    return erreur(i >= n ? 'valeur attendue, fin du texte' : 'valeur attendue');
  };

  /* Une cle d objet : « "nom" : », la valeur suit. */
  const cle = () => {
    sauter();
    if (s.charCodeAt(i) !== 0x22) erreur('cle entre guillemets attendue');
    const lue = chaine();
    sauter();
    if (s.charCodeAt(i) !== 0x3a) erreur('« : » attendu');
    i++;
    return lue;
  };

  let racine;
  const pile = [];                                   // { noeud, cle }
  const attacher = noeud => {
    if (!pile.length) { racine = noeud; return; }
    const haut = pile[pile.length - 1];
    if (haut.noeud.type === 'tableau') haut.noeud.elements.push(noeud);
    else haut.noeud.membres.push({ cle: haut.cle.valeur, brutCle: haut.cle.brut, valeur: noeud });
  };

  for (;;) {
    /* Une valeur est attendue. */
    sauter();
    const c = s.charCodeAt(i);
    let ferme = true;
    if (c === 0x7b || c === 0x5b) {                  // { [
      const noeud = c === 0x7b ? { type: 'objet', membres: [] } : { type: 'tableau', elements: [] };
      attacher(noeud);
      i++;
      sauter();
      if (s.charCodeAt(i) === (c === 0x7b ? 0x7d : 0x5d)) i++;
      else {
        pile.push({ noeud, cle: c === 0x7b ? cle() : null });
        ferme = false;
      }
    } else attacher(scalaire());
    if (!ferme) continue;

    /* Une valeur vient de se terminer : virgule, ou fermeture du parent. */
    for (;;) {
      sauter();
      if (!pile.length) {
        if (i !== n) erreur('texte en trop apres la valeur');
        return racine;
      }
      const haut = pile[pile.length - 1];
      const d = s.charCodeAt(i);
      if (d === 0x2c) {                              // ,
        i++;
        if (haut.noeud.type === 'objet') haut.cle = cle();
        break;
      }
      if (d === (haut.noeud.type === 'objet' ? 0x7d : 0x5d)) { i++; pile.pop(); continue; }
      erreur(i >= n ? 'fin du texte avant la fermeture' : '« , » ou fermeture attendue');
    }
  }
}

/* ------------------------------- Ecriture -------------------------------- */
/* Un segment de chemin JSONPath (RFC 9535) : « .nom » pour un nom simple,
   sinon la notation entre crochets avec ses echappements (§2.7) — une cle
   « a.b » ne se confond plus avec « b » dans « a ». */
export function segmentJson(cle) {
  if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(cle)) return '.' + cle;
  const echappe = String(cle).replace(/[\\'\u0000-\u001f]/g, c => {
    const court = { '\\': '\\\\', "'": "\\'", '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t' }[c];
    return court || '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0');
  });
  return "['" + echappe + "']";
}

const enfantsDe = noeud => (noeud.type === 'objet' ? noeud.membres : noeud.type === 'tableau' ? noeud.elements : null);

/**
 * Ecrit un arbre. `indentation` : '' pour compact, '  ' pour la forme de
 * JSON.stringify(v, null, 2) — la meme disposition, les memes lexemes.
 */
export function ecrireJsonExact(racine, indentation = '  ') {
  if (!enfantsDe(racine)) return racine.brut;
  const morceaux = [];
  const sep = indentation ? ': ' : ':';
  /* Une marge par profondeur, calculee une fois : la recalculer a chaque
     ligne coutait plus que tout le reste de l ecriture. */
  const marges = [];
  const marge = p => marges[p] ?? (marges[p] = indentation ? '\n' + indentation.repeat(p) : '');
  const pile = [{ noeud: racine, i: -1, p: 0 }];
  while (pile.length) {
    const f = pile[pile.length - 1];
    const objet = f.noeud.type === 'objet';
    const enfants = objet ? f.noeud.membres : f.noeud.elements;
    if (f.i === -1) {
      if (!enfants.length) { morceaux.push(objet ? '{}' : '[]'); pile.pop(); continue; }
      morceaux.push(objet ? '{' : '[');
    }
    /* Les feuilles s ecrivent sur place ; un conteneur ouvre un cadre. */
    let descendu = false;
    while (++f.i < enfants.length) {
      if (f.i > 0) morceaux.push(',');
      morceaux.push(marge(f.p + 1));
      const e = enfants[f.i];
      const v = objet ? e.valeur : e;
      if (objet) morceaux.push(e.brutCle + sep);
      if (v.type === 'objet' || v.type === 'tableau') { pile.push({ noeud: v, i: -1, p: f.p + 1 }); descendu = true; break; }
      morceaux.push(v.brut);
    }
    if (descendu) continue;
    morceaux.push(marge(f.p) + (objet ? '}' : ']'));
    pile.pop();
  }
  return morceaux.join('');
}

/** Mise en forme d un texte JSON : seuls les espaces changent. */
export const jsonExactJoli = (texte, indentation = '  ') => ecrireJsonExact(lireJsonExact(texte), indentation);

/**
 * Reconstruit l arbre de bas en haut, sans le modifier : `objet(membres)` rend
 * le nouveau noeud de chaque objet, ses valeurs deja reconstruites.
 */
function reconstruire(racine, objet) {
  const pile = [{ noeud: racine, i: 0, faits: [] }];
  let dernier = null;
  while (pile.length) {
    const f = pile[pile.length - 1];
    const enfants = enfantsDe(f.noeud);
    if (enfants && f.i < enfants.length) {
      const e = enfants[f.i++];
      pile.push({ noeud: f.noeud.type === 'objet' ? e.valeur : e, i: 0, faits: [] });
      continue;
    }
    pile.pop();
    dernier = !enfants ? f.noeud
      : f.noeud.type === 'tableau' ? { type: 'tableau', elements: f.faits }
        : objet(f.noeud.membres.map((m, k) => ({ cle: m.cle, brutCle: m.brutCle, valeur: f.faits[k] })));
    if (pile.length) pile[pile.length - 1].faits.push(dernier);
  }
  return dernier;
}

/** Les cles triees a tous les niveaux (ordre des unites UTF-16, comme
 *  Array.prototype.sort) ; un doublon reste a cote de son jumeau. */
export function trierClesJson(racine) {
  const ordre = (a, b) => (a.cle < b.cle ? -1 : a.cle > b.cle ? 1 : 0);
  return reconstruire(racine, membres => ({ type: 'objet', membres: membres.slice().sort(ordre) }));
}

/**
 * Une ligne par valeur : « chemin = lexeme ». Les cles en double donnent deux
 * lignes au meme chemin, comme elles sont deux dans le texte. `prefixe` : '$'
 * pour des chemins JSONPath complets (« $.a[0] »), '' pour la forme courte.
 */
export function cheminsJson(racine, prefixe = '') {
  const lignes = [];
  const pile = [{ noeud: racine, chemin: prefixe }];
  while (pile.length) {
    const { noeud, chemin } = pile.pop();
    const enfants = enfantsDe(noeud);
    if (!enfants) { lignes.push(chemin + ' = ' + noeud.brut); continue; }
    if (!enfants.length) { lignes.push(chemin + (noeud.type === 'objet' ? ' = {}' : ' = []')); continue; }
    for (let k = enfants.length - 1; k >= 0; k--) {
      const e = enfants[k];
      pile.push(noeud.type === 'objet'
        ? { noeud: e.valeur, chemin: chemin ? chemin + segmentJson(e.cle) : segmentJson(e.cle).replace(/^\./, '') }
        : { noeud: e, chemin: chemin + '[' + k + ']' });
    }
  }
  return lignes;
}

/* ------------------------- Valeurs JavaScript ---------------------------- */
/** Un entier qu un double ne garde pas : BigInt(lexeme) differe de la valeur
 *  que JSON.parse en tire. Les decimaux restent des nombres, comme partout. */
export function entierPerdu(brut) {
  if (!/^-?\d+$/.test(brut)) return false;
  const lu = Number(brut);
  return !Number.isFinite(lu) || BigInt(brut) !== BigInt(lu);
}

/** Un entier hors de la plage sure (|n| > 2^53 - 1) : meme exact, un double ne
 *  s ecrit plus avec ses chiffres — 2^64 s affiche « 18446744073709552000 ».
 *  Il reste donc un NombreExact dans les valeurs que l on montre. */
export function entierHorsPlageSure(brut) {
  return /^-?\d+$/.test(brut) && !Number.isSafeInteger(Number(brut));
}

const poser = (objet, cle, valeur) =>
  Object.defineProperty(objet, cle, { value: valeur, enumerable: true, writable: true, configurable: true });

/**
 * L arbre en valeur JavaScript, comme JSON.parse — la derniere de deux cles
 * jumelles gagne — a deux differences pres : un entier hors de la plage sure
 * devient un NombreExact, qui garde ses chiffres, et une cle « __proto__ »
 * reste une cle.
 */
export function versValeur(racine) {
  const scalaire = noeud => {
    if (noeud.type === 'chaine') return noeud.valeur;
    if (noeud.type === 'nombre') return entierHorsPlageSure(noeud.brut) ? new NombreExact(noeud.brut) : Number(noeud.brut);
    return noeud.brut === 'true' ? true : noeud.brut === 'false' ? false : null;
  };
  if (!enfantsDe(racine)) return scalaire(racine);
  const conteneur = noeud => (noeud.type === 'objet' ? {} : []);
  const resultat = conteneur(racine);
  const pile = [{ noeud: racine, cible: resultat }];
  while (pile.length) {
    const { noeud, cible } = pile.pop();
    const enfants = enfantsDe(noeud);
    enfants.forEach((e, k) => {
      const source = noeud.type === 'objet' ? e.valeur : e;
      let valeur;
      if (enfantsDe(source)) { valeur = conteneur(source); pile.push({ noeud: source, cible: valeur }); }
      else valeur = scalaire(source);
      if (noeud.type === 'objet') poser(cible, e.cle, valeur); else cible[k] = valeur;
    });
  }
  return resultat;
}

/** JSON.parse sans perte : la valeur, ou une SyntaxError. */
export const lireJson = texte => versValeur(lireJsonExact(texte));

/**
 * L inverse de versValeur : ecrit une valeur JavaScript en JSON comme
 * JSON.stringify — toJSON appele, undefined et fonctions omis dans un objet et
 * ecrits null dans un tableau, une structure circulaire refusee — mais un
 * NombreExact et un BigInt sont ecrits tels quels, sans guillemets ni arrondi.
 */
export function ecrireValeurJson(valeur, indentation = '  ') {
  const normaliser = v => (v !== null && typeof v === 'object' && !(v instanceof NombreExact)
    && typeof v.toJSON === 'function' ? v.toJSON() : v);
  const feuille = v => {
    if (v instanceof NombreExact) return { type: 'nombre', brut: v.brut };
    if (typeof v === 'bigint') return { type: 'nombre', brut: v.toString() };
    if (typeof v === 'number') return Number.isFinite(v) ? { type: 'nombre', brut: JSON.stringify(v) } : { type: 'litteral', brut: 'null' };
    if (typeof v === 'boolean') return { type: 'litteral', brut: String(v) };
    if (typeof v === 'string') return { type: 'chaine', valeur: v, brut: JSON.stringify(v) };
    if (v === null || typeof v !== 'object') return { type: 'litteral', brut: 'null' };
    return null;
  };
  const conteneur = v => (Array.isArray(v) ? { type: 'tableau', elements: [] } : { type: 'objet', membres: [] });
  const omis = v => v === undefined || typeof v === 'function' || typeof v === 'symbol';

  const v0 = normaliser(valeur);
  const racine = feuille(v0) || conteneur(v0);
  if (racine.type !== 'tableau' && racine.type !== 'objet') return ecrireJsonExact(racine, indentation);
  /* Parcours en profondeur avec le chemin courant : un objet deja sur le
     chemin est une boucle (JSON.stringify leve alors une TypeError) ; le meme
     objet atteint par deux branches, lui, s ecrit deux fois. */
  const chemin = new Set([v0]);
  const pile = [{ v: v0, noeud: racine, entrees: Array.isArray(v0) ? v0.map((x, k) => [k, x]) : Object.entries(v0), i: 0 }];
  while (pile.length) {
    const f = pile[pile.length - 1];
    if (f.i >= f.entrees.length) { chemin.delete(f.v); pile.pop(); continue; }
    const [k, brut] = f.entrees[f.i++];
    const x = normaliser(brut);
    if (f.noeud.type === 'objet' && omis(x)) continue;
    let enfant = feuille(x);
    if (!enfant) {
      if (chemin.has(x)) throw new TypeError('structure circulaire : elle ne s ecrit pas en JSON');
      enfant = conteneur(x);
      chemin.add(x);
      pile.push({ v: x, noeud: enfant, entrees: Array.isArray(x) ? x.map((y, j) => [j, y]) : Object.entries(x), i: 0 });
    }
    if (f.noeud.type === 'tableau') f.noeud.elements.push(enfant);
    else f.noeud.membres.push({ cle: String(k), brutCle: JSON.stringify(String(k)), valeur: enfant });
  }
  return ecrireJsonExact(racine, indentation);
}

/* ------------------------------- Constats -------------------------------- */
/**
 * Les entiers que JSON.parse ne lirait pas tels quels — ce qu un client
 * JavaScript en ferait. `lu` est l ecriture que JavaScript donne de la valeur.
 */
export function nombresPerdus(racine) {
  const perdus = [];
  const pile = [{ noeud: racine, chemin: '$' }];
  while (pile.length) {
    const { noeud, chemin } = pile.pop();
    if (noeud.type === 'nombre' && entierPerdu(noeud.brut)) {
      perdus.push({ chemin, brut: noeud.brut, lu: String(Number(noeud.brut)) });
      continue;
    }
    const enfants = enfantsDe(noeud);
    if (!enfants) continue;
    for (let k = enfants.length - 1; k >= 0; k--) {
      const e = enfants[k];
      pile.push(noeud.type === 'objet'
        ? { noeud: e.valeur, chemin: chemin + segmentJson(e.cle) }
        : { noeud: e, chemin: chemin + '[' + k + ']' });
    }
  }
  return perdus;
}

/** Les cles ecrites deux fois dans un meme objet. RFC 8259 §4 : les noms
 *  « SHOULD be unique » ; la plupart des lecteurs, JSON.parse compris, ne
 *  gardent que la derniere paire, d autres refusent l objet ou les gardent
 *  toutes — le sens du texte depend alors de qui le lit. */
export function clesEnDouble(racine) {
  const doubles = [];
  const pile = [{ noeud: racine, chemin: '$' }];
  while (pile.length) {
    const { noeud, chemin } = pile.pop();
    const enfants = enfantsDe(noeud);
    if (!enfants) continue;
    if (noeud.type === 'objet') {
      const vues = new Set();
      for (const m of noeud.membres) {
        if (vues.has(m.cle)) doubles.push({ chemin, cle: m.cle });
        vues.add(m.cle);
      }
    }
    for (let k = enfants.length - 1; k >= 0; k--) {
      const e = enfants[k];
      pile.push(noeud.type === 'objet'
        ? { noeud: e.valeur, chemin: chemin + segmentJson(e.cle) }
        : { noeud: e, chemin: chemin + '[' + k + ']' });
    }
  }
  return doubles;
}
