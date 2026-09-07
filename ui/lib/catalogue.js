/* Catalogue des transformations — INTERCEPTOR (by D4RK)
 *
 * Le registre unique de tout ce que la boite a outils sait appliquer a un
 * texte. Chaque entree porte sa cle, son groupe, son libelle, sa fonction, et
 * dit si elle decode (« Tout essayer » ne tente que celles-la) et si elle est
 * asynchrone (compression native).
 *
 * Ajouter un encodage se fait ici et nulle part ailleurs : le menu, les tests
 * et le compteur affiche s en deduisent.
 */
import {
  base64Encoder, base64Decoder, base64UrlEncoder, base64UrlDecoder,
  urlEncoder, urlDecoder, urlEncoderComplet, urlEncoderTout,
  htmlEncoder, htmlDecoder, htmlEncoderTout,
  hexEncoder, hexDecoder, hexEncoderC, htmlEncoderNomme,
  unicodeEncoder, unicodeDecoder, pointsDeCode,
  qpEncoder, qpDecoder, rot13
} from './codecs.js';
import {
  base32Encoder, base32Decoder, base32HexEncoder, base32HexDecoder,
  base58Encoder, base58Decoder, base45Encoder, base45Decoder,
  base62Encoder, base62Decoder, crockfordEncoder, crockfordDecoder,
  ascii85Encoder, ascii85Decoder,
  binaireEncoder, binaireDecoder, octalEncoder, octalDecoder,
  decimalEncoder, decimalDecoder,
  base64VersHex, hexVersBase64, base64VersBinaire, hexVersDecimal
} from './codecs-bases.js';
import {
  rot47, atbash, morseEncoder, morseDecoder, otanEncoder,
  majuscules, minuscules, casseInversee, capitaliser,
  camelCase, pascalCase, snakeCase, kebabCase, constantCase,
  normaliserNFC, normaliserNFD, normaliserNFKC, normaliserNFKD,
  sansAccents, retirerCaracteresCaches,
  inverserTexte, inverserLignes, trierLignes, trierLignesInverse, lignesUniques,
  numeroterLignes, sansLignesVides, couperEspaces, compacterEspaces, sansEspaces,
  lfVersCrlf, crlfVersLf, melangerLignes
} from './codecs-text.js';
import {
  jsonJoli, jsonCompact, jsonTrie, jsonAplati, jsonVersLignes, lignesVersJson,
  jsonVersYaml, csvVersJson, jsonVersCsv, xmlJoli, xmlVersTexte,
  echapperJs, desechapperJs, echapperJson, desechapperJson,
  echapperRegex, echapperShell, echapperPowerShell
} from './codecs-format.js';
import {
  punycodeEncoder, punycodeDecoder, domaineVersAscii, domaineVersUnicode,
  dataUriEncoder, dataUriDecoder, basicEncoder, basicDecoder,
  formVersJson, jsonVersForm, entetesVersJson, jsonVersEntetes,
  cookiesVersJson, jsonVersCookies, chunkedDecoder, compresser, decompresser
} from './codecs-web.js';
import { protobufVersJson, msgpackVersJson, cborVersJson } from './binaires.js';
import { derVersJson, certificatVersJson } from './asn1.js';
import { reparerMojibake } from './charsets.js';
import { baconChiffrer, baconDechiffrer } from './codecs-text.js';
import { decoderValeurEtendue, encoderValeurEtendue, decoderMotsCodes }
  from './entetes-parametres.js';

/* Raccourcis d ecriture : e = encodage, d = decodage, a = asynchrone. */
const e = (cle, groupe, libelle, fn) => ({ cle, groupe, libelle, fn, decode: false, asynchrone: false });
const d = (cle, groupe, libelle, fn) => ({ cle, groupe, libelle, fn, decode: true, asynchrone: false });
const a = (cle, groupe, libelle, fn, decode) => ({ cle, groupe, libelle, fn, decode: !!decode, asynchrone: true });

