/* Ce qu une image revele : ses metadonnees — SWIFT (by D4RK)
 *
 * Une photo publiee emporte souvent plus que ses pixels : la position GPS ou
 * elle a ete prise, le nom de son auteur, le numero de serie de l appareil, le
 * logiciel qui l a retouchee. Ce module les lit, sans rien executer ni rien
 * envoyer, dans les trois formats du web :
 *
 *   JPEG   segment APP1 « Exif » (TIFF : IFD0, IFD EXIF, IFD GPS), APP1 XMP,
 *          commentaires COM, dimensions (SOFn) ;
 *   PNG    tEXt, zTXt, iTXt (UTF-8, compresse ou non), eXIf (TIFF), et le
 *          XMP qu Adobe range dans iTXt « XML:com.adobe.xmp » ;
 *   WebP   conteneur RIFF etendu : VP8X (dimensions), EXIF (TIFF), XMP.
 *
 * References : TIFF 6.0 (structure IFD), Exif 2.32 (CIPA DC-008, etiquettes
 * EXIF et GPS), PNG (ISO/IEC 15948, W3C 3e edition : tEXt, zTXt, iTXt, eXIf),
 * « WebP Container Specification » (Google), XMP (ISO 16684-1). Un fichier
 * tronque ou incoherent est lu jusqu ou il se lit : jamais d exception.
 *
 * L onglet Reponse lit de lui-meme chaque image capturee, et une page peut en
 * servir une faite pour le bloquer. La lecture est donc bornee : une valeur
 * est gardee sur 4 096 caracteres (« […] » marque la coupure, et le nombre de
 * valeurs coupees est rendu), 200 champs au plus, le XMP est lu sur 1 Mo, une
 * decompression s arrete des qu elle a de quoi remplir sa valeur, et aucune
 * expression ne revient en arriere sur une donnee du fichier. Seules les
 * etiquettes dont on se sert sont lues.
 */

const TYPES_TIFF = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 6: 1, 7: 1, 8: 2, 9: 4, 10: 8, 11: 4, 12: 8 };
const MAX_ENTREES = 512;
export const TEXTE_MAX = 4096;
export const CHAMPS_MAX = 200;
const XMP_MAX = 1024 * 1024;
/* Chaque bloc est borne ; leur nombre aussi : un fichier peut en porter des
   milliers, et un bloc vide ne remplit aucun champ. */
const ERREURS_MAX = 20;
const DECOMPRESSIONS_MAX = 50;
const BLOCS_MAX = 16;

/* Les etiquettes nommees ; « sensible » : ce qu une personne ne pense pas
   forcement publier avec sa photo. */
const ETIQUETTES = {
  ifd: {
    0x010E: ['Description de l image'], 0x010F: ['Fabricant'], 0x0110: ['Modele'], 0x0112: ['Orientation'],
    0x0131: ['Logiciel'], 0x0132: ['Date de modification'], 0x013B: ['Auteur', true], 0x8298: ['Droits']
  },
  exif: {
    0x9003: ['Date de prise de vue'], 0x9004: ['Date de numerisation'], 0x9010: ['Fuseau de la date de modification'],
    0x9011: ['Fuseau de la prise de vue'], 0x829A: ['Temps de pose'], 0x829D: ['Ouverture'], 0x8827: ['Sensibilite ISO'],
    0x920A: ['Focale'], 0x9286: ['Commentaire', true], 0xA420: ['Identifiant unique de l image', true],
    0xA430: ['Proprietaire de l appareil', true], 0xA431: ['Numero de serie du boitier', true],
    0xA433: ['Fabricant de l objectif'], 0xA434: ['Modele de l objectif'], 0xA435: ['Numero de serie de l objectif', true]
  },
  gps: { 0x0007: ['Heure GPS (UTC)', true], 0x001D: ['Date GPS', true], 0x0012: ['Referentiel GPS'] }
};

