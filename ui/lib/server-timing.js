/* Server-Timing : ou le serveur a passe son temps
 * INTERCEPTOR (by NeoZ)
 *
 * Une requete a mis 214 ms. Combien le serveur en revendique-t-il ? C est la
 * seule question qui permette de savoir si le probleme est chez lui ou sur le
 * chemin, et l en-tete Server-Timing y repond — quand le serveur l envoie.
 *
 *   Server-Timing: db;dur=53, cache;desc="hit", app;dur=47.2;desc="Application"
 *
 * C est une liste de champs structures (RFC 9651) dont chaque element porte
 * deux parametres possibles : `dur`, en millisecondes, et `desc`, une phrase
 * libre. Les deux sont facultatifs — une mesure sans duree existe, et sert a
 * signaler un evenement plutot qu a le chronometrer (« cache;desc="hit" »).
 *
 * https://w3c.github.io/server-timing/
 *
 * Le rapprochement avec la duree mesuree par INTERCEPTOR est ce qui donne sa
 * valeur a la lecture. On ne dit pas « le serveur annonce 100 ms », on dit
 * « le serveur revendique 100 des 214 ms mesurees ; les 114 restantes sont
 * ailleurs ».
 */
import { lireListe } from './champs-structures.js';

/**
 * Lit un en-tete Server-Timing.
 *
 * @returns [{ nom, duree, description }] — `duree` vaut null quand le serveur
 *          n en annonce pas, ce qui est licite et frequent.
 */
export function lireServerTiming(valeur) {
  const brut = String(valeur == null ? '' : valeur).trim();
  if (!brut) return [];

  return lireListe(brut).map(element => {
    /* Le nom de la mesure est un jeton ; certains serveurs l envoient entre
       guillemets, ce que la specification n autorise pas mais qu on lit
       plutot que de rejeter tout l en-tete pour un seul element. */
    if (element.type !== 'jeton' && element.type !== 'chaine') {
      throw new Error('nom de mesure attendu, pas « ' + element.type + ' »');
    }

    const mesure = { nom: String(element.valeur), duree: null, description: null };
    for (const p of element.parametres || []) {
      if (p.cle === 'dur') {
        if (p.type !== 'entier' && p.type !== 'decimal') {
          throw new Error('« dur » doit etre un nombre, pas « ' + p.type + ' »');
        }
        mesure.duree = Number(p.valeur);
      } else if (p.cle === 'desc') {
        mesure.description = String(p.valeur);
      }
    }
    return mesure;
  });
}

/**
 * Confronte ce que le serveur revendique a la duree reellement mesuree.
 *
 * @param mesures  ce que rend lireServerTiming
 * @param dureeMs  la duree mesuree par la capture, ou null si inconnue
 * @returns { total, mesurees, sansDuree, reste, part }
 *          `reste` est ce que le serveur ne revendique PAS : reseau, file
 *          d attente, ce qu il a choisi de taire. `part` est la fraction
 *          revendiquee, entre 0 et 1, ou null si la duree est inconnue.
 */
export function comparerAuMesure(mesures, dureeMs) {
  const avecDuree = (mesures || []).filter(m => Number.isFinite(m.duree));
  const total = avecDuree.reduce((n, m) => n + m.duree, 0);

  const out = {
    total,
    mesurees: avecDuree.length,
    sansDuree: (mesures || []).length - avecDuree.length,
    reste: null,
    part: null
  };

  if (!Number.isFinite(dureeMs) || dureeMs <= 0) return out;

  /* Le total revendique peut depasser la duree mesuree : des mesures qui se
     chevauchent, ou un serveur qui compte du travail asynchrone. On le dit
     plutot que de rendre un reste negatif, qui n aurait aucun sens. */
  out.reste = Math.max(0, dureeMs - total);
  out.part = Math.min(1, total / dureeMs);
  out.depasse = total > dureeMs;
  return out;
}

/**
 * Ce que le serveur revendique, et ce qu il tait — en morceaux de gabarit.
 *
 * Chaque morceau porte sa cle et ses valeurs : l interface les traduit puis
 * les assemble. Une phrase collee ici ne correspondrait a aucune cle.
 *
 * @returns [{ cle, valeurs }] — vide quand il n y a rien a dire
 */
export function resumerServerTiming(mesures, dureeMs) {
  if (!mesures || !mesures.length) return [];
  const bilan = comparerAuMesure(mesures, dureeMs);
  const morceaux = [];

  if (bilan.mesurees) {
    morceaux.push({
      cle: '{n} mesure(s), {ms} ms revendiques',
      valeurs: { n: bilan.mesurees, ms: arrondir(bilan.total) }
    });
  }
  if (bilan.sansDuree) {
    morceaux.push({ cle: '{n} sans duree', valeurs: { n: bilan.sansDuree } });
  }
  if (bilan.depasse) {
    morceaux.push({
      cle: 'plus que la duree mesuree : mesures qui se chevauchent, ou travail asynchrone compte a part',
      valeurs: {}
    });
  } else if (bilan.reste != null) {
    morceaux.push({
      cle: '{ms} ms ailleurs — reseau, file d attente, ou temps que le serveur ne compte pas',
      valeurs: { ms: arrondir(bilan.reste) }
    });
  }
  return morceaux;
}

/* Deux decimales suffisent : au-dela on affiche du bruit de mesure. */
function arrondir(n) {
  return Math.round(n * 100) / 100;
}
