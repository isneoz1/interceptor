/* Tests des outils avances — INTERCEPTOR (cree par NeoZ)
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
import { lireListe, lireDictionnaire, lireArticleSeul, analyserChampStructure,
  decrireArticle, FORMES_CONNUES } from '../ui/lib/champs-structures.js';
import { sha3, shake } from '../ui/lib/sha3.js';
import { blake2b512, blake2s256 } from '../ui/lib/blake2.js';
import { crc, crcParNom, CRC_VARIANTES, murmur3, xxhash32, xxhash64, siphash24Octets }
  from '../ui/lib/sommes.js';
import { z85Encoder, z85Decoder, uuencode, uudecode } from '../ui/lib/codecs-transport.js';
import { empreinteJwk, jwkCanonique } from '../ui/lib/jwt.js';
import { lirePhpStrict, versJs, ecrirePhp, ressemblePhp } from '../ui/lib/php-serialise.js';
import { lireUuid, lireUlid, lireSnowflake, snowflakeToutesOrigines, lireObjectId,
  lireKsuid, lireIdentifiant, remarqueDate, ORIGINES_SNOWFLAKE } from '../ui/lib/identifiants.js';
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

/* --------------------- Champs structures (RFC 8941) ----------------------- */
/* Les exemples des sections 3.1 a 3.3 de la RFC, puis de vrais en-tetes. */
egal('liste de jetons (section 3.1)',
  lireListe('sugar, tea, rhubarb').map(x => x.valeur).join(','), 'sugar,tea,rhubarb');
egal('les jetons sont types comme tels', lireListe('sugar').map(x => x.type).join(''), 'jeton');
egal('listes internes (section 3.1.1)',
  lireListe('("foo" "bar"), ("baz"), ("bat" "one"), ()').map(decrireArticle).join(' '),
  '("foo" "bar") ("baz") ("bat" "one") ()');
egal('dictionnaire (section 3.2)',
  lireDictionnaire('en="Applepie", da=:w4ZibGV0w6ZydGU=:').map(x => x.cle).join(','), 'en,da');
egal('une chaine reste une chaine',
  lireDictionnaire('en="Applepie"')[0].valeur, 'Applepie');
egal('une suite d octets est decodee',
  lireDictionnaire('da=:w4ZibGV0w6ZydGU=:')[0].valeur.length, 11);
egal('membre sans valeur : booleen vrai implicite',
  lireDictionnaire('a=?0, b, c; foo=bar').map(x => x.cle + '=' + x.valeur).join(' '),
  'a=false b=true c=true');
egal('article avec parametre (section 3.3)',
  lireArticleSeul('5; foourl="https://foo.example.com/"').parametres[0].valeur,
  'https://foo.example.com/');

/* Les six types de base, chacun reconnu pour ce qu il est. */
for (const [texte, type] of [['42', 'entier'], ['-4.5', 'decimal'], ['"a b"', 'chaine'],
  ['foo123/456', 'jeton'], ['?1', 'booleen'], [':YQ==:', 'suite d octets']]) {
  egal('type de ' + texte, lireArticleSeul(texte).type, type);
}
egal('un entier reste un nombre', lireArticleSeul('42').valeur, 42);
egal('une chaine de chiffres reste du texte', lireArticleSeul('"42"').valeur, '42');

/* Ce que la grammaire interdit doit etre refuse, pas devine. */
leve('plus de trois decimales refusees', () => lireArticleSeul('1.2345'));
leve('chaine non fermee refusee', () => lireArticleSeul('"a'));
leve('booleen autre que 0 ou 1 refuse', () => lireArticleSeul('?2'));
leve('virgule finale refusee dans une liste', () => lireListe('sugar,'));
leve('virgule finale refusee dans un dictionnaire', () => lireDictionnaire('a=1,'));
leve('liste interne non fermee refusee', () => lireListe('("a"'));
leve('texte en trop apres un article refuse', () => lireArticleSeul('5 6'));

/* De vrais en-tetes, lus par l analyseur avec la forme que leur RFC impose. */
egal('Priority est un dictionnaire', FORMES_CONNUES['priority'], 'dictionnaire');
const prio = analyserEntete('Priority', 'u=1, i');
verifier('Priority : urgence lue comme entier',
  prio.parties.some(p => p.cle === 'u' && p.valeur === '1' && p.note === 'entier'));
