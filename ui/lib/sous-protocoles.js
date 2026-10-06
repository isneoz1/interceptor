/* Sous-protocoles WebSocket — SWIFT (by NeoZ)
 *
 * Une trame WebSocket capturee ressemble a « 42["order",{"id":77}] ». Lue
 * telle quelle, elle ne dit rien. C est en realite un paquet Engine.IO de
 * type 4 (message) contenant un paquet socket.io de type 2 (event), dont le
 * nom vaut « order ». Le meme trafic, une fois decoupe, se lit d un coup.
 *
 * Trois familles couvrent la quasi-totalite du trafic WebSocket applicatif :
 *
 *   Engine.IO / socket.io   « <type><donnees> », puis « <type>[pieces-]
 *                           [espace,][ack]<JSON> » — la pile la plus repandue
 *   STOMP                   protocole texte : commande, entetes, corps, NUL
 *   SignalR                 JSON separe par 0x1E, chaque objet portant un
 *                           champ « type » numerique
 *
 * Rien n est devine : chaque decoupage suit la specification publiee du
 * protocole, et quand la forme ne correspond pas on le dit plutot que de
 * rendre une lecture inventee.
 *
 * Les autres familles — GraphQL, JSON-RPC, WAMP, SockJS, Phoenix, Action
 * Cable, Pusher — vivent dans sous-protocoles-plus.js, MQTT dans mqtt.js. Le
 * point d entree unique est plus bas : `lireSousProtocole` pour le texte,
 * `lireSousProtocoleBinaire` pour les octets.
 */
import { base64VersOctets } from './bytes.js';
import { lireMqtt, niveauDuConnect, resumerMqtt } from './mqtt.js';
import {
  lireGraphqlWs, lireJsonRpc, lireWamp, lireSockJs, lirePhoenix, lireActionCable,
  lirePusher, RESUMES_PLUS, resumerSockJs
} from './sous-protocoles-plus.js';

/* ------------------------------- Engine.IO -------------------------------- */
/* https://github.com/socketio/engine.io-protocol — le premier caractere est
   le type de paquet, le reste sa charge utile. */
const ENGINE_IO = {
  '0': 'open',
  '1': 'close',
  '2': 'ping',
  '3': 'pong',
  '4': 'message',
  '5': 'upgrade',
  '6': 'noop'
};

/* https://github.com/socketio/socket.io-protocol — a l interieur d un paquet
   Engine.IO de type « message ». */
const SOCKET_IO = {
  '0': 'CONNECT',
  '1': 'DISCONNECT',
  '2': 'EVENT',
  '3': 'ACK',
  '4': 'CONNECT_ERROR',
  '5': 'BINARY_EVENT',
  '6': 'BINARY_ACK'
};

/**
 * Lit un paquet socket.io, deja debarrasse de son enveloppe Engine.IO.
 * Forme : `<type>[<pieces>-][<espace>,][<ack>]<JSON>`
 */
function lireSocketIo(texte) {
  const type = texte[0];
  if (!SOCKET_IO[type]) return null;
  let reste = texte.slice(1);
  const paquet = { type: SOCKET_IO[type], typeNumero: Number(type) };

  /* Les paquets binaires annoncent d abord combien de pieces jointes suivent :
     « 51-["photo",{...}] » attend une piece. */
  if (type === '5' || type === '6') {
    const tiret = reste.indexOf('-');
    if (tiret > 0 && /^\d+$/.test(reste.slice(0, tiret))) {
      paquet.pieces = Number(reste.slice(0, tiret));
      reste = reste.slice(tiret + 1);
    }
  }

  /* L espace de noms, quand il n est pas la racine, se termine par une
     virgule : « 2/admin,["ping"] ». */
  if (reste.startsWith('/')) {
    const virgule = reste.indexOf(',');
    paquet.espace = virgule < 0 ? reste : reste.slice(0, virgule);
    reste = virgule < 0 ? '' : reste.slice(virgule + 1);
  } else {
    paquet.espace = '/';
  }

  /* L identifiant d accuse de reception, s il y en a un. */
  const ack = /^\d+/.exec(reste);
  if (ack) {
    paquet.ack = Number(ack[0]);
    reste = reste.slice(ack[0].length);
  }

  if (reste) {
    try {
      paquet.donnees = JSON.parse(reste);
      /* Pour un EVENT, le premier element du tableau est le nom emis : c est
         l information que l on cherche en premier en lisant un flux. */
      if (Array.isArray(paquet.donnees) && paquet.donnees.length) {
        if (typeof paquet.donnees[0] === 'string') paquet.evenement = paquet.donnees[0];
        paquet.arguments = paquet.donnees.slice(1);
      }
    } catch {
      paquet.brut = reste;
    }
  }
  return paquet;
}

