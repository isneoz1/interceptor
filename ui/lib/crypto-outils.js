/* Chiffrement, derivation et signatures — INTERCEPTOR (by NeoZ)
 *
 * Tout passe par crypto.subtle : AES-GCM, AES-CBC, AES-CTR, PBKDF2, HKDF,
 * verification RSA et ECDSA. Aucun algorithme n est reimplemente ici, donc
 * aucun resultat approximatif — et rien ne quitte la machine.
 *
 * A quoi cela sert dans un outil de supervision : relire un corps chiffre dont
 * on connait la cle, refaire la derivation d une application pour verifier
 * qu on obtient la meme cle, controler la signature d un webhook ou d un
 * paquet mis a jour.
 */
import {
  texteVersOctets, octetsVersTexte, octetsVersHex, hexVersOctets,
  octetsVersBase64, base64VersOctets
} from './bytes.js';

const MODES = ['AES-GCM', 'AES-CBC', 'AES-CTR'];
const HACHAGES = ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1'];

export const MODES_AES = MODES;
export const HACHAGES_DISPONIBLES = HACHAGES;

function sujet() {
  const s = globalThis.crypto && globalThis.crypto.subtle;
  if (!s) throw new Error('crypto.subtle indisponible dans ce contexte');
  return s;
}

/** Une valeur collee arrive en texte, en hexadecimal ou en base64. */
function lireOctets(valeur, forme = 'texte') {
  const brut = String(valeur == null ? '' : valeur);
  if (forme === 'hex') return hexVersOctets(brut);
  if (forme === 'base64') return base64VersOctets(brut);
  return texteVersOctets(brut);
}

function alea(n) {
  const tampon = new Uint8Array(n);
  const c = globalThis.crypto;
  if (!c || !c.getRandomValues) throw new Error('generateur aleatoire indisponible');
  c.getRandomValues(tampon);
  return tampon;
}

/* --------------------------- Derivation de cle ---------------------------- */
/**
 * PBKDF2 : la derivation que la plupart des applications emploient pour
 * transformer un mot de passe en cle. Le nombre d iterations fait toute la
 * difference — il est affiche, jamais devine.
 */
export async function pbkdf2({ motDePasse, sel, formeSel = 'texte',
  iterations = 100000, hash = 'SHA-256', bits = 256 }) {
  if (!String(motDePasse || '')) throw new Error('mot de passe vide');
  if (!HACHAGES.includes(hash)) throw new Error('empreinte inconnue : ' + hash);
  const tours = Math.max(1, Math.min(5000000, Math.floor(Number(iterations) || 1)));
  const longueur = Math.max(8, Math.min(4096, Math.floor(Number(bits) || 256)));
  const base = await sujet().importKey('raw', texteVersOctets(motDePasse), 'PBKDF2', false, ['deriveBits']);
  const octets = await sujet().deriveBits(
    { name: 'PBKDF2', salt: lireOctets(sel || '', formeSel), iterations: tours, hash },
    base, longueur
  );
  const sortie = new Uint8Array(octets);
  return { hex: octetsVersHex(sortie), base64: octetsVersBase64(sortie), bits: longueur, iterations: tours };
}

/** HKDF : la derivation des protocoles modernes (TLS 1.3, Signal, WebPush). */
export async function hkdf({ cle, formeCle = 'texte', sel = '', formeSel = 'texte',
  info = '', formeInfo = 'texte', hash = 'SHA-256', bits = 256 }) {
  if (!HACHAGES.includes(hash)) throw new Error('empreinte inconnue : ' + hash);
  const longueur = Math.max(8, Math.min(4096, Math.floor(Number(bits) || 256)));
  const base = await sujet().importKey('raw', lireOctets(cle, formeCle), 'HKDF', false, ['deriveBits']);
  const octets = await sujet().deriveBits(
    { name: 'HKDF', hash, salt: lireOctets(sel, formeSel), info: lireOctets(info, formeInfo) },
    base, longueur
  );
  const sortie = new Uint8Array(octets);
  return { hex: octetsVersHex(sortie), base64: octetsVersBase64(sortie), bits: longueur };
}

/* -------------------------------- AES ------------------------------------- */
function parametres(mode, iv, aad) {
  if (mode === 'AES-GCM') return { name: 'AES-GCM', iv, additionalData: aad, tagLength: 128 };
  if (mode === 'AES-CBC') return { name: 'AES-CBC', iv };
  return { name: 'AES-CTR', counter: iv, length: 64 };
}

/** Taille du vecteur d initialisation attendue par chaque mode. */
export function tailleIv(mode) { return mode === 'AES-GCM' ? 12 : 16; }

async function importerAes(cle, formeCle, mode, usage) {
  const octets = lireOctets(cle, formeCle);
  if (![16, 24, 32].includes(octets.length)) {
    throw new Error('cle de ' + octets.length + ' octets : AES en attend 16, 24 ou 32');
  }
  return sujet().importKey('raw', octets, { name: mode }, false, [usage]);
}

/**
 * Chiffre le texte de travail. Le vecteur d initialisation est tire au hasard
 * s il n est pas fourni, et rendu avec le resultat : sans lui, rien ne se
 * dechiffre, et le cacher serait un piege.
 */
