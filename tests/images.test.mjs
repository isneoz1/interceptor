/* Ce qu une image revele — SWIFT (by D4RK)
 *
 *   node tests/images.test.mjs
 *
 * Les metadonnees d une image publiee sur le web : la position GPS ou la
 * photo a ete prise, l auteur, le numero de serie de l appareil, le logiciel.
 * Ce que la 5.9 lit, contre des fichiers que d autres ont ecrits ou valides
 * (tests/vecteurs-images.json) :
 *
 *   1. Un JPEG dont les etiquettes EXIF ont ete ecrites PAR GDI+ (Windows),
 *      et les valeurs attendues sont celles que GDI+ relit : texte, dates,
 *      numero de serie, et la position GPS en degres, minutes, secondes.
 *   2. Le meme JPEG avec un bloc XMP ; un PNG (tEXt, iTXt en UTF-8, zTXt et
 *      XMP compresses, eXIf) que GDI+ recharge et dont il lit lui-meme deux
 *      textes ; un WebP encode par Chrome, blocs EXIF et XMP ajoutes, que
 *      Chrome decode.
 *   3. Ce que l image revele, dit en clair ; une image sans metadonnees ne
 *      revele rien.
 *   4. Robustesse : un fichier tronque a chaque octet, des octets au hasard,
 *      un IFD qui pointe sur lui-meme — jamais d exception, jamais de boucle.
 *   5. L outil de la boite et le bloc de l onglet Reponse, dans les deux langues.
 */
import fs from 'node:fs';
import { installerTout, egal, proche, verifier, bilan, dejaAnglais } from './harnais.mjs';

installerTout();
const V = JSON.parse(fs.readFileSync(new URL('./vecteurs-images.json', import.meta.url), 'utf8'));
const { lireMetadonnees, revelations } = await import('../ui/lib/metadonnees-image.js');
const { setLang } = await import('../ui/lib/i18n.js');
const octets = b64 => new Uint8Array(Buffer.from(b64, 'base64'));
const valeur = (lu, nom) => { const c = lu.champs.find(x => x.nom === nom); return c ? c.valeur : undefined; };

/* ----------------------- 1. EXIF ecrit par GDI+ --------------------------- */
/* Les valeurs attendues viennent de la relecture de GDI+, decodees ici : un
   texte TIFF (type 2) sans son NUL final, un rationnel (type 5) en deux
   entiers non signes de 32 bits, petit-boutistes comme GDI+ les rend. */
const gdi = Object.fromEntries(V.jpegGdiplus.proprietes.map(p => [p.id, Buffer.from(p.valeur, 'base64')]));
const texteGdi = id => gdi[id].toString('latin1').replace(/\0+$/, '');
const rationnels = id => { const b = gdi[id]; const r = []; for (let i = 0; i < b.length; i += 8) r.push(b.readUInt32LE(i) / b.readUInt32LE(i + 4)); return r; };
const degres = ([d, m, s]) => d + m / 60 + s / 3600;
const LIBELLES = {
  0x010F: 'Fabricant', 0x0110: 'Modele', 0x0131: 'Logiciel', 0x0132: 'Date de modification', 0x013B: 'Auteur',
  0x8298: 'Droits', 0x9003: 'Date de prise de vue', 0xA431: 'Numero de serie du boitier'
};
const latitudeGdi = degres(rationnels(0x0002)) * (texteGdi(0x0001) === 'S' ? -1 : 1);
const longitudeGdi = degres(rationnels(0x0004)) * (texteGdi(0x0003) === 'W' ? -1 : 1);
const altitudeGdi = rationnels(0x0006)[0] * (gdi[0x0005][0] === 1 ? -1 : 1);

