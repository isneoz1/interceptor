/* Tests des outils avances — INTERCEPTOR (cree par D4RK)
 *
 * Couvre les modules d analyse de protocole : trames sur le fil, politiques de
 * securite, fraicheur de cache, corps multipart, URL canoniques, tables de
 * reference, empreintes rares et structures binaires.
 *
 * Ces modules sont ceux que l interface branche dans le panneau de detail et
 * dans la boite a outils : un echec ici est une regression visible a l ecran.
 */
import { egal, memeListe, verifier, leve, bilan } from './harnais.mjs';

import { decoderTrameWs, decoderTramesWs, encoderTrameWs, decoderTrameH2, decoderTramesH2, PREFACE_H2,
  fragmentEntetes, entetesDeTrame } from '../ui/lib/trames.js';
import { decoderBlocHpack, TableDynamique, TABLE_STATIQUE, encoderEntier,
  encoderHuffman, decoderHuffman } from '../ui/lib/hpack.js';
import { analyserCsp, DIRECTIVES_CSP } from '../ui/lib/csp.js';
import { analyserFraicheur, analyserCacheControl, entetesVersObjet, resumerFraicheur }
  from '../ui/lib/cache-http.js';
import { analyserMultipart, fabriquerMultipart, frontiereDe } from '../ui/lib/multipart.js';
import { normaliserUrl, nomInverse, adresseDepuisNomInverse, scriptsDuNom } from '../ui/lib/url-plus.js';
import { decrireAlerteTls, decrireErreurH3, decrireErreurQuic, decrireTypeDns, decrireRcodeDns,
  ALERTES_TLS, TYPES_DNS } from '../ui/lib/ref-protocoles.js';
import { decoderProtobuf, decoderMsgpack, decoderCbor, essayerFormats } from '../ui/lib/binaires.js';
import { lireDer, pemVersOctets, nomOid } from '../ui/lib/asn1.js';
import { analyserEntete, analyserBloc, ENTETES_ANALYSABLES } from '../ui/lib/entetes-analyse.js';
import { decoderValeurEtendue, encoderValeurEtendue, decoderMotsCodes,
  contientMotCode, decouperParametres, analyserValeurParametree, analyserContentDisposition }
  from '../ui/lib/entetes-parametres.js';
import { sha3, shake } from '../ui/lib/sha3.js';
import { blake2b512, blake2s256 } from '../ui/lib/blake2.js';
import { crc, crcParNom, CRC_VARIANTES, murmur3, xxhash32 } from '../ui/lib/sommes.js';
import { luhn, chercherJson } from '../ui/lib/motifs.js';
import { uuidV4, uuidV5, ulid, forceMotDePasse, ESPACES_UUID } from '../ui/lib/generateurs.js';
import { entropie, analyserChaineRequete, analyserCookies } from '../ui/lib/inspect.js';
import { hexVersOctets, octetsVersHex } from '../ui/lib/bytes.js';

/* ------------------------- Trames WebSocket (RFC 6455) -------------------- */
/* Section 5.7 : les deux ecritures publiees du message « Hello ». */
const wsClair = decoderTrameWs('810548656c6c6f');
egal('trame non masquee : texte lu', wsClair.texte, 'Hello');
egal('trame non masquee : opcode', wsClair.opcodeNom, 'texte');
verifier('trame non masquee : FIN a 1', wsClair.fin === true);
verifier('trame non masquee : venue du serveur', wsClair.masque === false);
egal('trame non masquee : en-tete de deux octets', wsClair.enteteOctets, 2);

const wsMasque = decoderTrameWs('818537fa213d7f9f4d5158');
egal('trame masquee : meme texte apres demasquage', wsMasque.texte, 'Hello');
egal('trame masquee : cle de masquage', wsMasque.cleMasque, '37fa213d');
egal('trame masquee : en-tete de six octets', wsMasque.enteteOctets, 6);

/* Section 5.5.1 : une fermeture porte un code sur deux octets. 1000 = normale. */
const wsFin = decoderTrameWs('880203e8');
egal('code de fermeture normale', wsFin.fermeture.code, 1000);
verifier('trame de controle reconnue', wsFin.controle === true);

