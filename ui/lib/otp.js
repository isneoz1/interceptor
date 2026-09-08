/* Codes a usage unique — INTERCEPTOR (by NeoZ)
 *
 * HOTP (RFC 4226), TOTP (RFC 6238) et les liens otpauth:// que lisent les
 * applications d authentification. Verifie contre les vecteurs publies dans
 * les deux normes.
 *
 * A quoi ca sert ici : quand une capture montre un champ « code » refuse par
 * le serveur, on veut savoir si le code etait bon au moment de l envoi. On
 * recalcule donc le code attendu a partir du secret que l on possede deja.
 * Cet outil ne devine aucun secret et ne contourne aucune authentification.
 */
import { texteVersOctets, octetsVersHex, hexVersOctets } from './bytes.js';
import { base32VersOctets, octetsVersBase32 } from './codecs-bases.js';

export const ALGOS_OTP = ['SHA-1', 'SHA-256', 'SHA-512'];
export const PAS_PAR_DEFAUT = 30;
export const CHIFFRES_PAR_DEFAUT = 6;

function sujet() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('crypto.subtle indisponible dans ce contexte');
  return s;
}

/** Lit un secret ecrit en base32 (le cas courant), en hexadecimal ou en clair. */
export function secretVersOctets(secret, forme = 'base32') {
  const brut = String(secret == null ? '' : secret).trim();
  if (!brut) throw new Error('secret vide');
  if (forme === 'hex') return hexVersOctets(brut);
  if (forme === 'texte') return texteVersOctets(brut);
  return base32VersOctets(brut.replace(/\s+/g, ''));
}

/** Le compteur occupe toujours huit octets, gros boutiste (RFC 4226 s5.1). */
function compteurOctets(compteur) {
  const octets = new Uint8Array(8);
  let reste = BigInt(compteur);
  for (let i = 7; i >= 0; i--) { octets[i] = Number(reste & 0xffn); reste >>= 8n; }
  return octets;
}

async function hmacOctets(algorithme, cle, message) {
  if (!ALGOS_OTP.includes(algorithme)) throw new Error('OTP : algorithme inconnu ' + algorithme);
  if (!cle.length) throw new Error('secret vide');
  const importee = await sujet().importKey(
    'raw', cle, { name: 'HMAC', hash: algorithme }, false, ['sign']
  );
  return new Uint8Array(await sujet().sign('HMAC', importee, message));
}

/**
 * Troncature dynamique : les quatre bits de poids faible du dernier octet
 * designent l endroit ou lire quatre octets, dont on retire le bit de signe.
 */
export function tronquer(condense, chiffres) {
  const decalage = condense[condense.length - 1] & 0x0f;
  const valeur = ((condense[decalage] & 0x7f) << 24)
    | (condense[decalage + 1] << 16)
    | (condense[decalage + 2] << 8)
    | condense[decalage + 3];
  const modulo = 10 ** chiffres;
  return String(valeur % modulo).padStart(chiffres, '0');
}

/** HOTP : code lie a un compteur qui avance a chaque usage. */
export async function hotp(secretOctets, compteur, options = {}) {
  const chiffres = Number(options.chiffres) || CHIFFRES_PAR_DEFAUT;
  const algorithme = options.algorithme || 'SHA-1';
  const condense = await hmacOctets(algorithme, secretOctets, compteurOctets(compteur));
  return tronquer(condense, chiffres);
}

/** Numero de fenetre pour un instant donne (secondes depuis 1970). */
export function fenetreTotp(secondes, pas = PAS_PAR_DEFAUT, origine = 0) {
  return Math.floor((Number(secondes) - Number(origine)) / Number(pas));
}

/** TOTP : HOTP dont le compteur est l heure decoupee en tranches. */
export async function totp(secretOctets, options = {}) {
  const pas = Number(options.pas) || PAS_PAR_DEFAUT;
  const origine = Number(options.origine) || 0;
  const secondes = options.secondes != null ? Number(options.secondes) : Math.floor(Date.now() / 1000);
  const compteur = fenetreTotp(secondes, pas, origine);
  const code = await hotp(secretOctets, compteur, options);
  const restantes = pas - (((secondes - origine) % pas) + pas) % pas;
  return { code, compteur, restantes, fenetre: compteur };
}

