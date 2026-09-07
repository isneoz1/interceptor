/* Tests de la boite a outils — INTERCEPTOR (cree par D4RK)
 *
 * Chaque valeur attendue vient d une source publiee : vecteurs de RFC,
 * valeurs de controle normalisees, ou resultat verifiable a la main. Aucun
 * test ne se contente d appeler la fonction pour voir si elle ne casse pas.
 */
import { egal, memeListe, verifier, leve, bilan } from './harnais.mjs';

import {
  base32Encoder, base32Decoder, base58Encoder, base58Decoder,
  base64VersHex, hexVersBase64, binaireEncoder, octalEncoder, convertirNombre
} from '../ui/lib/codecs-bases.js';
import {
  rot13, rot47, atbash, cesar, vigenere, xorTexte, morseEncoder, morseDecoder,
  snakeCase, kebabCase, camelCase, pascalCase, constantCase,
  sansAccents, normaliserNFC, normaliserNFD, inverserTexte, lignesUniques, frequences
} from '../ui/lib/codecs-text.js';
import {
  domaineVersAscii, domaineVersUnicode, basicEncoder, basicDecoder,
  formVersJson, jsonVersForm, cookiesVersJson, chunkedDecoder
} from '../ui/lib/codecs-web.js';
import { md5, crc32, adler32, fnv1a32, empreinteHex, hmacHex, reconnaitreEmpreinte } from '../ui/lib/hashes.js';
import { secretVersOctets, hotp, totp, fenetreTotp, lireOtpauth } from '../ui/lib/otp.js';
import {
  analyserUrl, analyserPrefixe, estIpv4, estIpv6, ipv4VersEntier, entierVersIpv4,
  etendreIpv6, compacterIpv6, ipDansCidrV4, categorieIpv4
} from '../ui/lib/net.js';
import { octetsVersHex, hexVersOctets, texteVersOctets, octetsVersTexte } from '../ui/lib/bytes.js';
import { comparerTextes, similariteTextes, distanceLevenshtein } from '../ui/lib/diff.js';
import { parseQuery, matchTerms } from '../ui/lib/filters.js';
import { decrireStatut, familleStatut } from '../ui/lib/ref-http.js';
import { decrirePort } from '../ui/lib/ref-ports.js';
import { transformer } from '../ui/lib/catalogue.js';

/* ------------------------------- Bases ------------------------------------ */
/* RFC 4648 : les vecteurs de la section 10 pour base32. */
egal('base32 de « Bonjour »', base32Encoder('Bonjour'), 'IJXW42TPOVZA====');
egal('base32 aller-retour', base32Decoder(base32Encoder('INTERCEPTOR')), 'INTERCEPTOR');
egal('base58 aller-retour', base58Decoder(base58Encoder('D4RK')), 'D4RK');
egal('base64 vers hexadecimal', base64VersHex('aGVsbG8='), '68 65 6c 6c 6f');
egal('hexadecimal vers base64', hexVersBase64('68656c6c6f'), 'aGVsbG8=');
egal('binaire de « A »', binaireEncoder('A'), '01000001');
egal('octal de « A »', octalEncoder('A'), '101');
egal('ff lu en base 16', convertirNombre('ff', 16), 255n);
egal('11111111 lu en base 2', convertirNombre('11111111', 2), 255n);

/* ------------------------------- Textes ----------------------------------- */
egal('ROT13', rot13('Bonjour'), 'Obawbhe');
egal('ROT13 est son propre inverse', rot13(rot13('Bonjour')), 'Bonjour');
egal('ROT47 est son propre inverse', rot47(rot47('D4RK!')), 'D4RK!');
egal('Atbash est son propre inverse', atbash(atbash('secret')), 'secret');
egal('Cesar de 3', cesar('abc', 3), 'def');
egal('Vigenere aller-retour', vigenere(vigenere('attaque', 'cle'), 'cle', true), 'attaque');
egal('XOR est son propre inverse', xorTexte(xorTexte('message', 'cle'), 'cle'), 'message');
egal('Morse de SOS', morseEncoder('SOS'), '... --- ...');
egal('Morse aller-retour', morseDecoder(morseEncoder('SOS')).toUpperCase(), 'SOS');
egal('snake_case', snakeCase('monBeauChamp'), 'mon_beau_champ');
egal('kebab-case', kebabCase('monBeauChamp'), 'mon-beau-champ');
egal('camelCase', camelCase('mon_beau_champ'), 'monBeauChamp');
egal('PascalCase', pascalCase('mon beau champ'), 'MonBeauChamp');
egal('CONSTANT_CASE', constantCase('monBeauChamp'), 'MON_BEAU_CHAMP');
egal('accents retires', sansAccents('éàü'), 'eau');
egal('NFC recompose ce que NFD a decompose', normaliserNFC(normaliserNFD('é')), 'é');
egal('texte inverse', inverserTexte('abc'), 'cba');
egal('lignes uniques', lignesUniques('a\nb\na'), 'a\nb');
const freq = frequences('aaab');
egal('caractere le plus frequent', freq[0].caractere, 'a');
egal('compte du caractere le plus frequent', freq[0].nombre, 3);
egal('part en pourcentage', freq[0].part, 75);

