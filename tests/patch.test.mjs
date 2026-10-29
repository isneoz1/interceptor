/* JSON Patch, Merge Patch et Pointer — SWIFT (by D4RK)
 *
 *   node tests/patch.test.mjs
 *
 * Ce que la 5.6 ajoute, verifie contre ses references :
 *
 *   1. les cent douze cas de la suite communautaire json-patch-tests (RFC 6902,
 *      dont l annexe A), lus sans perte : ses quatre cas desactives sont joues
 *      aussi — dont les deux ou un membre « op » est ecrit deux fois, qu un
 *      lecteur JSON.parse ne voit pas ;
 *   2. les quinze cas de l annexe A de RFC 7396 et son exemple du §3, ecrits
 *      a l identique, ordre des membres compris ;
 *   3. RFC 6901 : les exemples des §5 et §6, la syntaxe, l ordre de decodage
 *      de « ~01 », et la cle ecrite deux fois qui rend la reference indefinie ;
 *   4. la production d un patch : appliquer le patch produit de A vers B
 *      redonne B, sur trois mille paires ; le merge patch aussi, ou il dit
 *      pourquoi il ne peut pas ;
 *   5. l egalite de RFC 6902 §4.6, nombres compris, et des entrees hostiles ;
 *   6. l onglet Requete, le panneau de la boite a outils et la vue
 *      Comparaison, dans les deux langues.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, verifier, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
const racine = path.resolve(ici, '..');
installerPage(racine);

const { config } = await import('../background/core/config.js');
await config.ready;
const J = await import('../ui/lib/json-exact.js');
const P = await import('../ui/lib/json-patch.js');
const { setLang } = await import('../ui/lib/i18n.js');
const L = t => J.lireJsonExact(t);
const E = n => J.ecrireJsonExact(n, '');
const texte = n => (n.textContent || '') + ' ' + (n.children || []).map(texte).join(' ');

let graine = 20261013;
const hasard = () => { graine = (graine * 1103515245 + 12345) & 0x7fffffff; return graine / 0x7fffffff; };
const choisir = l => l[Math.floor(hasard() * l.length)];

/* ================== 1. json-patch-tests (RFC 6902, annexe A) =============== */
{
  const membre = (objet, cle) => { const m = objet.membres.find(x => x.cle === cle); return m ? m.valeur : undefined; };
  let justes = 0, total = 0, desactivesJustes = 0, desactives = 0;
  for (const fichier of ['tests.json', 'spec_tests.json']) {
    /* Lus sans perte : JSON.parse ferait disparaitre le second « op » des
       cas « duplicate ops » et « A.13 ». */
    const arbre = L(fs.readFileSync(path.join(ici, 'json-patch-tests', fichier), 'utf8'));
    for (const cas of arbre.elements) {
      const doc = membre(cas, 'doc'), patch = membre(cas, 'patch');
      if (!doc || !patch) continue;
      const attendu = membre(cas, 'expected'), erreur = membre(cas, 'error');
      const r = P.appliquerPatch(doc, patch);
      const juste = erreur ? !r.ok : attendu ? r.ok && P.egalJson(r.resultat, attendu) : r.ok;
      if (membre(cas, 'disabled')) { desactives++; if (juste) desactivesJustes++; continue; }
      total++;
      if (juste) justes++;
      else verifier('json-patch-tests : ' + (membre(cas, 'comment') || {}).valeur, false, r.ok ? E(r.resultat) : r.raison);
    }
  }
  egal('json-patch-tests : chaque cas actif, resultat ou erreur', justes + ' / ' + total, '108 / 108');
  egal('json-patch-tests : les quatre cas desactives passent aussi, dont les deux « op » en double', desactivesJustes + ' / ' + desactives, '4 / 4');
}
{
  /* L atomicite (§5) : un test qui echoue annule ce qui precede. */
  const doc = L('{"a":{"b":{"c":1}}}');
  const r = P.appliquerPatch(doc, L('[{"op":"replace","path":"/a/b/c","value":42},{"op":"test","path":"/a/b/c","value":"C"}]'));
  verifier('§5 : un test qui echoue, et rien n est applique', !r.ok && r.index === 1);
  egal('§5 : le document d origine n a pas change', E(doc), '{"a":{"b":{"c":1}}}');
  egal('erratum 4787 : retirer la racine est refuse', P.appliquerPatch(doc, L('[{"op":"remove","path":""}]')).ok, false);
  verifier('§4.4 : deplacer dans son propre enfant est refuse', !P.appliquerPatch(L('{"a":{"b":1}}'), L('[{"op":"move","from":"/a","path":"/a/b/c"}]')).ok);
  egal('§4.4 : deplacer vers soi-meme ne change rien', E(P.appliquerPatch(L('{"a":1}'), L('[{"op":"move","from":"/a","path":"/a"}]')).resultat), '{"a":1}');
  egal('un grand entier garde ses chiffres a travers un patch', E(P.appliquerPatch(L('{"id":1}'), L('[{"op":"replace","path":"/id","value":12345678901234567890}]')).resultat), '{"id":12345678901234567890}');
  egal('une cle « __proto__ » s ajoute comme une autre', E(P.appliquerPatch(L('{}'), L('[{"op":"add","path":"/__proto__","value":1}]')).resultat), '{"__proto__":1}');
  egal('un membre ajoute garde la place que le texte lui donne : a la fin', E(P.appliquerPatch(L('{"b":1,"a":2}'), L('[{"op":"add","path":"/c","value":3}]')).resultat), '{"b":1,"a":2,"c":3}');
  /* Les noms du prototype sont des noms comme les autres. */
  egal('des cles « constructor » et « toString » s ajoutent comme les autres',
    E(P.appliquerPatch(L('{}'), L('[{"op":"add","path":"/constructor","value":1},{"op":"add","path":"/toString","value":2}]')).resultat), '{"constructor":1,"toString":2}');
  const inconnue = P.appliquerPatch(L('{}'), L('[{"op":"constructor","path":"/a"}]'));
  verifier('une operation « constructor » est inconnue, pas une fonction', !inconnue.ok && /constructor/.test(inconnue.raison) && !/native code/.test(inconnue.raison), inconnue.raison);
  egal('merge patch : une cle « __proto__ » se fusionne comme une autre', E(P.appliquerMergePatch(L('{}'), L('{"__proto__":{"a":1}}')).resultat), '{"__proto__":{"a":1}}');
}

