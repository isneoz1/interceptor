/* Comparaisons et donnees exactes — SWIFT (by NeoZ)
 *
 *   node tests/comparaison.test.mjs
 *
 * Ce que la 5.5 a repris dans ce qui existait, verifie contre des references
 * independantes :
 *
 *   1. le moteur de comparaison (Myers) : la liste de changements la plus
 *      courte, comparee a la plus longue sous-suite commune calculee par
 *      programmation dynamique, sur deux mille cas tires au hasard ; exact sur
 *      deux cent mille lignes ;
 *   2. le format unifie : onze cas recopies de GNU diffutils 3.12, et mille
 *      correctifs reappliques ligne a ligne ;
 *   3. la vue Comparaison : en-tetes repetes, fins de ligne, ecarts inconnus,
 *      texte copie entier ;
 *   4. le JSON sans perte, confronte a JSON.parse et JSON.stringify ;
 *   5. les transformations JSON et web de la boite a outils ;
 *   6. les controles d un corps JSON : entiers arrondis, cles en double ;
 *   7. CBOR et MessagePack : vecteurs des bibliotheques Python de reference,
 *      les exemples de l annexe A de RFC 8949, les suites mal formees de son
 *      annexe F.1 ;
 *   8. l arbre JSON, les longs textes et la Synthese : rien n est coupe ;
 *   9. une garde : aucune vue ne coupe un texte ou une liste en silence.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, verifier, leve, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
installerPage(racine);

const { config } = await import('../background/core/config.js');
await config.ready;
const { comparerTextes, comparerLignes, comparerMots, diffUnifie } = await import('../ui/lib/diff.js');
const J = await import('../ui/lib/json-exact.js');
const cf = await import('../ui/lib/codecs-format.js');
const cw = await import('../ui/lib/codecs-web.js');
const { pretty } = await import('../ui/lib/format.js');
const { controlerJson, FAITS_CORPS } = await import('../ui/lib/corps-controles.js');
const { controlesCorps } = await import('../ui/console/corps-detail.js');
const { decoderCbor, decoderMsgpack, cborVersJson, msgpackVersJson } = await import('../ui/lib/binaires.js');
const { hexVersOctets } = await import('../ui/lib/bytes.js');
const { jsonTree } = await import('../ui/lib/arbre-json.js');
const { texteLong } = await import('../ui/lib/texte-long.js');
const vue = await import('../ui/console/compare.js');
const { setLang } = await import('../ui/lib/i18n.js');

let graine = 20261012;
const hasard = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const choisir = liste => liste[Math.floor(hasard() * liste.length)];
const texte = n => (n.textContent || '') + (n.children || []).map(texte).join(' ');
const h = s => hexVersOctets(s);

/* Les ecouteurs du DOM du harnais ne font rien : pour cliquer ou deplier, le
   test les retient lui-meme le temps d un bloc. */
function avecEcouteurs(fn) {
  const proto = Object.getPrototypeOf(document.createElement('div'));
  const avant = proto.addEventListener;
  proto.addEventListener = function (type, rappel) { (this._ecouteurs ||= {})[type] = rappel; };
  try { return fn(); } finally { proto.addEventListener = avant; }
}
const cherche = (n, pred) => (pred(n) ? n : (n.children || []).map(c => cherche(c, pred)).find(Boolean) || null);

/* ================ 1. Le moteur de comparaison (Myers 1986) =============== */
/* La reference : la plus longue sous-suite commune, par programmation
   dynamique — le moteur ne doit en garder ni plus ni moins. */
function plsc(a, b) {
  const t = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) t[i][j] = a[i] === b[j] ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  }
  return t[0][0];
}
{
  let valides = 0, minimaux = 0, ordonnes = 0;
  for (let k = 0; k < 2000; k++) {
    const a = Array.from({ length: Math.floor(hasard() * 30) }, () => choisir(['a', 'b', 'c', 'd', 'e', '']));
    const b = Array.from({ length: Math.floor(hasard() * 30) }, () => choisir(['a', 'b', 'c', 'd', 'e', '']));
    const { operations, minimal } = comparerLignes(a, b);
    const gauche = operations.filter(o => o.type !== 'ajout');
    const droite = operations.filter(o => o.type !== 'retrait');
    if (gauche.map(o => o.texte).join('\n') === a.join('\n') && gauche.length === a.length
      && droite.map(o => o.texte).join('\n') === b.join('\n') && droite.length === b.length
      && gauche.every((o, i) => o.gauche === i + 1) && droite.every((o, i) => o.droite === i + 1)) valides++;
    if (minimal && operations.filter(o => o.type === 'egal').length === plsc(a, b)) minimaux++;
    /* Dans chaque bloc de changements, les retraits viennent avant les ajouts. */
    if (!operations.some((o, i) => o.type === 'ajout' && operations[i + 1] && operations[i + 1].type === 'retrait')) ordonnes++;
  }
  egal('2000 comparaisons au hasard : chaque ligne figure une fois, a sa place', valides, 2000);
  egal('2000 comparaisons au hasard : la liste de changements est la plus courte', minimaux, 2000);
  egal('2000 comparaisons au hasard : les retraits precedent les ajouts dans un bloc', ordonnes, 2000);
}
{
  const a = Array.from({ length: 200000 }, (_, i) => 'ligne ' + i);
  const b = a.slice();
  for (let k = 0; k < 50; k++) b[(k * 3989) % b.length] = 'change ' + k;
  const debut = Date.now();
  const r = comparerTextes(a.join('\n'), b.join('\n'));
  const duree = Date.now() - debut;
  verifier('deux cent mille lignes, cinquante changements : exact et le plus court', r.minimal && r.ajouts === 50 && r.retraits === 50);
  verifier('deux cent mille lignes : en moins de trois secondes (la table d avant s arretait a 4000)', duree < 3000, duree + ' ms');

  const x = Array.from({ length: 20000 }, (_, i) => 'a' + i), y = Array.from({ length: 20000 }, (_, i) => 'b' + i);
  const sansRapport = comparerTextes(x.join('\n'), y.join('\n'));
  verifier('vingt mille lignes sans rien en commun : tout retirer puis tout ajouter, et c est bien le plus court',
    sansRapport.minimal && sansRapport.retraits === 20000 && sansRapport.ajouts === 20000);
}
{
  /* Un budget epuise : le resultat reste exact, et dit qu il n est pas le plus court. */
  const a = Array.from({ length: 300 }, () => choisir(['a', 'b', 'c'])), b = Array.from({ length: 300 }, () => choisir(['a', 'b', 'c']));
  const { operations, minimal } = comparerLignes(a, b, 10);
  egal('budget epuise : le resultat le dit', minimal, false);
  verifier('budget epuise : chaque ligne figure encore une fois',
    operations.filter(o => o.type !== 'ajout').map(o => o.texte).join() === a.join()
    && operations.filter(o => o.type !== 'retrait').map(o => o.texte).join() === b.join());
}
{
  /* Le chemin des ancres : un budget minuscule, des textes qui ont des lignes
     uniques et des lignes repetees. Le resultat doit rester exact. */
  let valides = 0;
  for (let k = 0; k < 500; k++) {
    const jeton = () => (hasard() < 0.5 ? 'u' + Math.floor(hasard() * 1000) : choisir(['{', '}', '', 'x']));
    const a = Array.from({ length: Math.floor(hasard() * 60) }, jeton);
    const b = hasard() < 0.5 ? a.map(l => (hasard() < 0.2 ? jeton() : l)) : Array.from({ length: Math.floor(hasard() * 60) }, jeton);
    const { operations } = comparerLignes(a, b, 5);
    const gauche = operations.filter(o => o.type !== 'ajout'), droite = operations.filter(o => o.type !== 'retrait');
    if (gauche.map(o => o.texte).join('\n') === a.join('\n') && gauche.length === a.length && gauche.every((o, i) => o.gauche === i + 1)
      && droite.map(o => o.texte).join('\n') === b.join('\n') && droite.length === b.length && droite.every((o, i) => o.droite === i + 1)) valides++;
  }
  egal('ancrage sur les lignes uniques, budget epuise : cinq cents comparaisons exactes', valides, 500);
}
{
  /* La regression : l ancienne vue passait au-dela de 1200 lignes a une
     difference d ensembles, et un element retire d un JSON repetitif, dont
     chaque ligne existe ailleurs, disparaissait. */
  const element = '  {\n    "a": 1\n  }';
  const avant = '[\n' + Array.from({ length: 1500 }, () => element).join(',\n') + '\n]';
  const apres = '[\n' + Array.from({ length: 1499 }, () => element).join(',\n') + '\n]';
  const r = comparerTextes(avant, apres);
  egal('JSON repetitif, un element retire : ses trois lignes sont montrees', r.retraits + ' / ' + r.ajouts, '3 / 0');
  const mots = comparerMots(Array.from({ length: 20000 }, (_, i) => 'mot' + i).join(' '),
    Array.from({ length: 20000 }, (_, i) => (i === 777 ? 'autre' : 'mot' + i)).join(' '));
  egal('mot a mot sur vingt mille mots (la limite etait de 4000) : un mot change',
    mots.filter(m => m.type === 'retrait').map(m => m.texte).join() + ' -> ' + mots.filter(m => m.type === 'ajout').map(m => m.texte).join(), 'mot777 -> autre');
}

