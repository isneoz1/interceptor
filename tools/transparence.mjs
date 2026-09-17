/* Audit de transparence — INTERCEPTOR (by NeoZ)
 *
 *   node tools/transparence.mjs
 *
 * Les sondes remplacent des objets de la page : `fetch`, `WebSocket`,
 * `XMLHttpRequest`, `Worker`, `RTCPeerConnection`, `WebTransport`,
 * `sendBeacon`, `document.cookie`. Chaque remplacement est une facon de
 * casser un site.
 *
 * Le contrat ecrit en tete de content/hooks.js est « PUREMENT passif ». Cet
 * outil le verifie, dans un vrai navigateur, en comparant CE QUE VOIT LA PAGE
 * avant et apres l installation des sondes :
 *
 *   1. le nom, la longueur et le prototype de chaque fonction remplacee ;
 *   2. `instanceof` et la chaine de prototypes des objets construits ;
 *   3. `Function.prototype.toString` — un site qui cherche « [native code] » ;
 *   4. les descripteurs de propriete des globales touchees ;
 *   5. les erreurs : meme type, meme message, aux memes endroits ;
 *   6. les valeurs de retour, y compris pour les appels tordus.
 *
 * Il ne produit aucune image : un verdict, et un code de sortie.
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { ouvrirChrome, patienter } from './chrome.mjs';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json' };

/* La page se mesure elle-meme AVANT, puis charge les sondes, puis se remesure.
   Comparer les deux releves est la seule facon honnete de repondre. */
const PAGE = `<!doctype html><meta charset="utf-8"><title>transparence</title><body>
<script>
window.__vus = [];
window.addEventListener('message', function (ev) {
  var d = ev && ev.data;
  if (d && d.__ic === 'jeton-de-test' && d.batch) Array.prototype.push.apply(window.__vus, d.batch);
}, false);

window.__releve = function () {
  var out = {};
  function noter(cle, fn) { try { out[cle] = fn(); } catch (e) { out[cle] = 'ERREUR: ' + e.message; } }

  /* 1. Signature des fonctions remplacees. */
  var fonctions = {
    'fetch': function () { return window.fetch; },
    'WebSocket': function () { return window.WebSocket; },
    'XMLHttpRequest': function () { return window.XMLHttpRequest; },
    'XMLHttpRequest.open': function () { return XMLHttpRequest.prototype.open; },
    'XMLHttpRequest.send': function () { return XMLHttpRequest.prototype.send; },
    'Worker': function () { return window.Worker; },
    'SharedWorker': function () { return window.SharedWorker; },
    'RTCPeerConnection': function () { return window.RTCPeerConnection; },
    'sendBeacon': function () { return navigator.sendBeacon; },
    'EventSource': function () { return window.EventSource; },
    'WebSocket.send': function () { return WebSocket.prototype.send; }
  };
  Object.keys(fonctions).forEach(function (nom) {
    noter('sig:' + nom, function () {
      var f = fonctions[nom]();
      if (typeof f !== 'function') return 'absent';
      return f.name + '|' + f.length + '|' + (typeof f.prototype);
    });
    /* Un site qui verifie « [native code] » ne doit pas voir autre chose. */
    noter('natif:' + nom, function () {
      var f = fonctions[nom]();
      return typeof f === 'function' ? /\\[native code\\]/.test(Function.prototype.toString.call(f)) : 'absent';
    });
  });

  /* 2. Descripteurs des globales touchees. */
  ['fetch', 'WebSocket', 'XMLHttpRequest', 'Worker', 'EventSource'].forEach(function (nom) {
    noter('desc:' + nom, function () {
      var d = Object.getOwnPropertyDescriptor(window, nom);
      if (!d) return 'absent';
      return [!!d.writable, !!d.enumerable, !!d.configurable, typeof d.value].join('|');
    });
  });

  /* 3. instanceof et chaine de prototypes des objets construits. */
  noter('instance:WebSocket', function () {
    var ws = new WebSocket('ws://127.0.0.1:1/neant');
    var r = [ws instanceof WebSocket, Object.getPrototypeOf(ws) === WebSocket.prototype,
             typeof ws.send, ws.readyState === 0 || ws.readyState === 3].join('|');
    try { ws.close(); } catch (e) {}
    return r;
  });
  noter('instance:XHR', function () {
    var x = new XMLHttpRequest();
    return [x instanceof XMLHttpRequest, Object.getPrototypeOf(x) === XMLHttpRequest.prototype,
            x.readyState].join('|');
  });
  noter('instance:RTC', function () {
    if (!window.RTCPeerConnection) return 'absent';
    var pc = new RTCPeerConnection();
    var r = [pc instanceof RTCPeerConnection,
             Object.getPrototypeOf(pc) === RTCPeerConnection.prototype].join('|');
    pc.close();
    return r;
  });

  /* 4. Sous-classement : un site qui etend WebSocket doit continuer. */
  noter('sousclasse:WebSocket', function () {
    var Mien = function () {};
    try {
      eval('Mien = class Mien extends WebSocket { constructor(u) { super(u); this.marque = 1; } }');
    } catch (e) { return 'eval refuse'; }
    var m = new Mien('ws://127.0.0.1:1/neant');
    var r = [m instanceof Mien, m instanceof WebSocket, m.marque,
             Object.getPrototypeOf(m) === Mien.prototype].join('|');
    try { m.close(); } catch (e) {}
    return r;
  });

  /* 5. Les erreurs : meme type, meme endroit. */
  noter('erreur:fetch-sans-arg', function () {
    try { window.fetch(); return 'aucune erreur'; }
    catch (e) { return e.constructor.name; }
  });
  noter('erreur:WebSocket-sans-new', function () {
    try { window.WebSocket('ws://x'); return 'aucune erreur'; }
    catch (e) { return e.constructor.name; }
  });
  noter('erreur:WebSocket-url-invalide', function () {
    try { new WebSocket('pas-une-url'); return 'aucune erreur'; }
    catch (e) { return e.constructor.name; }
  });
  noter('erreur:Worker-url-vide', function () {
    try { var w = new Worker(''); w.terminate(); return 'aucune erreur'; }
    catch (e) { return e.constructor.name; }
  });
  noter('erreur:xhr-open-sans-arg', function () {
    try { new XMLHttpRequest().open(); return 'aucune erreur'; }
    catch (e) { return e.constructor.name; }
  });

  /* 6. Valeurs de retour et formes d appel tordues. */
  noter('retour:fetch-promesse', function () {
    var p = window.fetch('/neant.txt');
    var r = (p && typeof p.then === 'function') ? 'promesse' : typeof p;
    p.catch(function () {});
    return r;
  });
  noter('retour:fetch-detache', function () {
    /* Un site qui detache la fonction avant de l appeler : le receveur vaut
       alors undefined, ce que l implementation native accepte. */
    var f = window.fetch;
    try { var p = f('/neant.txt'); p.catch(function () {}); return 'ok'; }
    catch (e) { return 'ERREUR: ' + e.message; }
  });
  noter('retour:sendBeacon', function () {
    if (!navigator.sendBeacon) return 'absent';
    return typeof navigator.sendBeacon('/neant.txt', 'x');
  });
  noter('retour:cookie', function () {
    document.cookie = 'ic_essai=1; path=/';
    return /ic_essai=1/.test(document.cookie) ? 'relu' : 'perdu';
  });
  noter('retour:cookie-descripteur', function () {
    var d = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')
         || Object.getOwnPropertyDescriptor(document, 'cookie');
    return d ? [typeof d.get, typeof d.set, !!d.configurable].join('|') : 'absent';
  });

  /* 7. Le nombre de proprietes propres de window ne doit pas exploser. */
  noter('window:proprietes', function () {
    return Object.getOwnPropertyNames(window).filter(function (n) {
      return /^__INTERCEPTOR|^__ic/.test(n);
    }).sort().join(',') || 'aucune';
  });

  return out;
};
</script>
</body>`;

