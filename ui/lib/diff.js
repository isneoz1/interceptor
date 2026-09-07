/* Comparaison de deux textes — INTERCEPTOR (by D4RK)
 *
 * La vue Comparaison confronte deux requetes capturees ; ici on compare deux
 * textes quelconques, celui de travail et un autre colle a cote : deux
 * reponses, deux configurations, deux jetons.
 *
 * Algorithme : plus longue sous-suite commune, en programmation dynamique.
 * Exact, sans heuristique — donc borne en taille pour rester instantane.
 */

const LIMITE = 4000;                                     // lignes par cote

/** Decoupe en lignes, sans perdre les lignes vides. */
const enLignes = texte => String(texte == null ? '' : texte).split(/\r?\n/);

/**
 * Table de la plus longue sous-suite commune. On travaille sur des entiers
 * (indices de lignes uniques) plutot que sur des chaines : la comparaison
 * devient une egalite de nombres.
 */
function table(a, b) {
  const n = a.length, m = b.length;
  const grille = new Uint32Array((n + 1) * (m + 1));
  const at = (i, j) => grille[i * (m + 1) + j];
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      grille[i * (m + 1) + j] = a[i] === b[j]
        ? at(i + 1, j + 1) + 1
        : Math.max(at(i + 1, j), at(i, j + 1));
    }
  }
  return { grille, at };
}

/**
 * Compare deux textes ligne a ligne. Rend une suite d operations :
 * « egal », « ajout », « retrait ». Chaque ligne des deux textes y figure
 * exactement une fois : rien ne peut disparaitre du resultat.
 */
export function comparerTextes(gauche, droite) {
  const lignesA = enLignes(gauche);
  const lignesB = enLignes(droite);
  if (lignesA.length > LIMITE || lignesB.length > LIMITE) {
    throw new Error('comparaison limitee a ' + LIMITE + ' lignes par cote');
  }

  // Chaque ligne distincte recoit un numero : la table travaille sur des entiers.
  const numeros = new Map();
  const numero = ligne => {
    if (!numeros.has(ligne)) numeros.set(ligne, numeros.size);
    return numeros.get(ligne);
  };
  const a = lignesA.map(numero);
  const b = lignesB.map(numero);

  const { at } = table(a, b);
  const operations = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      operations.push({ type: 'egal', texte: lignesA[i], gauche: i + 1, droite: j + 1 });
      i++; j++;
    } else if (at(i + 1, j) >= at(i, j + 1)) {
      operations.push({ type: 'retrait', texte: lignesA[i], gauche: i + 1, droite: null });
      i++;
    } else {
      operations.push({ type: 'ajout', texte: lignesB[j], gauche: null, droite: j + 1 });
      j++;
    }
  }
  while (i < a.length) operations.push({ type: 'retrait', texte: lignesA[i], gauche: ++i, droite: null });
  while (j < b.length) operations.push({ type: 'ajout', texte: lignesB[j], gauche: null, droite: ++j });

  const ajouts = operations.filter(o => o.type === 'ajout').length;
  const retraits = operations.filter(o => o.type === 'retrait').length;
  const egales = operations.length - ajouts - retraits;
  return {
    operations,
    ajouts,
    retraits,
    egales,
    identiques: ajouts === 0 && retraits === 0,
    similitude: operations.length ? Math.round((egales / operations.length) * 1000) / 10 : 100
  };
}

/**
 * Comparaison mot a mot d une seule ligne : montre precisement ce qui change
 * dans une valeur longue (URL, jeton, entete).
 */
export function comparerMots(gauche, droite) {
  const decoupe = t => String(t == null ? '' : t).split(/(\s+)/).filter(x => x !== '');
  const a = decoupe(gauche), b = decoupe(droite);
  if (a.length > LIMITE || b.length > LIMITE) throw new Error('ligne trop longue pour la comparaison');
  const { at } = table(a, b);
  const sorties = [];
  let i = 0, j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) { sorties.push({ type: 'egal', texte: a[i] }); i++; j++; }
    else if (at(i + 1, j) >= at(i, j + 1)) { sorties.push({ type: 'retrait', texte: a[i] }); i++; }
    else { sorties.push({ type: 'ajout', texte: b[j] }); j++; }
  }
  while (i < a.length) sorties.push({ type: 'retrait', texte: a[i++] });
  while (j < b.length) sorties.push({ type: 'ajout', texte: b[j++] });
  return sorties;
}

/** Le diff au format unifie, celui que lisent git et les correctifs. */
export function diffUnifie(gauche, droite, nomGauche = 'gauche', nomDroite = 'droite') {
  const resultat = comparerTextes(gauche, droite);
  const lignes = ['--- ' + nomGauche, '+++ ' + nomDroite];
  for (const op of resultat.operations) {
    lignes.push((op.type === 'ajout' ? '+' : op.type === 'retrait' ? '-' : ' ') + op.texte);
  }
  return lignes.join('\n');
}

/**
 * Premiere difference entre deux chaines : position, contexte, et code des
 * deux caracteres. Repond a « pourquoi ces deux jetons ne sont pas egaux ».
 */
export function premiereDifference(gauche, droite) {
  const a = String(gauche == null ? '' : gauche);
  const b = String(droite == null ? '' : droite);
  const commun = Math.min(a.length, b.length);
  for (let i = 0; i < commun; i++) {
    if (a[i] !== b[i]) {
      return {
        position: i,
        gauche: a[i],
        droite: b[i],
        codeGauche: 'U+' + a.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'),
        codeDroite: 'U+' + b.charCodeAt(i).toString(16).toUpperCase().padStart(4, '0'),
        contexte: a.slice(Math.max(0, i - 20), i + 20)
      };
    }
  }
  if (a.length === b.length) return null;
  return {
    position: commun,
    gauche: a.length > b.length ? a[commun] : '',
    droite: b.length > a.length ? b[commun] : '',
    codeGauche: a.length > b.length ? 'U+' + a.charCodeAt(commun).toString(16).toUpperCase().padStart(4, '0') : '',
    codeDroite: b.length > a.length ? 'U+' + b.charCodeAt(commun).toString(16).toUpperCase().padStart(4, '0') : '',
    contexte: 'un texte s arrete a ' + commun + ' caracteres, l autre continue'
  };
}

/* ---------------------------- Distance d edition -------------------------- */
/** Levenshtein : nombre minimal d insertions, suppressions et substitutions
 *  pour passer d un texte a l autre. Deux lignes pour la memoire, pas n x m. */
export function distanceLevenshtein(a, b) {
  const s = String(a == null ? '' : a), t = String(b == null ? '' : b);
  if (s === t) return 0;
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  let precedente = new Array(t.length + 1);
  let courante = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j++) precedente[j] = j;
  for (let i = 1; i <= s.length; i++) {
    courante[0] = i;
    const ci = s.charCodeAt(i - 1);
    for (let j = 1; j <= t.length; j++) {
      const cout = ci === t.charCodeAt(j - 1) ? 0 : 1;
      courante[j] = Math.min(precedente[j] + 1, courante[j - 1] + 1, precedente[j - 1] + cout);
    }
    [precedente, courante] = [courante, precedente];
  }
  return precedente[t.length];
}

/** Similitude de 0 a 100, deduite de la distance et de la longueur maximale. */
export function similariteTextes(a, b) {
  const s = String(a == null ? '' : a), t = String(b == null ? '' : b);
  const max = Math.max(s.length, t.length);
  if (!max) return 100;
  const d = distanceLevenshtein(s, t);
  return { distance: d, pourcentage: Math.round((1 - d / max) * 1000) / 10 };
}
