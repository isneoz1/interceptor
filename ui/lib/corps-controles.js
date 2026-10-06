/* Controles d un corps — SWIFT (by NeoZ)
 *
 *   Le type annonce correspond-il au contenu ? Un « JSON » qui commence par
 *   <!DOCTYPE html> est une page d erreur que le client ne saura pas lire ;
 *   une image annoncee PNG dont les octets sont ceux d un JPEG s affiche par
 *   chance. On le constate sur le contenu, jamais sur une supposition.
 *
 *   Un texte servi sans compression : ce que gzip en aurait fait, MESURE en
 *   compressant les octets captures (CompressionStream du navigateur), pas
 *   estime par une regle. La mesure n est faite que si le texte capture
 *   redonne exactement les octets recus : sinon le chiffre serait faux.
 *
 * Signatures de format : PNG (89 50 4E 47 0D 0A 1A 0A), JPEG (FF D8 FF),
 * GIF (« GIF87a », « GIF89a »), WebP (« RIFF » .... « WEBP »), AVIF (boite
 * « ftyp » de marque avif ou avis), ICO (00 00 01 00), BMP (« BM »).
 */

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const FAITS_CORPS = {
  pasDuJson: 'annonce {type}, mais le corps n est pas du JSON : {nature} — il commence par « {debut} »',
  jsonEnHtml: 'annonce {type}, mais le corps est du JSON valide',
  imageAutre: 'annonce {type}, mais les octets sont ceux d une image {format}',
  compression: 'servi sans compression : {avant} ; en gzip, {apres} — {gain} % de moins, mesure sur les octets recus',
  natureHtml: 'une page HTML',
  natureXml: 'du XML',
  natureVide: 'un corps vide',
  natureTexte: 'du texte'
};

/* Une compression ne vaut d etre mesuree qu au-dela de quelques centaines
   d octets : en dessous, l en-tete gzip coute plus qu il ne rapporte. */
const SEUIL_COMPRESSION = 1024;

const typeDeBase = t => String(t || '').toLowerCase().split(';')[0].trim();
const estJson = t => t === 'application/json' || /\+json$/.test(t);

function octetsDe64(b64, n) {
  try {
    const binaire = atob(String(b64).slice(0, Math.ceil(n / 3) * 4 + 4));
    const o = new Uint8Array(Math.min(n, binaire.length));
    for (let i = 0; i < o.length; i++) o[i] = binaire.charCodeAt(i);
    return o;
  } catch { return null; }
}

const ascii = (o, debut, texte) => [...texte].every((c, i) => o[debut + i] === c.charCodeAt(0));

/** Le format d image que disent les premiers octets, ou null. */
export function formatImage(o) {
  if (!o || o.length < 4) return null;
  if (o.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((b, i) => o[i] === b)) return 'png';
  if (o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) return 'jpeg';
  if (o.length >= 6 && (ascii(o, 0, 'GIF87a') || ascii(o, 0, 'GIF89a'))) return 'gif';
  if (o.length >= 12 && ascii(o, 0, 'RIFF') && ascii(o, 8, 'WEBP')) return 'webp';
  if (o.length >= 12 && ascii(o, 4, 'ftyp') && (ascii(o, 8, 'avif') || ascii(o, 8, 'avis'))) return 'avif';
  if (o[0] === 0x00 && o[1] === 0x00 && o[2] === 0x01 && o[3] === 0x00) return 'x-icon';
  if (ascii(o, 0, 'BM')) return 'bmp';
  return null;
}

const FORMATS_ANNONCES = {
  'image/png': 'png', 'image/jpeg': 'jpeg', 'image/jpg': 'jpeg', 'image/pjpeg': 'jpeg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif', 'image/x-icon': 'x-icon', 'image/vnd.microsoft.icon': 'x-icon',
  'image/bmp': 'bmp'
};

/**
 * Le contenu contredit-il le type annonce ? Un fait, ou null. Un corps
 * tronque a la capture n est pas juge : son JSON serait illisible pour une
 * raison qui ne tient qu a la troncature.
 */
export function controlerType(corps, typeAnnonce) {
  if (!corps || corps.truncated) return null;
  const type = typeDeBase(typeAnnonce || corps.mime || corps.contentType);
  const texte = typeof corps.text === 'string' ? corps.text : '';
  const fait = (cle, valeurs) => ({ cle, texte: FAITS_CORPS[cle], valeurs, aTraduire: valeurs.nature ? ['nature'] : [] });

  if (estJson(type) && texte) {
    try { JSON.parse(texte); return null; } catch { /* la suite le dit */ }
    const debut = texte.trimStart().slice(0, 40).replace(/\s+/g, ' ');
    const nature = /^\s*<(!doctype\s+html|html[\s>])/i.test(texte) ? FAITS_CORPS.natureHtml
      : /^\s*<\?xml/i.test(texte) ? FAITS_CORPS.natureXml
        : !texte.trim() ? FAITS_CORPS.natureVide : FAITS_CORPS.natureTexte;
    return fait('pasDuJson', { type, nature, debut });
  }
  if (type === 'text/html' && /^\s*[{[]/.test(texte)) {
    try { JSON.parse(texte); return fait('jsonEnHtml', { type }); } catch { return null; }
  }
  const attendu = FORMATS_ANNONCES[type];
  if (attendu && corps.base64) {
    const vu = formatImage(octetsDe64(corps.base64, 16));
    if (vu && vu !== attendu) return fait('imageAutre', { type, format: vu.toUpperCase() });
  }
  return null;
}

const enteteDe = (liste, nom) => {
  const h = (liste || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '') : '';
};

/**
 * Ce que gzip ferait d un texte servi sans compression, mesure. Rend
 * { avant, apres } en octets, ou null quand la mesure ne serait pas exacte
 * (corps tronque, deja compresse, texte qui ne redonne pas les octets recus)
 * ou sans interet (moins d un kilo-octet).
 */
export async function mesurerCompression(corps, entetesReponse) {
  if (!corps || corps.truncated || typeof corps.text !== 'string' || !corps.text) return null;
  if (corps.contentEncoding || enteteDe(entetesReponse, 'content-encoding')) return null;
  if (typeof CompressionStream !== 'function') return null;
  const octets = new TextEncoder().encode(corps.text);
  if (octets.length < SEUIL_COMPRESSION) return null;
  const recus = Number.isFinite(corps.stored) ? corps.stored : corps.size;
  if (recus !== octets.length) return null;
  const compresse = await gzipOctets(octets);
  return { avant: octets.length, apres: compresse.length };
}

/** Les octets compresses en gzip par le navigateur (CompressionStream). */
export async function gzipOctets(octets) {
  const flux = new Blob([octets]).stream().pipeThrough(new CompressionStream('gzip'));
  return new Uint8Array(await new Response(flux).arrayBuffer());
}