/* Borne toujours a la longueur reelle : une fin trop grande ne lit pas au-dela. */
const texteLatin = (o, debut, fin) => {
  let s = '';
  for (let i = Math.max(0, debut), n = Math.min(fin, o.length); i < n; i++) s += String.fromCharCode(o[i]);
  return s;
};
const texteUtf8 = (o, debut, fin) => new TextDecoder('utf-8', { fatal: false }).decode(o.subarray(debut, Math.min(fin, o.length)));

/* Les octets nuls de fin retires en un passage : /\0+$/ revenait en arriere a
   chaque position d une longue suite de nuls suivie d autre chose. */
function sansNulFinal(s) {
  let fin = s.length;
  while (fin > 0 && s.charCodeAt(fin - 1) === 0) fin--;
  return s.slice(0, fin);
}

/* Les balises retirees, comme /<[^>]+>/g, mais en un passage. */
function sansBalises(s) {
  let sortie = '';
  for (let i = 0; i < s.length;) {
    const ouvre = s.indexOf('<', i);
    if (ouvre < 0) return sortie + s.slice(i);
    const ferme = s.indexOf('>', ouvre + 1);
    if (ferme < 0) return sortie + s.slice(i);
    sortie += s.slice(i, ouvre) + (ferme === ouvre + 1 ? '<>' : '');
    i = ferme + 1;
  }
  return sortie;
}

/** Un message d erreur ; au-dela de 20, il est compte, pas garde. */
function erreur(lu, message) {
  if (lu.erreurs.length >= ERREURS_MAX) { lu.erreursIgnorees++; return; }
  lu.erreurs.push(message);
}

/** Un champ, sa valeur bornee ; au-dela de 200, il est compte, pas garde. */
function ajouter(lu, groupe, nom, valeur, sensible) {
  if (valeur == null || valeur === '') return;
  if (lu.champs.length >= CHAMPS_MAX) { lu.champsIgnores++; return; }
  const texte = String(valeur);
  const coupe = texte.length > TEXTE_MAX;
  if (coupe) lu.coupees++;
  lu.champs.push({ groupe, nom, valeur: coupe ? texte.slice(0, TEXTE_MAX) + ' […]' : texte, sensible: !!sensible });
}

