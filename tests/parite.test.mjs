/* Ce que font les meilleurs outils — SWIFT (by D4RK)
 *
 *   node tests/parite.test.mjs
 *
 * Ce que la 5.9 reprend des outils de reference, chaque fois verifie contre
 * leur documentation ou contre une implementation de reference :
 *
 *   1. Regles. Les parametres d URL (la regle « Query Param » de Requestly) :
 *      ajoutes, remplaces ou retires sans toucher a l ecriture des autres, et
 *      une seconde application ne change plus rien — pas de boucle. Les outils
 *      « No Caching » et « Block Cookies » de Charles, entete par entete, tels
 *      que leur documentation officielle les decrit :
 *        No Caching : « The If-Modified-Since and If-None-Match headers are
 *        removed from requests, Pragma: no-cache and Cache-control: no-cache
 *        are added. The Expires, Last-Modified and ETag headers are removed
 *        from responses and Expires: 0 and Cache-Control: no-cache are added. »
 *        Block Cookies : « The Cookie header is removed from requests [...]
 *        The Set-Cookie header is removed from responses [...] »
 *      Une reponse simulee chargee depuis un fichier (« Map Local »), binaire
 *      compris : la page recoit les octets du fichier, exactement.
 */
import { installerTout, egal, memeListe, verifier, bilan } from './harnais.mjs';

installerTout();
const { config } = await import('../background/core/config.js');
const { newRecord } = await import('../background/core/store.js');
const { applyRules, mockFor, invalidateRuleCache, appliquerParametres, ruleStats } = await import('../background/rules/engine.js');
const { PRESETS } = await import('../ui/console/rules.js');
await config.ready;

/* ------------------------- 1. Parametres d URL ---------------------------- */
const param = (url, ops) => appliquerParametres(url, ops);
egal('ajout d un parametre, fragment garde',
  param('https://a.test/p?x=1#f', [{ name: 'debug', value: '1', op: 'set' }]).url, 'https://a.test/p?x=1&debug=1#f');
egal('ajout sur une URL sans requete',
  param('https://a.test/p', [{ name: 'debug', value: '1', op: 'set' }]).url, 'https://a.test/p?debug=1');
egal('un parametre present est remplace a sa place',
  param('https://a.test/p?debug=0&x=1', [{ name: 'debug', value: '1', op: 'set' }]).url, 'https://a.test/p?debug=1&x=1');
egal('un parametre en double ne garde qu une occurrence',
  param('https://a.test/p?a=1&a=2&b=3', [{ name: 'a', value: '9', op: 'set' }]).url, 'https://a.test/p?a=9&b=3');
egal('retrait de plusieurs parametres',
  param('https://a.test/p?utm_source=m&id=4&utm_medium=e', [
    { name: 'utm_source', op: 'remove' }, { name: 'utm_medium', op: 'remove' }]).url, 'https://a.test/p?id=4');
egal('le dernier parametre retire emporte le « ? »',
  param('https://a.test/p?utm_source=m#haut', [{ name: 'utm_source', op: 'remove' }]).url, 'https://a.test/p#haut');
egal('les autres parametres gardent leur ecriture exacte',
  param('https://a.test/p?q=a%20b&r=c+d', [{ name: 'z', value: '1', op: 'set' }]).url, 'https://a.test/p?q=a%20b&r=c+d&z=1');
egal('une valeur est encodee',
  param('https://a.test/p', [{ name: 'q', value: 'a b&c=d', op: 'set' }]).url, 'https://a.test/p?q=a%20b%26c%3Dd');
egal('un nom encode est reconnu',
  param('https://a.test/p?na%6De=1&x=2', [{ name: 'name', op: 'remove' }]).url, 'https://a.test/p?x=2');
egal('un parametre sans valeur se retire aussi',
  param('https://a.test/p?nocache&x=2', [{ name: 'nocache', op: 'remove' }]).url, 'https://a.test/p?x=2');
{
  const premiere = param('https://a.test/p?debug=0&utm_source=m', [
    { name: 'debug', value: '1', op: 'set' }, { name: 'utm_source', op: 'remove' }]);
  const seconde = param(premiere.url, [{ name: 'debug', value: '1', op: 'set' }, { name: 'utm_source', op: 'remove' }]);
  verifier('premiere application : changee', premiere.changed);
  verifier('seconde application : plus rien a changer (aucune boucle)', !seconde.changed && seconde.url === premiere.url);
}
/* Le navigateur reecrit l adresse redirigee selon la norme URL du WHATWG :
   l apostrophe d une requete http(s) devient « %27 ». Une regle qui l ecrit
   telle quelle la verrait revenir autrement, la reecrirait, et redirigerait
   sans fin. Le `URL` de Node suit la meme norme : il tient le role du
   navigateur entre les deux passages. */
egal('une apostrophe est ecrite encodee, comme le navigateur l ecrirait',
  param('https://a.test/p', [{ name: 'q', value: 'l\'avion', op: 'set' }]).url, 'https://a.test/p?q=l%27avion');
verifier('la bonne valeur ecrite autrement (« + » pour une espace) est gardee telle quelle',
  !param('https://a.test/p?q=a+b&x=1', [{ name: 'q', value: 'a b', op: 'set' }]).changed);
