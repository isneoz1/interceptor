/* Audit des sockets — INTERCEPTOR (by NeoZ)
 *
 *   node tools/sockets.mjs
 *
 * Tout ce qui ressemble a un socket dans un navigateur, mis a l epreuve pour
 * de bon : une vraie WebSocket contre un vrai serveur, dans la page, dans un
 * Worker et dans un SharedWorker ; un canal de donnees WebRTC entre deux
 * connexions de la meme page.
 *
 * Ce que l outil verifie, cas par cas :
 *
 *   1. la connexion est vue, avec son URL et son sous-protocole ;
 *   2. les trames TEXTE arrivent, dans les deux sens ;
 *   3. les trames BINAIRES arrivent AVEC LEURS OCTETS — c est ce qui permet
 *      de les decoder au lieu d en montrer la taille ;
 *   4. la fermeture est vue, avec son code ;
 *   5. la page n est pas derangee : elle recoit ses propres messages, et un
 *      `importScripts` relatif dans un worker resout toujours.
 *
 * Le serveur WebSocket tient en cinquante lignes : poignee de main RFC 6455
 * et trames non masquees. Aucune dependance, comme le reste du depot.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import url from 'node:url';
import { ouvrirChrome, patienter } from './chrome.mjs';

const RACINE = path.resolve(path.dirname(url.fileURLToPath(import.meta.url)), '..');
const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';   // RFC 6455, section 1.3

/* ------------------------- Un serveur WebSocket --------------------------- */
/** Encode une trame serveur : jamais masquee, longueur sur 1, 2 ou 8 octets. */
function trameServeur(charge, opcode) {
  const n = charge.length;
  let tete;
  if (n < 126) tete = Buffer.from([0x80 | opcode, n]);
  else if (n < 65536) {
    tete = Buffer.alloc(4);
    tete[0] = 0x80 | opcode; tete[1] = 126; tete.writeUInt16BE(n, 2);
  } else {
    tete = Buffer.alloc(10);
    tete[0] = 0x80 | opcode; tete[1] = 127; tete.writeBigUInt64BE(BigInt(n), 2);
  }
  return Buffer.concat([tete, charge]);
}

/** Lit les trames d un client : toujours masquees, comme l exige la RFC. */
function lireTrames(tampon, surTrame) {
  let reste = tampon;
  for (;;) {
    if (reste.length < 2) return reste;
    const opcode = reste[0] & 0x0f;
    const masque = (reste[1] & 0x80) !== 0;
    let n = reste[1] & 0x7f;
    let i = 2;
    if (n === 126) { if (reste.length < 4) return reste; n = reste.readUInt16BE(2); i = 4; }
    else if (n === 127) { if (reste.length < 10) return reste; n = Number(reste.readBigUInt64BE(2)); i = 10; }
    const cle = masque ? reste.subarray(i, i + 4) : null;
    if (masque) i += 4;
    if (reste.length < i + n) return reste;
    const charge = Buffer.from(reste.subarray(i, i + n));
    if (cle) for (let k = 0; k < charge.length; k++) charge[k] ^= cle[k % 4];
    surTrame(opcode, charge);
    reste = reste.subarray(i + n);
  }
}

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml' };

/* Les fichiers servis a la page : la sonde reelle, et de quoi l eprouver. */
const PAGE = `<!doctype html><meta charset="utf-8"><title>sockets</title><body>
<script>window.__vus = [];
window.addEventListener('message', function (ev) {
  var d = ev && ev.data;
  if (d && d.__ic === 'jeton-de-test' && d.batch) {
    for (var i = 0; i < d.batch.length; i++) window.__vus.push(d.batch[i]);
  }
}, false);
</script>
<script>
/* Une connexion ouverte AVANT la sonde : le Proxy du constructeur ne la verra
   jamais naitre. Elle doit quand meme etre adoptee des qu elle sert. */
window.__avant = new WebSocket('ws://127.0.0.1:__PORT__/echo');
window.__avant.binaryType = 'arraybuffer';
window.__avantRecu = [];
window.__poserLaSonde = function () {
  var el = document.createElement('script');
  el.async = false;
  el.dataset.icToken = 'jeton-de-test';
  el.dataset.icCfg = JSON.stringify({ wsFrames: true, workers: true, workerFrames: true,
    rtc: true, stacks: false, perf: false, vitals: false, sse: false });
  el.src = '/content/hooks.js';
  document.documentElement.appendChild(el);
};
</script>
</body>`;

/* Un worker classique : il importe un voisin PAR CHEMIN RELATIF, ce qui est
   precisement ce que le chargement depuis un Blob casserait sans rattrapage. */