/* --------------------------------- TIFF ----------------------------------- */
/** Lit un bloc TIFF (celui d EXIF) entre debut et fin ; ajoute ce qu il trouve a `lu`. */
function lireTiff(o, debut, fin, lu) {
  if (++lu.blocsExif > BLOCS_MAX) {
    if (lu.blocsExif === BLOCS_MAX + 1) erreur(lu, 'plus de 16 blocs EXIF : les suivants ne sont pas lus');
    return;
  }
  if (fin - debut < 8) { erreur(lu, 'bloc EXIF trop court'); return; }
  const ordre = texteLatin(o, debut, debut + 2);
  if (ordre !== 'II' && ordre !== 'MM') { erreur(lu, 'bloc EXIF sans ordre d octets'); return; }
  const le = ordre === 'II';
  const v = new DataView(o.buffer, o.byteOffset + debut, fin - debut);
  const n = v.byteLength;
  const u16 = p => v.getUint16(p, le), u32 = p => v.getUint32(p, le);
  if (u16(2) !== 42) { erreur(lu, 'bloc EXIF sans la signature 42'); return; }

  /* Une entree d IFD : son type, son nombre de valeurs et ou elles sont. La
     valeur n est lue que pour les etiquettes dont on se sert. */
  const visites = new Set();
  function lireIfd(position) {
    if (!position || position + 2 > n || visites.has(position)) return {};
    visites.add(position);
    const entrees = Math.min(u16(position), MAX_ENTREES);
    const sortie = {};
    for (let i = 0; i < entrees; i++) {
      const e = position + 2 + i * 12;
      if (e + 12 > n) { erreur(lu, 'IFD tronque'); break; }
      const type = u16(e + 2), compte = u32(e + 4);
      if (!TYPES_TIFF[type]) continue;
      const taille = TYPES_TIFF[type] * compte;
      const p = taille <= 4 ? e + 8 : u32(e + 8);
      if (p + Math.min(taille, 4) > n) continue;
      sortie[u16(e)] = { type, compte, p };
      lu.etiquettes++;
    }
    return sortie;
  }
  /* Un texte ASCII (type 2), lu sur 4 096 caracteres et un de plus : assez
     pour savoir qu il est plus long. Les nuls de fin sont du remplissage. */
  const texte = ({ compte, p }) => {
    let s = '';
    for (let i = 0, lus = Math.min(compte, TEXTE_MAX + 1, n - p); i < lus; i++) s += String.fromCharCode(v.getUint8(p + i));
    return sansNulFinal(s);
  };
  /* Des nombres : 64 au plus. */
  const nombres = ({ type, compte, p }) => {
    const lus = [];
    for (let i = 0; i < Math.min(compte, 64); i++) {
      const q = p + i * TYPES_TIFF[type];
      if (q + TYPES_TIFF[type] > n) break;
      if (type === 1 || type === 7 || type === 6 || type === 2) lus.push(type === 6 ? v.getInt8(q) : v.getUint8(q));
      else if (type === 3) lus.push(u16(q));
      else if (type === 8) lus.push(v.getInt16(q, le));
      else if (type === 4) lus.push(u32(q));
      else if (type === 9) lus.push(v.getInt32(q, le));
      else if (type === 5) lus.push(u32(q + 4) ? u32(q) / u32(q + 4) : NaN);
      else if (type === 10) lus.push(v.getInt32(q + 4, le) ? v.getInt32(q, le) / v.getInt32(q + 4, le) : NaN);
      else if (type === 11) lus.push(v.getFloat32(q, le));
      else if (type === 12) lus.push(v.getFloat64(q, le));
    }
    return lus;
  };
  const pointeur = (ifd, etiquette) => (ifd[etiquette] && ifd[etiquette].type !== 2 ? nombres(ifd[etiquette])[0] || 0 : 0);
  const ifd0 = lireIfd(u32(4));
  const exif = lireIfd(pointeur(ifd0, 0x8769));
  const gps = lireIfd(pointeur(ifd0, 0x8825));

  /* La valeur d une etiquette, telle qu on l affiche ; '' quand elle ne dit rien. */
  const interpreter = (genre, id, e) => {
    if (genre === 'exif' && id === 0x9286) {
      /* UNDEFINED : huit octets de jeu de caracteres, puis le texte, de quatre
         octets par caractere au plus : la limite se voit dans `ajouter`, jamais
         dans un caractere coupe en deux. */
      const octetsLus = Math.min(e.compte, n - e.p, 8 + (TEXTE_MAX + 1) * 4);
      return commentaireExif(o, debut + e.p, debut + e.p + octetsLus, le);
    }
    if (e.type === 2) return texte(e);
    const lus = nombres(e);
    if (!lus.length || lus.some(x => !Number.isFinite(x))) return '';
    if (genre === 'gps' && id === 0x0007 && lus.length === 3) {
      return lus.map((x, i) => (i === 2 ? x.toFixed(2).replace(/\.?0+$/, '') : String(Math.round(x)))).map(x => x.padStart(2, '0')).join(':');
    }
    return lus.map(x => (Number.isInteger(x) ? String(x) : String(+x.toFixed(6)))).join(' ');
  };

  /* Les etiquettes EXIF se cherchent dans les deux IFD : leurs numeros sont
     uniques, et des ecrivains plus anciens que la norme qui les definit —
     GDI+ pour BodySerialNumber (0xA431, Exif 2.3) — les rangent dans l IFD0.
     Une etiquette mal formee ne prive pas les autres de lecture. */
  const principal = { ...exif, ...ifd0 };
  for (const [genre, ifd] of [['ifd', principal], ['exif', principal], ['gps', gps]]) {
    for (const [id, [nom, sensible]] of Object.entries(ETIQUETTES[genre])) {
      if (!ifd[id]) continue;
      try { ajouter(lu, genre === 'gps' ? 'GPS' : 'EXIF', nom, interpreter(genre, Number(id), ifd[id]), sensible); }
      catch { erreur(lu, 'etiquette ' + Number(id).toString(16).toUpperCase().padStart(4, '0') + ' illisible'); }
    }
  }
  const coordonnee = (entree, refEntree) => {
    if (!entree || entree.type === 2) return null;
    const valeurs = nombres(entree);
    if (valeurs.length < 3 || valeurs.some(x => !Number.isFinite(x))) return null;
    const d = valeurs[0] + valeurs[1] / 60 + valeurs[2] / 3600;
    const ref = refEntree && refEntree.type === 2 ? texte(refEntree) : '';
    return /^[SW]/i.test(ref) ? -d : d;
  };
  const latitude = coordonnee(gps[2], gps[1]);
  const longitude = coordonnee(gps[4], gps[3]);
  if (latitude != null && longitude != null) {
    const alt = gps[6] && gps[6].type !== 2 ? nombres(gps[6])[0] : null;
    const sousLeNiveau = gps[5] && gps[5].type !== 2 && nombres(gps[5])[0] === 1;
    lu.gps = { latitude, longitude, altitude: Number.isFinite(alt) ? (sousLeNiveau ? -alt : alt) : null };
  }
}

