/* Sous-protocoles WebSocket, suite — INTERCEPTOR (by NeoZ)
 *
 * Complete sous-protocoles.js (Engine.IO / socket.io, STOMP, SignalR) avec les
 * autres familles repandues, chacune lue selon sa specification publiee :
 *
 *   GraphQL over WebSocket  graphql-transport-ws (The Guild) et graphql-ws
 *                           (subscriptions-transport-ws, Apollo, AppSync)
 *   JSON-RPC 2.0            web3 / Ethereum, LSP, bien des API temps reel
 *   WAMP v2                 wamp.2.json, .batched, .msgpack, .cbor
 *   SockJS                  enveloppe o / h / a[...] / c[...] de Spring & co
 *   Phoenix Channels        Elixir, Phoenix LiveView (formats v1 et v2)
 *   Action Cable            Ruby on Rails
 *   Pusher Channels         Pusher, Laravel Echo, Soketi, Reverb
 *
 * La meme regle partout : une lecture n est proposee que si la preuve existe.
 * Soit la forme ne peut appartenir qu a ce protocole (`"jsonrpc":"2.0"`, un
 * evenement `pusher:subscribe`), soit la connexion le dit — sous-protocole
 * negocie a la poignee de main, ou URL propre au protocole. Une forme
 * ambigue sans preuve ne recoit AUCUNE etiquette : mieux vaut rien qu une
 * fausse piste.
 */
import { decoderMsgpack, decoderCbor } from './binaires.js';

/* Les lecteurs JSON sont essayes l un apres l autre sur la MEME trame : on ne
   l analyse qu une fois. Aucun lecteur ne modifie la valeur rendue, qui peut
   donc etre partagee sans risque. */
let dernierTexte = null;
let dernierJson;
const json = texte => {
  if (texte === dernierTexte) return dernierJson;
  let valeur;
  try { valeur = JSON.parse(texte); } catch { valeur = undefined; }
  dernierTexte = texte;
  dernierJson = valeur;
  return valeur;
};
const estObjet = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const texteOuNull = v => (typeof v === 'string' ? v : null);

/* ------------------------ GraphQL over WebSocket -------------------------- */
/* https://github.com/enisdenjo/graphql-ws/blob/master/PROTOCOL.md
   https://github.com/apollographql/subscriptions-transport-ws/blob/master/PROTOCOL.md
   Attention aux noms : le sous-protocole « graphql-ws » est l ANCIEN
   protocole d Apollo, « graphql-transport-ws » le nouveau. */
const GQL_TRANSPORT = new Set(['connection_init', 'connection_ack', 'ping', 'pong',
  'subscribe', 'next', 'error', 'complete']);
const GQL_ANCIEN = new Set(['connection_init', 'connection_ack', 'connection_error', 'ka',
  'connection_terminate', 'start', 'start_ack', 'data', 'error', 'complete', 'stop']);
const GQL_PROPRE_TRANSPORT = new Set(['ping', 'pong', 'subscribe', 'next']);
const GQL_PROPRE_ANCIEN = new Set(['connection_error', 'ka', 'connection_terminate', 'start',
  'start_ack', 'data', 'stop']);
/* Des chaines qu aucun autre protocole n emploie. */
const GQL_SANS_EQUIVOQUE = new Set(['connection_init', 'connection_ack', 'connection_error',
  'connection_terminate', 'start_ack']);

/**
 * Type et nom de la premiere operation d un document GraphQL, lus au niveau
 * zero des accolades : un champ nomme « query » plus bas ne trompe pas, les
 * fragments sont sautes, chaines et commentaires ignores.
 */
export function operationGraphql(source) {
  const s = String(source || '');
  let i = 0;
  let profondeur = 0;
  let dansFragment = false;
  while (i < s.length) {
    const c = s[i];
    if (c === '#') { while (i < s.length && s[i] !== '\n') i++; continue; }
    if (c === '"') {
      if (s.startsWith('"""', i)) {
        const fin = s.indexOf('"""', i + 3);
        i = fin < 0 ? s.length : fin + 3;
      } else {
        i++;
        while (i < s.length && s[i] !== '"') i += s[i] === '\\' ? 2 : 1;
        i++;
      }
      continue;
    }
    if (c === '{') {
      if (profondeur === 0 && !dansFragment) return { type: 'query', nom: null };
      profondeur++; i++; continue;
    }
    if (c === '}') {
      profondeur = Math.max(0, profondeur - 1);
      if (profondeur === 0) dansFragment = false;
      i++; continue;
    }
    if (profondeur === 0 && /[_A-Za-z]/.test(c)) {
      const mot = /^[_A-Za-z][_0-9A-Za-z]*/.exec(s.slice(i))[0];
      i += mot.length;
      if (mot === 'fragment') { dansFragment = true; continue; }
      if (!dansFragment && (mot === 'query' || mot === 'mutation' || mot === 'subscription')) {
        const nom = /^\s*([_A-Za-z][_0-9A-Za-z]*)/.exec(s.slice(i));
        return { type: mot, nom: nom ? nom[1] : null };
      }
      continue;
    }
    i++;
  }
  return null;
}

