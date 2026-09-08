/* Panneaux « Horodatage » et « Nombres » — INTERCEPTOR (by D4RK)
 *
 * Un nombre trouve dans un jeton ou un journal se lit de plusieurs facons :
 * on affiche toutes les lectures plausibles et toutes les ecritures d un meme
 * instant, plutot que d en choisir une a la place de l utilisateur.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { lireHorodatage, formatsDe, maintenant, lireDuree, dureeLisible, ecart, lireDateDos }
  from '../lib/temps.js';
import { convertirNombre } from '../lib/codecs-bases.js';

/* ------------------------------ Horodatages ------------------------------- */
export function panneauHorodatage(entree) {
  const box = frag();
  const now = maintenant();

  box.appendChild(sec('Maintenant', now.fuseauLocal + '   ·   ' + now.decalageLocal));
  ecrireFormats(box, now);

  const brut = String(entree || '').trim();
  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Placez une valeur dans le texte de travail pour la convertir : nombre, date ISO, date HTTP ou duree.') }));
    return box;
  }

  const premier = brut.split(/\s+/)[0];

  /* Une valeur entiere peut aussi etre une date MS-DOS empaquetee : c est le
     format des horodatages d une archive ZIP. On l essaie a part, ses champs
     n etant pas un compte de temps mais des bits juxtaposes. */
  if (/^\d+$/.test(premier)) {
    try {
      const dos = lireDateDos(Number(premier));
      box.appendChild(sec('Date MS-DOS empaquetee', 'format des archives ZIP'));
      add(box, kv('Date et heure', dos.texte, { copy: true, hl: true }));
      add(box, kv('Resolution', t(dos.resolution)));
      add(box, kv('Fuseau', t(dos.fuseau)));
    } catch { /* ce nombre n est pas une date MS-DOS valide */ }
  }

  let lectures = null;
  try { lectures = lireHorodatage(premier); }
  catch (e) {
    box.appendChild(sec('Lectures de « ' + premier + ' »', 0));
    box.appendChild(el('p', { class: 'note', text: t('Non convertible : ') + String(e.message || e) }));
  }

  if (lectures) {
    box.appendChild(sec('Lectures de « ' + premier + ' »', lectures.length));
    box.appendChild(el('p', { class: 'note', text:
      t('Chaque origine possible est montree. Seules celles qui tombent entre 1970 et 2200 sont retenues.') }));
    for (const l of lectures) {
      const carte = el('div', { class: 'find info' }, [
        el('h4', { text: t(l.nom) }),
        el('div', { class: 'kv' }, [el('span', { text: 'ISO' }), el('b', { text: l.iso })]),
        el('div', { class: 'kv' }, [el('span', { text: t('Heure locale') }), el('b', { text: l.local })])
      ]);
      const acts = el('div', { class: 'actions' });
      acts.appendChild(button('Toutes les ecritures', () => {
        const detail = el('div');
        ecrireFormats(detail, formatsDe(l.ms));
        carte.appendChild(detail);
      }));
      acts.appendChild(button('Ecart avec maintenant', () => {
        const e2 = ecart(l.ms, Date.now());
        toast(t('Ecart : ') + e2.lisible + '  (' + t(e2.sens) + ')');
      }));
      acts.appendChild(button('Copier l ISO', () => copy(l.iso, 'Date copiee')));
      carte.appendChild(acts);
      box.appendChild(carte);
    }
  }

  /* Une duree ecrite « 1d12h » ou « 3600 » se lit aussi : c est la forme des
     entetes Cache-Control, Retry-After et de bien des configurations. */
  try {
    const secondes = lireDuree(brut);
    box.appendChild(sec('Lue comme une duree', dureeLisible(secondes)));
    add(box, kv('Secondes', secondes, { copy: true, always: true }));
    add(box, kv('Minutes', Math.round(secondes / 60 * 100) / 100, { always: true }));
    add(box, kv('Heures', Math.round(secondes / 3600 * 100) / 100, { always: true }));
    add(box, kv('Jours', Math.round(secondes / 86400 * 100) / 100, { always: true }));
    add(box, kv('Echeance si elle part maintenant',
      new Date(Date.now() + secondes * 1000).toISOString(), { copy: true }));
  } catch { /* le texte n est pas une duree : rien a dire de plus */ }

  return box;
}

