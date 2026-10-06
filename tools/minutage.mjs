/* Audit du minutage — SWIFT (by NeoZ)
 *
 *   node tools/minutage.mjs
 *
 * L onglet Chronologie affiche les phases d un chargement : attente, DNS,
 * connexion, TLS, premier octet, reception. Elles viennent de Resource Timing,
 * lu par la sonde de page. Trois erreurs y ont vecu :
 *
 *   1. « Envoi » recopiait « Attente » : la meme formule, deux fois. Le
 *      navigateur n expose pas la fin de l emission ; la valeur etait inventee.
 *   2. Pour une ressource d une autre origine qui ne l autorise pas par
 *      `Timing-Allow-Origin`, le navigateur met les horodatages et les tailles
 *      a zero. La sonde en tirait « DNS 0 ms », « 0 o », et une reception egale
 *      a l horodatage ABSOLU de fin — des secondes pour un fichier de dix
 *      octets.
 *   3. `connectEnd - connectStart` contient deja le TLS, qui etait ajoute une
 *      seconde fois au total.
 *
 * Cet outil charge, dans un vrai navigateur, une ressource de meme origine
 * servie avec un delai connu, puis deux ressources d une AUTRE origine (un
 * autre port) : l une sans `Timing-Allow-Origin`, l autre avec. Il verifie ce
 * que la vraie sonde en rapporte.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { ouvrirChrome, patienter } from './chrome.mjs';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const DELAI = 250;   // ms que le serveur attend avant de repondre

const PAGE = `<!doctype html><meta charset="utf-8"><title>minutage</title><body>
<script>window.__vus = [];
window.addEventListener('message', function (ev) {
  var d = ev && ev.data;
  if (d && d.__ic === 'jeton-de-test' && d.batch) {
    for (var i = 0; i < d.batch.length; i++) window.__vus.push(d.batch[i]);
  }
}, false);
</script>
<script data-ic-token="jeton-de-test"
  data-ic-cfg='{"perf":true,"wsFrames":false,"stacks":false,"vitals":false,"sse":false,"rtc":false,"workers":false}'
  src="/content/hooks.js"></script>
</body>`;

/* Deux serveurs : deux ports, donc deux origines. */
function servir(gestion) {
  const serveur = http.createServer(gestion);
  return new Promise(r => serveur.listen(0, '127.0.0.1', () => r(serveur)));
}

const page = await servir((req, res) => {
  const chemin = decodeURIComponent(req.url.split('?')[0]);
  if (chemin === '/' || chemin === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  if (chemin === '/lent') {
    return setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' });
      res.end('meme origine');
    }, DELAI);
  }
  const fichier = path.join(RACINE, chemin.replace(/^\/+/, ''));
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': 'text/javascript' });
  res.end(fs.readFileSync(fichier));
});

const autre = await servir((req, res) => {
  const tete = { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store',
                 'Access-Control-Allow-Origin': '*' };
  if (req.url.startsWith('/autorise')) tete['Timing-Allow-Origin'] = '*';
  setTimeout(() => { res.writeHead(200, tete); res.end('autre origine, dix octets'); }, DELAI);
});

const portPage = page.address().port;
const portAutre = autre.address().port;

const navigateur = await ouvrirChrome({ largeur: 900, hauteur: 600, echelle: 1 });
const onglet = navigateur.page;
await onglet('Page.navigate', { url: 'http://127.0.0.1:' + portPage + '/' });
await patienter(700);

async function dans(expression) {
  const { result, exceptionDetails } = await onglet('Runtime.evaluate', {
    expression: '(async () => {' + expression + '})()', returnByValue: true, awaitPromise: true
  });
  if (exceptionDetails) throw new Error(String(exceptionDetails.text));
  return result.value;
}