/** Lit une trame Engine.IO, et le paquet socket.io qu elle transporte. */
export function lireEngineIo(entree) {
  const texte = String(entree == null ? '' : entree);
  const type = texte[0];
  if (!ENGINE_IO[type]) throw new Error('premier caractere hors des types Engine.IO 0-6');

  const out = {
    protocole: 'Engine.IO',
    type: ENGINE_IO[type],
    typeNumero: Number(type)
  };
  const charge = texte.slice(1);

  /* Les paquets de controle ont une forme fixe. Sans cette rigueur, un texte
     comme « 2024-09-23 » ou le nombre « 3 » passait pour un ping ou un pong. */
  if ((type === '1' || type === '5' || type === '6') && charge) {
    throw new Error('le paquet Engine.IO « ' + ENGINE_IO[type] + ' » ne porte rien');
  }
  if ((type === '2' || type === '3') && charge && charge !== 'probe') {
    throw new Error('ping et pong Engine.IO ne portent que « probe »');
  }

  /* « open » transporte la poignee de main : identifiant de session, delais. */
  if (type === '0') {
    let poignee;
    try { poignee = JSON.parse(charge); } catch { poignee = null; }
    if (!poignee || typeof poignee !== 'object' || typeof poignee.sid !== 'string') {
      throw new Error('la poignee de main Engine.IO porte un objet JSON avec « sid »');
    }
    out.poignee = poignee;
    return out;
  }

  if (type === '4') {
    const paquet = lireSocketIo(charge);
    if (paquet) out.socketIo = paquet;
    else if (charge) out.brut = charge;
  } else if (charge) {
    out.brut = charge;
  }
  return out;
}

/* ---------------------------------- STOMP --------------------------------- */
/* https://stomp.github.io/stomp-specification-1.2.html
   COMMANDE, puis des entetes « cle:valeur », une ligne vide, le corps, et un
   octet NUL final. */
const COMMANDES_STOMP = new Set([
  'CONNECT', 'STOMP', 'CONNECTED', 'SEND', 'SUBSCRIBE', 'UNSUBSCRIBE',
  'ACK', 'NACK', 'BEGIN', 'COMMIT', 'ABORT', 'DISCONNECT',
  'MESSAGE', 'RECEIPT', 'ERROR'
]);

/* Dans les entetes STOMP 1.2, ces sequences sont echappees. */
function desechapperStomp(valeur) {
  return valeur.replace(/\\(.)/g, (tout, c) =>
    ({ n: '\n', r: '\r', c: ':', '\\': '\\' })[c] ?? c);
}

