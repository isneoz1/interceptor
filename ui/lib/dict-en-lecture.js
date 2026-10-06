/* Dictionnaire anglais — lectures de la 4.4 — SWIFT (by NeoZ)
 *
 * Complete dict-en.js (`...EN_LECTURE`) : minutage vu par la page,
 * sous-protocoles WebSocket, certificat lu en entier, criteres de recherche du
 * moniteur reseau de Firefox. Et ce que la sonde de traduction a trouve
 * d anterieur : des libelles arrives a `t` par une variable, que la lecture
 * du source ne voyait pas, et qui s affichaient en francais dans l interface
 * anglaise — la session TLS, la sonde de page, la fraicheur HTTP et le sens
 * des directives CSP.
 */
export const EN_LECTURE = {
  /* ------------------------------ Minutage -------------------------------- */
  'Attente': 'Blocked',
  'Connexion TCP': 'TCP connection',
  'Envoi': 'Sending',
  'Attente du premier octet': 'Waiting for the first byte',
  'Reception': 'Receiving',
  'L envoi de la requete n est pas mesure a part : le navigateur ne l expose pas. Il est compris dans « Attente du premier octet ».':
    'Sending the request is not measured separately: the browser does not expose it. It is included in “Waiting for the first byte”.',
  'Le navigateur masque le detail des phases et les tailles : la ressource vient d une autre origine, et sa reponse ne porte aucun en-tete Timing-Allow-Origin.':
    'The browser hides the phase breakdown and the sizes: the resource comes from another origin, and its response carries no Timing-Allow-Origin header.',
  'Le navigateur ne fournit pas le detail des phases ni les tailles de cette ressource.':
    'The browser does not provide the phase breakdown or the sizes of this resource.',
  'Tailles vues par la page': 'Sizes seen by the page',
  'Statut vu par la page': 'Status seen by the page',

  /* ------------------------ Sous-protocoles WebSocket --------------------- */
  'Sous-protocoles proposes': 'Offered subprotocols',
  'Sous-protocole negocie': 'Negotiated subprotocol',
  'Protocole des trames': 'Frame protocol',
  'designe par l URL de la connexion': 'identified by the connection URL',
  'designe par le sous-protocole negocie': 'identified by the negotiated subprotocol',
  'Version MQTT': 'MQTT version',
  'lue dans le paquet CONNECT': 'read from the CONNECT packet',
  '(paquet incomplet)': '(incomplete packet)',
  'tronquee': 'truncated',

  /* ------------------------------ Certificat ------------------------------ */
  'Niveau de validation': 'Validation level',
  'DV — aucune identite affirmee : seul le controle du domaine a ete verifie':
    'DV — no identity asserted: only control of the domain was verified',
  'OV — l identite de l organisation titulaire est affirmee':
    'OV — the identity of the subscriber organization is asserted',
  'IV — l identite de la personne titulaire est affirmee':
    'IV — the identity of the subscriber individual is asserted',
  'EV — validation etendue de l organisation titulaire':
    'EV — extended validation of the subscriber organization',
  'Adresses IP couvertes': 'Covered IP addresses',
  'adresse': 'address',
  'Adresses de courriel': 'Email addresses',
  'courriel': 'email',
  'URI du sujet': 'Subject URIs',
  'URI': 'URI',
  'Revocation et autorite': 'Revocation and authority',
  'Repondeur OCSP': 'OCSP responder',
  'Liste de revocation (CRL)': 'Revocation list (CRL)',
  'Certificat de l emetteur': 'Issuer certificate',
  'Preuves de transparence (SCT)': 'Transparency proofs (SCT)',
  'journal': 'log',
  'SCT': 'SCT',
  'version inconnue de la RFC 6962 (octet {octet}) : non lu':
    'version unknown to RFC 6962 (byte {octet}): not read',
  'v1 tronque : non lu': 'truncated v1: not read',
  'Identifiant de cle': 'Key identifier',
  'Identifiant de cle de l autorite': 'Authority key identifier',
  'Politiques de certification': 'Certificate policies',
  'Copier en PEM': 'Copy as PEM',
  'Certificat copie en PEM': 'Certificate copied as PEM',
  'Ouvrir dans la boite a outils': 'Open in the toolbox',
  /* Noms d extensions et de politiques (asn1.js) */
  'poison de precertificat': 'precertificate poison',
  'TLS Feature (OCSP Must-Staple)': 'TLS Feature (OCSP Must-Staple)',
  'contraintes de noms': 'name constraints',
  'anyPolicy': 'anyPolicy',
  'EV (validation etendue)': 'EV (extended validation)',
  'DV (domaine valide)': 'DV (domain validated)',
  'OV (organisation validee)': 'OV (organization validated)',
  'IV (individu valide)': 'IV (individual validated)',

  /* --------------------------- Session TLS -------------------------------- */
  'Suite de chiffrement': 'Cipher suite',
  'Echange de cles': 'Key exchange group',
  'Schema de signature': 'Signature scheme',
  'Longueur de cle': 'Key length',
  'Domaine non concordant': 'Domain mismatch',
  'Validation etendue': 'Extended validation',
  'Hors periode de validite': 'Outside the validity period',
  'Certificate Transparency': 'Certificate Transparency',
  'HSTS': 'HSTS',
  'HPKP': 'HPKP',
  'Credentials delegues': 'Delegated credentials',
  'ECH': 'ECH',
  'OCSP': 'OCSP',
  'DNS prive': 'Private DNS',
  'Depuis le cache TLS': 'From the TLS cache',
  'Empreinte SHA-1': 'SHA-1 fingerprint',
  'Empreinte SHA-256': 'SHA-256 fingerprint',
  'Valide depuis': 'Valid since',
  'Empreinte de cle publique': 'Public key fingerprint',
  'Racine integree': 'Built-in root',

  /* --------------------------- Sonde de page ------------------------------ */
  'API utilisee': 'API used',
  'Document appelant': 'Calling document',
  'Credentials': 'Credentials',
  'Mode': 'Mode',
  'Cache': 'Cache',
  'Redirection': 'Redirect',
  'Referrer': 'Referrer',
  'Politique de referrer': 'Referrer policy',
  'Keepalive': 'Keepalive',
  'Destination': 'Destination',
  'Asynchrone': 'Asynchronous',
  'Debut (ms)': 'Start (ms)',
  'Fin (ms)': 'End (ms)',
  'Duree mesuree en JS (ms)': 'Duration measured in JS (ms)',
  'Statut vu par JS': 'Status seen by JS',
  'Texte du statut': 'Status text',
  'Type de reponse': 'Response type',
  'URL de reponse': 'Response URL',
  'Servi par un Service Worker': 'Served by a Service Worker',
  'Erreur JavaScript': 'JavaScript error',
  'Domaine de securite': 'Security realm',
  'Demande par le proxy': 'Requested by the proxy',
  'Serveur demandeur': 'Challenging server',

  /* --------------------------- Fraicheur HTTP ----------------------------- */
  'aucune duree explicite : un cache peut appliquer une heuristique, ici 10 % de l age du document':
    'no explicit lifetime: a cache may apply a heuristic, here 10% of the document age',
  'no-store : la reponse ne doit pas etre stockee du tout':
    'no-store: the response must not be stored at all',
  'private : reservee au cache du navigateur, pas a un cache partage':
    'private: for the browser cache only, not for a shared cache',
  'no-cache : stockable, mais a revalider aupres du serveur avant chaque reutilisation':
    'no-cache: storable, but must be revalidated with the server before every reuse',
  'must-revalidate : une fois perimee, jamais servie sans revalidation':
    'must-revalidate: once stale, never served without revalidation',
  'proxy-revalidate : meme regle, pour les caches partages seulement':
    'proxy-revalidate: the same rule, for shared caches only',
  'immutable : le navigateur ne revalide pas tant que la reponse est fraiche, meme au rechargement':
    'immutable: the browser does not revalidate while the response is fresh, even on reload',
  'public : stockable par un cache partage meme si la requete etait authentifiee':
    'public: storable by a shared cache even if the request was authenticated',
  'stale-while-revalidate : sert la version perimee pendant {n} s en revalidant en arriere-plan':
    'stale-while-revalidate: serves the stale version for {n} s while revalidating in the background',
  'stale-if-error : sert la version perimee pendant {n} s si le serveur repond en erreur':
    'stale-if-error: serves the stale version for {n} s if the server answers with an error',
  'no-transform : un intermediaire ne doit pas recompresser ni recoder le corps':
    'no-transform: an intermediary must not recompress or re-encode the body',
  'requete authentifiee sans public/s-maxage/must-revalidate : un cache partage ne doit pas la stocker':
    'authenticated request without public/s-maxage/must-revalidate: a shared cache must not store it',
  'Vary: * : aucune reponse stockee ne peut etre reutilisee sans revalidation':
    'Vary: *: no stored response can be reused without revalidation',
  'la requete porte no-cache : le client exige une revalidation':
    'the request carries no-cache: the client demands revalidation',
  'la requete porte max-age={n} : le client refuse une reponse plus agee':
    'the request carries max-age={n}: the client refuses an older response',
  'directives non normalisees : {liste}': 'non-standard directives: {liste}',
  'aucune duree de fraicheur determinable : a revalider a chaque fois':
    'no freshness lifetime can be determined: revalidate every time',
  'fraiche encore {n} s ({source})': 'still fresh for {n} s ({source})',
  'perimee depuis {n} s ({source}) — revalidable avec {validateurs}':
    'stale for {n} s ({source}) — can be revalidated with {validateurs}',
  'perimee depuis {n} s ({source}) — aucun validateur, a retelecharger':
    'stale for {n} s ({source}) — no validator, must be downloaded again',

  /* --------------------- Sens des directives CSP (csp.js) ----------------- */
  'repli pour toutes les directives de recuperation absentes': 'fallback for every fetch directive that is absent',
  'scripts : balises, inline, eval, workers': 'scripts: elements, inline, eval, workers',
  'scripts dans des balises <script> seulement': 'scripts in <script> elements only',
  'scripts dans des attributs d evenement (onclick...)': 'scripts in event handler attributes (onclick...)',
  'feuilles de style et styles en ligne': 'stylesheets and inline styles',
  'styles dans <style> et <link> seulement': 'styles in <style> and <link> only',
  'styles dans des attributs style=""': 'styles in style="" attributes',
  'images et favicons': 'images and favicons',
  'polices (@font-face)': 'fonts (@font-face)',
  'fetch, XHR, WebSocket, EventSource, beacons': 'fetch, XHR, WebSocket, EventSource, beacons',
  'audio, video, pistes': 'audio, video, tracks',
  'greffons : <object>, <embed>': 'plugins: <object>, <embed>',
  'workers et cadres (repli de frame-src et worker-src)': 'workers and frames (fallback for frame-src and worker-src)',
  'contenu des <iframe> et <frame>': 'content of <iframe> and <frame>',
  'Worker, SharedWorker, ServiceWorker': 'Worker, SharedWorker, ServiceWorker',
  'manifeste d application web': 'web application manifest',
  'prechargements (retire de CSP3)': 'prefetches (removed from CSP3)',
  'URL autorisees dans <base href>': 'URLs allowed in <base href>',
  'bac a sable comme l attribut sandbox d une iframe': 'sandbox, like the sandbox attribute of an iframe',
  'destinations autorisees pour l envoi de formulaires': 'allowed destinations for form submissions',
  'qui a le droit d encadrer cette page (remplace X-Frame-Options)': 'who may embed this page in a frame (replaces X-Frame-Options)',
  'retire de CSP3, jamais deploye largement': 'removed from CSP3, never widely deployed',
  'ou envoyer les violations (deprecie au profit de report-to)': 'where to send violations (deprecated in favour of report-to)',
  'groupe de rapport defini par l en-tete Reporting-Endpoints': 'reporting group defined by the Reporting-Endpoints header',
  'reecrit http:// en https:// avant chaque requete': 'rewrites http:// to https:// before every request',
  'bloque tout contenu mixte (deprecie, remplace par upgrade-insecure-requests)':
    'blocks all mixed content (deprecated, replaced by upgrade-insecure-requests)',
  'exige des Trusted Types pour les puits DOM dangereux': 'requires Trusted Types for dangerous DOM sinks',
  'politiques Trusted Types autorisees': 'allowed Trusted Types policies',
  'retire : exigeait une integrite sur scripts/styles': 'removed: required integrity on scripts/styles',
  'retire : types MIME de greffons': 'removed: plugin MIME types',
  'retire : remplace par l en-tete Referrer-Policy': 'removed: replaced by the Referrer-Policy header',

  /* ------------------ Recherche : criteres de Firefox --------------------- */
  'un entete de requete porte exactement ce nom': 'a request header has exactly this name',
  'un entete de reponse porte exactement ce nom': 'a response header has exactly this name',
  'nom d un cookie pose par la reponse': 'name of a cookie set by the response',
  'domaine d un cookie pose par la reponse (l hote s il n en declare aucun)':
    'domain of a cookie set by the response (the host if it declares none)',
  'valeur d un cookie pose par la reponse': 'value of a cookie set by the response',
  'taille en octets strictement superieure au nombre donne': 'size in bytes strictly greater than the given number',
  'running : en cours ; cached ou from-cache : servi par le cache':
    'running: in progress; cached or from-cache: served from the cache',
  'expression reguliere sur l URL': 'regular expression on the URL',
  'meme critere que {champ} — le nom que lui donne le moniteur reseau de Firefox':
    'same criterion as {champ} — the name the Firefox Network Monitor gives it'
};