/* Un encodage suivi d un decodage doit rendre le texte de depart. */
const aller = octetsVersHex(encoderTrameWs({ texte: 'INTERCEPTOR' }));
egal('aller-retour d encodage WebSocket', decoderTrameWs(aller).texte, 'INTERCEPTOR');

egal('deux trames a la suite', decoderTramesWs('810548656c6c6f810548656c6c6f').length, 2);
leve('trame trop courte refusee', () => decoderTrameWs('81'));

/* -------------------------- Trames HTTP/2 (RFC 9113) ---------------------- */
const h2 = decoderTrameH2('000000040100000000');
egal('type de trame', h2.typeNom, 'SETTINGS');
egal('longueur nulle', h2.longueur, 0);
memeListe('drapeau ACK reconnu', h2.drapeauxNoms, ['ACK']);
egal('flux de controle', h2.flux, 0);

/* GOAWAY (type 0x07) sur le flux 0 : charge de huit octets, dernier flux
   traite = 1, code d erreur = 0 (NO_ERROR). */
const goaway = decoderTrameH2('000008070000000000' + '00000001' + '00000000');
egal('GOAWAY reconnu', goaway.typeNom, 'GOAWAY');
verifier('GOAWAY expose le dernier flux traite',
  goaway.details.some(([cle]) => /dernier flux/.test(cle)));

egal('preface HTTP/2 connue', PREFACE_H2.startsWith('PRI * HTTP/2.0'), true);
verifier('trames HTTP/2 enchainees', decoderTramesH2('000000040100000000000000040100000000').length === 2);

/* ------------------------- HPACK (RFC 7541) ------------------------------- */
/* Les exemples complets de l annexe C. Ils couvrent les entiers, les chaines
   litterales, le codage de Huffman, la table statique et la table dynamique. */
const paires = r => r.entetes.map(e => e.nom + ': ' + e.valeur);

/* C.1 : entiers a prefixe. */
egal('C.1.1 entier 10 sur 5 bits', octetsVersHex(encoderEntier(10, 5)), '0a');
egal('C.1.2 entier 1337 sur 5 bits', octetsVersHex(encoderEntier(1337, 5)), '1f9a0a');
egal('C.1.3 entier 42 sur 8 bits', octetsVersHex(encoderEntier(42, 8)), '2a');

/* C.2 : les quatre formes de representation. */
memeListe('C.2.1 litteral avec indexation',
  paires(decoderBlocHpack('400a637573746f6d2d6b65790d637573746f6d2d686561646572')),
  ['custom-key: custom-header']);
memeListe('C.2.2 litteral sans indexation',
  paires(decoderBlocHpack('040c2f73616d706c652f70617468')), [':path: /sample/path']);
memeListe('C.2.3 litteral jamais indexe',
  paires(decoderBlocHpack('100870617373776f726406736563726574')), ['password: secret']);
memeListe('C.2.4 en-tete entierement indexe', paires(decoderBlocHpack('82')), [':method: GET']);

/* C.3 : deux requetes d une meme connexion, la seconde s appuyant sur la
   table dynamique remplie par la premiere. */
const tableC3 = new TableDynamique();
memeListe('C.3.1 premiere requete',
  paires(decoderBlocHpack('828684410f7777772e6578616d706c652e636f6d', tableC3)),
  [':method: GET', ':scheme: http', ':path: /', ':authority: www.example.com']);
memeListe('C.3.2 seconde requete, index appris de la premiere',
  paires(decoderBlocHpack('828684be58086e6f2d6361636865', tableC3)),
  [':method: GET', ':scheme: http', ':path: /', ':authority: www.example.com',
    'cache-control: no-cache']);

/* C.4 : les memes requetes, chaines codees en Huffman. */
memeListe('C.4.1 requete en Huffman',
  paires(decoderBlocHpack('828684418cf1e3c2e5f23a6ba0ab90f4ff', new TableDynamique())),
  [':method: GET', ':scheme: http', ':path: /', ':authority: www.example.com']);

/* C.6 : reponse en Huffman avec une table de 256 octets, qui force l eviction. */
memeListe('C.6.1 reponse en Huffman',
  paires(decoderBlocHpack('488264025885aec3771a4b6196d07abe941054d444a82005'
    + '95040b8166e082a62d1bff6e919d29ad171863c78f0b97c8e9ae82ae43d3',
  new TableDynamique(256))),
  [':status: 302', 'cache-control: private', 'date: Mon, 21 Oct 2013 20:13:21 GMT',
    'location: https://www.example.com']);