function verifierExif(quoi, lu) {
  for (const [id, nom] of Object.entries(LIBELLES)) egal(quoi + ' : ' + nom, valeur(lu, nom), texteGdi(Number(id)));
  verifier(quoi + ' : position GPS lue', !!lu.gps);
  if (lu.gps) {
    proche(quoi + ' : latitude (GDI+ : 48° 51′ 29,6″ N)', lu.gps.latitude, latitudeGdi, 1e-9);
    proche(quoi + ' : longitude (GDI+ : 2° 17′ 40,2″ E)', lu.gps.longitude, longitudeGdi, 1e-9);
    proche(quoi + ' : altitude (GDI+ : 35 m)', lu.gps.altitude, altitudeGdi, 1e-9);
  }
}
{
  const lu = await lireMetadonnees(octets(V.jpegGdiplus.fichier));
  egal('JPEG : format reconnu', lu.format, 'JPEG');
  egal('JPEG : largeur (GDI+)', lu.largeur, V.jpegGdiplus.largeur);
  egal('JPEG : hauteur (GDI+)', lu.hauteur, V.jpegGdiplus.hauteur);
  verifierExif('JPEG', lu);
  verifier('JPEG : la position, l auteur et le numero de serie sont marques sensibles',
    ['Auteur', 'Numero de serie du boitier'].every(n => (lu.champs.find(c => c.nom === n) || {}).sensible) && lu.gps);
  egal('JPEG : aucune erreur', lu.erreurs.length, 0);
}

/* ------------------------- 2. XMP, PNG, WebP ------------------------------ */
{
  const lu = await lireMetadonnees(octets(V.jpegXmp.fichier));
  verifierExif('JPEG + XMP', lu);
  verifier('JPEG + XMP : le paquet XMP est garde', lu.xmp && lu.xmp.includes('Ada Lovelace'));
  egal('XMP : logiciel createur', valeur(lu, 'Logiciel createur (XMP)'), V.xmp.CreatorTool);
  egal('XMP : createur', valeur(lu, 'Createur (XMP)'), V.xmp.creator);
  egal('XMP : ville', valeur(lu, 'Ville (XMP)'), V.xmp.City);
  egal('XMP : pays', valeur(lu, 'Pays (XMP)'), V.xmp.Country);
  verifier('XMP : position lue', !!lu.gpsXmp);
  if (lu.gpsXmp) {
    proche('XMP : latitude « 48,51.4933N »', lu.gpsXmp.latitude, 48 + 51.4933 / 60, 1e-9);
    proche('XMP : longitude « 2,17.67E »', lu.gpsXmp.longitude, 2 + 17.67 / 60, 1e-9);
  }
}
{
  const lu = await lireMetadonnees(octets(V.png.fichier));
  egal('PNG : format reconnu', lu.format, 'PNG');
  egal('PNG : largeur', lu.largeur, 16);
  egal('PNG : hauteur', lu.hauteur, 8);
  for (const [cle, texte] of Object.entries(V.png.texte)) egal('PNG : texte « ' + cle + ' »', valeur(lu, cle + ' (PNG)'), texte);
  verifierExif('PNG eXIf', lu);
  verifier('PNG : XMP compresse dans iTXt, decompresse', lu.xmp && lu.xmp.includes('Ada Lovelace'));
}
{
  const lu = await lireMetadonnees(octets(V.webp.fichier));
  egal('WebP : format reconnu', lu.format, 'WebP');
  egal('WebP : largeur (VP8X)', lu.largeur, 16);
  egal('WebP : hauteur (VP8X)', lu.hauteur, 8);
  verifierExif('WebP EXIF', lu);
  verifier('WebP : XMP lu', lu.xmp && lu.xmp.includes('Ada Lovelace'));
}

/* ------------------------- 3. Ce que l image revele ----------------------- */
{
  setLang('fr');
  const lu = await lireMetadonnees(octets(V.jpegGdiplus.fichier));
  const dit = revelations(lu).join(' | ');
  verifier('revele : la position GPS, en degres', /48\.858222/.test(dit) && /2\.2945/.test(dit), dit);
  verifier('revele : l auteur et le numero de serie', dit.includes('Ada Lovelace') && dit.includes('SN-123456'), dit);
  /* Le meme PNG sans ses blocs de texte ni eXIf. */
  const png = octets(V.png.fichier);
  const garde = [];
  for (let p = 8; p + 12 <= png.length;) {
    const lg = (png[p] << 24 | png[p + 1] << 16 | png[p + 2] << 8 | png[p + 3]) >>> 0;
    const type = String.fromCharCode(...png.slice(p + 4, p + 8));
    if (!['tEXt', 'iTXt', 'zTXt', 'eXIf'].includes(type)) garde.push(png.slice(p, p + 12 + lg));
    p += 12 + lg;
  }
  const nu = new Uint8Array([...png.slice(0, 8), ...garde.flatMap(b => [...b])]);
  const rien = await lireMetadonnees(nu);
  egal('une image sans metadonnees : rien a dire', revelations(rien).length, 0);
  egal('une image sans metadonnees : format et taille quand meme', rien.format + ' ' + rien.largeur + 'x' + rien.hauteur, 'PNG 16x8');
}