export function lireGraphqlWs(texte, indices) {
  const m = json(texte);
  if (!estObjet(m) || typeof m.type !== 'string') return null;
  if (!GQL_TRANSPORT.has(m.type) && !GQL_ANCIEN.has(m.type)) return null;

  const annonce = /graphql/.test(indices.sp);
  if (!annonce) {
    const p = m.payload;
    const preuve = GQL_SANS_EQUIVOQUE.has(m.type)
      || ((m.type === 'subscribe' || m.type === 'start') && estObjet(p) && typeof p.query === 'string')
      || ((m.type === 'next' || m.type === 'data') && m.id != null && estObjet(p) && ('data' in p || 'errors' in p));
    if (!preuve) return null;
  }

  const variante = indices.sp === 'graphql-transport-ws' ? 'graphql-transport-ws'
    : indices.sp === 'graphql-ws' ? 'graphql-ws (subscriptions-transport-ws)'
    : GQL_PROPRE_TRANSPORT.has(m.type) ? 'graphql-transport-ws'
    : GQL_PROPRE_ANCIEN.has(m.type) ? 'graphql-ws (subscriptions-transport-ws)'
    : null;

  const out = { protocole: 'GraphQL over WebSocket', variante, type: m.type };
  if (m.id != null) out.id = String(m.id);
  const p = m.payload;
  if (estObjet(p)) {
    if (typeof p.query === 'string') {
      out.requete = p.query;
      out.operation = operationGraphql(p.query);
      if (typeof p.operationName === 'string' && out.operation) out.operation.nom = p.operationName;
    }
    if (p.variables !== undefined) out.variables = p.variables;
    if (p.data !== undefined) out.donnees = p.data;
    if (p.errors !== undefined) out.erreurs = p.errors;
  } else if (Array.isArray(p)) {
    out.erreurs = p;                                  // « error » du nouveau protocole
  }
  return out;
}

function resumerGraphql(l) {
  let texte = 'GraphQL ' + l.type;
  if (l.operation) texte += ' ' + l.operation.type + (l.operation.nom ? ' « ' + l.operation.nom + ' »' : '');
  if (l.erreurs && (!Array.isArray(l.erreurs) || l.erreurs.length)) texte += ' errors';
  if (l.id) texte += ' #' + l.id;
  return texte;
}

/* ------------------------------ JSON-RPC 2.0 ------------------------------ */
/* https://www.jsonrpc.org/specification — le membre « jsonrpc » valant
   exactement « 2.0 » est OBLIGATOIRE : c est lui qui fait la preuve. */
const ERREURS_JSONRPC = {
  '-32700': 'Parse error', '-32600': 'Invalid Request', '-32601': 'Method not found',
  '-32602': 'Invalid params', '-32603': 'Internal error'
};

function sensErreurJsonRpc(code) {
  if (ERREURS_JSONRPC[String(code)]) return ERREURS_JSONRPC[String(code)];
  if (Number.isInteger(code) && code <= -32000 && code >= -32099) return 'Server error';
  return null;
}

export function lireJsonRpc(texte) {
  const v = json(texte);
  const elements = Array.isArray(v) ? v : [v];
  if (!elements.length) return null;
  const messages = [];
  for (const e of elements) {
    if (!estObjet(e) || e.jsonrpc !== '2.0') return null;
    if (typeof e.method === 'string') {
      messages.push({ genre: 'id' in e ? 'Request' : 'Notification', methode: e.method,
        id: e.id, params: e.params });
    } else if ('result' in e) {
      messages.push({ genre: 'Response', id: e.id, resultat: e.result });
    } else if (estObjet(e.error)) {
      messages.push({ genre: 'Error', id: e.id, code: e.error.code, message: texteOuNull(e.error.message),
        sens: sensErreurJsonRpc(e.error.code), donnees: e.error.data });
    } else {
      return null;
    }
  }
  return { protocole: 'JSON-RPC 2.0', lot: Array.isArray(v), messages };
}