/* Huffman : la table publiee doit produire exactement la sortie de la RFC. */
egal('Huffman de www.example.com (annexe C.4.1)',
  octetsVersHex(encoderHuffman(new TextEncoder().encode('www.example.com'))),
  'f1e3c2e5f23a6ba0ab90f4ff');
egal('Huffman aller-retour',
  new TextDecoder().decode(decoderHuffman(encoderHuffman(new TextEncoder().encode('INTERCEPTOR')))),
  'INTERCEPTOR');

/* Table statique : 61 entrees, bornes comprises. */
egal('table statique complete', TABLE_STATIQUE.length, 61);
egal('premiere entree statique', TABLE_STATIQUE[0][0], ':authority');
egal('derniere entree statique', TABLE_STATIQUE[60][0], 'www-authenticate');
leve('index 0 refuse', () => new TableDynamique().lire(0));
leve('index hors table refuse', () => new TableDynamique().lire(999));

/* Table dynamique : cout d une entree et eviction (RFC 7541 section 4.1). */
const td = new TableDynamique(4096);
egal('cout d une entree', TableDynamique.coutDe('a', 'b'), 34);
td.ajouter('x', 'y');
egal('taille apres une entree', td.taille, 34);
const petite = new TableDynamique(40);
petite.ajouter('aaaa', 'bbbb');       // 40 octets exactement
egal('une entree qui rentre juste', petite.entrees.length, 1);
petite.ajouter('cccc', 'dddd');       // force l eviction de la precedente
egal('l entree la plus ancienne est evincee', petite.entrees.length, 1);
egal('c est bien la nouvelle qui reste', petite.entrees[0][0], 'cccc');
const minuscule = new TableDynamique(10);
minuscule.ajouter('nom', 'valeur');   // plus grande que la table entiere
egal('une entree trop grande vide la table sans y entrer', minuscule.entrees.length, 0);

/* Extraction du fragment : remplissage et priorite doivent etre retires. */
const brut = new Uint8Array([0x82]);
memeListe('fragment sans drapeau', Array.from(fragmentEntetes('HEADERS', 0, brut)), [0x82]);
memeListe('fragment avec PADDED',
  Array.from(fragmentEntetes('HEADERS', 0x8, new Uint8Array([2, 0x82, 0, 0]))), [0x82]);
memeListe('fragment avec PRIORITY',
  Array.from(fragmentEntetes('HEADERS', 0x20, new Uint8Array([0, 0, 0, 1, 16, 0x82]))), [0x82]);
egal('un type sans en-tetes ne rend rien', fragmentEntetes('DATA', 0, brut), null);

/* Une trame HEADERS complete, decodee de bout en bout. */
const trameH = decoderTrameH2('000011' + '01' + '04' + '00000001'
  + '828684418cf1e3c2e5f23a6ba0ab90f4ff');
egal('trame HEADERS reconnue', trameH.typeNom, 'HEADERS');
const lusH = entetesDeTrame(trameH, new TableDynamique());
memeListe('en-tetes lus dans la trame', lusH.entetes.map(h => h.nom),
  [':method', ':scheme', ':path', ':authority']);
verifier('bloc signale complet grace a END_HEADERS', lusH.complet === true);

/* ------------------------------ CSP (niveau 3) ---------------------------- */
const csp = analyserCsp("default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.exemple.fr");
egal('deux directives lues', csp.directives.length, 2);
egal('premiere directive', csp.directives[0].nom, 'default-src');

/* Chaque fait est un gabarit constant plus ses valeurs : c est ce qui permet
   de le traduire. Un fait dont le texte porterait deja le nom de la directive
   ne serait jamais trouve dans le dictionnaire. */
const texte = f => f.texte;
verifier('unsafe-inline signale', csp.faits.some(f => /unsafe-inline/.test(texte(f))));
verifier('base-uri manquant signale', csp.faits.some(f => /base-uri absent/.test(texte(f))));
verifier('frame-ancestors manquant signale', csp.faits.some(f => /frame-ancestors absent/.test(texte(f))));
verifier('chaque fait porte un gabarit et ses valeurs',
  csp.faits.every(f => typeof f.texte === 'string' && f.valeurs && typeof f.valeurs === 'object'));
