/* Encodages propres au web — INTERCEPTOR (by NeoZ)
 *
 * Punycode et noms de domaine internationaux, URI de donnees, authentification
 * « Basic », corps de formulaire, transfert par morceaux, compression gzip et
 * deflate. Fonctions pures ou asynchrones, sans DOM ni API d extension.
 */
import {
  texteVersOctets, octetsVersTexte, octetsVersBase64, base64VersOctets, hexVersOctets
} from './bytes.js';

/* -------------------------------- Punycode -------------------------------- */
/* RFC 3492 : la mecanique qui transforme « pere-noel » en « xn--pere-nol-9za ».
   Elle sert ici a lire les domaines trompeurs, ceux qui ressemblent a un site
   connu sans en etre un. */
const BASE = 36, TMIN = 1, TMAX = 26, BIAIS = 72, N0 = 128, SKEW = 38, DAMP = 700;

function adapter(delta, points, premiere) {
  let d = premiere ? Math.floor(delta / DAMP) : Math.floor(delta / 2);
  d += Math.floor(d / points);
  let k = 0;
  while (d > Math.floor(((BASE - TMIN) * TMAX) / 2)) { d = Math.floor(d / (BASE - TMIN)); k += BASE; }
  return k + Math.floor(((BASE - TMIN + 1) * d) / (d + SKEW));
}

const chiffreVersCode = d => d + 22 + (d < 26 ? 75 : 0);       // 0..25 -> a..z, 26..35 -> 0..9
function codeVersChiffre(code) {
  if (code >= 0x30 && code <= 0x39) return code - 0x30 + 26;
  if (code >= 0x41 && code <= 0x5a) return code - 0x41;
  if (code >= 0x61 && code <= 0x7a) return code - 0x61;
  throw new Error('caractere invalide dans le punycode');
}

export function punycodeEncoder(texte) {
  const points = [...String(texte)].map(c => c.codePointAt(0));
  const base = points.filter(c => c < N0);
  let sortie = base.map(c => String.fromCodePoint(c)).join('');
  let traites = base.length;
  const total = points.length;
  if (traites) sortie += '-';
  let n = N0, delta = 0, biais = BIAIS;
  while (traites < total) {
    let m = Infinity;
    for (const c of points) if (c >= n && c < m) m = c;
    delta += (m - n) * (traites + 1);
    n = m;
    for (const c of points) {
      if (c < n) delta++;
      else if (c === n) {
        let q = delta;
        for (let k = BASE; ; k += BASE) {
          const t = k <= biais ? TMIN : k >= biais + TMAX ? TMAX : k - biais;
          if (q < t) break;
          sortie += String.fromCharCode(chiffreVersCode(t + ((q - t) % (BASE - t))));
          q = Math.floor((q - t) / (BASE - t));
        }
        sortie += String.fromCharCode(chiffreVersCode(q));
        biais = adapter(delta, traites + 1, traites === base.length);
        delta = 0;
        traites++;
      }
    }
    delta++;
    n++;
  }
  return sortie;
}

export function punycodeDecoder(texte) {
  const entree = String(texte);
  const coupure = entree.lastIndexOf('-');
  const sortie = coupure > 0 ? [...entree.slice(0, coupure)].map(c => c.codePointAt(0)) : [];
  let i = 0, n = N0, biais = BIAIS;
  const suite = coupure > 0 ? entree.slice(coupure + 1) : entree;
  let pos = 0;
  while (pos < suite.length) {
    const ancien = i;
    for (let poids = 1, k = BASE; ; k += BASE) {
      if (pos >= suite.length) throw new Error('punycode incomplet');
      const chiffre = codeVersChiffre(suite.charCodeAt(pos++));
      i += chiffre * poids;
      const t = k <= biais ? TMIN : k >= biais + TMAX ? TMAX : k - biais;
      if (chiffre < t) break;
      poids *= BASE - t;
    }
    biais = adapter(i - ancien, sortie.length + 1, ancien === 0);
    n += Math.floor(i / (sortie.length + 1));
    i %= sortie.length + 1;
    sortie.splice(i, 0, n);
    i++;
  }
  return sortie.map(c => String.fromCodePoint(c)).join('');
}

/** Nom de domaine international -> forme ASCII (xn--), etiquette par etiquette. */
export function domaineVersAscii(domaine) {
  return String(domaine).split('.').map(etiquette => {
    if (!etiquette || [...etiquette].every(c => c.codePointAt(0) < N0)) return etiquette;
    return 'xn--' + punycodeEncoder(etiquette);
  }).join('.');
}

/** Forme ASCII -> nom de domaine lisible. */
export function domaineVersUnicode(domaine) {
  return String(domaine).split('.').map(etiquette => {
    if (!/^xn--/i.test(etiquette)) return etiquette;
    return punycodeDecoder(etiquette.slice(4));
  }).join('.');
}

/* ------------------------------ URI de donnees ---------------------------- */
export function dataUriEncoder(texte, type = 'text/plain;charset=utf-8') {
  return 'data:' + type + ';base64,' + octetsVersBase64(texteVersOctets(texte));
}

/** Lit une URI de donnees et rend son contenu, avec le type declare en tete. */
export function dataUriDecoder(texte) {
  const brut = String(texte).trim();
  const m = brut.match(/^data:([^,]*),([\s\S]*)$/i);
  if (!m) throw new Error('ce texte n est pas une URI de donnees');
  const entete = m[1];
  const base64 = /;base64/i.test(entete);
  const contenu = base64
    ? octetsVersTexte(base64VersOctets(m[2]))
    : decodeURIComponent(m[2]);
  const type = entete.replace(/;base64/i, '') || 'text/plain';
  return '# type declare : ' + type + (base64 ? ' (base64)' : ' (pourcent)') + '\n' + contenu;
}