verifier('Priority : incremental lu comme booleen implicite',
  prio.parties.some(p => p.cle === 'i' && p.note === 'booleen'));

const digest = analyserEntete('Content-Digest',
  'sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:');
verifier('Content-Digest : la suite d octets fait 32 octets',
  digest.parties.some(p => /32 octets/.test(p.valeur)));

const statut = analyserEntete('Cache-Status', 'ExampleCache; hit; ttl=376');
verifier('Cache-Status : parametre ttl lu comme entier',
  statut.parties.some(p => p.cle.trim() === ';ttl' && p.valeur === '376'));

/* Forme inconnue : on essaie les trois et on rend celles qui tiennent. */
const essais = analyserChampStructure('a=1, b=2');
verifier('une valeur ambigue rend plusieurs lectures valides', essais.valides.length >= 1);
egal('aucune forme imposee sans nom d en-tete', essais.formeAttendue, null);

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

/* ------------------- Encodages de transport binaire ----------------------- */
/* ZeroMQ RFC 32 : le vecteur publie dans la specification elle-meme. */
egal('Z85 du vecteur de la RFC 32',
  z85Encoder(new Uint8Array([0x86, 0x4F, 0xD2, 0x6F, 0xB5, 0x59, 0xF7, 0x5B])), 'HelloWorld');
egal('Z85 relu', octetsVersHex(z85Decoder('HelloWorld')), '864fd26fb559f75b');
leve('Z85 refuse une longueur non multiple de 4', () => z85Encoder(new Uint8Array(3)));
leve('Z85 refuse une longueur non multiple de 5', () => z85Decoder('abcd'));
leve('Z85 refuse un caractere hors alphabet', () => z85Decoder('Hello"orld'));

/* uuencode : « Cat » donne la ligne canonique #0V%T. */
verifier('uuencode produit la ligne attendue',
  uuencode(new TextEncoder().encode('Cat'), 'cat.txt').includes('#0V%T'));
verifier('uuencode ecrit son en-tete',
  uuencode(new TextEncoder().encode('Cat'), 'cat.txt').startsWith('begin 644 cat.txt'));
const uuLu = uudecode(uuencode(new TextEncoder().encode('Cat'), 'cat.txt'));
egal('uudecode rend le contenu', new TextDecoder().decode(uuLu.octets), 'Cat');
egal('uudecode rend le nom', uuLu.nom, 'cat.txt');
const uuLong = 'INTERCEPTOR '.repeat(20);
egal('uuencode sur plusieurs lignes',
  new TextDecoder().decode(uudecode(uuencode(new TextEncoder().encode(uuLong))).octets), uuLong);
leve('uudecode refuse un texte quelconque', () => uudecode('ceci n est pas du uuencode'));

/* ---------------------------- Hachages 64 bits ---------------------------- */
/* SipHash-2-4 : les vecteurs de l implementation de reference, cle 00..0f et
   message forme des n premiers octets croissants. */
const cleSip = new Uint8Array(16);
for (let i = 0; i < 16; i++) cleSip[i] = i;
const SIP_ATTENDUS = ['726fdb47dd0e0e31', '74f839c593dc67fd', '0d6c8009d9a94f5a',
  '85676696d7fb7e2d', 'cf2794e0277187b7'];
for (let n = 0; n < SIP_ATTENDUS.length; n++) {
  const message = new Uint8Array(n);
  for (let i = 0; i < n; i++) message[i] = i;
  egal('SipHash-2-4 sur ' + n + ' octet(s)',
    siphash24Octets(message, cleSip).toString(16).padStart(16, '0'), SIP_ATTENDUS[n]);
}
leve('SipHash refuse une cle de mauvaise taille',
  () => siphash24Octets(new Uint8Array(0), new Uint8Array(8)));

/* xxHash64 : valeur publiee pour l entree vide avec la graine 0. */
egal('xxHash64 de la chaine vide', xxhash64(''), 'ef46db3751d8e999');
verifier('xxHash64 change avec la graine', xxhash64('', 1) !== xxhash64('', 0));
verifier('xxHash64 rend seize chiffres hexadecimaux',
  /^[0-9a-f]{16}$/.test(xxhash64('INTERCEPTOR par NeoZ, poste de supervision reseau')));

