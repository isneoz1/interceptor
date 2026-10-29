/* Comparaison de deux textes — SWIFT (by D4RK)
 *
 * La vue Comparaison confronte deux requetes capturees ; la boite a outils,
 * le texte de travail et un autre colle a cote : deux reponses, deux
 * configurations, deux jetons. Les deux passent par ce module.
 *
 * Algorithme : E. W. Myers, « An O(ND) Difference Algorithm and Its
 * Variations », Algorithmica 1 (1986), dans sa variante en espace lineaire
 * (§4b) : on cherche le « serpent du milieu » d un plus court chemin d edition,
 * puis on recommence de chaque cote. Le resultat est une liste de changements
 * de longueur minimale — elle garde la plus longue sous-suite commune — sans
 * limite de taille : le cout suit le nombre de differences, pas le produit des
 * longueurs. L ancienne table n x m bornait la comparaison a 4000 lignes.
 *
 * Deux textes tres longs aux changements nombreux feraient chercher longtemps
 * (le cout croit comme le carre du nombre de differences). Passe un budget
 * d operations, la comparaison s ancre sur les lignes presentes une seule fois
 * de chaque cote — le principe du « patience diff » de Bram Cohen, que git
 * propose aussi — et ne cherche plus le plus court qu entre deux ancres, sur
 * de petites plages. Le resultat reste exact — chaque ligne y figure une fois,
 * et il transforme bien un texte en l autre — mais rien ne garantit plus qu il
 * soit le plus court, et il le dit (`minimal: false`). Jamais une ligne ne
 * disparait.
 */

const EGAL = 0, RETRAIT = 1, AJOUT = 2;
const NOMS = ['egal', 'retrait', 'ajout'];

/* Pas d une recherche (un diagonale essayee, ou une case du serpent suivie).
   Quarante millions tiennent en quelques centaines de millisecondes. */
const BUDGET = 40000000;
/* Une fois ce budget epuise, une plage d au plus deux mille lignes (les deux
   cotes ensemble) se cherche encore au plus court, avec son propre budget. */
const PETITE_PLAGE = 2000;
const BUDGET_LOCAL = 2000000;

/* ------------------------- Recherche du serpent -------------------------- */
/* La bissection telle que la decrit Myers (§4b), sous la forme qu en donne
   diff-match-patch (N. Fraser) : une passe avant depuis le coin haut-gauche,
   une passe arriere depuis le coin bas-droit, jusqu a ce qu elles se
   chevauchent. Rend le point de coupe, `null` si le budget est epuise, ou
   `false` si les deux suites n ont rien en commun. */
function bissection(a, x0, x1, b, y0, y1, compte) {
  const n = x1 - x0, m = y1 - y0;
  const maxD = Math.ceil((n + m) / 2);
  const decalage = maxD + 1;
  const taille = 2 * maxD + 3;
  const v1 = new Int32Array(taille).fill(-1);
  const v2 = new Int32Array(taille).fill(-1);
  v1[decalage + 1] = 0;
  v2[decalage + 1] = 0;
  const delta = n - m;
  /* Delta impair : le chevauchement se constate dans la passe avant. */
  const avant = (delta & 1) !== 0;
  let k1debut = 0, k1fin = 0, k2debut = 0, k2fin = 0;
  for (let d = 0; d < maxD; d++) {
    if (compte.reste <= 0) return null;
    for (let k1 = -d + k1debut; k1 <= d - k1fin; k1 += 2) {
      const i1 = decalage + k1;
      let x = (k1 === -d || (k1 !== d && v1[i1 - 1] < v1[i1 + 1])) ? v1[i1 + 1] : v1[i1 - 1] + 1;
      let y = x - k1;
      const depart = x;
      while (x < n && y < m && a[x0 + x] === b[y0 + y]) { x++; y++; }
      compte.reste -= 1 + x - depart;
      v1[i1] = x;
      if (x > n) k1fin += 2;
      else if (y > m) k1debut += 2;
      else if (avant) {
        const i2 = decalage + delta - k1;
        if (i2 >= 0 && i2 < taille && v2[i2] !== -1 && x >= n - v2[i2]) return { x: x0 + x, y: y0 + y };
      }
    }
    for (let k2 = -d + k2debut; k2 <= d - k2fin; k2 += 2) {
      const i2 = decalage + k2;
      let x = (k2 === -d || (k2 !== d && v2[i2 - 1] < v2[i2 + 1])) ? v2[i2 + 1] : v2[i2 - 1] + 1;
      let y = x - k2;
      const depart = x;
      while (x < n && y < m && a[x1 - 1 - x] === b[y1 - 1 - y]) { x++; y++; }
      compte.reste -= 1 + x - depart;
      v2[i2] = x;
      if (x > n) k2fin += 2;
      else if (y > m) k2debut += 2;
      else if (!avant) {
        const i1 = decalage + delta - k2;
        if (i1 >= 0 && i1 < taille && v1[i1] !== -1) {
          const xa = v1[i1];
          if (xa >= n - x) return { x: x0 + xa, y: y0 + xa - (i1 - decalage) };
        }
      }
    }
  }
  /* Aucun chevauchement avant D/2 : la plus longue sous-suite commune est
     vide (D = n + m), tout retirer puis tout ajouter est alors le plus court. */
  return false;
}