/* -------------------------- Authentification Basic ------------------------ */
export function basicEncoder(texte) {
  const brut = String(texte).trim();
  if (!brut.includes(':')) throw new Error('attendu : identifiant:motdepasse');
  return 'Basic ' + octetsVersBase64(texteVersOctets(brut));
}

export function basicDecoder(texte) {
  const brut = String(texte).trim().replace(/^Basic\s+/i, '');
  const clair = octetsVersTexte(base64VersOctets(brut));
  const i = clair.indexOf(':');
  if (i < 0) return clair;
  return 'identifiant : ' + clair.slice(0, i) + '\nmot de passe : ' + clair.slice(i + 1);
}

/* --------------------------- Corps de formulaire -------------------------- */
export function formVersJson(texte) {
  const params = new URLSearchParams(String(texte).trim().replace(/^[?&]+/, ''));
  const objet = {};
  for (const [cle, valeur] of params.entries()) {
    if (objet[cle] === undefined) objet[cle] = valeur;
    else if (Array.isArray(objet[cle])) objet[cle].push(valeur);
    else objet[cle] = [objet[cle], valeur];
  }
  return JSON.stringify(objet, null, 2);
}

export function jsonVersForm(texte) {
  const valeur = JSON.parse(String(texte));
  if (!valeur || typeof valeur !== 'object') throw new Error('objet JSON attendu');
  const params = new URLSearchParams();
  for (const [cle, v] of Object.entries(valeur)) {
    if (Array.isArray(v)) for (const x of v) params.append(cle, String(x));
    else params.append(cle, v === null ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  return params.toString();
}

/** Entetes bruts « Nom: valeur » -> objet JSON, et l inverse. */
export function entetesVersJson(texte) {
  const objet = {};
  for (const ligne of String(texte).split(/\r?\n/)) {
    const net = ligne.trim();
    if (!net) continue;
    const i = net.indexOf(':');
    if (i < 0) continue;
    objet[net.slice(0, i).trim()] = net.slice(i + 1).trim();
  }
  return JSON.stringify(objet, null, 2);
}

export function jsonVersEntetes(texte) {
  const valeur = JSON.parse(String(texte));
  return Object.entries(valeur).map(([k, v]) => k + ': ' + String(v)).join('\n');
}

export function cookiesVersJson(texte) {
  const objet = {};
  for (const morceau of String(texte).split(';')) {
    const net = morceau.trim();
    if (!net) continue;
    const i = net.indexOf('=');
    objet[i < 0 ? net : net.slice(0, i).trim()] = i < 0 ? '' : net.slice(i + 1).trim();
  }
  return JSON.stringify(objet, null, 2);
}

export function jsonVersCookies(texte) {
  const valeur = JSON.parse(String(texte));
  return Object.entries(valeur).map(([k, v]) => k + '=' + String(v)).join('; ');
}

/* -------------------------- Transfert par morceaux ------------------------ */
/**
 * Recompose un corps « Transfer-Encoding: chunked » : chaque morceau annonce sa
 * taille en hexadecimal, un morceau de taille nulle termine le corps.
 */
export function chunkedDecoder(texte) {
  const s = String(texte).replace(/\r\n/g, '\n');
  let pos = 0, out = '';
  while (pos < s.length) {
    const finLigne = s.indexOf('\n', pos);
    if (finLigne < 0) break;
    const entete = s.slice(pos, finLigne).trim().split(';')[0];
    if (!entete) { pos = finLigne + 1; continue; }
    if (!/^[0-9a-fA-F]+$/.test(entete)) throw new Error('taille de morceau illisible : ' + entete);
    const taille = parseInt(entete, 16);
    pos = finLigne + 1;
    if (taille === 0) break;
    out += s.slice(pos, pos + taille);
    pos += taille + 1;
  }
  return out;
}

/* -------------------------------- Compression ----------------------------- */
/* gzip et deflate passent par les flux natifs du navigateur : aucun code de
   compression n est reimplemente ici, donc aucun risque de resultat approximatif.
   Ces fonctions sont asynchrones, contrairement au reste du fichier. */
const fluxDisponibles = () =>
  typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

async function passerParFlux(octets, flux) {
  if (!fluxDisponibles()) throw new Error('compression native indisponible dans ce contexte');
  const ecrivain = flux.writable.getWriter();
  ecrivain.write(octets);
  ecrivain.close();
  const morceaux = [];
  const lecteur = flux.readable.getReader();
  for (;;) {
    const { value, done } = await lecteur.read();
    if (done) break;
    morceaux.push(value);
  }
  let total = 0;
  for (const m of morceaux) total += m.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) { out.set(m, pos); pos += m.length; }
  return out;
}

export async function compresser(texte, format = 'gzip') {
  const out = await passerParFlux(texteVersOctets(texte), new CompressionStream(format));
  return octetsVersBase64(out);
}

export async function decompresser(texte, format = 'gzip') {
  const brut = String(texte).trim();
  // Un corps compresse arrive colle soit en base64, soit en hexadecimal : on
  // reconnait l hexadecimal a son alphabet et a sa longueur paire, tout le
  // reste passe par le base64.
  const sansEspace = brut.replace(/[\s]+/g, '');
  const octets = /^[0-9a-fA-F]+$/.test(sansEspace) && sansEspace.length % 2 === 0
    ? hexVersOctets(sansEspace)
    : base64VersOctets(brut);
  const out = await passerParFlux(octets, new DecompressionStream(format));
  return octetsVersTexte(out);
}