function resumerJsonRpc(l) {
  const m = l.messages[0];
  let texte = 'JSON-RPC ' + m.genre;
  if (m.methode) texte += ' « ' + m.methode + ' »';
  if (m.genre === 'Error') texte += ' ' + m.code + (m.sens ? ' ' + m.sens : '');
  if (m.id != null) texte += ' #' + m.id;
  if (l.messages.length > 1) texte += ' +' + (l.messages.length - 1);
  return texte;
}

/* --------------------------------- WAMP v2 -------------------------------- */
/* https://wamp-proto.org/spec.html — un message est un tableau dont le
   premier element est son code. Sans le sous-protocole « wamp.2.* », un
   tableau de nombres n est la preuve de rien : on ne le lit pas. */
const WAMP = {
  1: 'HELLO', 2: 'WELCOME', 3: 'ABORT', 4: 'CHALLENGE', 5: 'AUTHENTICATE', 6: 'GOODBYE',
  8: 'ERROR', 16: 'PUBLISH', 17: 'PUBLISHED', 32: 'SUBSCRIBE', 33: 'SUBSCRIBED',
  34: 'UNSUBSCRIBE', 35: 'UNSUBSCRIBED', 36: 'EVENT', 48: 'CALL', 49: 'CANCEL',
  50: 'RESULT', 64: 'REGISTER', 65: 'REGISTERED', 66: 'UNREGISTER', 67: 'UNREGISTERED',
  68: 'INVOCATION', 69: 'INTERRUPT', 70: 'YIELD'
};
const WAMP_LONGUEUR_MIN = {
  1: 3, 2: 3, 3: 3, 4: 3, 5: 3, 6: 3, 8: 5, 16: 4, 17: 3, 32: 4, 33: 3, 34: 3, 35: 2,
  36: 4, 48: 4, 49: 3, 50: 3, 64: 4, 65: 3, 66: 3, 67: 2, 68: 4, 69: 3, 70: 3
};
/* Ou se trouve l URI (royaume, sujet, procedure, raison) selon le message. */
const WAMP_URI = { 1: 1, 3: 2, 4: 1, 6: 2, 8: 4, 16: 3, 32: 3, 48: 3, 64: 3 };

function lireMessageWamp(m) {
  if (!Array.isArray(m) || !Number.isInteger(m[0]) || !WAMP[m[0]]) return null;
  if (m.length < WAMP_LONGUEUR_MIN[m[0]]) return null;
  const out = { type: WAMP[m[0]], code: m[0] };
  const position = WAMP_URI[m[0]];
  if (position != null) {
    if (typeof m[position] !== 'string') return null;
    out.uri = m[position];
  }
  if (m[0] === 8) out.pour = WAMP[m[1]] || String(m[1]);
  if (m[0] === 2) out.session = m[1];
  if ([16, 32, 48, 64, 17, 33, 50, 65, 8].includes(m[0])) out.requete = m[m[0] === 8 ? 2 : 1];
  if (m[0] === 36) out.abonnement = m[1];
  out.message = m;
  return out;
}

/** Les messages d une trame WAMP : un seul, ou plusieurs en mode « batched ». */
export function lireWamp(entree, indices) {
  const sp = indices.sp;
  if (!sp.startsWith('wamp.2.')) return null;
  const lot = sp.endsWith('.batched');
  const valeurs = [];
  if (typeof entree === 'string') {
    if (!sp.startsWith('wamp.2.json')) return null;
    /* JSON en lot : chaque message est suivi du caractere 0x1E. */
    const morceaux = lot ? entree.split('\u001e').filter(s => s.length) : [entree];
    for (const m of morceaux) {
      const v = json(m);
      if (v === undefined) return null;
      valeurs.push(v);
    }
  } else if (entree instanceof Uint8Array) {
    const decoder = sp.startsWith('wamp.2.msgpack') ? decoderMsgpack
      : sp.startsWith('wamp.2.cbor') ? decoderCbor : null;
    if (!decoder) return null;
    try {
      if (!lot) valeurs.push(decoder(entree));
      else {
        /* En lot binaire, chaque message est precede de sa longueur sur quatre
           octets, poids fort en tete. */
        let i = 0;
        while (i < entree.length) {
          if (i + 4 > entree.length) return null;
          const n = ((entree[i] << 24) >>> 0) + (entree[i + 1] << 16) + (entree[i + 2] << 8) + entree[i + 3];
          i += 4;
          if (i + n > entree.length) return null;
          valeurs.push(decoder(entree.subarray(i, i + n)));
          i += n;
        }
      }
    } catch { return null; }
  } else {
    return null;
  }
  const messages = valeurs.map(lireMessageWamp);
  if (!messages.length || messages.some(m => !m)) return null;
  return { protocole: 'WAMP', serialisation: sp.slice('wamp.2.'.length), messages };
}