/* ================== 2. JSON Merge Patch (RFC 7396) =============================== */
{
  const RFC7396 = [
    ['{"a":"b"}', '{"a":"c"}', '{"a":"c"}'],
    ['{"a":"b"}', '{"b":"c"}', '{"a":"b","b":"c"}'],
    ['{"a":"b"}', '{"a":null}', '{}'],
    ['{"a":"b","b":"c"}', '{"a":null}', '{"b":"c"}'],
    ['{"a":["b"]}', '{"a":"c"}', '{"a":"c"}'],
    ['{"a":"c"}', '{"a":["b"]}', '{"a":["b"]}'],
    ['{"a":{"b":"c"}}', '{"a":{"b":"d","c":null}}', '{"a":{"b":"d"}}'],
    ['{"a":[{"b":"c"}]}', '{"a":[1]}', '{"a":[1]}'],
    ['["a","b"]', '["c","d"]', '["c","d"]'],
    ['{"a":"b"}', '["c"]', '["c"]'],
    ['{"a":"foo"}', 'null', 'null'],
    ['{"a":"foo"}', '"bar"', '"bar"'],
    ['{"e":null}', '{"a":1}', '{"e":null,"a":1}'],
    ['[1,2]', '{"a":"b","c":null}', '{"a":"b"}'],
    ['{}', '{"a":{"bb":{"ccc":null}}}', '{"a":{"bb":{}}}']
  ];
  let justes = 0;
  for (const [a, p, r] of RFC7396) {
    const res = P.appliquerMergePatch(L(a), L(p));
    if (res.ok && E(res.resultat) === r) justes++;
    else verifier('RFC 7396 annexe A : ' + a + ' + ' + p, false, res.ok ? E(res.resultat) : res.raison);
  }
  egal('RFC 7396 annexe A : les quinze cas, ecrits a l identique', justes, 15);
  const s3 = P.appliquerMergePatch(
    L('{"title":"Goodbye!","author":{"givenName":"John","familyName":"Doe"},"tags":["example","sample"],"content":"This will be unchanged"}'),
    L('{"title":"Hello!","phoneNumber":"+01-123-456-7890","author":{"familyName":null},"tags":["example"]}'));
  egal('RFC 7396 §3 : l exemple de la RFC', E(s3.resultat),
    '{"title":"Hello!","author":{"givenName":"John"},"tags":["example"],"content":"This will be unchanged","phoneNumber":"+01-123-456-7890"}');
  egal('RFC 7396 §2 : un patch aux cles en double est refuse', P.appliquerMergePatch(L('{}'), L('{"a":1,"a":2}')).ok, false);
}

