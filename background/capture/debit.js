/* Limiter le debit d une reponse — SWIFT (by D4RK)
 *
 * L outil « Throttle » de Charles, pour un hote : la page recoit le corps de
 * la reponse au debit demande, comme sur un reseau lent.
 *
 * Un seau a jetons : il se remplit au debit voulu et ne garde jamais plus
 * d une seconde d avance. Le debut de la reponse part donc tout de suite (la
 * premiere seconde), puis le reste au debit — et un serveur qui se tait
 * n accumule rien : sans ce plafond, trente secondes de silence laissaient
 * passer d un coup trente secondes de donnees (un flux SSE, une longue
 * attente, une page envoyee en deux temps).
 *
 * Au-dela de quatre secondes de donnees en attente (256 Ko au moins), le
 * limiteur demande au flux de se suspendre, et le reprend a la moitie : une
 * reponse de plusieurs centaines de Mo ne s entasse pas en memoire. L horloge
 * est monotone : un reglage de l heure du systeme ne bloque pas la remise.
 */
const PAS_MIN_MS = 20;
const PAS_MAX_MS = 250;
const FILE_MIN = 256 * 1024;

const horloge = typeof performance !== 'undefined' && typeof performance.now === 'function'
  ? () => performance.now() : () => Date.now();

/**
 * @param o.octetsParSeconde  debit voulu
 * @param o.ecrire(octets)    remet des octets a la page ; une exception (la
 *                            page est partie) arrete le limiteur
 * @param o.echec()           appelee une fois apres une ecriture qui echoue
 * @param o.fermer()          ferme le flux une fois tout remis
 * @param o.suspendre(), o.reprendre()  arreter et relancer l arrivee des octets
 * @param o.maintenant, o.attendre  l horloge (remplacables pour les tests)
 */
export function creerLimiteur({ octetsParSeconde, ecrire, fermer, suspendre = () => {}, reprendre = () => {},
  echec = () => {}, maintenant = horloge, attendre = (ms, f) => setTimeout(f, ms) }) {
  const debit = Math.max(1, octetsParSeconde);
  const fileHaute = Math.max(FILE_MIN, debit * 4);
  const file = [];
  let enFile = 0;
  let credit = debit;
  let derniere = null;
  let fini = false;
  let ferme = false;
  let programme = false;
  let arrete = false;
  let suspendu = false;

  /* Un flux laisse suspendu resterait suspendu : il est repris, meme a l arret. */
  function arreter() {
    arrete = true;
    file.length = 0;
    enFile = 0;
    if (suspendu) { suspendu = false; try { reprendre(); } catch { /* flux deja termine */ } }
  }

  function pomper() {
    programme = false;
    if (arrete || ferme) return;
    const t = maintenant();
    credit = Math.min(debit, credit + debit * Math.max(0, t - derniere) / 1000);
    derniere = t;
    while (credit >= 1 && file.length) {
      const tete = file[0];
      const n = Math.min(Math.floor(credit), tete.length);
      try { ecrire(n === tete.length ? tete : tete.subarray(0, n)); } catch { arreter(); echec(); return; }
      credit -= n;
      enFile -= n;
      if (n === tete.length) file.shift(); else file[0] = tete.subarray(n);
    }
    if (suspendu && enFile <= fileHaute / 2) { suspendu = false; reprendre(); }
    if (!file.length) {
      if (fini) { ferme = true; fermer(); }
      return;
    }
    /* Le temps qu il faut pour que la tranche suivante soit permise. */
    const attente = Math.ceil(1000 * Math.min(file[0].length, debit / 4) / debit);
    programme = true;
    attendre(Math.min(PAS_MAX_MS, Math.max(PAS_MIN_MS, attente)), pomper);
  }

  return {
    pousser(octets) {
      if (arrete || ferme || !octets || !octets.length) return;
      if (derniere == null) derniere = maintenant();
      file.push(octets);
      enFile += octets.length;
      if (!suspendu && enFile > fileHaute) { suspendu = true; suspendre(); }
      if (!programme) pomper();
    },
    terminer() {
      fini = true;
      if (derniere == null) derniere = maintenant();
      if (!programme) pomper();
    },
    /** Le flux a echoue ou la page est partie : plus rien ne s ecrit. */
    arreter
  };
}
