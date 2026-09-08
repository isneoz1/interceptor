/* Dictionnaire anglais — descriptions des entetes HTTP
 * INTERCEPTOR (by NeoZ)
 *
 * Traduction des descriptions de ref-entetes.js. La cle reste le texte francais.
 */
export const EN_REF_ENTETES = {
  'Types de contenu que le client sait lire, par ordre de preference.':
    'Content types the client can read, in order of preference.',
  'Jeux de caracteres acceptes. Abandonne par les navigateurs modernes.':
    'Accepted character sets. Dropped by modern browsers.',
  'Compressions acceptees : gzip, br, deflate, zstd.':
    'Accepted compressions: gzip, br, deflate, zstd.',
  'Langues souhaitees. Sert aussi au pistage par empreinte.':
    'Preferred languages. Also used for fingerprint tracking.',
  'Le serveur accepte les requetes partielles (« bytes »).':
    'The server accepts partial requests (« bytes »).',
  'Compression appliquee au corps.': 'Compression applied to the body.',
  'Langue du contenu.': 'Language of the content.',
  'Taille du corps en octets.': 'Size of the body in bytes.',
  'Adresse directe de la representation renvoyee.': 'Direct address of the returned representation.',
  'Portion envoyee et taille totale.': 'Portion sent and total size.',
  'Type de media du corps, et son encodage de caracteres.':
    'Media type of the body, and its character encoding.',
  'Affichage direct ou telechargement, avec nom de fichier.':
    'Inline display or download, with a file name.',
  'Demande une portion seulement : reprise de telechargement, lecture video.':
    'Asks for a portion only: resumed download, video playback.',
  'Encodage de transport, « chunked » le plus souvent.':
    'Transport encoding, most often « chunked ».',
  'Encodages de transfert acceptes par le client.': 'Transfer encodings the client accepts.',
  'Annonce les entetes envoyes apres le corps.': 'Announces the headers sent after the body.',
  'Entetes qui font varier la reponse : cle de cache reelle.':
    'Headers that make the response vary: the real cache key.',
  'Temps passe dans un cache intermediaire, en secondes.':
    'Time spent in an intermediate cache, in seconds.',
  'Regles de cache : no-store, max-age, private, immutable.':
    'Cache rules: no-store, max-age, private, immutable.',
  'Demande au navigateur d effacer cookies, cache ou stockage.':
    'Asks the browser to clear cookies, cache or storage.',
  'Empreinte de la representation, pour la revalidation.':
    'Fingerprint of the representation, for revalidation.',
  'Date de peremption. Ecrase par Cache-Control: max-age.':
    'Expiry date. Overridden by Cache-Control: max-age.',
  'N applique la requete que si l ETag correspond.':
    'Applies the request only if the ETag matches.',
  'Ne renvoie le corps que s il a change depuis cette date.':
    'Sends the body back only if it changed since this date.',
  'Revalidation par ETag : rend 304 si rien n a change.':
    'ETag revalidation: returns 304 if nothing changed.',
  'Reprend le telechargement seulement si la ressource est intacte.':
    'Resumes the download only if the resource is unchanged.',
  'N applique la requete que si rien n a change depuis cette date.':
    'Applies the request only if nothing changed since this date.',
  'Date de derniere modification connue.': 'Last known modification date.',
  'Ancetre de Cache-Control, conserve pour compatibilite.':
    'Ancestor of Cache-Control, kept for compatibility.',
  'Identifiants du client : Basic, Bearer, Digest. A traiter comme un secret.':
    'Client credentials: Basic, Bearer, Digest. To be treated as a secret.',
  'Le mandataire reclame une authentification.': 'The proxy demands authentication.',
  'Identifiants destines au mandataire.': 'Credentials meant for the proxy.',
  'Methode d authentification attendue, avec son domaine.':
    'Expected authentication scheme, with its realm.',
  'Cookies renvoyes au serveur. Secret par nature.':
    'Cookies sent back to the server. Secret by nature.',
  'Pose un cookie, avec ses attributs Secure, HttpOnly, SameSite.':
    'Sets a cookie, with its Secure, HttpOnly and SameSite attributes.',
  'Autorise l envoi des cookies en requete croisee.':
    'Allows cookies to be sent on a cross-origin request.',
  'Entetes autorises en requete croisee.': 'Headers allowed on a cross-origin request.',
  'Methodes autorisees en requete croisee.': 'Methods allowed on a cross-origin request.',
  'Origines autorisees. « * » interdit l envoi des cookies.':
    'Allowed origins. « * » forbids sending cookies.',
  'Entetes lisibles par le script appelant.': 'Headers readable by the calling script.',
  'Duree de validite de la reponse preliminaire.': 'Lifetime of the preflight response.',
  'Entetes que la vraie requete emploiera.': 'Headers the real request will use.',
  'Methode que la vraie requete emploiera.': 'Method the real request will use.',
  'Origine de la page a l initiative de la requete.': 'Origin of the page that started the request.',
  'Autorise la lecture des mesures de temps detaillees.':
    'Allows reading the detailed timing measurements.',
  'Sources autorisees pour scripts, styles et images.':
    'Allowed sources for scripts, styles and images.',
  'Meme politique, signalee sans etre appliquee.': 'Same policy, reported but not enforced.',
  'Conditionne l inclusion de ressources croisees.': 'Governs the embedding of cross-origin resources.',
  'Isole le contexte de navigation des autres origines.':
    'Isolates the browsing context from other origins.',
  'Restreint qui peut inclure la ressource.': 'Restricts who may embed the resource.',
  'Transparence des certificats. Obsolete depuis 2023.':
    'Certificate transparency. Obsolete since 2023.',
  'Autorise ou coupe camera, micro, geolocalisation.':
    'Allows or blocks camera, microphone, geolocation.',
  'Quantite d information envoyee dans Referer.': 'Amount of information sent in Referer.',
  'Impose HTTPS pour la duree indiquee (HSTS).': 'Forces HTTPS for the stated duration (HSTS).',
  '« nosniff » : interdit de deviner le type de contenu.':
    '« nosniff »: forbids guessing the content type.',
  'Interdit l inclusion dans un cadre. Remplace par CSP frame-ancestors.':
    'Forbids framing. Superseded by CSP frame-ancestors.',
  'Ancien filtre des navigateurs. Abandonne, sans effet aujourd hui.':
    'Old browser filter. Abandoned, without effect today.',
  'Exige une empreinte d integrite sur les ressources chargees.':
    'Requires an integrity hash on loaded resources.',
  'Autorite visee. Obligatoire en HTTP/1.1.': 'Target authority. Mandatory in HTTP/1.1.',
  'Page d ou vient la requete. Faute d orthographe historique.':
    'Page the request comes from. Historic misspelling.',
  'Identite declaree du client. Declarative, donc falsifiable.':
    'Declared identity of the client. Declarative, therefore forgeable.',
  'Adresse de courriel du responsable du client automatique.':
    'Email address of whoever runs the automated client.',
  'Attente particuliere du client, « 100-continue » le plus souvent.':
    'Specific expectation of the client, usually « 100-continue ».',
  'Nombre de sauts restants pour TRACE ou OPTIONS.':
    'Number of hops left for TRACE or OPTIONS.',
  'Date d emission du message.': 'Date the message was sent.',
  'Maintien ou fermeture de la connexion.': 'Keeping or closing the connection.',
  'Parametres du maintien de connexion.': 'Parameters of the connection keep-alive.',
  'Demande de changement de protocole, vers WebSocket par exemple.':
    'Request to switch protocol, to WebSocket for instance.',
  'Mandataires traverses.': 'Proxies traversed.',
  'Avertissement sur la fraicheur. Retire des specifications.':
    'Freshness warning. Removed from the specifications.',
  'Logiciel serveur declare. Souvent masque volontairement.':
    'Declared server software. Often hidden on purpose.',
  'Methodes admises sur la ressource.': 'Methods allowed on the resource.',
  'Cible d une redirection, ou adresse d une ressource creee.':
    'Target of a redirection, or address of a created resource.',
  'Delai avant nouvelle tentative, en secondes ou en date.':
    'Delay before retrying, as seconds or as a date.',
  'Destination de la requete : document, script, image.':
    'Destination of the request: document, script, image.',
  'Mode : navigate, cors, no-cors, same-origin.': 'Mode: navigate, cors, no-cors, same-origin.',
  'Relation entre origine et cible : same-origin, cross-site.':
    'Relation between origin and target: same-origin, cross-site.',
  'Presente quand la navigation vient d un geste de l utilisateur.':
    'Present when the navigation comes from a user gesture.',
  'Requete de prechargement plutot que de navigation reelle.':
    'Prefetch request rather than a real navigation.',
  'Cle de la poignee de main WebSocket.': 'Key of the WebSocket handshake.',
  'Reponse calculee a la cle WebSocket.': 'Computed answer to the WebSocket key.',
  'Sous-protocole WebSocket negocie.': 'Negotiated WebSocket subprotocol.',
  'Version du protocole WebSocket.': 'Version of the WebSocket protocol.',
  'Extensions WebSocket, comme la compression par message.':
    'WebSocket extensions, such as per-message compression.',
  'Le client prefere la version HTTPS des ressources.':
    'The client prefers the HTTPS version of resources.',
  'Marque et version du navigateur (indices client).':
    'Brand and version of the browser (client hints).',
  'Appareil mobile ou non.': 'Mobile device or not.',
  'Systeme d exploitation declare.': 'Declared operating system.',
  'Architecture du processeur.': 'Processor architecture.',
  'Versions completes des composants declares.': 'Full versions of the declared components.',
  'Indices client que le serveur souhaite recevoir.': 'Client hints the server wishes to receive.',
  'Memoire approximative de l appareil.': 'Approximate memory of the device.',
  'Debit descendant estime.': 'Estimated downstream bandwidth.',
  'Type de connexion estime : 4g, 3g, slow-2g.': 'Estimated connection type: 4g, 3g, slow-2g.',
  'Temps d aller-retour estime.': 'Estimated round-trip time.',
  'L utilisateur demande a economiser les donnees.': 'The user asks to save data.',
  'Chaine des mandataires, forme normalisee (RFC 7239).':
    'Chain of proxies, standardised form (RFC 7239).',
  'Adresse du client d origine. Ajoute par un mandataire.':
    'Address of the original client. Added by a proxy.',
  'Hote demande avant le mandataire.': 'Host requested before the proxy.',
  'Protocole avant le mandataire : http ou https.': 'Protocol before the proxy: http or https.',
  'Adresse du client, convention repandue de nginx.':
    'Address of the client, a widespread nginx convention.',
  'Adresse du client, convention de Cloudflare.': 'Address of the client, Cloudflare convention.',
  'Identifiant de requete Cloudflare, utile au support.':
    'Cloudflare request identifier, useful for support.',
  'Le cache du bord a servi (HIT) ou non (MISS).': 'The edge cache served it (HIT) or not (MISS).',
  'Identifiant de correlation entre journaux.': 'Correlation identifier between logs.',
  'Identifiant de correlation, autre convention.': 'Correlation identifier, another convention.',
  'Contexte de trace distribue (W3C Trace Context).':
    'Distributed trace context (W3C Trace Context).',
  'Etat de trace propre a chaque fournisseur.': 'Trace state specific to each vendor.',
  'Mesures de temps publiees par le serveur.': 'Timing measurements published by the server.',
  'Autre service disponible, HTTP/3 par exemple.': 'Alternative service available, HTTP/3 for instance.',
  'Priorite de la requete dans la connexion.': 'Priority of the request within the connection.',
  'Requete envoyee en donnees precoces TLS : rejeu possible.':
    'Request sent as TLS early data: replay is possible.',
  'Quota restant, forme normalisee en cours d adoption.':
    'Remaining quota, standardised form being adopted.',
  'Politique de quota annoncee par le serveur.': 'Quota policy announced by the server.',
  'Quota total sur la fenetre courante.': 'Total quota over the current window.',
  'Appels restants avant blocage.': 'Calls left before blocking.',
  'Date de remise a zero du quota.': 'Date the quota resets.',
  'Cle d API, convention frequente. A traiter comme un secret.':
    'API key, a frequent convention. To be treated as a secret.',
  'Jeton anti-falsification de requete.': 'Anti-forgery request token.',
  'Marque une requete AJAX. Convention, jamais normalisee.':
    'Marks an AJAX request. A convention, never standardised.',
  'Demande de ne pas etre suivi. Sans effet contraignant.':
    'Request not to be tracked. Without binding effect.',
  'Refus de vente ou de partage des donnees personnelles.':
    'Refusal to sell or share personal data.',
  'Liens lies a la ressource : preload, next, canonical.':
    'Links related to the resource: preload, next, canonical.',
  'Rechargement differe. Non normalise mais largement suivi.':
    'Delayed reload. Not standardised but widely honoured.',
  'Point de collecte des rapports du navigateur.': 'Collection endpoint for browser reports.',
  'Points de collecte nommes, forme actuelle.': 'Named collection endpoints, current form.',
  'Journalisation des erreurs reseau par le navigateur.':
    'Network error logging by the browser.',
  'Date d arret annoncee pour la ressource.': 'Announced shutdown date for the resource.',
  'Cle qui rend un envoi rejouable sans double effet.':
    'Key that makes a submission replayable without a double effect.'
};