/* Les deux plages n ont-elles aucun element en commun ? Alors tout retirer
   puis tout ajouter est le plus court, sans rien chercher : la recherche, elle,
   aurait epuise son budget sur deux longs textes sans rapport, et le resultat
   aurait ete dit « pas le plus court » a tort. */
function rienEnCommun(a, x0, x1, b, y0, y1) {
  const court = x1 - x0 <= y1 - y0;
  const vus = new Set(court ? a.slice(x0, x1) : b.slice(y0, y1));
  const [s, debut, fin] = court ? [b, y0, y1] : [a, x0, x1];
  for (let k = debut; k < fin; k++) if (vus.has(s[k])) return false;
  return true;
}

/**
 * Les ancres d une plage : les elements presents une seule fois dans a[x0..x1)
 * et une seule fois dans b[y0..y1), gardes dans le meme ordre des deux cotes
 * par une plus longue sous-suite croissante (tri par piles, n log n).
 * @returns [[i, j], …], croissants en i et en j
 */
function ancresUniques(a, x0, x1, b, y0, y1) {
  const dansA = new Map(), dansB = new Map();
  for (let i = x0; i < x1; i++) { const v = dansA.get(a[i]); dansA.set(a[i], v === undefined ? i : -1); }
  for (let j = y0; j < y1; j++) { const v = dansB.get(b[j]); dansB.set(b[j], v === undefined ? j : -1); }
  const paires = [];
  for (let i = x0; i < x1; i++) {
    if (dansA.get(a[i]) !== i) continue;
    const j = dansB.get(a[i]);
    if (j !== undefined && j >= 0) paires.push([i, j]);
  }
  /* Plus longue sous-suite croissante des j : sommets des piles, et pour
     chaque paire, celle qui la precede dans la meilleure suite. */
  const sommets = [], precedent = new Int32Array(paires.length);
  for (let k = 0; k < paires.length; k++) {
    const j = paires[k][1];
    let bas = 0, haut = sommets.length;
    while (bas < haut) { const m = (bas + haut) >> 1; if (paires[sommets[m]][1] < j) bas = m + 1; else haut = m; }
    precedent[k] = bas > 0 ? sommets[bas - 1] : -1;
    sommets[bas] = k;
  }
  const ancres = [];
  for (let k = sommets.length ? sommets[sommets.length - 1] : -1; k >= 0; k = precedent[k]) ancres.push(paires[k]);
  return ancres.reverse();
}

/**
 * Script d edition entre deux suites d entiers : [type, i, j] par element,
 * i et j indices dans a et b (-1 quand le cote n est pas concerne).
 * Iteratif : une pile de taches plutot qu une recursion, aucune entree ne peut
 * epuiser la pile d appels.
 */
