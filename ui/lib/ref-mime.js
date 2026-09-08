/* Types de media et signatures de fichier — INTERCEPTOR (by NeoZ)
 *
 * Deux tables complementaires : ce qu un serveur declare (Content-Type) et ce
 * que les premiers octets d un corps revelent reellement. L ecart entre les
 * deux est un signal a lui seul.
 */
import { texteVersOctets } from './bytes.js';

/* ------------------------------ Types de media ---------------------------- */
const M = [
  ['text/html', 'html, htm', 'Page web.'],
  ['text/plain', 'txt, log', 'Texte brut.'],
  ['text/css', 'css', 'Feuille de style.'],
  ['text/javascript', 'js, mjs', 'Script. Le type normalise depuis 2022.'],
  ['text/csv', 'csv', 'Tableau separe par des virgules.'],
  ['text/markdown', 'md', 'Texte balise Markdown.'],
  ['text/xml', 'xml', 'XML destine a la lecture humaine.'],
  ['text/event-stream', '', 'Flux d evenements serveur (SSE) : la connexion reste ouverte.'],
  ['text/vtt', 'vtt', 'Sous-titres WebVTT.'],
  ['application/json', 'json', 'Donnees JSON.'],
  ['application/ld+json', 'jsonld', 'JSON lie, donnees structurees pour les moteurs.'],
  ['application/problem+json', '', 'Erreur d API normalisee (RFC 9457).'],
  ['application/x-ndjson', 'ndjson', 'Un objet JSON par ligne.'],
  ['application/xml', 'xml', 'XML destine aux machines.'],
  ['application/soap+xml', '', 'Enveloppe SOAP.'],
  ['application/xhtml+xml', 'xhtml', 'HTML servi comme du XML.'],
  ['application/rss+xml', 'rss', 'Flux RSS.'],
  ['application/atom+xml', 'atom', 'Flux Atom.'],
  ['application/javascript', 'js', 'Script. Forme ancienne, encore repandue.'],
  ['application/wasm', 'wasm', 'Module WebAssembly.'],
  ['application/pdf', 'pdf', 'Document PDF.'],
  ['application/zip', 'zip', 'Archive ZIP.'],
  ['application/gzip', 'gz', 'Archive gzip.'],
  ['application/x-7z-compressed', '7z', 'Archive 7-Zip.'],
  ['application/x-tar', 'tar', 'Archive tar.'],
  ['application/x-rar-compressed', 'rar', 'Archive RAR.'],
  ['application/octet-stream', 'bin', 'Octets sans type declare : telechargement generique.'],
  ['application/x-www-form-urlencoded', '', 'Formulaire encode dans le corps.'],
  ['multipart/form-data', '', 'Formulaire avec fichiers, decoupe par une frontiere.'],
  ['multipart/byteranges', '', 'Plusieurs portions dans une meme reponse.'],
  ['application/grpc', '', 'Appel gRPC sur HTTP/2.'],
  ['application/vnd.api+json', '', 'Convention JSON:API.'],
  ['application/graphql-response+json', '', 'Reponse GraphQL.'],
  ['application/manifest+json', 'webmanifest', 'Manifeste d application web.'],
  ['application/vnd.ms-excel', 'xls', 'Classeur Excel ancien format.'],
  ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'xlsx', 'Classeur Excel.'],
  ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx', 'Document Word.'],
  ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'pptx', 'Presentation PowerPoint.'],
  ['image/png', 'png', 'Image sans perte.'],
  ['image/jpeg', 'jpg, jpeg', 'Photo compressee.'],
  ['image/gif', 'gif', 'Image animee historique.'],
  ['image/webp', 'webp', 'Image web moderne.'],
  ['image/avif', 'avif', 'Image AV1, tres compacte.'],
  ['image/svg+xml', 'svg', 'Image vectorielle. Peut contenir du script.'],
  ['image/x-icon', 'ico', 'Icone de site.'],
  ['image/bmp', 'bmp', 'Image bitmap Windows.'],
  ['image/tiff', 'tif, tiff', 'Image TIFF.'],
  ['image/heic', 'heic', 'Photo HEIF, format Apple.'],
  ['audio/mpeg', 'mp3', 'Audio MP3.'],
  ['audio/ogg', 'ogg, oga', 'Audio Ogg.'],
  ['audio/wav', 'wav', 'Audio non compresse.'],
  ['audio/webm', 'weba', 'Audio WebM.'],
  ['audio/aac', 'aac', 'Audio AAC.'],
  ['audio/flac', 'flac', 'Audio sans perte.'],
  ['video/mp4', 'mp4', 'Video MP4.'],
  ['video/webm', 'webm', 'Video WebM.'],
  ['video/ogg', 'ogv', 'Video Ogg.'],
  ['video/mp2t', 'ts', 'Segment de flux MPEG-TS, employe par HLS.'],
  ['application/vnd.apple.mpegurl', 'm3u8', 'Liste de lecture HLS.'],
  ['application/dash+xml', 'mpd', 'Manifeste DASH.'],
  ['font/woff', 'woff', 'Police web compressee.'],
  ['font/woff2', 'woff2', 'Police web, compression Brotli.'],
  ['font/ttf', 'ttf', 'Police TrueType.'],
  ['font/otf', 'otf', 'Police OpenType.'],
  ['application/wasm-map', '', 'Carte de source WebAssembly.'],
  ['application/x-protobuf', '', 'Message Protocol Buffers.'],
  ['application/cbor', '', 'Objet CBOR, JSON binaire.'],
  ['application/msgpack', '', 'Objet MessagePack.'],
  ['application/pkcs7-mime', 'p7m', 'Message chiffre ou signe PKCS#7.'],
  ['application/x-pem-file', 'pem', 'Certificat ou cle au format PEM.']
];