/* ------------------------------ 4. Robustesse ----------------------------- */
{
  let exceptions = 0;
  const jpeg = octets(V.jpegXmp.fichier);
  for (let n = 0; n <= jpeg.length; n += 7) {
    try { await lireMetadonnees(jpeg.slice(0, n)); } catch { exceptions++; }
  }
  const png = octets(V.png.fichier);
  for (let n = 0; n <= png.length; n += 5) {
    try { await lireMetadonnees(png.slice(0, n)); } catch { exceptions++; }
  }
  let graine = 7;
  const hasard = () => (graine = (graine * 1103515245 + 12345) >>> 0) & 0xff;
  for (let i = 0; i < 300; i++) {
    const o = new Uint8Array(20 + (i % 200)).map(hasard);
    if (i % 3 === 0) { o[0] = 0xff; o[1] = 0xd8; o[2] = 0xff; o[3] = 0xe1; }
    try { await lireMetadonnees(o); } catch { exceptions++; }
  }
  egal('tronques et octets au hasard : jamais d exception', exceptions, 0);
  /* Un TIFF dont l IFD0 designe un IFD EXIF qui est lui-meme. */
  const tiff = new Uint8Array([0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, 0x01, 0x00,
    0x69, 0x87, 0x04, 0x00, 0x01, 0x00, 0x00, 0x00, 0x08, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]);
  const segment = [0xff, 0xe1, 0x00, 2 + 6 + tiff.length, 0x45, 0x78, 0x69, 0x66, 0, 0, ...tiff];
  const debut = Date.now();
  const boucle = await lireMetadonnees(new Uint8Array([0xff, 0xd8, ...segment, 0xff, 0xd9]));
  verifier('un IFD qui se designe lui-meme ne boucle pas', Date.now() - debut < 1000 && boucle.format === 'JPEG');
  /* GDI+ range BodySerialNumber (0xA431, Exif 2.3) dans l IFD0 et non dans
     l IFD EXIF : les deux sont lus. */
  const t = V.jpegGdiplus.proprietes.find(p => p.id === 0xA431);
  verifier('le vecteur GDI+ porte bien 0xA431', !!t);
}

/* ------------------- 4 bis. Fichiers hostiles : jamais lent ----------------- */
/* L onglet Reponse lit de lui-meme chaque image capturee : une page peut en
   servir une faite pour le bloquer. Avant la 5.9 finale, quatre commentaires
   JPEG de 65 000 octets nuls prenaient 7,6 s, sept etiquettes EXIF de 60 Ko
   21,6 s, un XMP de 512 Ko 6,5 s, et une bombe zTXt de 100 Mo 14 s et
   3,5 Go (mesure de la premiere revue). Une
   valeur est desormais lue sur 4 096 caracteres au plus, et le dit ; une
   decompression s arrete a 1 Mo ; le XMP est lu sans expression qui revient
   en arriere. */
