/* Integrite d un corps : Content-Digest, Repr-Digest, Digest
 * INTERCEPTOR (by NeoZ)
 *
 * Un serveur peut annoncer l empreinte de ce qu il envoie. Un client peut
 * annoncer celle de ce qu il envoie. Lire cette annonce n a qu un interet
 * limite — mais INTERCEPTOR a le corps sous la main, et peut donc faire ce
 * que personne d autre ne fait dans un navigateur : la VERIFIER.
 *
 * C est exactement la promesse du projet. On ne dit pas « le serveur annonce
 * sha-256=… », on dit « l empreinte annoncee correspond au corps recu », ou
 * « elle ne correspond pas », avec les deux valeurs sous les yeux.
 *
 * Deux syntaxes coexistent :
 *
 *   RFC 9530  Content-Digest: sha-256=:X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=:
 *             un dictionnaire de champs structures, valeurs en suite d octets
 *
 *   RFC 3230  Digest: SHA-256=X48E9qOokqqrvdts8nOJRJN3OWDUoyWxBf7kbu9DBPE=
 *             l ancienne forme, en clair, encore tres repandue
 *
 * Content-Digest porte sur les octets reellement transmis ; Repr-Digest porte
 * sur la representation avant tout encodage de transfert. La distinction
 * compte : sur une reponse compressee, les deux different, et comparer la
 * mauvaise conduit a crier au loup.
 */
import { lireDictionnaire } from './champs-structures.js';
import { octetsVersBase64, texteVersOctets } from './bytes.js';
import { md5Octets } from './hashes.js';

/* https://www.iana.org/assignments/http-digest-hash-alg — les noms sont
   normalises en minuscules par la RFC 9530. */
const ALGORITHMES = {
  'sha-256': { natif: 'SHA-256', sens: 'SHA-256, recommande' },
  'sha-512': { natif: 'SHA-512', sens: 'SHA-512, recommande' },
  'sha': { natif: 'SHA-1', sens: 'SHA-1, deconseille : collisions demontrees' },
  'md5': { natif: null, sens: 'MD5, deconseille : collisions triviales' },
  'unixsum': { natif: null, sens: 'somme de controle Unix, sans valeur cryptographique' },
  'unixcksum': { natif: null, sens: 'cksum Unix, sans valeur cryptographique' },
  'crc32c': { natif: null, sens: 'CRC32C, detecte une corruption, pas une alteration' },
  'adler': { natif: null, sens: 'Adler-32, detecte une corruption, pas une alteration' }
};

/** Les en-tetes qui portent une empreinte de corps, et ce sur quoi elle porte. */
export const ENTETES_INTEGRITE = {
  'content-digest': { forme: 'structure', porte: 'les octets transmis' },
  'repr-digest': { forme: 'structure', porte: 'la representation, avant encodage de transfert' },
  'digest': { forme: 'ancienne', porte: 'la representation (RFC 3230, forme heritee)' },
  'content-md5': { forme: 'md5', porte: 'les octets transmis (RFC 1864, obsolete)' }
};

/**
 * Lit une valeur d en-tete d integrite, quelle que soit sa syntaxe.
 *
 * @param nom     le nom de l en-tete, qui decide de la syntaxe attendue
 * @param valeur  sa valeur brute
 * @returns [{ algorithme, base64, sens, verifiable }]
 */
export function lireEmpreintes(nom, valeur) {
  const clef = String(nom || '').toLowerCase();
  const brut = String(valeur == null ? '' : valeur).trim();
  if (!brut) return [];

  const connu = ENTETES_INTEGRITE[clef];
  if (!connu) throw new Error('« ' + nom + ' » ne porte pas d empreinte de corps');

  /* Content-MD5 ne nomme pas son algorithme : l en-tete EST le nom. */
  if (connu.forme === 'md5') {
    return [decrire('md5', brut)];
  }

  if (connu.forme === 'structure') {
    /* Un dictionnaire de champs structures : les valeurs sont des suites
       d octets, que le lecteur rend deja decodees et en base64. */
    const entrees = lireDictionnaire(brut);
    return entrees.map(e => {
      if (e.type !== 'suite d octets') {
        throw new Error('« ' + e.cle + ' » devrait etre une suite d octets, pas ' + e.type);
      }
      return decrire(e.cle, e.base64);
    });
  }

  /* RFC 3230 : « nom=base64 », separes par des virgules. Le base64 contient
     lui-meme des « = » de remplissage, d ou le decoupage au PREMIER seulement. */
  return brut.split(',').map(morceau => {
    const t = morceau.trim();
    const egal = t.indexOf('=');
    if (egal < 0) throw new Error('forme « algorithme=valeur » attendue : « ' + t.slice(0, 30) + ' »');
    return decrire(t.slice(0, egal).trim().toLowerCase(), t.slice(egal + 1).trim());
  });
}

