/* Table de reference HTTP — INTERCEPTOR (by NeoZ)
 *
 * Codes de statut et methodes, tels que le registre IANA les publie. Cette
 * table sert la boite a outils, mais aussi tout affichage qui veut expliquer
 * un code au lieu de le montrer nu.
 *
 * Aucune invention : un code absent du registre est absent d ici.
 */

/** Codes de statut : numero, nom d origine, et ce qu il signifie vraiment. */
export const STATUTS = [
  [100, 'Continue', 'Le serveur accepte les entetes, le client peut envoyer le corps.'],
  [101, 'Switching Protocols', 'Changement de protocole accepte : c est ainsi que demarre un WebSocket.'],
  [102, 'Processing', 'Traitement en cours (WebDAV), la reponse finale viendra plus tard.'],
  [103, 'Early Hints', 'Entetes envoyes en avance pour precharger des ressources.'],

  [200, 'OK', 'Succes. Le corps porte le resultat demande.'],
  [201, 'Created', 'Ressource creee. L entete Location indique ou.'],
  [202, 'Accepted', 'Demande acceptee, traitement differe : rien ne garantit le succes final.'],
  [203, 'Non-Authoritative Information', 'Reponse modifiee par un intermediaire.'],
  [204, 'No Content', 'Succes sans corps. Frequent apres une suppression.'],
  [205, 'Reset Content', 'Succes ; le client doit reinitialiser le formulaire affiche.'],
  [206, 'Partial Content', 'Fragment envoye : reponse a un entete Range.'],
  [207, 'Multi-Status', 'Plusieurs statuts dans un corps XML (WebDAV).'],
  [208, 'Already Reported', 'Element deja decrit plus haut dans la reponse (WebDAV).'],
  [226, 'IM Used', 'Le resultat est une transformation de la ressource (RFC 3229).'],

  [300, 'Multiple Choices', 'Plusieurs representations possibles.'],
  [301, 'Moved Permanently', 'Deplacement definitif : les liens doivent etre mis a jour.'],
  [302, 'Found', 'Deplacement temporaire. La methode peut changer en GET.'],
  [303, 'See Other', 'Voir ailleurs, en GET : le motif « rediriger apres un envoi ».'],
  [304, 'Not Modified', 'Le cache du client est encore bon : aucun corps renvoye.'],
  [305, 'Use Proxy', 'Obsolete, jamais implemente correctement.'],
  [307, 'Temporary Redirect', 'Deplacement temporaire, methode et corps conserves.'],
  [308, 'Permanent Redirect', 'Deplacement definitif, methode et corps conserves.'],

  [400, 'Bad Request', 'Requete mal formee : le serveur refuse de l interpreter.'],
  [401, 'Unauthorized', 'Authentification absente ou invalide. Voir WWW-Authenticate.'],
  [402, 'Payment Required', 'Reserve, employe par certaines API pour un quota epuise.'],
  [403, 'Forbidden', 'Authentifie mais sans droit : reessayer ne changera rien.'],
  [404, 'Not Found', 'Ressource inconnue a cette adresse.'],
  [405, 'Method Not Allowed', 'Methode refusee ici. L entete Allow liste celles admises.'],
  [406, 'Not Acceptable', 'Aucune representation ne convient a l entete Accept.'],
  [407, 'Proxy Authentication Required', 'Le mandataire exige une authentification.'],
  [408, 'Request Timeout', 'Le client a mis trop de temps a envoyer sa requete.'],
  [409, 'Conflict', 'Conflit avec l etat courant : version concurrente, doublon.'],
  [410, 'Gone', 'Supprime volontairement et definitivement.'],
  [411, 'Length Required', 'Content-Length obligatoire pour cette requete.'],
  [412, 'Precondition Failed', 'Une condition (If-Match, If-Unmodified-Since) a echoue.'],
  [413, 'Content Too Large', 'Corps trop volumineux pour le serveur.'],
  [414, 'URI Too Long', 'URL trop longue : passer les parametres dans le corps.'],
  [415, 'Unsupported Media Type', 'Type de contenu refuse. Verifier Content-Type.'],
  [416, 'Range Not Satisfiable', 'Plage demandee hors de la ressource.'],
  [417, 'Expectation Failed', 'L attente declaree par Expect ne peut etre tenue.'],
  [418, 'I am a teapot', 'Plaisanterie du RFC 2324, parfois employee comme refus poli.'],
  [421, 'Misdirected Request', 'Requete arrivee sur un serveur qui ne sert pas cette autorite.'],
  [422, 'Unprocessable Content', 'Syntaxe correcte, contenu invalide : echec de validation.'],
  [423, 'Locked', 'Ressource verrouillee (WebDAV).'],
  [424, 'Failed Dependency', 'Echec du a une requete precedente (WebDAV).'],
  [425, 'Too Early', 'Rejoue trop tot : risque de rejeu sur une reprise TLS.'],
  [426, 'Upgrade Required', 'Le serveur exige un autre protocole.'],
  [428, 'Precondition Required', 'Le serveur exige une requete conditionnelle.'],
  [429, 'Too Many Requests', 'Limitation de debit. Voir Retry-After.'],
  [431, 'Request Header Fields Too Large', 'Entetes trop volumineux : souvent un cookie trop gros.'],
  [451, 'Unavailable For Legal Reasons', 'Bloque pour raison juridique.'],

  [500, 'Internal Server Error', 'Erreur non traitee cote serveur.'],
  [501, 'Not Implemented', 'Methode inconnue du serveur.'],
  [502, 'Bad Gateway', 'Reponse invalide recue d un serveur en amont.'],
  [503, 'Service Unavailable', 'Service indisponible : surcharge ou maintenance.'],
  [504, 'Gateway Timeout', 'Le serveur en amont n a pas repondu a temps.'],
  [505, 'HTTP Version Not Supported', 'Version du protocole refusee.'],
  [506, 'Variant Also Negotiates', 'Mauvaise configuration de negociation de contenu.'],
  [507, 'Insufficient Storage', 'Plus d espace pour terminer (WebDAV).'],
  [508, 'Loop Detected', 'Boucle infinie detectee (WebDAV).'],
  [510, 'Not Extended', 'Extension requise par le serveur.'],
  [511, 'Network Authentication Required', 'Portail captif : il faut d abord s authentifier au reseau.']
].map(([code, nom, sens]) => ({ code, nom, sens }));