/* ======================== 3. JSON Pointer (RFC 6901) ======================= */
{
  const doc = L('{"foo":["bar","baz"],"":0,"a/b":1,"c%d":2,"e^f":3,"g|h":4,"i\\\\j":5,"k\\"l":6," ":7,"m~n":8}');
  const S5 = [['/foo', '["bar","baz"]'], ['/foo/0', '"bar"'], ['/', '0'], ['/a~1b', '1'], ['/c%d', '2'], ['/e^f', '3'],
    ['/g|h', '4'], ['/i\\j', '5'], ['/k"l', '6'], ['/ ', '7'], ['/m~0n', '8']];
  egal('RFC 6901 §5 : « "" » designe le document entier', P.evaluerPointeur(doc, P.lirePointeur('')), doc);
  egal('RFC 6901 §5 : les onze autres exemples', S5.filter(([p, v]) => E(P.evaluerPointeur(doc, P.lirePointeur(p))) === v).length, 11);
  const S6 = [['#/foo', '["bar","baz"]'], ['#/foo/0', '"bar"'], ['#/', '0'], ['#/a~1b', '1'], ['#/c%25d', '2'], ['#/e%5Ef', '3'],
    ['#/g%7Ch', '4'], ['#/i%5Cj', '5'], ['#/k%22l', '6'], ['#/%20', '7'], ['#/m~0n', '8']];
  egal('RFC 6901 §6 : les fragments d URI', S6.filter(([f, v]) => E(P.evaluerPointeur(doc, P.lirePointeur(decodeURIComponent(f.slice(1))))) === v).length, 11);
  egal('RFC 6901 §4 : « ~01 » se decode en « ~1 », pas en « / »', P.lirePointeur('/~01').join(), '~1');
  egal('ecrire puis relire un pointeur', P.lirePointeur(P.ecrirePointeur(['a/b', 'm~n', ''])).join('|'), 'a/b|m~n|');
  let refus = 0;
  for (const mauvais of ['a', '/~2', '/~', '/a~b']) { try { P.lirePointeur(mauvais); } catch { refus++; } }
  egal('RFC 6901 §3 : syntaxe fausse refusee', refus, 4);
  let indefini = '';
  try { P.evaluerPointeur(L('{"a":1,"a":2}'), P.lirePointeur('/a')); } catch (e) { indefini = e.message; }
  verifier('RFC 6901 §4 : une cle ecrite deux fois rend la reference indefinie — dit, sans choisir', indefini.includes('RFC 6901 §4'), indefini);
  let zero = '';
  try { P.evaluerPointeur(L('[1,2]'), P.lirePointeur('/01')); } catch (e) { zero = e.message; }
  verifier('RFC 6901 §4 : un index a zero de tete est refuse', zero.includes('zero de tete'), zero);
}

