/* Catalogue des empreintes locales — INTERCEPTOR (by NeoZ)
 *
 * Rassemble les empreintes calculees sans le navigateur : SHA-3 et SHAKE,
 * Keccak d origine, RIPEMD-160, SM3, MD4, NTLM, BLAKE2, xxHash64. Chacune est verifiee
 * dans tests/avance.test.mjs contre une valeur publiee ou l implementation
 * d OpenSSL. Les empreintes natives (MD5, SHA-1, SHA-2) restent dans hashes.js.
 */
import { sha3, shake, keccak } from './sha3.js';
import { ripemd160, sm3, md4, ntlm } from './hashes-plus.js';
import { blake2b512, blake2s256 } from './blake2.js';
import { crc, CRC_VARIANTES, murmur3, xxhash32, xxhash64, siphash24 } from './sommes.js';

/* Empreintes texte -> hexadecimal, toutes synchrones. */
export const EMPREINTES_SUP = [
  ['SHA3-224', t => sha3(t, 224)],
  ['SHA3-256', t => sha3(t, 256)],
  ['SHA3-384', t => sha3(t, 384)],
  ['SHA3-512', t => sha3(t, 512)],
  ['Keccak-256', t => keccak(t, 256)],
  ['SHAKE128', t => shake(t, 128, 32)],
  ['SHAKE256', t => shake(t, 256, 64)],
  ['RIPEMD-160', ripemd160],
  ['SM3', sm3],
  ['MD4', md4],
  ['NTLM', ntlm],
  ['BLAKE2b-512', blake2b512],
  ['BLAKE2s-256', blake2s256],
  ['xxHash64', xxhash64]
];

/** Empreinte supplementaire par nom, ou chaine vide si le nom est inconnu. */
export function empreinteSup(nom, texte) {
  const entree = EMPREINTES_SUP.find(([cle]) => cle === nom);
  return entree ? entree[1](String(texte == null ? '' : texte)) : '';
}

export { crc, CRC_VARIANTES, murmur3, xxhash32, xxhash64, siphash24 };