/* ----------------------- Empreinte de cle JWK (RFC 7638) ------------------ */
/* La cle et l empreinte de la section 3.1 de la RFC. */
const jwkRfc = {
  kty: 'RSA',
  n: '0vx7agoebGcQSuuPiLJXZptN9nndrQmbXEps2aiAFbWhM78LhWx4cbbfAAtVT86zwu1RK7aPFFxuh'
    + 'DR1L6tSoc_BJECPebWKRXjBZCiFV4n3oknjhMstn64tZ_2W-5JsGY4Hc5n9yBXArwl93lqt7_RN5w'
    + '6Cf0h4QyQ5v-65YGjQR0_FDW2QvzqY368QQMicAtaSqzs8KJZgnYb9c7d0zgdAZHzu6qMQvRL5haj'
    + 'rn1n91CbOpbISD08qNLyrdkt-bFTWhAI4vMQFh6WeZu0fM4lFd2NcRwr3XPksINHaQ-G_xBniIqbw'
    + '0Ls1jF44-csFCur-kEgU8awapJzKnqDKgw',
  e: 'AQAB',
  alg: 'RS256',
  kid: '2011-04-29'
};
egal('empreinte JWK de la RFC 7638', await empreinteJwk(jwkRfc),
  'NzbLsXh8uDCcd-6MNwXF4W_7noWXFZAfHkxZsRGC9Xs');
verifier('forme canonique : membres requis, tries, sans espace',
  jwkCanonique(jwkRfc).startsWith('{"e":"AQAB","kty":"RSA","n":"'));
verifier('les membres facultatifs sont ecartes', !jwkCanonique(jwkRfc).includes('kid'));
leve('type de cle inconnu refuse', () => jwkCanonique({ kty: 'INCONNU' }));
leve('membre requis absent refuse', () => jwkCanonique({ kty: 'RSA', e: 'AQAB' }));
egal('empreinte d une cle symetrique', jwkCanonique({ kty: 'oct', k: 'AAA', autre: 1 }),
  '{"k":"AAA","kty":"oct"}');

/* ------------------------- Serialisation PHP ------------------------------ */
/* Les formes du langage, chacune verifiee dans les deux sens. La longueur des
   chaines compte des OCTETS : c est la que se trompent la plupart des lecteurs. */
egal('null', versJs(lirePhpStrict('N;')), null);
egal('booleen vrai', versJs(lirePhpStrict('b:1;')), true);
egal('booleen faux', versJs(lirePhpStrict('b:0;')), false);
egal('entier', versJs(lirePhpStrict('i:42;')), 42);
egal('entier negatif', versJs(lirePhpStrict('i:-7;')), -7);
egal('flottant', versJs(lirePhpStrict('d:1.5;')), 1.5);
egal('infini', versJs(lirePhpStrict('d:INF;')), Infinity);
verifier('NAN reconnu', Number.isNaN(versJs(lirePhpStrict('d:NAN;'))));
egal('chaine', versJs(lirePhpStrict('s:5:"hello";')), 'hello');
egal('chaine accentuee comptee en octets',
  versJs(lirePhpStrict('s:6:"héllo";')), 'héllo');
memeListe('liste', versJs(lirePhpStrict('a:2:{i:0;s:1:"a";i:1;s:1:"b";}')), ['a', 'b']);
egal('table associative',
  JSON.stringify(versJs(lirePhpStrict('a:2:{s:3:"uid";i:42;s:4:"role";s:5:"admin";}'))),
  '{"uid":42,"role":"admin"}');
egal('structure imbriquee',
  JSON.stringify(versJs(lirePhpStrict('a:1:{s:1:"a";a:1:{s:1:"b";i:1;}}'))), '{"a":{"b":1}}');
egal('objet',
  JSON.stringify(versJs(lirePhpStrict('O:4:"User":2:{s:2:"id";i:7;s:3:"nom";s:5:"Marie";}'))),
  '{"id":7,"nom":"Marie"}');
