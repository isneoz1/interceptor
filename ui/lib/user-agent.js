/* Ce qu un User-Agent annonce — SWIFT (by D4RK)
 *
 * Le navigateur, son moteur, le systeme, ce que la chaine dit de l appareil,
 * et ce qu elle tait desormais. Une lecture prudente : un nom n est annonce
 * que lorsqu il ne fait pas de doute. Un navigateur derive de Chromium, de
 * Gecko ou de WebKit recopie la chaine de son parent et y ajoute son propre
 * jeton ; tant que ce jeton n est pas reconnu, la lecture dit « derive de
 * Chromium, jeton X » plutot que d affirmer « Chrome ». Verifie contre les
 * 428 cas de navigateur, de systeme et de moteur de ua-parser-js 1.0.41
 * (licence MIT) : aucune fausse annonce (tests/vecteurs-ua.json).
 *
 * Ce que la chaine ne dit plus — une valeur figee n est jamais donnee pour la
 * vraie version :
 *   - Windows 11 s annonce « Windows NT 10.0 », comme Windows 10 : « 10/11 » ;
 *     seuls les indices clients (Sec-CH-UA-Platform-Version) les distinguent ;
 *   - Chrome, Edge, Safari et Firefox figent macOS a 10.15 : « 10.15+ » ;
 *   - depuis iOS 26, WebKit fige la version d iOS (18.6, puis 18.7 ; WebKit,
 *     bogue 298473) : la vraie vient de Safari, qui suit iOS ;
 *   - Chrome reduit sa version a « 1xx.0.0.0 » et masque la version et le
 *     modele Android (« Android 10; K ») : pas de version.
 *
 * La chaine est lue sur ses 2 048 premiers caracteres : une page peut poser
 * son propre User-Agent sur fetch, et des expressions qui reviennent en
 * arriere prendraient des secondes sur 100 000.
 */

import { lireListe, lireArticleSeul } from './champs-structures.js';

/* Les jetons qu un User-Agent de navigateur porte sans qu ils designent un
   autre produit. Un jeton hors de cette liste signale un derive. */
const JETONS_COMMUNS = new Set(['mozilla', 'applewebkit', 'chrome', 'safari', 'mobile', 'version', 'gecko',
  'firefox', 'khtml', 'like', 'edg', 'edge', 'edga', 'edgios', 'opr', 'oprgx', 'opx', 'opt', 'samsungbrowser',
  'yabrowser', 'yowser', 'vivaldi', 'crios', 'crmo', 'fxios', 'headlesschrome', 'trident', 'presto', 'opera',
  'focus', 'brave', 'cfnetwork', 'darwin', 'sa', 'bropp', 'yaapp_android', 'yasearchbrowser']);

/* Les produits derives que l on sait nommer, mais dont on ne garantit pas la
   lecture : ils sont signales, jamais confondus avec leur parent. */
const DERIVES = /\b(SeaMonkey|Waterfox|PaleMoon|Pale Moon|IceCat|LibreWolf|Iceweasel|Swiftfox|Camino|K-Meleon|Flock|Basilisk|Floorp|Goanna|Servo|Opera Mini|OPiOS|Opera Tablet|Silk|UCBrowser|UCWEB|MicroMessenger|QQBrowser|MQQBrowser|baiduboxapp|baidubrowser|Baidu|MiuiBrowser|HuaweiBrowser|Puffin|Maxthon|MyIE\d*|Avant|SlimBrowser|LBBROWSER|QIHU|360SE|360EE|2345\w*|Blazer|IEMobile|Maemo Browser|OculusBrowser|Konqueror|Netscape|Iron|Sleipnir|Quark|SE 2\.X|DuckDuckGo|Whale|ArkWeb|Electron|FBAN|FBAV|Instagram|Line\/|KAKAOTALK|WhatsApp|TikTok|musical_ly|Snapchat|Twitter\w*|Klarna|Steam|Valve|Pico|Cobalt|PlayStation|Nintendo|Xbox|NetCast|HbbTV|Kindle|Mobile VR|QtWebEngine|Avast|AVG|CCleaner|Coc Coc|Comodo|Dragon|GSA|Mint Browser|Naver|Obigo|Phoenix|PolyBrowser|Rekonq|Midori|Epiphany|Falkon|Otter|WebPositive|wOSBrowser|Dolphin|Polaris|Chromium)\b/i;

/* Les commentaires entre parentheses retires, comme le ferait
   ua.replace(/\([^)]*\)/g, ' '), mais en un seul passage : une « ( » sans
   « ) » ne relance pas la recherche a chaque position. */