verifier('une apostrophe deja presente, non encodee, est gardee telle quelle',
  !param('https://a.test/p?q=l\'avion', [{ name: 'q', value: 'l\'avion', op: 'set' }]).changed);
{
  const boucles = [];
  for (const valeur of ['l\'avion', 'a b', 'a+b', 'x!y*(z)~', '100%', 'é ü 漢', '<script>', '"guillemets"', 'a&b=c', '#ancre']) {
    for (const depart of ['https://a.test/p', 'https://a.test/p?q=ancienne&x=1', 'https://a.test/p?x=1#haut']) {
      const premiere = param(depart, [{ name: 'q', value: valeur, op: 'set' }]);
      const vueParLeNavigateur = new URL(premiere.url).href;
      const seconde = param(vueParLeNavigateur, [{ name: 'q', value: valeur, op: 'set' }]);
      if (seconde.changed) boucles.push(valeur + ' depuis ' + depart + ' : ' + vueParLeNavigateur + ' -> ' + seconde.url);
    }
  }
  egal('apres le passage du navigateur, une seconde application ne change plus rien (30 cas)', boucles.slice(0, 4).join(' || '), '');
}
verifier('une adresse non http n est jamais touchee',
  !param('data:text/plain,a?b=1', [{ name: 'b', op: 'remove' }]).changed);
/* Rien de vise : aucune redirection, meme pour un « ? » seul a la fin. */
verifier('« ? » sans parametre, rien a retirer : l adresse ne change pas', !param('https://a.test/p?', [{ name: 'x', op: 'remove' }]).changed);
verifier('« ?#f » sans parametre : l adresse ne change pas', !param('https://a.test/?#f', [{ name: 'x', op: 'remove' }]).changed);

/* Plusieurs regles qui s appliquent a la meme requete agissent ensemble :
   deux regles de parametres contraires ne se renvoient plus la requete sans
   fin, et « No Caching » n efface plus « Block Cookies » (le premier gagnait). */
{
  const { applyRules: appliquer, invalidateRuleCache: oublier } = await import('../background/rules/engine.js');
  const { newRecord: ligne } = await import('../background/core/store.js');
  const { config: reglages } = await import('../background/core/config.js');
  const { PRESETS: modeles } = await import('../ui/console/rules.js');
  await reglages.set({ rulesEnabled: true, rules: [
    { id: 'a', enabled: true, name: 'Debug on', match: { host: 'a.test' }, action: 'modifyQuery', query: [{ name: 'debug', value: '1', op: 'set' }] },
    { id: 'b', enabled: true, name: 'Sans debug', match: { urlRegex: 'a\\.test' }, action: 'modifyQuery', query: [{ name: 'debug', op: 'remove' }] }
  ] });
  oublier();
  egal('deux regles de parametres contraires : aucune redirection, donc aucune boucle',
    appliquer(ligne({ url: 'https://a.test/p?x=1', host: 'a.test', method: 'GET' }), 'onBeforeRequest', { url: 'https://a.test/p?x=1' }), null);
  await reglages.set({ rulesEnabled: true, rules: [
    { id: 'c', enabled: true, name: 'Debug', match: { host: 'a.test' }, action: 'modifyQuery', query: [{ name: 'debug', value: '1', op: 'set' }] },
    { id: 'd', enabled: true, name: 'Langue', match: { host: 'a.test' }, action: 'modifyQuery', query: [{ name: 'lang', value: 'fr', op: 'set' }] }
  ] });
  oublier();
  const rec = ligne({ url: 'https://a.test/p', host: 'a.test', method: 'GET' });
  const une = appliquer(rec, 'onBeforeRequest', { url: 'https://a.test/p' });
  egal('deux regles de parametres : une seule redirection, les deux appliquees', une && une.redirectUrl, 'https://a.test/p?debug=1&lang=fr');
  egal('les deux regles sont tracees', rec.rulesApplied.filter(x => x.action === 'modifyQuery').map(x => x.id).join(','), 'c,d');
  egal('puis plus rien', appliquer(ligne({ url: une.redirectUrl, host: 'a.test', method: 'GET' }), 'onBeforeRequest', { url: une.redirectUrl }), null);

  const sansCache = modeles.find(p => /No Caching/.test(p.label)).rule();
  const sansCookies = modeles.find(p => /Block Cookies/.test(p.label)).rule();
  await reglages.set({ rulesEnabled: true, rules: [{ ...sansCache, enabled: true }, { ...sansCookies, enabled: true }] });
  oublier();
  const page = ligne({ url: 'https://example.com/x', host: 'example.com', method: 'GET' });
  const requete = appliquer(page, 'onBeforeSendHeaders', { url: page.url, requestHeaders: [{ name: 'Host', value: 'example.com' }, { name: 'Cookie', value: 'session=abc' }, { name: 'If-None-Match', value: '"a"' }] });
  egal('No Caching + Block Cookies, requete : les deux agissent', requete.requestHeaders.map(h => h.name + ': ' + h.value).join(' | '),
    'Host: example.com | Pragma: no-cache | Cache-Control: no-cache');
  const reponse = appliquer(page, 'onHeadersReceived', { url: page.url, responseHeaders: [{ name: 'Content-Type', value: 'text/html' }, { name: 'Set-Cookie', value: 'session=abc; Path=/' }, { name: 'ETag', value: '"a"' }] });
  egal('No Caching + Block Cookies, reponse : les deux agissent', reponse.responseHeaders.map(h => h.name + ': ' + h.value).join(' | '),
    'Content-Type: text/html | Expires: 0 | Cache-Control: no-cache');
  /* Un en-tete present deux fois : « retirer » les retire tous, « poser » n en
     laisse qu un. Sinon un second Cache-Control (max-age=3600) survivait a
     No Caching, et un second Set-Cookie a Block Cookies. */
  const doubles = appliquer(page, 'onHeadersReceived', { url: page.url, responseHeaders: [
    { name: 'Cache-Control', value: 'public' }, { name: 'Set-Cookie', value: 'a=1' }, { name: 'set-cookie', value: 'b=2' },
    { name: 'cache-control', value: 'max-age=3600' }] });
  egal('en-tetes en double : tous retires, un seul pose', doubles.responseHeaders.map(h => h.name + ': ' + h.value).join(' | '),
    'Cache-Control: no-cache | Expires: 0');
}
verifier('un nom vide est ignore', !param('https://a.test/p?x=1', [{ name: '', value: '1', op: 'set' }]).changed);

