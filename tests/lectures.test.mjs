/* Lectures de la 4.4 — INTERCEPTOR (by NeoZ)
 *
 *   node tests/lectures.test.mjs
 *
 * Ce que la 4.4 ajoute a la lecture du trafic, et ce qu elle corrige :
 *
 *   1. le minutage : l export et l import HAR recomposent le TLS selon la
 *      norme, sans le compter deux fois, et disent ce qui n est pas mesure ;
 *   2. les sous-protocoles WebSocket : chaque famille lue selon sa
 *      specification — et surtout, AUCUNE etiquette sans preuve ;
 *   3. MQTT, protocole binaire, paquet par paquet ;
 *   4. le certificat lu en entier, confronte au lecteur X.509 d OpenSSL
 *      qu embarque Node ;
 *   5. les criteres de recherche du moniteur reseau de Firefox ;
 *   6. la fraicheur HTTP et la CSP, traduisibles de bout en bout.
 */
import { X509Certificate } from 'node:crypto';
import { installerTout, egal, verifier, leve, bilan } from './harnais.mjs';

installerTout();

const { setLang, lang } = await import('../ui/lib/i18n.js');
const sp = await import('../ui/lib/sous-protocoles.js');
const { operationGraphql } = await import('../ui/lib/sous-protocoles-plus.js');
const { lireMqtt, niveauDuConnect } = await import('../ui/lib/mqtt.js');
const { resumerCertificat, pemVersOctets } = await import('../ui/lib/asn1.js');
const { parseQuery, matchTerms, fieldHelp, ALIAS_FIREFOX } = await import('../ui/lib/filters.js');
const { analyserFraicheur, resumerFraicheur } = await import('../ui/lib/cache-http.js');
const { analyserCsp } = await import('../ui/lib/csp.js');
const { raisonMasque } = await import('../ui/lib/minutage.js');
const { buildHar } = await import('../background/export/har.js');
const { importHar } = await import('../background/ingest/har.js');
const { store, summarize } = await import('../background/core/store.js');
const { EN } = await import('../ui/lib/dict-en.js');

setLang('fr');
const resume = (texte, contexte) => sp.resumerTrame(texte, contexte);
const octets = liste => Uint8Array.from(liste);
const enBase64 = o => Buffer.from(o).toString('base64');

/* =========================== 1. Minutage et HAR =========================== */
const avecPhases = {
  id: 1, requestId: '1', method: 'GET', url: 'https://a.test/', finalUrl: 'https://a.test/',
  startTime: 1000, endTime: 1300, duration: null, statusCode: 200, statusLine: 'HTTP/1.1 200 OK',
  requestHeaders: [], responseHeaders: [], timeline: [], redirects: [], cookies: { set: [] },
  sources: ['webRequest'],
  perf: { phasesFournies: true, nextHopProtocol: 'h2',
    timings: { blocked: 1, dns: 2, connect: 3, ssl: 4, send: -1, wait: 200, receive: 3 } }
};
const entree = buildHar([avecPhases]).log.entries[0];
/* HAR 1.2 : « the time is also included in the connect field ». */
egal('HAR : le TLS est compris dans connect', entree.timings.connect, 7);
egal('HAR : ssl reste lisible a part', entree.timings.ssl, 4);
egal('HAR : send non mesure vaut 0 (champ obligatoire)', entree.timings.send, 0);
verifier('HAR : le commentaire dit que send n est pas mesure',
  /send non mesure/.test(entree.timings.comment || ''), entree.timings.comment);
egal('HAR : le total ne compte pas le TLS deux fois', entree.time, 1 + 2 + 7 + 0 + 200 + 3);

const masquee = { ...avecPhases, id: 2, perf: { phasesFournies: false,
  timings: { blocked: -1, dns: -1, connect: -1, ssl: -1, send: -1, wait: -1, receive: -1 } } };
const entreeMasquee = buildHar([masquee]).log.entries[0];
egal('HAR masque : pas de DNS invente', entreeMasquee.timings.dns, -1);
egal('HAR masque : pas de connexion inventee', entreeMasquee.timings.connect, -1);
verifier('HAR masque : wait et receive restent positifs, comme l exige la norme',
  entreeMasquee.timings.wait >= 0 && entreeMasquee.timings.receive >= 0);