export function lireStomp(entree) {
  const texte = String(entree == null ? '' : entree).replace(/\0$/, '');
  const finLigne = texte.indexOf('\n');
  const commande = (finLigne < 0 ? texte : texte.slice(0, finLigne)).trim();
  if (!COMMANDES_STOMP.has(commande)) {
    throw new Error('« ' + commande.slice(0, 20) + ' » n est pas une commande STOMP');
  }
  /* Une trame STOMP est « COMMANDE EOL *(entete EOL) EOL corps NUL » : la
     ligne vide qui clot les entetes y est toujours. Sans elle, un message de
     discussion valant « ERROR » ou « ABORT » passait pour du STOMP. */
  const reste = texte.slice(finLigne + 1);
  const separation = /(^|\r?\n)\r?\n/.exec(reste);
  if (finLigne < 0 || !separation) {
    throw new Error('trame STOMP sans la ligne vide qui clot ses entetes');
  }

  const out = { protocole: 'STOMP', commande, entetes: {} };
  const blocEntetes = reste.slice(0, separation.index);
  out.corps = reste.slice(separation.index + separation[0].length);
  if (!out.corps) delete out.corps;

  for (const brute of blocEntetes.split('\n')) {
    const ligne = brute.replace(/\r$/, '');       // STOMP 1.2 admet CRLF
    if (!ligne.trim()) continue;
    const deuxPoints = ligne.indexOf(':');
    if (deuxPoints < 0) continue;
    const nom = desechapperStomp(ligne.slice(0, deuxPoints));
    /* La specification impose de garder la PREMIERE valeur d un entete
       repete, contrairement a HTTP. */
    if (!(nom in out.entetes)) out.entetes[nom] = desechapperStomp(ligne.slice(deuxPoints + 1));
  }

  if (out.corps && /json/i.test(out.entetes['content-type'] || '')) {
    try { out.json = JSON.parse(out.corps); } catch { /* corps non conforme */ }
  }
  return out;
}

/* --------------------------------- SignalR -------------------------------- */
/* https://github.com/dotnet/aspnetcore/blob/main/src/SignalR/docs/specs/HubProtocol.md
   Le protocole JSON separe les messages par 0x1E, et chaque objet porte un
   champ « type » numerique. */
const SEPARATEUR_SIGNALR = '\u001e';

const SIGNALR = {
  1: 'Invocation',
  2: 'StreamItem',
  3: 'Completion',
  4: 'StreamInvocation',
  5: 'CancelInvocation',
  6: 'Ping',
  7: 'Close',
  /* Reconnexion avec etat (.NET 8) : accuse de reception et numero de suite. */
  8: 'Ack',
  9: 'Sequence'
};

export function lireSignalR(entree) {
  const texte = String(entree == null ? '' : entree);
  if (!texte.includes(SEPARATEUR_SIGNALR)) {
    throw new Error('separateur SignalR (0x1E) absent');
  }

  const messages = [];
  for (const morceau of texte.split(SEPARATEUR_SIGNALR)) {
    if (!morceau.trim()) continue;
    let objet;
    try { objet = JSON.parse(morceau); } catch { throw new Error('message SignalR illisible en JSON'); }
    /* WAMP en lot separe aussi ses messages par 0x1E : un tableau, ou un
       objet sans type SignalR connu, n est pas du SignalR. */
    if (!objet || typeof objet !== 'object' || Array.isArray(objet)) {
      throw new Error('un message SignalR est un objet JSON');
    }

    /* La negociation initiale n a pas de champ « type » : elle annonce le
       protocole et sa version. */
    if (typeof objet.protocol === 'string') {
      messages.push({ type: 'Handshake', protocole: objet.protocol, version: objet.version });
      continue;
    }
    /* La reponse du serveur a cette negociation : un objet vide, ou une erreur. */
    const cles = Object.keys(objet);
    if (!cles.length || (cles.length === 1 && typeof objet.error === 'string')) {
      messages.push({ type: 'HandshakeResponse', ...(objet.error ? { erreur: objet.error } : {}) });
      continue;
    }
    if (!Number.isInteger(objet.type) || !SIGNALR[objet.type]) {
      throw new Error('type de message SignalR inconnu');
    }
    const message = { type: SIGNALR[objet.type], typeNumero: objet.type };
    if (objet.target) message.cible = objet.target;
    if (objet.invocationId) message.invocation = objet.invocationId;
    if (objet.arguments) message.arguments = objet.arguments;
    if (objet.item !== undefined) message.element = objet.item;
    if (objet.result !== undefined) message.resultat = objet.result;
    if (objet.error) message.erreur = objet.error;
    messages.push(message);
  }
  if (!messages.length) throw new Error('aucun message SignalR dans cette trame');
  return { protocole: 'SignalR', messages };
}

/* --------------------------- Reconnaissance ------------------------------- */
/**
 * Ce que la connexion prouve d elle-meme : le sous-protocole negocie a la
 * poignee de main, l URL, et pour MQTT le niveau ecrit dans le CONNECT.
 *
 * @param contexte  une chaine (le sous-protocole, forme historique) ou
 *                  { sousProtocole, url, niveauMqtt }
 */