function scriptEdition(a, b, budget = BUDGET) {
  const ops = [];
  const compte = { reste: budget, minimal: true };
  const pile = [[0, a.length, 0, b.length]];
  while (pile.length) {
    const tache = pile.pop();
    if (tache.length === 3) {                         // [x, y, n] : n lignes egales
      for (let k = 0; k < tache[2]; k++) ops.push([EGAL, tache[0] + k, tache[1] + k]);
      continue;
    }
    let [x0, x1, y0, y1] = tache;
    while (x0 < x1 && y0 < y1 && a[x0] === b[y0]) ops.push([EGAL, x0++, y0++]);
    let fin = 0;
    while (x1 - fin > x0 && y1 - fin > y0 && a[x1 - 1 - fin] === b[y1 - 1 - fin]) fin++;
    x1 -= fin; y1 -= fin;
    if (fin) pile.push([x1, y1, fin]);
    if (x0 === x1 || y0 === y1) {
      for (let x = x0; x < x1; x++) ops.push([RETRAIT, x, -1]);
      for (let y = y0; y < y1; y++) ops.push([AJOUT, -1, y]);
      continue;
    }
    if (rienEnCommun(a, x0, x1, b, y0, y1)) {
      for (let x = x0; x < x1; x++) ops.push([RETRAIT, x, -1]);
      for (let y = y0; y < y1; y++) ops.push([AJOUT, -1, y]);
      continue;
    }
    /* Le plus court, tant que le budget le permet ; ensuite, une petite plage
       le cherche encore avec son propre budget. */
    let coupe = null;
    if (compte.reste > 0) coupe = bissection(a, x0, x1, b, y0, y1, compte);
    else if ((x1 - x0) + (y1 - y0) <= PETITE_PLAGE) coupe = bissection(a, x0, x1, b, y0, y1, { reste: BUDGET_LOCAL });
    const degeneree = coupe && ((coupe.x === x0 && coupe.y === y0) || (coupe.x === x1 && coupe.y === y1));
    if (coupe === false) {
      for (let x = x0; x < x1; x++) ops.push([RETRAIT, x, -1]);
      for (let y = y0; y < y1; y++) ops.push([AJOUT, -1, y]);
      continue;
    }
    if (coupe && !degeneree) {
      pile.push([coupe.x, x1, coupe.y, y1]);
      pile.push([x0, coupe.x, y0, coupe.y]);
      continue;
    }
    /* Budget epuise : on s ancre sur les lignes uniques des deux cotes, et
       chaque intervalle entre deux ancres redevient une plage a comparer. */
    compte.minimal = false;
    const ancres = ancresUniques(a, x0, x1, b, y0, y1);
    if (!ancres.length) {
      /* Aucune ligne unique — des textes faits de quelques lignes repetees.
         Une petite plage se rend telle quelle ; une grande se coupe en
         tranches de part et d autre, comparees chacune avec son propre
         budget. Tout retirer puis tout ajouter disait « 0 % en commun »
         la ou deux textes en partageaient les deux tiers. */
      if ((x1 - x0) + (y1 - y0) <= PETITE_PLAGE) {
        for (let x = x0; x < x1; x++) ops.push([RETRAIT, x, -1]);
        for (let y = y0; y < y1; y++) ops.push([AJOUT, -1, y]);
        continue;
      }
      const k = Math.ceil(Math.max(x1 - x0, y1 - y0) / (PETITE_PLAGE / 2));
      for (let t = k - 1; t >= 0; t--) {
        pile.push([x0 + Math.floor(t * (x1 - x0) / k), x0 + Math.floor((t + 1) * (x1 - x0) / k),
          y0 + Math.floor(t * (y1 - y0) / k), y0 + Math.floor((t + 1) * (y1 - y0) / k)]);
      }
      continue;
    }
    const taches = [];
    let px = x0, py = y0;
    for (const [i, j] of ancres) {
      if (i > px || j > py) taches.push([px, i, py, j]);
      taches.push([i, j, 1]);
      px = i + 1; py = j + 1;
    }
    if (px < x1 || py < y1) taches.push([px, x1, py, y1]);
    for (let k = taches.length - 1; k >= 0; k--) pile.push(taches[k]);
  }
  return { ops: retraitsDAbord(ops), minimal: compte.minimal };
}