function horsCommentaires(ua) {
  let s = '';
  for (let i = 0; ;) {
    const ouvre = ua.indexOf('(', i);
    const ferme = ouvre < 0 ? -1 : ua.indexOf(')', ouvre + 1);
    if (ferme < 0) return s + ua.slice(i);
    s += ua.slice(i, ouvre) + ' ';
    i = ferme + 1;
  }
}

function jetonsInconnus(ua) {
  const sansCommentaires = horsCommentaires(ua);
  const inconnus = [];
  /* Un nom de produit peut commencer par des chiffres (« 115Browser ») mais
     contient au moins une lettre. */
  for (const m of sansCommentaires.matchAll(/(?<![\w.])(\d*[A-Za-z][\w.-]*)\/([\w.,]+)/g)) {
    if (!JETONS_COMMUNS.has(m[1].toLowerCase())) inconnus.push(m[1] + '/' + m[2]);
  }
  return inconnus;
}

const premier = (re, ua) => { const m = re.exec(ua); return m ? m[1] : null; };

function navigateur(ua) {
  const mobile = /\bMobile\b|iPhone|iPod/.test(ua);
  /* Un produit derive se nomme lui-meme dans la chaine de son parent : il
     passe avant tout le reste, pour n etre jamais pris pour ce parent. */
  if (DERIVES.test(ua)) return null;
  let v;
  if ((v = premier(/\bEdg(?:e|A|iOS)?\/([\d.]+)/, ua))) return { nom: 'Edge', version: v };
  if ((v = premier(/\bOPRGX\/([\d.]+)/, ua)) || (v = premier(/\bOPX\/([\d.]+)/, ua))) return { nom: 'Opera GX', version: v };
  if ((v = premier(/\bOPT\/([\d.]+)/, ua))) return { nom: 'Opera Touch', version: v };
  if ((v = premier(/\bOPR\/([\d.]+)/, ua))) return { nom: 'Opera', version: v };
  if (/Opera Mobi/.test(ua) && (v = premier(/Version\/([\d.]+)/, ua))) return { nom: 'Opera Mobi', version: v };
  if (/^Opera\//.test(ua)) return { nom: 'Opera', version: premier(/Version\/([\d.]+)/, ua) || premier(/^Opera\/([\d.]+)/, ua) };
  if ((v = premier(/\bOpera ([\d.]+)/, ua))) return { nom: 'Opera', version: v };
  if ((v = premier(/\bSamsungBrowser\/([\d.]+)/, ua))) return { nom: 'Samsung Internet', version: v };
  if ((v = premier(/\bYaBrowser\/([\d.]+)/, ua)) || (v = premier(/\bYaSearchBrowser\/([\d.]+)/, ua))) return { nom: 'Yandex', version: v };
  if ((v = premier(/\bVivaldi\/([\d.]+)/, ua))) return { nom: 'Vivaldi', version: v };
  if ((v = premier(/\bBrave\/([\d.]+)/, ua))) return { nom: 'Brave', version: v };
  if ((v = premier(/\bFocus\/([\d.]+)/, ua))) return { nom: 'Firefox Focus', version: v };
  if ((v = premier(/\bFxiOS\/([\w.]+)/, ua))) return { nom: 'Firefox', version: v };
  if ((v = premier(/\bCriOS\/([\d.]+)/, ua)) || (v = premier(/\bCrMo\/([\d.]+)/, ua))) return { nom: 'Chrome', version: v };
  if (/HeadlessChrome/.test(ua)) return { nom: 'Chrome Headless', version: premier(/HeadlessChrome\/([\d.]+)/, ua) };
  if (jetonsInconnus(ua).length) return null;
  if (/; wv\)/.test(ua) && (v = premier(/\bChrome\/([\d.]+)/, ua))) return { nom: 'Chrome WebView', version: v };
  /* Le navigateur d origine d Android : « Version/x » hors d une WebView. */
  if (/\bAndroid\b/.test(ua) && (v = premier(/\bVersion\/([\d.]+)/, ua))) return { nom: 'Android Browser', version: v };
  if ((v = premier(/\bChrome\/([\d.]+)/, ua))) return { nom: 'Chrome', version: v };
  if ((v = premier(/\bFirefox\/([\w.]+)/, ua))) return { nom: 'Firefox', version: v };
  if ((v = premier(/\bMSIE ([\w.]+)/, ua))) return { nom: 'IE', version: v };
  if (/Trident\//.test(ua) && (v = premier(/\brv[: ]([\d.]+)/, ua))) return { nom: 'IE', version: v };
  /* Safari n existe que sur les systemes d Apple, et jusqu a sa version 5
     sur Windows : ailleurs, « Version/x Safari/y » est un autre WebKit (GNOME
     Web, BlackBerry, Tizen) qu on ne nomme pas. */
  if (/Safari\//.test(ua) && !/\bAndroid\b/.test(ua) && (v = premier(/\bVersion\/([\w.,]+)/, ua))) {
    const apple = /\b(?:Macintosh|iPhone|iPad|iPod)\b/.test(ua);
    const safariWindows = /\bWindows\b/.test(ua) && Number(v.split('.')[0]) <= 5;
    if (apple || safariWindows) return { nom: mobile ? 'Mobile Safari' : 'Safari', version: v };
  }
  return null;
}

function moteur(ua) {
  if (/Goanna|Servo|ArkWeb|EkiohFlow|LibWeb|Tasman|NetFront/.test(ua)) return null;
  let v;
  if ((v = premier(/\bEdge\/([\d.]+)/, ua))) return { nom: 'EdgeHTML', version: v };
  if ((v = premier(/\bPresto\/([\d.]+)/, ua))) return { nom: 'Presto', version: v };
  if ((v = premier(/\bTrident\/([\d.]+)/, ua))) return { nom: 'Trident', version: v };
  const chrome = premier(/\bChrome\/([\d.]+)/, ua);
  if (chrome && Number(chrome.split('.')[0]) >= 28 && /AppleWebKit\//i.test(ua)) return { nom: 'Blink', version: chrome };
  if ((v = premier(/\bAppleWebKit\/([\d.]+)/i, ua))) return { nom: 'WebKit', version: v };
  if (/\bGecko\/\d/.test(ua) && (v = premier(/\brv:([\w.]+)\)/, ua))) return { nom: 'Gecko', version: v };
  return null;
}

/* « NT 10.0 » est ecrit par Windows 10 comme par Windows 11 (Microsoft,
   « User-Agent strings won't be updated to differentiate between Windows 11
   and Windows 10 ») : « 10/11 », et seuls les indices clients tranchent. */
const WINDOWS_NT = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7', '6.0': 'Vista', '5.2': 'XP', '5.1': 'XP', '5.0': '2000' };
const DISTRIBUTIONS = /Ubuntu|Debian|Fedora|Red ?Hat|SUSE|Mint|Gentoo|Arch Linux|CentOS|Raspbian|Slackware|Manjaro|Mandriva|Kubuntu|Xubuntu|Sabayon|PCLinuxOS|Linspire|Linpus|Zenwalk|Deepin|elementary|Joli|Knoppix|webOS|Web0S|hpwOS|Tizen|Maemo|MeeGo|Sailfish|KAIOS|Android|CrOS|CrKey|SmartTV|SMART-TV|Chromecast|Fuchsia|NETTV|NetRange|Viera|SteamOS|Ubuntu Touch|Hurd|Haiku|FreeBSD|OpenBSD|NetBSD|DragonFly/i;

/* La chaine reduite de Chrome, en navigateur (« K) ») ou en WebView (« K; wv) »). */
const CHAINE_REDUITE_ANDROID = /Android 10; K[;)]/;

