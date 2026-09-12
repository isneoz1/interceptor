/* Table de reference des entetes HTTP — INTERCEPTOR (by NeoZ)
 *
 * Chaque entete courant, son sens de circulation et ce qu il fait reellement.
 * Sert la boite a outils et l explication d une requete capturee.
 *
 * Sens : « requete », « reponse », ou « les deux ».
 */

const T = [
  /* --------------------------- Contenu et format -------------------------- */
  ['Accept', 'requete', 'Types de contenu que le client sait lire, par ordre de preference.'],
  ['Accept-Charset', 'requete', 'Jeux de caracteres acceptes. Abandonne par les navigateurs modernes.'],
  ['Accept-Encoding', 'requete', 'Compressions acceptees : gzip, br, deflate, zstd.'],
  ['Accept-Language', 'requete', 'Langues souhaitees. Sert aussi au pistage par empreinte.'],
  ['Accept-Ranges', 'reponse', 'Le serveur accepte les requetes partielles (« bytes »).'],
  ['Content-Encoding', 'reponse', 'Compression appliquee au corps.'],
  ['Content-Language', 'reponse', 'Langue du contenu.'],
  ['Content-Length', 'les deux', 'Taille du corps en octets.'],
  ['Content-Location', 'reponse', 'Adresse directe de la representation renvoyee.'],
  ['Content-Range', 'reponse', 'Portion envoyee et taille totale.'],
  ['Content-Type', 'les deux', 'Type de media du corps, et son encodage de caracteres.'],
  ['Content-Disposition', 'reponse', 'Affichage direct ou telechargement, avec nom de fichier.'],
  ['Range', 'requete', 'Demande une portion seulement : reprise de telechargement, lecture video.'],
  ['Transfer-Encoding', 'reponse', 'Encodage de transport, « chunked » le plus souvent.'],
  ['TE', 'requete', 'Encodages de transfert acceptes par le client.'],
  ['Trailer', 'reponse', 'Annonce les entetes envoyes apres le corps.'],
  ['Vary', 'reponse', 'Entetes qui font varier la reponse : cle de cache reelle.'],

  /* --------------------------------- Cache -------------------------------- */
  ['Age', 'reponse', 'Temps passe dans un cache intermediaire, en secondes.'],
  ['Cache-Control', 'les deux', 'Regles de cache : no-store, max-age, private, immutable.'],
  ['Clear-Site-Data', 'reponse', 'Demande au navigateur d effacer cookies, cache ou stockage.'],
  ['ETag', 'reponse', 'Empreinte de la representation, pour la revalidation.'],
  ['Expires', 'reponse', 'Date de peremption. Ecrase par Cache-Control: max-age.'],
  ['If-Match', 'requete', 'N applique la requete que si l ETag correspond.'],
  ['If-Modified-Since', 'requete', 'Ne renvoie le corps que s il a change depuis cette date.'],
  ['If-None-Match', 'requete', 'Revalidation par ETag : rend 304 si rien n a change.'],
  ['If-Range', 'requete', 'Reprend le telechargement seulement si la ressource est intacte.'],
  ['If-Unmodified-Since', 'requete', 'N applique la requete que si rien n a change depuis cette date.'],
  ['Last-Modified', 'reponse', 'Date de derniere modification connue.'],
  ['Pragma', 'requete', 'Ancetre de Cache-Control, conserve pour compatibilite.'],

  /* ----------------------------- Authentification ------------------------- */
  ['Authorization', 'requete', 'Identifiants du client : Basic, Bearer, Digest. A traiter comme un secret.'],
  ['Proxy-Authenticate', 'reponse', 'Le mandataire reclame une authentification.'],
  ['Proxy-Authorization', 'requete', 'Identifiants destines au mandataire.'],
  ['WWW-Authenticate', 'reponse', 'Methode d authentification attendue, avec son domaine.'],

  /* --------------------------------- Cookies ------------------------------ */
  ['Cookie', 'requete', 'Cookies renvoyes au serveur. Secret par nature.'],
  ['Set-Cookie', 'reponse', 'Pose un cookie, avec ses attributs Secure, HttpOnly, SameSite.'],

  /* --------------------------------- CORS --------------------------------- */
  ['Access-Control-Allow-Credentials', 'reponse', 'Autorise l envoi des cookies en requete croisee.'],
  ['Access-Control-Allow-Headers', 'reponse', 'Entetes autorises en requete croisee.'],
  ['Access-Control-Allow-Methods', 'reponse', 'Methodes autorisees en requete croisee.'],
  ['Access-Control-Allow-Origin', 'reponse', 'Origines autorisees. « * » interdit l envoi des cookies.'],
  ['Access-Control-Expose-Headers', 'reponse', 'Entetes lisibles par le script appelant.'],
  ['Access-Control-Max-Age', 'reponse', 'Duree de validite de la reponse preliminaire.'],
  ['Access-Control-Request-Headers', 'requete', 'Entetes que la vraie requete emploiera.'],
  ['Access-Control-Request-Method', 'requete', 'Methode que la vraie requete emploiera.'],
  ['Origin', 'requete', 'Origine de la page a l initiative de la requete.'],
  ['Timing-Allow-Origin', 'reponse', 'Autorise la lecture des mesures de temps detaillees.'],

  /* -------------------------------- Securite ------------------------------ */
  ['Content-Security-Policy', 'reponse', 'Sources autorisees pour scripts, styles et images.'],
  ['Content-Security-Policy-Report-Only', 'reponse', 'Meme politique, signalee sans etre appliquee.'],
  ['Cross-Origin-Embedder-Policy', 'reponse', 'Conditionne l inclusion de ressources croisees.'],
  ['Cross-Origin-Opener-Policy', 'reponse', 'Isole le contexte de navigation des autres origines.'],
  ['Cross-Origin-Resource-Policy', 'reponse', 'Restreint qui peut inclure la ressource.'],
  ['Expect-CT', 'reponse', 'Transparence des certificats. Obsolete depuis 2023.'],
  ['Permissions-Policy', 'reponse', 'Autorise ou coupe camera, micro, geolocalisation.'],
  ['Referrer-Policy', 'reponse', 'Quantite d information envoyee dans Referer.'],
  ['Strict-Transport-Security', 'reponse', 'Impose HTTPS pour la duree indiquee (HSTS).'],
  ['X-Content-Type-Options', 'reponse', '« nosniff » : interdit de deviner le type de contenu.'],
  ['X-Frame-Options', 'reponse', 'Interdit l inclusion dans un cadre. Remplace par CSP frame-ancestors.'],
  ['X-XSS-Protection', 'reponse', 'Ancien filtre des navigateurs. Abandonne, sans effet aujourd hui.'],
  ['Integrity-Policy', 'reponse', 'Exige une empreinte d integrite sur les ressources chargees.'],

  /* ------------------------- Identite de la requete ----------------------- */
  ['Host', 'requete', 'Autorite visee. Obligatoire en HTTP/1.1.'],
  ['Referer', 'requete', 'Page d ou vient la requete. Faute d orthographe historique.'],
  ['User-Agent', 'requete', 'Identite declaree du client. Declarative, donc falsifiable.'],
  ['From', 'requete', 'Adresse de courriel du responsable du client automatique.'],
  ['Expect', 'requete', 'Attente particuliere du client, « 100-continue » le plus souvent.'],
  ['Max-Forwards', 'requete', 'Nombre de sauts restants pour TRACE ou OPTIONS.'],
  ['Date', 'les deux', 'Date d emission du message.'],
  ['Connection', 'les deux', 'Maintien ou fermeture de la connexion.'],
  ['Keep-Alive', 'les deux', 'Parametres du maintien de connexion.'],
  ['Upgrade', 'les deux', 'Demande de changement de protocole, vers WebSocket par exemple.'],
  ['Via', 'les deux', 'Mandataires traverses.'],
  ['Warning', 'reponse', 'Avertissement sur la fraicheur. Retire des specifications.'],
  ['Server', 'reponse', 'Logiciel serveur declare. Souvent masque volontairement.'],
  ['Allow', 'reponse', 'Methodes admises sur la ressource.'],
  ['Location', 'reponse', 'Cible d une redirection, ou adresse d une ressource creee.'],
  ['Retry-After', 'reponse', 'Delai avant nouvelle tentative, en secondes ou en date.'],

  /* ---------------------- Metadonnees de recuperation --------------------- */
  ['Sec-Fetch-Dest', 'requete', 'Destination de la requete : document, script, image.'],
  ['Sec-Fetch-Mode', 'requete', 'Mode : navigate, cors, no-cors, same-origin.'],
  ['Sec-Fetch-Site', 'requete', 'Relation entre origine et cible : same-origin, cross-site.'],
  ['Sec-Fetch-User', 'requete', 'Presente quand la navigation vient d un geste de l utilisateur.'],
  ['Sec-Purpose', 'requete', 'Requete de prechargement plutot que de navigation reelle.'],
  ['Sec-WebSocket-Key', 'requete', 'Cle de la poignee de main WebSocket.'],
  ['Sec-WebSocket-Accept', 'reponse', 'Reponse calculee a la cle WebSocket.'],
  ['Sec-WebSocket-Protocol', 'les deux', 'Sous-protocole WebSocket negocie.'],
  ['Sec-WebSocket-Version', 'requete', 'Version du protocole WebSocket.'],
  ['Sec-WebSocket-Extensions', 'les deux', 'Extensions WebSocket, comme la compression par message.'],
  ['Upgrade-Insecure-Requests', 'requete', 'Le client prefere la version HTTPS des ressources.'],

  /* ------------------------------- Indices client ------------------------- */
  ['Sec-CH-UA', 'requete', 'Marque et version du navigateur (indices client).'],
  ['Sec-CH-UA-Mobile', 'requete', 'Appareil mobile ou non.'],
  ['Sec-CH-UA-Platform', 'requete', 'Systeme d exploitation declare.'],
  ['Sec-CH-UA-Arch', 'requete', 'Architecture du processeur.'],
  ['Sec-CH-UA-Full-Version-List', 'requete', 'Versions completes des composants declares.'],
  ['Accept-CH', 'reponse', 'Indices client que le serveur souhaite recevoir.'],
  ['Device-Memory', 'requete', 'Memoire approximative de l appareil.'],
  ['Downlink', 'requete', 'Debit descendant estime.'],
  ['ECT', 'requete', 'Type de connexion estime : 4g, 3g, slow-2g.'],
  ['RTT', 'requete', 'Temps d aller-retour estime.'],
  ['Save-Data', 'requete', 'L utilisateur demande a economiser les donnees.'],

  /* --------------------------- Mandataires et bord ------------------------ */
  ['Forwarded', 'requete', 'Chaine des mandataires, forme normalisee (RFC 7239).'],
  ['X-Forwarded-For', 'requete', 'Adresse du client d origine. Ajoute par un mandataire.'],
  ['X-Forwarded-Host', 'requete', 'Hote demande avant le mandataire.'],
  ['X-Forwarded-Proto', 'requete', 'Protocole avant le mandataire : http ou https.'],
  ['X-Real-IP', 'requete', 'Adresse du client, convention repandue de nginx.'],
  ['CF-Connecting-IP', 'requete', 'Adresse du client, convention de Cloudflare.'],
  ['CF-Ray', 'reponse', 'Identifiant de requete Cloudflare, utile au support.'],
  ['X-Cache', 'reponse', 'Le cache du bord a servi (HIT) ou non (MISS).'],
  ['X-Request-ID', 'les deux', 'Identifiant de correlation entre journaux.'],
  ['X-Correlation-ID', 'les deux', 'Identifiant de correlation, autre convention.'],
  ['Traceparent', 'requete', 'Contexte de trace distribue (W3C Trace Context).'],
  ['Tracestate', 'requete', 'Etat de trace propre a chaque fournisseur.'],
  ['Server-Timing', 'reponse', 'Mesures de temps publiees par le serveur.'],
  ['Alt-Svc', 'reponse', 'Autre service disponible, HTTP/3 par exemple.'],
  ['Priority', 'les deux', 'Priorite de la requete dans la connexion.'],
  ['Early-Data', 'requete', 'Requete envoyee en donnees precoces TLS : rejeu possible.'],

  /* --------------------------- Limitation de debit ------------------------ */
  ['RateLimit', 'reponse', 'Quota restant, forme normalisee en cours d adoption.'],
  ['RateLimit-Policy', 'reponse', 'Politique de quota annoncee par le serveur.'],
  ['X-RateLimit-Limit', 'reponse', 'Quota total sur la fenetre courante.'],
  ['X-RateLimit-Remaining', 'reponse', 'Appels restants avant blocage.'],
  ['X-RateLimit-Reset', 'reponse', 'Date de remise a zero du quota.'],

  /* ------------------------------- API et divers -------------------------- */
  ['X-API-Key', 'requete', 'Cle d API, convention frequente. A traiter comme un secret.'],
  ['X-CSRF-Token', 'requete', 'Jeton anti-falsification de requete.'],
  ['X-Requested-With', 'requete', 'Marque une requete AJAX. Convention, jamais normalisee.'],
  ['DNT', 'requete', 'Demande de ne pas etre suivi. Sans effet contraignant.'],
  ['Sec-GPC', 'requete', 'Refus de vente ou de partage des donnees personnelles.'],
  ['Link', 'reponse', 'Liens lies a la ressource : preload, next, canonical.'],
  ['Refresh', 'reponse', 'Rechargement differe. Non normalise mais largement suivi.'],
  ['Report-To', 'reponse', 'Point de collecte des rapports du navigateur.'],
  ['Reporting-Endpoints', 'reponse', 'Points de collecte nommes, forme actuelle.'],
  ['NEL', 'reponse', 'Journalisation des erreurs reseau par le navigateur.'],
  ['Sunset', 'reponse', 'Date d arret annoncee pour la ressource.'],
  ['Idempotency-Key', 'requete', 'Cle qui rend un envoi rejouable sans double effet.'],
  /* ===================================================================== */
  /* Complement du registre permanent de l IANA. Chaque entree est decrite  */
  /* d apres la specification que l IANA lui associe.                       */
  /* ===================================================================== */

  /* ------------------- Negociation de contenu transparente ---------------- */
  /* RFC 2295 : une negociation menee par le client plutot que par le serveur.
     Rare en pratique, mais toujours au registre. */
  ['Accept-Features', 'requete', 'Capacites du client, pour la negociation transparente (RFC 2295).'],
  ['Alternates', 'reponse', 'Variantes disponibles de la ressource (RFC 2295).'],
  ['Negotiate', 'requete', 'Mode de negociation transparente demande (RFC 2295).'],
  ['TCN', 'reponse', 'Type de negociation transparente appliquee (RFC 2295).'],
  ['Variant-Vary', 'reponse', 'Ce qui fait varier une variante donnee (RFC 2295).'],

  /* --------------------------- Encodage delta ----------------------------- */
  /* RFC 3229 : envoyer la difference avec une version deja detenue plutot que
     la ressource entiere. */
  ['A-IM', 'requete', 'Transformations d instance acceptees, pour l encodage delta (RFC 3229).'],
  ['IM', 'reponse', 'Transformations d instance appliquees au corps (RFC 3229).'],
  ['Delta-Base', 'reponse', 'ETag de la version servant de base au delta (RFC 3229).'],

  /* ------------------------------- Caches --------------------------------- */
  ['Cache-Status', 'reponse', 'Ce que chaque cache traverse a fait de la requete : trouve, absent, revalide (RFC 9211).'],
  ['CDN-Cache-Control', 'reponse', 'Directives de cache destinees aux seuls CDN, ignorees du navigateur (RFC 9213).'],
  ['CDN-Loop', 'requete', 'Marque laissee par chaque CDN traverse, pour detecter une boucle (RFC 8586).'],
  ['Cache-Groups', 'reponse', 'Groupes auxquels la reponse appartient, pour une invalidation groupee (RFC 9875).'],
  ['Cache-Group-Invalidation', 'reponse', 'Groupes de cache a invalider (RFC 9875).'],
  ['Meter', 'les deux', 'Comptage des acces pour un cache mandataire (RFC 2227).'],

  /* ------------------------ Dictionnaires de compression ------------------ */
  /* RFC 9842 : compresser en s appuyant sur une ressource deja telechargee. */
  ['Available-Dictionary', 'requete', 'Empreinte du dictionnaire de compression dont dispose le client (RFC 9842).'],
  ['Use-As-Dictionary', 'reponse', 'Cette reponse peut servir de dictionnaire a de futures requetes (RFC 9842).'],
  ['Dictionary-ID', 'les deux', 'Identifiant du dictionnaire de compression employe (RFC 9842).'],

  /* -------------------------- Empreintes de corps ------------------------- */
  ['Content-Digest', 'les deux', 'Empreinte des octets transmis. INTERCEPTOR la recalcule et dit si elle correspond (RFC 9530).'],
  ['Repr-Digest', 'les deux', 'Empreinte de la representation, avant encodage de transfert (RFC 9530).'],
  ['Want-Content-Digest', 'les deux', 'Empreintes souhaitees en retour ; un poids nul vaut refus (RFC 9530).'],
  ['Want-Repr-Digest', 'les deux', 'Empreintes de representation souhaitees en retour (RFC 9530).'],
  ['Unencoded-Digest', 'les deux', 'Empreinte du contenu avant tout encodage de contenu (brouillon httpbis).'],
  ['Want-Unencoded-Digest', 'les deux', 'Empreinte non encodee souhaitee en retour (brouillon httpbis).'],

  /* ------------------------- Signatures de message ------------------------ */
  /* RFC 9421 : signer une requete ou une reponse, champ par champ. */
  ['Signature', 'les deux', 'Signatures du message, en champ structure (RFC 9421).'],
  ['Signature-Input', 'les deux', 'Ce que chaque signature couvre : champs, cle, algorithme, validite (RFC 9421).'],
  ['Accept-Signature', 'les deux', 'Signatures que l autre partie souhaite recevoir (RFC 9421).'],

  /* ------------------------ Authentification et jetons -------------------- */
  ['Authentication-Info', 'reponse', 'Donnees finales d un echange d authentification (RFC 9110).'],
  ['Proxy-Authentication-Info', 'reponse', 'Idem, pour un mandataire (RFC 9110).'],
  ['Authentication-Control', 'reponse', 'Conduite attendue du client apres l authentification (RFC 8053).'],
  ['Optional-WWW-Authenticate', 'reponse', 'Authentification proposee sans etre exigee (RFC 8053).'],
  ['DPoP', 'requete', 'Preuve de possession de la cle liee au jeton OAuth (RFC 9449).'],
  ['DPoP-Nonce', 'reponse', 'Nonce impose par le serveur pour la preuve suivante (RFC 9449).'],
  ['Sec-Token-Binding', 'requete', 'Liaison du jeton a la connexion TLS (RFC 8473).'],
  ['Include-Referred-Token-Binding-ID', 'requete', 'Demande d inclure la liaison de jeton referee (RFC 8473).'],
  ['Concealed-Auth-Export', 'requete', 'Materiel exporte pour l authentification dissimulee (RFC 9729).'],
  ['Hobareg', 'reponse', 'Etat d enregistrement HOBA, authentification liee a l origine (RFC 7486).'],
  ['Detached-JWS', 'requete', 'Signature JWS detachee du corps, protocole GNAP (RFC 9635).'],
  ['OSCORE', 'les deux', 'Securite objet pour environnements contraints (RFC 8613).'],

  /* ------------------------------ Certificats ----------------------------- */
  ['Client-Cert', 'requete', 'Certificat client, transmis par un mandataire qui a termine le TLS (RFC 9440).'],
  ['Client-Cert-Chain', 'requete', 'Chaine du certificat client, transmise de meme (RFC 9440).'],
  ['Cert-Not-After', 'les deux', 'Fin de validite demandee pour un certificat court ACME STAR (RFC 8739).'],
  ['Cert-Not-Before', 'les deux', 'Debut de validite demande pour ce meme certificat (RFC 8739).'],
  ['Replay-Nonce', 'reponse', 'Nonce anti-rejeu du protocole ACME (RFC 8555).'],
  ['Public-Key-Pins', 'reponse', 'Epinglage de cle publique. Retire de tous les navigateurs (RFC 7469).'],
  ['Public-Key-Pins-Report-Only', 'reponse', 'Epinglage en observation. Retire de meme (RFC 7469).'],

  /* --------------------------- Mandataires et CDN ------------------------- */
  ['Proxy-Status', 'reponse', 'Quel mandataire a fait quoi, et pourquoi la requete a echoue (RFC 9209).'],
  ['Proxy-Public-Address', 'reponse', 'Adresse publique attribuee par le mandataire UDP (MASQUE).'],
  ['Connect-UDP-Bind', 'requete', 'Demande de liaison UDP a travers un mandataire (MASQUE).'],
  ['Capsule-Protocol', 'les deux', 'Le flux transporte des capsules, non un corps ordinaire (RFC 9297).'],
  ['ALPN', 'reponse', 'Protocoles applicatifs offerts par un service alternatif (RFC 7639).'],
  ['Alt-Used', 'requete', 'Service alternatif que le client a effectivement emprunte (RFC 7838).'],
  ['Incremental', 'les deux', 'Le message peut etre transmis au fur et a mesure (RFC 10036).'],

  /* ----------------------------- Cycle de vie ----------------------------- */
  ['Deprecation', 'reponse', 'Cette ressource est obsolete, avec la date depuis laquelle (RFC 9745).'],
  ['Prefer', 'requete', 'Comportement souhaite du serveur, sans l exiger (RFC 7240).'],
  ['Preference-Applied', 'reponse', 'Quelles preferences le serveur a effectivement suivies (RFC 7240).'],
  ['Accept-Patch', 'reponse', 'Formats de correctif acceptes par la methode PATCH (RFC 5789).'],
  ['Accept-Post', 'reponse', 'Types de media acceptes sur cette ressource en POST (Linked Data Platform).'],
  ['Accept-Query', 'reponse', 'Formats de requete acceptes par la methode QUERY (RFC 10008).'],

  /* -------------------------- Archives et versions ------------------------ */
  ['Accept-Datetime', 'requete', 'Etat de la ressource a une date donnee, protocole Memento (RFC 7089).'],
  ['Memento-Datetime', 'reponse', 'Date de l etat archive effectivement renvoye (RFC 7089).'],

  /* ------------------------------- Web Push ------------------------------- */
  /* RFC 8030 : ce que le service de push transporte, et avec quelle urgence. */
  ['TTL', 'requete', 'Duree de retention du message push s il ne peut etre remis (RFC 8030).'],
  ['Urgency', 'requete', 'Urgence du message push, de « very-low » a « high » (RFC 8030).'],
  ['Topic', 'requete', 'Sujet du message push : un nouveau remplace le precedent (RFC 8030).'],

  /* ---------------------------- Cote navigateur --------------------------- */
  ['Last-Event-ID', 'requete', 'Dernier evenement recu, pour reprendre un flux SSE ou il s est coupe (HTML).'],
  ['Origin-Agent-Cluster', 'reponse', 'Demande d isoler cette origine dans son propre agent (HTML).'],
  ['Ping-From', 'requete', 'Page d ou provient un ping d hyperlien (HTML).'],
  ['Ping-To', 'requete', 'Destination annoncee de ce ping (HTML).'],
  ['Cross-Origin-Embedder-Policy-Report-Only', 'reponse', 'Politique d integration en observation : rien n est bloque, tout est signale.'],
  ['Cross-Origin-Opener-Policy-Report-Only', 'reponse', 'Politique d ouverture en observation, meme principe.'],

  /* ------------------------------- HTTP/1.1 ------------------------------- */
  ['Close', 'les deux', 'Option de connexion reservee ; ne doit pas etre envoyee (RFC 9112).'],
  ['MIME-Version', 'les deux', 'Version MIME. Heritee du courrier, sans effet en HTTP (RFC 9112).'],

  /* ------------------------- WebDAV et ses extensions --------------------- */
  /* Un navigateur ne parle pas WebDAV : voir ces entetes dans une capture
     signale un client tiers, ou un serveur qui les expose. */
  ['DAV', 'reponse', 'Classes de conformite WebDAV du serveur (RFC 4918).'],
  ['Depth', 'requete', 'Profondeur d application de la methode WebDAV (RFC 4918).'],
  ['Destination', 'requete', 'Cible d un COPY ou d un MOVE WebDAV (RFC 4918).'],
  ['If', 'requete', 'Condition WebDAV portant sur des etats et des verrous (RFC 4918).'],
  ['Lock-Token', 'requete', 'Verrou WebDAV invoque ou libere (RFC 4918).'],
  ['Overwrite', 'requete', 'Autorise ou non l ecrasement de la destination (RFC 4918).'],
  ['Timeout', 'requete', 'Duree de verrou demandee, en secondes (RFC 4918).'],
  ['Status-URI', 'reponse', 'Etat par ressource apres une operation WebDAV (RFC 2518).'],
  ['DASL', 'reponse', 'Grammaires de recherche acceptees par SEARCH (RFC 5323).'],
  ['Label', 'requete', 'Version etiquetee visee, versionnement WebDAV (RFC 3253).'],
  ['Ordering-Type', 'les deux', 'Semantique d ordre d une collection ordonnee (RFC 3648).'],
  ['Position', 'requete', 'Position demandee dans une collection ordonnee (RFC 3648).'],
  ['Redirect-Ref', 'reponse', 'Cible d une ressource de redirection WebDAV (RFC 4437).'],
  ['Apply-To-Redirect-Ref', 'requete', 'Appliquer la methode a la reference elle-meme (RFC 4437).'],

  /* ------------------------------- CalDAV --------------------------------- */
  ['CalDAV-Timezones', 'les deux', 'Prise en charge du service de fuseaux horaires CalDAV.'],
  ['Cal-Managed-ID', 'reponse', 'Identifiant d une piece jointe geree par le serveur CalDAV.'],
  ['Schedule-Reply', 'requete', 'Envoyer ou non une reponse de planification CalDAV.'],
  ['Schedule-Tag', 'reponse', 'Etiquette d objet de planification CalDAV.'],
  ['If-Schedule-Tag-Match', 'requete', 'Condition portant sur cette etiquette de planification.'],

  /* ------------------------ Autres protocoles applicatifs ----------------- */
  ['SLUG', 'requete', 'Nom suggere pour la ressource creee, protocole Atom (RFC 5023).'],
  ['SoapAction', 'requete', 'Intention de la requete SOAP 1.1, avant SOAP 1.2.'],
  ['OData-Version', 'les deux', 'Version du protocole OData employee.'],
  ['OData-MaxVersion', 'requete', 'Version OData maximale que le client sait lire.'],
  ['OData-EntityId', 'reponse', 'Identifiant de l entite creee ou modifiee, OData.'],
  ['OData-Isolation', 'requete', 'Niveau d isolation demande pour la lecture, OData.'],
  ['OSLC-Core-Version', 'les deux', 'Version du noyau OSLC employee.'],
  ['Set-Txn', 'les deux', 'Jeton d evenement de securite, profil SCIM (RFC 9967).'],
  ['Link-Template', 'reponse', 'Liens dont la cible est un gabarit d URI (RFC 9652).'],
  ['Accept-Additions', 'requete', 'Ajouts acceptes a la boisson. Protocole HTCPCP, poisson d avril (RFC 2324).'],];

export const ENTETES = T.map(([nom, sens, description]) => ({ nom, sens, description }));

const INDEX = new Map(ENTETES.map(e => [e.nom.toLowerCase(), e]));

/** Description d un entete, insensible a la casse. Null si inconnu. */
export function decrireEntete(nom) {
  return INDEX.get(String(nom || '').trim().toLowerCase()) || null;
}

/** Recherche libre sur le nom et la description. */
export function chercherEntetes(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return ENTETES;
  return ENTETES.filter(e =>
    e.nom.toLowerCase().includes(q) || e.description.toLowerCase().includes(q));
}