/* Dans chaque bloc de changements, les retraits avant les ajouts : c est la
   forme que lisent git et patch, et la plus facile a suivre des yeux. Le
   nombre de changements ne bouge pas. */
function retraitsDAbord(ops) {
  const sortie = [];
  let i = 0;
  while (i < ops.length) {
    if (ops[i][0] === EGAL) { sortie.push(ops[i++]); continue; }
    const ajouts = [];
    while (i < ops.length && ops[i][0] !== EGAL) {
      if (ops[i][0] === RETRAIT) sortie.push(ops[i]); else ajouts.push(ops[i]);
      i++;
    }
    for (const op of ajouts) sortie.push(op);
  }
  return sortie;
}

/* Chaque element distinct recoit un numero : la recherche compare des
   entiers plutot que des chaines. */
function numeroter(gauche, droite, cle = x => x) {
  const numeros = new Map();
  const numero = x => {
    const k = cle(x);
    let n = numeros.get(k);
    if (n === undefined) { n = numeros.size; numeros.set(k, n); }
    return n;
  };
  return { a: gauche.map(numero), b: droite.map(numero) };
}

/* ------------------------------ Lignes ----------------------------------- */
/** Decoupe en lignes, sans perdre les lignes vides. CRLF et LF se valent. */
const enLignes = texte => String(texte == null ? '' : texte).split(/\r?\n/);

/**
 * Compare deux listes de lignes deja decoupees. Chaque ligne des deux listes
 * figure exactement une fois dans `operations` : rien ne peut disparaitre.
 * @returns { operations: [{ type, texte, gauche, droite }], minimal }
 */
export function comparerLignes(lignesA, lignesB, budget = BUDGET) {
  const { a, b } = numeroter(lignesA, lignesB);
  const { ops, minimal } = scriptEdition(a, b, budget);
  const operations = ops.map(([type, i, j]) => ({
    type: NOMS[type],
    texte: type === AJOUT ? lignesB[j] : lignesA[i],
    gauche: i >= 0 ? i + 1 : null,
    droite: j >= 0 ? j + 1 : null
  }));
  return { operations, minimal };
}

/**
 * Compare deux textes ligne a ligne. Rend une suite d operations :
 * « egal », « ajout », « retrait », et les comptes qui vont avec.
 */