egal('classe de l objet', lirePhpStrict('O:4:"User":0:{}').classe, 'User');
egal('enumeration PHP 8.1', lirePhpStrict('E:11:"Suit:Hearts";').cas, 'Hearts');
egal('classe de l enumeration', lirePhpStrict('E:11:"Suit:Hearts";').classe, 'Suit');
egal('reference', lirePhpStrict('R:2;').type, 'reference');
egal('reference d objet', lirePhpStrict('r:3;').type, 'reference d objet');

/* PHP encode la visibilite avec des octets nuls : les lire evite d afficher
   des caracteres invisibles a la place du nom. */
const NUL = '\u0000';
const objetPortees = lirePhpStrict('O:1:"A":2:{s:4:"' + NUL + '*' + NUL + 'x";i:1;'
  + 's:4:"' + NUL + 'A' + NUL + 'y";i:2;}');
egal('propriete protegee', objetPortees.proprietes[0].portee, 'protected');
egal('nom de la propriete protegee', objetPortees.proprietes[0].nom, 'x');
egal('propriete privee', objetPortees.proprietes[1].portee, 'private');
egal('nom de la propriete privee', objetPortees.proprietes[1].nom, 'y');

/* Ce qui est malforme doit etre refuse, jamais devine. */
leve('longueur de chaine trop grande refusee', () => lirePhpStrict('s:99:"court";'));
leve('tableau incomplet refuse', () => lirePhpStrict('a:2:{i:0;s:1:"a";}'));
leve('marque inconnue refusee', () => lirePhpStrict('x:1;'));
leve('entier non numerique refuse', () => lirePhpStrict('i:abc;'));
leve('texte en trop refuse', () => lirePhpStrict('s:5:"hello";extra'));
leve('imbrication excessive refusee', () => {
  let texte = 'i:1;';
  for (let i = 0; i < 70; i++) texte = 'a:1:{i:0;' + texte + '}';
  return lirePhpStrict(texte);
});

/* Ecriture : la longueur annoncee doit compter les octets, pas les caracteres. */
egal('ecriture d une chaine accentuee', ecrirePhp('héllo'), 's:6:"héllo";');
egal('ecriture d un entier', ecrirePhp(42), 'i:42;');
egal('ecriture de null', ecrirePhp(null), 'N;');
egal('ecriture d une liste', ecrirePhp(['a']), 'a:1:{i:0;s:1:"a";}');
egal('aller-retour',
  JSON.stringify(versJs(lirePhpStrict(ecrirePhp({ uid: 42, tags: ['a', 'b'] })))),
  '{"uid":42,"tags":["a","b"]}');

verifier('une valeur PHP est reconnue', ressemblePhp('a:1:{i:0;N;}') === true);
verifier('du texte ordinaire ne l est pas', ressemblePhp('bonjour') === false);

/* ------------------- Identifiants et leur horodatage ---------------------- */
/* La plupart des identifiants d API portent une date. Chaque decoupage suit la
   specification de l identifiant ; aucun n est devine. */

/* UUID v7 : l exemple travaille de la RFC 9562, dont l horodatage
   0x017F22E279B0 vaut 1645557742000 ms. */
const uuid7 = lireUuid('017F22E2-79B0-7CC3-98C4-DC0C0C07398F');
egal('UUID v7 : version', uuid7.version, 7);
egal('UUID v7 : horodatage', uuid7.instant, 1645557742000);
egal('UUID v7 : date', uuid7.iso, '2022-02-22T19:22:22.000Z');
egal('UUID v7 : variante', uuid7.variante, 'RFC 9562 (anciennement 4122)');

/* UUID v1 : l espace de noms DNS de la RFC, genere en fevrier 1998. Sa date
   lue doit tomber a ce moment-la, ce qui valide l origine de 1582. */
const uuid1 = lireUuid('6ba7b810-9dad-11d1-80b4-00c04fd430c8');
egal('UUID v1 : version', uuid1.version, 1);
verifier('UUID v1 : date situee en 1998', uuid1.iso.startsWith('1998-'));
egal('UUID v1 : noeud', uuid1.noeud, '00:c0:4f:d4:30:c8');
verifier('UUID v1 : noeud reconnu comme adresse reelle', uuid1.noeudAleatoire === false);