/* --------------------------------- Web ------------------------------------ */
egal('domaine vers punycode', domaineVersAscii('exemplé.fr'), 'xn--exempl-gva.fr');
egal('punycode vers domaine', domaineVersUnicode('xn--exempl-gva.fr'), 'exemplé.fr');
egal('Authorization Basic', basicEncoder('user:pass'), 'Basic dXNlcjpwYXNz');
verifier('Basic relu expose identifiant et mot de passe',
  /user/.test(basicDecoder('Basic dXNlcjpwYXNz')) && /pass/.test(basicDecoder('Basic dXNlcjpwYXNz')));
egal('formulaire vers JSON', JSON.parse(formVersJson('a=1&b=2')).b, '2');
egal('JSON vers formulaire', jsonVersForm('{"a":"1","b":"2"}'), 'a=1&b=2');
verifier('cookies vers JSON', JSON.parse(cookiesVersJson('a=1; b=2')).a === '1');
/* RFC 9112 section 7.1 : deux morceaux puis la taille zero. */
egal('corps chunked reassemble', chunkedDecoder('4\r\nWiki\r\n5\r\npedia\r\n0\r\n\r\n'), 'Wikipedia');

/* ------------------------------ Empreintes -------------------------------- */
/* RFC 1321 : MD5("abc"). Valeur de controle CRC-32 de « 123456789 ». */
egal('MD5 de abc', md5('abc'), '900150983cd24fb0d6963f7d28e17f72');
egal('CRC-32 valeur de controle', crc32('123456789'), 'cbf43926');
egal('Adler-32 de abc', adler32('abc'), '024d0127');
egal('FNV-1a 32 bits de abc', fnv1a32('abc'), '1a47e90b');
egal('SHA-256 de abc', await empreinteHex('SHA-256', 'abc'),
  'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
egal('SHA-1 de abc', await empreinteHex('SHA-1', 'abc'), 'a9993e364706816aba3e25717850c26c9cd0d89d');
/* RFC 4231 cas de test 1 : cle de vingt octets 0x0b, message « Hi There ». */
egal('HMAC-SHA-256 (RFC 4231 cas 1)',
  await hmacHex('SHA-256', 'x'.repeat(0) + '\x0b'.repeat(20), 'Hi There'),
  'b0344c61d8db38535ca8afceaf0bf12b881dc200c9833da726e9376c2e32cff7');
verifier('empreinte de 32 caracteres reconnue comme MD5',
  reconnaitreEmpreinte('900150983cd24fb0d6963f7d28e17f72').candidats.includes('MD5'));

/* ------------------------------- Codes OTP -------------------------------- */
/* RFC 4226 annexe D et RFC 6238 annexe B : secret « 12345678901234567890 ». */
const secret = secretVersOctets('GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ', 'base32');
egal('HOTP compteur 0 (RFC 4226)', await hotp(secret, 0), '755224');
egal('HOTP compteur 1 (RFC 4226)', await hotp(secret, 1), '287082');
egal('HOTP compteur 9 (RFC 4226)', await hotp(secret, 9), '520489');
egal('TOTP a T=59 (RFC 6238)', (await totp(secret, { secondes: 59, chiffres: 8 })).code, '94287082');
egal('TOTP a T=1111111109 (RFC 6238)',
  (await totp(secret, { secondes: 1111111109, chiffres: 8 })).code, '07081804');
egal('fenetre TOTP de 30 s', fenetreTotp(59, 30), 1);
egal('lien otpauth relu', lireOtpauth('otpauth://totp/Site:moi?secret=JBSWY3DPEHPK3PXP&digits=6').secret,
  'JBSWY3DPEHPK3PXP');

/* --------------------------------- Reseau --------------------------------- */
const bloc = analyserPrefixe('192.168.1.130/26');
egal('masque du /26', bloc.masque, '255.255.255.192');
egal('adresse de reseau', bloc.reseau, '192.168.1.128');
egal('adresse de diffusion', bloc.diffusion, '192.168.1.191');
egal('premiere adresse utilisable', bloc.premiere, '192.168.1.129');
egal('derniere adresse utilisable', bloc.derniere, '192.168.1.190');
egal('adresses utilisables dans un /26', bloc.utilisables, 62);
egal('categorie RFC 1918', bloc.categorie, 'privee (RFC 1918)');
egal('adresse vers entier', ipv4VersEntier('192.168.1.130'), 3232235906);
egal('entier vers adresse', entierVersIpv4(3232235906), '192.168.1.130');
egal('IPv6 etendue', etendreIpv6('2001:db8::1'), '2001:0db8:0000:0000:0000:0000:0000:0001');
egal('IPv6 compactee', compacterIpv6('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
verifier('192.168.1.130 est dans 192.168.0.0/16', ipDansCidrV4('192.168.1.130', '192.168.0.0/16'));
verifier('8.8.8.8 n est pas dans 192.168.0.0/16', !ipDansCidrV4('8.8.8.8', '192.168.0.0/16'));
verifier('detection IPv4', estIpv4('203.0.113.42') && !estIpv4('2001:db8::1'));
verifier('detection IPv6', estIpv6('2001:db8::1') && !estIpv6('203.0.113.42'));
egal('127.0.0.1 est une boucle locale', categorieIpv4('127.0.0.1'), 'boucle locale (RFC 1122)');

const u = analyserUrl('https://a.exemple.fr:8443/dossier/page.html?q=1&r=2#ancre');
egal('hote de l URL', u.hote, 'a.exemple.fr');
egal('port effectif', u.portEffectif, 8443);
egal('chemin', u.chemin, '/dossier/page.html');
egal('extension', u.extension, 'html');
egal('fragment', u.fragment, 'ancre');
egal('nombre de parametres', u.parametres.length, 2);
leve('URL invalide refusee', () => analyserUrl('pas une url'));

/* --------------------------------- Octets --------------------------------- */
egal('octets vers hexadecimal', octetsVersHex(new Uint8Array([1, 255, 16])), '01ff10');
memeListe('hexadecimal vers octets', Array.from(hexVersOctets('01ff10')), [1, 255, 16]);
egal('texte vers octets et retour', octetsVersTexte(texteVersOctets('éàü')), 'éàü');

/* ------------------------------ Comparaison ------------------------------- */
egal('distance de Levenshtein', distanceLevenshtein('chat', 'chats'), 1);
const proximite = similariteTextes('bonjour', 'bonsoir');
egal('distance entre bonjour et bonsoir', proximite.distance, 2);
verifier('similarite superieure a 70 %', proximite.pourcentage > 70);
const compare = comparerTextes('a\nb', 'a\nc');
egal('une ligne ajoutee', compare.ajouts, 1);
egal('une ligne retiree', compare.retraits, 1);
egal('une ligne inchangee', compare.egales, 1);
verifier('textes differents signales', compare.identiques === false);

/* -------------------------------- Filtres --------------------------------- */
const termes = parseQuery('method:POST status:5xx -image');
egal('trois termes lus', termes.length, 3);
egal('premier terme sur le champ method', termes[0].field, 'method');
verifier('terme negatif reconnu', termes[2].negate === true);
verifier('une requete POST 500 correspond',
  matchTerms({ method: 'POST', statusCode: 500, url: 'https://x.fr/a', type: 'xmlhttprequest' },
    parseQuery('method:POST status:5xx')));
verifier('une requete GET 200 ne correspond pas',
  !matchTerms({ method: 'GET', statusCode: 200, url: 'https://x.fr/a', type: 'xmlhttprequest' },
    parseQuery('method:POST')));

/* ------------------------------- Reference -------------------------------- */
egal('statut 404 nomme', decrireStatut(404).nom, 'Not Found');
egal('famille du 503', familleStatut(503), 'erreur du serveur');
egal('port 443 connu', decrirePort(443).service, 'HTTPS');

/* ------------------------------- Catalogue -------------------------------- */
/* Le catalogue est ce que l onglet « Transformer » expose : s il se desaccorde
   des fonctions, l interface propose une transformation qui echoue. */
egal('transformation base64 par le catalogue', transformer('base64-enc', 'D4RK').valeur, 'RDRSSw==');
egal('transformation inverse par le catalogue', transformer('base64-dec', 'RDRSSw==').valeur, 'D4RK');

bilan('Boite a outils');
