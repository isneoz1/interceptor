/* Jeux de cles JWK (RFC 7517) — SWIFT (by D4RK)
 *
 * Un emetteur publie ses cles publiques dans un jeu de cles (JWKS), a
 * l adresse que donne son document de decouverte (« jwks_uri »). Un jeton
 * qui annonce un « kid » designe l une d elles (RFC 7515 §4.1.4) : avec ce
 * jeu, sa signature se verifie sans rien coller.
 *
 * Ce module lit un jeu, dit ce qu il a de travers — une cle privee publiee,
 * une cle RSA trop courte, un kid qui ne distingue plus rien —, choisit les
 * cles qui peuvent avoir signe un jeton et dit pourquoi les autres sont
 * ecartees, puis verifie.
 */
import { base64VersOctets } from './bytes.js';
import { verifierJwt } from './jwt.js';

/* Les membres prives d une cle asymetrique (RFC 7518 §6.2.2, §6.3.2 ;
   RFC 8037 §2). Pour une cle symetrique, « k » est le secret lui-meme. */
const MEMBRES_PRIVES = ['d', 'p', 'q', 'dp', 'dq', 'qi', 'oth'];

/* La taille d une cle RSA : le nombre de bits de son module. */
function bitsRsa(n) {
  let octets;
  try { octets = base64VersOctets(n); } catch { return null; }
  let i = 0;
  while (i < octets.length && octets[i] === 0) i++;
  if (i === octets.length) return 0;
  return (octets.length - i - 1) * 8 + (32 - Math.clz32(octets[i]));
}

/** Le nom d une cle dans un message : son kid, ou son rang. */
export const nomCle = c => (c.kid !== null ? '« ' + c.kid + ' »' : '#' + (c.index + 1));

/* Ce qui sert a verifier : une cle asymetrique perd ses membres prives ; une
   cle symetrique garde son secret, sans lequel rien ne se verifie. */
function partieUtile(jwk) {
  if (jwk.kty === 'oct') return { ...jwk };
  const utile = {};
  for (const [nom, valeur] of Object.entries(jwk)) if (!MEMBRES_PRIVES.includes(nom)) utile[nom] = valeur;
  return utile;
}

/**
 * Lit un jeu de cles.
 * @returns null si ce n est pas un jeu — un objet dont « keys » est un tableau
 *          de JWK, chacune avec son « kty » (RFC 7517 §5, §4.1) —, sinon
 *          { cles: [{ index, jwk, kid, kty, alg, use, keyOps, crv, bits, prives }], faits }
 */
export function lireJwks(source) {
  let objet = source;
  if (typeof source === 'string') {
    try { objet = JSON.parse(source); } catch { return null; }
  }
  if (!objet || typeof objet !== 'object' || Array.isArray(objet) || !Array.isArray(objet.keys)) return null;
  if (!objet.keys.every(k => k && typeof k === 'object' && !Array.isArray(k) && typeof k.kty === 'string')) return null;
  const cles = objet.keys.map((jwk, index) => ({
    index,
    jwk: partieUtile(jwk),
    kid: typeof jwk.kid === 'string' ? jwk.kid : null,
    kty: jwk.kty,
    alg: typeof jwk.alg === 'string' ? jwk.alg : null,
    use: typeof jwk.use === 'string' ? jwk.use : null,
    keyOps: Array.isArray(jwk.key_ops) ? jwk.key_ops.map(String) : null,
    crv: typeof jwk.crv === 'string' ? jwk.crv : null,
    bits: jwk.kty === 'RSA' && typeof jwk.n === 'string' ? bitsRsa(jwk.n) : null,
    prives: jwk.kty === 'oct'
      ? (typeof jwk.k === 'string' ? ['k'] : [])
      : MEMBRES_PRIVES.filter(m => jwk[m] !== undefined)
  }));
  return { cles, faits: faitsDuJeu(cles) };
}

