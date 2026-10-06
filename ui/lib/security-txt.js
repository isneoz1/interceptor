/* security.txt (RFC 9116) — SWIFT (by NeoZ)
 *
 * Le fichier ou un site dit comment lui signaler une faille : qui contacter,
 * jusqu a quand ces informations valent, sa politique, sa cle de chiffrement.
 * Quand le navigateur le charge, SWIFT le lit et le confronte a la RFC 9116.
 *
 * Source, lue dans le texte : RFC 9116
 *   §2      un champ par ligne, « Nom: valeur » ; noms insensibles a la casse
 *   §2.1    une ligne qui commence par « # » est un commentaire
 *   §2.3    une signature OpenPGP en clair est recommandee
 *   §2.5.2  Canonical : adresses du fichier ; si l adresse de chargement n en
 *           fait pas partie, le contenu ne devrait pas etre tenu pour fiable
 *   §2.5.3  Contact : toujours present ; une adresse web commence par https://
 *   §2.5.5  Expires : toujours present, une seule fois, date RFC 3339 ;
 *           depasse, le fichier est perime ; moins d un an recommande
 *   §2.5.8  Preferred-Languages : une seule fois au plus
 *   §3      sous /.well-known/, en https, en text/plain utf-8
 *
 * La signature OpenPGP est reconnue, pas verifiee : il faudrait la cle.
 */

export const CHAMPS_SECURITY_TXT = ['Contact', 'Expires', 'Encryption', 'Acknowledgments', 'Policy',
  'Hiring', 'Preferred-Languages', 'Canonical'];

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const FAITS_SECURITY_TXT = {
  sansContact: 'aucun champ Contact : il doit toujours etre present (RFC 9116 §2.5.3)',
  sansExpires: 'aucun champ Expires : il doit toujours etre present (RFC 9116 §2.5.5)',
  expiresMultiple: 'Expires apparait {n} fois : une seule fois au plus (RFC 9116 §2.5.5)',
  expiresIllisible: 'Expires illisible : « {v} » n est pas une date RFC 3339 (RFC 9116 §2.5.5)',
  perime: 'expire depuis le {date} : ces informations sont perimees et ne devraient plus servir (RFC 9116 §2.5.5)',
  plusDunAn: 'Expires a plus d un an de la capture ({date}) : la RFC recommande moins d un an (RFC 9116 §2.5.5)',
  langueMultiple: 'Preferred-Languages apparait {n} fois : une seule fois au plus (RFC 9116 §2.5.8)',
  contactHttp: 'Contact {v} : une adresse web doit commencer par https:// (RFC 9116 §2.5.3)',
  canonicalHttp: 'Canonical {v} : une adresse web doit commencer par https:// (RFC 9116 §2.5.2)',
  horsCanonical: 'charge depuis {url}, absente des adresses Canonical du fichier : son contenu ne devrait pas etre tenu pour fiable (RFC 9116 §2.5.2)',
  nonHttps: 'fichier charge sans https : la RFC exige https pour y acceder (RFC 9116 §3)',
  typeContenu: 'type {type} : la RFC demande text/plain en utf-8 (RFC 9116 §3)',
  horsWellKnown: 'fichier a la racine du site : sa place est sous /.well-known/, qui l emporte si les deux existent (RFC 9116 §3)',
  signe: 'signe par une signature OpenPGP en clair, comme la RFC le recommande (§2.3) ; la signature n est pas verifiee ici',
  nonSigne: 'non signe : la RFC recommande une signature OpenPGP en clair (RFC 9116 §2.3)'
};

const DATE_RFC3339 = /^(\d{4})-(\d{2})-(\d{2})[Tt](\d{2}):(\d{2}):(\d{2})(\.\d+)?([Zz]|([+-])(\d{2}):(\d{2}))$/;
const UN_AN = 365 * 24 * 3600 * 1000;

/** Une date RFC 3339 en millisecondes, ou null. Le « z » minuscule est permis
 *  (RFC 3339 §5.6) : l exemple de la RFC 9116 l emploie. */
