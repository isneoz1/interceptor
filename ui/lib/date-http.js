/* Dates HTTP — SWIFT (by NeoZ)
 *
 * RFC 9110 section 5.6.7 : trois formes qu un destinataire DOIT accepter, et
 * une seule qu un emetteur a le droit d ecrire.
 *
 *   Sun, 06 Nov 1994 08:49:37 GMT    IMF-fixdate, la seule a emettre
 *   Sunday, 06-Nov-94 08:49:37 GMT   ancienne forme de la RFC 850
 *   Sun Nov  6 08:49:37 1994         forme asctime() du C ANSI
 *
 * Hors de ces trois formes, deux ecritures se rencontrent et se lisent sans
 * doute possible : la forme IMF avec un autre fuseau que « GMT » (l exemple
 * de la RFC 9745 ecrit « UTC »), et l ISO 8601. Elles sont lues, et le fait
 * est dit ; tout le reste est refuse. Date.parse n est pas employe : sa
 * tolerance change d un moteur a l autre, et l extension tourne dans Firefox
 * quand les tests tournent dans Node.
 */

const JOURS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const JOURS_LONGS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MOIS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const J = JOURS.join('|');
const JL = JOURS_LONGS.join('|');
const M = MOIS.join('|');
const IMF = new RegExp('^(' + J + '), (\\d{2}) (' + M + ') (\\d{4}) (\\d{2}):(\\d{2}):(\\d{2}) GMT$');
const RFC850 = new RegExp('^(' + JL + '), (\\d{2})-(' + M + ')-(\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}) GMT$');
const ASCTIME = new RegExp('^(' + J + ') (' + M + ') ( \\d|\\d{2}) (\\d{2}):(\\d{2}):(\\d{2}) (\\d{4})$');

/* Les deux ecritures lues hors grammaire, avec leur decalage horaire. */
const IMF_ZONE = new RegExp('^(' + J + '), (\\d{1,2}) (' + M + ') (\\d{4}) (\\d{2}):(\\d{2}):(\\d{2}) (UTC|UT|Z|[+-]\\d{4})$');
const ISO = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,9})?)?(Z|[+-]\d{2}:?\d{2})$/;

/* « +0200 », « -05:30 », « Z » : le decalage en minutes, a retrancher. */
function decalage(zone) {
  const m = /^([+-])(\d{2}):?(\d{2})$/.exec(zone);
  if (!m) return 0;
  return (m[1] === '-' ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3]));
}

const CINQUANTE_ANS_MS = 50 * 365.25 * 86400000;

/* Un instant UTC a partir de champs deja reconnus. null si un champ sort des
   bornes de la grammaire : 23 h au plus, 60 s au plus (seconde intercalaire). */
function instant(annee, mois, jour, h, min, s) {
  if (h > 23 || min > 59 || s > 60 || jour < 1 || jour > 31 || mois < 0 || mois > 11) return null;
  /* setUTCFullYear, pas Date.UTC : ce dernier lit les annees 0 a 99 comme
     1900 a 1999. */
  const d = new Date(0);
  d.setUTCFullYear(annee, mois, jour);
  /* Le 31 fevrier n existe pas : la date glisserait au 3 mars. */
  if (d.getUTCDate() !== jour) return null;
  /* Une seconde intercalaire (:60) se lit comme la premiere de la minute
     suivante : JavaScript ne connait pas d autre ecriture. Le jour de la
     semaine, lui, se prend sur la date ecrite, pas sur l instant glisse. */
  return { ms: d.getTime() + ((h * 60 + min) * 60 + s) * 1000, jour: d.getUTCDay() };
}

/**
 * Lit une date HTTP.
 *
 * @param maintenant  ms, pour l annee a deux chiffres de la forme RFC 850 :
 *   une date qui semblerait a plus de cinquante ans dans le futur designe
 *   l annee passee la plus recente qui finit par les memes chiffres.
 * @returns null si rien n est lisible, sinon
 *   { ms, forme: 'imf' | 'rfc850' | 'asctime' | 'autre', jourCoherent }
 *   `jourCoherent` est faux quand le nom du jour ne correspond pas a la date.
 */