/* Dans le moteur : une redirection vers l URL reecrite, puis plus rien. */
await config.set({ rulesEnabled: true, rules: [
  { id: 'q', enabled: true, name: 'Parametre de debogage', match: { host: 'a.test' }, action: 'modifyQuery',
    query: [{ name: 'debug', value: '1', op: 'set' }] }
] });
invalidateRuleCache();
{
  const rec = newRecord({ url: 'https://a.test/p?x=1', host: 'a.test', method: 'GET' });
  const r = applyRules(rec, 'onBeforeRequest', { url: rec.url });
  egal('la regle de parametres redirige vers l URL reecrite', r && r.redirectUrl, 'https://a.test/p?x=1&debug=1');
  verifier('la regle est tracee sur la ligne', rec.rulesApplied.some(x => x.action === 'modifyQuery'));
  const suite = newRecord({ url: 'https://a.test/p?x=1&debug=1', host: 'a.test', method: 'GET' });
  egal('la requete redirigee passe sans nouvelle redirection', applyRules(suite, 'onBeforeRequest', { url: suite.url }), null);
  verifier('un compteur des parametres reecrits', ruleStats.queryModified >= 1);
}

/* ------------------- 2. « No Caching » et « Block Cookies » --------------- */
const modele = motif => {
  const p = PRESETS.find(x => motif.test(x.label));
  return p ? p.rule() : null;
};
const sansCache = modele(/No Caching/);
const sansCookies = modele(/Block Cookies/);
verifier('le modele « No Caching » existe', !!sansCache);
verifier('le modele « Block Cookies » existe', !!sansCookies);
const noms = l => l.map(h => h.name + (h.value != null ? ': ' + h.value : '')).join(' | ');
async function appliquer(regle, phase, liste) {
  await config.set({ rulesEnabled: true, rules: [{ ...regle, enabled: true, match: {} }] });
  invalidateRuleCache();
  const rec = newRecord({ url: 'https://a.test/x', host: 'a.test', method: 'GET' });
  const cle = phase === 'onBeforeSendHeaders' ? 'requestHeaders' : 'responseHeaders';
  const r = applyRules(rec, phase, { url: rec.url, [cle]: liste });
  return r ? r[cle] : liste;
}
if (sansCache) {
  const requete = await appliquer(sansCache, 'onBeforeSendHeaders', [
    { name: 'Host', value: 'a.test' }, { name: 'If-None-Match', value: '"v1"' },
    { name: 'If-Modified-Since', value: 'Wed, 21 Oct 2026 07:28:00 GMT' }, { name: 'Accept', value: '*/*' }]);
  egal('No Caching, requete : If-* retires, Pragma et Cache-Control ajoutes', noms(requete),
    'Host: a.test | Accept: */* | Pragma: no-cache | Cache-Control: no-cache');
  const reponse = await appliquer(sansCache, 'onHeadersReceived', [
    { name: 'Content-Type', value: 'text/html' }, { name: 'ETag', value: '"v1"' },
    { name: 'Last-Modified', value: 'Wed, 21 Oct 2026 07:28:00 GMT' },
    { name: 'Expires', value: 'Thu, 22 Oct 2026 07:28:00 GMT' }, { name: 'Cache-Control', value: 'max-age=300' }]);
  egal('No Caching, reponse : ETag et Last-Modified retires, Expires: 0, Cache-Control: no-cache', noms(reponse),
    'Content-Type: text/html | Cache-Control: no-cache | Expires: 0');
}
if (sansCookies) {
  const requete = await appliquer(sansCookies, 'onBeforeSendHeaders', [
    { name: 'Host', value: 'a.test' }, { name: 'Cookie', value: 'session=abc; theme=dark' }]);
  egal('Block Cookies, requete : Cookie retire, le reste intact', noms(requete), 'Host: a.test');
  const reponse = await appliquer(sansCookies, 'onHeadersReceived', [
    { name: 'Content-Type', value: 'text/html' }, { name: 'Set-Cookie', value: 'session=abc; Path=/' }]);
  egal('Block Cookies, reponse : Set-Cookie retire, le reste intact', noms(reponse), 'Content-Type: text/html');
}
{
  const suivi = modele(/utm_/);
  verifier('le modele « parametres de suivi » existe', !!suivi);
  if (suivi) {
    egal('parametres de suivi retires, le reste garde',
      appliquerParametres('https://a.test/?utm_source=x&id=7&fbclid=y&utm_campaign=z&gclid=w', suivi.query).url,
      'https://a.test/?id=7');
  }
}