/* Depuis iOS 26, la chaine ecrit une version d iOS figee (18.6, puis 18.7).
   Safari, livre avec iOS, en porte la vraie : « Version/26.0 » sur iOS 26. Une
   version 18.6 ou plus n est donc donnee telle quelle que si Safari dit 18. */
function versionIos(ecrite, ua) {
  const [majeure, mineure] = ecrite.split('.').map(Number);
  if (majeure !== 18 || !(mineure >= 6)) return { version: ecrite };
  const safari = Number(premier(/\bVersion\/(\d+)/, ua));
  if (safari >= 26) return { version: String(safari), figee: ecrite, selonSafari: true };
  if (safari === 18) return { version: ecrite };
  return { version: ecrite + '+', figee: ecrite };
}

function systeme(ua) {
  if (/Windows Phone|Windows Mobile|IEMobile|Xbox|Windows IoT|Windows CE|WPDesktop/.test(ua)) return null;
  let v;
  if ((v = premier(/Windows NT ([\d.]+)/i, ua))) {
    if (v === '6.2' && /\bARM\b/.test(ua)) return { nom: 'Windows', version: 'RT' };
    return WINDOWS_NT[v] ? { nom: 'Windows', version: WINDOWS_NT[v], nt: v } : null;
  }
  if (/watchOS|Watch\d|AppleTV|Apple TV|tvOS/.test(ua)) return null;
  if ((v = premier(/(?:CPU (?:iPhone )?OS|iPhone OS|iOS) ([\d_.]+)/, ua)) && /iPhone|iPad|iPod|HomePod|iOS/.test(ua)) {
    return { nom: 'iOS', ...versionIos(v.replace(/_/g, '.'), ua) };
  }
  if (/Macintosh|Mac OS X|Mac_PowerPC/.test(ua) && !/like Mac OS X|Haiku/.test(ua)) {
    const mac = premier(/Mac OS X ([\d_.]+)/, ua);
    const version = mac ? mac.replace(/_/g, '.') : null;
    /* 10.15 et 10.15.7 sont les valeurs figees : celle-la, ou une plus recente. */
    return { nom: 'macOS', version: version === '10.15' || version === '10.15.7' ? version + '+' : version };
  }
  if ((v = premier(/\bAndroid[ -]([\d.]+)/, ua)) && !/Android-x86|HarmonyOS|Tizen|KAIOS|Ubuntu|like Android/.test(ua)) {
    /* « Android 10; K » : la chaine reduite de Chrome, quelle que soit la version. */
    return { nom: 'Android', version: CHAINE_REDUITE_ANDROID.test(ua) ? null : v };
  }
  if (/\bCrOS\b/.test(ua)) return { nom: 'Chromium OS', version: premier(/CrOS \w+ ([\d.]+)/, ua) };
  if (/\bLinux\b/.test(ua) && !DISTRIBUTIONS.test(ua)) return { nom: 'Linux', version: null };
  return null;
}