/* Le commentaire EXIF (UserComment) commence par huit octets qui nomment son
   jeu de caracteres ; UNICODE suit l ordre des octets du fichier. */
function commentaireExif(o, debut, fin, le) {
  const jeu = sansNulFinal(texteLatin(o, debut, Math.min(debut + 8, fin)));
  const corps = o.subarray(Math.min(debut + 8, fin), fin);
  const texte = jeu === 'UNICODE' ? new TextDecoder(le ? 'utf-16le' : 'utf-16be').decode(corps) : texteUtf8(corps, 0, corps.length);
  return sansNulFinal(texte).trim();
}

/* ---------------------------------- XMP ----------------------------------- */
const CHAMPS_XMP = [
  ['xmp:CreatorTool', 'Logiciel createur (XMP)'], ['dc:creator', 'Createur (XMP)', true],
  ['photoshop:City', 'Ville (XMP)', true], ['photoshop:State', 'Region (XMP)', true],
  ['photoshop:Country', 'Pays (XMP)', true], ['dc:rights', 'Droits (XMP)'],
  ['xmpMM:DocumentID', 'Identifiant du document (XMP)', true], ['xmp:CreateDate', 'Date de creation (XMP)']
];
/* « 48,51.4933N » ou « 48,51,29.6N » : la forme GPSCoordinate de XMP. */
function coordonneeXmp(texte) {
  const m = /^\s*(\d+),(\d+(?:\.\d+)?)(?:,(\d+(?:\.\d+)?))?([NSEW])\s*$/i.exec(String(texte || '').slice(0, 100));
  if (!m) return null;
  const d = Number(m[1]) + Number(m[2]) / 60 + (m[3] ? Number(m[3]) / 3600 : 0);
  return /[SW]/i.test(m[4]) ? -d : d;
}
/* Une valeur XMP, en attribut (« nom="…" ») ou en element (« <nom>…</nom> »,
   le premier rdf:li d une liste) : cherchee par indexOf, sans expression qui
   reviendrait en arriere sur un paquet de balises jamais fermees. */
function valeurXmp(xmp, nom) {
  const attribut = xmp.indexOf(nom + '="');
  if (attribut >= 0) {
    const debut = attribut + nom.length + 2;
    const fin = xmp.indexOf('"', debut);
    if (fin >= 0) return xmp.slice(debut, fin);
  }
  const ouvrante = '<' + nom + '>';
  const element = xmp.indexOf(ouvrante);
  if (element < 0) return null;
  const finElement = xmp.indexOf('</' + nom + '>', element + ouvrante.length);
  if (finElement < 0) return null;
  let contenu = xmp.slice(element + ouvrante.length, finElement);
  const li = contenu.indexOf('<rdf:li');
  const finBalise = li < 0 ? -1 : contenu.indexOf('>', li);
  const finLi = finBalise < 0 ? -1 : contenu.indexOf('</rdf:li>', finBalise + 1);
  if (finLi >= 0) contenu = contenu.slice(finBalise + 1, finLi);
  return sansBalises(contenu).trim();
}
/* `octets` : la taille du paquet dans le fichier. La limite se mesure en
   octets : 1,2 Mo de « é » font 600 000 caracteres. */
