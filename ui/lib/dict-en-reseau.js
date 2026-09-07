/* Dictionnaire anglais — tables reseau, analyse d entetes et certificats
 * INTERCEPTOR (by D4RK)
 *
 * Complete dict-en-tools.js (`...EN_RESEAU`). Couvre ref-reseau.js,
 * entetes-analyse.js et les libelles de asn1.js.
 */
export const EN_RESEAU = {
  /* ------------------------ Fermetures de WebSocket ----------------------- */
  'La transaction est terminee, des deux cotes.': 'The transaction is done, on both sides.',
  'Le serveur s arrete, ou la page a ete quittee.': 'The server is going away, or the page was left.',
  'Une trame invalide a ete recue.': 'An invalid frame was received.',
  'Le point de terminaison ne sait pas traiter ce type de donnees.':
    'The endpoint cannot handle this kind of data.',
  'Reserve, ne doit pas etre employe.': 'Reserved, must not be used.',
  'Fermeture sans code : valeur posee par le navigateur.':
    'Closed with no code: value set by the browser.',
  'Connexion coupee sans trame de fermeture : reseau, mandataire ou plantage.':
    'Connection cut with no close frame: network, proxy or crash.',
  'Message annonce en texte mais invalide en UTF-8.':
    'Message announced as text but invalid as UTF-8.',
  'Le message enfreint une regle du service.': 'The message breaks a policy of the service.',
  'Trame au-dela de ce que le point de terminaison accepte.':
    'Frame beyond what the endpoint accepts.',
  'Le client attendait une extension que le serveur n a pas negociee.':
    'The client expected an extension the server did not negotiate.',
  'Le serveur a rencontre une condition imprevue.': 'The server hit an unexpected condition.',
  'Le service redemarre.': 'The service is restarting.',
  'Surcharge temporaire.': 'Temporary overload.',
  'Reponse invalide d un serveur en amont.': 'Invalid response from an upstream server.',
  'La poignee de main TLS a echoue : valeur posee par le navigateur.':
    'The TLS handshake failed: value set by the browser.',
  'Fermeture normale': 'Normal closure',
  'Depart': 'Going away',
  'Erreur de protocole': 'Protocol error',
  'Type refuse': 'Unsupported data',
  'Reserve': 'Reserved',
  'Aucun code': 'No status received',
  'Fermeture anormale': 'Abnormal closure',
  'Donnees incoherentes': 'Invalid payload data',
  'Regle violee': 'Policy violation',
  'Message trop grand': 'Message too big',
  'Extension manquante': 'Mandatory extension',
  'Erreur interne': 'Internal error',
  'Redemarrage': 'Service restart',
  'Reessayer plus tard': 'Try again later',
  'Mauvaise passerelle': 'Bad gateway',
  'Echec TLS': 'TLS handshake',
  'Code de bibliotheque': 'Library code',
  'Plage reservee aux bibliotheques et cadriciels (3000 a 3999).':
    'Range reserved for libraries and frameworks (3000 to 3999).',
  'Code applicatif': 'Application code',
  'Plage libre, definie par l application (4000 a 4999).':
    'Free range, defined by the application (4000 to 4999).',

  /* ---------------------------- Erreurs HTTP/2 ---------------------------- */
  'Fermeture propre, sans erreur.': 'Clean shutdown, no error.',
  'Erreur de protocole detectee.': 'Protocol error detected.',
  'Defaillance interne du point de terminaison.': 'Internal failure of the endpoint.',
  'Regles de controle de flux enfreintes.': 'Flow-control rules broken.',
  'Les reglages n ont pas ete acquittes a temps.': 'Settings were not acknowledged in time.',
  'Trame recue sur un flux deja ferme.': 'Frame received on an already closed stream.',
  'Trame de taille invalide.': 'Frame of invalid size.',
  'Flux refuse avant tout traitement : rejouable sans risque.':
    'Stream refused before any processing: safe to replay.',
  'Le flux n est plus necessaire.': 'The stream is no longer needed.',
  'Etat de compression des entetes corrompu.': 'Header compression state corrupted.',
  'La connexion etablie par CONNECT a ete reinitialisee.':
    'The connection established by CONNECT was reset.',
  'Trop de charge : le pair demande de ralentir.': 'Too much load: the peer asks you to slow down.',
  'Les proprietes de securite de la connexion sont insuffisantes.':
    'The security properties of the connection are inadequate.',
  'Le pair exige un repli en HTTP/1.1.': 'The peer requires a fallback to HTTP/1.1.',

  /* ------------------------ Erreurs reseau de Firefox --------------------- */
  'Le serveur n a pas repondu dans le delai imparti.': 'The server did not answer within the timeout.',
  'La connexion a ete reinitialisee pendant l echange.': 'The connection was reset during the exchange.',
  'La connexion a ete coupee avant la fin de la reponse.':
    'The connection was cut before the response ended.',
  'Le port est ferme, ou rien n ecoute a cette adresse.':
    'The port is closed, or nothing listens at this address.',
  'Le nom de domaine ne se resout pas.': 'The domain name does not resolve.',
  'Le nom du mandataire ne se resout pas.': 'The proxy name does not resolve.',
  'Le mandataire refuse la connexion.': 'The proxy refuses the connection.',
  'La requete a ete abandonnee, souvent par la page elle-meme.':
    'The request was aborted, often by the page itself.',
  'Chargement interrompu : navigation, onglet ferme, ou regle de blocage.':
    'Load interrupted: navigation, closed tab, or a blocking rule.',
  'Boucle de redirections.': 'Redirect loop.',
  'Le contenu recu ne correspond pas a ce qui etait annonce.':
    'The content received does not match what was announced.',
  'Type de contenu refuse pour des raisons de securite.':
    'Content type refused for security reasons.',
  'Le document demande n est pas dans le cache.': 'The requested document is not in the cache.',
  'URL invalide.': 'Invalid URL.',
  'Schema d URL inconnu du navigateur.': 'URL scheme unknown to the browser.',
  'Firefox interdit ce port pour le trafic web.': 'Firefox forbids this port for web traffic.',
  'Contenu bloque par une politique du navigateur.': 'Content blocked by a browser policy.',
  'Le navigateur est en mode hors ligne.': 'The browser is offline.',
  'Echec generique, sans cause plus precise.': 'Generic failure, with no more precise cause.',
  'Aucune suite de chiffrement commune entre le client et le serveur.':
    'No cipher suite in common between client and server.',
  'Le serveur refuse la version de TLS proposee.': 'The server refuses the offered TLS version.',
  'Le certificat ne couvre pas ce nom de domaine.': 'The certificate does not cover this domain name.',
  'Le certificat est expire.': 'The certificate has expired.',
  'L autorite qui a signe le certificat est inconnue de Firefox.':
    'The authority that signed the certificate is unknown to Firefox.',
  'Le certificat a ete revoque.': 'The certificate has been revoked.',
  'Le certificat est auto-signe.': 'The certificate is self-signed.',
  'Une interception TLS est detectee sur le chemin.': 'A TLS interception is detected on the path.',

  /* --------------------------- Analyse d entetes -------------------------- */
  'rien n est conserve, nulle part': 'nothing is stored, anywhere',
  'conserve, mais revalide a chaque fois': 'stored, but revalidated every time',
  'une reponse perimee ne peut plus servir': 'a stale response may no longer be served',
  'meme regle, pour les caches partages seulement': 'same rule, for shared caches only',
  'les caches partages peuvent conserver': 'shared caches may store it',
  'seul le navigateur peut conserver': 'only the browser may store it',
  'ne changera pas : aucune revalidation avant expiration':
    'will not change: no revalidation before expiry',
  'aucun intermediaire ne doit modifier le contenu':
    'no intermediary may alter the content',
  'le client ne veut que du cache': 'the client wants cache only',
  'efface a la fermeture du navigateur': 'cleared when the browser closes',
  'cookie de session': 'session cookie',
  'sans Secure : le cookie part aussi en HTTP en clair':
    'without Secure: the cookie also travels over cleartext HTTP',
  'sans HttpOnly : un script de la page peut le lire':
    'without HttpOnly: a script on the page can read it',
  'sans SameSite : Firefox applique Lax par defaut, mais rien n est declare':
    'without SameSite: Firefox applies Lax by default, but nothing is declared',
  'SameSite=None sans Secure : le navigateur refusera le cookie':
    'SameSite=None without Secure: the browser will reject the cookie',
  'prefixe __Host- : exige Secure, Path=/ et aucun Domain':
    '__Host- prefix: requires Secure, Path=/ and no Domain',
  'prefixe __Secure- : exige l attribut Secure': '__Secure- prefix: requires the Secure attribute',
  'max-age=0 : chaque acces revalide': 'max-age=0: every access revalidates',
  'aucune directive reconnue': 'no directive recognised',
  "'unsafe-inline' annule l essentiel de la protection":
    "'unsafe-inline' cancels most of the protection",
  "'unsafe-eval' autorise eval()": "'unsafe-eval' allows eval()",
  '« * » autorise n importe quelle origine': '« * » allows any origin',
  '« data: » permet d injecter un script encode': '« data: » allows injecting an encoded script',
  'frame-ancestors * : la page peut etre incluse partout':
    'frame-ancestors *: the page can be framed anywhere',
  'ni default-src ni script-src : la politique ne couvre pas les scripts':
    'neither default-src nor script-src: the policy does not cover scripts',
  'object-src absent : les greffons ne sont pas couverts':
    'object-src missing: plugins are not covered',
  'max-age absent : la directive est ignoree': 'max-age missing: the directive is ignored',
  'max-age=0 : HSTS est desactive pour ce domaine': 'max-age=0: HSTS is disabled for this domain',
  'max-age inferieur a six mois : en dessous des listes de prechargement':
    'max-age below six months: under the preload lists threshold',
  'includeSubDomains absent : les sous-domaines restent joignables en clair':
    'includeSubDomains missing: subdomains remain reachable in the clear',
  'Basic : identifiant et mot de passe voyagent en base64, donc en clair':
    'Basic: username and password travel as base64, therefore in the clear',
  'entete ajoute par un intermediaire : il se falsifie sans difficulte':
    'header added by an intermediary: it is forged without difficulty',
  'valeur ni numerique ni date': 'value neither numeric nor a date',
  'ligne sans deux-points': 'line without a colon',
  'trois parties : voir l onglet JWT pour le decoder':
    'three parts: see the JWT tab to decode it',
  'Delai': 'Delay',
  'Duree': 'Lifetime',
  'Jeton': 'Token',
  'Forme': 'Shape',
  'Identifiant': 'Username',
  'Schema': 'Scheme',
  'Contenu': 'Content',
  'Portion': 'Portion',
  'Demande': 'Request',
  'present': 'present',
  '(vide)': '(empty)',

  /* ------------------------- Certificats et ASN.1 ------------------------- */
  'identifiant de la cle du sujet': 'subject key identifier',
  'usage de la cle': 'key usage',
  'autres noms du sujet (SAN)': 'subject alternative names (SAN)',
  'contraintes de base': 'basic constraints',
  'points de distribution de CRL': 'CRL distribution points',
  'politiques de certification': 'certificate policies',
  'identifiant de la cle de l autorite': 'authority key identifier',
  'usages etendus de la cle': 'extended key usage',
  'acces aux informations de l autorite': 'authority information access',
  'authentification de serveur': 'server authentication',
  'authentification de client': 'client authentication',
  'signature de code': 'code signing',
  'protection du courrier': 'email protection',
  'certificat de l autorite': 'CA issuers',
  'horodatages de transparence des certificats': 'certificate transparency timestamps',
  'signature numerique': 'digital signature',
  'non-repudiation': 'non-repudiation',
  'chiffrement de cle': 'key encipherment',
  'chiffrement de donnees': 'data encipherment',
  'accord de cle': 'key agreement',
  'signature de certificat': 'certificate signing',
  'signature de CRL': 'CRL signing',
  'chiffrement seul': 'encipher only',
  'dechiffrement seul': 'decipher only'
};