const serveur = http.createServer((req, res) => {
  const chemin = decodeURIComponent(req.url.split('?')[0]);
  if (chemin === '/' || chemin === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE);
  }
  const fichier = path.join(RACINE, chemin.replace(/^\/+/, ''));
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier)) {
    res.writeHead(404); return res.end('non trouve');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'text/plain' });
  res.end(fs.readFileSync(fichier));
});

let port = 0;
await new Promise(r => serveur.listen(0, '127.0.0.1', () => { port = serveur.address().port; r(); }));

const navigateur = await ouvrirChrome({ largeur: 900, hauteur: 600, echelle: 1 });
const page = navigateur.page;
await page('Page.navigate', { url: 'http://127.0.0.1:' + port + '/' });
await patienter(1000);

async function dans(expression) {
  const { result, exceptionDetails } = await page('Runtime.evaluate', {
    expression: '(() => {' + expression + '})()', returnByValue: true, awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(String((exceptionDetails.exception && exceptionDetails.exception.description)
      || exceptionDetails.text).split('\n')[0]);
  }
  return result.value;
}

/* Le releve AVANT : la page telle qu elle est sans nous. */
const avant = await dans('return window.__releve();');

/* On installe les sondes, exactement comme le pont le fait. */
await dans(`
  const el = document.createElement('script');
  el.async = false;
  el.dataset.icToken = 'jeton-de-test';
  el.dataset.icCfg = JSON.stringify({ wsFrames: true, workers: true, workerFrames: true,
    rtc: true, sse: true, perf: true, stacks: true, jsCookies: true,
    webTransport: true, vitals: true });
  el.src = '/content/hooks.js';
  document.documentElement.appendChild(el);
  return true;
`);
await patienter(800);

const apres = await dans('return window.__releve();');

/* ----------------------------- Comparaison ------------------------------- */
const ennuis = [];

/* Ce qui DOIT changer, et pourquoi. Tout le reste doit rester identique. */
const ATTENDU = new Map([
  ['window:proprietes', 'la sonde pose son drapeau de presence : c est voulu']
]);

for (const cle of Object.keys(avant)) {
  const a = JSON.stringify(avant[cle]);
  const b = JSON.stringify(apres[cle]);
  if (a === b) continue;
  if (ATTENDU.has(cle)) {
    console.log('  (voulu) ' + cle + ' : ' + a + '  ->  ' + b);
    continue;
  }
  ennuis.push(cle + ' : la page voyait ' + a + ', elle voit maintenant ' + b);
}

const total = Object.keys(avant).length;
console.log('\n' + total + ' observations comparees avant et apres l installation des sondes');

/* Les sondes doivent quand meme avoir fonctionne : un audit qui ne casse rien
   parce qu il n a rien installe ne prouve rien. */
const vus = await dans('return window.__vus.length;');
console.log((vus > 0 ? '  ' : '  !! ') + vus + ' evenement(s) observes par la sonde pendant le releve');
if (!vus) ennuis.push('la sonde n a rien observe : le releve ne prouve rien');

navigateur.fermer();
serveur.close();

console.log('');
if (!ennuis.length) {
  console.log('Transparence : la page ne voit aucune difference.');
  process.exit(0);
}
console.log('Transparence : ' + ennuis.length + ' difference(s) visibles par la page');
for (const e of ennuis) console.log('  ' + e);
process.exit(1);