verifier('HAR masque : le commentaire dit d ou viennent les temps',
  /webRequest/.test(entreeMasquee.timings.comment || ''), entreeMasquee.timings.comment);

/* L import fait le chemin inverse : les phases redeviennent disjointes. */
store.clear();
importHar({ log: { version: '1.2', entries: [{
  startedDateTime: new Date(0).toISOString(), time: 213,
  request: { method: 'GET', url: 'https://b.test/', headers: [] },
  response: { status: 200, statusText: 'OK', headers: [], content: { size: 0 } },
  timings: { blocked: 1, dns: 2, connect: 7, ssl: 4, send: 0, wait: 200, receive: 3 }
}] } });
const importee = store.all()[0];
egal('import HAR : le TLS est retire de connect', importee && importee.perf.timings.connect, 3);
egal('import HAR : ssl conserve', importee && importee.perf.timings.ssl, 4);
store.clear();

/* La raison d un masque n est donnee que si les en-tetes la prouvent. */
const autreOrigine = { url: 'https://cdn.autre.test/a.js', documentUrl: 'https://page.test/',
  responseHeaders: [{ name: 'Content-Type', value: 'text/javascript' }] };
verifier('masque prouve : autre origine sans Timing-Allow-Origin',
  /Timing-Allow-Origin/.test(raisonMasque(autreOrigine)));
verifier('masque non prouve : l en-tete est la, on ne pretend pas de cause',
  !/autre origine/.test(raisonMasque({ ...autreOrigine,
    responseHeaders: [{ name: 'Timing-Allow-Origin', value: 'https://ailleurs.test' }] })));
verifier('masque non prouve : meme origine',
  !/autre origine/.test(raisonMasque({ ...autreOrigine, url: 'https://page.test/a.js' })));

/* ===================== 2. Sous-protocoles : aucune fausse piste ============ */
/* Des textes quelconques ne recoivent aucune etiquette. Chacun passait avant
   pour un paquet Engine.IO ou une trame STOMP. */
for (const texte of ['2024-09-23', '3', '40', '6', '2probe', '1', 'ERROR', 'ABORT', 'SEND', '0{}',
  '{"type":"ping"}', '{"type":"complete","id":"1"}', '[48,7,{},"com.app.add"]', 'o', 'h',
  '[null,null,"salle","nouveau",{}]', '{"event":"commande","data":"{}"}']) {
  egal('aucune etiquette sans preuve pour ' + JSON.stringify(texte), resume(texte), null);
}
/* WAMP en lot separe ses messages par 0x1E, comme SignalR. */
verifier('un lot WAMP n est pas lu comme du SignalR',
  !sp.lireSousProtocole('[48,1,{},"x"]\u001e').some(l => l.nom === 'SignalR'));

/* --- Engine.IO / socket.io : l URL fait la preuve --- */
const urlSocketIo = 'wss://jeu.test/socket.io/?EIO=4&transport=websocket';
egal('socket.io reconnu par sa forme', resume('42["order",{"id":77}]'), 'socket.io EVENT « order »');
egal('ping Engine.IO prouve par l URL', resume('2', { url: urlSocketIo }), 'Engine.IO ping');
egal('sonde de mise a niveau prouvee par l URL', resume('2probe', { url: urlSocketIo }), 'Engine.IO ping');
egal('CONNECT socket.io prouve par l URL', resume('40', { url: urlSocketIo }), 'socket.io CONNECT');
egal('poignee de main reconnue par son « sid »', resume('0{"sid":"abc","pingInterval":25000}'), 'Engine.IO open');
leve('Engine.IO : un ping ne porte que « probe »', () => sp.lireEngineIo('2024'));

/* --- STOMP : la ligne vide qui clot les entetes est exigee --- */
const stompCrlf = sp.lireStomp('CONNECTED\r\nversion:1.2\r\nheart-beat:0,0\r\n\r\n\u0000');
egal('STOMP 1.2 admet CRLF', stompCrlf.entetes.version, '1.2');
leve('STOMP refuse une commande seule', () => sp.lireStomp('ERROR'));

/* --- SignalR : types reels seulement --- */
egal('SignalR lit la reponse de negociation',
  sp.lireSignalR('{}\u001e').messages[0].type, 'HandshakeResponse');