const faitInline = csp.faits.find(f => /unsafe-inline/.test(texte(f)));
egal('la directive concernee est une valeur, pas du texte fige', faitInline.valeurs.d, 'script-src');
verifier('aucun gabarit ne contient de nom de directive concatene',
  csp.faits.every(f => !/^(script-src|default-src|object-src) /.test(f.texte)));

const cspStricte = analyserCsp("default-src 'none'; script-src 'nonce-abc'; base-uri 'none'; " +
  "frame-ancestors 'none'; form-action 'self'; object-src 'none'");
verifier('politique stricte : aucune permission large',
  cspStricte.faits.some(f => /aucune permission large/.test(texte(f))));

const cspDouble = analyserCsp("script-src 'self'; script-src 'unsafe-eval'");
verifier('directive en double signalee', cspDouble.faits.some(f => /en double/.test(texte(f))));
verifier('directive inconnue signalee',
  analyserCsp('directive-inventee x').faits.some(f => /inconnue/.test(texte(f))));
verifier('table des directives non vide', DIRECTIVES_CSP.length > 20);

/* -------------------------- Fraicheur HTTP (RFC 9111) --------------------- */
const t0 = Date.UTC(2026, 0, 15, 10, 30, 0);
const fraiche = analyserFraicheur({
  reponse: { 'cache-control': 'max-age=300', date: new Date(t0).toUTCString() },
  instantReponse: t0,
  maintenant: t0 + 100000        // cent secondes plus tard
});
egal('duree de fraicheur lue', fraiche.duree, 300);
egal('source de la duree', fraiche.source, 'max-age');
egal('age courant apres 100 s', fraiche.ageCourant, 100);
verifier('encore fraiche', fraiche.fraiche === true);
egal('temps restant', fraiche.restant, 200);

const perimee = analyserFraicheur({
  reponse: { 'cache-control': 'max-age=60', date: new Date(t0).toUTCString(), etag: '"abc"' },
  instantReponse: t0,
  maintenant: t0 + 120000
});
verifier('perimee apres 120 s avec max-age=60', perimee.fraiche === false);
verifier('revalidable grace a ETag', perimee.revalidable === true);
verifier('resume en clair', /perimee/.test(resumerFraicheur(perimee)));

const jamais = analyserFraicheur({ reponse: { 'cache-control': 'no-store' } });
verifier('no-store rend la reponse non stockable', jamais.stockable === false);
egal('resume d une reponse non stockable', resumerFraicheur(jamais), 'non stockable');

/* s-maxage ne prime que pour un cache partage : la difference doit se voir. */
const partage = analyserFraicheur({
  reponse: { 'cache-control': 's-maxage=600, max-age=60', date: new Date(t0).toUTCString() },
  instantReponse: t0, maintenant: t0, partage: true
});
const prive = analyserFraicheur({
  reponse: { 'cache-control': 's-maxage=600, max-age=60', date: new Date(t0).toUTCString() },
  instantReponse: t0, maintenant: t0, partage: false
});
egal('cache partage suit s-maxage', partage.duree, 600);
egal('cache du navigateur suit max-age', prive.duree, 60);

egal('Cache-Control decoupe', analyserCacheControl('max-age=300, must-revalidate')['max-age'], '300');
egal('directive sans valeur vaut true', analyserCacheControl('no-store')['no-store'], true);
egal('bloc d entetes lu en objet',
  entetesVersObjet('Content-Type: text/html\nAge: 12').age, '12');

/* ----------------------- Corps multipart (RFC 7578) ----------------------- */
const corps = '--FRONT\r\nContent-Disposition: form-data; name="champ"\r\n\r\nvaleur\r\n'
  + '--FRONT\r\nContent-Disposition: form-data; name="piece"; filename="note.txt"\r\n'
  + 'Content-Type: text/plain\r\n\r\ncontenu du fichier\r\n--FRONT--\r\n';