/* ========================= 2. Le format unifie ========================== */
/* Recopies de « diff -u --label gauche --label droite » (GNU diffutils 3.12). */
const GNU = {
  'remplacement': ['a\nb\nc\n', 'a\nx\nc\n', '--- gauche\n+++ droite\n@@ -1,3 +1,3 @@\n a\n-b\n+x\n c\n'],
  'ajout en tete': ['b\nc\n', 'a\nb\nc\n', '--- gauche\n+++ droite\n@@ -1,2 +1,3 @@\n+a\n b\n c\n'],
  'retrait en fin': ['a\nb\nc\n', 'a\nb\n', '--- gauche\n+++ droite\n@@ -1,3 +1,2 @@\n a\n b\n-c\n'],
  'sans saut final des deux cotes': ['a\nb', 'a\nc', '--- gauche\n+++ droite\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+c\n\\ No newline at end of file\n'],
  'saut final ajoute': ['a\nb', 'a\nb\n', '--- gauche\n+++ droite\n@@ -1,2 +1,2 @@\n a\n-b\n\\ No newline at end of file\n+b\n'],
  'deux blocs separes': ['1\n2\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\n14\n15\n', '1\nX\n3\n4\n5\n6\n7\n8\n9\n10\n11\n12\n13\nY\n15\n',
    '--- gauche\n+++ droite\n@@ -1,5 +1,5 @@\n 1\n-2\n+X\n 3\n 4\n 5\n@@ -11,5 +11,5 @@\n 11\n 12\n 13\n-14\n+Y\n 15\n'],
  'sept lignes egales entre deux changements : deux blocs': ['1\n2\n3\n4\n5\n6\n7\n8\n9\n', 'X\n2\n3\n4\n5\n6\n7\n8\nY\n',
    '--- gauche\n+++ droite\n@@ -1,4 +1,4 @@\n-1\n+X\n 2\n 3\n 4\n@@ -6,4 +6,4 @@\n 6\n 7\n 8\n-9\n+Y\n'],
  'six lignes egales entre deux changements : un seul bloc': ['1\n2\n3\n4\n5\n6\n7\n8\n', 'X\n2\n3\n4\n5\n6\n7\nY\n',
    '--- gauche\n+++ droite\n@@ -1,8 +1,8 @@\n-1\n+X\n 2\n 3\n 4\n 5\n 6\n 7\n-8\n+Y\n'],
  'vide vers texte': ['', 'a\nb\n', '--- gauche\n+++ droite\n@@ -0,0 +1,2 @@\n+a\n+b\n'],
  'texte vers vide': ['a\nb\n', '', '--- gauche\n+++ droite\n@@ -1,2 +0,0 @@\n-a\n-b\n'],
  'un CR reste dans sa ligne': ['a\r\nb\r\n', 'a\nb\n', '--- gauche\n+++ droite\n@@ -1,2 +1,2 @@\n-a\r\n-b\r\n+a\n+b\n']
};
for (const [nom, [a, b, attendu]] of Object.entries(GNU)) egal('format unifie, comme GNU diff : ' + nom, diffUnifie(a, b, 'gauche', 'droite'), attendu);
egal('format unifie : deux textes identiques ne donnent aucun correctif', diffUnifie('a\nb\n', 'a\nb\n'), '');
{
  /* Vingt mille blocs : les numeros de ligne se comptent au fil des blocs ;
     recomptes depuis le debut a chaque bloc, il fallait plusieurs secondes. */
  const a = Array.from({ length: 200000 }, (_, i) => 'l' + i), b = a.slice();
  for (let k = 0; k < 20000; k++) b[k * 10] = 'x' + k;
  const debut = Date.now();
  const correctif = diffUnifie(a.join('\n') + '\n', b.join('\n') + '\n');
  const duree = Date.now() - debut;
  verifier('format unifie, deux cent mille lignes et vingt mille blocs : en moins de cinq secondes', duree < 5000, duree + ' ms');
  /* GNU diffutils 3.12 donne, sur ces deux textes, vingt mille blocs dont le
     dernier commence ainsi. Le budget de recherche est epuise ici : c est
     l ancrage sur les lignes uniques qui retrouve chaque bloc. */
  const entetes = correctif.split('\n').filter(l => l.startsWith('@@'));
  egal('vingt mille blocs, comme GNU diff', entetes.length, 20000);
  egal('le dernier au meme numero de ligne que GNU diff', entetes.pop(), '@@ -199988,7 +199988,7 @@');
}

