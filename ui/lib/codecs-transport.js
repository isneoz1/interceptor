/* Encodages de transport binaire — INTERCEPTOR (by D4RK)
 *
 * Deux facons anciennes et toujours vivantes de faire passer des octets par un
 * canal qui n accepte que du texte imprimable :
 *
 *   - Z85 (ZeroMQ RFC 32) : quatre octets deviennent cinq caracteres, dans un
 *     alphabet choisi pour rester lisible dans du code source. On la croise
 *     dans les cles ZeroMQ et CurveZMQ.
 *   - uuencode (POSIX) : trois octets deviennent quatre caracteres, chaque
 *     ligne prefixee par sa longueur. Encore produite par sharutils et par de
 *     vieux scripts.
 *
 * Verifie contre le vecteur publie dans la RFC 32 de ZeroMQ et contre le
 * comportement decrit par POSIX.
 */

/* ------------------------------- Z85 (RFC 32) ----------------------------- */
const Z85 = '0123456789abcdefghijklmnopqrstuvwxyz'
  + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ.-:+=^!/*?&<>()[]{}@%$#';

const Z85_INVERSE = (() => {
  const t = new Int16Array(128).fill(-1);
  for (let i = 0; i < Z85.length; i++) t[Z85.charCodeAt(i)] = i;
  return t;
})();

/**
 * Encode des octets en Z85. La longueur doit etre un multiple de quatre :
 * c est la regle de la specification, et la rappeler vaut mieux que produire
 * une sortie qu aucun autre outil ne relira.
 */
export function z85Encoder(octets) {
  const o = versOctets(octets);
  if (o.length % 4 !== 0) {
    throw new Error('Z85 : la longueur doit etre un multiple de 4 octets (recu ' + o.length + ')');
  }
  let sortie = '';
  for (let i = 0; i < o.length; i += 4) {
    let valeur = ((o[i] * 16777216) + (o[i + 1] * 65536) + (o[i + 2] * 256) + o[i + 3]);
    const bloc = [];
    for (let j = 0; j < 5; j++) { bloc.unshift(Z85[valeur % 85]); valeur = Math.floor(valeur / 85); }
    sortie += bloc.join('');
  }
  return sortie;
}

/** Decode du Z85 vers des octets. La longueur doit etre un multiple de cinq. */
export function z85Decoder(texte) {
  const t = String(texte == null ? '' : texte).replace(/\s+/g, '');
  if (t.length % 5 !== 0) {
    throw new Error('Z85 : la longueur doit etre un multiple de 5 caracteres (recu ' + t.length + ')');
  }
  const sortie = new Uint8Array((t.length / 5) * 4);
  let k = 0;
  for (let i = 0; i < t.length; i += 5) {
    let valeur = 0;
    for (let j = 0; j < 5; j++) {
      const code = t.charCodeAt(i + j);
      const chiffre = code < 128 ? Z85_INVERSE[code] : -1;
      if (chiffre < 0) throw new Error('Z85 : caractere hors alphabet « ' + t[i + j] + ' »');
      valeur = valeur * 85 + chiffre;
    }
    if (valeur > 0xffffffff) throw new Error('Z85 : groupe hors des 32 bits');
    sortie[k++] = (valeur >>> 24) & 0xff;
    sortie[k++] = (valeur >>> 16) & 0xff;
    sortie[k++] = (valeur >>> 8) & 0xff;
    sortie[k++] = valeur & 0xff;
  }
  return sortie;
}

/* ------------------------------- uuencode --------------------------------- */
/* Un octet code vaut la valeur sur six bits plus 32. La valeur zero s ecrit
   traditionnellement « ` » plutot qu un espace, que les transports mangent. */
const uuCar = v => String.fromCharCode(v === 0 ? 96 : (v & 0x3f) + 32);
const uuVal = c => (c === '`' ? 0 : (c.charCodeAt(0) - 32) & 0x3f);

/** Encode des octets au format uuencode, en-tete et fin compris. */
export function uuencode(octets, nom = 'fichier', mode = '644') {
  const o = versOctets(octets);
  const lignes = ['begin ' + mode + ' ' + nom];
  for (let i = 0; i < o.length; i += 45) {
    const bloc = o.subarray(i, Math.min(i + 45, o.length));
    let ligne = uuCar(bloc.length);
    for (let j = 0; j < bloc.length; j += 3) {
      const a = bloc[j] || 0, b = bloc[j + 1] || 0, c = bloc[j + 2] || 0;
      ligne += uuCar(a >> 2);
      ligne += uuCar(((a << 4) | (b >> 4)) & 0x3f);
      ligne += uuCar(((b << 2) | (c >> 6)) & 0x3f);
      ligne += uuCar(c & 0x3f);
    }
    lignes.push(ligne);
  }
  lignes.push('`', 'end', '');
  return lignes.join('\n');
}

/** Decode un bloc uuencode. L en-tete `begin` est facultatif. */
export function uudecode(texte) {
  const lignes = String(texte == null ? '' : texte).split(/\r?\n/);
  const sortie = [];
  let commence = false;
  let nom = '';
  let mode = '';

  for (const ligne of lignes) {
    const debut = /^begin\s+(\d{3,4})\s+(.*)$/.exec(ligne.trim());
    if (debut) { commence = true; mode = debut[1]; nom = debut[2]; continue; }
    if (/^end\s*$/.test(ligne.trim())) break;
    if (!ligne.length) continue;
    const longueur = uuVal(ligne[0]);
    if (longueur === 0) continue;                 // ligne de fin
    if (!commence && !/^[\x20-\x60]+$/.test(ligne)) continue;
    let lus = 0;
    for (let i = 1; i + 3 < ligne.length + 4 && lus < longueur; i += 4) {
      const a = uuVal(ligne[i] || '`'), b = uuVal(ligne[i + 1] || '`');
      const c = uuVal(ligne[i + 2] || '`'), d = uuVal(ligne[i + 3] || '`');
      if (lus < longueur) { sortie.push(((a << 2) | (b >> 4)) & 0xff); lus++; }
      if (lus < longueur) { sortie.push(((b << 4) | (c >> 2)) & 0xff); lus++; }
      if (lus < longueur) { sortie.push(((c << 6) | d) & 0xff); lus++; }
    }
  }
  if (!sortie.length && !commence) throw new Error('aucun bloc uuencode reconnu');
  return { octets: new Uint8Array(sortie), nom, mode };
}

/* ------------------------------- Utilitaire ------------------------------- */
function versOctets(entree) {
  if (entree instanceof Uint8Array) return entree;
  return new TextEncoder().encode(String(entree == null ? '' : entree));
}