export function comparerTextes(gauche, droite) {
  const { operations, minimal } = comparerLignes(enLignes(gauche), enLignes(droite));
  let ajouts = 0, retraits = 0;
  for (const o of operations) {
    if (o.type === 'ajout') ajouts++;
    else if (o.type === 'retrait') retraits++;
  }
  const egales = operations.length - ajouts - retraits;
  return {
    operations,
    ajouts,
    retraits,
    egales,
    minimal,
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
  const motsA = decoupe(gauche), motsB = decoupe(droite);
  const { a, b } = numeroter(motsA, motsB);
  return scriptEdition(a, b).ops.map(([type, i, j]) => ({
    type: NOMS[type], texte: type === AJOUT ? motsB[j] : motsA[i]
  }));
}

/* ---------------------------- Format unifie ------------------------------ */
/* Lignes exactes, pour un correctif applicable : decoupees sur LF seul (un CR
   reste dans la ligne, comme pour diff), et la derniere ligne d un texte qui
   ne finit pas par un saut de ligne est marquee. */
function lignesExactes(texte) {
  const s = String(texte == null ? '' : texte);
  if (!s) return { lignes: [], sansFinale: false };
  const lignes = s.split('\n');
  if (lignes[lignes.length - 1] === '') { lignes.pop(); return { lignes, sansFinale: false }; }
  return { lignes, sansFinale: true };
}

const SANS_FINALE = '\\ No newline at end of file';

/* « l,s » de l en-tete d un bloc (GNU diffutils, format unifie) : la
   longueur est omise quand elle vaut 1 ; un bloc vide d un cote donne le
   numero de la ligne qui le precede. */
function etendue(debut, longueur) {
  if (longueur === 0) return debut + ',0';
  return longueur === 1 ? String(debut + 1) : (debut + 1) + ',' + longueur;
}

/**
 * Le diff au format unifie, celui que lisent `patch` et `git apply` : des blocs
 * « @@ -l,s +l,s @@ » avec trois lignes de contexte, et la mention
 * « \ No newline at end of file » la ou un texte ne finit pas par un saut de
 * ligne. Deux textes identiques donnent une chaine vide, comme diff.
 */
export function diffUnifie(gauche, droite, nomGauche = 'gauche', nomDroite = 'droite', contexte = 3) {
  const A = lignesExactes(gauche), B = lignesExactes(droite);
  /* « x » sans saut de ligne final et « x\n » sont deux lignes differentes :
     la cle de la derniere ligne non terminee porte une marque (un LF, que
     aucune ligne ne peut contenir). */
  const cle = (lignes, sansFinale) => (x, i) => (sansFinale && i === lignes.length - 1 ? '\n' + x : x);
  const cleA = cle(A.lignes, A.sansFinale), cleB = cle(B.lignes, B.sansFinale);
  const numeros = new Map();
  const numero = k => { let n = numeros.get(k); if (n === undefined) { n = numeros.size; numeros.set(k, n); } return n; };
  const a = A.lignes.map((x, i) => numero(cleA(x, i)));
  const b = B.lignes.map((x, i) => numero(cleB(x, i)));
  const ops = scriptEdition(a, b).ops;
  if (!ops.some(op => op[0] !== EGAL)) return '';

  const sortie = ['--- ' + nomGauche, '+++ ' + nomDroite];
  /* Les lignes de chaque cote deja passees, comptees au fil des blocs : les
     recompter depuis le debut a chaque bloc coutait n x blocs. */
  let curseur = 0, vusA = 0, vusB = 0;
  const avancer = jusqua => {
    for (; curseur < jusqua; curseur++) {
      if (ops[curseur][0] !== AJOUT) vusA++;
      if (ops[curseur][0] !== RETRAIT) vusB++;
    }
  };
  let i = 0;
  while (i < ops.length) {
    if (ops[i][0] === EGAL) { i++; continue; }
    /* Un bloc : le contexte avant, les changements tant que deux d entre eux
       sont separes par au plus 2 x contexte lignes egales, le contexte apres. */
    const debut = Math.max(0, i - contexte);
    let fin = i;
    for (;;) {
      while (fin < ops.length && ops[fin][0] !== EGAL) fin++;
      let egales = 0;
      while (fin + egales < ops.length && ops[fin + egales][0] === EGAL) egales++;
      if (fin + egales < ops.length && egales <= 2 * contexte) { fin += egales; continue; }
      fin = Math.min(ops.length, fin + Math.min(egales, contexte));
      break;
    }
    const bloc = ops.slice(debut, fin);
    let la = 0, lb = 0;
    for (const [type] of bloc) { if (type !== AJOUT) la++; if (type !== RETRAIT) lb++; }
    /* Le premier numero de ligne de chaque cote : celui de la premiere ligne
       du bloc, ou, si ce cote n en a pas, le nombre de lignes qui precedent. */
    avancer(debut);
    sortie.push('@@ -' + etendue(vusA, la) + ' +' + etendue(vusB, lb) + ' @@');
    for (const [type, ia, jb] of bloc) {
      if (type === AJOUT) {
        sortie.push('+' + B.lignes[jb]);
        if (B.sansFinale && jb === B.lignes.length - 1) sortie.push(SANS_FINALE);
      } else {
        sortie.push((type === EGAL ? ' ' : '-') + A.lignes[ia]);
        if (A.sansFinale && ia === A.lignes.length - 1) sortie.push(SANS_FINALE);
      }
    }
    i = fin;
  }
  return sortie.join('\n') + '\n';
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
    /* Le texte le plus court s arrete la : l interface le dit dans sa langue. */
    contexte: '',
    fin: commun
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
