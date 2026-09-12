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
    'Key that makes a submission replayable without a double effect.',

  /* ===================================================================== */
  /* Les cent en-tetes ajoutes pour couvrir le registre permanent de       */
  /* l IANA. Regroupes par sujet, dans l ordre de la table.                */
  /* ===================================================================== */

  /* ------------------- Negociation transparente (RFC 2295) ---------------- */
  'Capacites du client, pour la negociation transparente (RFC 2295).':
    'What the client can handle, for transparent content negotiation (RFC 2295).',
  'Variantes disponibles de la ressource (RFC 2295).':
    'The variants of the resource that are available (RFC 2295).',
  'Mode de negociation transparente demande (RFC 2295).':
    'The transparent negotiation mode being asked for (RFC 2295).',
  'Type de negociation transparente appliquee (RFC 2295).':
    'The kind of transparent negotiation that was applied (RFC 2295).',
  'Ce qui fait varier une variante donnee (RFC 2295).':
    'What makes a given variant vary (RFC 2295).',

  /* ------------------------ Encodage delta (RFC 3229) --------------------- */
  'Transformations d instance acceptees, pour l encodage delta (RFC 3229).':
    'Instance manipulations the client accepts, for delta encoding (RFC 3229).',
  'Transformations d instance appliquees au corps (RFC 3229).':
    'Instance manipulations applied to the body (RFC 3229).',
  'ETag de la version servant de base au delta (RFC 3229).':
    'The ETag of the version the delta is based on (RFC 3229).',

  /* ------------------------------ Caches et CDN --------------------------- */
  'Ce que chaque cache traverse a fait de la requete : trouve, absent, revalide (RFC 9211).':
    'What each cache along the way did with the request: hit, miss, revalidated (RFC 9211).',
  'Directives de cache destinees aux seuls CDN, ignorees du navigateur (RFC 9213).':
    'Cache directives meant for CDNs alone, ignored by the browser (RFC 9213).',
  'Marque laissee par chaque CDN traverse, pour detecter une boucle (RFC 8586).':
    'A mark left by each CDN passed through, so a loop can be detected (RFC 8586).',
  'Groupes auxquels la reponse appartient, pour une invalidation groupee (RFC 9875).':
    'The groups this response belongs to, so they can be invalidated together (RFC 9875).',
  'Groupes de cache a invalider (RFC 9875).':
    'The cache groups to invalidate (RFC 9875).',
  'Comptage des acces pour un cache mandataire (RFC 2227).':
    'Access counting for a proxy cache (RFC 2227).',

  /* ------------------ Compression a dictionnaire (RFC 9842) --------------- */
  'Empreinte du dictionnaire de compression dont dispose le client (RFC 9842).':
    'The digest of the compression dictionary the client already has (RFC 9842).',
  'Cette reponse peut servir de dictionnaire a de futures requetes (RFC 9842).':
    'This response may serve as a dictionary for future requests (RFC 9842).',
  'Identifiant du dictionnaire de compression employe (RFC 9842).':
    'The identifier of the compression dictionary used (RFC 9842).',

  /* ---------------------- Empreintes de corps (RFC 9530) ------------------ */
  'Empreinte des octets transmis. INTERCEPTOR la recalcule et dit si elle correspond (RFC 9530).':
    'A digest of the bytes transmitted. INTERCEPTOR recomputes it and says whether it matches (RFC 9530).',
  'Empreinte de la representation, avant encodage de transfert (RFC 9530).':
    'A digest of the representation, before any transfer encoding (RFC 9530).',
  'Empreintes souhaitees en retour ; un poids nul vaut refus (RFC 9530).':
    'The digests wanted in return; a weight of zero means "none" (RFC 9530).',
  'Empreintes de representation souhaitees en retour (RFC 9530).':
    'The representation digests wanted in return (RFC 9530).',
  'Empreinte du contenu avant tout encodage de contenu (brouillon httpbis).':
    'A digest of the content before any content encoding (httpbis draft).',
  'Empreinte non encodee souhaitee en retour (brouillon httpbis).':
    'The unencoded digest wanted in return (httpbis draft).',

  /* ------------------- Signatures de message (RFC 9421) ------------------- */
  'Signatures du message, en champ structure (RFC 9421).':
    'The message signatures, as a structured field (RFC 9421).',
  'Ce que chaque signature couvre : champs, cle, algorithme, validite (RFC 9421).':
    'What each signature covers: fields, key, algorithm, validity (RFC 9421).',
  'Signatures que l autre partie souhaite recevoir (RFC 9421).':
    'The signatures the other party would like to receive (RFC 9421).',

  /* --------------------------- Authentification --------------------------- */
  'Donnees finales d un echange d authentification (RFC 9110).':
    'The closing data of an authentication exchange (RFC 9110).',
  'Idem, pour un mandataire (RFC 9110).':
    'The same, for a proxy (RFC 9110).',
  'Conduite attendue du client apres l authentification (RFC 8053).':
    'What the client is expected to do once authenticated (RFC 8053).',
  'Authentification proposee sans etre exigee (RFC 8053).':
    'Authentication offered without being required (RFC 8053).',
  'Preuve de possession de la cle liee au jeton OAuth (RFC 9449).':
    'Proof that the holder owns the key bound to the OAuth token (RFC 9449).',
  'Nonce impose par le serveur pour la preuve suivante (RFC 9449).':
    'A nonce the server requires for the next proof (RFC 9449).',
  'Liaison du jeton a la connexion TLS (RFC 8473).':
    'Binds the token to the TLS connection (RFC 8473).',
  'Demande d inclure la liaison de jeton referee (RFC 8473).':
    'Asks for the referred token binding to be included (RFC 8473).',
  'Materiel exporte pour l authentification dissimulee (RFC 9729).':
    'Exported keying material for concealed authentication (RFC 9729).',
  'Etat d enregistrement HOBA, authentification liee a l origine (RFC 7486).':
    'HOBA registration state, origin-bound authentication (RFC 7486).',
  'Signature JWS detachee du corps, protocole GNAP (RFC 9635).':
    'A JWS signature detached from the body, GNAP protocol (RFC 9635).',
  'Securite objet pour environnements contraints (RFC 8613).':
    'Object security for constrained environments (RFC 8613).',

  /* ------------------------------ Certificats ----------------------------- */
  'Certificat client, transmis par un mandataire qui a termine le TLS (RFC 9440).':
    'The client certificate, forwarded by a proxy that terminated the TLS (RFC 9440).',
  'Chaine du certificat client, transmise de meme (RFC 9440).':
    'The client certificate chain, forwarded in the same way (RFC 9440).',
  'Fin de validite demandee pour un certificat court ACME STAR (RFC 8739).':
    'The requested end of validity for a short-lived ACME STAR certificate (RFC 8739).',
  'Debut de validite demande pour ce meme certificat (RFC 8739).':
    'The requested start of validity for that same certificate (RFC 8739).',
  'Nonce anti-rejeu du protocole ACME (RFC 8555).':
    'The anti-replay nonce of the ACME protocol (RFC 8555).',
  'Epinglage de cle publique. Retire de tous les navigateurs (RFC 7469).':
    'Public key pinning. Removed from every browser (RFC 7469).',
  'Epinglage en observation. Retire de meme (RFC 7469).':
    'Pinning in report-only mode. Removed in the same way (RFC 7469).',

  /* -------------------------- Mandataires et tunnels ---------------------- */
  'Quel mandataire a fait quoi, et pourquoi la requete a echoue (RFC 9209).':
    'Which proxy did what, and why the request failed (RFC 9209).',
  'Adresse publique attribuee par le mandataire UDP (MASQUE).':
    'The public address assigned by the UDP proxy (MASQUE).',
  'Demande de liaison UDP a travers un mandataire (MASQUE).':
    'A request to bind a UDP port through a proxy (MASQUE).',
  'Le flux transporte des capsules, non un corps ordinaire (RFC 9297).':
    'The stream carries capsules, not an ordinary body (RFC 9297).',
  'Protocoles applicatifs offerts par un service alternatif (RFC 7639).':
    'The application protocols an alternative service offers (RFC 7639).',
  'Service alternatif que le client a effectivement emprunte (RFC 7838).':
    'The alternative service the client actually went through (RFC 7838).',
  'Le message peut etre transmis au fur et a mesure (RFC 10036).':
    'The message may be delivered incrementally, as it arrives (RFC 10036).',

  /* --------------------- Cycle de vie et preferences ---------------------- */
  'Cette ressource est obsolete, avec la date depuis laquelle (RFC 9745).':
    'This resource is deprecated, and says since when (RFC 9745).',
  'Comportement souhaite du serveur, sans l exiger (RFC 7240).':
    'Behaviour the client would like from the server, without demanding it (RFC 7240).',
  'Quelles preferences le serveur a effectivement suivies (RFC 7240).':
    'Which of those preferences the server actually honoured (RFC 7240).',
  'Formats de correctif acceptes par la methode PATCH (RFC 5789).':
    'The patch formats the PATCH method accepts (RFC 5789).',
  'Types de media acceptes sur cette ressource en POST (Linked Data Platform).':
    'The media types this resource accepts in a POST (Linked Data Platform).',
  'Formats de requete acceptes par la methode QUERY (RFC 10008).':
    'The query formats the QUERY method accepts (RFC 10008).',
  'Etat de la ressource a une date donnee, protocole Memento (RFC 7089).':
    'The state of the resource at a given date, the Memento protocol (RFC 7089).',
  'Date de l etat archive effectivement renvoye (RFC 7089).':
    'The date of the archived state actually returned (RFC 7089).',

  /* ---------------------------- Push web (RFC 8030) ----------------------- */
  'Duree de retention du message push s il ne peut etre remis (RFC 8030).':
    'How long to keep a push message that cannot be delivered (RFC 8030).',
  'Urgence du message push, de « very-low » a « high » (RFC 8030).':
    'How urgent the push message is, from "very-low" to "high" (RFC 8030).',
  'Sujet du message push : un nouveau remplace le precedent (RFC 8030).':
    'The topic of the push message: a new one replaces the previous one (RFC 8030).',

  /* --------------------------------- HTML --------------------------------- */
  'Dernier evenement recu, pour reprendre un flux SSE ou il s est coupe (HTML).':
    'The last event received, so an SSE stream resumes where it was cut (HTML).',
  'Demande d isoler cette origine dans son propre agent (HTML).':
    'Asks for this origin to be isolated in its own agent cluster (HTML).',
  'Page d ou provient un ping d hyperlien (HTML).':
    'The page a hyperlink ping came from (HTML).',
  'Destination annoncee de ce ping (HTML).':
    'The announced destination of that ping (HTML).',
  'Politique d integration en observation : rien n est bloque, tout est signale.':
    'Embedder policy in report-only mode: nothing is blocked, everything is reported.',
  'Politique d ouverture en observation, meme principe.':
    'Opener policy in report-only mode, on the same principle.',

  /* ------------------------------- Heritage ------------------------------- */
  'Option de connexion reservee ; ne doit pas etre envoyee (RFC 9112).':
    'A reserved connection option; it must not be sent (RFC 9112).',
  'Version MIME. Heritee du courrier, sans effet en HTTP (RFC 9112).':
    'The MIME version. Inherited from email, and of no effect in HTTP (RFC 9112).',

  /* -------------------------------- WebDAV -------------------------------- */
  'Classes de conformite WebDAV du serveur (RFC 4918).':
    'The WebDAV compliance classes the server implements (RFC 4918).',
  'Profondeur d application de la methode WebDAV (RFC 4918).':
    'How deep the WebDAV method applies (RFC 4918).',
  'Cible d un COPY ou d un MOVE WebDAV (RFC 4918).':
    'The target of a WebDAV COPY or MOVE (RFC 4918).',
  'Condition WebDAV portant sur des etats et des verrous (RFC 4918).':
    'A WebDAV condition on states and locks (RFC 4918).',
  'Verrou WebDAV invoque ou libere (RFC 4918).':
    'The WebDAV lock being invoked or released (RFC 4918).',
  'Autorise ou non l ecrasement de la destination (RFC 4918).':
    'Whether overwriting the destination is allowed (RFC 4918).',
  'Duree de verrou demandee, en secondes (RFC 4918).':
    'The lock duration requested, in seconds (RFC 4918).',
  'Etat par ressource apres une operation WebDAV (RFC 2518).':
    'Per-resource status after a WebDAV operation (RFC 2518).',
  'Grammaires de recherche acceptees par SEARCH (RFC 5323).':
    'The search grammars that SEARCH accepts (RFC 5323).',
  'Version etiquetee visee, versionnement WebDAV (RFC 3253).':
    'The labelled version being targeted, WebDAV versioning (RFC 3253).',
  'Semantique d ordre d une collection ordonnee (RFC 3648).':
    'The ordering semantics of an ordered collection (RFC 3648).',
  'Position demandee dans une collection ordonnee (RFC 3648).':
    'The position requested within an ordered collection (RFC 3648).',
  'Cible d une ressource de redirection WebDAV (RFC 4437).':
    'The target of a WebDAV redirect reference resource (RFC 4437).',
  'Appliquer la methode a la reference elle-meme (RFC 4437).':
    'Apply the method to the reference itself (RFC 4437).',

  /* -------------------------------- CalDAV -------------------------------- */
  'Prise en charge du service de fuseaux horaires CalDAV.':
    'Support for the CalDAV time zone service.',
  'Identifiant d une piece jointe geree par le serveur CalDAV.':
    'The identifier of an attachment managed by the CalDAV server.',
  'Envoyer ou non une reponse de planification CalDAV.':
    'Whether to send a CalDAV scheduling reply.',
  'Etiquette d objet de planification CalDAV.':
    'The tag of a CalDAV scheduling object.',
  'Condition portant sur cette etiquette de planification.':
    'A condition on that scheduling tag.',

  /* ------------------------- Autres protocoles ---------------------------- */
  'Nom suggere pour la ressource creee, protocole Atom (RFC 5023).':
    'A suggested name for the created resource, Atom protocol (RFC 5023).',
  'Intention de la requete SOAP 1.1, avant SOAP 1.2.':
    'The intent of a SOAP 1.1 request, from before SOAP 1.2.',
  'Version du protocole OData employee.':
    'The version of the OData protocol in use.',
  'Version OData maximale que le client sait lire.':
    'The highest OData version the client can read.',
  'Identifiant de l entite creee ou modifiee, OData.':
    'The identifier of the entity created or changed, OData.',
  'Niveau d isolation demande pour la lecture, OData.':
    'The isolation level requested for the read, OData.',
  'Version du noyau OSLC employee.':
    'The version of the OSLC core in use.',
  'Jeton d evenement de securite, profil SCIM (RFC 9967).':
    'A security event token, SCIM profile (RFC 9967).',
  'Liens dont la cible est un gabarit d URI (RFC 9652).':
    'Links whose target is a URI template (RFC 9652).',
  'Ajouts acceptes a la boisson. Protocole HTCPCP, poisson d avril (RFC 2324).':
    'Additions accepted in the beverage. The HTCPCP April Fools protocol (RFC 2324).'
};
