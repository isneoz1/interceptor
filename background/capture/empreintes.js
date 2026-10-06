/* Empreintes du corps recu, calculees sur les VRAIS octets — SWIFT (by NeoZ)
 *
 * Deux empreintes ne portent pas sur les memes octets :
 *
 *   Content-Digest, Repr-Digest, Digest, Content-MD5 (RFC 9530, 3230, 1864)
 *     portent sur le contenu tel que le serveur l a CODE : si la reponse est
 *     compressee (Content-Encoding: gzip), c est le flux gzip qui est hache.
 *
 *   L integrite de sous-ressource (SRI, attribut `integrity`)
 *     porte sur le corps DECODE, celui que le chargeur de script recoit.
 *
 * Ce que le filtre de flux recoit : Firefox l installe en exigeant que le
 * decodage de Content-Encoding soit fait AVANT lui (StreamFilterParent.cpp,
 * SetNewListener(this, aMustApplyContentConversion = true)). Le filtre voit donc
 * d ordinaire le corps deja decode — et il le transmet tel quel a la page.
 * D ou :
 *
 *   SRI      se calcule sur ces octets-la : ce sont exactement ceux que le
 *            chargeur recoit, puisque le filtre les lui passe sans y toucher ;
 *   Content-Digest ne se verifie sur eux que s il n y avait aucun codage. Avec
 *            un codage, le flux code n a en general jamais ete vu ; seul un
 *            accord prouve alors quelque chose — des octets qui redonnent
 *            l empreinte annoncee sont ceux qu elle couvre. Un desaccord ne
 *            prouve rien, et on dit pourquoi au lieu d affirmer « differe ».
 *
 * Le corps conserve pour l affichage est du texte : decode, sans BOM, parfois
 * converti depuis un autre jeu de caracteres. Le hacher de nouveau ne rendrait
 * pas les octets d origine. On calcule donc ici, a la capture, sur les octets
 * exacts.
 */
import { ENTETES_INTEGRITE, verifierEmpreintes } from '../../ui/lib/integrite.js';
import { octetsVersBase64 } from '../../ui/lib/bytes.js';
import { headerGet } from '../lib/util.js';
import { store } from '../core/store.js';

/* Les codages dont un flux porte une signature reconnaissable. Des octets qui
   ne la portent pas ne sont pas ce flux : Firefox les a donc decodes. Brotli
   n a pas de signature, et deflate est parfois envoye sans son en-tete zlib :
   pour eux, l absence de signature ne prouve rien. */
const SIGNATURES = {
  gzip: o => o.length > 2 && o[0] === 0x1f && o[1] === 0x8b,
  'x-gzip': o => o.length > 2 && o[0] === 0x1f && o[1] === 0x8b,
  zstd: o => o.length > 4 && o[0] === 0x28 && o[1] === 0xb5 && o[2] === 0x2f && o[3] === 0xfd
};

/* Pourquoi une empreinte n est pas verifiee ou pas donnee : des gabarits,
   traduits a l affichage, exportes pour que le controle de traduction les voie. */
export const RAISONS = {
  tronque: 'corps tronque a la capture : l empreinte porte sur le corps entier',
  dejaDecode: 'le corps est arrive deja decode ({codage}) : l empreinte porte sur le flux code, qui n a pas ete vu',
  codeNonProuve: 'l empreinte ne correspond pas aux octets recus, et rien ne prouve qu ils sont le flux code ({codage}) : pas de verdict',
  partielle: 'reponse partielle (206) : Repr-Digest porte sur la representation entiere',
  illisible: 'en-tete illisible : {erreur}'
};

/**
 * Les empreintes d un corps, a reporter sur celui qui le remplace : elles
 * portent sur les octets du filtre, pas sur l objet affiche, et restent vraies.
 */
export function empreintesDe(corps) {
  const out = {};
  for (const cle of ['integrite', 'sri', 'sriRaison']) {
    if (corps && corps[cle] !== undefined) out[cle] = corps[cle];
  }
  return out;
}

/* Les types qu une balise peut charger avec un attribut `integrity`. */
const TYPES_SRI = new Set(['script', 'stylesheet']);

/* Le dernier codage de la liste est le dernier applique : c est sa signature
   que porterait un flux encore code (RFC 9110, 8.4). */
function dernierCodage(codage) {
  const liste = codage.split(',').map(s => s.trim()).filter(Boolean);
  return liste.length ? liste[liste.length - 1] : '';
}

/**
 * Ce qu une verification a le droit d affirmer.
 * @returns { resultats } ou { raison }
 */
function jugerVerification(resultats, codage, recus) {
  if (!resultats.some(r => r.verdict === 'differe')) return { resultats };
  /* Un accord, meme sur un seul algorithme, prouve que ce sont les bons
     octets : un desaccord sur un autre est alors reel. */
  if (resultats.some(r => r.verdict === 'correspond')) return { resultats };
  if (!codage || codage === 'identity') return { resultats };
  const signature = SIGNATURES[dernierCodage(codage)];
  if (signature && !signature(recus)) return { raison: RAISONS.dejaDecode };
  return { raison: RAISONS.codeNonProuve };
}

/**
 * @param rec    l enregistrement, dont le corps vient d etre pose
 * @param recus  les octets tels que le filtre les a remis — et tels qu il les
 *               a transmis a la page
 * @param meta   { contentEncoding, truncated, status }
 */
export async function empreintesDeReponse(rec, recus, meta) {
  const codage = String(meta.contentEncoding || '').toLowerCase().trim();

  /* --- Content-Digest et consorts --- */
  const verifications = [];
  for (const nom of Object.keys(ENTETES_INTEGRITE)) {
    const valeur = headerGet(rec.responseHeaders, nom);
    if (!valeur) continue;
    if (meta.truncated) { verifications.push({ entete: nom, raison: RAISONS.tronque, valeurs: {} }); continue; }
    if (nom === 'repr-digest' && meta.status === 206) {
      verifications.push({ entete: nom, raison: RAISONS.partielle, valeurs: {} });
      continue;
    }
    try {
      const juge = jugerVerification(await verifierEmpreintes(nom, valeur, recus), codage, recus);
      verifications.push(juge.raison
        ? { entete: nom, raison: juge.raison, valeurs: { codage } }
        : { entete: nom, resultats: juge.resultats });
    } catch (e) {
      verifications.push({ entete: nom, raison: RAISONS.illisible, valeurs: { erreur: String(e.message || e) } });
    }
  }

  /* --- Integrite de sous-ressource --- */
  let sri = null;
  let sriRaison = null;
  if (TYPES_SRI.has(rec.type)) {
    if (meta.truncated) sriRaison = RAISONS.tronque;
    else if (globalThis.crypto && globalThis.crypto.subtle) {
      sri = {};
      for (const [cle, algo] of [['sha256', 'SHA-256'], ['sha384', 'SHA-384'], ['sha512', 'SHA-512']]) {
        const tampon = await globalThis.crypto.subtle.digest(algo, recus);
        sri[cle] = cle + '-' + octetsVersBase64(new Uint8Array(tampon));
      }
    }
  }

  /* Pose sur le corps ACTUEL, lu apres les calculs : pendant qu ils tournaient,
     un corps rapporte par la page a pu remplacer celui-ci. */
  const corps = rec.responseBody;
  if (!corps) return;
  if (verifications.length) corps.integrite = verifications;
  if (sri) corps.sri = sri;
  if (sriRaison) corps.sriRaison = sriRaison;
  store.touch(rec.id);
}