/* Les modeles visaient « exemple.com », un domaine reel qui appartient a
   quelqu un : active sans retouche, un modele aurait agi sur son site. Seul
   example.com est reserve aux exemples (RFC 2606). Leurs noms suivent la
   langue de l interface. */
{
  const { setLang } = await import('../ui/lib/i18n.js');
  setLang('en');
  const regles = PRESETS.map(p => p.rule());
  const hotes = regles.map(r => r.match && r.match.host).filter(Boolean);
  verifier('les modeles ne visent que example.com, reserve aux exemples (RFC 2606)',
    hotes.length > 0 && hotes.every(h => h === 'example.com' || h.endsWith('.example.com')), hotes.join(', '));
  verifier('aucun modele ne vise exemple.com', !JSON.stringify(regles).includes('exemple'));
  const redirection = regles.find(r => r.action === 'redirect');
  egal('le modele de redirection garde le chemin ($1)', redirection && redirection.redirectUrl, 'https://api-staging.example.com/$1');
  const francais = regles.filter(r => /[a-z] (la|les|de|du|des)\b|simulee|Sans |Retirer|Bloquer|Forcer|impose|debogage/.test(r.name));
  verifier('en anglais, les modeles creent des regles aux noms anglais', francais.length === 0, francais.map(r => r.name).join(', '));
  setLang('fr');
}

