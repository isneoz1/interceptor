/* Sous-protocoles WebSocket — INTERCEPTOR (by NeoZ)
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
 */

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

  /* « open » transporte la poignee de main : identifiant de session, delais. */
  if (type === '0' && charge) {
    try { out.poignee = JSON.parse(charge); } catch { out.brut = charge; }
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

  const out = { protocole: 'STOMP', commande, entetes: {} };
  if (finLigne < 0) return out;

  /* Une ligne vide separe les entetes du corps. */
  const reste = texte.slice(finLigne + 1);
  const separation = reste.indexOf('\n\n');
  const blocEntetes = separation < 0 ? reste : reste.slice(0, separation);
  if (separation >= 0) out.corps = reste.slice(separation + 2);

  for (const ligne of blocEntetes.split('\n')) {
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
  7: 'Close'
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

    /* La negociation initiale n a pas de champ « type » : elle annonce le
       protocole et sa version. */
    if (objet && objet.protocol) {
      messages.push({ type: 'Handshake', protocole: objet.protocol, version: objet.version });
      continue;
    }
    const message = { type: SIGNALR[objet.type] || ('type ' + objet.type), typeNumero: objet.type };
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
 * Toutes les lectures possibles d une trame, sans en choisir aucune : c est a
 * l operateur de trancher, avec les decoupages sous les yeux. Une trame
 * « 2 » est un ping Engine.IO autant qu un texte quelconque.
 *
 * @param texte        la charge utile de la trame
 * @param sousProtocole valeur de Sec-WebSocket-Protocol, quand elle est connue
 */
export function lireSousProtocole(texte, sousProtocole = '') {
  const brut = String(texte == null ? '' : texte);
  const lectures = [];
  const essayer = (nom, fn) => {
    try {
      const lu = fn();
      if (lu) lectures.push({ nom, ...lu });
    } catch { /* forme non reconnue */ }
  };

  essayer('Engine.IO / socket.io', () => lireEngineIo(brut));
  essayer('STOMP', () => lireStomp(brut));
  essayer('SignalR', () => lireSignalR(brut));

  /* Le sous-protocole annonce a la poignee de main tranche les ambiguites :
     on remonte la lecture correspondante en tete. */
  const annonce = String(sousProtocole || '').toLowerCase();
  if (annonce) {
    const attendu = annonce.includes('stomp') ? 'STOMP'
      : annonce.includes('signalr') ? 'SignalR'
      : /socket\.?io|engine\.?io/.test(annonce) ? 'Engine.IO / socket.io'
      : null;
    if (attendu) {
      const i = lectures.findIndex(l => l.nom === attendu);
      if (i > 0) lectures.unshift(lectures.splice(i, 1)[0]);
      for (const l of lectures) l.annonce = l.nom === attendu;
    }
  }
  return lectures;
}

/** Une ligne courte disant ce que la trame transporte, ou null. */
export function resumerTrame(texte, sousProtocole = '') {
  const [premiere] = lireSousProtocole(texte, sousProtocole);
  if (!premiere) return null;

  if (premiere.nom === 'Engine.IO / socket.io') {
    const s = premiere.socketIo;
    if (s && s.evenement) return 'socket.io ' + s.type + ' « ' + s.evenement + ' »';
    if (s) return 'socket.io ' + s.type;
    return 'Engine.IO ' + premiere.type;
  }
  if (premiere.nom === 'STOMP') {
    const destination = premiere.entetes && premiere.entetes.destination;
    return 'STOMP ' + premiere.commande + (destination ? ' -> ' + destination : '');
  }
  if (premiere.nom === 'SignalR') {
    const m = premiere.messages[0];
    return 'SignalR ' + m.type + (m.cible ? ' « ' + m.cible + ' »' : '');
  }
  return null;
}
