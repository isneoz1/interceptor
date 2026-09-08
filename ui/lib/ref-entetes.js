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
  ['Idempotency-Key', 'requete', 'Cle qui rend un envoi rejouable sans double effet.']
];

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