function lireXmp(texte, lu, octets = texte.length) {
  if (++lu.blocsXmp > BLOCS_MAX) {
    if (lu.blocsXmp === BLOCS_MAX + 1) erreur(lu, 'plus de 16 paquets XMP : les suivants ne sont pas lus');
    return;
  }
  if (octets > XMP_MAX) erreur(lu, 'paquet XMP de plus de 1 Mo : seul le premier Mo est lu');
  const xmp = texte.length > XMP_MAX ? texte.slice(0, XMP_MAX) : texte;
  lu.xmp = xmp.length > 20000 ? xmp.slice(0, 20000) : xmp;
  for (const [nom, libelle, sensible] of CHAMPS_XMP) ajouter(lu, 'XMP', libelle, valeurXmp(xmp, nom), sensible);
  const latitude = coordonneeXmp(valeurXmp(xmp, 'exif:GPSLatitude'));
  const longitude = coordonneeXmp(valeurXmp(xmp, 'exif:GPSLongitude'));
  if (latitude != null && longitude != null) lu.gpsXmp = { latitude, longitude };
}

/* --------------------------------- Formats -------------------------------- */
const u16be = (o, p) => (o[p] << 8) | o[p + 1];
const u32be = (o, p) => ((o[p] << 24) | (o[p + 1] << 16) | (o[p + 2] << 8) | o[p + 3]) >>> 0;
const u32le = (o, p) => (o[p] | (o[p + 1] << 8) | (o[p + 2] << 16) | (o[p + 3] << 24)) >>> 0;
const commence = (o, p, texte) => texteLatin(o, p, Math.min(o.length, p + texte.length)) === texte;

function lireJpeg(o, lu) {
  lu.format = 'JPEG';
  let p = 2;
  while (p + 4 <= o.length) {
    if (o[p] !== 0xff) { erreur(lu, 'marqueur JPEG attendu a l octet ' + p); return; }
    const m = o[p + 1];
    if (m === 0xff) { p++; continue; }                     // octet de remplissage
    if (m === 0xd8 || m === 0x01 || (m >= 0xd0 && m <= 0xd7)) { p += 2; continue; }
    if (m === 0xd9 || m === 0xda) return;                  // fin, ou debut des donnees
    const longueur = u16be(o, p + 2);
    const debut = p + 4, fin = Math.min(o.length, p + 2 + longueur);
    if (longueur < 2) { erreur(lu, 'segment JPEG de longueur invalide'); return; }
    if (m === 0xe1 && commence(o, debut, 'Exif\0\0')) lireTiff(o, debut + 6, fin, lu);
    else if (m === 0xe1 && commence(o, debut, 'http://ns.adobe.com/xap/1.0/\0')) lireXmp(texteUtf8(o, debut + 29, fin), lu);
    else if (m === 0xfe) {
      if (lu.champs.length >= CHAMPS_MAX) lu.champsIgnores++;
      else ajouter(lu, 'JPEG', 'Commentaire', sansNulFinal(texteUtf8(o, debut, Math.min(fin, debut + (TEXTE_MAX + 1) * 4))), true);
    }
    else if (m === 0xed && commence(o, debut, 'Photoshop 3.0')) ajouter(lu, 'JPEG', 'Bloc IPTC (Photoshop)', (fin - debut) + ' o', false);
    else if (((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) && debut + 5 <= fin) {
      lu.hauteur = u16be(o, debut + 1); lu.largeur = u16be(o, debut + 3);
    }
    p += 2 + longueur;
  }
}

/* Une decompression bornee : l entree passe par tranches de 1 Ko, et la
   lecture s arrete des que la sortie depasse `max` — une bombe de quelques
   Ko qui en promet des centaines de Mo ne les produit jamais. */
async function decompresser(octets, max) {
  const TRANCHE = 1024;
  let position = 0;
  const entree = new ReadableStream({
    pull(controleur) {
      if (position >= octets.length) { controleur.close(); return; }
      controleur.enqueue(octets.slice(position, position + TRANCHE));
      position += TRANCHE;
    }
  }, { highWaterMark: 0 });
  const lecteur = entree.pipeThrough(new DecompressionStream('deflate')).getReader();
  const morceaux = [];
  let total = 0, coupe = false;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    if (total + value.length > max) { morceaux.push(value.subarray(0, max - total)); total = max; coupe = true; break; }
    morceaux.push(value);
    total += value.length;
  }
  if (coupe) await lecteur.cancel().catch(() => {});
  const sortie = new Uint8Array(total);
  let p = 0;
  for (const m of morceaux) { sortie.set(m, p); p += m.length; }
  return sortie;
}