export async function aesChiffrer({ texte, cle, formeCle = 'hex', mode = 'AES-GCM',
  iv = '', formeIv = 'hex', aad = '', formeAad = 'texte' }) {
  if (!MODES.includes(mode)) throw new Error('mode inconnu : ' + mode);
  const vecteur = iv ? lireOctets(iv, formeIv) : alea(tailleIv(mode));
  if (vecteur.length !== tailleIv(mode)) {
    throw new Error(mode + ' attend un vecteur de ' + tailleIv(mode) + ' octets, pas ' + vecteur.length);
  }
  const cleAes = await importerAes(cle, formeCle, mode, 'encrypt');
  const donneesAad = mode === 'AES-GCM' && aad ? lireOctets(aad, formeAad) : undefined;
  const chiffre = new Uint8Array(await sujet().encrypt(
    parametres(mode, vecteur, donneesAad), cleAes, texteVersOctets(texte)
  ));
  return {
    base64: octetsVersBase64(chiffre),
    hex: octetsVersHex(chiffre),
    iv: octetsVersHex(vecteur),
    mode,
    octets: chiffre.length
  };
}

/** Dechiffre. Une cle fausse fait echouer clairement : jamais de texte invente. */
export async function aesDechiffrer({ donnees, formeDonnees = 'base64', cle, formeCle = 'hex',
  mode = 'AES-GCM', iv, formeIv = 'hex', aad = '', formeAad = 'texte' }) {
  if (!MODES.includes(mode)) throw new Error('mode inconnu : ' + mode);
  const vecteur = lireOctets(iv || '', formeIv);
  if (vecteur.length !== tailleIv(mode)) {
    throw new Error(mode + ' attend un vecteur de ' + tailleIv(mode) + ' octets, pas ' + vecteur.length);
  }
  const cleAes = await importerAes(cle, formeCle, mode, 'decrypt');
  const donneesAad = mode === 'AES-GCM' && aad ? lireOctets(aad, formeAad) : undefined;
  let clair;
  try {
    clair = await sujet().decrypt(
      parametres(mode, vecteur, donneesAad), cleAes, lireOctets(donnees, formeDonnees)
    );
  } catch {
    throw new Error('dechiffrement refuse : cle, vecteur, mode ou donnees supplementaires incorrects');
  }
  return octetsVersTexte(new Uint8Array(clair));
}

/** Cle AES tiree au hasard, prete a coller. */
export function cleAesAleatoire(octets = 32) {
  if (![16, 24, 32].includes(Number(octets))) throw new Error('AES attend 16, 24 ou 32 octets');
  return octetsVersHex(alea(Number(octets)));
}

/* --------------------------- Signatures generales ------------------------- */
/**
 * Verifie une signature detachee sur un contenu quelconque : c est le controle
 * d un webhook, d un manifeste ou d un paquet. La cle publique se colle en PEM
 * ou en JWK, comme pour un jeton.
 */
export async function verifierSignature({ donnees, signature, formeSignature = 'base64',
  cle, algorithme = 'RSASSA-PKCS1-v1_5', hash = 'SHA-256', namedCurve = 'P-256' }) {
  if (!HACHAGES.includes(hash)) throw new Error('empreinte inconnue : ' + hash);
  const brut = String(cle || '').trim();
  if (!brut) throw new Error('cle vide');

  let parametresCle, parametresVerif;
  if (algorithme === 'RSASSA-PKCS1-v1_5') {
    parametresCle = { name: 'RSASSA-PKCS1-v1_5', hash };
    parametresVerif = 'RSASSA-PKCS1-v1_5';
  } else if (algorithme === 'RSA-PSS') {
    parametresCle = { name: 'RSA-PSS', hash };
    parametresVerif = { name: 'RSA-PSS', saltLength: Number(hash.slice(4)) / 8 };
  } else if (algorithme === 'ECDSA') {
    parametresCle = { name: 'ECDSA', namedCurve };
    parametresVerif = { name: 'ECDSA', hash };
  } else if (algorithme === 'HMAC') {
    const cleHmac = await sujet().importKey('raw', texteVersOctets(brut), { name: 'HMAC', hash }, false, ['verify']);
    return sujet().verify('HMAC', cleHmac, lireOctets(signature, formeSignature), texteVersOctets(donnees));
  } else {
    throw new Error('algorithme de signature inconnu : ' + algorithme);
  }

  let importee;
  if (brut.startsWith('{')) {
    let jwk;
    try { jwk = JSON.parse(brut); } catch { throw new Error('JWK illisible'); }
    importee = await sujet().importKey('jwk', jwk, parametresCle, false, ['verify']);
  } else if (brut.includes('-----BEGIN')) {
    if (/PRIVATE KEY/.test(brut)) throw new Error('cle privee fournie : la verification demande la cle publique');
    const corps = brut.replace(/-----[^-]+-----/g, '').replace(/[\s\r\n]+/g, '');
    importee = await sujet().importKey('spki', base64VersOctets(corps), parametresCle, false, ['verify']);
  } else {
    throw new Error('cle publique attendue au format PEM ou JWK');
  }
  return sujet().verify(parametresVerif, importee, lireOctets(signature, formeSignature), texteVersOctets(donnees));
}