egal('SignalR connait Ack (reconnexion avec etat)',
  sp.lireSignalR('{"type":8,"sequenceId":3}\u001e').messages[0].type, 'Ack');
leve('SignalR refuse un type inconnu', () => sp.lireSignalR('{"type":42}\u001e'));

/* --- GraphQL over WebSocket --- */
egal('GraphQL : operation nommee',
  resume('{"type":"subscribe","id":"1","payload":{"query":"subscription OnMsg { msg }"}}'),
  'GraphQL subscribe subscription « OnMsg » #1');
egal('GraphQL : ancien protocole d Apollo',
  resume('{"type":"start","id":"2","payload":{"query":"query Moi { moi { id } }"}}'),
  'GraphQL start query « Moi » #2');
egal('GraphQL : le sous-protocole annonce autorise un ping', resume('{"type":"ping"}', 'graphql-transport-ws'), 'GraphQL ping');
egal('GraphQL : connection_init ne peut etre que GraphQL', resume('{"type":"connection_init","payload":{}}'), 'GraphQL connection_init');
egal('GraphQL : variante lue au sous-protocole',
  sp.lireSousProtocole('{"type":"connection_ack"}', 'graphql-ws')[0].variante, 'graphql-ws (subscriptions-transport-ws)');
egal('GraphQL : erreurs signalees',
  resume('{"type":"next","id":"3","payload":{"errors":[{"message":"x"}]}}'), 'GraphQL next errors #3');
const op = operationGraphql;
egal('operation : forme abregee', JSON.stringify(op('{ user { query } }')), '{"type":"query","nom":null}');
egal('operation : un fragment est saute',
  JSON.stringify(op('fragment F on T { query } mutation Save($x: Int) { save(x: $x) }')),
  '{"type":"mutation","nom":"Save"}');
egal('operation : un commentaire est ignore',
  JSON.stringify(op('# query Fausse\nquery Vraie { a }')), '{"type":"query","nom":"Vraie"}');
egal('operation : une chaine ne trompe pas',
  JSON.stringify(op('query { recherche(q: "mutation X") }')), '{"type":"query","nom":null}');

/* --- JSON-RPC 2.0 --- */
egal('JSON-RPC : requete', resume('{"jsonrpc":"2.0","method":"eth_call","params":[],"id":1}'),
  'JSON-RPC Request « eth_call » #1');
egal('JSON-RPC : notification', resume('{"jsonrpc":"2.0","method":"eth_subscription","params":{}}'),
  'JSON-RPC Notification « eth_subscription »');
egal('JSON-RPC : reponse', resume('{"jsonrpc":"2.0","result":"0x1","id":1}'), 'JSON-RPC Response #1');
egal('JSON-RPC : erreur normalisee',
  resume('{"jsonrpc":"2.0","error":{"code":-32601,"message":"x"},"id":3}'),
  'JSON-RPC Error -32601 Method not found #3');
egal('JSON-RPC : plage des erreurs serveur',
  resume('{"jsonrpc":"2.0","error":{"code":-32050,"message":"x"},"id":4}'),
  'JSON-RPC Error -32050 Server error #4');
egal('JSON-RPC : lot', resume('[{"jsonrpc":"2.0","method":"a","id":1},{"jsonrpc":"2.0","method":"b","id":2}]'),
  'JSON-RPC Request « a » #1 +1');
egal('JSON-RPC : « jsonrpc » absent, rien n est pretendu', resume('{"method":"a","id":1}'), null);
egal('JSON-RPC : version 1.0 refusee', resume('{"jsonrpc":"1.0","method":"a","id":1}'), null);

/* --- WAMP : le sous-protocole est exige --- */
egal('WAMP JSON', resume('[48,7,{},"com.app.add",[1,2]]', 'wamp.2.json'), 'WAMP CALL « com.app.add » #7');
egal('WAMP JSON en lot', resume('[16,1,{},"sujet.a"]\u001e[32,2,{},"sujet.b"]\u001e', 'wamp.2.json.batched'),
  'WAMP PUBLISH « sujet.a » #1 +1');
egal('WAMP ERROR dit ce qu il concerne',
  resume('[8,48,7,{},"wamp.error.no_such_procedure"]', 'wamp.2.json'),
  'WAMP ERROR « wamp.error.no_such_procedure » (CALL)');