async function lirePng(o, lu) {
  lu.format = 'PNG';
  let decompressions = 0;
  /* Le premier octet nul du bloc, cherche dans le bloc seul. */
  const nulDans = (de, fin) => { const i = o.subarray(de, fin).indexOf(0); return i < 0 ? -1 : de + i; };
  for (let p = 8; p + 12 <= o.length;) {
    const lg = u32be(o, p);
    const type = texteLatin(o, p + 4, p + 8);
    const debut = p + 8, fin = debut + lg;
    if (fin > o.length) { erreur(lu, 'bloc PNG ' + type + ' tronque'); return; }
    if (type === 'IHDR' && lg >= 8) { lu.largeur = u32be(o, debut); lu.hauteur = u32be(o, debut + 4); }
    else if (type === 'tEXt' || type === 'zTXt' || type === 'iTXt') {
      const nul = nulDans(debut, fin);
      if (nul < 0) { erreur(lu, 'bloc ' + type + ' sans mot-cle'); p = fin + 4; continue; }
      const cle = texteLatin(o, debut, Math.min(nul, debut + 79));
      /* Le XMP se lit sur 1 Mo ; un texte, sur ce qu il faut pour 4 096 caracteres. */
      const borne = cle === 'XML:com.adobe.xmp' ? XMP_MAX + 1 : (TEXTE_MAX + 1) * 4;
      let octetsLus = 0;
      const compresse = type === 'zTXt' || (type === 'iTXt' && o[nul + 1] === 1);
      if (compresse && ++decompressions > DECOMPRESSIONS_MAX) {
        if (decompressions === DECOMPRESSIONS_MAX + 1) erreur(lu, 'plus de 50 blocs compresses : les suivants ne sont pas lus');
        p = fin + 4;
        continue;
      }
      let texte = null;
      try {
        if (type === 'tEXt') {
          octetsLus = fin - (nul + 1);
          texte = texteLatin(o, nul + 1, Math.min(fin, nul + 1 + borne));
        } else if (type === 'zTXt') {
          const brut = await decompresser(o.subarray(nul + 2, fin), borne);
          octetsLus = brut.length;
          texte = texteLatin(brut, 0, brut.length);
        } else {
          const finLangue = nulDans(nul + 3, fin);
          const finTraduit = finLangue < 0 ? -1 : nulDans(finLangue + 1, fin);
          if (finTraduit < 0) throw new Error('iTXt incomplet');
          const corps = o.subarray(finTraduit + 1, fin);
          const brut = compresse ? await decompresser(corps, borne) : corps.subarray(0, borne);
          octetsLus = brut.length;
          texte = texteUtf8(brut, 0, brut.length);
        }
      } catch { erreur(lu, 'bloc ' + type + ' « ' + cle + ' » illisible'); }
      if (texte != null) {
        if (cle === 'XML:com.adobe.xmp') lireXmp(texte, lu, octetsLus);
        else ajouter(lu, 'PNG', cle + ' (PNG)', texte, /author|comment|description|copyright|source|location/i.test(cle));
      }
    } else if (type === 'eXIf') lireTiff(o, debut, fin, lu);
    else if (type === 'IEND') return;
    p = fin + 4;
  }
}

