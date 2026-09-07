/* Dictionnaire anglais — codes de statut et methodes HTTP
 * INTERCEPTOR (by D4RK)
 *
 * Traduction des descriptions de ref-http.js. La cle reste le texte francais.
 */
export const EN_REF_HTTP = {
  'Le serveur accepte les entetes, le client peut envoyer le corps.':
    'The server accepts the headers, the client may send the body.',
  'Changement de protocole accepte : c est ainsi que demarre un WebSocket.':
    'Protocol switch accepted: this is how a WebSocket starts.',
  'Traitement en cours (WebDAV), la reponse finale viendra plus tard.':
    'Processing (WebDAV), the final response will come later.',
  'Entetes envoyes en avance pour precharger des ressources.':
    'Headers sent early to preload resources.',
  'Succes. Le corps porte le resultat demande.': 'Success. The body carries the requested result.',
  'Ressource creee. L entete Location indique ou.': 'Resource created. The Location header says where.',
  'Demande acceptee, traitement differe : rien ne garantit le succes final.':
    'Request accepted, processing deferred: nothing guarantees final success.',
  'Reponse modifiee par un intermediaire.': 'Response altered by an intermediary.',
  'Succes sans corps. Frequent apres une suppression.': 'Success with no body. Common after a deletion.',
  'Succes ; le client doit reinitialiser le formulaire affiche.':
    'Success; the client should reset the displayed form.',
  'Fragment envoye : reponse a un entete Range.': 'Fragment sent: answer to a Range header.',
  'Plusieurs statuts dans un corps XML (WebDAV).': 'Several statuses in an XML body (WebDAV).',
  'Element deja decrit plus haut dans la reponse (WebDAV).':
    'Element already described earlier in the response (WebDAV).',
  'Le resultat est une transformation de la ressource (RFC 3229).':
    'The result is a transformation of the resource (RFC 3229).',
  'Plusieurs representations possibles.': 'Several possible representations.',
  'Deplacement definitif : les liens doivent etre mis a jour.':
    'Permanent move: links should be updated.',
  'Deplacement temporaire. La methode peut changer en GET.':
    'Temporary move. The method may change to GET.',
  'Voir ailleurs, en GET : le motif « rediriger apres un envoi ».':
    'See elsewhere, with GET: the « redirect after post » pattern.',
  'Le cache du client est encore bon : aucun corps renvoye.':
    'The client cache is still valid: no body is sent back.',
  'Obsolete, jamais implemente correctement.': 'Obsolete, never implemented properly.',
  'Deplacement temporaire, methode et corps conserves.':
    'Temporary move, method and body preserved.',
  'Deplacement definitif, methode et corps conserves.':
    'Permanent move, method and body preserved.',
  'Requete mal formee : le serveur refuse de l interpreter.':
    'Malformed request: the server refuses to interpret it.',
  'Authentification absente ou invalide. Voir WWW-Authenticate.':
    'Authentication missing or invalid. See WWW-Authenticate.',
  'Reserve, employe par certaines API pour un quota epuise.':
    'Reserved, used by some APIs for an exhausted quota.',
  'Authentifie mais sans droit : reessayer ne changera rien.':
    'Authenticated but not allowed: retrying will change nothing.',
  'Ressource inconnue a cette adresse.': 'Unknown resource at this address.',
  'Methode refusee ici. L entete Allow liste celles admises.':
    'Method refused here. The Allow header lists the permitted ones.',
  'Aucune representation ne convient a l entete Accept.':
    'No representation matches the Accept header.',
  'Le mandataire exige une authentification.': 'The proxy demands authentication.',
  'Le client a mis trop de temps a envoyer sa requete.':
    'The client took too long to send its request.',
  'Conflit avec l etat courant : version concurrente, doublon.':
    'Conflict with the current state: concurrent version, duplicate.',
  'Supprime volontairement et definitivement.': 'Deliberately and permanently removed.',
  'Content-Length obligatoire pour cette requete.': 'Content-Length is required for this request.',
  'Une condition (If-Match, If-Unmodified-Since) a echoue.':
    'A condition (If-Match, If-Unmodified-Since) failed.',
  'Corps trop volumineux pour le serveur.': 'Body too large for the server.',
  'URL trop longue : passer les parametres dans le corps.':
    'URL too long: move the parameters into the body.',
  'Type de contenu refuse. Verifier Content-Type.': 'Content type refused. Check Content-Type.',
  'Plage demandee hors de la ressource.': 'Requested range outside the resource.',
  'L attente declaree par Expect ne peut etre tenue.':
    'The expectation declared by Expect cannot be met.',
  'Plaisanterie du RFC 2324, parfois employee comme refus poli.':
    'A joke from RFC 2324, sometimes used as a polite refusal.',
  'Requete arrivee sur un serveur qui ne sert pas cette autorite.':
    'Request landed on a server that does not serve this authority.',
  'Syntaxe correcte, contenu invalide : echec de validation.':
    'Correct syntax, invalid content: validation failure.',
  'Ressource verrouillee (WebDAV).': 'Resource locked (WebDAV).',
  'Echec du a une requete precedente (WebDAV).': 'Failure caused by an earlier request (WebDAV).',
  'Rejoue trop tot : risque de rejeu sur une reprise TLS.':
    'Replayed too early: replay risk on a TLS resumption.',
  'Le serveur exige un autre protocole.': 'The server requires a different protocol.',
  'Le serveur exige une requete conditionnelle.': 'The server requires a conditional request.',
  'Limitation de debit. Voir Retry-After.': 'Rate limiting. See Retry-After.',
  'Entetes trop volumineux : souvent un cookie trop gros.':
    'Headers too large: often an oversized cookie.',
  'Bloque pour raison juridique.': 'Blocked for legal reasons.',
  'Erreur non traitee cote serveur.': 'Unhandled error on the server side.',
  'Methode inconnue du serveur.': 'Method unknown to the server.',
  'Reponse invalide recue d un serveur en amont.': 'Invalid response received from an upstream server.',
  'Service indisponible : surcharge ou maintenance.': 'Service unavailable: overload or maintenance.',
  'Le serveur en amont n a pas repondu a temps.': 'The upstream server did not answer in time.',
  'Version du protocole refusee.': 'Protocol version refused.',
  'Mauvaise configuration de negociation de contenu.': 'Content negotiation misconfiguration.',
  'Plus d espace pour terminer (WebDAV).': 'No space left to finish (WebDAV).',
  'Boucle infinie detectee (WebDAV).': 'Infinite loop detected (WebDAV).',
  'Extension requise par le serveur.': 'Extension required by the server.',
  'Portail captif : il faut d abord s authentifier au reseau.':
    'Captive portal: you must authenticate to the network first.',

  /* -------------------------------- Familles ------------------------------ */
  'information': 'informational',
  'succes': 'success',
  'redirection': 'redirection',
  'erreur du client': 'client error',
  'erreur du serveur': 'server error',
  'hors norme': 'outside the standard',

  /* -------------------------------- Methodes ------------------------------ */
  'Lire une ressource.': 'Read a resource.',
  'Comme GET, sans le corps : on ne recupere que les entetes.':
    'Like GET, without the body: only the headers come back.',
  'Soumettre des donnees, souvent pour creer.': 'Submit data, usually to create something.',
  'Remplacer entierement une ressource.': 'Replace a resource entirely.',
  'Modifier partiellement une ressource.': 'Partially modify a resource.',
  'Supprimer une ressource.': 'Delete a resource.',
  'Ouvrir un tunnel a travers un mandataire.': 'Open a tunnel through a proxy.',
  'Demander les capacites : c est la requete preliminaire CORS.':
    'Ask for capabilities: this is the CORS preflight request.',
  'Renvoyer la requete telle que recue. Souvent desactivee.':
    'Echo the request as received. Often disabled.'
};
