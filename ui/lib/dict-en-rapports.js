/* Dictionnaire anglais — rapports du navigateur (5.0) — SWIFT (by NeoZ)
 *
 * Complete dict-en.js (`...EN_RAPPORTS`) : les rapports que le navigateur
 * envoie (CSP, NEL, API depreciee, intervention, Permissions-Policy) et les
 * en-tetes qui disent ou les envoyer.
 */
export const EN_RAPPORTS = {
  /* ------------------------------- Les blocs -------------------------------- */
  'Rapports du navigateur': 'Browser reports',
  'Collecte des rapports': 'Report collection',
  'Point de collecte « {nom} »': 'Collection endpoint “{nom}”',
  'Groupe « {nom} »': 'Group “{nom}”',
  'NEL : groupe de destination': 'NEL: destination group',
  'NEL : duree de la politique': 'NEL: policy lifetime',
  'Navigateur': 'Browser',

  /* ------------------------------ Types de rapport --------------------------- */
  'Violation de la CSP': 'CSP violation',
  'Erreur reseau (NEL)': 'Network error (NEL)',
  'API depreciee': 'Deprecated API',
  'Intervention du navigateur': 'Browser intervention',
  'Violation de Permissions-Policy': 'Permissions-Policy violation',
  'Plantage': 'Crash',
  'Violation de COEP': 'COEP violation',
  'Violation de COOP': 'COOP violation',
  'Violation de Document-Policy': 'Document-Policy violation',

  /* --------------------------------- Champs --------------------------------- */
  'Directive enfreinte': 'Violated directive',
  'Directive declaree': 'Declared directive',
  'Adresse bloquee': 'Blocked address',
  'Disposition': 'Disposition',
  'Fichier source': 'Source file',
  'Colonne': 'Column',
  'Extrait': 'Sample',
  'Statut du document': 'Document status',
  'Referent': 'Referrer',
  'Politique': 'Policy',
  'Phase': 'Phase',
  'Type d erreur': 'Error type',
  'Duree ecoulee (ms)': 'Elapsed time (ms)',
  'Echantillonnage': 'Sampling fraction',
  'Retrait prevu': 'Anticipated removal',
  'Fonction': 'Feature',
  'Attribut allow': 'allow attribute',
  'Attribut src': 'src attribute',

  /* ---------------------------------- Faits ---------------------------------- */
  'la directive {d} a bloque {u}': 'the {d} directive blocked {u}',
  'politique en rapport seul (Report-Only) : {u} n a pas ete bloque, le navigateur l a seulement signale':
    'report-only policy: {u} was not blocked, the browser only reported it',
  'forme application/csp-report, celle de report-uri : deprecie au profit de report-to et de la Reporting API (CSP §5.3)':
    'application/csp-report form, the report-uri one: deprecated in favour of report-to and the Reporting API (CSP §5.3)',
  'echantillon de requete reussie : NEL rapporte aussi une part des succes (success_fraction)':
    'successful request sample: NEL also reports a share of successes (success_fraction)',
  'erreur reseau {type} pendant la phase {phase} : {sens}': 'network error {type} during the {phase} phase: {sens}',
  'erreur reseau {type} pendant la phase {phase}': 'network error {type} during the {phase} phase',
  'rapport produit {s} s avant son envoi (age)': 'report generated {s} s before it was sent (age)',
  'Reporting-Endpoints : la valeur de {nom} n est pas une chaine, le navigateur ignore ce point de collecte (Reporting API §3.3)':
    'Reporting-Endpoints: the value of {nom} is not a string, the browser ignores this endpoint (Reporting API §3.3)',
  'Reporting-Endpoints : {nom} pointe vers {u}, une origine qui n est pas sure ; le navigateur l ignore (Reporting API §3.3)':
    'Reporting-Endpoints: {nom} points to {u}, an origin that is not secure; the browser ignores it (Reporting API §3.3)',
  'Reporting-Endpoints : la valeur de {nom} n est pas une URL, le navigateur l ignore':
    'Reporting-Endpoints: the value of {nom} is not a URL, the browser ignores it',
  'reponse servie sans connexion sure : le navigateur ignore Reporting-Endpoints et NEL':
    'response served without a secure connection: the browser ignores Reporting-Endpoints and NEL',
  'Report-To : forme d une version anterieure de la Reporting API, remplacee par Reporting-Endpoints':
    'Report-To: form from an earlier version of the Reporting API, replaced by Reporting-Endpoints',
  'NEL max_age 0 : la politique NEL de cette origine est supprimee du cache du navigateur':
    'NEL max_age 0: the NEL policy of this origin is removed from the browser cache',
  'NEL : {s} % des succes et {e} % des echecs seront rapportes': 'NEL: {s} % of successes and {e} % of failures will be reported',
  'NEL : la politique s applique aussi aux sous-domaines (include_subdomains)':
    'NEL: the policy also applies to subdomains (include_subdomains)',
  'en-tete {nom} illisible : {raison}': 'unreadable {nom} header: {raison}',

  /* ------------------------- Types d erreur reseau NEL ----------------------- */
  'requete reussie': 'successful request',
  'le serveur DNS est injoignable': 'the DNS server is unreachable',
  'le serveur DNS a repondu mais ne resout pas l adresse': 'the DNS server responded but cannot resolve the address',
  'la requete au serveur DNS a echoue pour une autre raison': 'the request to the DNS server failed for another reason',
  'l adresse IP resolue a change depuis la reception de la politique NEL': 'the resolved IP address changed since the NEL policy was received',
  'la connexion TCP au serveur a expire': 'the TCP connection to the server timed out',
  'le serveur a ferme la connexion TCP': 'the server closed the TCP connection',
  'la connexion TCP a ete reinitialisee': 'the TCP connection was reset',
  'le serveur a refuse la connexion TCP': 'the server refused the TCP connection',
  'la connexion TCP a ete interrompue': 'the TCP connection was aborted',
  'l adresse IP est invalide': 'the IP address is invalid',
  'l adresse IP est injoignable': 'the IP address is unreachable',
  'la connexion TCP a echoue pour une autre raison': 'the TCP connection failed for another reason',
  'TLS interrompu : version ou suite de chiffrement incompatible': 'TLS aborted: version or cipher mismatch',
  'TLS interrompu : certificat client invalide': 'TLS aborted: invalid client certificate',
  'TLS interrompu : nom invalide dans le certificat': 'TLS aborted: invalid name in the certificate',
  'TLS interrompu : date du certificat invalide': 'TLS aborted: invalid certificate date',
  'TLS interrompu : autorite emettrice invalide': 'TLS aborted: invalid issuing authority',
  'TLS interrompu : certificat invalide': 'TLS aborted: invalid certificate',
  'TLS interrompu : certificat du serveur revoque': 'TLS aborted: server certificate revoked',
  'TLS interrompu : erreur d epinglage de cle': 'TLS aborted: key pinning error',
  'TLS interrompu : erreur de protocole TLS': 'TLS aborted: TLS protocol error',
  'la connexion TLS a echoue pour une autre raison': 'the TLS connection failed for another reason',
  'reponse recue, mais avec un statut 4xx ou 5xx': 'response received, but with a 4xx or 5xx status',
  'connexion interrompue par une erreur de protocole HTTP': 'connection aborted by an HTTP protocol error',
  'reponse vide, longueur ou encodage incorrects': 'empty response, wrong length or encoding',
  'requete abandonnee : boucle de redirections': 'request abandoned: redirect loop',
  'echec du protocole HTTP pour une autre raison': 'HTTP protocol failure for another reason',
  'chargement abandonne par l utilisateur avant la fin': 'load abandoned by the user before it completed',
  'type d erreur inconnu': 'unknown error type'
};
