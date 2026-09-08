/* Horodatages — INTERCEPTOR (by D4RK)
 *
 * Un nombre colle dans un jeton ou un journal peut etre compte depuis 1970,
 * 1601, 1904, 2001 ou l an 1, en secondes, millisecondes, microsecondes ou
 * pas de cent nanosecondes. On ne devine pas : on montre chaque lecture, et
 * l oeil reconnait la bonne (une date de 1601 ou de l an 3000 se voit).
 */

const MS_PAR_JOUR = 86400000;

/* Chaque origine, avec la conversion exacte vers l epoque Unix en ms. */
const ORIGINES = [
  ['Secondes depuis 1970 (Unix)', n => n * 1000],
  ['Millisecondes depuis 1970 (Unix)', n => n],
  ['Microsecondes depuis 1970', n => n / 1000],
  ['Nanosecondes depuis 1970', n => n / 1e6],
  ['Pas de 100 ns depuis 1601 (Windows FILETIME)', n => n / 10000 - 11644473600000],
  ['Microsecondes depuis 1601 (Chrome, WebKit)', n => n / 1000 - 11644473600000],
  ['Secondes depuis 1904 (HFS, QuickTime)', n => n * 1000 - 2082844800000],
  ['Secondes depuis 2001 (Apple, Cocoa)', n => n * 1000 + 978307200000],
  ['Pas de 100 ns depuis l an 1 (.NET ticks)', n => n / 10000 - 62135596800000],
  ['Jours depuis 1899-12-30 (serie Excel)', n => (n - 25569) * MS_PAR_JOUR],
  ['Jour julien', n => (n - 2440587.5) * MS_PAR_JOUR],
  /* NTP (RFC 5905) : secondes depuis 1900, soit 2 208 988 800 de plus que
     l epoque Unix. On croise la valeur entiere dans les journaux de synchro. */
  ['Secondes depuis 1900 (NTP)', n => (n - 2208988800) * 1000],
  /* GPS : semaines et secondes depuis le 6 janvier 1980, sans les secondes
     intercalaires. La valeur brute est un compte de secondes. */
  ['Secondes depuis 1980 (GPS, sans secondes intercalaires)',
    n => (n + 315964800) * 1000]
];

/* Une lecture n est retenue que si elle tombe dans une periode plausible :
   entre 1970 et 2200. Cela ecarte les interpretations absurdes sans jamais
   choisir a la place de l utilisateur. */
const PLANCHER = Date.UTC(1970, 0, 1);
const PLAFOND = Date.UTC(2200, 0, 1);

/**
 * Date et heure MS-DOS, empaquetees sur trente-deux bits. C est le format des
 * horodatages d une archive ZIP :
 *   bits 31-25 annee moins 1980, 24-21 mois, 20-16 jour,
 *   bits 15-11 heures, 10-5 minutes, 4-0 secondes divisees par deux.
 * La resolution est donc de deux secondes, et l heure est locale, sans fuseau.
 */
export function lireDateDos(valeur) {
  const n = Number(valeur);
  if (!Number.isInteger(n) || n < 0 || n > 0xffffffff) {
    throw new Error('entier de 32 bits attendu');
  }
  const date = n >>> 16;
  const heure = n & 0xffff;
  const champs = {
    annee: 1980 + ((date >> 9) & 0x7f),
    mois: (date >> 5) & 0x0f,
    jour: date & 0x1f,
    heures: (heure >> 11) & 0x1f,
    minutes: (heure >> 5) & 0x3f,
    secondes: (heure & 0x1f) * 2
  };
  if (champs.mois < 1 || champs.mois > 12 || champs.jour < 1 || champs.jour > 31
    || champs.heures > 23 || champs.minutes > 59 || champs.secondes > 59) {
    throw new Error('champs hors des bornes : ce nombre n est pas une date MS-DOS');
  }
  const iso = String(champs.annee) + '-' + String(champs.mois).padStart(2, '0') + '-'
    + String(champs.jour).padStart(2, '0') + ' ' + String(champs.heures).padStart(2, '0') + ':'
    + String(champs.minutes).padStart(2, '0') + ':' + String(champs.secondes).padStart(2, '0');
  return { ...champs, texte: iso, resolution: '2 secondes', fuseau: 'heure locale, sans fuseau' };
}