function decrire(algorithme, base64) {
  const connu = ALGORITHMES[algorithme];
  return {
    algorithme,
    base64,
    sens: connu ? connu.sens : 'algorithme hors du registre IANA',
    /* Ce qu on peut recalculer ici, et donc confronter au corps. Le dire
       evite de laisser croire qu une absence de verdict vaut approbation. */
    verifiable: !!connu && (connu.natif !== null || algorithme === 'md5')
  };
}

/**
 * Recalcule l empreinte du corps et la confronte a celle annoncee.
 *
 * @param nom     le nom de l en-tete
 * @param valeur  sa valeur brute
 * @param corps   Uint8Array ou chaine — les octets sur lesquels porter le calcul
 * @returns [{ algorithme, annonce, calcule, verdict }]
 *          `verdict` vaut 'correspond', 'differe', ou 'non verifiable ici'
 */
export async function verifierEmpreintes(nom, valeur, corps) {
  const octets = corps instanceof Uint8Array ? corps : texteVersOctets(corps);
  const annonces = lireEmpreintes(nom, valeur);
  const sortie = [];

  for (const e of annonces) {
    if (!e.verifiable) {
      sortie.push({ ...e, annonce: e.base64, calcule: null, verdict: 'non verifiable ici' });
      continue;
    }
    let calcule;
    try {
      calcule = await calculer(e.algorithme, octets);
    } catch (erreur) {
      sortie.push({ ...e, annonce: e.base64, calcule: null,
        verdict: 'non verifiable ici', raison: erreur.message });
      continue;
    }
    sortie.push({
      ...e,
      annonce: e.base64,
      calcule,
      verdict: calcule === e.base64 ? 'correspond' : 'differe'
    });
  }
  return sortie;
}

async function calculer(algorithme, octets) {
  if (algorithme === 'md5') return octetsVersBase64(md5Octets(octets));

  const connu = ALGORITHMES[algorithme];
  if (!connu || !connu.natif) throw new Error('algorithme non calculable ici : ' + algorithme);
  const sujet = globalThis.crypto && globalThis.crypto.subtle;
  if (!sujet) throw new Error('crypto.subtle indisponible dans ce contexte');
  const tampon = await sujet.digest(connu.natif, octets);
  return octetsVersBase64(new Uint8Array(tampon));
}

/**
 * Ce que la verification a montre, sous forme de gabarit a remplir.
 *
 * Une phrase collee a l execution ne correspondrait a aucune cle de
 * traduction — et c est justement celle qui porte le verdict.
 *
 * @returns { cle, valeurs } ou null quand il n y a rien a dire
 */
export function resumerVerification(resultats) {
  if (!resultats || !resultats.length) return null;

  const differents = resultats.filter(r => r.verdict === 'differe');
  if (differents.length) {
    return {
      cle: 'empreinte annoncee non conforme au corps recu ({liste})',
      valeurs: { liste: differents.map(r => r.algorithme).join(', ') }
    };
  }
  const verifies = resultats.filter(r => r.verdict === 'correspond');
  if (verifies.length) {
    return {
      cle: 'corps conforme a l empreinte annoncee ({liste})',
      valeurs: { liste: verifies.map(r => r.algorithme).join(', ') }
    };
  }
  return { cle: 'empreinte annoncee, non verifiable dans ce contexte', valeurs: {} };
}

/**
 * Lit Want-Content-Digest / Want-Repr-Digest : ce que l autre partie
 * PREFERE recevoir, par ordre de preference decroissant.
 *
 * La forme est un dictionnaire dont chaque valeur est un entier de 0 a 10.
 * Zero ne veut pas dire « peu » mais « surtout pas » : le confondre conduit a
 * envoyer exactement ce qui a ete refuse.
 */
export function lirePreferences(valeur) {
  const entrees = lireDictionnaire(String(valeur == null ? '' : valeur).trim());
  return entrees
    .map(e => {
      const poids = Number(e.valeur);
      if (!Number.isInteger(poids) || poids < 0 || poids > 10) {
        throw new Error('« ' + e.cle + ' » : un entier de 0 a 10 est attendu');
      }
      const connu = ALGORITHMES[e.cle];
      return {
        algorithme: e.cle,
        poids,
        refuse: poids === 0,
        sens: connu ? connu.sens : 'algorithme hors du registre IANA'
      };
    })
    .sort((a, b) => b.poids - a.poids);
}