/* Une connexion lit toutes ses trames avec le meme contexte : on ne relit pas
   son URL a chaque trame. */
const indicesParObjet = new WeakMap();
const indicesParChaine = new Map();

export function indicesDeContexte(contexte) {
  if (contexte && typeof contexte === 'object') {
    let deja = indicesParObjet.get(contexte);
    if (!deja) { deja = calculerIndices(contexte); indicesParObjet.set(contexte, deja); }
    return deja;
  }
  const cle = String(contexte || '');
  let deja = indicesParChaine.get(cle);
  if (!deja) {
    if (indicesParChaine.size > 64) indicesParChaine.clear();
    deja = calculerIndices({ sousProtocole: cle });
    indicesParChaine.set(cle, deja);
  }
  return deja;
}

function calculerIndices(c) {
  const sp = String(c.sousProtocole || '').trim().toLowerCase();
  let chemin = '';
  let parametres = new URLSearchParams();
  try {
    const u = new URL(String(c.url || ''));
    chemin = u.pathname;
    parametres = u.searchParams;
  } catch { /* pas d URL : aucune preuve a en tirer */ }
  return {
    sp,
    /* socket.io n annonce aucun sous-protocole : c est son URL qui le trahit,
       « /socket.io/?EIO=4&transport=websocket ». */
    engineIo: parametres.has('EIO') || /socket\.?io|engine\.?io/.test(sp),
    /* sockjs-client : /<serveur sur 3 chiffres>/<session>/websocket */
    sockJs: /\/\d{3}\/[^/]+\/websocket$/.test(chemin),
    phoenix: /\/websocket$/.test(chemin) && parametres.has('vsn'),
    pusher: /\/app\/[^/]+$/.test(chemin) && parametres.has('protocol'),
    niveauMqtt: Number.isInteger(c.niveauMqtt) ? c.niveauMqtt : null
  };
}

/**
 * Le protocole que la connexion designe d elle-meme, et par quelle preuve.
 * @returns { nom, preuve: 'sous-protocole' | 'url' } ou null
 */
export function protocoleDesigne(contexte) {
  const indices = indicesDeContexte(contexte);
  const nom = attenduPar(indices);
  if (!nom) return null;
  const parSousProtocole = indices.sp && attenduPar({ ...indices, engineIo: /socket\.?io|engine\.?io/.test(indices.sp),
    sockJs: false, phoenix: false, pusher: false }) === nom;
  return { nom, preuve: parSousProtocole ? 'sous-protocole' : 'url' };
}

/** Le protocole que le sous-protocole negocie designe, s il en designe un. */
function attenduPar(indices) {
  const sp = indices.sp;
  if (sp.includes('stomp')) return 'STOMP';
  if (sp.includes('signalr')) return 'SignalR';
  if (/socket\.?io|engine\.?io/.test(sp)) return 'Engine.IO / socket.io';
  if (sp.includes('graphql')) return 'GraphQL over WebSocket';
  if (sp.startsWith('wamp.2.')) return 'WAMP';
  if (sp.includes('actioncable')) return 'Action Cable';
  if (sp.includes('jsonrpc') || sp.includes('json-rpc')) return 'JSON-RPC 2.0';
  if (sp === 'mqtt' || sp.startsWith('mqttv')) return 'MQTT';
  if (indices.engineIo) return 'Engine.IO / socket.io';
  if (indices.sockJs) return 'SockJS';
  if (indices.phoenix) return 'Phoenix Channels';
  if (indices.pusher) return 'Pusher Channels';
  return null;
}

/* Un paquet Engine.IO n est retenu sans preuve de contexte que s il ne peut
   etre autre chose : une poignee de main avec « sid », ou un message
   socket.io dont les donnees sont du JSON. « 40 » seul reste un nombre. */
function engineIoRetenu(texte, indices) {
  const l = lireEngineIo(texte);
  if (indices.engineIo || l.type === 'open') return l;
  return l.type === 'message' && l.socketIo && l.socketIo.donnees !== undefined ? l : null;
}

