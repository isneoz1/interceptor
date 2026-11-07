/* Ce qu un navigateur annonce — SWIFT (by D4RK)
 *
 *   node tests/navigateurs.test.mjs
 *
 * Le User-Agent et les indices clients (User-Agent Client Hints), lus contre
 * les cas de ua-parser-js 1.0.41 (licence MIT, tests/vecteurs-ua.json) :
 *
 *   1. Sur les 428 cas — 257 navigateurs, 150 systemes, 21 moteurs —
 *      aucune annonce fausse : quand SWIFT nomme un navigateur, un systeme ou
 *      un moteur, c est le nom et la version qu ua-parser-js attend. Ce qu il
 *      ne sait pas nommer, il le tait ; la part nommee ne peut que croitre.
 *   2. Ce que la chaine ne dit plus : Windows 11 sous « NT 10.0 », macOS
 *      fige a 10.15, la version reduite de Chrome, « Android 10; K ».
 *   3. Un derive de Chromium n est pas pris pour Chrome ; un robot ou un
 *      outil en ligne de commande est reconnu a son jeton.
 *   4. Les indices clients : marques (et la marque leurre), mobile,
 *      plateforme, et Windows 10 ou 11 selon la regle de Microsoft
 *      (Sec-CH-UA-Platform-Version : 1 a 10 → 10, 13 et plus → 11).
 *   5. L outil En-tetes et l onglet En-tetes, dans les deux langues.
 */
import fs from 'node:fs';
import { installerTout, egal, verifier, bilan, dejaAnglais } from './harnais.mjs';

installerTout();
const V = JSON.parse(fs.readFileSync(new URL('./vecteurs-ua.json', import.meta.url), 'utf8'));
const { lireUserAgent, lireIndicesClients } = await import('../ui/lib/user-agent.js');
const { setLang } = await import('../ui/lib/i18n.js');

/* ---------------------- 1. Aucune annonce fausse ------------------------- */
const NOM_OS = { macOS: 'Mac OS' };
/* Une version annoncee est juste quand elle ne dit rien de faux : absente,
   « 10/11 » quand la reference dit 10, « 10.15.7+ » quand elle dit 10.15.7. */
const segments = v => String(v).split('.').map(x => Number(x) || 0);
function auMoins(v, base) {
  const a = segments(v), b = segments(base);
  for (let i = 0; i < Math.max(a.length, b.length); i++) if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  return true;
}
function versionJuste(annoncee, attendue) {
  if (annoncee == null) return true;
  const a = String(annoncee);
  if (a.endsWith('+')) return attendue != null && auMoins(attendue, a.slice(0, -1));
  return a.split('/').includes(String(attendue));
}
function juger(cas, champ, renommer = {}) {
  let justes = 0;
  const faux = [];
  for (const c of cas) {
    const a = lireUserAgent(c.ua)[champ];
    if (!a) continue;
    const nom = renommer[a.nom] || a.nom;
    if (nom !== c.nom || !versionJuste(a.version, c.version)) faux.push(nom + ' ' + a.version + ' au lieu de ' + c.nom + ' ' + c.version);
    else justes++;
  }
  return { justes, faux };
}
for (const [quoi, cas, champ, renommer, minimum] of [
  ['navigateurs', V.navigateurs, 'navigateur', {}, 61],
  ['systemes', V.systemes, 'systeme', NOM_OS, 22],
  ['moteurs', V.moteurs, 'moteur', {}, 11]
]) {
  const r = juger(cas, champ, renommer);
  egal(quoi + ' : aucune annonce fausse sur ' + cas.length + ' cas', r.faux.length, 0);
  if (r.faux.length) verifier(quoi + ' : premiers faux', false, r.faux.slice(0, 5).join(' || '));
  verifier(quoi + ' : au moins ' + minimum + ' annonces justes (' + r.justes + ')', r.justes >= minimum);
}