const appelMsgpack = octets([0x94, 0x30, 0x07, 0x80, 0xab, ...new TextEncoder().encode('com.app.add')]);
egal('WAMP MessagePack', sp.resumerTrameBinaire(appelMsgpack, 'wamp.2.msgpack'), 'WAMP CALL « com.app.add » #7');
egal('WAMP MessagePack en lot (longueur sur 4 octets)',
  sp.resumerTrameBinaire(octets([0, 0, 0, appelMsgpack.length, ...appelMsgpack]), 'wamp.2.msgpack.batched'),
  'WAMP CALL « com.app.add » #7');
egal('WAMP sans sous-protocole : aucune lecture', sp.resumerTrameBinaire(appelMsgpack, ''), null);

/* --- SockJS : l URL est exigee, et l interieur est relu --- */
const urlSockJs = 'wss://app.test/ws/123/abcdefgh/websocket';
egal('SockJS : ouverture', resume('o', { url: urlSockJs }), 'SockJS open');
egal('SockJS : battement', resume('h', { url: urlSockJs }), 'SockJS heartbeat');
egal('SockJS : fermeture', resume('c[3000,"Go away!"]', { url: urlSockJs }), 'SockJS close 3000 « Go away! »');
egal('SockJS : STOMP a l interieur',
  resume('a' + JSON.stringify(['MESSAGE\ndestination:/topic/x\n\nbonjour\u0000']), { url: urlSockJs }),
  'SockJS · STOMP MESSAGE -> /topic/x');
egal('SockJS : envoi du client',
  resume(JSON.stringify(['SEND\ndestination:/app/chat\n\n{}\u0000']), { url: urlSockJs }),
  'SockJS · STOMP SEND -> /app/chat');

/* --- Phoenix Channels --- */
egal('Phoenix v2 : phx_join', resume('["1","1","room:lobby","phx_join",{}]'), 'Phoenix phx_join « room:lobby »');
egal('Phoenix v1 : reponse', resume('{"topic":"room:lobby","event":"phx_reply","payload":{"status":"ok"},"ref":"1"}'),
  'Phoenix phx_reply « room:lobby » ok');
egal('Phoenix : evenement applicatif prouve par l URL',
  resume('[null,null,"room:lobby","new_msg",{}]', { url: 'wss://app.test/socket/websocket?vsn=2.0.0' }),
  'Phoenix « new_msg » @ room:lobby');

/* --- Action Cable --- */
const identifiant = JSON.stringify(JSON.stringify({ channel: 'ChatChannel', room: '1' }));
egal('Action Cable : abonnement', resume('{"command":"subscribe","identifier":' + identifiant + '}'),
  'Action Cable subscribe « ChatChannel »');
egal('Action Cable : action appelee',
  resume('{"command":"message","identifier":' + identifiant + ',"data":"{\\"action\\":\\"speak\\"}"}'),
  'Action Cable message « ChatChannel » speak');
egal('Action Cable : ping prouve par le sous-protocole',
  resume('{"type":"ping","message":1700000000}', 'actioncable-v1-json'), 'Action Cable ping');

/* --- Pusher --- */
egal('Pusher : evenement du protocole',
  resume('{"event":"pusher:subscribe","data":{"channel":"private-commandes"}}'),
  'Pusher pusher:subscribe « private-commandes »');
egal('Pusher : erreur',
  resume('{"event":"pusher:error","data":{"code":4001,"message":"App key not in this cluster"}}'),
  'Pusher pusher:error 4001 « App key not in this cluster »');
egal('Pusher : evenement applicatif prouve par l URL',
  resume('{"event":"commande","channel":"c","data":"{}"}', { url: 'wss://ws-mt1.pusher.com/app/CLE?protocol=7&client=js' }),
  'Pusher « commande » @ c');

/* --- Ce que la connexion designe d elle-meme --- */
egal('designation par le sous-protocole', JSON.stringify(sp.protocoleDesigne({ sousProtocole: 'mqtt' })),
  '{"nom":"MQTT","preuve":"sous-protocole"}');
egal('designation par l URL', JSON.stringify(sp.protocoleDesigne({ url: urlSocketIo })),
  '{"nom":"Engine.IO / socket.io","preuve":"url"}');