const mp = analyserMultipart(corps, '', 'multipart/form-data; boundary=FRONT');
egal('frontiere lue dans le Content-Type', mp.frontiere, 'FRONT');
egal('deux parties', mp.parties.length, 2);
egal('nom du premier champ', mp.parties[0].nom, 'champ');
egal('valeur du premier champ', mp.parties[0].contenu, 'valeur');
egal('nom de fichier de la seconde partie', mp.parties[1].fichier, 'note.txt');
egal('type declare de la piece jointe', mp.parties[1].type, 'text/plain');
verifier('seconde partie reconnue comme fichier', mp.parties[1].estFichier === true);
verifier('marqueur de fin present', mp.termine === true);
egal('frontiere extraite d un Content-Type', frontiereDe('multipart/form-data; boundary="ab12"'), 'ab12');

const refait = fabriquerMultipart([{ nom: 'a', contenu: '1' }], 'BORD');
egal('Content-Type fabrique', refait.contentType, 'multipart/form-data; boundary=BORD');
egal('corps fabrique puis relu', analyserMultipart(refait.corps, 'BORD').parties[0].contenu, '1');
leve('corps sans frontiere refuse', () => analyserMultipart('rien du tout', ''));

/* ------------------------- URL canoniques (RFC 3986) ---------------------- */
const canon = normaliserUrl('HTTP://Exemple.FR:80/a/./b/../c');
egal('forme canonique', canon.apres, 'http://exemple.fr/a/c');
verifier('changements listes', canon.changements.length >= 3);
verifier('URL deja canonique inchangee', normaliserUrl('https://exemple.fr/a').identique === true);
leve('URL invalide refusee', () => normaliserUrl('pas une url'));

egal('nom inverse IPv4', nomInverse('192.0.2.5'), '5.2.0.192.in-addr.arpa');
egal('nom inverse relu', adresseDepuisNomInverse('5.2.0.192.in-addr.arpa'), '192.0.2.5');
verifier('nom inverse IPv6 termine par ip6.arpa', nomInverse('2001:db8::1').endsWith('ip6.arpa'));
leve('nom inverse invalide refuse', () => adresseDepuisNomInverse('exemple.fr'));

/* Un « a » cyrillique (U+0430) dans un mot latin : le nom se lit « paypal ». */
const sosie = scriptsDuNom('pаypal.com');
verifier('melange d ecritures detecte', sosie.suspect === true);
verifier('caractere sosie identifie', sosie.libelles[0].sosies[0].ressembleA === 'a');
verifier('nom ordinaire non suspect', scriptsDuNom('exemple.fr').suspect === false);

/* --------------------------- Tables de protocole -------------------------- */
egal('alerte TLS 40', decrireAlerteTls(40).nom, 'handshake_failure');
egal('alerte TLS 0', decrireAlerteTls(0).nom, 'close_notify');
egal('type DNS 28', decrireTypeDns(28).nom, 'AAAA');
egal('type DNS par son nom', decrireTypeDns('MX').code, 15);
egal('code de reponse DNS 3', decrireRcodeDns(3).nom, 'NXDomain');
verifier('erreur HTTP/3 connue', decrireErreurH3(0x0102) !== null);
verifier('erreur QUIC connue', decrireErreurQuic(0x01) !== null);
verifier('table TLS non vide', ALERTES_TLS.length > 10);
verifier('table DNS non vide', TYPES_DNS.length > 15);
egal('code inconnu rend null', decrireAlerteTls(9999), null);

/* ---------------------------- Structures binaires ------------------------- */
/* Protobuf : champ 1, varint 150 (exemple de la documentation officielle). */
const pb = decoderProtobuf(hexVersOctets('089601'));
egal('numero du champ protobuf', pb[0].numero, 1);
egal('valeur du varint', String(pb[0].valeur), '150');

/* MessagePack : 0x01 = entier positif 1. CBOR : 0x01 aussi. */
egal('MessagePack entier', decoderMsgpack(hexVersOctets('01')), 1);
egal('CBOR entier', decoderCbor(hexVersOctets('01')), 1);
verifier('plusieurs formats acceptent un octet simple', essayerFormats(hexVersOctets('01')).length >= 1);

/* DER : SEQUENCE (0x30) de longueur 3 contenant INTEGER 1. */
const der = lireDer(hexVersOctets('3003020101'));
verifier('SEQUENCE DER reconnue', /SEQUENCE/i.test(JSON.stringify(der)));
verifier('OID 2.5.4.3 reconnu comme nom commun', /CN/.test(nomOid('2.5.4.3')));
leve('PEM invalide refuse', () => pemVersOctets('pas un bloc PEM'));