export function lireDateHttp(valeur, maintenant = Date.now()) {
  const texte = String(valeur == null ? '' : valeur).trim();
  if (!texte) return null;

  /* Une des grammaires reconnue, mais un champ impossible (31 fevrier, 25 h) :
     la date est fausse, et aucune lecture tolerante ne la sauve. */
  let m = IMF.exec(texte);
  if (m) {
    const i = instant(+m[4], MOIS.indexOf(m[3]), +m[2], +m[5], +m[6], +m[7]);
    return i && { ms: i.ms, forme: 'imf', jourCoherent: JOURS[i.jour] === m[1] };
  }

  m = RFC850.exec(texte);
  if (m) {
    const courant = new Date(maintenant).getUTCFullYear();
    let annee = Math.floor(courant / 100) * 100 + Number(m[4]);
    let i = instant(annee, MOIS.indexOf(m[3]), +m[2], +m[5], +m[6], +m[7]);
    if (i && i.ms - maintenant > CINQUANTE_ANS_MS) {
      annee -= 100;
      i = instant(annee, MOIS.indexOf(m[3]), +m[2], +m[5], +m[6], +m[7]);
    }
    return i && { ms: i.ms, forme: 'rfc850', jourCoherent: JOURS_LONGS[i.jour] === m[1] };
  }

  m = ASCTIME.exec(texte);
  if (m) {
    const i = instant(+m[7], MOIS.indexOf(m[2]), Number(m[3].trim()), +m[4], +m[5], +m[6]);
    return i && { ms: i.ms, forme: 'asctime', jourCoherent: JOURS[i.jour] === m[1] };
  }

  /* Hors des trois formes : la forme IMF avec un autre fuseau, puis l ISO
     8601. Lues, mais signalees ; rien d autre n est devine. */
  m = IMF_ZONE.exec(texte);
  if (m) {
    const i = instant(+m[4], MOIS.indexOf(m[3]), +m[2], +m[5], +m[6], +m[7]);
    return i && { ms: i.ms - decalage(m[8]) * 60000, forme: 'autre', jourCoherent: JOURS[i.jour] === m[1] };
  }
  m = ISO.exec(texte);
  if (m) {
    const i = instant(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
    return i && { ms: i.ms - decalage(m[7]) * 60000, forme: 'autre', jourCoherent: true };
  }
  return null;
}

/** IMF-fixdate d un instant : la seule forme qu un serveur doit ecrire. */
export function ecrireDateHttp(ms) {
  const d = new Date(ms);
  const deux = n => String(n).padStart(2, '0');
  return JOURS[d.getUTCDay()] + ', ' + deux(d.getUTCDate()) + ' ' + MOIS[d.getUTCMonth()] + ' '
    + d.getUTCFullYear() + ' ' + deux(d.getUTCHours()) + ':' + deux(d.getUTCMinutes()) + ':'
    + deux(d.getUTCSeconds()) + ' GMT';
}

/* Les phrases que les lecteurs reprennent quand une date n est pas en forme. */
export const FAITS_DATE = {
  ancienne: 'forme ancienne ({forme}) : acceptee, mais un emetteur doit ecrire IMF-fixdate (RFC 9110 §5.6.7)',
  autre: 'date ecrite hors des trois formes HTTP (RFC 9110 §5.6.7) : lue tout de meme',
  jour: 'le jour de la semaine ne correspond pas a la date'
};

/** Les faits de forme d une date lue, au format { cle, texte, valeurs }. */
export function faitsDeDate(lue) {
  const faits = [];
  if (!lue) return faits;
  if (lue.forme === 'rfc850' || lue.forme === 'asctime') {
    faits.push({ cle: 'ancienne', texte: FAITS_DATE.ancienne, valeurs: { forme: lue.forme === 'rfc850' ? 'RFC 850' : 'asctime' } });
  }
  if (lue.forme === 'autre') faits.push({ cle: 'autre', texte: FAITS_DATE.autre, valeurs: {} });
  if (!lue.jourCoherent) faits.push({ cle: 'jour', texte: FAITS_DATE.jour, valeurs: {} });
  return faits;
}