/* ======================= 4. Produire un patch ========================== */
{
  const valeur = p => {
    const r = hasard();
    if (p > 3 || r < 0.4) return choisir(['1', '1.0', '"a"', '"b"', 'null', 'true', '12345678901234567890', '[]', '{}', '"~/"']);
    const n = Math.floor(hasard() * 5);
    if (r < 0.7) return '[' + Array.from({ length: n }, () => valeur(p + 1)).join(',') + ']';
    const vues = new Set();
    const membres = [];
    for (let i = 0; i < n; i++) {
      const c = choisir(['a', 'b', 'c', 'a/b', 'm~n', '', '__proto__']);
      if (vues.has(c)) continue;
      vues.add(c);
      membres.push(JSON.stringify(c) + ':' + valeur(p + 1));
    }
    return '{' + membres.join(',') + '}';
  };
  let justes = 0, mergeJustes = 0, inexprimables = 0, inexprimablesJustifies = 0;
  for (let k = 0; k < 3000; k++) {
    const a = L(valeur(0)), b = hasard() < 0.5 ? L(valeur(0)) : a;
    const r = P.appliquerPatch(a, P.patchEnArbre(P.produirePatch(a, b)));
    if (r.ok && P.egalJson(r.resultat, b)) justes++;
    const m = P.produireMergePatch(a, b);
    if (!m.ok) {
      inexprimables++;
      if (/null/.test(E(b))) inexprimablesJustifies++;
      continue;
    }
    const rm = P.appliquerMergePatch(a, m.patch);
    if (rm.ok && P.egalJson(rm.resultat, b)) mergeJustes++;
  }
  egal('trois mille paires : le JSON Patch produit, applique, redonne le second document', justes, 3000);
  egal('merge patch produit : juste a chaque fois qu il est exprimable', mergeJustes, 3000 - inexprimables);
  egal('merge patch : inexprimable seulement quand un null est voulu', inexprimablesJustifies, inexprimables);
  egal('meme valeur, autre ecriture, autre ordre : aucune operation', P.produirePatch(L('{"a":[1,2],"b":{"c":1}}'), L('{"b":{"c":1.0},"a":[1,2]}')).length, 0);
  egal('un patch produit, lisible', E(P.patchEnArbre(P.produirePatch(L('{"a":[1,2,3],"b":{"c":1},"d":4}'), L('{"a":[1,9,3,4],"b":{"c":2},"e":5}')))),
    '[{"op":"remove","path":"/d"},{"op":"add","path":"/e","value":5},{"op":"replace","path":"/a/1","value":9},{"op":"add","path":"/a/3","value":4},{"op":"replace","path":"/b/c","value":2}]');
  const profond = L('['.repeat(5000) + ']'.repeat(5000)), autre = L('['.repeat(5000) + '1' + ']'.repeat(5000));
  const ops = P.produirePatch(profond, autre);
  const rp = P.appliquerPatch(profond, P.patchEnArbre(ops));
  verifier('cinq mille niveaux : un patch juste, sans epuiser la pile', rp.ok && P.egalJson(rp.resultat, autre), ops.length + ' operation(s)');
}