const WORKER = `self.importScripts('./voisin.js');
var ws = new WebSocket(self.__adresse || 'ws://127.0.0.1:__PORT__/echo', 'chat');
ws.binaryType = 'arraybuffer';
ws.addEventListener('open', function () {
  ws.send('depuis-le-worker');
  ws.send(new Uint8Array([8, 150, 1]).buffer);
});
ws.addEventListener('message', function (ev) {
  self.postMessage({ recu: typeof ev.data === 'string' ? ev.data : 'binaire' });
});
self.postMessage({ voisin: self.__VOISIN__ || null });`;

const VOISIN = 'self.__VOISIN__ = "le voisin a ete importe";';

const PARTAGE = `self.onconnect = function (e) {
  var port = e.ports[0];
  port.start();
  var ws = new WebSocket('ws://127.0.0.1:__PORT__/echo');
  ws.addEventListener('open', function () { ws.send('depuis-le-partage'); });
  ws.addEventListener('message', function (ev) { port.postMessage({ recu: ev.data }); });
};`;

const serveur = http.createServer((req, res) => {
  let chemin = decodeURIComponent(req.url.split('?')[0]);
  if (chemin === '/' || chemin === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(PAGE.replace('__PORT__', String(port)));
  }
  if (chemin === '/worker.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(WORKER.replace('__PORT__', String(port)));
  }
  if (chemin === '/voisin.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(VOISIN);
  }
  if (chemin === '/partage.js') {
    res.writeHead(200, { 'Content-Type': 'text/javascript' });
    return res.end(PARTAGE.replace('__PORT__', String(port)));
  }
  const fichier = path.join(RACINE, chemin.replace(/^\/+/, ''));
  if (!fichier.startsWith(RACINE) || !fs.existsSync(fichier)) {
    res.writeHead(404); return res.end('non trouve');
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(fichier)] || 'application/octet-stream' });
  res.end(fs.readFileSync(fichier));
});