const jpegDe = segments => new Uint8Array([0xff, 0xd8, ...segments.flatMap(s => [...s]), 0xff, 0xd9]);
const segmentJpeg = (marqueur, corps) => [0xff, marqueur, (corps.length + 2) >> 8, (corps.length + 2) & 255, ...corps];
const tiffDe = (ifd0, autres = []) => {
  /* IFD0 a l octet 8 : [etiquette, type, compte, valeur ou position]. */
  const entrees = ifd0.length;
  const donnees = 8 + 2 + entrees * 12 + 4;
  const sortie = Buffer.alloc(donnees + autres.reduce((s, b) => s + b.length, 0), 0);
  sortie.write('II', 0, 'latin1'); sortie.writeUInt16LE(42, 2); sortie.writeUInt32LE(8, 4); sortie.writeUInt16LE(entrees, 8);
  ifd0.forEach(([etiquette, type, compte, valeur], i) => {
    const e = 10 + i * 12;
    sortie.writeUInt16LE(etiquette, e); sortie.writeUInt16LE(type, e + 2); sortie.writeUInt32LE(compte, e + 4);
    sortie.writeUInt32LE(typeof valeur === 'number' ? valeur : donnees + valeur.decalage, e + 8);
  });
  let p = donnees;
  for (const b of autres) { b.copy(sortie, p); p += b.length; }
  return sortie;
};
const exifDe = tiff => segmentJpeg(0xe1, [...Buffer.from('Exif\0\0', 'latin1'), ...tiff]);
{
  const { te } = await import('../ui/lib/i18n.js');
  const lents = [];
  const chrono = async (quoi, octetsHostiles, limite = 1000) => {
    const t0 = performance.now();
    const lu = await lireMetadonnees(octetsHostiles);
    const ms = performance.now() - t0;
    if (ms > limite) lents.push(quoi + ' : ' + Math.round(ms) + ' ms');
    return lu;
  };
  const nuls = n => { const b = new Array(n).fill(0); b[n - 1] = 0x41; return b; };
  await chrono('4 commentaires JPEG de 65 000 octets nuls', jpegDe([0, 1, 2, 3].map(() => segmentJpeg(0xfe, nuls(65000)))));
  /* Les sept etiquettes texte de l IFD0, chacune sur 60 000 octets nuls. */
  const bloc = Buffer.alloc(60000, 0); bloc[59999] = 0x41;
  const textes = [0x010E, 0x010F, 0x0110, 0x0131, 0x0132, 0x013B, 0x8298].map(e => [e, 2, 60000, { decalage: 0 }]);
  await chrono('7 etiquettes EXIF de 60 000 octets', jpegDe([exifDe(tiffDe(textes, [bloc]))]));
  /* Une bombe : 20 Mo de « A » compresses en 20 Ko dans un bloc zTXt. */
  const zlib = await import('node:zlib');
  const morceau = (type, donnees) => {
    const t = Buffer.alloc(8); t.writeUInt32BE(donnees.length, 0); t.write(type, 4, 'latin1');
    return Buffer.concat([t, donnees, Buffer.alloc(4)]);
  };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(1, 0); ihdr.writeUInt32BE(1, 4);
  const bombe = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), morceau('IHDR', ihdr),
    morceau('zTXt', Buffer.concat([Buffer.from('Comment\0\0', 'latin1'), zlib.deflateSync(Buffer.alloc(20 * 1024 * 1024, 0x41), { level: 9 })])),
    morceau('IEND', Buffer.alloc(0))]);
  const luBombe = await chrono('bombe zTXt de 20 Mo', new Uint8Array(bombe), 2000);
  const commentaire = luBombe.champs.find(c => c.nom === 'Comment (PNG)');
  verifier('bombe zTXt : la valeur est coupee, et le dit', !!commentaire && commentaire.valeur.length <= 4096 + 4 && commentaire.valeur.endsWith('[…]'),
    commentaire ? commentaire.valeur.length + ' caracteres' : 'aucun champ');
  /* Un XMP de 512 Ko fait de balises ouvrantes jamais fermees. */
  const xmp = Buffer.from('<dc:creator>'.repeat(Math.floor(512 * 1024 / 12)), 'latin1');
  const vp = Buffer.alloc(8); vp.write('XMP ', 0, 'latin1'); vp.writeUInt32LE(xmp.length, 4);
  const corpsWebp = Buffer.concat([Buffer.from('WEBP', 'latin1'), vp, xmp]);
  const riff = Buffer.alloc(8); riff.write('RIFF', 0, 'latin1'); riff.writeUInt32LE(corpsWebp.length, 4);
  await chrono('XMP de 512 Ko de balises ouvertes', new Uint8Array(Buffer.concat([riff, corpsWebp])));
  /* Trois cents commentaires : les champs gardes sont bornes, et le compte des autres est dit. */
  const nombreux = await chrono('300 commentaires', jpegDe(Array.from({ length: 300 }, (_, i) => segmentJpeg(0xfe, [...Buffer.from('note ' + i)]))));
  verifier('300 commentaires : 200 champs au plus, les autres comptes', nombreux.champs.length <= 200 && nombreux.champsIgnores === 100,
    nombreux.champs.length + ' champs, ' + nombreux.champsIgnores + ' ignores');
  /* Des milliers de petits blocs : chacun est borne, leur somme doit l etre
     aussi — decompressions, octets decompresses, messages d erreur. */
  const petitZ = Buffer.concat([Buffer.from('k\0\0', 'latin1'), zlib.deflateSync(Buffer.alloc(30000, 0x41))]);
  const bombes = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), morceau('IHDR', ihdr),
    ...Array.from({ length: 3000 }, () => morceau('zTXt', petitZ)), morceau('IEND', Buffer.alloc(0))]);
  const luBombes = await chrono('3 000 blocs zTXt de 30 Ko chacun', new Uint8Array(bombes), 2000);
  verifier('3 000 blocs zTXt : 50 decompressions au plus, et le dit', luBombes.erreurs.some(e => /50 blocs/.test(e)), luBombes.erreurs.join(' | ').slice(0, 200));
  const sansCle = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), morceau('IHDR', ihdr),
    ...Array.from({ length: 5000 }, () => morceau('tEXt', Buffer.from('sans-nul', 'latin1'))), morceau('IEND', Buffer.alloc(0))]);
  const luSansCle = await chrono('5 000 blocs tEXt sans mot-cle', new Uint8Array(sansCle));
  verifier('5 000 erreurs : 20 messages gardes, les autres comptes', luSansCle.erreurs.length === 20 && luSansCle.erreursIgnorees === 4980,
    luSansCle.erreurs.length + ' messages, ' + luSansCle.erreursIgnorees + ' ignores');
  {
    const { blocMetadonnees } = await import('../ui/console/tools-metadonnees.js');
    setLang('en');
    const notes = [];
    const lireNotes = n => { if (!n) return; if (/note/.test(String(n.className || ''))) notes.push(String(n.textContent || '')); for (const e of n.children || []) lireNotes(e); };
    lireNotes(blocMetadonnees(luSansCle));
    setLang('fr');
    verifier('les erreurs non affichees sont dites, en anglais', notes.includes('4980 other error(s), not shown.'), notes.slice(-2).join(' | '));
  }
  egal('aucun fichier hostile ne prend plus d une seconde (deux pour les bombes)', lents.join(' | '), '');

  /* Des blocs EXIF et XMP par milliers : chacun est borne, leur nombre aussi.
     Un fichier de 40 Mo fait de blocs EXIF prenait 7 s, et un bloc vide ne
     remplit aucun champ : la limite ne peut pas venir des champs. */
  const blocVide = exifDe(tiffDe([]));
  const luTiff = await chrono('20 000 blocs EXIF vides', jpegDe(Array.from({ length: 20000 }, () => blocVide)));
  verifier('20 000 blocs EXIF : 16 lus, et le dit', luTiff.erreurs.some(e => /16 blocs EXIF/.test(e)), luTiff.erreurs.join(' | ').slice(0, 160));
  const paquet = [...Buffer.from('http://ns.adobe.com/xap/1.0/\0', 'latin1'), ...Buffer.from('<x dc:rights="a"/>')];
  const luXmp = await chrono('5 000 paquets XMP', jpegDe(Array.from({ length: 5000 }, () => segmentJpeg(0xe1, paquet))));
  verifier('5 000 paquets XMP : 16 lus, et le dit', luXmp.erreurs.some(e => /16 paquets XMP/.test(e)), luXmp.erreurs.join(' | ').slice(0, 160));

  /* Une longue valeur legitime : coupee a 4 096 caracteres, marquee, comptee. */
  const long = await lireMetadonnees(jpegDe([segmentJpeg(0xfe, [...Buffer.alloc(5000, 0x42)])]));
  const c = long.champs.find(x => x.nom === 'Commentaire');
  verifier('un commentaire de 5 000 caracteres : 4 096 gardes, marque « […] »', !!c && c.valeur === 'B'.repeat(4096) + ' […]' && long.coupees === 1);

  /* UserComment (0x9286) de 100 caracteres : il etait coupe a 56. */
  const texte = 'A'.repeat(50) + 'B'.repeat(50);
  const userComment = Buffer.concat([Buffer.from('ASCII\0\0\0', 'latin1'), Buffer.from(texte, 'latin1')]);
  const ifdExif = Buffer.alloc(2 + 12 + 4, 0);
  ifdExif.writeUInt16LE(1, 0); ifdExif.writeUInt16LE(0x9286, 2); ifdExif.writeUInt16LE(7, 4); ifdExif.writeUInt32LE(userComment.length, 6);
  /* L IFD EXIF suit l IFD0 (8 + 2 + 12 + 4 = 26) ; le commentaire le suit (26 + 18 = 44). */
  ifdExif.writeUInt32LE(44, 10);
  const avecCommentaire = await lireMetadonnees(jpegDe([exifDe(tiffDe([[0x8769, 4, 1, 26]], [ifdExif, userComment]))]));
  egal('UserComment de 100 caracteres : lu en entier', valeur(avecCommentaire, 'Commentaire'), texte);

  /* UserComment en UNICODE : il suit l ordre des octets du fichier. Un fichier
     « MM » ecrit de l UTF-16 gros-boutiste. */
  {
    const corps = Buffer.concat([Buffer.from('UNICODE\0', 'latin1'), Buffer.from('Bonjour', 'utf16le').swap16()]);
    const tiff = Buffer.alloc(8 + 18 + 18 + corps.length, 0);
    tiff.write('MM', 0, 'latin1'); tiff.writeUInt16BE(42, 2); tiff.writeUInt32BE(8, 4);
    tiff.writeUInt16BE(1, 8); tiff.writeUInt16BE(0x8769, 10); tiff.writeUInt16BE(4, 12); tiff.writeUInt32BE(1, 14); tiff.writeUInt32BE(26, 18);
    tiff.writeUInt16BE(1, 26); tiff.writeUInt16BE(0x9286, 28); tiff.writeUInt16BE(7, 30); tiff.writeUInt32BE(corps.length, 32); tiff.writeUInt32BE(44, 36);
    corps.copy(tiff, 44);
    egal('UserComment UNICODE d un fichier « MM » : lu dans le bon ordre', valeur(await lireMetadonnees(jpegDe([exifDe(tiff)])), 'Commentaire'), 'Bonjour');
  }
  /* Une limite en octets ne coupe pas un texte en silence : 3 000 caracteres
     chinois font 9 000 octets, et tiennent dans les 4 096 caracteres. */
  {
    const chinois = '漢'.repeat(3000);
    const corps = Buffer.concat([Buffer.from('\0\0\0\0\0\0\0\0', 'latin1'), Buffer.from(chinois, 'utf8')]);
    const ifd = Buffer.alloc(18, 0);
    ifd.writeUInt16LE(1, 0); ifd.writeUInt16LE(0x9286, 2); ifd.writeUInt16LE(7, 4); ifd.writeUInt32LE(corps.length, 6); ifd.writeUInt32LE(44, 10);
    const lu = await lireMetadonnees(jpegDe([exifDe(tiffDe([[0x8769, 4, 1, 26]], [ifd, corps]))]));
    verifier('UserComment de 3 000 caracteres chinois : lu en entier', valeur(lu, 'Commentaire') === chinois, String((valeur(lu, 'Commentaire') || '').length) + ' caracteres');
  }
  /* Le XMP se mesure en octets : 1,2 Mo de « é » sont coupes, et ils le disent. */
  {
    const accents = Buffer.from('<x>' + 'é'.repeat(600000) + '</x>', 'utf8');
    const entete = Buffer.alloc(8); entete.write('XMP ', 0, 'latin1'); entete.writeUInt32LE(accents.length, 4);
    const corps = Buffer.concat([Buffer.from('WEBP', 'latin1'), entete, accents]);
    const riffXmp = Buffer.alloc(8); riffXmp.write('RIFF', 0, 'latin1'); riffXmp.writeUInt32LE(corps.length, 4);
    const lu = await lireMetadonnees(new Uint8Array(Buffer.concat([riffXmp, corps])));
    /* Le meme, dans un bloc PNG tEXt. */
    const png = Buffer.concat([Buffer.from('\x89PNG\r\n\x1a\n', 'latin1'), morceau('IHDR', ihdr),
      morceau('tEXt', Buffer.concat([Buffer.from('XML:com.adobe.xmp\0', 'latin1'), Buffer.alloc(1200000, 0x41)])), morceau('IEND', Buffer.alloc(0))]);
    const luPng = await lireMetadonnees(new Uint8Array(png));
    verifier('XMP de 1,2 Mo, en WebP et en PNG tEXt : la coupure est dite', lu.erreurs.some(e => /1 Mo/.test(e)) && luPng.erreurs.some(e => /1 Mo/.test(e)),
      lu.erreurs.join(' | ') + ' // ' + luPng.erreurs.join(' | '));
  }

  /* Une heure GPS ecrite en texte (au lieu de trois rationnels) : la lecture
     continue, et la position qui suit est lue. */
  const gps = Buffer.alloc(2 + 5 * 12 + 4 + 48, 0);
  const rationnels = [48, 1, 51, 1, 29, 1, 2, 1, 17, 1, 40, 1];
  gps.writeUInt16LE(5, 0);
  [[0x0001, 2, 2, 'N'], [0x0002, 5, 3, null], [0x0003, 2, 2, 'E'], [0x0004, 5, 3, null], [0x0007, 2, 4, 'abc']].forEach(([etiquette, type, compte, texteCourt], i) => {
    const e = 2 + i * 12;
    gps.writeUInt16LE(etiquette, e); gps.writeUInt16LE(type, e + 2); gps.writeUInt32LE(compte, e + 4);
    if (texteCourt) gps.write(texteCourt, e + 8, 'latin1');
    /* Les rationnels sont apres l IFD : 26 (IFD GPS) + 66, puis 24 octets plus loin. */
    else gps.writeUInt32LE(26 + 66 + (etiquette === 0x0002 ? 0 : 24), e + 8);
  });
  rationnels.forEach((x, i) => gps.writeUInt32LE(x, 66 + i * 4));
  const heureTexte = await lireMetadonnees(jpegDe([exifDe(tiffDe([[0x8825, 4, 1, 26]], [gps]))]));
  egal('heure GPS en texte : aucune lecture interrompue', heureTexte.erreurs.join(' | '), '');
  verifier('heure GPS en texte : la position est lue quand meme', !!heureTexte.gps && Math.abs(heureTexte.gps.latitude - (48 + 51 / 60 + 29 / 3600)) < 1e-9,
    JSON.stringify(heureTexte.gps));

  /* Chaque message d erreur d un fichier abime a sa traduction anglaise :
     te() rendait « bloc PNG IDAT tronque » tel quel sur un ecran anglais. */
  const messages = new Set();
  for (const source of [V.jpegXmp.fichier, V.png.fichier, V.webp.fichier]) {
    const o = octets(source);
    for (let n = 0; n <= o.length; n += 3) for (const e of (await lireMetadonnees(o.slice(0, n))).erreurs) messages.add(e);
  }
  for (const e of heureTexte.erreurs) messages.add(e);
  messages.add((await lireMetadonnees(jpegDe([[0x00, 0x11, 0x22, 0x33]]))).erreurs[0]);
  setLang('en');
  const sansTraduction = [...messages].filter(m => m && te(m) === m);
  setLang('fr');
  verifier('des messages d erreur ont bien ete produits', messages.size >= 4, [...messages].join(' | '));
  egal('chaque message d erreur a sa traduction anglaise', sansTraduction.join(' | '), '');
}

