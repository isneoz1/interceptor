/* JSON Patch, JSON Merge Patch et JSON Pointer — SWIFT (by D4RK)
 *
 * RFC 6901 (JSON Pointer) : « /a/b/0 » designe une valeur ; dans un jeton,
 * « ~1 » s ecrit pour « / » et « ~0 » pour « ~ » (§3), decodes dans cet ordre
 * (§4). Une cle ecrite deux fois dans un objet rend la reference indefinie :
 * l evaluation echoue (§4).
 *
 * RFC 6902 (JSON Patch) : une liste d operations add, remove, replace, move,
 * copy et test, appliquee en entier ou pas du tout (§5). Retirer la racine
 * n est pas defini (erratum 4787, mis de cote pour une revision) : refuse.
 *
 * RFC 7396 (JSON Merge Patch) : un objet qui dit ce qui change ; null retire
 * un membre, un objet se fusionne membre a membre, tout le reste remplace
 * (§2). Un objet aux cles en double donne un resultat non defini (§2) :
 * refuse.
 *
 * Tout travaille sur l arbre sans perte de lib/json-exact.js, et le copie au
 * lieu de le modifier : un nombre garde son ecriture, une cle en double se
 * voit — un lecteur bati sur JSON.parse ne le peut pas, il l a deja perdue —
 * et le document d origine ne change jamais.
 */
import { comparerLignes } from './diff.js';

/* Les messages d erreur, avec leurs trous ; exportes pour que le controle de
   traduction les verifie un a un. */
export const ERREURS_PATCH = {
  pointeurType: 'pointeur JSON : une chaine est attendue',
  pointeurDebut: 'pointeur JSON « {p} » : il commence par « / » (RFC 6901 §3)',
  pointeurTilde: 'pointeur JSON « {p} » : « ~ » doit etre suivi de 0 ou 1 (RFC 6901 §3)',
  cleAbsente: 'cle « {cle} » absente de {chemin}',
  cleDouble: 'cle « {cle} » ecrite deux fois dans {chemin} : la reference est indefinie (RFC 6901 §4)',
  indexInvalide: 'index « {index} » invalide dans {chemin} : un entier sans zero de tete est attendu (RFC 6901 §4)',
  indexHors: 'index {index} hors du tableau {chemin}, qui compte {n} elements',
  tiret: '« - » dans {chemin} designe la place apres le dernier element : rien ne s y trouve (RFC 6901 §4)',
  pasConteneur: '{chemin} n est ni un objet ni un tableau : on ne peut pas y descendre',
  racine: 'retirer la racine n est pas defini (RFC 6902 §4.2, erratum 4787)',
  dedans: 'deplacer {de} dans {chemin}, l un de ses enfants, est interdit (RFC 6902 §4.4)',
  testEchoue: 'la valeur en {chemin} n est pas celle attendue (RFC 6902 §4.6)',
  comparaisonDouble: 'un objet aux cles en double n a pas d egalite definie : la comparaison de {chemin} echoue',
  patchPasTableau: 'un JSON Patch est un tableau d operations (RFC 6902 §3)',
  operationPasObjet: 'une operation est un objet (RFC 6902 §4)',
  membreAbsent: 'membre « {nom} » absent : il est exige pour {op} (RFC 6902 §4)',
  membreDouble: 'membre « {nom} » ecrit deux fois : une operation en a exactement un (RFC 6902 §4)',
  membreAmbigu: 'membre « {nom} » ecrit deux fois : chaque lecteur JSON peut en retenir un autre (RFC 8259 §4)',
  membreType: 'membre « {nom} » : une chaine est attendue',
  opInconnue: 'operation « {op} » inconnue : add, remove, replace, move, copy ou test (RFC 6902 §4)',
  mergeDouble: 'objet aux cles en double : la fusion n est pas definie (RFC 7396 §2)',
  profondeur: 'plus de mille niveaux d imbrication',
  inexprimable: 'null en {chemin} : un merge patch ne sait pas poser null, qui y veut dire « retirer » (RFC 7396 §1)'
};