/* Un correctif reapplique a la main doit redonner le second texte, octet pour
   octet — le meme controle que « patch » (fait localement avec GNU patch
   2.7.6 sur six cents cas : tous appliques a l identique). */
function lignesExactes(s) {
  if (!s) return { lignes: [], sansFinale: false };
  const l = s.split('\n');
  if (l[l.length - 1] === '') { l.pop(); return { lignes: l, sansFinale: false }; }
  return { lignes: l, sansFinale: true };
}
function appliquer(source, correctif) {
  if (!correctif) return source;
  const A = lignesExactes(source);
  const sortie = [];                                    // [texte, sansSaut]
  let ia = 0;
  const corps = correctif.split('\n');
  corps.pop();
  let k = 2;
  while (k < corps.length) {
    const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@$/.exec(corps[k++]);
    if (!m) throw new Error('en-tete de bloc illisible');
    const debut = m[2] === '0' ? Number(m[1]) : Number(m[1]) - 1;
    while (ia < debut) sortie.push([A.lignes[ia], A.sansFinale && ia === A.lignes.length - 1, ia++][0] !== undefined
      ? [A.lignes[ia - 1], A.sansFinale && ia - 1 === A.lignes.length - 1] : null);
    let derniere = null;
    while (k < corps.length && !corps[k].startsWith('@@')) {
      const l = corps[k++];
      if (l.startsWith('\\')) { if (derniere) derniere[1] = true; continue; }
      if (l[0] === ' ') { if (A.lignes[ia] !== l.slice(1)) throw new Error('contexte different'); derniere = [A.lignes[ia++], false]; sortie.push(derniere); }
      else if (l[0] === '-') { if (A.lignes[ia] !== l.slice(1)) throw new Error('retrait different'); ia++; derniere = null; }
      else if (l[0] === '+') { derniere = [l.slice(1), false]; sortie.push(derniere); }
    }
  }
  while (ia < A.lignes.length) { sortie.push([A.lignes[ia], A.sansFinale && ia === A.lignes.length - 1]); ia++; }
  const propres = sortie.filter(Boolean);
  return propres.map(([l, sans], i) => l + (i === propres.length - 1 && sans ? '' : '\n')).join('');
}
{
  const ALPHABET = ['a', 'b', 'c', '', 'x\r', '{', '}'];
  const auHasard = () => {
    const n = Math.floor(hasard() * 20);
    if (!n) return hasard() < 0.5 ? '' : '\n';
    return Array.from({ length: n }, () => choisir(ALPHABET)).join('\n') + (hasard() < 0.75 ? '\n' : '');
  };
  let reussis = 0;
  for (let k = 0; k < 1000; k++) {
    const a = auHasard(), b = auHasard();
    try { if (appliquer(a, diffUnifie(a, b)) === b) reussis++; } catch { /* compte comme echec */ }
  }
  egal('mille correctifs reappliques redonnent le second texte, octet pour octet', reussis, 1000);
}