/* ------------------- 2. Ce que la chaine ne dit plus --------------------- */
const chrome = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
{
  const lu = lireUserAgent(chrome);
  egal('Chrome reduit : navigateur', lu.navigateur && lu.navigateur.nom + ' ' + lu.navigateur.version, 'Chrome 124.0.0.0');
  egal('Chrome reduit : moteur', lu.moteur && lu.moteur.nom, 'Blink');
  /* « Windows NT 10.0 » est ecrit par Windows 10 comme par Windows 11 : dire
     « Windows 10 » serait faux sur un poste Windows 11. */
  egal('Chrome reduit : systeme, sans trancher entre 10 et 11', lu.systeme && lu.systeme.nom + ' ' + lu.systeme.version, 'Windows 10/11');
  verifier('NT 10.0 : Windows 11 ne s en distingue pas', lu.remarques.some(r => /Windows 11/.test(r)));
  verifier('1xx.0.0.0 : version reduite', lu.remarques.some(r => /reduite/.test(r)));
  const mac = lireUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15');
  egal('Safari : navigateur', mac.navigateur && mac.navigateur.nom + ' ' + mac.navigateur.version, 'Safari 17.4');
  verifier('macOS 10.15.7 : valeur figee', mac.remarques.some(r => /figee/.test(r)));
  const android = lireUserAgent('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36');
  verifier('« Android 10; K » : chaine reduite', android.remarques.some(r => /Android 10; K/.test(r)) && android.mobile);
  const firefox = lireUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0');
  egal('Firefox : navigateur et moteur', [firefox.navigateur.nom, firefox.navigateur.version, firefox.moteur.nom, firefox.moteur.version].join(' '),
    'Firefox 132.0 Gecko 132.0');
  /* Les valeurs figees ne sont jamais donnees pour la vraie version. */
  egal('macOS 10_15_7 : « 10.15.7 ou plus recent »', mac.systeme && mac.systeme.version, '10.15.7+');
  egal('macOS 10.15 de Firefox : « 10.15 ou plus recent »',
    lireUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0').systeme.version, '10.15+');
  egal('macOS 10_15_6 : une vraie version, gardee', lireUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Safari/605.1.15').systeme.version, '10.15.6');
  egal('« Android 10; K » : pas de version', android.systeme && android.systeme.nom + ' ' + android.systeme.version, 'Android null');
  /* Depuis iOS 26, WebKit fige la version d iOS (18.6, puis 18.7) ; Safari,
     qui suit iOS, dit la vraie. Sources : WebKit, bogue 298473. */
  const ios26 = lireUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1');
  egal('iOS 26 ecrit « 18_6 » : la version vient de Safari', ios26.systeme && ios26.systeme.version, '26');
  verifier('iOS 26 : la remarque le dit', ios26.remarques.some(r => /iOS 26/.test(r)));
  egal('iOS 18_6 sans Safari : « 18.6 ou plus recent »',
    lireUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148').systeme.version, '18.6+');
  egal('iOS 18.6 avec Safari 18.6 : une vraie version, gardee',
    lireUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1').systeme.version, '18.6');
  egal('iOS 17_5 : une vraie version, gardee',
    lireUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1').systeme.version, '17.5');
}

/* ------------------------- 3. Derives et robots -------------------------- */
{
  const derive = lireUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_16_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.61 Safari/537.36 115Browser/24.3.0.3');
  egal('un derive de Chromium n est pas pris pour Chrome', derive.navigateur, null);
  egal('il est dit derive, avec son jeton', derive.derive && derive.derive.famille + ' ' + derive.derive.jeton, 'Chromium 115Browser/24.3.0.3');
  egal('Googlebot', lireUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)').robot, 'Googlebot/2.1');
  egal('curl', lireUserAgent('curl/8.4.0').robot, 'curl/8.4.0');
  egal('un robot nomme sans version, dans « compatible; »',
    lireUserAgent('Mozilla/5.0 (compatible;PetalBot;+https://webmaster.petalsearch.com/site/petalbot)').robot, 'PetalBot');
  /* Un nom d appareil qui contient « bot » n est pas un robot ; JavaFX, un
     navigateur integre, n est pas « Java ». */
  egal('CUBOT_X19 est un telephone', lireUserAgent('Mozilla/5.0 (Linux; Android 9; CUBOT_X19) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/80.0.3987.162 Mobile Safari/537.36').robot, null);
  egal('CUBOT KINGKONG aussi', lireUserAgent('Mozilla/5.0 (Linux; Android 11; CUBOT KINGKONG 5 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.104 Mobile Safari/537.36').robot, null);
  egal('JavaFX n est pas Java', lireUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 JavaFX/8.0').robot, null);
  egal('Java, lui, en est un', lireUserAgent('Java/17.0.2').robot, 'Java/17.0.2');
  /* Des robots connus qui n ecrivent pas « nom/version ». */
  egal('Yahoo! Slurp', lireUserAgent('Mozilla/5.0 (compatible; Yahoo! Slurp; http://help.yahoo.com/help/us/ysearch/slurp)').robot, 'Yahoo! Slurp');
  egal('Slackbot', lireUserAgent('Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)').robot, 'Slackbot-LinkExpanding');
  egal('TelegramBot', lireUserAgent('TelegramBot (like TwitterBot)').robot, 'TelegramBot');
  /* La forme reduite de Chrome dans une WebView. */
  const webview = lireUserAgent('Mozilla/5.0 (Linux; Android 10; K; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/141.0.0.0 Mobile Safari/537.36');
  egal('« Android 10; K; wv » : pas de version non plus', webview.systeme && webview.systeme.version, null);
  verifier('« Android 10; K; wv » : la remarque le dit', webview.remarques.some(r => /Android 10; K/.test(r)));
  /* Safari n existe que sur les systemes d Apple : ailleurs, « Version/x
     Safari/y » est un autre WebKit (GNOME Web, BlackBerry, Tizen). */
  for (const [quoi, ua] of [
    ['GNOME Web', 'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15'],
    ['BlackBerry 10', 'Mozilla/5.0 (BB10; Touch) AppleWebKit/537.10+ (KHTML, like Gecko) Version/10.0.9.2372 Mobile Safari/537.10+'],
    ['PlayBook', 'Mozilla/5.0 (PlayBook; U; RIM Tablet OS 2.1.0; en-US) AppleWebKit/536.2+ (KHTML, like Gecko) Version/7.2.1.0 Safari/536.2+'],
    ['Tizen', 'Mozilla/5.0 (Linux; Tizen 2.3; SAMSUNG SM-Z130H) AppleWebKit/537.3 (KHTML, like Gecko) Version/2.3 Mobile Safari/537.3']
  ]) egal(quoi + ' n est pas annonce comme Safari', lireUserAgent(ua).navigateur, null);
  egal('une chaine vide ne dit rien', JSON.stringify(lireUserAgent('')), JSON.stringify({ navigateur: null, moteur: null, systeme: null, mobile: false, robot: null, derive: null, remarques: [] }));
}

/* -------------------- Une chaine hostile reste lue vite -------------------- */
/* Firefox laisse une page poser son propre User-Agent sur fetch : la chaine
   peut faire 100 000 caracteres, et l onglet En-tetes la lit des qu on
   l ouvre. Les expressions qui reviennent en arriere sur une telle chaine
   prenaient des secondes ; la lecture s arrete a 2 048 caracteres, et le dit. */
{
  const lents = [];
  for (const [quoi, ua] of [['a- x50 000', 'a-'.repeat(50000)], ['( x50 000', '('.repeat(50000)], ['bot x30 000', 'bot'.repeat(30000)],
    ['Mozilla + ( x50 000', 'Mozilla/5.0 ' + '('.repeat(50000)], ['a/ x50 000', 'a/'.repeat(50000)]]) {
    const t0 = performance.now();
    const lu = lireUserAgent(ua);
    const ms = performance.now() - t0;
    if (ms > 200) lents.push(quoi + ' : ' + Math.round(ms) + ' ms');
    if (quoi === 'a- x50 000') verifier('une chaine trop longue le dit', lu.remarques.some(r => /2 048/.test(r)));
  }
  egal('chaque chaine hostile se lit en moins de 200 ms', lents.join(' | '), '');
}

/* ------------------------- 4. Indices clients ---------------------------- */
const indices = [
  { name: 'Sec-CH-UA', value: '"Chromium";v="124", "Microsoft Edge";v="124", "Not-A.Brand";v="99"' },
  { name: 'Sec-CH-UA-Mobile', value: '?0' },
  { name: 'Sec-CH-UA-Platform', value: '"Windows"' },
  { name: 'Sec-CH-UA-Platform-Version', value: '"15.0.0"' }
];
{
  const ic = lireIndicesClients(indices);
  egal('marques lues', ic.marques.map(m => m.nom + ' ' + m.version).join(', '), 'Chromium 124, Microsoft Edge 124, Not-A.Brand 99');
  egal('la marque leurre est reconnue', ic.marques.filter(m => m.leurre).map(m => m.nom).join(), 'Not-A.Brand');
  egal('mobile ?0', ic.mobile, false);
  egal('plateforme', ic.plateforme, 'Windows');
  egal('15.0.0 : Windows 11 (13 et plus)', ic.windows, '11');
  const avec = v => lireIndicesClients([{ name: 'Sec-CH-UA-Platform', value: '"Windows"' }, { name: 'Sec-CH-UA-Platform-Version', value: '"' + v + '"' }]).windows;
  egal('13.0.0 : Windows 11', avec('13.0.0'), '11');
  egal('10.0.0 : Windows 10', avec('10.0.0'), '10');
  egal('1.0.0 : Windows 10', avec('1.0.0'), '10');
  egal('0.3.0 : rien d affirme', avec('0.3.0'), null);
  egal('pas d indices (Firefox) : null', lireIndicesClients([{ name: 'User-Agent', value: 'x' }]), null);
  const leurres = ['Not A(Brand', 'Not)A;Brand', ' Not;A Brand', 'Not/A)Brand', 'Not_A Brand'];
  verifier('les formes de la marque leurre', leurres.every(n => lireIndicesClients([{ name: 'Sec-CH-UA', value: '"' + n + '";v="8"' }]).marques[0].leurre));
}

/* ------------------- 5. L outil En-tetes et le detail -------------------- */
{
  const { analyserBloc } = await import('../ui/lib/entetes-analyse.js');
  const { blocNavigateurAnnonce } = await import('../ui/console/ua-detail.js');
  const texteDe = n => !n ? '' : String(n.textContent || '') + ' ' + [...(n.children || [])].map(texteDe).join(' ');
  for (const langue of ['fr', 'en']) {
    setLang(langue);
    const bloc = analyserBloc('User-Agent: ' + chrome);
    const ligne = (bloc.lignes || bloc)[0];
    const parties = (ligne && ligne.parties || []).map(p => p.cle + '=' + p.valeur).join(' | ');
    verifier('outil En-tetes [' + langue + '] : le User-Agent est lu', parties.includes('Chrome 124.0.0.0') && parties.includes('Blink'), parties);
    const rec = { requestHeaders: [{ name: 'User-Agent', value: chrome }, ...indices] };
    const texte = texteDe(blocNavigateurAnnonce(rec));
    verifier('detail [' + langue + '] : Windows 11 par les indices clients', texte.includes('Windows 11'), texte.slice(0, 200));
    verifier('detail [' + langue + '] : le titre dans sa langue', langue === 'en' ? texte.includes('What the browser announces') : texte.includes('Ce que le navigateur annonce'), texte.slice(0, 100));
    verifier('detail [' + langue + '] : la marque leurre est dite', langue === 'en' ? /decoy/i.test(texte) : /leurre/i.test(texte), texte.slice(0, 300));
  }
  egal('detail : rien sans User-Agent ni indices', blocNavigateurAnnonce({ requestHeaders: [] }), null);
  setLang('fr');

  /* En anglais, aucun libelle ne doit manquer au traducteur, sur toutes les
     chaines du jeu de reference. Ne sont pas a traduire : un texte deja
     anglais (une traduction repassee au traducteur) et le nom de l en-tete. */
  const { surManque } = await import('../ui/lib/i18n.js');
  const { EN } = await import('../ui/lib/dict-en.js');
  const anglais = dejaAnglais(EN);
  const manques = new Set();
  setLang('en');
  surManque(texte => { const s = String(texte); if (!anglais(s) && s !== 'User-Agent') manques.add(s); });
  /* Les remarques que les chaines de reference ne declenchent pas : iOS 26,
     iOS fige sans Safari, chaine trop longue, macOS fige, derive sans jeton. */
  const PARTICULIERES = [
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.0 Mobile/15E148 Safari/604.1',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_7 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
    'Mozilla/5.0 (X11; Ubuntu; Linux x86_64) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
    'Mozilla/5.0 ' + 'a'.repeat(3000)
  ];
  let particulieres = 0;
  try {
    for (const c of [...V.navigateurs, ...V.systemes, ...V.moteurs]) blocNavigateurAnnonce({ requestHeaders: [{ name: 'User-Agent', value: c.ua }] });
    blocNavigateurAnnonce({ requestHeaders: [{ name: 'User-Agent', value: chrome }, ...indices] });
    for (const ua of PARTICULIERES) { particulieres += lireUserAgent(ua).remarques.length; blocNavigateurAnnonce({ requestHeaders: [{ name: 'User-Agent', value: ua }] }); }
  } finally { surManque(null); setLang('fr'); }
  verifier('les chaines particulieres declenchent bien leurs remarques', particulieres >= 4, String(particulieres));
  egal('detail en anglais : aucun libelle sans traduction', [...manques].slice(0, 12).join(' | '), '');
}

bilan('Ce qu un navigateur annonce');