/** Famille d un code : la premiere chose a lire dans un tableau de trafic. */
export function familleStatut(code) {
  const n = Number(code);
  if (n >= 100 && n < 200) return 'information';
  if (n >= 200 && n < 300) return 'succes';
  if (n >= 300 && n < 400) return 'redirection';
  if (n >= 400 && n < 500) return 'erreur du client';
  if (n >= 500 && n < 600) return 'erreur du serveur';
  return 'hors norme';
}

/** Description d un code, ou null s il n appartient pas au registre. */
export function decrireStatut(code) {
  return STATUTS.find(s => s.code === Number(code)) || null;
}

/** Methodes normalisees, avec leurs proprietes reelles. */
export const METHODES = [
  ['GET', 'Lire une ressource.', true, true, true],
  ['HEAD', 'Comme GET, sans le corps : on ne recupere que les entetes.', true, true, false],
  ['POST', 'Soumettre des donnees, souvent pour creer.', false, false, true],
  ['PUT', 'Remplacer entierement une ressource.', false, true, true],
  ['PATCH', 'Modifier partiellement une ressource.', false, false, true],
  ['DELETE', 'Supprimer une ressource.', false, true, false],
  ['CONNECT', 'Ouvrir un tunnel a travers un mandataire.', false, false, false],
  ['OPTIONS', 'Demander les capacites : c est la requete preliminaire CORS.', true, true, true],
  ['TRACE', 'Renvoyer la requete telle que recue. Souvent desactivee.', true, true, false]
].map(([nom, sens, sure, idempotente, cachable]) => ({ nom, sens, sure, idempotente, cachable }));

export function decrireMethode(nom) {
  return METHODES.find(m => m.nom === String(nom || '').toUpperCase()) || null;
}