/** Chaque transformation affichee par la boite a outils. */
export const TRANSFORMATIONS = [
  /* -------------------------------- Base64 -------------------------------- */
  e('base64-enc', 'Base64', 'Base64 — encoder', base64Encoder),
  d('base64-dec', 'Base64', 'Base64 — decoder', base64Decoder),
  e('base64url-enc', 'Base64', 'Base64 URL — encoder', base64UrlEncoder),
  d('base64url-dec', 'Base64', 'Base64 URL — decoder', base64UrlDecoder),
  d('base64-hex', 'Base64', 'Base64 vers hexadecimal', base64VersHex),
  e('hex-base64', 'Base64', 'Hexadecimal vers base64', hexVersBase64),
  d('base64-bin', 'Base64', 'Base64 vers binaire', base64VersBinaire),

  /* ---------------------------------- URL --------------------------------- */
  e('url-enc', 'URL', 'URL — encoder (composant)', urlEncoder),
  d('url-dec', 'URL', 'URL — decoder', urlDecoder),
  e('url-enc-full', 'URL', 'URL — encoder (URL entiere)', urlEncoderComplet),
  e('url-enc-tout', 'URL', 'URL — encoder chaque octet', urlEncoderTout),

  /* --------------------------------- HTML --------------------------------- */
  e('html-enc', 'HTML', 'Entites HTML — encoder', htmlEncoder),
  d('html-dec', 'HTML', 'Entites HTML — decoder', htmlDecoder),
  e('html-enc-tout', 'HTML', 'Entites HTML — encoder tout le non-ASCII', htmlEncoderTout),
  e('html-enc-nomme', 'HTML', 'Entites HTML — encoder avec les noms', htmlEncoderNomme),

  /* ------------------------------ Hexadecimal ----------------------------- */
  e('hex-enc', 'Hexadecimal', 'Hexadecimal — encoder', hexEncoder),
  d('hex-dec', 'Hexadecimal', 'Hexadecimal — decoder', hexDecoder),
  e('hex-c', 'Hexadecimal', 'Hexadecimal — style C (0x61, 0x62)', hexEncoderC),
  d('hex-dec-valeurs', 'Hexadecimal', 'Hexadecimal vers valeurs decimales', hexVersDecimal),

  /* -------------------------------- Unicode ------------------------------- */
  e('unicode-enc', 'Unicode', 'Echappement Unicode — encoder', unicodeEncoder),
  d('unicode-dec', 'Unicode', 'Echappement Unicode — decoder', unicodeDecoder),
  e('unicode-points', 'Unicode', 'Lister les points de code', pointsDeCode),
  e('unicode-nfc', 'Unicode', 'Normaliser en NFC (composee)', normaliserNFC),
  e('unicode-nfd', 'Unicode', 'Normaliser en NFD (decomposee)', normaliserNFD),
  e('unicode-nfkc', 'Unicode', 'Normaliser en NFKC (compatibilite)', normaliserNFKC),
  e('unicode-nfkd', 'Unicode', 'Normaliser en NFKD (compatibilite decomposee)', normaliserNFKD),
  e('unicode-sans-accents', 'Unicode', 'Retirer les accents', sansAccents),
  e('unicode-sans-invisibles', 'Unicode', 'Retirer les caracteres invisibles', retirerCaracteresCaches),
  d('unicode-mojibake', 'Unicode', 'Reparer un texte mal decode (mojibake)', reparerMojibake),

  /* --------------------------- Autres alphabets --------------------------- */
  e('base32-enc', 'Autres alphabets', 'Base32 — encoder', base32Encoder),
  d('base32-dec', 'Autres alphabets', 'Base32 — decoder', base32Decoder),
  e('base32hex-enc', 'Autres alphabets', 'Base32hex — encoder', base32HexEncoder),
  d('base32hex-dec', 'Autres alphabets', 'Base32hex — decoder', base32HexDecoder),
  e('base58-enc', 'Autres alphabets', 'Base58 (Bitcoin) — encoder', base58Encoder),
  d('base58-dec', 'Autres alphabets', 'Base58 (Bitcoin) — decoder', base58Decoder),
  e('base62-enc', 'Autres alphabets', 'Base62 (identifiants courts) — encoder', base62Encoder),
  d('base62-dec', 'Autres alphabets', 'Base62 (identifiants courts) — decoder', base62Decoder),
  e('crockford-enc', 'Autres alphabets', 'Base32 Crockford (sans I L O U) — encoder', crockfordEncoder),
  d('crockford-dec', 'Autres alphabets', 'Base32 Crockford (sans I L O U) — decoder', crockfordDecoder),
  e('base45-enc', 'Autres alphabets', 'Base45 (QR, RFC 9285) — encoder', base45Encoder),
  d('base45-dec', 'Autres alphabets', 'Base45 (QR, RFC 9285) — decoder', base45Decoder),
  e('ascii85-enc', 'Autres alphabets', 'Ascii85 — encoder', ascii85Encoder),
  d('ascii85-dec', 'Autres alphabets', 'Ascii85 — decoder', ascii85Decoder),

  /* --------------------------- Binaire et octal --------------------------- */
  e('bin-enc', 'Binaire et octal', 'Binaire — encoder', binaireEncoder),
  d('bin-dec', 'Binaire et octal', 'Binaire — decoder', binaireDecoder),
  e('oct-enc', 'Binaire et octal', 'Octal — encoder', octalEncoder),
  d('oct-dec', 'Binaire et octal', 'Octal — decoder', octalDecoder),
  e('dec-enc', 'Binaire et octal', 'Valeurs decimales — encoder', decimalEncoder),
  d('dec-dec', 'Binaire et octal', 'Valeurs decimales — decoder', decimalDecoder),

  /* ---------------------------------- JSON -------------------------------- */
  d('json-joli', 'JSON', 'JSON — mettre en forme', jsonJoli),
  e('json-compact', 'JSON', 'JSON — compacter', jsonCompact),
  d('json-trie', 'JSON', 'JSON — trier les cles', jsonTrie),
  d('json-aplati', 'JSON', 'JSON — un chemin par ligne', jsonAplati),
  e('json-lignes', 'JSON', 'JSON vers JSON Lines', jsonVersLignes),
  d('lignes-json', 'JSON', 'JSON Lines vers JSON', lignesVersJson),
  d('json-yaml', 'JSON', 'JSON vers YAML', jsonVersYaml),
  e('json-csv', 'JSON', 'JSON vers CSV', jsonVersCsv),
  d('csv-json', 'JSON', 'CSV vers JSON', csvVersJson),

  /* ----------------------------- XML et balises --------------------------- */
  d('xml-joli', 'XML', 'XML ou HTML — mettre en forme', xmlJoli),
  d('xml-texte', 'XML', 'Retirer les balises, garder le texte', xmlVersTexte),

  /* ------------------------------ Web et HTTP ----------------------------- */
  d('form-json', 'Web', 'Corps de formulaire vers JSON', formVersJson),
  e('json-form', 'Web', 'JSON vers corps de formulaire', jsonVersForm),
  d('entetes-json', 'Web', 'Entetes bruts vers JSON', entetesVersJson),
  e('json-entetes', 'Web', 'JSON vers entetes bruts', jsonVersEntetes),
  d('cookies-json', 'Web', 'Cookies vers JSON', cookiesVersJson),
  e('json-cookies', 'Web', 'JSON vers cookies', jsonVersCookies),
  e('data-enc', 'Web', 'URI de donnees — encoder', dataUriEncoder),
  d('data-dec', 'Web', 'URI de donnees — decoder', dataUriDecoder),
  e('basic-enc', 'Web', 'Authentification Basic — encoder', basicEncoder),
  d('basic-dec', 'Web', 'Authentification Basic — decoder', basicDecoder),
  d('chunked-dec', 'Web', 'Transfert par morceaux — recomposer', chunkedDecoder),
  /* Parametres d en-tete : ce qui rend un `filename*` ou un `=?UTF-8?B?...?=`
     illisible tant qu on ne le decode pas. */
  d('ext-value-dec', 'Web', 'Valeur etendue RFC 8187 — decoder',
    v => decoderValeurEtendue(v).texte),
  e('ext-value-enc', 'Web', 'Valeur etendue RFC 8187 — encoder',
    v => encoderValeurEtendue(v)),
  d('mot-code-dec', 'Web', 'Mot code RFC 2047 (=?jeu?B?...?=) — decoder', decoderMotsCodes),

  /* ------------------------------- Domaines ------------------------------- */
  e('puny-enc', 'Domaines', 'Punycode — encoder', punycodeEncoder),
  d('puny-dec', 'Domaines', 'Punycode — decoder', punycodeDecoder),
  e('idn-ascii', 'Domaines', 'Nom de domaine vers ASCII (xn--)', domaineVersAscii),
  d('idn-unicode', 'Domaines', 'Nom de domaine vers Unicode', domaineVersUnicode),

  /* ------------------------------ Compression ----------------------------- */
  a('gzip-dec', 'Compression', 'gzip — decompresser (base64 ou hexadecimal)',
    t => decompresser(t, 'gzip'), true),
  a('gzip-enc', 'Compression', 'gzip — compresser (vers base64)', t => compresser(t, 'gzip')),
  a('deflate-dec', 'Compression', 'deflate — decompresser', t => decompresser(t, 'deflate'), true),
  a('deflate-enc', 'Compression', 'deflate — compresser', t => compresser(t, 'deflate')),
  a('deflate-raw-dec', 'Compression', 'deflate brut — decompresser',
    t => decompresser(t, 'deflate-raw'), true),
  a('deflate-raw-enc', 'Compression', 'deflate brut — compresser',
    t => compresser(t, 'deflate-raw')),

  /* -------------------------- Chiffres classiques ------------------------- */
  e('rot13', 'Chiffres classiques', 'ROT13', rot13),
  e('rot47', 'Chiffres classiques', 'ROT47', rot47),
  e('atbash', 'Chiffres classiques', 'Atbash', atbash),
  e('morse-enc', 'Chiffres classiques', 'Morse — encoder', morseEncoder),
  d('morse-dec', 'Chiffres classiques', 'Morse — decoder', morseDecoder),
  e('otan', 'Chiffres classiques', 'Alphabet radio (Alfa, Bravo...)', otanEncoder),
  e('bacon-enc', 'Chiffres classiques', 'Bacon — encoder', baconChiffrer),
  d('bacon-dec', 'Chiffres classiques', 'Bacon — decoder', baconDechiffrer),

  /* --------------------------------- Casse -------------------------------- */
  e('maj', 'Casse', 'Tout en majuscules', majuscules),
  e('min', 'Casse', 'Tout en minuscules', minuscules),
  e('capitale', 'Casse', 'Capitale a chaque mot', capitaliser),
  e('casse-inverse', 'Casse', 'Inverser la casse', casseInversee),
  e('camel', 'Casse', 'camelCase', camelCase),
  e('pascal', 'Casse', 'PascalCase', pascalCase),
  e('snake', 'Casse', 'snake_case', snakeCase),
  e('kebab', 'Casse', 'kebab-case', kebabCase),
  e('constante', 'Casse', 'CONSTANT_CASE', constantCase),

  /* -------------------------------- Lignes -------------------------------- */
  e('lignes-trier', 'Lignes', 'Trier les lignes', trierLignes),
  e('lignes-trier-inv', 'Lignes', 'Trier a l envers', trierLignesInverse),
  e('lignes-uniques', 'Lignes', 'Garder les lignes uniques', lignesUniques),
  e('lignes-inverser', 'Lignes', 'Inverser l ordre des lignes', inverserLignes),
  e('lignes-numeroter', 'Lignes', 'Numeroter les lignes', numeroterLignes),
  e('lignes-sans-vides', 'Lignes', 'Retirer les lignes vides', sansLignesVides),
  e('lignes-couper', 'Lignes', 'Couper les espaces de bord', couperEspaces),
  e('lignes-melanger', 'Lignes', 'Melanger les lignes', melangerLignes),
  e('texte-inverser', 'Lignes', 'Inverser les caracteres', inverserTexte),
  e('espaces-compacter', 'Lignes', 'Compacter les espaces', compacterEspaces),
  e('espaces-retirer', 'Lignes', 'Retirer tous les espaces', sansEspaces),
  e('fin-crlf', 'Lignes', 'Fins de ligne en CRLF', lfVersCrlf),
  e('fin-lf', 'Lignes', 'Fins de ligne en LF', crlfVersLf),

  /* ------------------------------ Echappements ---------------------------- */
  e('js-enc', 'Echappements', 'Chaine JavaScript — echapper', echapperJs),
  d('js-dec', 'Echappements', 'Chaine JavaScript — desechapper', desechapperJs),
  e('json-str-enc', 'Echappements', 'Chaine JSON — echapper', echapperJson),
  d('json-str-dec', 'Echappements', 'Chaine JSON — desechapper', desechapperJson),
  e('regex-enc', 'Echappements', 'Expression reguliere — echapper', echapperRegex),
  e('shell-enc', 'Echappements', 'Argument de terminal — echapper', echapperShell),
  e('ps-enc', 'Echappements', 'Argument PowerShell — echapper', echapperPowerShell),

  /* ------------------------------- Binaire -------------------------------- */
  d('protobuf-dec', 'Binaire', 'Protocol Buffers vers JSON', protobufVersJson),
  d('msgpack-dec', 'Binaire', 'MessagePack vers JSON', msgpackVersJson),
  d('cbor-dec', 'Binaire', 'CBOR vers JSON', cborVersJson),
  d('der-dec', 'Binaire', 'ASN.1 et DER vers JSON', derVersJson),
  d('cert-dec', 'Binaire', 'Certificat X.509 vers resume', certificatVersJson),

  /* --------------------------------- Divers ------------------------------- */
  e('qp-enc', 'Divers', 'Quoted-printable — encoder', qpEncoder),
  d('qp-dec', 'Divers', 'Quoted-printable — decoder', qpDecoder)
];

