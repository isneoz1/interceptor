/* Dictionnaire anglais — catalogue des transformations et onglets d outils
 * INTERCEPTOR (by D4RK)
 *
 * Suite de dict-en-tools.js, dont il complete la table (`...EN_OUTILS`).
 * Meme regle : la cle est le texte francais tel qu il apparait dans le code.
 * Une entree manquante casse la suite tests/outils.test.mjs.
 */
export const EN_OUTILS = {
  /* ------------------------- Familles du catalogue ------------------------ */
  'URL': 'URL',
  'HTML': 'HTML',
  'Hexadecimal': 'Hexadecimal',
  'Unicode': 'Unicode',
  'Autres alphabets': 'Other alphabets',
  'Binaire et octal': 'Binary and octal',
  'JSON': 'JSON',
  'XML': 'XML',
  'Web': 'Web',
  'Domaines': 'Domains',
  'Compression': 'Compression',
  'Chiffres classiques': 'Classic ciphers',
  'Casse': 'Letter case',
  'Lignes': 'Lines',
  'Echappements': 'Escaping',
  'Divers': 'Miscellaneous',

  /* --------------------- Onglets de la boite a outils --------------------- */
  'JWT': 'JWT',
  'Cles et essais': 'Keys and trials',
  'Importer une requete': 'Import a request',
  'Identifier': 'Identify',
  'Nombres': 'Numbers',
  'Adresse IP': 'IP address',
  'Reference': 'Reference',

  /* -------------------------------- Base64 -------------------------------- */
  'Base64 — encoder': 'Base64 — encode',
  'Base64 — decoder': 'Base64 — decode',
  'Base64 URL — encoder': 'Base64 URL — encode',
  'Base64 URL — decoder': 'Base64 URL — decode',
  'Base64 vers hexadecimal': 'Base64 to hexadecimal',
  'Hexadecimal vers base64': 'Hexadecimal to base64',
  'Base64 vers binaire': 'Base64 to binary',

  /* ---------------------------------- URL --------------------------------- */
  'URL — encoder (composant)': 'URL — encode (component)',
  'URL — decoder': 'URL — decode',
  'URL — encoder (URL entiere)': 'URL — encode (whole URL)',
  'URL — encoder chaque octet': 'URL — encode every byte',

  /* --------------------------------- HTML --------------------------------- */
  'Entites HTML — encoder': 'HTML entities — encode',
  'Entites HTML — decoder': 'HTML entities — decode',
  'Entites HTML — encoder tout le non-ASCII': 'HTML entities — encode all non-ASCII',

  /* ------------------------------ Hexadecimal ----------------------------- */
  'Hexadecimal — encoder': 'Hexadecimal — encode',
  'Hexadecimal — decoder': 'Hexadecimal — decode',
  'Hexadecimal — style C (0x61, 0x62)': 'Hexadecimal — C style (0x61, 0x62)',
  'Hexadecimal vers valeurs decimales': 'Hexadecimal to decimal values',

  /* -------------------------------- Unicode ------------------------------- */
  'Echappement Unicode — encoder': 'Unicode escape — encode',
  'Echappement Unicode — decoder': 'Unicode escape — decode',
  'Lister les points de code': 'List the code points',
  'Normaliser en NFC (composee)': 'Normalise to NFC (composed)',
  'Normaliser en NFD (decomposee)': 'Normalise to NFD (decomposed)',
  'Normaliser en NFKC (compatibilite)': 'Normalise to NFKC (compatibility)',
  'Normaliser en NFKD (compatibilite decomposee)': 'Normalise to NFKD (compatibility decomposed)',
  'Retirer les accents': 'Strip accents',
  'Retirer les caracteres invisibles': 'Strip invisible characters',

  /* --------------------------- Autres alphabets --------------------------- */
  'Base32 — encoder': 'Base32 — encode',
  'Base32 — decoder': 'Base32 — decode',
  'Base32hex — encoder': 'Base32hex — encode',
  'Base32hex — decoder': 'Base32hex — decode',
  'Base58 (Bitcoin) — encoder': 'Base58 (Bitcoin) — encode',
  'Base58 (Bitcoin) — decoder': 'Base58 (Bitcoin) — decode',
  'Base45 (QR, RFC 9285) — encoder': 'Base45 (QR, RFC 9285) — encode',
  'Base45 (QR, RFC 9285) — decoder': 'Base45 (QR, RFC 9285) — decode',
  'Ascii85 — encoder': 'Ascii85 — encode',
  'Ascii85 — decoder': 'Ascii85 — decode',

  /* --------------------------- Binaire et octal --------------------------- */
  'Binaire — encoder': 'Binary — encode',
  'Binaire — decoder': 'Binary — decode',
  'Octal — encoder': 'Octal — encode',
  'Octal — decoder': 'Octal — decode',
  'Valeurs decimales — encoder': 'Decimal values — encode',
  'Valeurs decimales — decoder': 'Decimal values — decode',

  /* ---------------------------------- JSON -------------------------------- */
  'JSON — mettre en forme': 'JSON — pretty print',
  'JSON — compacter': 'JSON — minify',
  'JSON — trier les cles': 'JSON — sort the keys',
  'JSON — un chemin par ligne': 'JSON — one path per line',
  'JSON vers JSON Lines': 'JSON to JSON Lines',
  'JSON Lines vers JSON': 'JSON Lines to JSON',
  'JSON vers YAML': 'JSON to YAML',
  'JSON vers CSV': 'JSON to CSV',
  'CSV vers JSON': 'CSV to JSON',

  /* ----------------------------- XML et balises --------------------------- */
  'XML ou HTML — mettre en forme': 'XML or HTML — pretty print',
  'Retirer les balises, garder le texte': 'Strip the tags, keep the text',

  /* ------------------------------ Web et HTTP ----------------------------- */
  'Corps de formulaire vers JSON': 'Form body to JSON',
  'JSON vers corps de formulaire': 'JSON to form body',
  'Entetes bruts vers JSON': 'Raw headers to JSON',
  'JSON vers entetes bruts': 'JSON to raw headers',
  'Cookies vers JSON': 'Cookies to JSON',
  'JSON vers cookies': 'JSON to cookies',
  'URI de donnees — encoder': 'Data URI — encode',
  'URI de donnees — decoder': 'Data URI — decode',
  'Authentification Basic — encoder': 'Basic authentication — encode',
  'Authentification Basic — decoder': 'Basic authentication — decode',
  'Transfert par morceaux — recomposer': 'Chunked transfer — reassemble',

  /* ------------------------------- Domaines ------------------------------- */
  'Punycode — encoder': 'Punycode — encode',
  'Punycode — decoder': 'Punycode — decode',
  'Nom de domaine vers ASCII (xn--)': 'Domain name to ASCII (xn--)',
  'Nom de domaine vers Unicode': 'Domain name to Unicode',

  /* ------------------------------ Compression ----------------------------- */
  'gzip — decompresser (base64 ou hexadecimal)': 'gzip — decompress (base64 or hexadecimal)',
  'gzip — compresser (vers base64)': 'gzip — compress (to base64)',
  'deflate — decompresser': 'deflate — decompress',
  'deflate — compresser': 'deflate — compress',
  'deflate brut — decompresser': 'raw deflate — decompress',
  'deflate brut — compresser': 'raw deflate — compress',

  /* -------------------------- Chiffres classiques ------------------------- */
  'ROT13': 'ROT13',
  'ROT47': 'ROT47',
  'Atbash': 'Atbash',
  'Morse — encoder': 'Morse — encode',
  'Morse — decoder': 'Morse — decode',
  'Alphabet radio (Alfa, Bravo...)': 'Radio alphabet (Alfa, Bravo...)',

  /* --------------------------------- Casse -------------------------------- */
  'Tout en majuscules': 'All uppercase',
  'Tout en minuscules': 'All lowercase',
  'Capitale a chaque mot': 'Capitalise each word',
  'Inverser la casse': 'Swap the case',
  'camelCase': 'camelCase',
  'PascalCase': 'PascalCase',
  'snake_case': 'snake_case',
  'kebab-case': 'kebab-case',
  'CONSTANT_CASE': 'CONSTANT_CASE',

  /* -------------------------------- Lignes -------------------------------- */
  'Trier les lignes': 'Sort the lines',
  'Trier a l envers': 'Sort in reverse',
  'Garder les lignes uniques': 'Keep unique lines',
  'Inverser l ordre des lignes': 'Reverse the line order',
  'Numeroter les lignes': 'Number the lines',
  'Retirer les lignes vides': 'Remove empty lines',
  'Couper les espaces de bord': 'Trim edge whitespace',
  'Melanger les lignes': 'Shuffle the lines',
  'Inverser les caracteres': 'Reverse the characters',
  'Compacter les espaces': 'Collapse whitespace',
  'Retirer tous les espaces': 'Remove all whitespace',
  'Fins de ligne en CRLF': 'Line endings to CRLF',
  'Fins de ligne en LF': 'Line endings to LF',

  /* ------------------------------ Echappements ---------------------------- */
  'Chaine JavaScript — echapper': 'JavaScript string — escape',
  'Chaine JavaScript — desechapper': 'JavaScript string — unescape',
  'Chaine JSON — echapper': 'JSON string — escape',
  'Chaine JSON — desechapper': 'JSON string — unescape',
  'Expression reguliere — echapper': 'Regular expression — escape',
  'Argument de terminal — echapper': 'Shell argument — escape',
  'Argument PowerShell — echapper': 'PowerShell argument — escape',

  /* ------------------------------- Binaire -------------------------------- */
  'Binaire': 'Binary',
  'Protocol Buffers vers JSON': 'Protocol Buffers to JSON',
  'MessagePack vers JSON': 'MessagePack to JSON',
  'CBOR vers JSON': 'CBOR to JSON',
  'ASN.1 et DER vers JSON': 'ASN.1 and DER to JSON',
  'Certificat X.509 vers resume': 'X.509 certificate to summary',

  /* ------------------------ Transformations ajoutees ---------------------- */
  'Entites HTML — encoder avec les noms': 'HTML entities — encode with names',
  'Reparer un texte mal decode (mojibake)': 'Repair a badly decoded text (mojibake)',
  'Bacon — encoder': 'Bacon — encode',
  'Bacon — decoder': 'Bacon — decode',

  /* --------------------------------- Divers ------------------------------- */
  'Quoted-printable — encoder': 'Quoted-printable — encode',
  'Quoted-printable — decoder': 'Quoted-printable — decode'
};
