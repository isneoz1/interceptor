/* Lecture structurelle du XML — SWIFT (by NeoZ)
 *
 * Un decoupage en balises et en textes, en une seule lecture, partage par les
 * lecteurs de messages XML (SAML, SOAP). Il ne valide pas le document et ne
 * resout pas les entites externes : il dit ou commence et finit chaque
 * element, quels attributs il porte, et sous quel prefixe d espace de noms.
 * Ecrit pour du XML venu du reseau, donc possiblement hostile : chaque
 * caractere n est lu qu une fois.
 */

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/* Un point de code hors d Unicode reste ecrit tel quel : il ne rend pas tout
   le message illisible. En une passe, pour que « &amp;#65; » redonne « &#65; ». */
const point = (brut, code) => (code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : brut);
export const desechapper = s => String(s).replace(/&(?:(amp|lt|gt|quot|apos)|#(\d{1,8})|#x([0-9a-fA-F]{1,8}));/g,
  (brut, nomme, dec, hex) => nomme ? ENTITES[nomme]
    : point(brut, dec !== undefined ? Number(dec) : parseInt(hex, 16)));

export const blanc = c => c === ' ' || c === '\n' || c === '\r' || c === '\t';

/* Attributs d une balise, lus caractere par caractere. Une expression
   reguliere pouvait revenir en arriere sur un long nom sans « = » : le temps
   croissait comme le carre de la longueur. */
export function lireAttributs(s) {
  const out = {};
  const n = s.length;
  let i = 0;
  while (i < n) {
    while (i < n && blanc(s[i])) i++;
    const debut = i;
    while (i < n && s[i] !== '=' && !blanc(s[i]) && s[i] !== '/') i++;
    const brut = s.slice(debut, i);
    while (i < n && blanc(s[i])) i++;
    if (s[i] !== '=') { if (i === debut) i++; continue; }
    i++;
    while (i < n && blanc(s[i])) i++;
    const guillemet = s[i];
    if (guillemet !== '"' && guillemet !== "'") continue;
    const fin = s.indexOf(guillemet, i + 1);
    if (fin < 0) break;
    const valeur = s.slice(i + 1, fin);
    i = fin + 1;
    if (!brut) continue;
    const nom = brut.includes(':') && !brut.startsWith('xmlns') ? brut.split(':').pop() : brut;
    out[nom] = desechapper(valeur);
  }
  return out;
}

/**
 * Decoupe le XML en textes et en balises, en une seule lecture.
 *
 * L ancienne expression reguliere relisait tout le reste du texte a chaque
 * « < » sans « > » : 110 Ko hostiles figeaient l onglet deux secondes et
 * demie, et le temps quadruplait a chaque doublement. Ici chaque caractere est
 * lu une fois, et un « > » ecrit dans une valeur d attribut entre guillemets —
 * que XML n oblige pas a echapper — ne coupe plus la balise.
 */
export function* morceauxXml(texte) {
  const n = texte.length;
  let i = 0;
  while (i < n) {
    const lt = texte.indexOf('<', i);
    if (lt < 0) { yield { texte: texte.slice(i) }; return; }
    if (lt > i) yield { texte: texte.slice(i, lt) };
    if (texte.startsWith('<!--', lt)) {
      const fin = texte.indexOf('-->', lt + 4);
      if (fin < 0) throw new Error('commentaire XML non ferme');
      i = fin + 3;
      continue;
    }
    if (texte.startsWith('<![CDATA[', lt)) {
      const fin = texte.indexOf(']]>', lt + 9);
      if (fin < 0) throw new Error('section CDATA non fermee');
      yield { texte: texte.slice(lt + 9, fin), brut: true };
      i = fin + 3;
      continue;
    }
    if (texte.startsWith('<?', lt)) {
      const fin = texte.indexOf('?>', lt + 2);
      if (fin < 0) throw new Error('instruction XML non fermee');
      i = fin + 2;
      continue;
    }
    if (texte.startsWith('<!', lt)) {
      const fin = texte.indexOf('>', lt + 2);
      if (fin < 0) throw new Error('declaration XML non fermee');
      i = fin + 1;
      continue;
    }
    let j = lt + 1;
    let guillemet = null;
    for (; j < n; j++) {
      const c = texte[j];
      if (guillemet) { if (c === guillemet) guillemet = null; }
      else if (c === '"' || c === "'") guillemet = c;
      else if (c === '>') break;
    }
    if (j >= n) throw new Error('balise XML non fermee');
    yield { balise: texte.slice(lt + 1, j) };
    i = j + 1;
  }
}

const NOM_XML = /^[A-Za-z_][\w.-]*$/;

/* « /saml:Issuer », « ds:Signature Id="x" / » : sens, nom local, attributs. */
export function lireBalise(balise) {
  const fermante = balise[0] === '/';
  let k = fermante ? 1 : 0;
  const debut = k;
  while (k < balise.length && !blanc(balise[k]) && balise[k] !== '/') k++;
  const qualifie = balise.slice(debut, k);
  const deux = qualifie.indexOf(':');
  const nom = deux < 0 ? qualifie : qualifie.slice(deux + 1);
  if (!NOM_XML.test(nom) || (deux >= 0 && !NOM_XML.test(qualifie.slice(0, deux)))) return null;
  const reste = balise.slice(k);
  const autofermante = !fermante && reste.trimEnd().endsWith('/');
  const prefixe = deux < 0 ? null : qualifie.slice(0, deux);
  return { fermante, nom, prefixe, attrs: autofermante ? reste.trimEnd().slice(0, -1) : reste, autofermante };
}
