/* Inspection de valeurs — INTERCEPTOR (by D4RK)
 *
 * JWT, entropie, vidage hexadecimal, analyse de chaines de requete, de cookies
 * et d entetes. Fonctions pures : la boite a outils les affiche, les tests les
 * executent hors navigateur.
 *
 * Les empreintes vivent dans hashes.js, les horodatages dans temps.js et les
 * generateurs dans generateurs.js : chacun son module, aucun doublon.
 */
import { texteVersOctets, base64UrlDecoder } from './codecs.js';

/* --------------------------------- JWT ------------------------------------ */
const CLAIMS = {
  iss: 'Emetteur', sub: 'Sujet', aud: 'Destinataire', exp: 'Expire le',
  nbf: 'Valide a partir de', iat: 'Emis le', jti: 'Identifiant du jeton',
  scope: 'Portee', scp: 'Portee', azp: 'Partie autorisee', typ: 'Type',
  alg: 'Algorithme', kid: 'Identifiant de cle', name: 'Nom', email: 'Adresse e-mail',
  roles: 'Roles', groups: 'Groupes', client_id: 'Client', session_state: 'Session'
};

/** Libelle francais d une revendication JWT connue, sinon la cle brute. */
export function libelleClaim(cle) { return CLAIMS[cle] || cle; }

/**
 * Decode un JWT sans jamais verifier la signature : une extension ne detient
 * pas la cle. Le resultat le dit explicitement, pour qu on ne prenne jamais un
 * jeton decode pour un jeton valide.
 */
export function decoderJwt(jeton) {
  const brut = String(jeton || '').trim().replace(/^Bearer\s+/i, '');
  const parts = brut.split('.');
  if (parts.length !== 3) throw new Error('un JWT compte trois parties separees par des points');

  let entete, charge;
  try { entete = JSON.parse(base64UrlDecoder(parts[0])); }
  catch { throw new Error('entete illisible'); }
  try { charge = JSON.parse(base64UrlDecoder(parts[1])); }
  catch { throw new Error('charge utile illisible'); }

  const maintenant = Math.floor(Date.now() / 1000);
  const exp = typeof charge.exp === 'number' ? charge.exp : null;
  const nbf = typeof charge.nbf === 'number' ? charge.nbf : null;
  const iat = typeof charge.iat === 'number' ? charge.iat : null;

  return {
    entete, charge,
    signature: parts[2],
    algorithme: entete && entete.alg ? String(entete.alg) : 'inconnu',
    // « alg: none » est une faiblesse historique reelle : on la signale.
    algorithmeNul: !!(entete && String(entete.alg || '').toLowerCase() === 'none'),
    emisLe: iat != null ? new Date(iat * 1000).toISOString() : null,
    expireLe: exp != null ? new Date(exp * 1000).toISOString() : null,
    valideDes: nbf != null ? new Date(nbf * 1000).toISOString() : null,
    expire: exp != null ? exp < maintenant : null,
    pasEncoreValide: nbf != null ? nbf > maintenant : null,
    resteSecondes: exp != null ? exp - maintenant : null,
    signatureVerifiee: false
  };
}

/* -------------------------------- Entropie --------------------------------- */
/**
 * Entropie de Shannon, en bits par octet (maximum 8). Sert a reconnaitre un
 * jeton aleatoire (proche de 8, ou de 4 pour de l hexadecimal) d un texte
 * ordinaire (autour de 4 en francais, moins encore en balisage repetitif).
 */
export function entropie(texte) {
  const octets = texteVersOctets(texte);
  if (!octets.length) return { bits: 0, parOctet: 0, octets: 0, distincts: 0 };
  const comptes = new Map();
  for (const o of octets) comptes.set(o, (comptes.get(o) || 0) + 1);
  let h = 0;
  for (const n of comptes.values()) {
    const p = n / octets.length;
    h -= p * Math.log2(p);
  }
  return {
    bits: Math.round(h * octets.length * 100) / 100,
    parOctet: Math.round(h * 1000) / 1000,
    octets: octets.length,
    distincts: comptes.size
  };
}

/* --------------------------- Vidage hexadecimal ---------------------------- */
/** Vidage classique : decalage, seize octets, colonne lisible. */
export function vidageHex(texte, maxOctets = 4096) {
  const tous = texteVersOctets(texte);
  const octets = tous.length > maxOctets ? tous.subarray(0, maxOctets) : tous;
  const lignes = [];
  for (let i = 0; i < octets.length; i += 16) {
    const tranche = octets.subarray(i, i + 16);
    const hex = [...tranche].map(o => o.toString(16).padStart(2, '0')).join(' ').padEnd(47, ' ');
    const lisible = [...tranche].map(o => (o >= 32 && o <= 126 ? String.fromCharCode(o) : '.')).join('');
    lignes.push(i.toString(16).padStart(8, '0') + '  ' + hex + '  |' + lisible + '|');
  }
  if (tous.length > octets.length) {
    lignes.push('… ' + (tous.length - octets.length) + ' octets supplementaires non affiches');
  }
  return lignes.join('\n');
}

/* --------------------------- Analyse de chaines ---------------------------- */
export function analyserChaineRequete(entree) {
  const brut = String(entree || '').trim();
  const apres = brut.includes('?') ? brut.slice(brut.indexOf('?') + 1) : brut;
  const params = new URLSearchParams(apres.replace(/^[?&]+/, ''));
  return [...params.entries()].map(([cle, valeur]) => ({ cle, valeur }));
}

export function analyserCookies(entree) {
  return String(entree || '').split(';').map(p => p.trim()).filter(Boolean).map(p => {
    const i = p.indexOf('=');
    return i < 0 ? { cle: p, valeur: '' } : { cle: p.slice(0, i).trim(), valeur: p.slice(i + 1).trim() };
  });
}

export function analyserEntetes(entree) {
  return String(entree || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).map(ligne => {
    const i = ligne.indexOf(':');
    return i < 0 ? { cle: ligne, valeur: '' } : { cle: ligne.slice(0, i).trim(), valeur: ligne.slice(i + 1).trim() };
  });
}

/** Mesures brutes d un texte : ce que l on veut savoir d un corps capture. */
export function mesures(texte) {
  const s = String(texte || '');
  return {
    caracteres: s.length,
    octets: texteVersOctets(s).length,
    lignes: s ? s.split(/\r?\n/).length : 0,
    mots: s.trim() ? s.trim().split(/\s+/).length : 0
  };
}