/* Un client automatique se nomme comme un produit, nom et version :
   « Googlebot/2.1 », « curl/8.4.0 » — ou, sans version, dans le commentaire
   « compatible; PetalBot; ». Un nom d appareil qui contient « bot »
   (« CUBOT_X19 ») n en est pas un, ni « JavaFX », un navigateur integre. */
const ROBOTS = /(?:^|[\s;(,+])([\w-]*(?:bot|crawler|spider|slurp)[\w-]*|facebookexternalhit|curl|Wget|python-requests|python-urllib|Go-http-client|okhttp|axios|node-fetch|undici|Java|libwww-perl|PostmanRuntime|insomnia|HTTPie)\/([\w.]*)/i;
const ROBOT_COMPATIBLE = /compatible;\s*((?:\w+!?\s)?[\w-]*(?:bot|crawler|spider|slurp)[\w-]*)\s*[;)]/i;
/* En tete de chaine, la ou aucun appareil ne se nomme : « TelegramBot (like
   TwitterBot) », « Slackbot-LinkExpanding 1.0 ». */
const ROBOT_EN_TETE = /^([\w-]*(?:bot|crawler|spider)[\w-]*)(?:[\s(]|$)/i;

export const LONGUEUR_LUE = 2048;

/** La lecture d un User-Agent : { navigateur, moteur, systeme, mobile, robot, derive, remarques }. */
export function lireUserAgent(chaine) {
  const entiere = String(chaine || '').trim();
  const ua = entiere.slice(0, LONGUEUR_LUE);
  const lu = {
    navigateur: null, moteur: null, systeme: null, mobile: false, robot: null, derive: null, remarques: []
  };
  if (!ua) return lu;
  if (entiere.length > LONGUEUR_LUE) lu.remarques.push('Chaine de plus de 2 048 caracteres : seuls les 2 048 premiers sont lus.');
  lu.navigateur = navigateur(ua);
  lu.moteur = moteur(ua);
  lu.systeme = systeme(ua);
  lu.mobile = /\bMobile\b|iPhone|iPod/.test(ua);
  const robot = ROBOTS.exec(ua);
  const sansVersion = robot ? null : ROBOT_COMPATIBLE.exec(ua) || ROBOT_EN_TETE.exec(ua);
  if (robot) lu.robot = robot[1] + (robot[2] ? '/' + robot[2] : '');
  else if (sansVersion) lu.robot = sansVersion[1];
  if (!lu.navigateur && !lu.robot) {
    const famille = /Chrome\//.test(ua) ? 'Chromium' : /Firefox\//.test(ua) ? 'Gecko' : /AppleWebKit\//i.test(ua) ? 'WebKit' : null;
    const jeton = jetonsInconnus(ua)[0] || (DERIVES.exec(ua) || [])[1] || null;
    if (famille || jeton) lu.derive = { famille, jeton };
  }
  if (lu.systeme && lu.systeme.nt === '10.0') lu.remarques.push('Windows 11 s annonce aussi « Windows NT 10.0 » : seuls les indices clients (Sec-CH-UA-Platform-Version) les distinguent.');
  if (lu.systeme && lu.systeme.nom === 'macOS' && /^10\.15(\.7)?\+$/.test(lu.systeme.version || '')) {
    lu.remarques.push('macOS 10.15 est une valeur figee par les navigateurs : la version reelle peut etre plus recente.');
  }
  if (lu.systeme && lu.systeme.figee) {
    lu.remarques.push(lu.systeme.selonSafari
      ? 'Depuis iOS 26, la chaine ecrit une version d iOS figee (18.6, puis 18.7) : la version affichee est celle de Safari, livre avec iOS.'
      : 'Depuis iOS 26, la chaine ecrit une version d iOS figee (18.6, puis 18.7) : la version reelle peut etre plus recente.');
  }
  const reduite = /\bChrome\/(\d+)\.0\.0\.0\b/.exec(ua);
  if (reduite) lu.remarques.push('Version reduite : seul le numero majeur est reel, le reste vaut 0.0.0.');
  if (CHAINE_REDUITE_ANDROID.test(ua)) lu.remarques.push('Chaine reduite : « Android 10; K » masque la version d Android et le modele de l appareil.');
  return lu;
}

/* ---------------------------- Indices clients ----------------------------- */
/* User-Agent Client Hints (WICG) : des champs structures (RFC 8941). La
   marque « leurre » (« Not A;Brand », « Not/A)Brand »…) est voulue par la
   specification, pour que personne ne compte sur l ordre ou le nombre des
   marques. Windows : Sec-CH-UA-Platform-Version de 1.0.0 a 10.0.0 vaut
   Windows 10, 13.0.0 et au-dela Windows 11 (Microsoft, « Detect Windows 11
   and CPU architecture using User-Agent Client Hints »). */
const LEURRE = /^\s*Not.?A.?Brand\s*$/i;

function chaineSeule(valeur) {
  try {
    const a = lireArticleSeul(valeur);
    return a && (a.type === 'chaine' || a.type === 'jeton') ? a.valeur : null;
  } catch { return null; }
}

/**
 * Les indices clients d une liste d entetes [{ name, value }] : { marques,
 * mobile, plateforme, versionPlateforme, windows, modele, architecture, bits },
 * ou null quand la requete n en porte aucun.
 */
export function lireIndicesClients(entetes) {
  const valeur = nom => {
    const e = (entetes || []).find(h => String(h.name || '').toLowerCase() === nom);
    return e ? String(e.value ?? '') : null;
  };
  const noms = ['sec-ch-ua', 'sec-ch-ua-full-version-list', 'sec-ch-ua-mobile', 'sec-ch-ua-platform',
    'sec-ch-ua-platform-version', 'sec-ch-ua-model', 'sec-ch-ua-arch', 'sec-ch-ua-bitness'];
  if (!noms.some(n => valeur(n) != null)) return null;
  const indices = { marques: [], mobile: null, plateforme: null, versionPlateforme: null, windows: null, modele: null, architecture: null, bits: null };
  const liste = valeur('sec-ch-ua-full-version-list') ?? valeur('sec-ch-ua');
  if (liste != null) {
    try {
      for (const m of lireListe(liste)) {
        const v = (m.parametres || []).find(p => p.cle === 'v');
        indices.marques.push({ nom: String(m.valeur), version: v ? String(v.valeur) : null, leurre: LEURRE.test(String(m.valeur)) });
      }
    } catch { /* liste illisible : les autres indices restent lus */ }
  }
  const mobile = valeur('sec-ch-ua-mobile');
  if (mobile != null) {
    try { const a = lireArticleSeul(mobile); if (a && a.type === 'booleen') indices.mobile = a.valeur; } catch { /* illisible */ }
  }
  indices.plateforme = valeur('sec-ch-ua-platform') != null ? chaineSeule(valeur('sec-ch-ua-platform')) : null;
  indices.versionPlateforme = valeur('sec-ch-ua-platform-version') != null ? chaineSeule(valeur('sec-ch-ua-platform-version')) : null;
  indices.modele = valeur('sec-ch-ua-model') != null ? chaineSeule(valeur('sec-ch-ua-model')) : null;
  indices.architecture = valeur('sec-ch-ua-arch') != null ? chaineSeule(valeur('sec-ch-ua-arch')) : null;
  indices.bits = valeur('sec-ch-ua-bitness') != null ? chaineSeule(valeur('sec-ch-ua-bitness')) : null;
  if (indices.plateforme === 'Windows' && indices.versionPlateforme) {
    const majeure = Number(indices.versionPlateforme.split('.')[0]);
    if (majeure >= 13) indices.windows = '11';
    else if (majeure >= 1 && majeure <= 10) indices.windows = '10';
  }
  return indices;
}