/* ========================= 3. La vue Comparaison ======================== */
{
  const ent = vue.comparerEntetes(
    [{ name: 'Set-Cookie', value: 'a=1' }, { name: 'Set-Cookie', value: 'b=2' }, { name: 'X', value: '1' }],
    [{ name: 'set-cookie', value: 'b=2' }, { name: 'X', value: '1' }]);
  egal('Set-Cookie repete : chaque valeur garde sa ligne (RFC 9110 §5.3)',
    ent.lignes.filter(l => l.key === 'set-cookie').map(l => l.kind + ' ' + l.value).join(' | '), 'del a=1 | same b=2');
  egal('en-tetes : un nom differe sur deux', ent.differents + ' / ' + ent.noms, '1 / 2');

  egal('corps identiques', vue.comparerCorps('{"a":1}', '{"a":1}', 'application/json').identiques, true);
  const fins = vue.comparerCorps('a\r\nb', 'a\nb', 'text/plain');
  verifier('corps qui ne different que par CRLF : ni identiques, ni confondus', !fins.identiques && fins.finsDeLigne && fins.changees > 0);
  const fond = vue.comparerCorps('{"a":1,"b":[1,2]}', '{ "a" : 1, "b" : [ 1, 2 ] }', 'application/json');
  verifier('JSON qui ne differe que par ses espaces : dit, sans se pretendre identique', fond.memeFond && !fond.identiques && fond.changees === 0);
  /* JSON.parse lit 1234567890123456789 et 1234567890123456788 comme le meme
     double : l ancienne mise en forme montrait deux corps « identiques ». */
  const ids = vue.comparerCorps('{"id":1234567890123456789}', '{"id":1234567890123456788}', 'application/json');
  verifier('deux identifiants qui ne different qu au-dela de 2^53 : la difference est montree',
    ids.changees === 2 && ids.lignes.some(l => l.kind === 'add' && l.line.includes('1234567890123456788')));

  egal('ecart entre deux durees connues', vue.ecart(10, 4), 6);
  egal('ecart avec une duree inconnue : pas un chiffre invente', vue.ecart(null, 5), null);
  egal('ecart avec une valeur non finie', vue.ecart(5, NaN), null);

  /* La vue elle-meme, rendue avec deux requetes chargees comme dans la
     console : le noyau repond a la commande « record ». */
  {
    const { state, B } = await import('../ui/app.js');
    const enregistrements = {
      11: { id: 11, method: 'GET', url: 'https://exemple.test/a?x=1', statusCode: 200, duration: 120, size: 10, mime: 'application/json',
        requestHeaders: [], responseHeaders: [{ name: 'Set-Cookie', value: 'a=1' }, { name: 'Set-Cookie', value: 'b=2' }],
        responseBody: { text: '{"id":1234567890123456789}' } },
      12: { id: 12, method: 'GET', url: 'https://exemple.test/a?x=2', statusCode: 200, duration: null, size: 10, mime: 'application/json',
        requestHeaders: [], responseHeaders: [{ name: 'Set-Cookie', value: 'b=2' }],
        responseBody: { text: '{"id":1234567890123456788}' } }
    };
    const runtime = B.runtime;
    const avant = runtime.sendMessage;
    runtime.sendMessage = async m => (m && m.cmd === 'record' ? { record: enregistrements[m.args.id] } : (avant ? avant(m) : {}));
    try {
      state.selection = new Set([11, 12]);
      for (const langue of ['fr', 'en']) {
        setLang(langue);
        await vue.loadSelection();
        const vu = texte(document.getElementById('view-compare'));
        verifier('vue Comparaison [' + langue + '] : les deux URL entieres', vu.includes('https://exemple.test/a?x=1') && vu.includes('https://exemple.test/a?x=2'));
        verifier('vue Comparaison [' + langue + '] : la duree inconnue n est pas un ecart chiffre',
          vu.includes(langue === 'en' ? 'unknown on one side' : 'inconnue d un cote'));
        verifier('vue Comparaison [' + langue + '] : les deux identifiants, avec leurs chiffres', vu.includes('1234567890123456789') && vu.includes('1234567890123456788'));
        verifier('vue Comparaison [' + langue + '] : Set-Cookie retire, ligne a ligne', vu.includes('set-cookie' + (langue === 'en' ? ':' : ' :') + ' a=1'));
        if (langue === 'en') verifier('vue Comparaison [en] : Left et Right traduits', vu.includes('Left · #11') && vu.includes('Right · #12') && !vu.includes('Gauche'));
      }
    } finally {
      setLang('fr');
      runtime.sendMessage = avant;
      state.selection = new Set();
    }
  }

  const corpsA = Array.from({ length: 2000 }, (_, i) => 'ligne ' + i).join('\n');
  const corpsB = Array.from({ length: 2000 }, (_, i) => 'autre ' + i).join('\n');
  const rec = (id, txt) => ({ id, method: 'GET', url: 'https://exemple.test/' + id, mime: 'text/plain',
    responseHeaders: [], requestHeaders: [], responseBody: { text: txt } });
  const copie = vue.texteComparaison(rec(1, corpsA), rec(2, corpsB));
  egal('le texte copie porte toutes les lignes changees (il s arretait a 500)',
    copie.split('\n').filter(l => /^[+−] (ligne|autre) /.test(l)).length, 4000);
}