/* La poignee de main, puis un echo : ce que le client envoie lui revient. */
serveur.on('upgrade', (req, socket) => {
  const cle = req.headers['sec-websocket-key'] || '';
  const accept = crypto.createHash('sha1').update(cle + GUID).digest('base64');
  const protocoles = String(req.headers['sec-websocket-protocol'] || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  const tetes = [
    'HTTP/1.1 101 Switching Protocols', 'Upgrade: websocket', 'Connection: Upgrade',
    'Sec-WebSocket-Accept: ' + accept
  ];
  if (protocoles.length) tetes.push('Sec-WebSocket-Protocol: ' + protocoles[0]);
  socket.write(tetes.join('\r\n') + '\r\n\r\n');

  /* Le serveur POUSSE, sans etre sollicite : c est ce que fait un jeu quand il
     envoie l etat du monde des la connexion. Un client qui n a encore rien
     envoye doit voir ces trames — c est le cas d un Unity WebGL comme MSP2. */
  if (String(req.url || '').split('?')[0] === '/push') {
    socket.write(trameServeur(Buffer.from('pousse-du-serveur'), 0x1));
    socket.write(trameServeur(Buffer.from([7, 7, 7]), 0x2));
  }

  let tampon = Buffer.alloc(0);
  socket.on('data', morceau => {
    tampon = Buffer.concat([tampon, morceau]);
    tampon = lireTrames(tampon, (opcode, charge) => {
      if (opcode === 0x8) { try { socket.end(trameServeur(charge, 0x8)); } catch { /* deja ferme */ } return; }
      if (opcode === 0x1 || opcode === 0x2) socket.write(trameServeur(charge, opcode));
    });
  });
  socket.on('error', () => { /* le client est parti */ });
});

let port = 0;
await new Promise(resoudre => serveur.listen(0, '127.0.0.1', () => {
  port = serveur.address().port;
  resoudre();
}));

/* ------------------------------ Le navigateur ----------------------------- */
const navigateur = await ouvrirChrome({ largeur: 1000, hauteur: 700, echelle: 1 });
const page = navigateur.page;
await page('Page.navigate', { url: 'http://127.0.0.1:' + port + '/' });
await patienter(900);

async function dans(expression) {
  const { result, exceptionDetails } = await page('Runtime.evaluate', {
    expression: '(async () => {' + expression + '})()', returnByValue: true, awaitPromise: true
  });
  if (exceptionDetails) {
    throw new Error(String((exceptionDetails.exception && exceptionDetails.exception.description)
      || exceptionDetails.text).split('\n')[0]);
  }
  return result.value;
}

const ennuis = [];
const noter = (quoi, detail) => ennuis.push(quoi + ' — ' + detail);

/* --- 0. Une connexion nee AVANT la sonde --- */
/* Le Proxy du constructeur ne voit que ce qui nait apres lui. Celle-ci existe
   deja : elle doit etre adoptee des qu elle sert, sinon « tout capturer » est
   faux pour toute page dont un script court plus vite que l injection. */
await dans('window.__poserLaSonde(); return true;');
await patienter(700);
const ancienneOk = await dans(`
  const ws = window.__avant;
  ws.addEventListener('message', e => window.__avantRecu.push(e.data));
  if (ws.readyState !== 1) await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.send('nee-avant-la-sonde');
  await new Promise(r => setTimeout(r, 400));
  return { etat: ws.readyState, recus: window.__avantRecu.length };
`);
console.log('avant     : ' + JSON.stringify(ancienneOk));

/* --- 1. Une WebSocket ouverte par la page --- */
const pageOk = await dans(`
  const ws = new WebSocket('ws://127.0.0.1:${port}/echo', 'chat');
  ws.binaryType = 'arraybuffer';
  const recu = [];
  ws.addEventListener('message', e => recu.push(e.data));
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  ws.send('bonjour');
  ws.send(new Uint8Array([8, 150, 1]).buffer);
  await new Promise(r => setTimeout(r, 400));
  ws.close(1000, 'fini');
  await new Promise(r => setTimeout(r, 300));
  return { recus: recu.length, protocole: ws.protocol };
`);
console.log('page       : ' + pageOk.recus + ' message(s) recus, sous-protocole « '
  + pageOk.protocole + ' »');

/* --- 1bis. Le motif exact d un jeu Unity WebGL (MSP2) --- */
/* Unity pose son gestionnaire par `ws.onmessage = ...` — le mutateur, pas
   addEventListener — et recoit des trames que le client n a pas sollicitees :
   l etat du monde, pousse a la connexion. Aucun autre cas n eprouve ces deux
   choses ensemble, et ce sont exactement celles d un jeu. */
const jeuOk = await dans(`
  const ws = new WebSocket('ws://127.0.0.1:${port}/push');
  ws.binaryType = 'arraybuffer';
  const recu = [];
  ws.onmessage = e => recu.push(typeof e.data === 'string' ? e.data : new Uint8Array(e.data).join(','));
  await new Promise(r => ws.addEventListener('open', r, { once: true }));
  await new Promise(r => setTimeout(r, 400));
  ws.send(new Uint8Array([8, 150, 1]).buffer);
  await new Promise(r => setTimeout(r, 300));
  return recu;
`);
console.log('jeu        : ' + JSON.stringify(jeuOk));

/* --- 2. Une WebSocket ouverte dans un Worker --- */
const workerOk = await dans(`
  const w = new Worker('/worker.js');
  const vus = [];
  w.addEventListener('message', e => vus.push(e.data));
  await new Promise(r => setTimeout(r, 1200));
  w.terminate();
  return vus;
`);
console.log('worker     : ' + JSON.stringify(workerOk));

/* --- 3. Une WebSocket dans un SharedWorker --- */
const partageOk = await dans(`
  try {
    const sw = new SharedWorker('/partage.js');
    const vus = [];
    sw.port.addEventListener('message', e => vus.push(e.data));
    sw.port.start();
    await new Promise(r => setTimeout(r, 1200));
    return vus;
  } catch (e) { return { erreur: String(e.message) }; }
`);
console.log('partage    : ' + JSON.stringify(partageOk));

/* --- 4. Un canal de donnees WebRTC, en boucle locale --- */
const rtcOk = await dans(`
  try {
    const a = new RTCPeerConnection(), b = new RTCPeerConnection();
    a.onicecandidate = e => e.candidate && b.addIceCandidate(e.candidate);
    b.onicecandidate = e => e.candidate && a.addIceCandidate(e.candidate);
    const canal = a.createDataChannel('essai');
    const recus = [];
    b.ondatachannel = e => { e.channel.onmessage = m => recus.push(m.data); };
    const offre = await a.createOffer();
    await a.setLocalDescription(offre);
    await b.setRemoteDescription(offre);
    const reponse = await b.createAnswer();
    await b.setLocalDescription(reponse);
    await a.setRemoteDescription(reponse);
    await new Promise(r => { canal.onopen = r; setTimeout(r, 3000); });
    canal.send('salut-le-pair');
    canal.send(new Uint8Array([129, 161, 97, 1]).buffer);
    await new Promise(r => setTimeout(r, 600));
    return { ouvert: canal.readyState, recus: recus.length };
  } catch (e) { return { erreur: String(e.message) }; }
`);
console.log('webrtc     : ' + JSON.stringify(rtcOk));

/* ---------------------------- Ce que la sonde a vu ------------------------ */
const vus = await dans('return window.__vus;');

const ouvertures = vus.filter(e => e.t === 'ws:open');
const trames = vus.filter(e => e.t === 'ws:frame');
const fermetures = vus.filter(e => e.t === 'ws:close');

console.log('\nLa sonde a vu :');
console.log('  ' + ouvertures.length + ' ouverture(s) : '
  + ouvertures.map(e => e.url + ' [' + (e.transport || 'websocket') + ']').join(', '));
console.log('  ' + trames.length + ' trame(s), dont '
  + trames.filter(t => t.base64).length + ' avec leurs octets');
console.log('  ' + fermetures.length + ' fermeture(s)');

/* --------------------------------- Verdict -------------------------------- */
const parPid = new Map();
for (const e of trames) {
  if (!parPid.has(e.pid)) parPid.set(e.pid, []);
  parPid.get(e.pid).push(e);
}

function exige(condition, quoi, detail) {
  if (!condition) noter(quoi, detail);
}

exige(trames.some(t => t.data === 'nee-avant-la-sonde'),
  'adoption', 'une connexion ouverte avant la sonde n est pas adoptee');
exige(ouvertures.some(e => /\/echo$/.test(String(e.url)) && !String(e.pid).startsWith('w')),
  'page', 'aucune WebSocket de page vue');
exige(trames.some(t => t.data === 'bonjour'), 'page', 'la trame texte envoyee n est pas vue');
exige(trames.some(t => t.base64 === 'CJYB' && t.dir === 'send'),
  'page', 'les octets de la trame binaire envoyee manquent');
exige(trames.some(t => t.base64 === 'CJYB' && t.dir === 'recv'),
  'page', 'les octets de la trame binaire recue manquent');
exige(vus.some(e => e.t === 'ws:protocol' && e.protocol === 'chat'),
  'page', 'le sous-protocole negocie n est pas vu');
exige(fermetures.some(e => e.code === 1000), 'page', 'la fermeture propre n est pas vue');

exige(trames.some(t => t.dir === 'recv' && t.data === 'pousse-du-serveur'),
  'jeu', 'une trame TEXTE poussee par le serveur (gestionnaire onmessage) n est pas vue');
exige(trames.some(t => t.dir === 'recv' && t.base64 === 'BwcH'),
  'jeu', 'les octets d une trame BINAIRE poussee par le serveur manquent');
exige(Array.isArray(jeuOk) && jeuOk.includes('pousse-du-serveur') && jeuOk.includes('7,7,7'),
  'jeu', 'la page elle-meme ne recoit plus ses trames poussees : ' + JSON.stringify(jeuOk));

exige(trames.some(t => t.data === 'depuis-le-worker'),
  'worker', 'la trame envoyee depuis un Worker n est pas vue');
exige(trames.some(t => String(t.pid).startsWith('w') && t.base64 === 'CJYB'),
  'worker', 'les octets binaires envoyes depuis un Worker manquent');
exige(Array.isArray(workerOk) && workerOk.some(m => m && m.voisin),
  'worker', 'l importScripts relatif du worker ne resout plus : ' + JSON.stringify(workerOk));
exige(Array.isArray(workerOk) && workerOk.some(m => m && m.recu),
  'worker', 'la page ne recoit plus les messages de son worker');

exige(trames.some(t => t.data === 'depuis-le-partage'),
  'sharedworker', 'la trame envoyee depuis un SharedWorker n est pas vue');
exige(Array.isArray(partageOk) && partageOk.some(m => m && m.recu),
  'sharedworker', 'la page ne recoit plus les messages de son SharedWorker');

exige(ouvertures.some(e => e.transport === 'rtc'),
  'webrtc', 'le canal de donnees n est pas vu');
exige(trames.some(t => t.data === 'salut-le-pair'),
  'webrtc', 'la trame texte du canal de donnees n est pas vue');
exige(trames.some(t => t.base64 === 'gaFhAQ=='),
  'webrtc', 'les octets binaires du canal de donnees manquent');

navigateur.fermer();
serveur.close();

console.log('');
if (!ennuis.length) {
  console.log('Sockets : tout est capture.');
  process.exit(0);
}
console.log('Sockets : ' + ennuis.length + ' manque(s)');
for (const e of ennuis) console.log('  ' + e);
process.exit(1);
