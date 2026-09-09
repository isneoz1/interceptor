/* Dictionnaire anglais — gRPC-Web — INTERCEPTOR (by NeoZ)
 *
 * Les noms du protocole ne se traduisent pas : « gRPC-Web », « grpc-status »
 * et « grpc-message » sont les identifiants exacts que porte le fil, et les
 * chercher dans une documentation ou un journal serveur suppose de les voir
 * tels quels. Seules les phrases qui les entourent changent de langue.
 */
export const EN_GRPC = {
  'gRPC-Web': 'gRPC-Web',
  'grpc-status': 'grpc-status',
  'grpc-message': 'grpc-message',
  'trailer ': 'trailer ',

  'Corps gRPC-Web illisible : {raison}': 'Unreadable gRPC-Web body: {raison}',
  'Aucun cadre de trailers : la reponse est incomplete, ou le flux est encore ouvert.':
    'No trailers frame: the response is incomplete, or the stream is still open.',
  'Le corps capture s arrete au milieu d un cadre : la limite de capture des corps est peut-etre atteinte.':
    'The captured body stops in the middle of a frame: the body capture limit may have been reached.',
  'Message {n}': 'Message {n}',
  '{a} octets annonces, {p} presents': '{a} bytes announced, {p} present',
  '{n} octets, compresses — voir grpc-encoding': '{n} bytes, compressed — see grpc-encoding',
  '{n} octets': '{n} bytes',

  /* Les codes de statut gRPC : le nom reste, le sens se traduit. */
  /* « succes » vit deja dans dict-en-ref-http.js : une cle ne se definit
     qu a un seul endroit. */
  'annule, en general par l appelant': 'cancelled, usually by the caller',
  'erreur inconnue': 'unknown error',
  'argument refuse par le serveur': 'argument rejected by the server',
  'echeance depassee avant la reponse': 'deadline passed before the response',
  'ressource introuvable': 'resource not found',
  'la ressource existe deja': 'the resource already exists',
  'droits insuffisants pour cette operation': 'insufficient rights for this operation',
  'quota ou espace epuise': 'quota or space exhausted',
  'etat du systeme incompatible avec l appel': 'system state incompatible with the call',
  'interrompu, souvent un conflit de concurrence': 'aborted, often a concurrency conflict',
  'valeur hors des bornes acceptees': 'value outside the accepted range',
  'operation non implementee par ce serveur': 'operation not implemented by this server',
  'erreur interne : une invariante du serveur est rompue':
    'internal error: a server invariant is broken',
  'service indisponible, reessayer plus tard': 'service unavailable, try again later',
  'perte de donnees irrecuperable': 'unrecoverable data loss',
  'authentification absente ou invalide': 'authentication missing or invalid',
  'code hors de la table publiee': 'code outside the published table'
};