egal('UUID v4 : version', lireUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479').version, 4);
verifier('UUID v4 : aucun horodatage a extraire',
  lireUuid('f47ac10b-58cc-4372-a567-0e02b2c3d479').instant === undefined);
egal('UUID nul reconnu',
  lireUuid('00000000-0000-0000-0000-000000000000').particulier, 'UUID nul (nil)');
egal('UUID maximal reconnu',
  lireUuid('ffffffff-ffff-ffff-ffff-ffffffffffff').particulier, 'UUID maximal (max)');
leve('forme d UUID invalide refusee', () => lireUuid('pas-un-uuid'));

/* ULID : l horodatage occupe les dix premiers caracteres, sur 48 bits. La
   valeur maximale « 7ZZZZZZZZZ » doit donc valoir exactement 2^48 - 1, ce qui
   verifie l alphabet de Crockford d un bout a l autre. */
egal('ULID : horodatage maximal sur 48 bits',
  lireUlid('7ZZZZZZZZZ' + 'A'.repeat(16)).instant, 281474976710655);
egal('ULID : horodatage nul', lireUlid('0'.repeat(26)).instant, 0);
const ulidLu = lireUlid('01ARZ3NDEKTSV4RRFFQ69G5FAV');
egal('ULID : horodatage lu', ulidLu.instant, 1469922850259);
egal('ULID : date', ulidLu.iso, '2016-07-30T23:54:10.259Z');
egal('ULID : partie aleatoire', ulidLu.hasardBase32, 'TSV4RRFFQ69G5FAV');
leve('ULID trop court refuse', () => lireUlid('TROPCOURT'));
leve('ULID avec une lettre exclue refuse', () => lireUlid('01ARZ3NDEKTSV4RRFFQ69G5FAI'));

/* Snowflake : 41 bits de millisecondes depuis une origine propre au service.
   L exemple est celui de la documentation de Discord. */
const flocon = lireSnowflake('175928847299117063', 1420070400000);
egal('Snowflake Discord : date', flocon.iso, '2016-04-30T11:18:25.796Z');
egal('Snowflake : machine', flocon.machine, 1);
egal('Snowflake : sequence', flocon.sequence, 7);
verifier('origines connues declarees', ORIGINES_SNOWFLAKE.length >= 3);
verifier('plusieurs origines donnent plusieurs lectures',
  snowflakeToutesOrigines('175928847299117063').filter(x => x.plausible).length >= 2);
leve('Snowflake non numerique refuse', () => lireSnowflake('abc'));

/* ObjectId : les quatre premiers octets sont des secondes Unix. */
const oid = lireObjectId('507f1f77bcf86cd799439011');
egal('ObjectId : secondes', oid.secondes, 1350508407);
egal('ObjectId : date', oid.iso, '2012-10-17T21:13:27.000Z');
egal('ObjectId : compteur', oid.compteur, 0x439011);
leve('ObjectId trop court refuse', () => lireObjectId('507f1f77'));

/* KSUID : quatre octets de secondes depuis le 13 mai 2014, puis seize de
   hasard. L exemple vient du depot de reference. */
const ksuid = lireKsuid('0ujtsYcgvSTl8PAuAdqWYSMnLOv');
egal('KSUID : secondes depuis son origine', ksuid.secondes, 107608047);
egal('KSUID : date', ksuid.iso, '2017-10-10T04:00:47.000Z');
egal('KSUID : partie aleatoire sur seize octets', ksuid.hasard.length, 32);
leve('KSUID trop court refuse', () => lireKsuid('court'));

/* Reconnaissance d ensemble : on propose, on ne choisit pas. */
memeListe('un ULID n est lu que comme un ULID',
  lireIdentifiant('01ARZ3NDEKTSV4RRFFQ69G5FAV').map(x => x.nom), ['ULID']);
verifier('un entier donne plusieurs lectures de Snowflake',
  lireIdentifiant('175928847299117063').length >= 2);
memeListe('un texte quelconque ne donne aucune lecture',
  lireIdentifiant('bonjour tout le monde'), []);

verifier('une date du futur lointain est signalee',
  /futur/.test(remarqueDate(Date.now() + 400 * 86400000)));
verifier('une date anterieure a 1970 est signalee', /1970/.test(remarqueDate(-1)));

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

/* ---------------------- Sous-protocoles WebSocket ------------------------- */
/* Une trame « 42["order",{"id":77}] » est un paquet Engine.IO de type 4
   contenant un paquet socket.io de type 2 nomme « order ». Sans decoupage,
   la vue « Flux » n affiche qu une suite de caracteres. */
const { lireEngineIo, lireStomp, lireSignalR, lireSousProtocole, resumerTrame } =
  await import('../ui/lib/sous-protocoles.js');

const trameEvenement = lireEngineIo('42["order",{"id":77}]');
egal('Engine.IO reconnait un message', trameEvenement.type, 'message');
egal('socket.io reconnait un EVENT', trameEvenement.socketIo.type, 'EVENT');
egal('socket.io lit le nom emis', trameEvenement.socketIo.evenement, 'order');
egal('socket.io lit les arguments', trameEvenement.socketIo.arguments.length, 1);
egal('socket.io espace par defaut', trameEvenement.socketIo.espace, '/');
egal('Engine.IO lit un ping', lireEngineIo('2').type, 'ping');
egal('Engine.IO lit la poignee de main',
  lireEngineIo('0{"sid":"abc","pingInterval":25000}').poignee.sid, 'abc');
egal('socket.io lit un espace de noms',
  lireEngineIo('42/admin,["ping"]').socketIo.espace, '/admin');
egal('socket.io lit un accuse de reception',
  lireEngineIo('4213["save",{}]').socketIo.ack, 13);
egal('socket.io compte les pieces jointes',
  lireEngineIo('451-["photo",{}]').socketIo.pieces, 1);
leve('Engine.IO refuse un type hors 0-6', () => lireEngineIo('9abc'));

const trameStomp = lireStomp(
  'SEND\ndestination:/queue/a\ncontent-type:application/json\n\n{"hello":"world"}\0');
egal('STOMP lit la commande', trameStomp.commande, 'SEND');
egal('STOMP lit la destination', trameStomp.entetes.destination, '/queue/a');
egal('STOMP lit un corps JSON', trameStomp.json.hello, 'world');
/* STOMP 1.2 echappe les deux-points et les sauts de ligne dans les entetes. */
egal('STOMP desechappe les entetes',
  lireStomp('MESSAGE\na\\cb:x\\ny\n\n').entetes['a:b'], 'x\ny');
/* Contrairement a HTTP, un entete repete garde sa PREMIERE valeur. */
egal('STOMP garde la premiere valeur d un entete repete',
  lireStomp('MESSAGE\nk:1\nk:2\n\n').entetes.k, '1');
leve('STOMP refuse une commande inconnue', () => lireStomp('BONJOUR\n\n'));

const trameSignalR = lireSignalR('{"type":1,"target":"Send","arguments":["hi"]}\u001e');
egal('SignalR reconnait une invocation', trameSignalR.messages[0].type, 'Invocation');
egal('SignalR lit la cible', trameSignalR.messages[0].cible, 'Send');
egal('SignalR lit la negociation',
  lireSignalR('{"protocol":"json","version":1}\u001e').messages[0].type, 'Handshake');
egal('SignalR lit plusieurs messages d une trame',
  lireSignalR('{"type":6}\u001e{"type":7}\u001e').messages.length, 2);
leve('SignalR exige son separateur', () => lireSignalR('{"type":6}'));

egal('resume d une trame socket.io',
  resumerTrame('42["order",{"id":77}]'), 'socket.io EVENT « order »');
egal('resume d une trame STOMP',
  resumerTrame('SEND\ndestination:/q\n\nx\0'), 'STOMP SEND -> /q');
egal('un texte quelconque ne recoit aucun resume',
  resumerTrame('bonjour tout le monde'), null);
/* Le sous-protocole negocie tranche : « 2 » est un ping autant qu un texte. */
egal('le sous-protocole annonce passe en tete',
  lireSousProtocole('2', 'socket.io')[0].nom, 'Engine.IO / socket.io');

/* ------------------------- Palette de commandes --------------------------- */
/* Le classement doit rester previsible : taper les memes lettres ramene
   toujours le meme premier resultat, sinon la palette devient inutilisable
   des qu on la connait par coeur. */
const { apparier, filtrer, morceaux, deplacer } = await import('../ui/lib/palette.js');

verifier('sous-sequence trouvee', !!apparier('Sites et chemins', 'chemin'));
egal('lettres absentes refusees', apparier('Comparer', 'xyz'), null);
egal('ordre des lettres impose', apparier('abc', 'cba'), null);
verifier('accents ignores dans le sujet', !!apparier('Règles', 'regles'));
verifier('accents ignores dans la requete', !!apparier('Regles', 'règles'));

const COMMANDES = [
  { id: 'a', libelle: 'Trames et messages', groupe: 'Trafic' },
  { id: 'b', libelle: 'Tri', groupe: 'Tableau' },
  { id: 'c', libelle: 'Transformer', groupe: 'Outils' }
];
egal('le libelle court passe devant', filtrer(COMMANDES, 'tri')[0].commande.id, 'b');
egal('le groupe ramene ses membres', filtrer(COMMANDES, 'outils')[0].commande.id, 'c');
egal('requete vide rend tout', filtrer(COMMANDES, '').length, 3);
egal('limite respectee', filtrer(COMMANDES, '', 2).length, 2);
egal('aucune correspondance', filtrer(COMMANDES, 'zzzz').length, 0);
egal('classement stable entre deux appels',
  filtrer(COMMANDES, 'tra')[0].commande.id, filtrer(COMMANDES, 'tra')[0].commande.id);

egal('les lettres appariees sont marquees',
  morceaux('abc', [0, 2]).filter(m => m.marque).map(m => m.texte).join(''), 'ac');
egal('aucun caractere perdu au decoupage',
  morceaux('Sites et chemins', apparier('Sites et chemins', 'chemin').positions)
    .map(m => m.texte).join(''), 'Sites et chemins');

egal('la selection boucle vers le haut', deplacer(0, -1, 3), 2);
egal('la selection boucle vers le bas', deplacer(2, 1, 3), 0);
egal('liste vide sans deplacement', deplacer(0, 1, 0), 0);

/* ------------------------------- gRPC-Web --------------------------------- */
/* gRPC ne passe pas tel quel dans un navigateur : gRPC-Web est la variante
   qu on capture. Son piege est connu — un appel peut repondre HTTP 200 et
   avoir echoue, le verdict ne vivant que dans le cadre de trailers. */
const { estGrpcWeb, estGrpcWebTexte, lireGrpcWeb, resumerGrpcWeb } =
  await import('../ui/lib/grpc-web.js');

/* Un cadre : drapeau, longueur sur quatre octets gros-boutiste, charge. */
function cadreGrpc(drapeau, charge) {
  const out = new Uint8Array(5 + charge.length);
  out[0] = drapeau;
  new DataView(out.buffer).setUint32(1, charge.length, false);
  out.set(charge, 5);
  return out;
}
function collerOctets(...morceaux) {
  const out = new Uint8Array(morceaux.reduce((n, m) => n + m.length, 0));
  let i = 0;
  for (const m of morceaux) { out.set(m, i); i += m.length; }
  return out;
}

/* protobuf : champ 1, varint, valeur 150. */
const MSG_GRPC = new Uint8Array([0x08, 0x96, 0x01]);
const TRAILERS_OK = new TextEncoder().encode('grpc-status:0\r\n');
const TRAILERS_KO = new TextEncoder().encode('grpc-status:5\r\ngrpc-message:Not%20Found\r\n');

verifier('grpc-web+proto est reconnu', estGrpcWeb('application/grpc-web+proto'));
verifier('un parametre de charset ne gene pas',
  estGrpcWeb('application/grpc-web+proto; charset=utf-8'));
verifier('la variante base64 est distinguee',
  estGrpcWebTexte('application/grpc-web-text+proto'));
verifier('la variante binaire n est pas prise pour du texte',
  !estGrpcWebTexte('application/grpc-web+proto'));
verifier('un JSON ordinaire n est pas pris pour du gRPC-Web',
  !estGrpcWeb('application/json'));

const appelReussi = lireGrpcWeb(collerOctets(cadreGrpc(0x00, MSG_GRPC), cadreGrpc(0x80, TRAILERS_OK)));
egal('deux cadres sont lus', appelReussi.cadres.length, 2);
egal('le premier cadre est un message', appelReussi.cadres[0].type, 'message');
verifier('la charge protobuf est decodee', !!appelReussi.cadres[0].protobuf);
egal('le second cadre porte les trailers', appelReussi.cadres[1].type, 'trailers');
egal('le code de statut est lu', appelReussi.statut.code, 0);
egal('le code est nomme', appelReussi.statut.nom, 'OK');
verifier('le corps est signale complet', appelReussi.complet);

/* Le piege du protocole : HTTP 200, mais l appel a echoue. */
const appelEchoue = lireGrpcWeb(collerOctets(cadreGrpc(0x00, MSG_GRPC), cadreGrpc(0x80, TRAILERS_KO)));
egal('un echec est lu malgre un corps bien forme', appelEchoue.statut.code, 5);
egal('le code d echec est nomme', appelEchoue.statut.nom, 'NOT_FOUND');
egal('l echec est signale', appelEchoue.statut.ok, false);
egal('le message est desechappe', appelEchoue.statut.message, 'Not Found');

egal('un flux de trois messages est compte',
  lireGrpcWeb(collerOctets(cadreGrpc(0x00, MSG_GRPC), cadreGrpc(0x00, MSG_GRPC),
    cadreGrpc(0x00, MSG_GRPC), cadreGrpc(0x80, TRAILERS_OK)))
    .cadres.filter(c => c.type === 'message').length, 3);

/* Un message compresse ne se lit pas sans defaire la compression : on le dit
   plutot que de rendre un decodage protobuf absurde. */
const compresse = lireGrpcWeb(cadreGrpc(0x01, MSG_GRPC));
egal('la compression est signalee', compresse.cadres[0].compresse, true);
egal('aucun protobuf n est invente sur des octets compresses',
  compresse.cadres[0].protobuf, undefined);

/* Un corps coupe par la limite de capture ne doit pas passer pour complet. */
const coupe = lireGrpcWeb(cadreGrpc(0x00, MSG_GRPC).subarray(0, 6));
egal('un corps tronque est signale', coupe.complet, false);
egal('le cadre incomplet est decrit', coupe.cadres[0].tronque, true);
const enTeteCoupe = lireGrpcWeb(new Uint8Array([0x00, 0x00, 0x00]));
egal('un en-tete coupe est signale', enTeteCoupe.complet, false);
egal('aucun cadre n est invente sur un en-tete coupe', enTeteCoupe.cadres.length, 0);

/* La variante -text transporte les memes octets en base64. */
const binaireGrpc = collerOctets(cadreGrpc(0x00, MSG_GRPC), cadreGrpc(0x80, TRAILERS_OK));
let b64Grpc = '';
for (const o of binaireGrpc) b64Grpc += String.fromCharCode(o);
egal('la variante base64 rend le meme statut',
  lireGrpcWeb(btoa(b64Grpc)).statut.code, 0);
leve('un base64 invalide est refuse', () => lireGrpcWeb('pas du base64 !!'));
/* L alphabet ne suffit pas : « a » le respecte, mais le base64 se lit par
   groupes de quatre. Sans ce controle, atob remontait une DOMException au
   lieu d un refus propre — trouve en jetant des entrees degenerees. */
leve('un base64 de longueur invalide est refuse proprement', () => lireGrpcWeb('a'));
leve('trois caracteres de base64 sont refuses', () => lireGrpcWeb('abc'));
leve('une entree qui n est ni octets ni base64 est refusee', () => lireGrpcWeb(42));

egal('un corps vide ne casse rien', lireGrpcWeb(new Uint8Array(0)).cadres.length, 0);
egal('resume d un appel reussi', resumerGrpcWeb(appelReussi), '1 message(s) · grpc-status 0 OK');
verifier('le resume d un echec cite le message',
  resumerGrpcWeb(appelEchoue).includes('Not Found'));
verifier('un flux sans trailers est signale comme tel',
  resumerGrpcWeb(lireGrpcWeb(cadreGrpc(0x00, MSG_GRPC))).includes('aucun trailer'));
/* Un code hors table est decrit comme inconnu, jamais invente. */
verifier('un code de statut hors table est signale',
  lireGrpcWeb(cadreGrpc(0x80, new TextEncoder().encode('grpc-status:99\r\n')))
    .statut.sens.includes('hors de la table'));

bilan('Outils avances');