/* ========================== 4. Le JSON sans perte ======================== */
/* Un arbre dont chaque lexeme est celui que JSON.stringify ecrirait. */
function canonique(noeud) {
  const pile = [noeud];
  while (pile.length) {
    const n = pile.pop();
    if (n.type === 'nombre' && JSON.stringify(Number(n.brut)) !== n.brut) return false;
    if (n.type === 'chaine' && JSON.stringify(n.valeur) !== n.brut) return false;
    if (n.type === 'objet') for (const m of n.membres) { if (JSON.stringify(m.cle) !== m.brutCle) return false; pile.push(m.valeur); }
    if (n.type === 'tableau') pile.push(...n.elements);
  }
  return true;
}
{
  const ESP = ['', ' ', '\n', '\t'];
  const NOMBRES = ['0', '-0', '1', '-1', '12', '1.5', '-0.25', '1e3', '1E-2', '2.5e+10', '01', '-', '1.', '.5', '+1', 'NaN', '1e400'];
  const CHAINES = ['""', '"a"', '"\\n"', '"\\u00e9"', '"\\ud83d\\ude00"', '"\\/"', '"\\x"', '"\\u12"', '"a\tb"', '"é"', '"__proto__"'];
  const valeur = p => {
    const r = hasard();
    if (p > 3 || r < 0.45) return choisir([...NOMBRES, ...CHAINES, 'true', 'false', 'null', 'tru']);
    const n = Math.floor(hasard() * 4);
    if (r < 0.7) return '[' + Array.from({ length: n }, () => valeur(p + 1)).join(choisir(ESP) + ',') + ']';
    return '{' + Array.from({ length: n }, () => choisir(CHAINES) + ':' + choisir(ESP) + valeur(p + 1)).join(',') + '}';
  };
  let memeAcceptation = 0, memeValeur = 0, acceptes = 0, memeForme = 0, canoniques = 0;
  for (let k = 0; k < 20000; k++) {
    let t = choisir(ESP) + valeur(0) + choisir(ESP);
    if (hasard() < 0.3) { const i = Math.floor(hasard() * t.length); t = t.slice(0, i) + choisir([',', ']', '"', '\\', '\u0001', '']) + t.slice(i + 1); }
    let attendu, refuse = false, arbre, refuseIci = false;
    try { attendu = JSON.parse(t); } catch { refuse = true; }
    try { arbre = J.lireJsonExact(t); } catch (e) { refuseIci = e instanceof SyntaxError ? true : 'autre'; }
    if (refuse === refuseIci) memeAcceptation++;
    if (refuse || refuseIci) continue;
    acceptes++;
    if (JSON.stringify(J.versValeur(arbre)) === JSON.stringify(attendu)) memeValeur++;
    /* Canonique : chaque nombre et chaque chaine deja ecrits comme
       JSON.stringify les ecrirait, et aucune cle jumelle — JSON.parse en perd
       une, ce module les garde. */
    if (canonique(arbre) && !J.clesEnDouble(arbre).length) {
      canoniques++;
      if (J.ecrireJsonExact(arbre, '  ') === JSON.stringify(attendu, null, 2) && J.ecrireJsonExact(arbre, '') === JSON.stringify(attendu)) memeForme++;
    }
  }
  egal('vingt mille textes : accepte ou refuse exactement comme JSON.parse', memeAcceptation, 20000);
  egal('textes acceptes : la meme valeur que JSON.parse', memeValeur, acceptes);
  egal('ecriture deja canonique : la mise en forme est celle de JSON.stringify, octet pour octet', memeForme, canoniques);
}
{
  egal('un entier au-dela de 2^53 garde ses chiffres', J.jsonExactJoli('{"id":1234567890123456789}', ''), '{"id":1234567890123456789}');
  egal('JSON.parse, lui, l arrondit (la raison de ce module)', JSON.stringify(JSON.parse('{"id":1234567890123456789}')), '{"id":1234567890123456800}');
  egal('un echappement reste ecrit tel quel', J.jsonExactJoli('["\\u00e9","\\/"]', ''), '["\\u00e9","\\/"]');
  egal('les cles jumelles restent deux', J.jsonExactJoli('{"a":1,"a":2}', ''), '{"a":1,"a":2}');
  const proto = J.lireJson('{"__proto__":{"x":1}}');
  verifier('une cle « __proto__ » reste une cle, sans toucher au prototype',
    Object.keys(proto).join() === '__proto__' && Object.getPrototypeOf(proto) === Object.prototype && proto.x === undefined);
  const deux64 = J.lireJson('[18446744073709551616, 9007199254740991]');
  verifier('2^64 : un NombreExact, qui garde ses chiffres (un double l ecrirait 18446744073709552000)',
    deux64[0] instanceof J.NombreExact && String(deux64[0]) === '18446744073709551616' && deux64[1] === 9007199254740991);
  egal('entier perdu : 9007199254740993 change de valeur', J.entierPerdu('9007199254740993'), true);
  egal('entier garde : 9007199254740992 est exact', J.entierPerdu('9007199254740992'), false);
  egal('2^64 est exact, meme hors de la plage sure', J.entierPerdu('18446744073709551616'), false);
  egal('un decimal n est pas compte', J.entierPerdu('1.5'), false);
  egal('entiers perdus, avec leur chemin JSONPath et ce que JavaScript en lit',
    JSON.stringify(J.nombresPerdus(J.lireJsonExact('{"a":[1,9007199254740993],"b c":{"d":12345678901234567891}}'))),
    '[{"chemin":"$.a[1]","brut":"9007199254740993","lu":"9007199254740992"},{"chemin":"$[\'b c\'].d","brut":"12345678901234567891","lu":"12345678901234567000"}]');
  egal('cles en double, avec leur objet', JSON.stringify(J.clesEnDouble(J.lireJsonExact('{"a":1,"a":2,"b":{"c":1,"c":2}}'))),
    '[{"chemin":"$","cle":"a"},{"chemin":"$.b","cle":"c"}]');
  const profond = '['.repeat(200000) + ']'.repeat(200000);
  egal('deux cent mille niveaux d imbrication : lus et reecrits sans epuiser la pile', J.jsonExactJoli(profond, ''), profond);
  leve('un JSON invalide leve une SyntaxError', () => J.lireJsonExact('{"a":}'));
  /* RFC 9535 §2.7 : chemins normalises. */
  egal('segment simple', J.segmentJson('nom'), '.nom');
  egal('segment avec un point', J.segmentJson('a.b'), "['a.b']");
  egal('segment avec une apostrophe', J.segmentJson("l'a"), "['l\\'a']");
  egal('segment avec un caractere de controle', J.segmentJson('\u000b'), "['\\u000b']");
  egal('cles triees, jumelles comprises', J.ecrireJsonExact(J.trierClesJson(J.lireJsonExact('{"b":1,"a":2,"a":3}')), ''), '{"a":2,"a":3,"b":1}');
}
{
  /* ecrireValeurJson face a JSON.stringify, sur des valeurs ordinaires. */
  const feuilles = [0, -0, 1.5, -2, NaN, Infinity, 'a', 'é\n"', '', true, false, null, undefined, () => 1, new Date(0)];
  const valeurJs = p => {
    if (p > 3 || hasard() < 0.4) return choisir(feuilles);
    if (hasard() < 0.5) return Array.from({ length: Math.floor(hasard() * 4) }, () => valeurJs(p + 1));
    const o = {};
    for (let i = 0; i < Math.floor(hasard() * 4); i++) o[choisir(['a', 'b', 'c', '1', 'é'])] = valeurJs(p + 1);
    return o;
  };
  let pareil = 0;
  for (let k = 0; k < 3000; k++) {
    const v = valeurJs(0);
    if (v === undefined || typeof v === 'function') { pareil++; continue; }
    if (J.ecrireValeurJson(v, '  ') === JSON.stringify(v, null, 2) && J.ecrireValeurJson(v, '') === JSON.stringify(v)) pareil++;
  }
  egal('trois mille valeurs ordinaires : ecrites comme JSON.stringify', pareil, 3000);
  egal('un NombreExact et un BigInt s ecrivent sans guillemets ni arrondi',
    J.ecrireValeurJson([new J.NombreExact('18446744073709551615'), 2n ** 70n], ''), '[18446744073709551615,1180591620717411303424]');
  const boucle = { a: 1 };
  boucle.moi = boucle;
  leve('une structure circulaire est refusee, comme par JSON.stringify', () => J.ecrireValeurJson(boucle));
  const partage = { x: 1 };
  egal('un objet atteint par deux branches s ecrit deux fois', J.ecrireValeurJson({ a: partage, b: partage }, ''), '{"a":{"x":1},"b":{"x":1}}');
}