egal('sans preuve, aucune designation', sp.protocoleDesigne({ url: 'wss://x.test/ws' }), null);
egal('sous-protocole lu dans l en-tete de la reponse 101',
  sp.contexteDeConnexion({ url: 'wss://x.test/g', ws: { frames: [] },
    responseHeaders: [{ name: 'Sec-WebSocket-Protocol', value: 'graphql-transport-ws' }] }).sousProtocole,
  'graphql-transport-ws');

/* --- Le cout : la vue « Flux direct » resume TOUTES les trames d une session --- */
/* Chaque lecteur qui refusait une trame levait une exception, qui capture sa
   pile : vingt mille trames de texte ordinaire coutaient pres de quatre
   secondes. Les gardes les ecartent sans rien lever. La borne est large a
   dessein — une machine d integration lente ne doit pas faire echouer ce test,
   un retour aux secondes, si. */
const melange = ['position 12 45 78', '{"t":"tick","n":1}', '42["etat",{"x":1}]', 'bonjour', '[1,2,3]'];
const contexteJeu = { url: 'wss://jeu.test/ws' };
const debutCout = performance.now();
for (let i = 0; i < 20000; i++) sp.resumerTrame(melange[i % melange.length] + i, contexteJeu);
const cout = performance.now() - debutCout;
verifier('vingt mille trames se resument en moins d une seconde et demie', cout < 1500,
  Math.round(cout) + ' ms');

/* ================================ 3. MQTT ================================= */
const chaine = texte => { const b = new TextEncoder().encode(texte); return [b.length >> 8, b.length & 255, ...b]; };
const paquet = (premier, corps) => octets([premier, corps.length, ...corps]);   // corps < 128 octets

const connect311 = paquet(0x10, [...chaine('MQTT'), 4, 0x02, 0, 60, ...chaine('client-42')]);
const lu311 = lireMqtt(connect311).paquets[0];
egal('CONNECT : version', lu311.version, '3.1.1');
egal('CONNECT : identifiant client', lu311.clientId, 'client-42');
egal('CONNECT : keep-alive', lu311.keepAlive, 60);
egal('niveau lu dans le CONNECT', niveauDuConnect(connect311), 4);

const connect5 = paquet(0x10, [...chaine('MQTT'), 5, 0xC2, 0, 30, 0, ...chaine('c5'), ...chaine('alice'), ...chaine('s3cret')]);
const lu5 = lireMqtt(connect5).paquets[0];
egal('CONNECT 5 : utilisateur', lu5.utilisateur, 'alice');
egal('CONNECT 5 : longueur du mot de passe', lu5.motDePasseOctets, 6);
verifier('CONNECT : le mot de passe n apparait nulle part', !JSON.stringify(lu5).includes('s3cret'));

const publie = paquet(0x32, [...chaine('capteurs/temp'), 0, 7, ...new TextEncoder().encode('21.5')]);
const luPublie = lireMqtt(publie, 4).paquets[0];
egal('PUBLISH : sujet', luPublie.sujet, 'capteurs/temp');
egal('PUBLISH : QoS', luPublie.qos, 1);
egal('PUBLISH : identifiant de paquet', luPublie.paquet, 7);
egal('PUBLISH : charge utile', luPublie.charge.texte, '21.5');

const publie5 = paquet(0x30, [...chaine('a/b'), 2, 0x01, 0x01, ...new TextEncoder().encode('x')]);
egal('PUBLISH 5 : les proprietes sont sautees', lireMqtt(publie5, 5).paquets[0].charge.texte, 'x');
verifier('PUBLISH sans version connue : le sujet est lu, la charge ne l est pas',
  lireMqtt(publie5, null).paquets[0].sujet === 'a/b' && lireMqtt(publie5, null).paquets[0].chargeNonLue === true);

egal('SUBSCRIBE : filtre et QoS', JSON.stringify(lireMqtt(paquet(0x82, [0, 1, ...chaine('a/#'), 1]), 4).paquets[0].sujets),
  '[{"filtre":"a/#","qos":1}]');
egal('CONNACK 3.1.1 : refus', lireMqtt(octets([0x20, 2, 0, 5]), 4).paquets[0].sens, 'not authorized');
/* 0 vaut « accepte » dans les deux versions, sous deux noms : sans version
   prouvee, aucun des deux n est choisi a sa place. */