function resumerWamp(l) {
  const m = l.messages[0];
  let texte = 'WAMP ' + m.type;
  if (m.uri) texte += ' « ' + m.uri + ' »';
  if (m.pour) texte += ' (' + m.pour + ')';
  if (m.requete != null && m.code !== 8) texte += ' #' + m.requete;
  if (l.messages.length > 1) texte += ' +' + (l.messages.length - 1);
  return texte;
}

/* --------------------------------- SockJS --------------------------------- */
/* https://github.com/sockjs/sockjs-protocol — le serveur envoie « o »
   (ouverture), « h » (battement), « a[...] » (messages), « c[code,raison] »
   (fermeture) ; le client envoie un tableau JSON de chaines. Une trame d une
   lettre ne prouve rien : l URL /<serveur a 3 chiffres>/<session>/websocket
   est exigee. */
export function lireSockJs(texte, indices, lireInterne) {
  if (!indices.sockJs) return null;
  const interne = m => ({ texte: m, lecture: lireInterne ? lireInterne(m) : null });
  if (texte === 'o') return { protocole: 'SockJS', trame: 'open' };
  if (texte === 'h') return { protocole: 'SockJS', trame: 'heartbeat' };
  const tete = texte[0];
  if (tete === 'a' || tete === '[') {
    const v = json(tete === 'a' ? texte.slice(1) : texte);
    if (!Array.isArray(v) || !v.every(s => typeof s === 'string')) return null;
    return { protocole: 'SockJS', trame: tete === 'a' ? 'array' : 'send', messages: v.map(interne) };
  }
  if (tete === 'm') {
    const v = json(texte.slice(1));
    if (typeof v !== 'string') return null;
    return { protocole: 'SockJS', trame: 'message', messages: [interne(v)] };
  }
  if (tete === 'c') {
    const v = json(texte.slice(1));
    if (!Array.isArray(v) || !Number.isInteger(v[0])) return null;
    return { protocole: 'SockJS', trame: 'close', code: v[0], raison: texteOuNull(v[1]) };
  }
  return null;
}

function resumerSockJs(l, resumerInterne) {
  if (l.trame === 'close') return 'SockJS close ' + l.code + (l.raison ? ' « ' + l.raison + ' »' : '');
  if (!l.messages) return 'SockJS ' + l.trame;
  if (l.messages.length === 1 && l.messages[0].lecture) {
    const interieur = resumerInterne(l.messages[0].lecture);
    if (interieur) return 'SockJS · ' + interieur;
  }
  return 'SockJS ' + l.trame + ' (' + l.messages.length + ')';
}

/* ---------------------------- Phoenix Channels ---------------------------- */
/* https://hexdocs.pm/phoenix/Phoenix.Socket.html — v2 (vsn=2.0.0) : tableau
   [join_ref, ref, topic, event, payload] ; v1 : objet {topic, event, payload,
   ref}. Les evenements du protocole commencent par « phx_ ». */
const refPhoenix = v => v === null || typeof v === 'string';

export function lirePhoenix(texte, indices) {
  const v = json(texte);
  let m = null;
  if (Array.isArray(v) && v.length === 5 && refPhoenix(v[0]) && refPhoenix(v[1])
      && typeof v[2] === 'string' && typeof v[3] === 'string') {
    m = { format: 'v2', joinRef: v[0], ref: v[1], sujet: v[2], evenement: v[3], charge: v[4] };
  } else if (estObjet(v) && typeof v.topic === 'string' && typeof v.event === 'string'
      && 'payload' in v && 'ref' in v) {
    m = { format: 'v1', joinRef: v.join_ref ?? null, ref: v.ref, sujet: v.topic, evenement: v.event, charge: v.payload };
  }
  if (!m) return null;
  const preuve = indices.phoenix || m.evenement.startsWith('phx_') || m.sujet === 'phoenix';
  if (!preuve) return null;
  if (m.evenement === 'phx_reply' && estObjet(m.charge) && typeof m.charge.status === 'string') {
    m.statut = m.charge.status;
  }
  return { protocole: 'Phoenix Channels', ...m };
}