/* ========================== 5. Egalite et hostilite ======================= */
{
  const test = (a, b) => P.appliquerPatch(L(a), L('[{"op":"test","path":"","value":' + b + '}]')).ok;
  verifier('§4.6 : 1, 1.0, 10e-1 et 0.1e1 sont egaux', test('1', '1.0') && test('1', '10e-1') && test('1', '0.1e1'));
  verifier('§4.6 : 12345678901234567890 et 12345678901234567891 different — JSON.parse les confond', !test('12345678901234567890', '12345678901234567891'));
  verifier('§4.6 : l ordre des membres ne compte pas', test('{"a":1,"b":2}', '{"b":2,"a":1}'));
  verifier('§4.6 : un nombre n est pas une chaine', !test('1', '"1"'));
  verifier('§4.6 : -0 et 0 sont egaux', test('-0', '0'));
  egal('forme numerique exacte', P.formeNumerique('1500e-3') + ' ' + P.formeNumerique('0.0015e3'), '15e-1 15e-1');
  /* « op » et « path » : exactement un chacun (RFC 6902 §4). « value » et
     « from » en double : ambigus (RFC 8259 §4), refuses ici sans etre dits
     invalides au sens de RFC 6902. */
  const doubles = P.decrirePatch(L('[{"op":"add","path":"/a","path":"/b","value":1},{"op":"add","path":"/a","value":1,"value":2},{"op":"copy","from":"/a","from":"/b","path":"/c"}]'));
  verifier('« path » en double : invalide, RFC 6902 §4', !doubles[0].ambigu && /RFC 6902 §4/.test(doubles[0].erreur), doubles[0].erreur);
  verifier('« value » en double : ambigu, RFC 8259 §4', doubles[1].ambigu === true && /RFC 8259 §4/.test(doubles[1].erreur), doubles[1].erreur);
  verifier('« from » en double : ambigu aussi', doubles[2].ambigu === true, doubles[2].erreur);
  const refus = P.appliquerPatch(L('{}'), L('[{"op":"add","path":"/a","value":1,"value":2}]'));
  verifier('appliquer un « value » en double est refuse, avec sa raison', !refus.ok && /RFC 8259/.test(refus.raison), refus.raison);
  /* Des patchs et des documents abimes, par milliers : jamais d exception. */
  const MORCEAUX = ['{', '}', '[', ']', ',', ':', '"op"', '"add"', '"remove"', '"move"', '"test"', '"copy"', '"replace"', '"path"', '"from"',
    '"value"', '"/a"', '"/-"', '"/0"', '"/01"', '"~"', '""', '1', 'null', '"a"', '1e999', '12345678901234567890'];
  let levees = 0;
  for (let k = 0; k < 3000; k++) {
    const brut = () => Array.from({ length: 1 + Math.floor(hasard() * 20) }, () => choisir(MORCEAUX)).join('');
    let doc, patch;
    try { doc = L(brut()); } catch { doc = L('{"a":[1,2]}'); }
    try { patch = L(brut()); } catch { patch = L('[{"op":"add","path":"/b","value":1}]'); }
    try { P.appliquerPatch(doc, patch); P.appliquerMergePatch(doc, patch); P.produirePatch(doc, patch); P.produireMergePatch(doc, patch); P.decrirePatch(patch); }
    catch { levees++; }
  }
  egal('trois mille entrees hostiles : aucune exception', levees, 0);
}