egal('CONNACK accepte, version inconnue : les deux noms',
  lireMqtt(octets([0x20, 2, 0, 0]), null).paquets[0].sens, 'Connection Accepted (3.1.1) / Success (5.0)');
egal('CONNACK 3.1.1 refus, version inconnue : pas de sens invente',
  lireMqtt(octets([0x20, 2, 0, 5]), null).paquets[0].sens, undefined);
egal('CONNACK 5 : code de raison', lireMqtt(octets([0x20, 3, 0, 0x87, 0]), 5).paquets[0].sens, 'Not authorized');
egal('DISCONNECT 5 : raison', lireMqtt(octets([0xE0, 1, 0x8E]), 5).paquets[0].sens, 'Session taken over');
egal('PUBACK : des octets en plus prouvent la version 5',
  lireMqtt(octets([0x40, 3, 0, 1, 0x10]), null).paquets[0].sens, 'No matching subscribers');
egal('deux paquets dans une trame', lireMqtt(octets([0xC0, 0, 0xC0, 0])).paquets.length, 2);
verifier('paquet coupe : signale, pas invente', lireMqtt(octets([0x30, 10, 0, 3, 0x61])).incomplet === true);
leve('drapeaux non conformes refuses', () => lireMqtt(octets([0x80, 3, 0, 1, 0])));
leve('type 0 reserve refuse', () => lireMqtt(octets([0x00, 0])));
leve('AUTH refuse en 3.1.1', () => lireMqtt(octets([0xF0, 0]), 4));
leve('PUBACK 3.1.1 trop long refuse', () => lireMqtt(octets([0x40, 3, 0, 1, 0]), 4));

egal('MQTT lu seulement sous le sous-protocole mqtt', sp.resumerTrameBinaire(publie, ''), null);
egal('resume MQTT', sp.resumerTrameBinaire(publie, { sousProtocole: 'mqtt', niveauMqtt: 4 }),
  'MQTT PUBLISH « capteurs/temp » QoS 1');
egal('niveau MQTT lu dans le premier envoi de la connexion',
  sp.contexteDeConnexion({ url: 'wss://x.test/mqtt', ws: { protocol: 'mqtt',
    frames: [{ dir: 'send', base64: enBase64(connect311) }] } }).niveauMqtt, 4);

/* ============================ 4. Certificat =============================== */
const PEM = `-----BEGIN CERTIFICATE-----
MIIDoTCCA0agAwIBAgIUXau8nW0njgBTc9G4dFhQqeMxWq4wCgYIKoZIzj0EAwIw
XDExMC8GA1UEAwwoYXBpLmxvbmctc3ViZG9tYWluLWZvci10ZXN0cy5leGFtcGxl
LmNvbTEaMBgGA1UECgwRSU5URVJDRVBUT1IgVGVzdHMxCzAJBgNVBAYTAkZSMB4X
DTI2MDkyMzAwMDY0MloXDTM2MDkyMDAwMDY0MlowXDExMC8GA1UEAwwoYXBpLmxv
bmctc3ViZG9tYWluLWZvci10ZXN0cy5leGFtcGxlLmNvbTEaMBgGA1UECgwRSU5U
RVJDRVBUT1IgVGVzdHMxCzAJBgNVBAYTAkZSMFkwEwYHKoZIzj0CAQYIKoZIzj0D
AQcDQgAESbBYB3c7JOI6ZzFCpQMT1hzObTf5B+kwztyOAWdRIsEOLJkQSfPsuvnl
3e9q8DppeGTCdsbn3lK7c8FWqQtUj6OCAeQwggHgMAwGA1UdEwEB/wQCMAAwDgYD
VR0PAQH/BAQDAgeAMB0GA1UdJQQWMBQGCCsGAQUFBwMBBggrBgEFBQcDAjCBiAYD
VR0RBIGAMH6CKGFwaS5sb25nLXN1YmRvbWFpbi1mb3ItdGVzdHMuZXhhbXBsZS5j
b22CESouY2RuLmV4YW1wbGUub3JnhwTAAAIshxAgAQ24AAAAAAAAAAAAAAABgQ9v
cHNAZXhhbXBsZS5jb22GFmh0dHBzOi8vZXhhbXBsZS5jb20vaWQwZQYIKwYBBQUH
AQEEWTBXMCcGCCsGAQUFBzABhhtodHRwOi8vb2NzcC5leGFtcGxlLWNhLnRlc3Qw
LAYIKwYBBQUHMAKGIGh0dHA6Ly9jYS5leGFtcGxlLWNhLnRlc3QvY2EuZGVyMDIG
A1UdHwQrMCkwJ6AloCOGIWh0dHA6Ly9jcmwuZXhhbXBsZS1jYS50ZXN0L2NhLmNy
bDATBgNVHSAEDDAKMAgGBmeBDAECATAdBgNVHQ4EFgQUir6oQTHNl81+MsgzorT7
s66Ph4AwRwYKKwYBBAHWeQIEAgQ5BDcANQAzAAECAwQFBgcICRAREhMUFRYXGBkg
ISIjJCUmJygpMDEyAAABki1fGoAAAAQDAAQKCwwNMAoGCCqGSM49BAMCA0kAMEYC
IQCkwHnG+BpObBYvmRtZXZVw+WHIrIhNUUgt3revLVXn6QIhAJ0kkp4aiMWgMqSn
CG8cMPgDfBpSR3cLiDHiNxSUhTLA
-----END CERTIFICATE-----`;
const cert = resumerCertificat(pemVersOctets(PEM).octets);
const openssl = new X509Certificate(PEM);