function resumerPhoenix(l) {
  if (l.evenement.startsWith('phx_') || l.evenement === 'heartbeat') {
    return 'Phoenix ' + l.evenement + (l.sujet !== 'phoenix' ? ' « ' + l.sujet + ' »' : '')
      + (l.statut ? ' ' + l.statut : '');
  }
  return 'Phoenix « ' + l.evenement + ' » @ ' + l.sujet;
}

/* ------------------------------ Action Cable ------------------------------ */
/* https://github.com/rails/rails/tree/main/actioncable — sous-protocole
   actioncable-v1-json. L identifiant d abonnement est une chaine JSON qui
   contient le nom du canal. */
function canalDe(identifiant) {
  const v = typeof identifiant === 'string' ? json(identifiant) : undefined;
  return estObjet(v) && typeof v.channel === 'string' ? v.channel : null;
}

const CABLE_SERVEUR = new Set(['welcome', 'ping', 'confirm_subscription', 'reject_subscription', 'disconnect']);
const CABLE_CLIENT = new Set(['subscribe', 'unsubscribe', 'message']);

export function lireActionCable(texte, indices) {
  const v = json(texte);
  if (!estObjet(v)) return null;
  const canal = canalDe(v.identifier);
  const annonce = indices.sp.includes('actioncable');
  const forme = (typeof v.command === 'string' && CABLE_CLIENT.has(v.command))
    || (typeof v.type === 'string' && CABLE_SERVEUR.has(v.type))
    || (canal && 'message' in v);
  if (!forme) return null;
  if (!annonce && !canal) return null;                // sans preuve, un ping reste un ping
  const out = { protocole: 'Action Cable', canal };
  if (v.command) out.commande = v.command;
  if (v.type) out.type = v.type;
  if (v.command === 'message' && typeof v.data === 'string') {
    const d = json(v.data);
    out.donnees = d === undefined ? v.data : d;
    if (estObjet(d) && typeof d.action === 'string') out.action = d.action;
  }
  if (!v.command && !v.type && 'message' in v) out.message = v.message;
  if (typeof v.reason === 'string') out.raison = v.reason;
  if (typeof v.reconnect === 'boolean') out.reconnexion = v.reconnect;
  return out;
}

function resumerActionCable(l) {
  const genre = l.commande || l.type || null;
  let texte = 'Action Cable' + (genre ? ' ' + genre : '');
  if (l.canal) texte += ' « ' + l.canal + ' »';
  if (l.action) texte += ' ' + l.action;
  if (l.raison) texte += ' ' + l.raison;
  return texte;
}

/* ------------------------------ Pusher Channels --------------------------- */
/* https://pusher.com/docs/channels/library_auth_reference/pusher-websockets-protocol/
   Les evenements du protocole commencent par « pusher: » ou
   « pusher_internal: » ; les autres sont ceux de l application, et ne sont
   attribues a Pusher que si l URL (/app/<cle>?protocol=N) le prouve. */
export function lirePusher(texte, indices) {
  const v = json(texte);
  if (!estObjet(v) || typeof v.event !== 'string') return null;
  const interne = /^pusher(_internal)?:/.test(v.event);
  if (!interne && !indices.pusher) return null;
  const out = { protocole: 'Pusher Channels', evenement: v.event, interne };
  if (typeof v.channel === 'string') out.canal = v.channel;
  if (v.data !== undefined) {
    const d = typeof v.data === 'string' ? json(v.data) : v.data;
    out.donnees = d === undefined ? v.data : d;
    if (estObjet(d)) {
      if (!out.canal && typeof d.channel === 'string') out.canal = d.channel;
      if (d.code != null) out.code = d.code;
      if (typeof d.message === 'string') out.message = d.message;
    }
  }
  return out;
}

function resumerPusher(l) {
  if (l.interne) {
    return 'Pusher ' + l.evenement + (l.canal ? ' « ' + l.canal + ' »' : '')
      + (l.code != null ? ' ' + l.code : '') + (l.message ? ' « ' + l.message + ' »' : '');
  }
  return 'Pusher « ' + l.evenement + ' »' + (l.canal ? ' @ ' + l.canal : '');
}

/* ------------------------------ Resumes ----------------------------------- */
export const RESUMES_PLUS = {
  'GraphQL over WebSocket': resumerGraphql,
  'JSON-RPC 2.0': resumerJsonRpc,
  'WAMP': resumerWamp,
  'Phoenix Channels': resumerPhoenix,
  'Action Cable': resumerActionCable,
  'Pusher Channels': resumerPusher
};
export { resumerSockJs };