/* Chaque fait : { texte, valeurs, grave } — un gabarit a traduire. */
function faitsDuJeu(cles) {
  const faits = [];
  if (!cles.length) faits.push({ texte: 'ce jeu ne contient aucune cle', valeurs: {}, grave: false });
  for (const c of cles) {
    if (c.prives.length && c.kty === 'oct') {
      faits.push({ texte: 'la cle {cle} est symetrique : son secret « k » est publie, et quiconque le lit peut signer des jetons a la place de l emetteur',
        valeurs: { cle: nomCle(c) }, grave: true });
    } else if (c.prives.length) {
      faits.push({ texte: 'la cle {cle} publie sa partie privee ({membres}) : quiconque lit ce jeu peut signer a la place de l emetteur',
        valeurs: { cle: nomCle(c), membres: c.prives.join(', ') }, grave: true });
    }
    if (c.bits !== null && c.bits < 2048) {
      faits.push({ texte: 'la cle {cle} est une cle RSA de {bits} bits : RS256 a RS512 et PS256 a PS512 exigent 2048 bits ou plus (RFC 7518 §3.3, §3.5)',
        valeurs: { cle: nomCle(c), bits: c.bits }, grave: true });
    }
  }
  /* Le meme kid pour deux cles de meme type ne permet plus de choisir ; pour
     deux types differents, RFC 7517 §4.5 l admet (des alternatives
     equivalentes). */
  const vus = new Map();
  for (const c of cles) {
    if (c.kid === null) continue;
    const cle = c.kty + '\u0000' + c.kid;
    vus.set(cle, (vus.get(cle) || 0) + 1);
  }
  for (const [cle, n] of vus) {
    if (n < 2) continue;
    const [kty, kid] = cle.split('\u0000');
    faits.push({ texte: 'le kid « {kid} » designe {n} cles {kty} : il ne permet plus de choisir celle qui a signe (RFC 7517 §4.5)',
      valeurs: { kid, n, kty }, grave: false });
  }
  return faits;
}

/* Le type de cle que demande chaque algorithme (RFC 7518 §3, RFC 8037 §3.1,
   RFC 9864 §2.2). */
const COURBE_ES = { ES256: 'P-256', ES384: 'P-384', ES512: 'P-521' };
function convient(c, alg) {
  if (/^HS(256|384|512)$/.test(alg)) return c.kty === 'oct';
  if (/^(RS|PS)(256|384|512)$/.test(alg)) return c.kty === 'RSA';
  if (COURBE_ES[alg]) return c.kty === 'EC' && c.crv === COURBE_ES[alg];
  if (alg === 'EdDSA') return c.kty === 'OKP' && (c.crv === 'Ed25519' || c.crv === 'Ed448');
  if (alg === 'Ed25519' || alg === 'Ed448') return c.kty === 'OKP' && c.crv === alg;
  return false;
}

/**
 * Les cles d un jeu qui peuvent avoir signe un jeton d entete `entete`, et
 * pourquoi les autres sont ecartees : un autre kid (RFC 7515 §4.1.4), un
 * autre type de cle, un usage de chiffrement (RFC 7517 §4.2), des operations
 * sans « verify » (§4.3), un autre algorithme (§4.4).
 */
export function clesCandidates(jeu, entete) {
  const alg = entete && typeof entete.alg === 'string' ? entete.alg : '';
  const kid = entete && typeof entete.kid === 'string' ? entete.kid : null;
  const retenues = [];
  const ecartees = [];
  for (const c of jeu.cles) {
    const raison = kid !== null && c.kid !== kid ? 'kid'
      : !convient(c, alg) ? 'type'
        : c.use !== null && c.use !== 'sig' ? 'use'
          : c.keyOps !== null && !c.keyOps.includes('verify') ? 'key_ops'
            : c.alg !== null && c.alg !== alg ? 'alg' : null;
    if (raison) ecartees.push({ cle: c, raison });
    else retenues.push(c);
  }
  return { retenues, ecartees, kid, alg };
}

/**
 * Verifie un jeton avec les cles d un jeu : chaque cle candidate est essayee.
 * @returns { valide, cle, essais, ecartees } — `cle` est celle qui verifie ;
 *          aucune candidate : `essais` est vide.
 */
export async function verifierAvecJeu(jeton, jeu, entete) {
  const { retenues, ecartees } = clesCandidates(jeu, entete);
  const essais = [];
  for (const c of retenues) {
    try {
      const v = await verifierJwt(jeton, JSON.stringify(c.jwk));
      essais.push({ cle: c, valide: v.valide === true });
      if (v.valide === true) return { valide: true, cle: c, essais, ecartees };
    } catch (e) {
      essais.push({ cle: c, valide: false, erreur: e.message });
    }
  }
  return { valide: false, cle: null, essais, ecartees };
}