/* Le premier caractere non blanc : un lecteur JSON n a rien a faire d une
   trame qui ne commence ni par « { » ni par « [ ». */
function premierSignificatif(texte) {
  for (let i = 0; i < texte.length && i < 64; i++) {
    const c = texte.charCodeAt(i);
    if (c !== 32 && c !== 9 && c !== 10 && c !== 13) return texte[i];
  }
  return '';
}
const commeJson = texte => { const c = premierSignificatif(texte); return c === '{' || c === '['; };

/* Chaque lecteur est precede d une garde qui ne coute presque rien. Une trame
   qui ne peut pas lui correspondre ne l atteint donc jamais — et surtout ne
   lui fait pas lever d exception : une erreur levee capture sa pile, et vingt
   mille trames de texte ordinaire coutaient ainsi pres de quatre secondes a
   la vue « Flux direct », qui les resume toutes. */
const LECTEURS_TEXTE = [
  ['Engine.IO / socket.io', t => { const c = t.charCodeAt(0); return c >= 48 && c <= 54; }, engineIoRetenu],
  ['STOMP', t => { const c = t.charCodeAt(0); return c >= 65 && c <= 90 && t.includes('\n'); }, t => lireStomp(t)],
  ['SignalR', t => t.includes('\u001e'), t => lireSignalR(t)],
  ['GraphQL over WebSocket', commeJson, lireGraphqlWs],
  ['JSON-RPC 2.0', commeJson, t => lireJsonRpc(t)],
  ['WAMP', (t, indices) => indices.sp.startsWith('wamp.2.json'), lireWamp],
  ['Phoenix Channels', commeJson, lirePhoenix],
  ['Action Cable', commeJson, lireActionCable],
  ['Pusher Channels', commeJson, lirePusher],
  /* SockJS enveloppe d autres protocoles — STOMP chez Spring, le plus
     souvent : chaque message interieur est relu a son tour. */
  ['SockJS', (t, indices) => indices.sockJs, (texte, indices) => lireSockJs(texte, indices,
    interieur => lireAvecIndices(interieur, { ...indices, sockJs: false })[0] || null)]
];

function lireAvecIndices(brut, indices) {
  const lectures = [];
  if (!brut) return lectures;
  for (const [nom, garde, lire] of LECTEURS_TEXTE) {
    if (!garde(brut, indices)) continue;
    try {
      const lu = lire(brut, indices);
      if (lu) lectures.push({ nom, ...lu });
    } catch { /* forme non reconnue */ }
  }
  return ordonner(lectures, indices);
}

/* Le protocole que la connexion designe passe en tete, et chaque lecture dit
   si elle repose sur cette preuve ou sur sa seule forme. */
function ordonner(lectures, indices) {
  const attendu = attenduPar(indices);
  if (attendu) {
    const i = lectures.findIndex(l => l.nom === attendu);
    if (i > 0) lectures.unshift(lectures.splice(i, 1)[0]);
  }
  for (const l of lectures) {
    l.annonce = !!attendu && l.nom === attendu;
    l.preuve = l.annonce ? (indices.sp ? 'sous-protocole' : 'url') : 'forme';
  }
  return lectures;
}

/**
 * Les lectures d une trame texte que quelque chose PROUVE : sa forme, le
 * sous-protocole negocie ou l URL. Une forme ambigue sans preuve n en recoit
 * aucune — « 2024 » n est pas un ping Engine.IO.
 *
 * @param texte     la charge utile de la trame
 * @param contexte  le sous-protocole (chaine), ou { sousProtocole, url, niveauMqtt }
 */
export function lireSousProtocole(texte, contexte = '') {
  return lireAvecIndices(String(texte == null ? '' : texte), indicesDeContexte(contexte));
}

/**
 * Vrai si la connexion designe un protocole binaire que l on sait lire. Sans
 * cela, decoder les octets d une trame ne servirait a rien : aucune lecture ne
 * peut en sortir. Les vues s en servent pour ne pas decoder pour rien.
 */