/* ================== 5 bis. Grandes entrees, et coherence =================== */
/* Le patch s applique sur une copie de travail modifiee sur place. Applique
   d un coup, il doit donner exactement ce que donnent ses operations une a
   une — chacune sur un document neuf, sans index ni regroupement — et
   echouer a la meme operation. Les patchs sont tires parmi les chemins qui
   existent a chaque etape, retraits identiques a la suite compris. */
{
  let graine = 7;
  const hasard = () => { graine = (graine * 1103515245 + 12345) >>> 0; return graine / 4294967296; };
  const choisir = t => t[Math.floor(hasard() * t.length)];
  const CLES = ['a', 'b', 'c', '', '~', '/', '0', 'constructor'];
  const valeur = p => {
    const r = hasard();
    if (p > 3 || r < 0.3) return choisir(['1', '1.0', '12345678901234567890', '"x"', 'true', 'null']);
    if (r < 0.6) return '[' + Array.from({ length: Math.floor(hasard() * 4) }, () => valeur(p + 1)).join(',') + ']';
    return '{' + [...new Set(Array.from({ length: Math.floor(hasard() * 4) }, () => choisir(CLES)))]
      .map(c => JSON.stringify(c) + ':' + valeur(p + 1)).join(',') + '}';
  };
  const chemins = racine => {
    const sortie = [], pile = [[racine, []]];
    while (pile.length) {
      const [n, j] = pile.pop();
      sortie.push([n, j]);
      if (n.type === 'objet') n.membres.forEach(m => pile.push([m.valeur, [...j, m.cle]]));
      else if (n.type === 'tableau') n.elements.forEach((e, i) => pile.push([e, [...j, String(i)]]));
    }
    return sortie;
  };
  const operation = doc => {
    const tous = chemins(doc), autres = tous.filter(([, j]) => j.length);
    const ptr = j => JSON.stringify(P.ecrirePointeur(j));
    const conteneurs = tous.filter(([n]) => n.type === 'objet' || n.type === 'tableau');
    const vers = () => {
      const [c, j] = choisir(conteneurs);
      return c.type === 'objet' ? [...j, choisir(CLES)] : [...j, hasard() < 0.2 ? '-' : String(Math.floor(hasard() * (c.elements.length + 1)))];
    };
    const op = choisir(['add', 'add', 'remove', 'replace', 'move', 'copy', 'test']);
    if (op === 'add' && conteneurs.length) return '{"op":"add","path":' + ptr(vers()) + ',"value":' + valeur(1) + '}';
    if (!autres.length) return null;
    const [n, j] = choisir(autres);
    if (op === 'remove' || op === 'replace') return '{"op":"' + op + '","path":' + ptr(j) + (op === 'replace' ? ',"value":' + valeur(1) : '') + '}';
    if (op === 'test') return '{"op":"test","path":' + ptr(j) + ',"value":' + (hasard() < 0.85 ? E(n) : valeur(1)) + '}';
    if (!conteneurs.length) return null;
    return '{"op":"' + (op === 'move' ? 'move' : 'copy') + '","from":' + ptr(j) + ',"path":' + ptr(vers()) + '}';
  };
  let coherents = 0, complets = 0;
  for (let k = 0; k < 3000; k++) {
    const doc = L(hasard() < 0.5 ? '{"a":[1,2,3,[4,5]],"b":{"c":1}}' : '[' + valeur(1) + ',' + valeur(1) + ']');
    const ops = [];
    let etat = doc;
    for (let i = 0, n = 1 + Math.floor(hasard() * 7); i < n; i++) {
      const o = operation(etat);
      if (!o) continue;
      const fois = o.includes('"op":"remove"') && hasard() < 0.3 ? 2 + Math.floor(hasard() * 5) : 1;
      for (let f = 0; f < fois; f++) {
        ops.push(o);
        const r = P.appliquerPatch(etat, L('[' + o + ']'));
        if (r.ok) etat = r.resultat;
      }
    }
    const dUnCoup = P.appliquerPatch(doc, L('[' + ops.join(',') + ']'));
    /* Une a une : la premiere qui echoue arrete tout, comme le veut §5. */
    let uneAUne = { ok: true, resultat: doc };
    for (let i = 0; i < ops.length && uneAUne.ok; i++) {
      const r = P.appliquerPatch(uneAUne.resultat, L('[' + ops[i] + ']'));
      uneAUne = r.ok ? r : { ok: false, index: i, raison: r.raison };
    }
    const pareil = dUnCoup.ok === uneAUne.ok && (dUnCoup.ok
      ? E(dUnCoup.resultat) === E(uneAUne.resultat)
      : dUnCoup.index === uneAUne.index && dUnCoup.raison === uneAUne.raison);
    if (pareil) coherents++;
    if (dUnCoup.ok) complets++;
  }
  egal('trois mille patchs : d un coup ou operation par operation, le meme resultat', coherents, 3000);
  verifier('la plupart vont jusqu au bout', complets > 2000, complets + ' complets');

  /* Les grandes entrees ne figent plus rien : applique en recopiant a chaque
     operation, 10 000 remplacements sur 100 000 elements prenaient 8 s, une
     fusion de 100 000 membres 22 s, son merge patch produit 16 s, et 20 000
     retraits en tete de 200 000 elements environ 6 s. */
  const chrono = fn => { const t0 = performance.now(); const r = fn(); return { r, ms: performance.now() - t0 }; };
  const tableau = n => L('[' + Array.from({ length: n }, (_, i) => i).join(',') + ']');
  const objet = (n, f = i => i) => L('{' + Array.from({ length: n }, (_, i) => '"k' + i + '":' + f(i)).join(',') + '}');
  const t100 = tableau(100000), t200 = tableau(200000), o1 = objet(100000), o2 = objet(100000, i => i + 1);
  const a = chrono(() => P.appliquerPatch(t100, L('[' + Array.from({ length: 10000 }, (_, i) => '{"op":"replace","path":"/' + (i * 7) + '","value":0}').join(',') + ']')));
  verifier('10 000 remplacements sur 100 000 elements : moins de 1,5 s', a.r.ok && a.ms < 1500, Math.round(a.ms) + ' ms');
  const t = chrono(() => P.appliquerPatch(t200, L('[' + Array(20000).fill('{"op":"remove","path":"/0"}').join(',') + ']')));
  verifier('20 000 retraits en tete de 200 000 elements : moins de 1,5 s, et justes',
    t.r.ok && t.ms < 1500 && t.r.resultat.elements.length === 180000 && t.r.resultat.elements[0].brut === '20000', Math.round(t.ms) + ' ms');
  const trop = P.appliquerPatch(tableau(3), L('[' + Array(5).fill('{"op":"remove","path":"/1"}').join(',') + ']'));
  verifier('des retraits identiques au-dela du tableau echouent a la bonne operation', !trop.ok && trop.index === 2 && /hors du tableau/.test(trop.raison), JSON.stringify(trop));
  const f = chrono(() => P.appliquerMergePatch(o1, o2));
  verifier('fusion de 100 000 membres : moins de 1,5 s', f.r.ok && f.ms < 1500, Math.round(f.ms) + ' ms');
  const m = chrono(() => P.produireMergePatch(o1, o2));
  verifier('merge patch produit pour 100 000 membres : moins de 1,5 s', m.r.ok && m.ms < 1500, Math.round(m.ms) + ' ms');
}