/* ===================== 5. Les transformations de la boite ================ */
{
  egal('JSON — mettre en forme : un grand entier intact', cf.jsonJoli('[1234567890123456789]'), '[\n  1234567890123456789\n]');
  egal('JSON — compacter', cf.jsonCompact('{ "a" : [ 1 , 2 ] }'), '{"a":[1,2]}');
  egal('JSON — trier les cles : « __proto__ » et les jumelles gardes',
    cf.jsonTrie('{"b":1,"__proto__":2,"a":3,"a":4}'), '{\n  "__proto__": 2,\n  "a": 3,\n  "a": 4,\n  "b": 1\n}');
  egal('JSON — un chemin par ligne : notation sans ambiguite', cf.jsonAplati('{"a.b":1,"a":{"b":2}}'), "['a.b'] = 1\na.b = 2");
  egal('JSON vers JSON Lines', cf.jsonVersLignes('[{"a":1},12345678901234567890]'), '{"a":1}\n12345678901234567890');
  egal('JSON Lines vers JSON', cf.lignesVersJson('1\n12345678901234567890'), '[\n  1,\n  12345678901234567890\n]');
  egal('JSON vers YAML : lexemes gardes', cf.jsonVersYaml('{"id":12345678901234567890,"t":"\\u00e9"}'), '"id": 12345678901234567890\n"t": "\\u00e9"');
  egal('JSON vers CSV : lignes en tableaux, valeur imbriquee en JSON', cf.jsonVersCsv('[[1,{"x":2}],[3]]'), '0,1\n1,"{""x"":2}"\n3,');
  egal('CSV vers JSON : colonne « __proto__ » et colonnes jumelles gardees',
    JSON.stringify(JSON.parse(cf.csvVersJson('__proto__,a,a\n1,2,3'))), '[{"__proto__":"1","a":["2","3"]}]');
  egal('formulaire vers JSON : « __proto__ » et noms repetes', JSON.stringify(JSON.parse(cw.formVersJson('__proto__=1&a=1&a=2'))),
    '{"__proto__":"1","a":["1","2"]}');
  egal('JSON vers formulaire : tableau et objet', cw.jsonVersForm('{"a":[1,{"b":2}],"n":12345678901234567890}'),
    'a=1&a=%7B%22b%22%3A2%7D&n=12345678901234567890');
  egal('en-tetes vers JSON : deux Set-Cookie gardes', JSON.stringify(JSON.parse(cw.entetesVersJson('Set-Cookie: a=1\nSet-Cookie: b=2'))),
    '{"Set-Cookie":["a=1","b=2"]}');
  egal('JSON vers en-tetes : un tableau donne un en-tete par valeur', cw.jsonVersEntetes('{"Set-Cookie":["a=1","b=2"]}'),
    'Set-Cookie: a=1\nSet-Cookie: b=2');
  egal('cookies vers JSON : nom repete', JSON.stringify(JSON.parse(cw.cookiesVersJson('a=1; a=2; b=3'))), '{"a":["1","2"],"b":"3"}');
  egal('JSON vers cookies', cw.jsonVersCookies('{"a":["1","2"],"b":null}'), 'a=1; a=2; b=');
  egal('la mise en forme du detail : sans perte', pretty('{"id":1234567890123456789}', 'application/json'), '{\n  "id": 1234567890123456789\n}');
}

/* ================== 5 bis. Les lecteurs, sans perte partout ============== */
{
  const { lireAppelJsonRpc, lireReponseJsonRpc, faitsJsonRpc } = await import('../ui/lib/rpc-http.js');
  const appel = lireAppelJsonRpc('{"jsonrpc":"2.0","method":"m","id":9007199254740993}');
  const mauvais = faitsJsonRpc(appel, lireReponseJsonRpc('{"jsonrpc":"2.0","result":1,"id":9007199254740992}'));
  verifier('JSON-RPC : une reponse au mauvais id est signalee, meme quand JSON.parse confond les deux',
    mauvais.some(f => f.cle === 'idInattendu' && f.valeurs.recu === '9007199254740992' && f.valeurs.envoye === '9007199254740993'));
  const bon = faitsJsonRpc(appel, lireReponseJsonRpc('{"jsonrpc":"2.0","result":1,"id":9007199254740993}'));
  verifier('JSON-RPC : le bon id ne dit rien', !bon.some(f => f.cle === 'idInattendu'));
  const notif = faitsJsonRpc(lireAppelJsonRpc('[{"jsonrpc":"2.0","method":"a","id":1},{"jsonrpc":"2.0","method":"b"}]'),
    lireReponseJsonRpc('[{"jsonrpc":"2.0","result":1,"id":1}]'));
  verifier('JSON-RPC : une notification reste sans reponse attendue', !notif.some(f => f.cle === 'sansReponse'));

  const { lireRequeteGraphql } = await import('../ui/lib/graphql-http.js');
  const gql = lireRequeteGraphql({ methode: 'POST', url: 'https://exemple.test/graphql', corps: { contentType: 'application/json',
    text: '{"query":"query Q($id: ID!) { a(id: $id) }","variables":{"id":12345678901234567891}}' } });
  egal('GraphQL : une variable de 64 bits garde ses chiffres', String(gql.requetes[0].variables.id), '12345678901234567891');

  const { lireProbleme } = await import('../ui/lib/probleme-http.js');
  const probleme = lireProbleme('{"type":"about:blank","status":404,"compte":12345678901234567891}', 'application/problem+json');
  egal('RFC 9457 : un membre d extension de 64 bits garde ses chiffres', String(probleme.extensions.compte), '12345678901234567891');

  const { decoderJwt } = await import('../ui/lib/inspect.js');
  const b64 = o => Buffer.from(o).toString('base64url');
  const jwt = decoderJwt(b64('{"alg":"HS256"}') + '.' + b64('{"sub":12345678901234567891,"exp":1e20}') + '.c2ln');
  egal('JWT : une revendication de 64 bits garde ses chiffres', String(jwt.charge.sub), '12345678901234567891');
  egal('JWT : un « exp » hors de la plage des dates ne rend plus le jeton illisible', jwt.expireLe, null);

  const { chercherJson } = await import('../ui/lib/motifs.js');
  egal('chemin JSON : la valeur trouvee garde ses chiffres', String(chercherJson('{"a":[12345678901234567891]}', '$.a[0]')[0].valeur), '12345678901234567891');
  egal('chemin JSON : « ..cle » ne descend pas dans un nombre exact', chercherJson('{"n":12345678901234567891}', '$..brut').length, 0);
  egal('tous les chemins, au format JSONPath, sans limite', J.cheminsJson(J.lireJsonExact(JSON.stringify(Array.from({ length: 800 }, (_, i) => i))), '$').length, 800);

  const { lirePhpStrict, versJs, ecrirePhp } = await import('../ui/lib/php-serialise.js');
  egal('PHP vers JSON : un entier de 64 bits garde ses chiffres', J.ecrireValeurJson(versJs(lirePhpStrict('i:9223372036854775807;')), ''), '9223372036854775807');
  const cleProto = versJs(lirePhpStrict('a:1:{s:9:"__proto__";i:1;}'));
  verifier('PHP vers JSON : une cle « __proto__ » reste une cle', Object.keys(cleProto).join() === '__proto__' && Object.getPrototypeOf(cleProto) === Object.prototype);
  egal('JSON vers PHP : un entier de 64 bits reste un entier PHP', ecrirePhp(J.lireJson('[9223372036854775807]')), 'a:1:{i:0;i:9223372036854775807;}');
  egal('JSON vers PHP : au-dela, un flottant, comme json_decode de PHP', ecrirePhp(J.lireJson('[12345678901234567890]')), 'a:1:{i:0;d:12345678901234567890;}');
}