export const TYPES_MEDIA = M.map(([type, extensions, description]) => ({ type, extensions, description }));

const INDEX_MIME = new Map(TYPES_MEDIA.map(t => [t.type, t]));

/** Description d un Content-Type, parametres ignores. */
export function decrireType(valeur) {
  const type = String(valeur || '').split(';')[0].trim().toLowerCase();
  return INDEX_MIME.get(type) || null;
}

export function chercherTypes(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return TYPES_MEDIA;
  return TYPES_MEDIA.filter(t =>
    t.type.includes(q) || t.extensions.includes(q) || t.description.toLowerCase().includes(q));
}

/* --------------------------- Signatures de fichier ------------------------ */
/* Les premiers octets d un fichier, tels que les specifications les fixent.
   « decalage » dit ou commencer a comparer. */
const SIGNATURES = [
  ['89 50 4E 47 0D 0A 1A 0A', 0, 'PNG', 'image/png'],
  ['FF D8 FF', 0, 'JPEG', 'image/jpeg'],
  ['47 49 46 38 37 61', 0, 'GIF 87a', 'image/gif'],
  ['47 49 46 38 39 61', 0, 'GIF 89a', 'image/gif'],
  ['42 4D', 0, 'BMP', 'image/bmp'],
  ['49 49 2A 00', 0, 'TIFF petit-boutiste', 'image/tiff'],
  ['4D 4D 00 2A', 0, 'TIFF grand-boutiste', 'image/tiff'],
  ['00 00 01 00', 0, 'Icone Windows', 'image/x-icon'],
  ['25 50 44 46 2D', 0, 'PDF', 'application/pdf'],
  ['50 4B 03 04', 0, 'ZIP (ou docx, xlsx, epub, jar)', 'application/zip'],
  ['50 4B 05 06', 0, 'ZIP vide', 'application/zip'],
  ['1F 8B', 0, 'gzip', 'application/gzip'],
  ['42 5A 68', 0, 'bzip2', 'application/x-bzip2'],
  ['37 7A BC AF 27 1C', 0, '7-Zip', 'application/x-7z-compressed'],
  ['52 61 72 21 1A 07', 0, 'RAR', 'application/x-rar-compressed'],
  ['FD 37 7A 58 5A 00', 0, 'XZ', 'application/x-xz'],
  ['28 B5 2F FD', 0, 'Zstandard', 'application/zstd'],
  ['04 22 4D 18', 0, 'LZ4', 'application/x-lz4'],
  ['75 73 74 61 72', 257, 'tar', 'application/x-tar'],
  ['7F 45 4C 46', 0, 'Executable ELF', 'application/x-elf'],
  ['4D 5A', 0, 'Executable Windows', 'application/vnd.microsoft.portable-executable'],
  ['CA FE BA BE', 0, 'Classe Java', 'application/java-vm'],
  ['00 61 73 6D', 0, 'WebAssembly', 'application/wasm'],
  ['53 51 4C 69 74 65 20 66 6F 72 6D 61 74 20 33 00', 0, 'Base SQLite', 'application/vnd.sqlite3'],
  ['4F 67 67 53', 0, 'Ogg', 'application/ogg'],
  ['49 44 33', 0, 'MP3 avec etiquette ID3', 'audio/mpeg'],
  ['66 4C 61 43', 0, 'FLAC', 'audio/flac'],
  ['52 49 46 46', 0, 'Conteneur RIFF (WAV, AVI ou WebP)', 'application/octet-stream'],
  ['66 74 79 70', 4, 'Conteneur ISO-BMFF (MP4, HEIC, AVIF)', 'video/mp4'],
  ['1A 45 DF A3', 0, 'Matroska ou WebM', 'video/webm'],
  ['77 4F 46 46', 0, 'Police WOFF', 'font/woff'],
  ['77 4F 46 32', 0, 'Police WOFF2', 'font/woff2'],
  ['00 01 00 00 00', 0, 'Police TrueType', 'font/ttf'],
  ['4F 54 54 4F', 0, 'Police OpenType', 'font/otf'],
  ['38 42 50 53', 0, 'Document Photoshop', 'image/vnd.adobe.photoshop'],
  ['EF BB BF', 0, 'Texte UTF-8 avec marque d ordre', 'text/plain'],
  ['FF FE', 0, 'Texte UTF-16 petit-boutiste', 'text/plain'],
  ['FE FF', 0, 'Texte UTF-16 grand-boutiste', 'text/plain']
].map(([hex, decalage, nom, type]) => ({
  octets: hex.split(' ').map(h => parseInt(h, 16)), decalage, nom, type
}));