/* ===================== 6. L interface, dans les deux langues =============== */
const { patchRequete } = await import('../ui/console/patch-detail.js');
const { panneauPatch } = await import('../ui/console/tools-patch.js');
for (const langue of ['fr', 'en']) {
  setLang(langue);
  try {
    const rec = (type, corps, statut = 200) => ({ id: 1, method: 'PATCH', url: 'https://exemple.test/r', statusCode: statut,
      requestHeaders: [{ name: 'Content-Type', value: type }], requestBody: { text: corps, contentType: type } });
    const boite = document.createElement('div');
    boite.appendChild(patchRequete(rec('application/json-patch+json',
      '[{"op":"add","path":"/a","value":12345678901234567890},{"op":"remove","path":"/b","op":"add"}]')));
    const vu = texte(boite);
    verifier('onglet Requete [' + langue + '] : l operation lue, le grand entier intact', vu.includes('/a = 12345678901234567890'));
    verifier('onglet Requete [' + langue + '] : le « op » en double est vu', vu.includes(langue === 'en' ? 'written twice' : 'ecrit deux fois'));
    verifier('onglet Requete [' + langue + '] : un 200 sur un patch invalide est dit', vu.includes(langue === 'en' ? 'status 200: the server says it applied it' : 'statut 200 : le serveur dit l avoir applique'));
    /* 202 dit « accepte, pas encore traite » : rien n affirme que le patch a
       ete applique. */
    const accepte = document.createElement('div');
    accepte.appendChild(patchRequete(rec('application/json-patch+json', '[{"op":"remove","path":"/b","op":"add"}]', 202)));
    verifier('onglet Requete [' + langue + '] : un 202 n est pas dit « applique »',
      !texte(accepte).includes(langue === 'en' ? 'says it applied it' : 'dit l avoir applique'));
    /* Un « value » ecrit deux fois : RFC 6902 n exige pas qu il soit unique,
       RFC 8259 dit seulement que chaque lecteur JSON le lit a sa facon. Ambigu,
       pas invalide — et un 200 n y est donc pas reproche. */
    const ambigu = document.createElement('div');
    ambigu.appendChild(patchRequete(rec('application/json-patch+json', '[{"op":"add","path":"/a","value":1,"value":2}]')));
    const va = texte(ambigu);
    verifier('onglet Requete [' + langue + '] : un « value » en double est dit ambigu',
      va.includes(langue === 'en' ? 'ambiguous' : 'ambigu') && va.includes('RFC 8259'), va.slice(0, 300));
    verifier('onglet Requete [' + langue + '] : un « value » en double n est ni invalide ni reproche au serveur',
      !va.includes(langue === 'en' ? 'invalid operation' : 'invalide(s)') && !va.includes(langue === 'en' ? 'says it applied it' : 'dit l avoir applique'), va.slice(0, 300));
    const fusion = document.createElement('div');
    fusion.appendChild(patchRequete(rec('application/merge-patch+json', '{"title":"Hello!","author":{"familyName":null}}')));
    const vf = texte(fusion);
    verifier('onglet Requete [' + langue + '] : merge patch, membre par membre', vf.includes('/author/familyName') && vf.includes('/title = "Hello!"'));
    if (langue === 'en') verifier('onglet Requete [en] : traduit', vf.includes('remove /author/familyName') && !vf.includes('retirer'));
    for (const [geste, attendu] of [['appliquer', '"b": 2'], ['fusionner', '"b": 2'], ['produire', '"op": "add"'], ['produireFusion', '"b": 2']]) {
      const etat = { patchGeste: geste, patchAutre: geste === 'appliquer' ? '[{"op":"add","path":"/b","value":2}]' : '{"a":1,"b":2}' };
      const p = document.createElement('div');
      p.appendChild(panneauPatch('{"a":1}', etat, () => {}, () => {}));
      verifier('boite a outils [' + langue + '] : ' + geste, texte(p).includes(attendu), texte(p).slice(0, 200));
    }
    const erreur = document.createElement('div');
    erreur.appendChild(panneauPatch('{"a":1}', { patchGeste: 'appliquer', patchAutre: '[{"op":"remove","path":"/zz"}]' }, () => {}, () => {}));
    verifier('boite a outils [' + langue + '] : une operation qui echoue dit laquelle, et que rien n est applique',
      texte(erreur).includes(langue === 'en' ? 'operation #1' : 'operation #1') && texte(erreur).includes(langue === 'en' ? 'nothing is applied' : 'rien n est applique'));
  } finally { setLang('fr'); }
}
{
  const vue = await import('../ui/console/compare.js');
  const ops = vue.patchEntreCorps('{"a":1,"b":[1,2]}', '{ "b" : [1,2,3], "a" : 1 }');
  egal('vue Comparaison : la difference de structure de deux corps JSON', E(P.patchEnArbre(ops)), '[{"op":"add","path":"/b/2","value":3}]');
  egal('vue Comparaison : rien quand l un des corps n est pas du JSON', vue.patchEntreCorps('<html>', '{}'), null);
}
{
  /* Chaque message d erreur a sa traduction : un gabarit pour ceux qui
     portent une valeur, une entree pour les autres. */
  const { EN_ERREURS, MODELES_ERREURS } = await import('../ui/lib/dict-en-erreurs.js');
  const modeles = new Set(Object.keys(MODELES_ERREURS).map(k => k.replace(/\{@/g, '{')));
  const manquants = Object.values(P.ERREURS_PATCH).filter(m => (/\{\w+\}/.test(m) ? !modeles.has(m) : EN_ERREURS[m] === undefined));
  egal('chaque message d erreur du patch a sa traduction', manquants.join(' | '), '');
}

bilan('JSON Patch, Merge Patch et Pointer');