/* Le lecteur d OpenSSL embarque par Node sert de temoin independant. */
const sanOpenssl = openssl.subjectAltName.split(', ');
const dnsOpenssl = sanOpenssl.filter(s => s.startsWith('DNS:')).map(s => s.slice(4));
egal('SAN : memes noms DNS que OpenSSL', JSON.stringify(cert.noms), JSON.stringify(dnsOpenssl));
verifier('SAN : un nom de plus de 24 caracteres n est plus coupe',
  cert.noms[0] === 'api.long-subdomain-for-tests.example.com', cert.noms[0]);
egal('SAN : IPv4', cert.adressesIp[0], '192.0.2.44');
egal('SAN : IPv6 en forme compacte (RFC 5952)', cert.adressesIp[1], '2001:db8::1');
egal('SAN : courriel', cert.courriels[0], 'ops@example.com');
egal('SAN : URI', cert.uris[0], 'https://example.com/id');
verifier('AIA : OCSP identique a OpenSSL',
  openssl.infoAccess.includes('OCSP - URI:' + cert.ocsp[0]), cert.ocsp[0]);
verifier('AIA : emetteur identique a OpenSSL',
  openssl.infoAccess.includes('CA Issuers - URI:' + cert.emetteurCa[0]), cert.emetteurCa[0]);
egal('CRL', cert.crl[0], 'http://crl.example-ca.test/ca.crl');
egal('politique DV', cert.validation, 'DV');
/* « CA:FALSE » se code 30 00 : deux octets que le lecteur generique sautait. */
egal('CA:FALSE lu', cert.autorite, false);
egal('identifiant de cle', cert.identifiantCle, '8A:BE:A8:41:31:CD:97:CD:7E:32:C8:33:A2:B4:FB:B3:AE:8F:87:80');
egal('SCT : une preuve', cert.sct.length, 1);
egal('SCT : horodatage', cert.sct[0].horodatage, '2024-09-26T08:07:40.416Z');
egal('SCT : algorithmes', cert.sct[0].signature, 'SHA-256 / ECDSA');
egal('SCT : identifiant du journal', cert.sct[0].journal,
  Buffer.from('0102030405060708091011121314151617181920212223242526272829303132', 'hex').toString('base64'));
egal('cle et taille', cert.algorithmeDeCle + ' ' + cert.tailleDeCle, 'ecPublicKey 256 bits (courbe)');

/* RFC 6962 ne connait que la v1. Une autre version n est pas lue avec la
   disposition de la v1 : elle est signalee telle quelle. */
const derModifie = Uint8Array.from(pemVersOctets(PEM).octets);
const repere = [0x00, 0x35, 0x00, 0x33, 0x00, 0x01, 0x02, 0x03];
const position = derModifie.findIndex((_, i) => repere.every((b, k) => derModifie[i + k] === b));
verifier('la liste SCT est reperee dans le DER', position > 0, position);
derModifie[position + 4] = 0x01;
const sctInconnu = resumerCertificat(derModifie).sct[0];
egal('SCT d une version inconnue : pas de version inventee', sctInconnu.version, null);
egal('SCT d une version inconnue : l octet est rapporte', sctInconnu.octetDeVersion, 1);
verifier('SCT d une version inconnue : ni journal ni horodatage lus',
  sctInconnu.journal === undefined && sctInconnu.horodatage === undefined);