/* ---------- Parametres d en-tete : RFC 8187, 2231, 2047, 6266 ------------- */
/* Chaque attendu vient d un exemple publie dans la RFC correspondante. */

/* RFC 8187 section 3.2.2, les deux exemples. */
egal('RFC 8187 ex.1', decoderValeurEtendue("us-ascii'en'This%20is%20%2A%2A%2Afun%2A%2A%2A").texte,
  'This is ***fun***');
egal('RFC 8187 ex.2', decoderValeurEtendue("UTF-8''%c2%a3%20and%20%e2%82%ac%20rates").texte,
  '£ and € rates');
egal('langue lue dans la valeur etendue', decoderValeurEtendue("us-ascii'en'x").langue, 'en');
leve('valeur etendue sans apostrophes refusee', () => decoderValeurEtendue('rapport.pdf'));

egal('valeur etendue ecrite puis relue',
  decoderValeurEtendue(encoderValeurEtendue('€ rates')).texte, '€ rates');
egal('encodage conforme a la RFC 8187', encoderValeurEtendue('€ rates'),
  "UTF-8''%E2%82%AC%20rates");

/* RFC 6266 section 5 : la forme etendue l emporte sur la forme simple. */
egal('RFC 6266 filename etendu',
  analyserContentDisposition("attachment; filename*=UTF-8''%e2%82%ac%20rates").nomFichier,
  '€ rates');
egal('RFC 6266 forme etendue prioritaire',
  analyserContentDisposition('attachment; filename="EURO rates"; '
    + "filename*=utf-8''%e2%82%ac%20rates").nomFichier, '€ rates');
egal('nom de fichier simple',
  analyserContentDisposition('attachment; filename="rapport.pdf"').nomFichier, 'rapport.pdf');
egal('disposition lue',
  analyserContentDisposition('inline; filename="a.txt"').disposition, 'inline');

/* RFC 2231 section 4 : parametre decoupe en trois morceaux. */
const continu = analyserValeurParametree("application/x-stuff; "
  + "title*0*=us-ascii'en'This%20is%20even%20more%20; "
  + "title*1*=%2A%2A%2Afun%2A%2A%2A%20; title*2=\"isn't it!\"");
const titre = continu.parametres.find(p => p.nom === 'title');
egal('RFC 2231 morceaux rassembles', titre.valeur, "This is even more ***fun*** isn't it!");
egal('nombre de morceaux', titre.morceaux, 3);
egal('type de tete conserve', continu.tete, 'application/x-stuff');

/* RFC 2047 section 8 : les mots codes publies. */
egal('RFC 2047 forme Q', decoderMotsCodes('=?ISO-8859-1?Q?Keith_Moore?='), 'Keith Moore');
egal('RFC 2047 forme Q avec accent', decoderMotsCodes('=?ISO-8859-1?Q?Andr=E9?='), 'André');
egal('RFC 2047 forme B',
  decoderMotsCodes('=?ISO-8859-1?B?SWYgeW91IGNhbiByZWFkIHRoaXMgeW8=?='),
  'If you can read this yo');
egal('texte sans mot code inchange', decoderMotsCodes('rapport.pdf'), 'rapport.pdf');
egal('mot code illisible rendu tel quel',
  decoderMotsCodes('=?INCONNU-42?Q?x?='), '=?INCONNU-42?Q?x?=');
verifier('mot code detecte', contientMotCode('=?UTF-8?B?YQ==?=') === true);
verifier('absence de mot code detectee', contientMotCode('rapport.pdf') === false);

/* Le decoupage doit respecter les guillemets. */
egal('point-virgule entre guillemets',
  decouperParametres('form-data; name="a;b"; filename="x.txt"').parametres[0].valeur, 'a;b');
egal('antislash entre guillemets',
  decouperParametres('form-data; name="a\\"b"').parametres[0].valeur, 'a"b');

/* Ce qui merite d etre regarde dans un nom de fichier propose. */
const piege = analyserContentDisposition('attachment; filename="../../etc/passwd"');
verifier('remontee d arborescence signalee', piege.risques.some(r => /remonte/.test(r)));
verifier('separateur de chemin signale', piege.risques.some(r => /separateur/.test(r)));
egal('un nom ordinaire ne declenche rien',
  analyserContentDisposition('attachment; filename="rapport.pdf"').risques.length, 0);