function ecrireFormats(box, f) {
  add(box, kv('ISO 8601 (UTC)', f.iso, { copy: true, hl: true }));
  add(box, kv('ISO 8601 (local)', f.isoLocal, { copy: true }));
  add(box, kv('Date HTTP (RFC 7231)', f.http, { copy: true }));
  add(box, kv('Secondes depuis 1970', f.secondes, { copy: true }));
  add(box, kv('Millisecondes depuis 1970', f.millisecondes, { copy: true }));
  add(box, kv('Microsecondes depuis 1970', f.microsecondes, { copy: true }));
  add(box, kv('Windows FILETIME', f.filetime, { copy: true }));
  add(box, kv('Ticks .NET', f.ticksDotNet, { copy: true }));
  add(box, kv('Secondes depuis 2001 (Apple)', f.apple, { copy: true }));
  add(box, kv('Serie Excel', Math.round(f.excel * 1e6) / 1e6, { copy: true }));
  add(box, kv('Jour julien', Math.round(f.jourJulien * 1e6) / 1e6, { copy: true }));
  add(box, kv('Jour de la semaine', f.jourSemaine));
  add(box, kv('Mois', f.mois));
  add(box, kv('Semaine ISO', f.semaineIso));
  add(box, kv('Jour de l annee', f.jourAnnee, { always: true }));
  add(box, kv('Trimestre', f.trimestre));
  add(box, kv('Annee bissextile', f.bissextile ? 'oui' : 'non'));
}

/* --------------------------------- Nombres -------------------------------- */
const BASES = [
  ['Binaire (2)', 2], ['Octal (8)', 8], ['Decimal (10)', 10],
  ['Hexadecimal (16)', 16], ['Base 32', 32], ['Base 36', 36]
];

export function panneauNombres(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Nombres', 'toutes les bases, sans perte de chiffre'));

  const choix = el('select');
  for (const [libelle, base] of BASES) {
    choix.appendChild(el('option', { value: String(base), text: t(libelle), selected: etat.base === base }));
  }
  choix.addEventListener('change', () => { etat.base = Number(choix.value); redessiner(); });
  const actions = el('div', { class: 'actions' }, [
    el('span', { class: 'note', text: t('Le texte de travail est lu en :') }), choix
  ]);
  box.appendChild(actions);

  const brut = String(entree || '').trim().split(/\s+/)[0];
  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Placez un nombre dans le texte de travail : il sera reecrit dans toutes les bases.') }));
    return box;
  }

  let n;
  try { n = convertirNombre(brut, etat.base); }
  catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Non convertible : ') + String(e.message || e) }));
    return box;
  }

  box.appendChild(sec('Ecritures de « ' + brut + ' »', 'lu en base ' + etat.base));
  for (const [libelle, base] of BASES) {
    add(box, kv(libelle, n.toString(base), { copy: true, hl: base === 16 }));
  }
  add(box, kv('Base 64 (alphabet standard)', base64DeNombre(n), { copy: true }));

  box.appendChild(sec('Proprietes'));
  add(box, kv('Signe', n < 0n ? 'negatif' : n === 0n ? 'nul' : 'positif'));
  add(box, kv('Bits necessaires', (n < 0n ? -n : n).toString(2).length, { always: true }));
  add(box, kv('Parite', n % 2n === 0n ? 'pair' : 'impair'));
  add(box, kv('Tient dans un entier sur 32 bits', n >= -2147483648n && n <= 2147483647n ? 'oui' : 'non'));
  add(box, kv('Tient dans un nombre JavaScript sur', n >= -9007199254740991n && n <= 9007199254740991n
    ? 'oui, exactement' : 'non, la precision serait perdue'));
  if (n >= 0n && n <= 4294967295n) {
    add(box, kv('Lu comme une adresse IPv4',
      [Number((n >> 24n) & 255n), Number((n >> 16n) & 255n), Number((n >> 8n) & 255n), Number(n & 255n)].join('.'),
      { copy: true }));
  }
  if (n >= 0n && n <= 65535n) add(box, kv('Lu comme un port', n.toString(), { copy: true }));

  const actions2 = el('div', { class: 'actions' });
  actions2.appendChild(button('Copier en hexadecimal', () => copy('0x' + n.toString(16), 'Valeur copiee')));
  actions2.appendChild(button('Copier en decimal', () => copy(n.toString(10), 'Valeur copiee')));
  box.appendChild(actions2);
  return box;
}

const ALPHABET64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

/** Ecriture d un entier en base 64 : ni base64 d octets, ni Bitcoin, juste 64 chiffres. */
function base64DeNombre(n) {
  if (n === 0n) return 'A';
  const negatif = n < 0n;
  let x = negatif ? -n : n;
  let out = '';
  while (x > 0n) { out = ALPHABET64[Number(x % 64n)] + out; x /= 64n; }
  return (negatif ? '-' : '') + out;
}

