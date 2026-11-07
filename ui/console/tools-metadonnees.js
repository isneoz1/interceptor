/* Panneau « Metadonnees d image » — SWIFT (by D4RK)
 *
 * Ce qu une image revele a qui la telecharge : la position GPS de la prise de
 * vue, l auteur, le numero de serie de l appareil, le logiciel, le XMP. La
 * meme lecture sert a la boite a outils (une image collee en base64, en
 * hexadecimal ou en URI de donnees) et a l onglet Reponse d une image
 * capturee. La lecture vit dans ui/lib/metadonnees-image.js.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { lireMetadonnees, revelationsBrutes } from '../lib/metadonnees-image.js';
import { base64VersOctets, hexVersOctets } from '../lib/bytes.js';
import { texteLong } from '../lib/texte-long.js';

/* La lecture se fait une fois par image : un redessin la reprend. */
const calculs = new Map();
const resultats = new Map();
function calculer(cle, octets) {
  if (!calculs.has(cle)) {
    if (calculs.size > 30) { calculs.clear(); resultats.clear(); }
    calculs.set(cle, lireMetadonnees(octets)
      .then(lu => { resultats.set(cle, { ok: true, lu }); }, e => { resultats.set(cle, { ok: false, erreur: e }); }));
  }
  return calculs.get(cle);
}

/** Le texte colle vu comme une image : URI de donnees, hexadecimal ou base64. */
function octetsDe(entree) {
  const brut = String(entree || '').trim();
  const data = /^data:[^,]*;base64,([\s\S]*)$/i.exec(brut);
  if (data) return base64VersOctets(data[1]);
  const sansEspace = brut.replace(/[\s:,-]+/g, '');
  if (/^(0x)?[0-9a-fA-F]+$/.test(sansEspace) && sansEspace.replace(/^0x/, '').length % 2 === 0) return hexVersOctets(brut);
  return base64VersOctets(brut);
}

const degres = x => String(+x.toFixed(6));

/** Ce qu une image revele, en un bloc. */
export function blocMetadonnees(lu) {
  const box = frag();
  box.appendChild(sec('Metadonnees d image', lu.format
    ? lu.format + (lu.largeur ? '  ·  ' + lu.largeur + ' × ' + lu.hauteur : '')
    : t('format non reconnu')));
  const dit = revelationsBrutes(lu);
  if (dit.length) {
    box.appendChild(el('p', { class: 'note warn', text: t('Cette image revele, a qui la telecharge :') }));
    for (const [cle, valeurs] of dit) {
      box.appendChild(el('p', { class: 'note warn', text: tp(cle, valeurs.nom ? { ...valeurs, nom: t(valeurs.nom) } : valeurs) }));
    }
  } else if (lu.format) {
    box.appendChild(el('p', { class: 'note', text: t('Ni position, ni nom, ni numero de serie dans ses metadonnees.') }));
  }
  if (lu.gps) {
    add(box, kv('Latitude (GPS)', degres(lu.gps.latitude), { copy: true, hl: true }));
    add(box, kv('Longitude (GPS)', degres(lu.gps.longitude), { copy: true, hl: true }));
    if (lu.gps.altitude != null) add(box, kv('Altitude (GPS)', degres(lu.gps.altitude) + ' m'));
  }
  if (lu.gpsXmp) {
    add(box, kv('Latitude (XMP)', degres(lu.gpsXmp.latitude), { copy: true, hl: true }));
    add(box, kv('Longitude (XMP)', degres(lu.gpsXmp.longitude), { copy: true, hl: true }));
  }
  for (const c of lu.champs) add(box, kv(c.nom, c.valeur, { copy: true, hl: c.sensible }));
  /* Rien n est coupe sans le dire. */
  if (lu.coupees) {
    box.appendChild(el('p', { class: 'note', text: tp('{n} valeur(s) de plus de 4 096 caracteres, coupee(s) : la coupure est marquee « […] ».', { n: lu.coupees }) }));
  }
  if (lu.champsIgnores) {
    box.appendChild(el('p', { class: 'note', text: tp('{n} champ(s) au-dela des 200 premiers, non affiche(s).', { n: lu.champsIgnores }) }));
  }
  if (lu.xmp) {
    box.appendChild(sec('Paquet XMP', tp('{n} caracteres', { n: lu.xmp.length })));
    box.appendChild(texteLong(lu.xmp));
  }
  for (const e of lu.erreurs) box.appendChild(el('p', { class: 'note', text: te(e) }));
  if (lu.erreursIgnorees) box.appendChild(el('p', { class: 'note', text: tp('{n} autre(s) erreur(s), non affichee(s).', { n: lu.erreursIgnorees }) }));
  return box;
}

/** L outil de la boite : une image collee. */
export function panneauMetadonnees(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Metadonnees d image', 'JPEG, PNG, WebP'));
  box.appendChild(el('p', { class: 'note', text: t('Collez une image en base64, en hexadecimal ou en URI de donnees : sa position GPS, son auteur, son appareil et son logiciel en sortent. Rien n est envoye nulle part.') }));
  const texte = String(entree || '').trim();
  if (!texte) return box;
  let octets;
  try { octets = octetsDe(texte); } catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: te(e) }));
    return box;
  }
  const fini = resultats.get(texte);
  if (!fini) {
    box.appendChild(el('p', { class: 'note', text: t('Lecture des metadonnees…') }));
    calculer(texte, octets).then(() => redessiner());
    return box;
  }
  if (!fini.ok) {
    box.appendChild(el('p', { class: 'note warn', text: te(fini.erreur) }));
    return box;
  }
  if (!fini.lu.format) {
    box.appendChild(el('p', { class: 'note', text: t('Ni JPEG, ni PNG, ni WebP : rien a lire.') }));
    return box;
  }
  box.appendChild(blocMetadonnees(fini.lu));
  return box;
}

/**
 * Le bloc de l onglet Reponse d une image capturee : il se remplit seul quand
 * la lecture est faite, sans redessiner l onglet. Rien quand l image ne
 * porte aucune metadonnee.
 */
export function blocMetadonneesReponse(base64) {
  const hote = el('div');
  let octets;
  try { octets = base64VersOctets(base64); } catch { return hote; }
  /* La chaine elle-meme sert de cle : la table garde une reference, pas une copie. */
  const cle = base64;
  const remplir = () => {
    const fini = resultats.get(cle);
    if (!fini || !fini.ok || !fini.lu.format) return;
    const lu = fini.lu;
    if (!lu.champs.length && !lu.gps && !lu.gpsXmp && !lu.xmp) return;
    hote.appendChild(blocMetadonnees(lu));
  };
  if (resultats.has(cle)) remplir();
  else calculer(cle, octets).then(remplir);
  return hote;
}