/* L analyseur d en-tetes doit rendre le nom decode, pas la valeur brute. */
const cdAnalyse = analyserEntete('Content-Disposition', "attachment; filename*=UTF-8''%e2%82%ac%20rates");
verifier('Content-Disposition decode dans l analyseur',
  cdAnalyse.parties.some(p => p.valeur === '€ rates'));

/* ------------------------------- En-tetes --------------------------------- */
const setCookie = analyserEntete('Set-Cookie', 'a=1; Path=/; Secure; SameSite=None');
verifier('Set-Cookie decoupe', setCookie.parties.length > 1);
verifier('SameSite=None sans Secure serait signale',
  analyserEntete('Set-Cookie', 'a=1; SameSite=None').risques.length > 0);
egal('bloc de deux lignes lu', analyserBloc('A: 1\nB: 2').length, 2);
verifier('liste des entetes analysables non vide', ENTETES_ANALYSABLES.length > 10);

/* ------------------------------- Empreintes ------------------------------- */
/* Vecteurs publies : NIST FIPS 202 pour SHA-3 et SHAKE, RFC 7693 pour BLAKE2. */
egal('SHA3-256 de la chaine vide', sha3('', 256),
  'a7ffc6f8bf1ed76651c14756a061d662f580ff4de43b49fa82d80a4b80f8434a');
egal('SHA3-512 de abc', sha3('abc', 512).slice(0, 32), 'b751850b1a57168a5693cd924b6b096e');
egal('SHAKE128 de la chaine vide', shake('', 128, 32).slice(0, 16), '7f9c2ba4e88f827d');
egal('BLAKE2b-512 de abc', blake2b512('abc').slice(0, 32), 'ba80a53f981c4d0d6a2797b69f12f6e9');
egal('BLAKE2s-256 de abc', blake2s256('abc').slice(0, 32), '508c5e8c327c14e2e1a72ba34eeb452f');
egal('MurmurHash3 de la chaine vide', murmur3(''), '00000000');
egal('xxHash32 de la chaine vide', xxhash32(''), '02cc5d05');

/* Chaque variante CRC publie sa valeur de controle pour « 123456789 » : on la
   recalcule pour toutes, ce qui verifie polynome, reflexion et valeur finale. */
for (const variante of CRC_VARIANTES) {
  const attendu = variante.controle.toString(16).padStart(variante.largeur / 4, '0');
  egal('valeur de controle de ' + variante.nom, crc('123456789', variante.nom), attendu);
}
egal('variante CRC retrouvee par son nom', crcParNom('CRC-32/ISO-HDLC').largeur, 32);

/* --------------------------------- Motifs --------------------------------- */
/* Numero de test Visa publie : 4111 1111 1111 1111 passe la cle de Luhn. */
verifier('cle de Luhn valide', luhn('4111111111111111').valide === true);
verifier('cle de Luhn invalide', luhn('4111111111111112').valide === false);
egal('chemin JSON suivi', chercherJson('{"a":{"b":[1,2,3]}}', '$.a.b[1]')[0].valeur, 2);
egal('descente recursive JSON', chercherJson('{"x":{"cle":7}}', '$..cle')[0].valeur, 7);

/* ------------------------------ Generateurs ------------------------------- */
verifier('UUID v4 bien forme',
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(uuidV4()));
/* RFC 9562 : UUID v5 de « www.example.com » dans l espace de noms DNS. */
egal('UUID v5 reproductible', await uuidV5('www.example.com', ESPACES_UUID.DNS),
  '2ed6657d-e927-568b-95e1-2665a8aea6a2');
verifier('ULID de 26 caracteres', ulid().length === 26);
verifier('mot de passe long juge solide', forceMotDePasse('Tr0ub4dor&3-xK9!qZ').bits > 60);
verifier('mot de passe court juge faible', forceMotDePasse('1234').bits < 20);

/* -------------------------------- Inspection ------------------------------ */
verifier('entropie plus haute pour du texte varie',
  entropie('abcdefghij').bits > entropie('aaaaaaaaaa').bits);
egal('chaine de requete decoupee', analyserChaineRequete('?a=1&b=2').length, 2);
egal('cookies decoupes', analyserCookies('a=1; b=2').length, 2);

bilan('Outils avances');