/** Toutes les lectures plausibles d une valeur, chacune avec son origine. */
export function lireHorodatage(entree) {
  const brut = String(entree || '').trim();
  if (!brut) throw new Error('valeur vide');
  const lectures = [];

  if (/^-?\d+(\.\d+)?$/.test(brut)) {
    const n = Number(brut);
    for (const [nom, convertir] of ORIGINES) {
      const ms = convertir(n);
      if (!Number.isFinite(ms) || ms < PLANCHER || ms > PLAFOND) continue;
      const d = new Date(Math.round(ms));
      if (Number.isNaN(d.getTime())) continue;
      lectures.push({ nom, iso: d.toISOString(), local: d.toString(), ms: d.getTime() });
    }
    if (!lectures.length) throw new Error('aucune lecture ne tombe entre 1970 et 2200');
    return lectures;
  }

  const d = new Date(brut);
  if (Number.isNaN(d.getTime())) throw new Error('date illisible');
  return [{ nom: 'Date interpretee par le moteur', iso: d.toISOString(), local: d.toString(), ms: d.getTime() }];
}

/** Numero de semaine ISO 8601 : la semaine du jeudi. */
export function semaineIso(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const jour = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - jour);
  const debut = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return {
    annee: d.getUTCFullYear(),
    semaine: Math.ceil((((d - debut) / MS_PAR_JOUR) + 1) / 7)
  };
}

const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'];

/** Toutes les ecritures d un instant : chaque format que l on rencontre. */
export function formatsDe(ms) {
  const d = new Date(Number(ms));
  if (Number.isNaN(d.getTime())) throw new Error('instant invalide');
  const secondes = Math.floor(d.getTime() / 1000);
  const decalage = -d.getTimezoneOffset();
  const signe = decalage >= 0 ? '+' : '-';
  const abs = Math.abs(decalage);
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 23);
  const iso = semaineIso(d);
  const debutAnnee = Date.UTC(d.getUTCFullYear(), 0, 1);

  return {
    iso: d.toISOString(),
    isoLocal: local + signe + String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0'),
    http: d.toUTCString(),
    secondes,
    millisecondes: d.getTime(),
    microsecondes: d.getTime() * 1000,
    filetime: (d.getTime() + 11644473600000) * 10000,
    ticksDotNet: (d.getTime() + 62135596800000) * 10000,
    apple: Math.floor(d.getTime() / 1000) - 978307200,
    excel: d.getTime() / MS_PAR_JOUR + 25569,
    jourJulien: d.getTime() / MS_PAR_JOUR + 2440587.5,
    jourSemaine: JOURS[d.getUTCDay()],
    mois: MOIS[d.getUTCMonth()],
    semaineIso: iso.annee + '-S' + String(iso.semaine).padStart(2, '0'),
    jourAnnee: Math.floor((d.getTime() - debutAnnee) / MS_PAR_JOUR) + 1,
    trimestre: 'T' + (Math.floor(d.getUTCMonth() / 3) + 1),
    bissextile: estBissextile(d.getUTCFullYear()),
    fuseauLocal: Intl.DateTimeFormat().resolvedOptions().timeZone || 'inconnu',
    decalageLocal: signe + String(Math.floor(abs / 60)).padStart(2, '0') + ':' + String(abs % 60).padStart(2, '0')
  };
}

export function estBissextile(annee) {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

/** Instant courant, sous toutes ses formes. */
export function maintenant() { return formatsDe(Date.now()); }

/** Duree lisible : « 3 j 4 h », « 12 min 5 s ». */
export function dureeLisible(secondes) {
  const s = Math.abs(Math.floor(Number(secondes) || 0));
  const signe = Number(secondes) < 0 ? '-' : '';
  const j = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (j) return signe + j + ' j ' + h + ' h';
  if (h) return signe + h + ' h ' + m + ' min';
  if (m) return signe + m + ' min ' + (s % 60) + ' s';
  return signe + s + ' s';
}

/** Ecart entre deux instants, dans les deux sens et en clair. */
export function ecart(msA, msB) {
  const delta = Math.round((Number(msB) - Number(msA)) / 1000);
  return {
    secondes: delta,
    lisible: dureeLisible(delta),
    sens: delta === 0 ? 'identiques' : delta > 0 ? 'le second est posterieur' : 'le second est anterieur'
  };
}

/**
 * Lit une duree ecrite a la maniere des entetes HTTP ou des configurations :
 * « 3600 », « 2h », « 30m », « 1d12h ». Rend un nombre de secondes.
 */
export function lireDuree(entree) {
  const brut = String(entree || '').trim().toLowerCase();
  if (!brut) throw new Error('duree vide');
  if (/^\d+$/.test(brut)) return Number(brut);
  const UNITES = { s: 1, m: 60, h: 3600, d: 86400, j: 86400, w: 604800 };
  const parties = brut.match(/(\d+(?:\.\d+)?)\s*([smhdjw])/g);
  if (!parties) throw new Error('duree illisible');
  let total = 0;
  for (const partie of parties) {
    const m = partie.match(/(\d+(?:\.\d+)?)\s*([smhdjw])/);
    total += Number(m[1]) * UNITES[m[2]];
  }
  return Math.round(total);
}