/* --------------- 3. Reponse simulee chargee depuis un fichier ------------- */
await config.set({ rulesEnabled: true, rules: [
  { id: 'm1', enabled: true, name: 'Image locale', match: { host: 'img.test' }, action: 'mock',
    mock: { contentType: 'image/png', base64: 'iVBORw0KGgo=' } },
  { id: 'm2', enabled: true, name: 'Texte local', match: { host: 'txt.test' }, action: 'mock',
    mock: { contentType: 'text/plain; charset=utf-8', body: 'été' } }
] });
invalidateRuleCache();
{
  const image = mockFor(newRecord({ url: 'https://img.test/logo.png', host: 'img.test', method: 'GET' }));
  memeListe('un fichier binaire est servi octet pour octet', [...(image && image.octets || [])],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  egal('son type est celui du fichier', image && image.contentType, 'image/png');
  const texte = mockFor(newRecord({ url: 'https://txt.test/a', host: 'txt.test', method: 'GET' }));
  memeListe('un texte est servi en UTF-8', [...(texte && texte.octets || [])], [0xc3, 0xa9, 0x74, 0xc3, 0xa9]);
  const encore = mockFor(newRecord({ url: 'https://img.test/autre.png', host: 'img.test', method: 'GET' }));
  verifier('le contenu decode une fois sert aux requetes suivantes', encore && image && encore.octets === image.octets);
}
/* Le fichier charge, tel que l editeur le range : un texte seulement s il
   redonne ses octets exacts, sinon du base64. Les octets servis doivent etre
   ceux du fichier, quel qu il soit. */
{
  const { texteExact } = await import('../ui/console/rules.js');
  const { octetsVersBase64 } = await import('../ui/lib/bytes.js');
  const fichiers = {
    'texte UTF-8': new TextEncoder().encode('{"ville":"Besançon","prix":"12 €"}'),
    'Latin-1 « café »': new Uint8Array([0x63, 0x61, 0x66, 0xe9]),
    'UTF-8 avec BOM': new Uint8Array([0xef, 0xbb, 0xbf, 0x61]),
    'archive ZIP (xlsx, docx)': new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0x14, 0x00, 0x06, 0x00, 0x08, 0x00, 0xb5, 0xfe]),
    'PNG': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
  };
  const regles = Object.entries(fichiers).map(([nom, octets], i) => {
    const texte = texteExact(octets);
    return { id: 'f' + i, enabled: true, name: nom, match: { host: 'f' + i + '.test' }, action: 'mock',
      mock: { contentType: 'application/octet-stream', ...(texte != null ? { body: texte } : { body: '', base64: octetsVersBase64(octets) }) } };
  });
  await config.set({ rulesEnabled: true, rules: regles });
  invalidateRuleCache();
  Object.entries(fichiers).forEach(([nom, octets], i) => {
    const servi = mockFor(newRecord({ url: 'https://f' + i + '.test/x', host: 'f' + i + '.test', method: 'GET' }));
    memeListe('fichier ' + nom + ' : la page recoit ses octets exacts', [...(servi && servi.octets || [])], [...octets]);
  });
  verifier('un texte UTF-8 reste un texte modifiable', regles[0].mock.body.includes('Besançon') && !regles[0].mock.base64);
  verifier('Latin-1, BOM, ZIP et PNG partent en base64', regles.slice(1).every(r => r.mock.base64 && !r.mock.body));
}
/* Une regle « Throttle » ou « simulation » sans valeur fait ce que l editeur
   affiche : 50 ko/s, un corps vide. Elle ne restait inerte qu en silence. */
{
  const { throttleFor: debitDe, fluxNecessaire: flux } = await import('../background/rules/engine.js');
  await config.set({ rulesEnabled: true, rules: [
    { id: 't0', enabled: true, name: 'Lent', match: { host: 'nu.test' }, action: 'throttle' },
    { id: 's0', enabled: true, name: 'Vide', match: { host: 'vide.test' }, action: 'mock' }
  ] });
  invalidateRuleCache();
  const nu = newRecord({ url: 'https://nu.test/a', host: 'nu.test', method: 'GET' });
  egal('debit sans valeur : 50 ko/s, comme l affiche l editeur', debitDe(nu) && debitDe(nu).octetsParSeconde, 50000);
  const vide = newRecord({ url: 'https://vide.test/a', host: 'vide.test', method: 'GET' });
  verifier('simulation sans contenu : un corps vide est servi', flux(vide) && mockFor(vide) && mockFor(vide).octets.length === 0);

  /* Une regle mal formee (un fichier de reglages importe n est pas controle)
     n agit pas, et ne casse rien : ni le type de contenu, ni la requete. */
  await config.set({ rulesEnabled: true, rules: [
    { id: 'b1', enabled: true, name: 'Base64 illisible', match: { host: 'mal.test' }, action: 'mock', mock: { contentType: 'application/json', base64: '@@@' } },
    { id: 'b2', enabled: true, name: 'Texte', match: { host: 'mal.test' }, action: 'mock', mock: 'texte' },
    { id: 'b3', enabled: true, name: 'Nombre', match: { host: 'nombre.test' }, action: 'mock', mock: 5 },
    { id: 'b4', enabled: true, name: 'Bon', match: { host: 'suite.test' }, action: 'mock', mock: { contentType: 'application/json', base64: '@@@' } },
    { id: 'b5', enabled: true, name: 'Suivant', match: { host: 'suite.test' }, action: 'mock', mock: { contentType: 'text/css', body: 'a{}' } }
  ] });
  invalidateRuleCache();
  const mal = newRecord({ url: 'https://illisible.mal.test/a', host: 'illisible.mal.test', method: 'GET' });
  let exception = '';
  try { flux(mal); mockFor(mal); flux(newRecord({ url: 'https://nombre.test/', host: 'nombre.test', method: 'GET' })); } catch (e) { exception = String(e); }
  egal('un contenu de simulation qui n est pas un objet ne leve rien', exception, '');
  const entetes = [{ name: 'Content-Type', value: 'text/html' }];
  const suite = newRecord({ url: 'https://suite.test/a', host: 'suite.test', method: 'GET' });
  const reponse = applyRules(suite, 'onHeadersReceived', { url: suite.url, responseHeaders: entetes });
  egal('base64 illisible : la regle n impose pas son type, la suivante decide', reponse && reponse.responseHeaders[0].value, 'text/css');
  egal('et son corps est celui de la meme regle', mockFor(suite) && mockFor(suite).contentType, 'text/css');
}