/* -------------------- 5. La boite a outils et le detail ------------------- */
{
  const { panneauMetadonnees } = await import('../ui/console/tools-metadonnees.js');
  const texteDe = n => !n ? '' : String(n.textContent || '') + ' ' + [...(n.children || [])].map(texteDe).join(' ');
  for (const langue of ['fr', 'en']) {
    setLang(langue);
    const etat = {};
    let attendus = 0;
    panneauMetadonnees(V.jpegGdiplus.fichier, etat, () => { attendus++; });
    for (let i = 0; i < 50 && !attendus; i++) await new Promise(r => setTimeout(r, 10));
    const texte = texteDe(panneauMetadonnees(V.jpegGdiplus.fichier, etat, () => {}));
    /* La premiere fois, la lecture est asynchrone et le panneau demande a se
       redessiner ; la seconde, elle est en cache et rendue tout de suite. */
    if (langue === 'fr') verifier('outil : le panneau se redessine une fois la lecture faite', attendus >= 1);
    else egal('outil : lecture en cache, rendue sans attendre', attendus, 0);
    verifier('outil [' + langue + '] : position, auteur, appareil', texte.includes('48.858222') && texte.includes('Ada Lovelace')
      && texte.includes('SWIFT Test Camera'), texte.slice(0, 200));
    verifier('outil [' + langue + '] : le titre dans sa langue', langue === 'en' ? texte.includes('Image metadata') : texte.includes('Metadonnees d image'), texte.slice(0, 120));
  }
  setLang('fr');
}