/* ================== 5. Criteres du moniteur reseau de Firefox ============= */
const ligne = summarize({
  id: 1, requestId: '1', sources: [], url: 'https://a.exemple.com/x', method: 'GET', type: 'main_frame',
  scheme: 'https', host: 'a.exemple.com', path: '/x', tabId: 1, frameId: 0, statusCode: 200,
  size: 6000, state: 'pending', fromCache: false, ip: '1.2.3.4', redirects: [],
  requestHeaders: [{ name: 'Accept', value: '*/*' }, { name: 'Cookie', value: 'x=1' }],
  responseHeaders: [{ name: 'Content-Type', value: 'text/html' }, { name: 'Set-Cookie', value: 'sid=abc' },
    { name: 'Strict-Transport-Security', value: 'max-age=1' }],
  cookies: { set: [{ name: 'sid', value: 'abc123', domain: '.exemple.com' }, { name: 'theme', value: 'sombre', domain: null }] },
  dedup: { merged: 0 }, rulesApplied: [], perf: { nextHopProtocol: 'h2' },
  wireRequestSize: 3000, wireResponseSize: 4000
});
verifier('le resume ne transporte aucune valeur d en-tete', !JSON.stringify(ligne).includes('max-age=1'));
const cherche = requete => matchTerms(ligne, parseQuery(requete));
const CAS = [
  ['has-response-header:set-cookie', true], ['has-response-header:set-cookie2', false],
  ['has-response-header:set', false], ['-has-response-header:content-security-policy', true],
  ['has-request-header:Cookie', true], ['set-cookie-name:sid', true], ['set-cookie-name:zzz', false],
  ['set-cookie-domain:a.exemple.com', true], ['set-cookie-value:sombre', true],
  ['larger-than:5000', true], ['larger-than:6000', false], ['is:running', true], ['is:cached', false],
  ['is:from-cache', false], ['is:nimportequoi', false], ['status-code:200', true], ['domain:exemple', true],
  ['remote-ip:1.2.3', true], ['protocol:h2', true], ['transferred:>6999', true],
  ['regexp:exemple\\.com/x', true], ['regexp:zzz', false]
];
for (const [requete, attendu] of CAS) egal('recherche « ' + requete + ' »', cherche(requete), attendu);
verifier('chaque synonyme Firefox designe un critere existant',
  Object.values(ALIAS_FIREFOX).every(c => fieldHelp().some(f => f.name === c && !f.alias)));

/* ============ 6. Fraicheur HTTP et CSP, traduisibles de bout en bout ======= */
const t0 = Date.UTC(2026, 0, 15, 10, 30, 0);
const perimee = analyserFraicheur({
  reponse: { 'cache-control': 'max-age=60, must-revalidate, stale-while-revalidate=30',
    date: new Date(t0).toUTCString(), etag: '"abc"' },
  instantReponse: t0, maintenant: t0 + 120000
});
verifier('fraicheur : chaque fait est un gabarit du dictionnaire',
  perimee.faits.every(f => EN[f.texte] !== undefined), JSON.stringify(perimee.faits.map(f => f.texte)));
setLang('en');
const phrase = resumerFraicheur(perimee);
verifier('fraicheur en anglais : aucun mot francais', !/perimee|depuis|revalidable avec/.test(phrase), phrase);
verifier('fraicheur en anglais : les valeurs sont inserees', /stale for 60 s/.test(phrase) && /ETag "abc"/.test(phrase), phrase);
setLang('fr');
verifier('fraicheur en francais inchangee', /perimee depuis 60 s/.test(resumerFraicheur(perimee)));

const cspRetiree = analyserCsp("default-src 'self'; referrer no-referrer");
const faitRetire = cspRetiree.faits.find(f => /retiree/.test(f.texte));
verifier('CSP : le sens d une directive retiree est marque a traduire',
  faitRetire && faitRetire.aTraduire.includes('s') && EN[faitRetire.valeurs.s] !== undefined);
egal('langue remise en francais', lang(), 'fr');

bilan('Lectures de la 4.4');