/* --------------- 4. Neutraliser une adresse (« defang ») ------------------ */
/* Les expressions sont celles du source de CyberChef, recopiees a l octet
   pres (verifie a la recopie). Ses trois tests publies de « Defang IP
   Addresses » (tests/operations/tests/DefangIP.mjs), puis des cas travailles
   a la main depuis son code. */
{
  const { neutraliserUrls, neutraliserIp, neutraliser, retablir } = await import('../ui/lib/defang.js');
  const { TRANSFORMATIONS, transformer } = await import('../ui/lib/catalogue.js');
  egal('CyberChef « Defang IP: Valid IPV4 »', neutraliserIp('192.168.1.1'), '192[.]168[.]1[.]1');
  egal('CyberChef « Defang IP: Valid IPV6 »', neutraliserIp('2001:0db8:85a3:0000:0000:8a2e:0370:7343'),
    '2001[:]0db8[:]85a3[:]0000[:]0000[:]8a2e[:]0370[:]7343');
  egal('CyberChef « Defang IP: Valid IPV6 Shorthand »', neutraliserIp('2001:db8:3c4d:15::1a2f:1a2b'),
    '2001[:]db8[:]3c4d[:]15[:][:]1a2f[:]1a2b');
  egal('URL complete et domaine nu', neutraliserUrls('Visit https://www.example.com/a.b?c=1 or example.org'),
    'Visit hxxps[://]www[.]example[.]com/a[.]b?c=1 or example[.]org');
  egal('http neutralise quelle que soit la casse', neutraliserUrls('HTTP://Example.COM:8080/x'), 'hxxp[://]Example[.]COM:8080/x');
  egal('le domaine d une adresse de courriel', neutraliserUrls('user@example.com'), 'user@example[.]com');
  egal('la ponctuation qui suit une URL reste dehors', neutraliserUrls('see https://a.example.com/path.'),
    'see hxxps[://]a[.]example[.]com/path.');
  egal('URL et IP ensemble', neutraliser('from 203.0.113.42 to http://evil.example/login'),
    'from 203[.]0[.]113[.]42 to hxxp[://]evil[.]example/login');
  egal('retablir une URL neutralisee', retablir('hxxps[://]www[.]example[.]com/a[.]b'), 'https://www.example.com/a.b');
  const texte = 'From 203.0.113.42 (2001:db8:3c4d:15::1a2f:1a2b) to https://login.example.com/x.php?u=1, mail admin@example.org.';
  egal('retablir est l inverse de neutraliser', retablir(neutraliser(texte)), texte);
  verifier('neutralise, le texte ne contient plus de lien', !/https?:\/\/|\d+\.\d+\.\d+\.\d+|example\.(com|org)/.test(neutraliser(texte)));
  verifier('dans le catalogue : neutraliser et retablir',
    TRANSFORMATIONS.some(x => x.cle === 'defang') && TRANSFORMATIONS.some(x => x.cle === 'refang'));
  egal('par le catalogue', transformer('defang', 'http://evil.example').valeur, 'hxxp[://]evil[.]example');

  /* Le resultat est celui des expressions de CyberChef appliquees telles
     quelles, sur 60 000 textes tires au hasard dans des alphabets choisis pour
     leurs pieges : lettres de protocole, « xn-- », tirets, soulignes, points
     de fin, « :: » en double et en triple, IPv4 au bout d une IPv6, retours a
     la ligne. */
  const { EXPRESSIONS_CYBERCHEF: CC } = await import('../ui/lib/defang.js');
  const uneCC = url => url.replace(/\./g, '[.]').replace(/http/gi, 'hxxp').replace(/:\/\//g, '[://]');
  const urlsCC = s => s.replace(CC.URL_CC, uneCC).replace(CC.DOMAINE_CC, uneCC);
  const ipCC = s => s.replace(CC.IPV4_CC, x => x.replace(/\./g, '[.]')).replace(CC.IPV6_CC, x => x.replace(/:/g, '[:]'));
  let graine = 20260;
  const hasard = n => { graine = (graine * 1103515245 + 12345) >>> 0; return graine % n; };
  const tirer = (morceaux, max) => Array.from({ length: 1 + hasard(max) }, () => morceaux[hasard(morceaux.length)]).join('');
  const POUR_URL = ['a', 'b', 'x', 'n', 'h', 't', 'p', 's', 'c', 'o', 'm', 'Z', '0', '9', '-', '--', '.', '.', '_', ':', '/', '//', '://', ' ', '?', '!', 'é', 'xn--', 'http', 'com', 'example'];
  const POUR_IP = ['0', '1', '2', '5', '9', 'a', 'f', 'F', ':', ':', '::', ':::', '.', '25', '255', '1.2', 'g', '_', ' ', '\n', '\r\n', '/', '/24'];
  const ecarts = [];
  for (let i = 0; i < 30000 && ecarts.length < 5; i++) {
    const s = tirer(POUR_URL, 30);
    if (neutraliserUrls(s) !== urlsCC(s)) ecarts.push(JSON.stringify(s) + ' -> ' + JSON.stringify(neutraliserUrls(s)) + ' / CyberChef ' + JSON.stringify(urlsCC(s)));
  }
  for (let i = 0; i < 30000 && ecarts.length < 5; i++) {
    const s = tirer(POUR_IP, 30);
    if (neutraliserIp(s) !== ipCC(s)) ecarts.push(JSON.stringify(s) + ' -> ' + JSON.stringify(neutraliserIp(s)) + ' / CyberChef ' + JSON.stringify(ipCC(s)));
  }
  egal('60 000 textes au hasard : le meme resultat que les expressions de CyberChef', ecarts.join(' || '), '');

  /* Et sans jamais revenir en arriere : ces textes prenaient jusqu a plus de deux secondes. */
  const lents = [];
  for (const [quoi, s] of [['a x40 000', 'a'.repeat(40000)], ['« a. » x20 000', 'a.'.repeat(20000)], ['« : » x20 000', ':'.repeat(20000)],
    ['« a: » x20 000', 'a:'.repeat(20000)], ['prose de 45 Ko sur une ligne', 'lorem ipsum dolor sit amet, '.repeat(1600)],
    ['code minifie de 38 Ko', 'var a=b.c(d,e);if(f::g)h.i=j;'.repeat(1300)], ['« a-a- » x20 000', 'a-'.repeat(20000)]]) {
    const t0 = performance.now();
    neutraliser(s);
    const ms = performance.now() - t0;
    if (ms > 300) lents.push(quoi + ' : ' + Math.round(ms) + ' ms');
  }
  egal('aucun texte hostile ne prend plus de 300 ms', lents.join(' | '), '');
}

/* ------------- 5. Limiter le debit (« Throttle » de Charles) -------------- */
/* Le limiteur rend les octets a la page au debit demande, sur une horloge
   simulee : a tout instant, le total ecrit ne depasse pas debit × temps. */
{
  const { creerLimiteur } = await import('../background/capture/debit.js');
  let horloge = 0;
  const minuteries = [];
  const ecrits = [];
  let ferme = false;
  const limiteur = creerLimiteur({
    octetsParSeconde: 1000,
    ecrire: o => ecrits.push({ t: horloge, n: o.length, o }),
    fermer: () => { ferme = true; },
    maintenant: () => horloge,
    attendre: (ms, f) => minuteries.push({ quand: horloge + ms, f })
  });
  const morceau = n => new Uint8Array(n).map((_, i) => i % 251);
  limiteur.pousser(morceau(3000));
  limiteur.pousser(morceau(1500));
  limiteur.terminer();
  for (let garde = 0; minuteries.length && garde < 10000; garde++) {
    minuteries.sort((a, b) => a.quand - b.quand);
    const m = minuteries.shift();
    horloge = m.quand;
    m.f();
  }
  const total = ecrits.reduce((s, e) => s + e.n, 0);
  egal('debit : tout est rendu', total, 4500);
  verifier('debit : jamais plus que 1000 octets par seconde ecoules (plus la premiere tranche)',
    ecrits.every((e, i) => ecrits.slice(0, i + 1).reduce((s, x) => s + x.n, 0) <= 1000 * e.t / 1000 + 1000), JSON.stringify(ecrits.map(e => [e.t, e.n])));
  verifier('debit : 4500 octets a 1000 o/s prennent au moins 3,5 s', ecrits[ecrits.length - 1].t >= 3500, String(ecrits[ecrits.length - 1].t));
  verifier('debit : le flux est ferme une fois tout rendu', ferme);
  const rendu = new Uint8Array(4500);
  let p = 0;
  for (const e of ecrits) { rendu.set(e.o, p); p += e.n; }
  const attendu = new Uint8Array([...morceau(3000), ...morceau(1500)]);
  verifier('debit : les octets arrivent dans l ordre, intacts', rendu.every((x, i) => x === attendu[i]));
}
/* Un serveur qui se tait n accumule pas de credit ; une page partie arrete
   tout ; une reponse qui deborde suspend le flux, puis le reprend. */
{
  const { creerLimiteur } = await import('../background/capture/debit.js');
  const banc = (options = {}) => {
    const b = { horloge: 0, minuteries: [], ecrits: [], ferme: false, suspensions: 0, reprises: 0 };
    b.limiteur = creerLimiteur({
      octetsParSeconde: 1000,
      ecrire: o => { if (options.echec && b.ecrits.length >= 1) throw new Error('page partie'); b.ecrits.push([b.horloge, o.length]); },
      fermer: () => { b.ferme = true; },
      suspendre: () => { b.suspensions++; },
      reprendre: () => { b.reprises++; },
      echec: () => { b.echecs = (b.echecs || 0) + 1; },
      maintenant: () => b.horloge,
      attendre: (ms, f) => b.minuteries.push({ quand: b.horloge + ms, f })
    });
    b.tourner = jusqua => {
      for (let garde = 0; garde < 100000; garde++) {
        b.minuteries.sort((x, y) => x.quand - y.quand);
        const m = b.minuteries[0];
        if (!m || m.quand > jusqua) break;
        b.minuteries.shift();
        b.horloge = m.quand;
        m.f();
      }
      b.horloge = Math.max(b.horloge, jusqua);
    };
    return b;
  };
  const pause = banc();
  pause.limiteur.pousser(new Uint8Array(100));
  pause.tourner(30000);
  pause.limiteur.pousser(new Uint8Array(30000));
  pause.limiteur.terminer();
  pause.tourner(1e9);
  const aussitot = pause.ecrits.filter(([t]) => t === 30000).reduce((s, [, n]) => s + n, 0);
  egal('debit : apres 30 s de silence, une seconde d avance seulement (1 000 octets)', aussitot, 1000);
  verifier('debit : les 29 000 autres prennent 29 s', pause.ecrits[pause.ecrits.length - 1][0] >= 58900 && pause.ferme,
    String(pause.ecrits[pause.ecrits.length - 1][0]));

  const partie = banc({ echec: true });
  partie.limiteur.pousser(new Uint8Array(5000));
  partie.limiteur.terminer();
  partie.tourner(1e9);
  verifier('debit : une ecriture qui echoue arrete tout, sans minuterie restante', partie.ecrits.length === 1 && !partie.minuteries.length && !partie.ferme,
    partie.ecrits.length + ' ecritures, ' + partie.minuteries.length + ' minuteries');
  egal('debit : l echec est signale une fois, pour ne pas laisser le flux ouvert', partie.echecs, 1);

  const deborde = banc();
  for (let i = 0; i < 40; i++) deborde.limiteur.pousser(new Uint8Array(10000));   // 400 000 octets d un coup
  egal('debit : au-dela de 256 Ko en attente, le flux est suspendu', deborde.suspensions, 1);
  deborde.limiteur.terminer();
  deborde.tourner(1e9);
  egal('debit : et repris une fois la file a moitie vide', deborde.reprises, 1);
  verifier('debit : tout est remis malgre la suspension', deborde.ecrits.reduce((s, [, n]) => s + n, 0) === 400000 && deborde.ferme);

  const arret = banc();
  for (let i = 0; i < 40; i++) arret.limiteur.pousser(new Uint8Array(10000));
  arret.limiteur.arreter();
  verifier('debit : arrete pendant une suspension, le flux est repris (jamais laisse suspendu)', arret.suspensions === 1 && arret.reprises === 1);
}
{
  const { throttleFor } = await import('../background/rules/engine.js');
  await config.set({ rulesEnabled: true, rules: [
    { id: 'th', enabled: true, name: 'Lent', match: { host: 'lent.test' }, action: 'throttle', throttle: { koParSeconde: 50 } },
    { id: 'th2', enabled: true, name: 'Absurde', match: { host: 'zero.test' }, action: 'throttle', throttle: { koParSeconde: 0 } }
  ] });
  invalidateRuleCache();
  const r = throttleFor(newRecord({ url: 'https://lent.test/a', host: 'lent.test', method: 'GET' }));
  egal('regle de debit : 50 ko/s = 50 000 octets par seconde', r && r.octetsParSeconde, 50000);
  egal('hors regle : pas de limite', throttleFor(newRecord({ url: 'https://vite.test/a', host: 'vite.test', method: 'GET' })), null);
  egal('un debit nul ne bloque pas la page : la regle n agit pas', throttleFor(newRecord({ url: 'https://zero.test/a', host: 'zero.test', method: 'GET' })), null);
}

/* -------- 6. Une regle qui touche au corps, capture des corps coupee ------- */
/* Le profil « Observation discrete » coupe la capture des corps : le flux
   n etait plus ouvert, et une simulation ou un remplacement ne faisait rien,
   en silence. Desormais la regle s applique, et rien n est enregistre. */
{
  const { attachFilter } = await import('../background/capture/streamfilter.js');
  let filtre = null;
  globalThis.browser.webRequest.filterResponseData = () => {
    filtre = { ecrit: [], ferme: false, deconnecte: false,
      write(o) { this.ecrit.push(new Uint8Array(o.buffer ? o.buffer.slice(o.byteOffset, o.byteOffset + o.byteLength) : o)); },
      close() { this.ferme = true; }, disconnect() { this.deconnecte = true; } };
    return filtre;
  };
  const texte = f => new TextDecoder().decode(new Uint8Array(f.ecrit.flatMap(o => [...o])));
  await config.set({ captureResponseBodies: false, rulesEnabled: true, rules: [
    { id: 'm', enabled: true, name: 'Simule', match: { host: 'sim.test' }, action: 'mock', mock: { contentType: 'text/plain', body: 'simule' } },
    { id: 'd', enabled: true, name: 'Lent', match: { host: 'lent.test' }, action: 'throttle', throttle: { koParSeconde: 3 } }
  ] });
  invalidateRuleCache();
  const sim = newRecord({ url: 'https://sim.test/a', host: 'sim.test', method: 'GET', type: 'xmlhttprequest' });
  verifier('capture coupee + simulation : le flux est ouvert', attachFilter(sim, 'r1', [{ name: 'Content-Type', value: 'text/plain' }]));
  filtre.ondata({ data: new TextEncoder().encode('du serveur').buffer });
  filtre.onstop();
  egal('la page recoit la simulation', texte(filtre), 'simule');
  verifier('rien n est enregistre', !sim.responseBody);
  verifier('capture coupee sans regle : aucun flux',
    !attachFilter(newRecord({ url: 'https://autre.test/a', host: 'autre.test', method: 'GET', type: 'xmlhttprequest' }), 'r2', []));

  /* Le debit, dans le vrai filtre : 6 000 octets a 3 000 octets par seconde. */
  const lent = newRecord({ url: 'https://lent.test/a', host: 'lent.test', method: 'GET', type: 'xmlhttprequest' });
  verifier('capture coupee + debit : le flux est ouvert', attachFilter(lent, 'r3', [{ name: 'Content-Type', value: 'text/plain' }]));
  const corps = 'x'.repeat(6000);
  const debut = Date.now();
  filtre.ondata({ data: new TextEncoder().encode(corps).buffer });
  filtre.onstop();
  verifier('debit : une premiere tranche part tout de suite, pas tout', texte(filtre).length > 0 && texte(filtre).length < 6000, String(texte(filtre).length));
  while (!filtre.ferme && Date.now() - debut < 5000) await new Promise(r => setTimeout(r, 25));
  const duree = Date.now() - debut;
  verifier('debit : tout arrive, puis le flux se ferme', filtre.ferme && texte(filtre) === corps);
  verifier('debit : 6 000 octets a 3 ko/s prennent environ une seconde', duree >= 900 && duree < 2500, duree + ' ms');
  await config.set({ captureResponseBodies: true });
}

await config.set({ rulesEnabled: false, rules: [] });
invalidateRuleCache();
bilan('Ce que font les meilleurs outils');