/* Chaque libelle d un rapport passe par le traducteur : en anglais, aucun ne
   doit lui manquer. Ne sont pas a traduire : un texte deja anglais (une
   traduction repassee au traducteur), et les donnees du fichier — format,
   dimensions, mot-cle PNG (« Author », « Comment » : le fichier les ecrit). */
{
  const { blocMetadonnees } = await import('../ui/console/tools-metadonnees.js');
  const { surManque } = await import('../ui/lib/i18n.js');
  const { EN } = await import('../ui/lib/dict-en.js');
  const anglais = dejaAnglais(EN);
  const lus = [];
  for (const cle of ['jpegGdiplus', 'jpegXmp', 'png', 'webp']) lus.push(await lireMetadonnees(octets(V[cle].fichier)));
  lus.push(await lireMetadonnees(octets(V.jpegGdiplus.fichier).slice(0, 400)));
  /* Une valeur coupee et des champs au-dela de 200 : les deux notes. */
  const nombreux = await lireMetadonnees(jpegDe([segmentJpeg(0xfe, [...Buffer.alloc(5000, 0x42)]),
    ...Array.from({ length: 250 }, (_, i) => segmentJpeg(0xfe, [...Buffer.from('note ' + i)]))]));
  lus.push(nombreux);
  const manques = new Set();
  setLang('en');
  surManque(texte => {
    const s = String(texte);
    if (anglais(s) || /^(JPEG|PNG|WebP)\b/.test(s) || / \(PNG\)$/.test(s)) return;
    manques.add(s);
  });
  let temoin;
  try {
    for (const lu of lus) blocMetadonnees(lu);
    const avant = manques.size;
    /* Controle positif : un libelle francais sans traduction est bien vu. */
    blocMetadonnees({ ...lus[0], champs: [{ nom: 'Libelle sans traduction', valeur: 'x' }] });
    temoin = manques.has('Libelle sans traduction') && manques.size === avant + 1;
    manques.delete('Libelle sans traduction');
  } finally { surManque(null); setLang('fr'); }
  verifier('rapport en anglais : un libelle sans traduction serait vu', temoin);
  egal('rapport en anglais : aucun libelle sans traduction', [...manques].join(' | '), '');
  setLang('en');
  const notes = [];
  const lireNotes = n => { if (!n) return; if (/note/.test(String(n.className || ''))) notes.push(String(n.textContent || '')); for (const e of n.children || []) lireNotes(e); };
  lireNotes(blocMetadonnees(nombreux));
  setLang('fr');
  verifier('rapport en anglais : la coupure et les champs non affiches sont dits',
    notes.some(x => x.startsWith('1 value(s) longer than 4,096')) && notes.some(x => x.startsWith('51 field(s) beyond the first 200')), notes.join(' | '));
}

bilan('Ce qu une image revele');