function lireWebp(o, lu) {
  lu.format = 'WebP';
  for (let p = 12; p + 8 <= o.length;) {
    const type = texteLatin(o, p, p + 4);
    const lg = u32le(o, p + 4);
    const debut = p + 8, fin = Math.min(o.length, debut + lg);
    if (type === 'VP8X' && lg >= 10) {
      lu.largeur = (o[debut + 4] | (o[debut + 5] << 8) | (o[debut + 6] << 16)) + 1;
      lu.hauteur = (o[debut + 7] | (o[debut + 8] << 8) | (o[debut + 9] << 16)) + 1;
    } else if (type === 'EXIF') {
      /* Des encodeurs y laissent le prefixe « Exif\0\0 » des JPEG. */
      lireTiff(o, commence(o, debut, 'Exif\0\0') ? debut + 6 : debut, fin, lu);
    } else if (type === 'XMP ') lireXmp(texteUtf8(o, debut, Math.min(fin, debut + XMP_MAX + 1)), lu, fin - debut);
    if (debut + lg > o.length) { erreur(lu, 'bloc WebP ' + type + ' tronque'); return; }
    p = debut + lg + (lg % 2);
  }
}

/**
 * Les metadonnees d une image : { format, largeur, hauteur, champs, gps,
 * gpsXmp, xmp, etiquettes, coupees, champsIgnores, erreurs }. Format
 * inconnu : format null.
 */
export async function lireMetadonnees(octets) {
  const o = octets instanceof Uint8Array ? octets : new Uint8Array(octets || []);
  const lu = { format: null, largeur: null, hauteur: null, champs: [], gps: null, gpsXmp: null, xmp: null,
    etiquettes: 0, coupees: 0, champsIgnores: 0, erreurs: [], erreursIgnorees: 0, blocsExif: 0, blocsXmp: 0 };
  try {
    if (o.length >= 3 && o[0] === 0xff && o[1] === 0xd8 && o[2] === 0xff) lireJpeg(o, lu);
    else if (o.length >= 8 && commence(o, 0, '\x89PNG\r\n\x1a\n')) await lirePng(o, lu);
    else if (o.length >= 12 && commence(o, 0, 'RIFF') && commence(o, 8, 'WEBP')) lireWebp(o, lu);
  } catch (e) {
    erreur(lu, 'lecture interrompue : ' + String(e && e.message || e));
  }
  return lu;
}

const arrondi = x => String(+x.toFixed(6));

/** Ce que l image revele, en phrases (gabarits a traduire : [cle, valeurs]). */
export function revelationsBrutes(lu) {
  const dit = [];
  const position = lu.gps || lu.gpsXmp;
  if (position) {
    dit.push(position.altitude != null
      ? ['La position ou la photo a ete prise : {lat}, {lon}, a {alt} m d altitude.', { lat: arrondi(position.latitude), lon: arrondi(position.longitude), alt: arrondi(position.altitude) }]
      : ['La position ou la photo a ete prise : {lat}, {lon}.', { lat: arrondi(position.latitude), lon: arrondi(position.longitude) }]);
  }
  for (const c of lu.champs.filter(x => x.sensible && x.groupe !== 'GPS')) dit.push(['{nom} : {valeur}', { nom: c.nom, valeur: c.valeur }]);
  return dit;
}

/** Les memes phrases, en francais (la console les traduit avec tp). */
export function revelations(lu) {
  return revelationsBrutes(lu).map(([cle, valeurs]) => Object.entries(valeurs).reduce((s, [k, v]) => s.split('{' + k + '}').join(v), cle));
}