export const OPERATIONS = ['add', 'remove', 'replace', 'move', 'copy', 'test'];
/* Au-dela, une imbrication est traitee d un bloc : un tableau dans un tableau
   passe par un appel de fonction, et la pile d appels a ses limites. */
const PROFONDEUR_MAX = 1000;

const remplir = (gabarit, valeurs) => gabarit.replace(/\{(\w+)\}/g, (m, k) => (k in valeurs ? String(valeurs[k]) : m));
function echouer(cle, valeurs = {}) {
  const e = new Error(remplir(ERREURS_PATCH[cle], valeurs));
  e.cle = cle;
  throw e;
}

/* ------------------------------ JSON Pointer ----------------------------- */
/** Les jetons d un pointeur ; leve une erreur si sa syntaxe est fausse. */
export function lirePointeur(p) {
  if (typeof p !== 'string') echouer('pointeurType');
  if (p === '') return [];
  if (p[0] !== '/') echouer('pointeurDebut', { p });
  return p.slice(1).split('/').map(jeton => {
    if (/~(?![01])/.test(jeton)) echouer('pointeurTilde', { p });
    return jeton.replace(/~1/g, '/').replace(/~0/g, '~');
  });
}

/** Le pointeur de ces jetons. */
export const ecrirePointeur = jetons => jetons.map(j => '/' + String(j).replace(/~/g, '~0').replace(/\//g, '~1')).join('');

/* Un chemin a montrer : la racine se dit « "" », comme son pointeur. Il ne
   s ecrit que pour un message d erreur : le calculer a chaque pas d un long
   pointeur coutait le carre de sa longueur. */
const affiche = jetons => (jetons.length ? ecrirePointeur(jetons) : '""');
const parentDe = (jetons, k) => affiche(jetons.slice(0, k));
const INDEX = /^(0|[1-9][0-9]*)$/;

/* L index des cles d un objet de la copie de travail : retrouver un membre
   ne parcourt plus l objet. Une cle ecrite deux fois y vaut DOUBLE. */
const DOUBLE = -2;
function indexDe(objet, ctx) {
  let carte = ctx.index.get(objet);
  if (!carte) {
    carte = new Map();
    objet.membres.forEach((m, i) => { if (m) carte.set(m.cle, carte.has(m.cle) ? DOUBLE : i); });
    ctx.index.set(objet, carte);
  }
  return carte;
}

/* La place du membre que designe le jeton k, ou -1. Une cle ecrite deux fois
   rend la reference indefinie : l evaluation echoue (RFC 6901 §4). */
function membreUnique(objet, jetons, k, ctx) {
  const cle = jetons[k];
  let trouve = -1;
  if (ctx) {
    const i = indexDe(objet, ctx).get(cle);
    if (i !== undefined) trouve = i;
  } else {
    for (let i = 0; i < objet.membres.length && trouve !== DOUBLE; i++) {
      if (objet.membres[i].cle === cle) trouve = trouve >= 0 ? DOUBLE : i;
    }
  }
  if (trouve === DOUBLE) echouer('cleDouble', { cle, chemin: parentDe(jetons, k) });
  return trouve;
}

/* L index que designe le jeton k dans un tableau ; `ajout` admet la place
   apres le dernier element (« - », ou l index egal a la longueur). */
function indexLu(tableau, jetons, k, ajout) {
  const jeton = jetons[k];
  const n = tableau.elements.length;
  if (jeton === '-') {
    if (ajout) return n;
    echouer('tiret', { chemin: parentDe(jetons, k) });
  }
  if (!INDEX.test(jeton)) echouer('indexInvalide', { index: jeton, chemin: parentDe(jetons, k) });
  const i = Number(jeton);
  if (!(i <= (ajout ? n : n - 1))) echouer('indexHors', { index: jeton, chemin: parentDe(jetons, k), n });
  return i;
}

function enfant(noeud, jetons, k, ctx) {
  if (noeud.type === 'objet') {
    const i = membreUnique(noeud, jetons, k, ctx);
    if (i < 0) echouer('cleAbsente', { cle: jetons[k], chemin: parentDe(jetons, k) });
    return noeud.membres[i].valeur;
  }
  if (noeud.type === 'tableau') return noeud.elements[indexLu(noeud, jetons, k, false)];
  return echouer('pasConteneur', { chemin: parentDe(jetons, k) });
}

/* La valeur au bout des `fin` premiers jetons. */
function suivre(racine, jetons, fin, ctx) {
  let n = racine;
  for (let k = 0; k < fin; k++) n = enfant(n, jetons, k, ctx);
  return n;
}

/** La valeur que designe un pointeur (sous forme de jetons). */
export function evaluerPointeur(racine, jetons) {
  return suivre(racine, jetons, jetons.length, null);
}

/* -------------------------- La copie de travail -------------------------- */
/* Appliquer un patch en recopiant, a chaque operation, le chemin modifie
   coutait la taille des conteneurs traverses : dix mille operations sur un
   tableau de cent mille elements prenaient huit secondes, et le panneau de la
   boite a outils recalcule a chaque dessin. Le document est donc copie une
   fois — ses conteneurs seulement : les feuilles ne changent jamais et restent
   partagees — puis modifie sur place. En cas d echec, la copie est jetee : le
   document d origine, lui, ne change jamais. Un membre retire laisse un trou
   (null), comble a la fin, pour que l index des cles reste juste pendant tout
   le patch. */
function copieDeTravail(racine) {
  const coquille = n => (n.type === 'objet' ? { type: 'objet', membres: n.membres }
    : n.type === 'tableau' ? { type: 'tableau', elements: n.elements } : n);
  const tete = coquille(racine);
  const pile = tete === racine ? [] : [tete];
  while (pile.length) {
    const n = pile.pop();
    if (n.type === 'objet') {
      const membres = [];
      for (const m of n.membres) {
        if (!m) continue;
        const v = coquille(m.valeur);
        if (v !== m.valeur) pile.push(v);
        membres.push({ cle: m.cle, brutCle: m.brutCle, valeur: v });
      }
      n.membres = membres;
    } else {
      n.elements = n.elements.map(e => {
        const v = coquille(e);
        if (v !== e) pile.push(v);
        return v;
      });
    }
  }
  return tete;
}

/* ------------------------------- Operations ------------------------------ */
function ajouter(etat, jetons, valeur, ctx) {
  if (!jetons.length) { etat.racine = valeur; return; }
  const k = jetons.length - 1;
  const c = suivre(etat.racine, jetons, k, ctx);
  if (c.type === 'objet') {
    const i = membreUnique(c, jetons, k, ctx);
    if (i >= 0) { c.membres[i] = { ...c.membres[i], valeur }; return; }
    indexDe(c, ctx).set(jetons[k], c.membres.length);
    c.membres.push({ cle: jetons[k], brutCle: JSON.stringify(jetons[k]), valeur });
    return;
  }
  if (c.type === 'tableau') { c.elements.splice(indexLu(c, jetons, k, true), 0, valeur); return; }
  echouer('pasConteneur', { chemin: parentDe(jetons, k) });
}

/* Retirer, ou remplacer quand `valeur` est donnee : la cible doit exister. */
function retirerOuRemplacer(etat, jetons, valeur, ctx) {
  if (!jetons.length) {
    if (valeur === undefined) echouer('racine');
    etat.racine = valeur;
    return;
  }
  const k = jetons.length - 1;
  const c = suivre(etat.racine, jetons, k, ctx);
  if (c.type === 'objet') {
    const i = membreUnique(c, jetons, k, ctx);
    if (i < 0) echouer('cleAbsente', { cle: jetons[k], chemin: parentDe(jetons, k) });
    if (valeur !== undefined) { c.membres[i] = { ...c.membres[i], valeur }; return; }
    c.membres[i] = null;
    indexDe(c, ctx).delete(jetons[k]);
    ctx.troues.add(c);
    return;
  }
  if (c.type === 'tableau') {
    const i = indexLu(c, jetons, k, false);
    if (valeur === undefined) c.elements.splice(i, 1);
    else c.elements[i] = valeur;
    return;
  }
  echouer('pasConteneur', { chemin: parentDe(jetons, k) });
}

const prefixeStrict = (court, long) => court.length < long.length && court.every((j, i) => j === long[i]);

/* Une operation lue dans son objet : chaque membre exige, au plus une fois. */
function lireOperation(noeud) {
  if (!noeud || noeud.type !== 'objet') echouer('operationPasObjet');
  const membres = new Map();
  for (const m of noeud.membres) {
    if (!membres.has(m.cle)) membres.set(m.cle, []);
    membres.get(m.cle).push(m.valeur);
  }
  const membre = (nom, op) => {
    const v = membres.get(nom);
    if (!v) echouer('membreAbsent', { nom, op: op || 'toute operation' });
    /* « op » et « path » : exactement un (RFC 6902 §4). Les autres en double
       ne violent pas RFC 6902, mais chaque lecteur JSON en retient un
       different (RFC 8259 §4) : le resultat depend du serveur. Refuses aussi,
       sous leur vrai nom : ambigus. */
    if (v.length > 1) echouer(nom === 'op' || nom === 'path' ? 'membreDouble' : 'membreAmbigu', { nom });
    return v[0];
  };
  const chaine = (nom, op) => {
    const v = membre(nom, op);
    if (v.type !== 'chaine') echouer('membreType', { nom });
    return v.valeur;
  };
  const op = chaine('op');
  if (!OPERATIONS.includes(op)) echouer('opInconnue', { op });
  const path = chaine('path', op);
  const operation = { op, path, chemin: lirePointeur(path), from: null, de: null, valeur: null };
  if (op === 'move' || op === 'copy') {
    operation.from = chaine('from', op);
    operation.de = lirePointeur(operation.from);
    if (op === 'move' && prefixeStrict(operation.de, operation.chemin)) echouer('dedans', { de: affiche(operation.de), chemin: affiche(operation.chemin) });
  }
  if (op === 'add' || op === 'replace' || op === 'test') operation.valeur = membre('value', op);
  return operation;
}

/* Une valeur prise dans le patch, ou copiee ailleurs dans le document, est
   copiee avant d etre posee : une operation suivante qui la modifie ne doit
   toucher ni le patch, ni l endroit d ou elle vient. */
function executer(etat, o, ctx) {
  const a = jetons => suivre(etat.racine, jetons, jetons.length, ctx);
  switch (o.op) {
    case 'add': return ajouter(etat, o.chemin, copieDeTravail(o.valeur), ctx);
    case 'remove': return retirerOuRemplacer(etat, o.chemin, undefined, ctx);
    case 'replace': return retirerOuRemplacer(etat, o.chemin, copieDeTravail(o.valeur), ctx);
    case 'move': {
      const valeur = a(o.de);
      if (o.from === o.path) return undefined;
      retirerOuRemplacer(etat, o.de, undefined, ctx);
      return ajouter(etat, o.chemin, valeur, ctx);
    }
    case 'copy': return ajouter(etat, o.chemin, copieDeTravail(a(o.de)), ctx);
    default: {
      if (!egalJson(a(o.chemin), o.valeur, affiche(o.chemin))) echouer('testEchoue', { chemin: affiche(o.chemin) });
      return undefined;
    }
  }
}

/**
 * Applique un JSON Patch (arbre) a un document (arbre), en entier ou pas du
 * tout. Le document recu n est jamais modifie.
 * @returns { ok: true, resultat } ou { ok: false, index, raison }
 */
export function appliquerPatch(document, patch) {
  if (!patch || patch.type !== 'tableau') return { ok: false, index: null, raison: remplir(ERREURS_PATCH.patchPasTableau, {}) };
  const ctx = { index: new WeakMap(), troues: new Set() };
  const etat = { racine: copieDeTravail(document) };
  for (let i = 0; i < patch.elements.length;) {
    try {
      const o = lireOperation(patch.elements[i]);
      const faits = retraitsGroupes(etat, patch.elements, i, o, ctx);
      if (faits) { i += faits; continue; }
      executer(etat, o, ctx);
      i++;
    } catch (e) {
      return { ok: false, index: i, raison: e instanceof RangeError ? remplir(ERREURS_PATCH.profondeur, {}) : e.message };
    }
  }
  for (const objet of ctx.troues) objet.membres = objet.membres.filter(Boolean);
  return { ok: true, resultat: etat.racine };
}

/* Des retraits identiques qui se suivent dans un tableau — « remove /0 » dix
   mille fois, ou le bloc qu un patch produit retire d un coup — sont faits en
   une fois : retirer un element en tete d un grand tableau deplace tous les
   autres, et dix mille fois de suite prenait plus d une seconde et demie.
   Le resultat ne change pas, ni l operation qui echoue si le tableau s epuise
   avant : celle-la, et les suivantes, s executent une a une. Rend le nombre
   d operations faites, 0 s il n y a rien a grouper. */
function retraitsGroupes(etat, elements, i, o, ctx) {
  if (o.op !== 'remove' || !o.chemin.length) return 0;
  let fin = i + 1;
  while (fin < elements.length) {
    let suivante;
    try { suivante = lireOperation(elements[fin]); } catch { break; }
    if (suivante.op !== 'remove' || suivante.path !== o.path) break;
    fin++;
  }
  if (fin - i < 2) return 0;
  const k = o.chemin.length - 1;
  let c;
  try { c = suivre(etat.racine, o.chemin, k, ctx); } catch { return 0; }
  if (c.type !== 'tableau' || !INDEX.test(o.chemin[k])) return 0;
  const place = Number(o.chemin[k]);
  const possibles = Math.min(fin - i, c.elements.length - place);
  if (possibles < 2) return 0;
  c.elements.splice(place, possibles);
  return possibles;
}

/**
 * Ce que dit un JSON Patch, sans document cible : chaque operation lue, ou ce
 * qui la rend invalide ou ambigue. @returns null si ce n est pas un tableau,
 * sinon [{ index, op, path, from, valeur, erreur, ambigu }]
 */
export function decrirePatch(patch) {
  if (!patch || patch.type !== 'tableau') return null;
  return patch.elements.map((noeud, index) => {
    try {
      const o = lireOperation(noeud);
      return { index, op: o.op, path: o.path, from: o.from, valeur: o.valeur, erreur: null, ambigu: false };
    } catch (e) {
      return { index, op: null, path: null, from: null, valeur: null, erreur: e.message, ambigu: e.cle === 'membreAmbigu' };
    }
  });
}

/* ---------------------------------- Egalite ------------------------------ */
/* La valeur exacte d un lexeme numerique : signe, chiffres significatifs,
   exposant. « 1 », « 1.0 », « 10e-1 » et « 0.1e1 » ont la meme. */
export function formeNumerique(brut) {
  const m = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(String(brut));
  if (!m) return String(brut);
  let chiffres = (m[2] + (m[3] || '')).replace(/^0+/, '');
  if (!chiffres) return '0';
  let exposant = BigInt(m[4] || 0) - BigInt((m[3] || '').length);
  const zeros = chiffres.length - chiffres.replace(/0+$/, '').length;
  chiffres = chiffres.slice(0, chiffres.length - zeros);
  exposant += BigInt(zeros);
  return m[1] + chiffres + 'e' + exposant;
}

function carteSansDouble(objet, chemin) {
  const carte = new Map();
  for (const m of objet.membres) {
    if (!m) continue;
    if (carte.has(m.cle)) echouer('comparaisonDouble', { chemin });
    carte.set(m.cle, m.valeur);
  }
  return carte;
}

/**
 * L egalite de RFC 6902 §4.6 : meme type, chaines aux memes points de code,
 * nombres numeriquement egaux, tableaux element par element, objets aux
 * memes membres quel que soit leur ordre.
 */
export function egalJson(a, b, chemin = '""') {
  const pile = [[a, b]];
  while (pile.length) {
    const [x, y] = pile.pop();
    if (x.type !== y.type) return false;
    if (x.type === 'chaine') { if (x.valeur !== y.valeur) return false; }
    else if (x.type === 'nombre') { if (formeNumerique(x.brut) !== formeNumerique(y.brut)) return false; }
    else if (x.type === 'litteral') { if (x.brut !== y.brut) return false; }
    else if (x.type === 'tableau') {
      if (x.elements.length !== y.elements.length) return false;
      for (let i = 0; i < x.elements.length; i++) pile.push([x.elements[i], y.elements[i]]);
    } else {
      const cx = carteSansDouble(x, chemin), cy = carteSansDouble(y, chemin);
      if (cx.size !== cy.size) return false;
      for (const [cle, v] of cx) {
        if (!cy.has(cle)) return false;
        pile.push([v, cy.get(cle)]);
      }
    }
  }
  return true;
}

/* Une ecriture canonique : cles triees, nombres en forme exacte. Deux
   valeurs egales au sens de RFC 6902 ont la meme (sans cles en double). */
export function canonique(racine) {
  const morceaux = [];
  const pile = [racine];
  while (pile.length) {
    const n = pile.pop();
    if (typeof n === 'string') { morceaux.push(n); continue; }
    if (n.type === 'chaine') morceaux.push(JSON.stringify(n.valeur));
    else if (n.type === 'nombre') morceaux.push(formeNumerique(n.brut));
    else if (n.type === 'litteral') morceaux.push(n.brut);
    else {
      const parties = [];
      if (n.type === 'tableau') {
        morceaux.push('[');
        n.elements.forEach((e, i) => { if (i) parties.push(','); parties.push(e); });
        parties.push(']');
      } else {
        morceaux.push('{');
        const tries = n.membres.slice().sort((x, y) => (x.cle < y.cle ? -1 : x.cle > y.cle ? 1 : 0));
        tries.forEach((m, i) => { if (i) parties.push(','); parties.push(JSON.stringify(m.cle) + ':', m.valeur); });
        parties.push('}');
      }
      for (let i = parties.length - 1; i >= 0; i--) pile.push(parties[i]);
    }
  }
  return morceaux.join('');
}

/* ---------------------------- JSON Merge Patch --------------------------- */
const estNull = n => n && n.type === 'litteral' && n.brut === 'null';

function fusion(cible, patch, profondeur) {
  if (profondeur > PROFONDEUR_MAX) echouer('profondeur');
  if (patch.type !== 'objet') return patch;
  if (new Set(patch.membres.map(m => m.cle)).size !== patch.membres.length) echouer('mergeDouble');
  const base = cible && cible.type === 'objet' ? cible : { type: 'objet', membres: [] };
  if (new Set(base.membres.map(m => m.cle)).size !== base.membres.length) echouer('mergeDouble');
  /* Chaque cle se retrouve par une table : chercher dans la liste des
     membres a chaque membre du patch prenait vingt secondes pour cent mille
     cles. Un membre retire laisse un trou, comble a la fin. */
  const membres = base.membres.slice();
  const places = new Map(membres.map((m, i) => [m.cle, i]));
  for (const m of patch.membres) {
    const i = places.has(m.cle) ? places.get(m.cle) : -1;
    if (estNull(m.valeur)) {
      if (i >= 0) { membres[i] = null; places.delete(m.cle); }
      continue;
    }
    const valeur = fusion(i >= 0 ? membres[i].valeur : undefined, m.valeur, profondeur + 1);
    if (i >= 0) membres[i] = { ...membres[i], valeur };
    else {
      places.set(m.cle, membres.length);
      membres.push({ cle: m.cle, brutCle: m.brutCle, valeur });
    }
  }
  return { type: 'objet', membres: membres.filter(Boolean) };
}

/** Applique un JSON Merge Patch. @returns { ok, resultat } ou { ok: false, raison } */
export function appliquerMergePatch(cible, patch) {
  try { return { ok: true, resultat: fusion(cible, patch, 0) }; }
  catch (e) { return { ok: false, raison: e instanceof RangeError ? remplir(ERREURS_PATCH.profondeur, {}) : e.message }; }
}

/**
 * Ce que fait un merge patch, membre par membre : [{ chemin, action, valeur }]
 * — action « retirer » (null), « poser » (une valeur qui remplace), ou
 * « fusionner » (un objet vide : il ne change rien dedans, mais en cree un si
 * la cible n est pas un objet). Un patch qui n est pas un objet remplace tout.
 */
export function decrireMergePatch(patch) {
  if (patch.type !== 'objet') return [{ chemin: '', action: 'remplacer', valeur: patch }];
  const lignes = [];
  const pile = [[patch, []]];
  while (pile.length) {
    const [n, jetons] = pile.pop();
    if (!n.membres.length && jetons.length) { lignes.push({ chemin: ecrirePointeur(jetons), action: 'fusionner', valeur: null }); continue; }
    for (let k = n.membres.length - 1; k >= 0; k--) {
      const m = n.membres[k], ici = [...jetons, m.cle];
      if (estNull(m.valeur)) lignes.push({ chemin: ecrirePointeur(ici), action: 'retirer', valeur: null });
      else if (m.valeur.type === 'objet') pile.push([m.valeur, ici]);
      else lignes.push({ chemin: ecrirePointeur(ici), action: 'poser', valeur: m.valeur });
    }
  }
  return lignes.sort((x, y) => (x.chemin < y.chemin ? -1 : x.chemin > y.chemin ? 1 : 0));
}

/* -------------------------- Produire un patch ---------------------------- */
const sansDouble = objet => new Set(objet.membres.map(m => m.cle)).size === objet.membres.length;

/**
 * Le JSON Patch qui mene de `a` a `b` (deux arbres) : les membres retires,
 * ajoutes et changes ; les tableaux alignes par le moteur de comparaison
 * (lib/diff.js), un element change etant compare a son tour. Rend
 * [{ op, path, value? }] — `value` est un arbre. Sur une imbrication que la
 * pile d appels ne tiendrait pas, le patch remplace tout le document : il
 * reste juste, simplement moins fin.
 */
export function produirePatch(a, b) {
  try { return produire(a, b, 0); }
  catch (e) {
    if (e instanceof RangeError) return [{ op: 'replace', path: '', value: b }];
    throw e;
  }
}

function produire(a, b, depart) {
  const ops = [];
  const pile = [[a, b, [], depart]];
  while (pile.length) {
    const [x, y, jetons, profondeur] = pile.pop();
    if (canonique(x) === canonique(y) && (x.type !== 'objet' || (sansDouble(x) && sansDouble(y)))) continue;
    const ici = ecrirePointeur(jetons);
    if (profondeur > PROFONDEUR_MAX) { ops.push({ op: 'replace', path: ici, value: y }); continue; }
    if (x.type === 'objet' && y.type === 'objet' && sansDouble(x) && sansDouble(y)) {
      const cx = new Map(x.membres.map(m => [m.cle, m.valeur])), cy = new Map(y.membres.map(m => [m.cle, m.valeur]));
      const suite = [];
      for (const cle of cx.keys()) if (!cy.has(cle)) ops.push({ op: 'remove', path: ecrirePointeur([...jetons, cle]) });
      for (const [cle, v] of cy) {
        if (!cx.has(cle)) ops.push({ op: 'add', path: ecrirePointeur([...jetons, cle]), value: v });
        else suite.push([cx.get(cle), v, [...jetons, cle], profondeur + 1]);
      }
      /* Les membres a comparer de plus pres se traitent dans l ordre : la pile
         les reprend du dernier au premier. */
      for (let k = suite.length - 1; k >= 0; k--) pile.push(suite[k]);
      continue;
    }
    if (x.type === 'tableau' && y.type === 'tableau') {
      /* Les operations d un tableau dependent de l index courant : elles sont
         produites ici, d un trait, et les elements a comparer de plus pres
         passent par une sous-production. */
      for (const op of patchTableau(x, y, jetons, profondeur)) ops.push(op);
      continue;
    }
    ops.push({ op: 'replace', path: ici, value: y });
  }
  return ops;
}

function patchTableau(x, y, jetons, profondeur) {
  const ops = [];
  const { operations } = comparerLignes(x.elements.map(canonique), y.elements.map(canonique));
  let index = 0, k = 0;
  while (k < operations.length) {
    if (operations[k].type === 'egal') { index++; k++; continue; }
    const retraits = [], ajouts = [];
    while (k < operations.length && operations[k].type === 'retrait') retraits.push(operations[k++]);
    while (k < operations.length && operations[k].type === 'ajout') ajouts.push(operations[k++]);
    const paires = Math.min(retraits.length, ajouts.length);
    for (let p = 0; p < paires; p++) {
      /* Un element remplace par un autre : compare de plus pres, comme un
         membre d objet ; ses operations s ecrivent a cet index. */
      for (const op of produirePatchA(x.elements[retraits[p].gauche - 1], y.elements[ajouts[p].droite - 1], [...jetons, String(index)], profondeur + 1)) ops.push(op);
      index++;
    }
    for (let p = paires; p < retraits.length; p++) ops.push({ op: 'remove', path: ecrirePointeur([...jetons, String(index)]) });
    for (let p = paires; p < ajouts.length; p++) {
      ops.push({ op: 'add', path: ecrirePointeur([...jetons, String(index)]), value: y.elements[ajouts[p].droite - 1] });
      index++;
    }
  }
  return ops;
}

/* La production d un sous-arbre, a un chemin donne. */
function produirePatchA(a, b, jetons, profondeur) {
  if (profondeur > PROFONDEUR_MAX) return [{ op: 'replace', path: ecrirePointeur(jetons), value: b }];
  const ops = produire(a, b, profondeur);
  const prefixe = ecrirePointeur(jetons);
  return ops.map(o => ({ ...o, path: prefixe + o.path }));
}

/**
 * Le merge patch qui mene de `a` a `b`, ou une erreur si b porte un null
 * qu un merge patch ne sait pas poser (RFC 7396 §1).
 * @returns { ok: true, patch } ou { ok: false, raison }
 */
export function produireMergePatch(a, b) {
  try { return { ok: true, patch: mergePatchDe(a, b, [], 0) }; }
  catch (e) { return { ok: false, raison: e.message }; }
}

function mergePatchDe(a, b, jetons, profondeur) {
  if (profondeur > PROFONDEUR_MAX) echouer('profondeur');
  if (b.type !== 'objet') return b;
  if (!sansDouble(b) || (a && a.type === 'objet' && !sansDouble(a))) echouer('mergeDouble');
  const ca = a && a.type === 'objet' ? new Map(a.membres.map(m => [m.cle, m.valeur])) : null;
  const membres = [];
  const clesB = new Set(b.membres.map(m => m.cle));
  if (ca) for (const cle of ca.keys()) if (!clesB.has(cle)) membres.push({ cle, brutCle: JSON.stringify(cle), valeur: { type: 'litteral', brut: 'null' } });
  for (const m of b.membres) {
    const ici = [...jetons, m.cle];
    if (estNull(m.valeur)) {
      /* null voulu dans le resultat : un merge patch ne sait que retirer. */
      if (!ca || !ca.has(m.cle) || !estNull(ca.get(m.cle))) echouer('inexprimable', { chemin: ecrirePointeur(ici) });
      continue;
    }
    if (ca && ca.has(m.cle)) {
      const avant = ca.get(m.cle);
      if (canonique(avant) === canonique(m.valeur)) continue;
      membres.push({ cle: m.cle, brutCle: m.brutCle, valeur: mergePatchDe(avant, m.valeur, ici, profondeur + 1) });
    } else membres.push({ cle: m.cle, brutCle: m.brutCle, valeur: mergePatchDe(undefined, m.valeur, ici, profondeur + 1) });
  }
  return { type: 'objet', membres };
}

/** Les operations produites, en arbre JSON : pret a ecrire avec ecrireJsonExact. */
export function patchEnArbre(ops) {
  const chaine = s => ({ type: 'chaine', valeur: s, brut: JSON.stringify(s) });
  return {
    type: 'tableau',
    elements: ops.map(o => ({
      type: 'objet',
      membres: [
        { cle: 'op', brutCle: '"op"', valeur: chaine(o.op) },
        ...(o.from !== undefined && o.from !== null ? [{ cle: 'from', brutCle: '"from"', valeur: chaine(o.from) }] : []),
        { cle: 'path', brutCle: '"path"', valeur: chaine(o.path) },
        ...(o.value ? [{ cle: 'value', brutCle: '"value"', valeur: o.value }] : [])
      ]
    }))
  };
}