/* ===================== 6. Les controles d un corps JSON ================== */
{
  const c = controlerJson({ text: '{"id":9007199254740993,"a":1,"a":2}' }, 'application/json');
  egal('controle : un entier arrondi par JSON.parse', JSON.stringify(c.perdus), '[{"chemin":"$.id","brut":"9007199254740993","lu":"9007199254740992"}]');
  egal('controle : une cle en double', JSON.stringify(c.doubles), '[{"chemin":"$","cle":"a"}]');
  egal('controle : un JSON sans piege ne dit rien', controlerJson({ text: '{"a":1}' }, 'application/json'), null);
  egal('controle : un corps tronque n est pas juge', controlerJson({ text: '{"id":9007199254740993', truncated: true }, 'application/json'), null);
  egal('controle : ce qui n est pas du JSON ne dit rien', controlerJson({ text: '<html>' }, 'text/html'), null);
  const rendu = lang => {
    setLang(lang);
    try {
      const boite = document.createElement('div');
      boite.appendChild(controlesCorps({ text: '{"id":9007199254740993,"a":1,"a":2}' }, 'application/json', []));
      return texte(boite);
    } finally { setLang('fr'); }
  };
  const fr = rendu('fr'), en = rendu('en');
  verifier('rendu francais : les deux constats et leurs lignes', fr.includes('JSON.parse le lit 9007199254740992') && fr.includes('« a » dans $'));
  verifier('rendu anglais : traduit', en.includes('JSON.parse reads it as 9007199254740992') && en.includes('written twice') && !en.includes('JSON.parse le lit'));
  for (const gabarit of Object.values(FAITS_CORPS)) verifier('fait sur un corps, sans trou vide : ' + gabarit.slice(0, 40), !/\{\s*\}/.test(gabarit));
  /* Au-dela de deux cent mille caracteres, les constats attendent que
     l onglet soit dessine : rien au premier dessin, tout une fois fait. */
  const gros = '[' + Array.from({ length: 30000 }, (_, i) => '{"id":' + (i === 777 ? '9007199254740993' : i) + ',"n":"element"}').join(',') + ']';
  verifier('corps de test au-dela du seuil', gros.length > 200000, String(gros.length));
  const boite = document.createElement('div');
  boite.appendChild(controlesCorps({ text: gros }, 'application/json', []));
  verifier('grand corps : rien au premier dessin, l onglet ne fige pas', !texte(boite).includes('9007199254740993'));
  await new Promise(fin => setTimeout(fin, 20));
  verifier('grand corps : le constat arrive ensuite, avec son chemin', texte(boite).includes('$[777].id') && texte(boite).includes('9007199254740992'));
}