/** Groupes du catalogue, dans l ordre d apparition. */
export const GROUPES = [...new Set(TRANSFORMATIONS.map(t => t.groupe))];

/** Recherche d une transformation par sa cle : usage interne au registre. */
function trouverTransformation(cle) {
  return TRANSFORMATIONS.find(t => t.cle === cle) || null;
}

/**
 * Applique une transformation synchrone. Rend { ok, valeur } ou { ok:false, erreur }.
 * Une transformation asynchrone est refusee ici plutot que de rendre une promesse
 * deguisee en resultat.
 */
export function transformer(cle, entree) {
  const def = trouverTransformation(cle);
  if (!def) return { ok: false, erreur: 'transformation inconnue : ' + cle };
  if (def.asynchrone) return { ok: false, erreur: 'transformation asynchrone : employer transformerAsync' };
  try { return { ok: true, valeur: def.fn(entree) }; }
  catch (err) { return { ok: false, erreur: String((err && err.message) || err) }; }
}

/** Meme contrat, mais accepte aussi les transformations asynchrones. */
export async function transformerAsync(cle, entree) {
  const def = trouverTransformation(cle);
  if (!def) return { ok: false, erreur: 'transformation inconnue : ' + cle };
  try { return { ok: true, valeur: await def.fn(entree) }; }
  catch (err) { return { ok: false, erreur: String((err && err.message) || err) }; }
}