/**
 * Reconnait un contenu a ses premiers octets. Rend toutes les correspondances,
 * de la plus longue a la plus courte : une signature courte peut se confondre.
 */
export function reconnaitreSignature(octets) {
  const trouves = [];
  for (const s of SIGNATURES) {
    const fin = s.decalage + s.octets.length;
    if (octets.length < fin) continue;
    let identique = true;
    for (let i = 0; i < s.octets.length; i++) {
      if (octets[s.decalage + i] !== s.octets[i]) { identique = false; break; }
    }
    if (identique) trouves.push(s);
  }
  return trouves.sort((a, b) => b.octets.length - a.octets.length);
}

/** Reconnait a partir d un texte : hexadecimal, ou contenu deja decode. */
export function reconnaitreContenu(octets) {
  const signatures = reconnaitreSignature(octets);
  if (signatures.length) return signatures;
  const debut = new TextDecoder().decode(octets.subarray(0, 512)).trim();
  const TEXTUELS = [
    [/^<\?xml/i, 'XML', 'application/xml'],
    [/^<!doctype html/i, 'HTML', 'text/html'],
    [/^<html/i, 'HTML', 'text/html'],
    [/^<svg/i, 'SVG', 'image/svg+xml'],
    [/^[{[]/, 'JSON probable', 'application/json'],
    [/^-----BEGIN /, 'Bloc PEM', 'application/x-pem-file'],
    [/^#!\s*\/\w/, 'Script avec ligne d appel', 'text/plain'],
    [/^GIF|^%!PS/, 'PostScript', 'application/postscript']
  ];
  for (const [motif, nom, type] of TEXTUELS) {
    if (motif.test(debut)) return [{ octets: [], decalage: 0, nom, type }];
  }
  return [];
}

/** Confort : reconnait directement depuis un texte de travail. */
export function reconnaitreTexte(texte) {
  return reconnaitreContenu(texteVersOctets(texte));
}
