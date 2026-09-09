/* gRPC-Web — INTERCEPTOR (by NeoZ)
 *
 * gRPC ne passe pas tel quel dans un navigateur : HTTP/2 y est hors de portee
 * du code de page, et les trailers HTTP aussi. gRPC-Web est la variante que
 * les navigateurs parlent reellement, et c est donc celle que l on capture.
 *
 * Le corps est une suite de messages prefixes :
 *
 *     +--------+----------+----------------+
 *     | 1 octet| 4 octets |    charge      |
 *     | drapeau| longueur |                |
 *     +--------+----------+----------------+
 *
 *   drapeau bit 0 (0x01)  la charge est compressee
 *   drapeau bit 7 (0x80)  ce cadre porte les TRAILERS, pas un message :
 *                         sa charge est du texte « cle: valeur » a la HTTP/1
 *
 * Les trailers portent le verdict de l appel : `grpc-status` et
 * `grpc-message`. Un appel gRPC-Web peut donc repondre HTTP 200 tout en ayant
 * echoue — c est le piege classique, et le statut reel n est lisible que la.
 *
 * Deux encodages coexistent :
 *   application/grpc-web+proto        les octets bruts
 *   application/grpc-web-text+proto   les memes, en base64
 *
 * La charge des messages est du protobuf : on la confie au decodeur deja
 * present, sans le dupliquer.
 */
import { decoderProtobuf } from './binaires.js';

/* https://grpc.io/docs/guides/status-codes/ — le code de statut vit dans les
   trailers, jamais dans le statut HTTP. */
export const STATUTS_GRPC = {
  0: ['OK', 'succes'],
  1: ['CANCELLED', 'annule, en general par l appelant'],
  2: ['UNKNOWN', 'erreur inconnue'],
  3: ['INVALID_ARGUMENT', 'argument refuse par le serveur'],
  4: ['DEADLINE_EXCEEDED', 'echeance depassee avant la reponse'],
  5: ['NOT_FOUND', 'ressource introuvable'],
  6: ['ALREADY_EXISTS', 'la ressource existe deja'],
  7: ['PERMISSION_DENIED', 'droits insuffisants pour cette operation'],
  8: ['RESOURCE_EXHAUSTED', 'quota ou espace epuise'],
  9: ['FAILED_PRECONDITION', 'etat du systeme incompatible avec l appel'],
  10: ['ABORTED', 'interrompu, souvent un conflit de concurrence'],
  11: ['OUT_OF_RANGE', 'valeur hors des bornes acceptees'],
  12: ['UNIMPLEMENTED', 'operation non implementee par ce serveur'],
  13: ['INTERNAL', 'erreur interne : une invariante du serveur est rompue'],
  14: ['UNAVAILABLE', 'service indisponible, reessayer plus tard'],
  15: ['DATA_LOSS', 'perte de donnees irrecuperable'],
  16: ['UNAUTHENTICATED', 'authentification absente ou invalide']
};

/** Vrai si ce type de contenu annonce du gRPC-Web. */
export function estGrpcWeb(typeContenu) {
  return /^application\/grpc-web(-text)?(\+(proto|json|thrift))?\b/i
    .test(String(typeContenu || '').trim());
}

/** Vrai si ce type de contenu annonce la variante base64. */
export function estGrpcWebTexte(typeContenu) {
  return /^application\/grpc-web-text\b/i.test(String(typeContenu || '').trim());
}

/* Les trailers arrivent comme un bloc « cle: valeur » separe par CRLF, comme
   des entetes HTTP/1. */
function lireTrailers(octets) {
  const texte = new TextDecoder('utf-8', { fatal: false }).decode(octets);
  const trailers = {};
  for (const ligne of texte.split(/\r?\n/)) {
    if (!ligne.trim()) continue;
    const coupe = ligne.indexOf(':');
    if (coupe < 0) continue;
    /* Les noms de trailer gRPC sont en minuscules par convention ; on
       normalise pour que la lecture ne depende pas du serveur. */
    trailers[ligne.slice(0, coupe).trim().toLowerCase()] = ligne.slice(coupe + 1).trim();
  }
  return trailers;
}

/**
 * Decoupe un corps gRPC-Web en cadres.
 *
 * @param entree      Uint8Array, ou une chaine base64 pour la variante -text
 * @param options.texte  force la lecture base64
 * @returns { cadres, trailers, statut, complet }
 *          `complet` dit si le dernier cadre tenait entierement dans ce qui a
 *          ete capture : un corps tronque ne doit pas passer pour un corps
 *          entier.
 */