export function dateRfc3339(texte) {
  const m = DATE_RFC3339.exec(String(texte || '').trim());
  if (!m) return null;
  const [, a, mo, j, h, mi, s, frac, , signe, dh, dm] = m;
  const ms = Date.UTC(+a, +mo - 1, +j, +h, +mi, +s, frac ? Math.round(Number(frac) * 1000) : 0);
  const utc = new Date(ms);
  if (utc.getUTCMonth() !== +mo - 1 || utc.getUTCDate() !== +j || +h > 23 || +mi > 59 || +s > 59) return null;
  const decalage = signe ? (signe === '-' ? -1 : 1) * ((+dh) * 60 + (+dm)) * 60000 : 0;
  return ms - decalage;
}

/* Une signature OpenPGP en clair (RFC 4880 §7) : le texte signe se trouve
   entre l en-tete et le bloc de signature, ses lignes « - » desechappees. */
function sansArmure(texte) {
  const debut = texte.indexOf('-----BEGIN PGP SIGNED MESSAGE-----');
  if (debut < 0) return { contenu: texte, signe: false };
  const fin = texte.indexOf('-----BEGIN PGP SIGNATURE-----', debut);
  const corps = texte.slice(debut, fin < 0 ? texte.length : fin).split(/\r?\n/);
  let i = 1;
  while (i < corps.length && corps[i].trim() !== '') i++;
  const lignes = corps.slice(i + 1).map(l => (l.startsWith('- ') ? l.slice(2) : l));
  return { contenu: lignes.join('\n'), signe: fin >= 0 };
}

/** Le chemin d un fichier security.txt, ou null. */
export function emplacementSecurityTxt(url) {
  let chemin;
  try { chemin = new URL(url).pathname; } catch { return null; }
  if (chemin === '/.well-known/security.txt') return 'well-known';
  if (chemin === '/security.txt') return 'racine';
  return null;
}

/**
 * Le contenu d un security.txt : les champs, dans l ordre et par nom, et s il
 * est signe. Rend null si le texte ne porte aucun champ.
 */
export function lireSecurityTxt(texte) {
  if (typeof texte !== 'string' || !texte.trim()) return null;
  const { contenu, signe } = sansArmure(texte);
  const champs = [];
  for (const brute of contenu.split(/\r?\n/)) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith('#')) continue;
    const m = /^([A-Za-z0-9-]+)\s*:\s*(.*)$/.exec(ligne);
    if (!m) continue;
    const connu = CHAMPS_SECURITY_TXT.find(n => n.toLowerCase() === m[1].toLowerCase());
    champs.push({ nom: connu || m[1], valeur: m[2].trim(), connu: !!connu });
  }
  if (!champs.length) return null;
  return { champs, signe };
}

/** Les faits d un security.txt, au moment de sa capture. */
export function faitsSecurityTxt(lu, { url = '', typeMedia = '', maintenant = Date.now() } = {}) {
  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_SECURITY_TXT[cle], valeurs });
  if (!lu) return faits;
  const valeurs = nom => lu.champs.filter(c => c.nom === nom).map(c => c.valeur);
  const jour = ms => new Date(ms).toISOString().slice(0, 10);

  const contacts = valeurs('Contact');
  if (!contacts.length) dire('sansContact');
  for (const v of contacts) if (/^http:\/\//i.test(v)) dire('contactHttp', { v });

  const expires = valeurs('Expires');
  if (!expires.length) dire('sansExpires');
  if (expires.length > 1) dire('expiresMultiple', { n: expires.length });
  if (expires.length) {
    const date = dateRfc3339(expires[0]);
    if (date === null) dire('expiresIllisible', { v: expires[0] });
    else if (date < maintenant) dire('perime', { date: jour(date) });
    else if (date - maintenant > UN_AN) dire('plusDunAn', { date: jour(date) });
  }
  const langues = valeurs('Preferred-Languages');
  if (langues.length > 1) dire('langueMultiple', { n: langues.length });

  const canoniques = valeurs('Canonical');
  for (const v of canoniques) if (/^http:\/\//i.test(v)) dire('canonicalHttp', { v });
  if (canoniques.length && url && !canoniques.includes(url)) dire('horsCanonical', { url });

  if (url && !/^https:/i.test(url)) dire('nonHttps');
  const type = String(typeMedia || '').toLowerCase();
  if (type && !/^text\/plain\b/.test(type)) dire('typeContenu', { type: type.split(';')[0].trim() });
  if (emplacementSecurityTxt(url) === 'racine') dire('horsWellKnown');
  dire(lu.signe ? 'signe' : 'nonSigne');
  return faits;
}