await dans(`
  await fetch('/lent').then(r => r.text());
  await fetch('http://127.0.0.1:${portAutre}/masque').then(r => r.text());
  await fetch('http://127.0.0.1:${portAutre}/autorise').then(r => r.text());
  await new Promise(r => setTimeout(r, 600));
  return true;
`);

const vus = await dans('return window.__vus;');
const entrees = vus.filter(e => e.t === 'perf').flatMap(e => e.entries || []);
const trouver = fin => entrees.find(e => String(e.name).endsWith(fin));

const ennuis = [];
const exige = (condition, quoi) => { if (!condition) ennuis.push(quoi); };

function montrer(nom, e) {
  if (!e) { console.log(nom.padEnd(22) + ': absente'); return; }
  console.log(nom.padEnd(22) + ': phases ' + (e.phasesFournies ? 'fournies' : 'MASQUEES')
    + ', ' + JSON.stringify(e.timings) + ', transferSize ' + e.transferSize);
}

const meme = trouver('/lent');
const masque = trouver('/masque');
const autorise = trouver('/autorise');
montrer('meme origine', meme);
montrer('autre, sans TAO', masque);
montrer('autre, avec TAO', autorise);

/* --- 1. Meme origine : de vraies phases, et rien d invente --- */
exige(meme, 'la ressource de meme origine n est pas vue');
if (meme) {
  const t = meme.timings;
  exige(meme.phasesFournies === true, 'meme origine : les phases devraient etre fournies');
  exige(t.send === -1, 'meme origine : « send » est invente (' + t.send + ') — le navigateur ne l expose pas');
  exige(t.wait >= DELAI - 20, 'meme origine : l attente du premier octet (' + t.wait + ') ne reflete pas le delai du serveur (' + DELAI + ')');
  exige(t.wait < DELAI + 2000, 'meme origine : l attente est demesuree (' + t.wait + ')');
  exige(t.receive >= 0 && t.receive < 1000, 'meme origine : la reception (' + t.receive + ') n est pas une duree');
  exige(t.ssl === -1, 'meme origine en http : un temps TLS est rapporte (' + t.ssl + ')');
  const somme = Object.values(t).reduce((a, b) => a + (b > 0 ? b : 0), 0);
  exige(somme <= meme.duration + 2, 'meme origine : la somme des phases (' + somme + ') depasse la duree (' + meme.duration + ')');
}

/* --- 2. Autre origine, sans Timing-Allow-Origin : masque, pas zero --- */
exige(masque, 'la ressource d une autre origine sans TAO n est pas vue');
if (masque) {
  exige(masque.phasesFournies === false, 'sans TAO : le masque du navigateur n est pas reconnu');
  exige(Object.values(masque.timings).every(v => v === -1),
    'sans TAO : des phases sont rapportees alors que le navigateur les a masquees : ' + JSON.stringify(masque.timings));
  exige(masque.transferSize === null && masque.encodedBodySize === null && masque.decodedBodySize === null,
    'sans TAO : des tailles masquees sont rapportees comme des mesures');
  exige(masque.duration >= DELAI - 20, 'sans TAO : la duree totale, toujours fournie, est perdue');
}

/* --- 3. Autre origine, avec Timing-Allow-Origin : les phases reviennent --- */
exige(autorise, 'la ressource d une autre origine avec TAO n est pas vue');
if (autorise) {
  exige(autorise.phasesFournies === true, 'avec TAO : les phases devraient etre fournies');
  exige(autorise.timings.wait >= DELAI - 20, 'avec TAO : l attente du premier octet est fausse (' + autorise.timings.wait + ')');
  exige(typeof autorise.transferSize === 'number', 'avec TAO : la taille transferee manque');
}

navigateur.fermer();
page.close();
autre.close();

console.log('');
if (!ennuis.length) {
  console.log('Minutage : seules des mesures reelles.');
  process.exit(0);
}
console.log('Minutage : ' + ennuis.length + ' ecart(s)');
for (const e of ennuis) console.log('  ' + e);
process.exit(1);