export function lireGrpcWeb(entree, options = {}) {
  let octets = entree;

  if (typeof entree === 'string') {
    const brut = entree.replace(/\s+/g, '');
    if (!/^[A-Za-z0-9+/]*={0,2}$/.test(brut)) {
      throw new Error('la variante -text attend du base64');
    }
    /* L alphabet ne suffit pas : « a » le respecte, mais atob le refuse, car
       le base64 se lit par groupes de quatre caracteres. Sans ce controle,
       l echec remonte en DOMException au lieu d un refus propre. */
    if (brut.length % 4 !== 0) {
      throw new Error('base64 tronque : ' + brut.length + ' caracteres, un multiple de 4 est attendu');
    }
    let binaire;
    try { binaire = atob(brut); }
    catch { throw new Error('base64 illisible'); }
    octets = new Uint8Array(binaire.length);
    for (let i = 0; i < binaire.length; i++) octets[i] = binaire.charCodeAt(i);
  } else if (!(octets instanceof Uint8Array)) {
    throw new Error('octets attendus : Uint8Array ou base64');
  }
  if (options.texte === false && typeof entree === 'string') {
    throw new Error('chaine fournie alors que la lecture binaire est demandee');
  }

  const cadres = [];
  let trailers = null;
  let i = 0;
  let complet = true;

  while (i < octets.length) {
    /* Cinq octets d en-tete au minimum : sans eux le cadre est tronque. */
    if (i + 5 > octets.length) { complet = false; break; }

    const drapeau = octets[i];
    /* Longueur sur 32 bits, gros-boutiste. DataView evite le decalage a la
       main, dont le << 24 deborderait en entier signe. */
    const longueur = new DataView(octets.buffer, octets.byteOffset + i + 1, 4).getUint32(0, false);
    const debut = i + 5;
    const fin = debut + longueur;

    if (fin > octets.length) {
      /* On signale le cadre annonce plutot que de le taire : savoir qu il
         manque des octets vaut mieux que croire le corps termine. */
      cadres.push({
        type: (drapeau & 0x80) ? 'trailers' : 'message',
        longueurAnnoncee: longueur,
        octetsPresents: Math.max(0, octets.length - debut),
        tronque: true
      });
      complet = false;
      break;
    }

    const charge = octets.subarray(debut, fin);

    if (drapeau & 0x80) {
      trailers = lireTrailers(charge);
      cadres.push({ type: 'trailers', drapeau, taille: longueur, trailers });
    } else {
      const cadre = {
        type: 'message',
        drapeau,
        taille: longueur,
        compresse: !!(drapeau & 0x01)
      };
      /* Un message compresse ne se lit pas sans defaire la compression, que
         le serveur annonce dans grpc-encoding. On le dit au lieu de rendre un
         decodage protobuf absurde sur des octets compresses. */
      if (!cadre.compresse) {
        try { cadre.protobuf = decoderProtobuf(charge); }
        catch (e) { cadre.erreur = e.message; }
      }
      cadres.push(cadre);
    }
    i = fin;
  }

  const out = { cadres, trailers, complet };

  if (trailers && trailers['grpc-status'] != null) {
    const code = Number(trailers['grpc-status']);
    const connu = STATUTS_GRPC[code];
    out.statut = {
      code,
      nom: connu ? connu[0] : 'code ' + code,
      sens: connu ? connu[1] : 'code hors de la table publiee',
      message: trailers['grpc-message'] ? decodeURIComponent(trailers['grpc-message']) : null,
      ok: code === 0
    };
  }
  return out;
}

/**
 * Une phrase disant ce que le corps contient. Elle sert de premiere lecture
 * dans le panneau de detail, avant d ouvrir les cadres un par un.
 */
export function resumerGrpcWeb(lu) {
  if (!lu || !lu.cadres) return null;
  const messages = lu.cadres.filter(c => c.type === 'message').length;
  const morceaux = [messages + ' message(s)'];

  if (lu.statut) {
    morceaux.push('grpc-status ' + lu.statut.code + ' ' + lu.statut.nom);
    if (lu.statut.message) morceaux.push('« ' + lu.statut.message + ' »');
  } else if (lu.cadres.length) {
    morceaux.push('aucun trailer : reponse incomplete ou flux en cours');
  }
  if (!lu.complet) morceaux.push('corps tronque');
  return morceaux.join(' · ');
}