export function lectureBinairePossible(contexte) {
  const sp = indicesDeContexte(contexte).sp;
  return sp === 'mqtt' || sp.startsWith('mqttv') || sp.startsWith('wamp.2.msgpack') || sp.startsWith('wamp.2.cbor');
}

/**
 * Les lectures d une trame BINAIRE. Des octets ne prouvent rien par eux-memes :
 * seul le sous-protocole negocie (mqtt, wamp.2.msgpack, wamp.2.cbor) autorise
 * a les lire comme ce protocole.
 */
export function lireSousProtocoleBinaire(octets, contexte = '') {
  const indices = indicesDeContexte(contexte);
  const lectures = [];
  if (indices.sp === 'mqtt' || indices.sp.startsWith('mqttv')) {
    try { lectures.push({ nom: 'MQTT', ...lireMqtt(octets, indices.niveauMqtt) }); } catch { /* non conforme */ }
  }
  const wamp = lireWamp(octets, indices);
  if (wamp) lectures.push({ nom: 'WAMP', ...wamp });
  return ordonner(lectures, indices);
}

/** Une ligne courte disant ce que transporte une lecture. */
export function resumerLecture(l) {
  if (!l) return null;
  if (l.nom === 'Engine.IO / socket.io') {
    const s = l.socketIo;
    if (s && s.evenement) return 'socket.io ' + s.type + ' « ' + s.evenement + ' »';
    if (s) return 'socket.io ' + s.type;
    return 'Engine.IO ' + l.type;
  }
  if (l.nom === 'STOMP') {
    const destination = l.entetes && l.entetes.destination;
    return 'STOMP ' + l.commande + (destination ? ' -> ' + destination : '');
  }
  if (l.nom === 'SignalR') {
    const m = l.messages[0];
    return 'SignalR ' + m.type + (m.cible ? ' « ' + m.cible + ' »' : '');
  }
  if (l.nom === 'MQTT') return resumerMqtt(l);
  if (l.nom === 'SockJS') return resumerSockJs(l, resumerLecture);
  const resumer = RESUMES_PLUS[l.nom];
  return resumer ? resumer(l) : null;
}

/** Une ligne courte disant ce que la trame texte transporte, ou null. */
export function resumerTrame(texte, contexte = '') {
  return resumerLecture(lireSousProtocole(texte, contexte)[0]);
}

/** Idem pour une trame binaire. */
export function resumerTrameBinaire(octets, contexte = '') {
  return resumerLecture(lireSousProtocoleBinaire(octets, contexte)[0]);
}

/* ----------------------- Contexte d une connexion ------------------------- */
function entete(liste, nom) {
  if (!Array.isArray(liste)) return '';
  const h = liste.find(e => e && String(e.name).toLowerCase() === nom);
  return h ? String(h.value || '') : '';
}

/**
 * Ce qu un enregistrement WebSocket apporte pour lire ses trames.
 *
 * Le sous-protocole negocie vient de la page (`ws.protocol`) ou, a defaut, de
 * l en-tete `Sec-WebSocket-Protocol` de la reponse 101. Pour MQTT, le niveau
 * de protocole est lu dans le PREMIER paquet envoye, qui doit etre le CONNECT
 * (MQTT 3.1.1, section 3.1) : s il n a pas ete capture, le niveau reste
 * inconnu, et ce qui en depend n est pas lu.
 */
export function contexteDeConnexion(rec) {
  const ws = rec && rec.ws;
  const sousProtocole = (ws && ws.protocol) || entete(rec && rec.responseHeaders, 'sec-websocket-protocol');
  const url = (rec && (rec.finalUrl || rec.url)) || '';
  let niveauMqtt = null;
  const sp = String(sousProtocole || '').toLowerCase();
  if (ws && Array.isArray(ws.frames) && (sp === 'mqtt' || sp.startsWith('mqttv'))) {
    const premier = ws.frames.find(f => f && f.dir === 'send');
    if (premier && premier.base64) {
      try { niveauMqtt = niveauDuConnect(base64VersOctets(premier.base64)); } catch { /* illisible */ }
    }
  }
  return { sousProtocole, url, niveauMqtt };
}