/**
 * Codes des fenetres voisines. Un serveur accepte souvent la fenetre
 * precedente et la suivante : cela explique un code « en retard » accepte.
 */
export async function totpVoisins(secretOctets, options = {}, marge = 1) {
  const pas = Number(options.pas) || PAS_PAR_DEFAUT;
  const secondes = options.secondes != null ? Number(options.secondes) : Math.floor(Date.now() / 1000);
  const centre = fenetreTotp(secondes, pas, Number(options.origine) || 0);
  const sortie = [];
  for (let d = -marge; d <= marge; d++) {
    sortie.push({
      decalage: d,
      instant: (centre + d) * pas + (Number(options.origine) || 0),
      code: await hotp(secretOctets, centre + d, options)
    });
  }
  return sortie;
}

/* ------------------------------ Liens otpauth ----------------------------- */
const ALGO_URI = { SHA1: 'SHA-1', SHA256: 'SHA-256', SHA512: 'SHA-512' };
const URI_ALGO = { 'SHA-1': 'SHA1', 'SHA-256': 'SHA256', 'SHA-512': 'SHA512' };

/** Lit un lien otpauth://totp/Emetteur:compte?secret=...&issuer=... */
export function lireOtpauth(lien) {
  const brut = String(lien == null ? '' : lien).trim();
  if (!/^otpauth:\/\//i.test(brut)) throw new Error('lien otpauth:// attendu');
  const url = new URL(brut);
  const type = url.host.toLowerCase();
  if (type !== 'totp' && type !== 'hotp') throw new Error('type otpauth inconnu : ' + type);

  const etiquette = decodeURIComponent(url.pathname.replace(/^\//, ''));
  const coupe = etiquette.indexOf(':');
  const emetteurEtiquette = coupe >= 0 ? etiquette.slice(0, coupe).trim() : '';
  const compte = coupe >= 0 ? etiquette.slice(coupe + 1).trim() : etiquette;

  const p = url.searchParams;
  const secret = (p.get('secret') || '').replace(/\s+/g, '');
  if (!secret) throw new Error('lien otpauth sans secret');
  const algoBrut = (p.get('algorithm') || 'SHA1').toUpperCase();

  return {
    type,
    compte,
    emetteur: p.get('issuer') || emetteurEtiquette,
    secret,
    algorithme: ALGO_URI[algoBrut] || 'SHA-1',
    chiffres: Number(p.get('digits')) || CHIFFRES_PAR_DEFAUT,
    pas: Number(p.get('period')) || PAS_PAR_DEFAUT,
    compteur: p.has('counter') ? Number(p.get('counter')) : null
  };
}

/** Fabrique le lien correspondant, pour le relire dans une application. */
export function ecrireOtpauth(parametres) {
  const p = parametres || {};
  const type = p.type === 'hotp' ? 'hotp' : 'totp';
  const compte = String(p.compte || 'compte');
  const emetteur = String(p.emetteur || '');
  const etiquette = emetteur ? `${emetteur}:${compte}` : compte;

  const champs = new URLSearchParams();
  champs.set('secret', String(p.secret || '').replace(/\s+/g, '').toUpperCase());
  if (emetteur) champs.set('issuer', emetteur);
  champs.set('algorithm', URI_ALGO[p.algorithme || 'SHA-1'] || 'SHA1');
  champs.set('digits', String(Number(p.chiffres) || CHIFFRES_PAR_DEFAUT));
  if (type === 'totp') champs.set('period', String(Number(p.pas) || PAS_PAR_DEFAUT));
  else champs.set('counter', String(Number(p.compteur) || 0));

  return `otpauth://${type}/${encodeURIComponent(etiquette)}?${champs.toString()}`;
}

/** Secret aleatoire au format attendu par les applications d authentification. */
export function secretAleatoire(octets = 20) {
  const tampon = new Uint8Array(Math.max(10, Math.min(64, Number(octets) || 20)));
  globalThis.crypto.getRandomValues(tampon);
  return { base32: octetsVersBase32(tampon).replace(/=+$/, ''), hex: octetsVersHex(tampon) };
}