/* ============================ 7. CBOR et MessagePack ===================== */
{
  const references = JSON.parse(fs.readFileSync(path.join(ici, 'vecteurs-binaires.json'), 'utf8'));
  let identiques = 0;
  for (const v of references.vecteurs) {
    const lu = (v.format === 'cbor' ? decoderCbor : decoderMsgpack)(h(v.hex));
    if (J.ecrireValeurJson(lu, '') === v.json) identiques++;
    else verifier('vecteur de reference : ' + v.nom, false, J.ecrireValeurJson(lu, '') + ' au lieu de ' + v.json);
  }
  egal('vecteurs msgpack et cbor2 : entiers 64 bits, grands entiers, horodatages a la nanoseconde, cle __proto__',
    identiques, references.vecteurs.length);
  verifier('les vecteurs de reference sont au moins vingt', references.vecteurs.length >= 20);
}
{
  /* RFC 8949, annexe A : chaque exemple, extrait du texte de la RFC. Les
     valeurs que JSON ne sait pas dire ont leur ecriture attendue ici, en
     notation de diagnostic (§8) quand elle s applique. */
  const { exemples } = JSON.parse(fs.readFileSync(path.join(ici, 'vecteurs-cbor-rfc8949.json'), 'utf8'));
  const EXPLICITES = {
    'false': 'false', 'true': 'true', 'null': 'null', 'undefined': '"undefined"',
    'simple(16)': '"simple(16)"', 'simple(255)': '"simple(255)"',
    '0("2013-03-21T20:04:00Z")': '"2013-03-21T20:04:00Z"',
    '1(1363896240)': '"2013-03-21T20:04:00.000Z"',
    '1(1363896240.5)': '"2013-03-21T20:04:00.500Z"',
    "23(h'01020304')": '{"tag":23,"content":"h\'01020304\'"}',
    "24(h'6449455446')": '{"tag":24,"content":"IETF"}',
    '32("http://www.example.com")': '{"tag":32,"content":"http://www.example.com"}',
    "h''": "\"h''\"", "h'01020304'": "\"h'01020304'\"",
    "(_ h'0102', h'030405')": "\"(_ h'0102', h'030405')\"",
    '(_ "strea", "ming")': '"streaming"',
    '{1: 2, 3: 4}': '{"1":2,"3":4}'
  };
  let justes = 0;
  for (const { diagnostic, hex } of exemples) {
    let lu;
    try { lu = decoderCbor(h(hex)); } catch (e) { verifier('RFC 8949 annexe A : ' + diagnostic, false, e.message); continue; }
    let ok;
    if (diagnostic in EXPLICITES) ok = J.ecrireValeurJson(lu, '') === EXPLICITES[diagnostic];
    else if (/^-?\d+$/.test(diagnostic)) ok = String(lu) === diagnostic;
    else if (/^-?(\d|Infinity|NaN)/.test(diagnostic)) ok = typeof lu === 'number' && Object.is(lu, Number(diagnostic));
    else ok = J.ecrireValeurJson(lu, '') === J.ecrireValeurJson(JSON.parse(diagnostic.replace(/\[_ \]/g, '[]').replace(/([[{])_ /g, '$1')), '');
    if (ok) justes++; else verifier('RFC 8949 annexe A : ' + diagnostic, false, J.ecrireValeurJson(lu, ''));
  }
  egal('RFC 8949 annexe A : les ' + exemples.length + ' exemples decodes', justes, exemples.length);
  verifier('l annexe A compte quatre-vingt-un exemples (simple(24), mal forme, en a ete retire)', exemples.length === 81);

  /* Annexe F.1 : des suites mal formees, chacune doit etre refusee. */
  const MAL_FORMEES = ['18', '19', '1a', '1b', '1901', '1a0102', '1b01020304050607', '38', '58', '78', '98', '9a01ff00', 'b8', 'd8', 'f8', 'f900',
    'fa0000', 'fb000000', '41', '61', '5affffffff00', '5bffffffffffffffff010203', '7affffffff00', '7b7fffffffffffffff010203',
    '81', '818181818181818181', '8200', 'a1', 'a20102', 'a100', 'a2000000', 'c0', '5f4100', '7f6100',
    '9f', '9f0102', 'bf', 'bf01020102', '819f', '9f8000', '9f9f9f9f9fffffffff', '9f819f819f9fffffff',
    '1c', '1d', '1e', '3c', '3d', '3e', '5c', '5d', '5e', '7c', '7d', '7e', '9c', '9d', '9e', 'bc', 'bd', 'be', 'dc', 'dd', 'de',
    'fc', 'fd', 'fe', 'f800', 'f801', 'f818', 'f81f', '5f00ff', '5f21ff', '5f6100ff', '5f80ff', '5fa0ff', '5fc000ff', '5fe0ff',
    '7f4100ff', '5f5f4100ffff', '7f7f6100ffff', 'ff', '81ff', '8200ff', 'a1ff', 'a1ff00', 'a100ff', 'a20000ff', '9f81ff',
    '9f829f819f9fffffffff', 'bf00ff', 'bf000000ff', '1f', '3f', 'df'];
  const acceptees = MAL_FORMEES.filter(x => { try { decoderCbor(h(x)); return true; } catch { return false; } });
  egal('RFC 8949 annexe F.1 : les ' + MAL_FORMEES.length + ' suites mal formees sont toutes refusees', acceptees.join(', '), '');

  egal('MessagePack : binaire en notation de diagnostic', msgpackVersJson('c40201ff'), '"h\'01ff\'"');
  egal('MessagePack : extension', msgpackVersJson('d40501'), '"ext(5, h\'01\')"');
  egal('CBOR vers JSON : 2^64 - 1 ecrit tel quel', cborVersJson('1bffffffffffffffff'), '18446744073709551615');
}

/* ===================== 8. Arbre JSON, longs textes, Synthese ============== */
{
  const petit = document.createElement('div');
  petit.appendChild(jsonTree({ id: new J.NombreExact('18446744073709551616'), n: { m: 'profond' } }));
  verifier('arbre : un NombreExact garde ses chiffres, type nombre', texte(petit).includes('18446744073709551616') && texte(petit).includes('(number)'));
  verifier('arbre de moins de cinq mille noeuds : construit en entier (Ctrl+F le trouve)', texte(petit).includes('profond'));

  avecEcouteurs(() => {
    const grand = { grand: Array.from({ length: 6000 }, (_, i) => 'element ' + i) };
    const racineArbre = jsonTree(grand);
    const boite = document.createElement('div');
    boite.appendChild(racineArbre);
    verifier('arbre de plus de cinq mille noeuds : un noeud replie n est pas construit', !texte(boite).includes('element 5999'));
    const replie = cherche(racineArbre, n => n !== racineArbre && n._ecouteurs && n._ecouteurs.toggle);
    replie.open = true;
    replie._ecouteurs.toggle();
    verifier('a son ouverture, il l est, en entier', texte(boite).includes('element 5999'));
  });

  egal('texte court : un bloc seul', texteLong('abc', { seuil: 10 }).nodeName, 'PRE');
  avecEcouteurs(() => {
    const long = 'x'.repeat(25);
    const bloc = texteLong(long, { seuil: 10 });
    const pre = cherche(bloc, n => n.nodeName === 'PRE');
    verifier('texte long : le debut, le compte exact', pre.textContent.length === 10 && texte(bloc).includes('10 caracteres affiches sur 25'));
    cherche(bloc, n => n._ecouteurs && n._ecouteurs.click)._ecouteurs.click();
    egal('texte long : « Tout afficher » montre tout', pre.textContent, long);
  });
}

/* ================ 9. Garde : rien n est coupe en silence ================ */
/* Une coupe « .slice(0, N) » dans une vue n est permise que pour ce qui
   n est pas un contenu : une etiquette, un historique, un echantillon. Chaque
   exception dit pourquoi. */
{
  const PERMISES = [
    ['ui/console/compare.js', '[...state.selection].slice(0, 2)', 'les deux premieres lignes choisies'],
    ['ui/console/detail-parts.js', 'complet.slice(0, LIMITE_AFFICHAGE)', 'le debut, avec le compte et « Tout afficher »'],
    ['ui/console/header.js', "(tab.title || tab.url || '').slice(0, 60)", 'etiquette d un onglet dans une liste'],
    ['ui/console/header.js', '.filter(q => q !== value)].slice(0, 12)', 'historique des recherches'],
    ['ui/console/header.js', 'query.slice(0, 34)', 'nom court d une recherche enregistree, la recherche reste entiere'],
    ['ui/console/summary.js', 'rows.slice(0, TOP)', 'quinze lignes, le compte et « Tout afficher »'],
    ['ui/console/summary.js', 'toISOString().slice(0, 10)', 'le jour d une date'],
    ['ui/console/tools-chiffres.js', 'etat.xorCandidats.slice(0, 12)', 'les douze meilleures cles, un classement'],
    ['ui/console/tools-chiffres.js', 'brut.slice(0, APERCU_CESAR)', 'apercu annonce, la copie decale le texte entier'],
    ['ui/console/tools-panels.js', 'reste.slice(0, 60)', 'le debut du texte en trop, dans un message'],
    ['ui/console/tools.js', 'texte.slice(0, 2000)', 'echantillon pour juger un resultat lisible, rien n est affiche']
  ];
  const fichiers = [...fs.readdirSync(path.join(racine, 'ui', 'console')).map(f => 'ui/console/' + f),
    ...fs.readdirSync(path.join(racine, 'ui')).filter(f => f.endsWith('.js')).map(f => 'ui/' + f)].filter(f => f.endsWith('.js'));
  const imprevues = [];
  for (const rel of fichiers) {
    const lignes = fs.readFileSync(path.join(racine, rel), 'utf8').split('\n');
    lignes.forEach((ligne, i) => {
      if (!/\.slice\(0, ?([0-9]+|[A-Z_]+)\)/.test(ligne)) return;
      if (PERMISES.some(([f, motif]) => f === rel && ligne.includes(motif))) return;
      imprevues.push(rel + ':' + (i + 1) + '  ' + ligne.trim());
    });
  }
  egal('aucune vue ne coupe un contenu en silence', imprevues.join('\n'), '');
}

bilan('Comparaisons et donnees exactes');
