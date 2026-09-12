/* Dictionnaire anglais — alertes TLS, erreurs HTTP/3 et QUIC, DNS
 * INTERCEPTOR (by NeoZ)
 *
 * Traduction des descriptions de ref-protocoles.js. La cle reste le texte
 * francais, comme partout ailleurs.
 *
 * Ces cinq tables s affichaient encore en francais dans une interface reglee
 * sur l anglais : le panneau appelait bien `t`, mais le dictionnaire n avait
 * aucune de ces cent dix-huit phrases. Le controle de couverture de
 * tests/ui-load.test.mjs lit desormais les tables elles-memes, pour qu un
 * ajout sans traduction fasse echouer la suite plutot que de passer.
 */
export const EN_REF_PROTOCOLES = {
  /* ------------------------------ Alertes TLS ----------------------------- */
  'fermeture normale de la connexion': 'normal connection closure',
  'message recu hors de la sequence attendue': 'message received out of the expected sequence',
  'authentification d un enregistrement echouee (cle ou donnees corrompues)':
    'record authentication failed (wrong key, or corrupted data)',
  'ancien code, ne doit plus etre emis': 'legacy code, must no longer be sent',
  'enregistrement plus long que la limite': 'record longer than the limit',
  'ancien code, compression retiree': 'legacy code, compression was removed',
  'aucun jeu de parametres commun (suites, courbes, versions)':
    'no set of parameters in common (cipher suites, curves, versions)',
  'ancien code SSL 3.0': 'legacy SSL 3.0 code',
  'certificat corrompu ou mal signe': 'certificate corrupted or badly signed',
  'type de certificat non pris en charge': 'certificate type not supported',
  'certificat revoque par son emetteur': 'certificate revoked by its issuer',
  'certificat expire ou pas encore valide': 'certificate expired, or not yet valid',
  'certificat refuse pour une autre raison': 'certificate refused for some other reason',
  'champ hors de portee ou incoherent': 'field out of range, or inconsistent',
  'autorite de certification inconnue ou non approuvee':
    'certificate authority unknown, or not trusted',
  'certificat valide mais acces refuse': 'certificate valid, but access denied',
  'message impossible a decoder': 'message could not be decoded',
  'signature, echange de cle ou Finished invalide':
    'invalid signature, key exchange or Finished',
  'ancien code, suites export retirees': 'legacy code, export cipher suites were removed',
  'version proposee reconnue mais refusee': 'proposed version recognised, but refused',
  'parametres proposes trop faibles pour le serveur':
    'proposed parameters too weak for the server',
  'erreur interne sans rapport avec le pair': 'internal error, unrelated to the peer',
  'repli de version detecte (TLS_FALLBACK_SCSV)':
    'version downgrade detected (TLS_FALLBACK_SCSV)',
  'annule par l utilisateur, sans erreur de protocole':
    'cancelled by the user, with no protocol error',
  'ancien code, renegociation retiree en TLS 1.3':
    'legacy code, renegotiation was removed in TLS 1.3',
  'extension obligatoire absente': 'a mandatory extension is missing',
  'extension recue la ou elle est interdite': 'extension received where it is forbidden',
  /* Les alertes 111 et 114 partagent cette description : une seule entree. */
  'ancien code': 'legacy code',
  'nom SNI inconnu du serveur': 'SNI name unknown to the server',
  'reponse OCSP agrafee invalide': 'invalid stapled OCSP response',
  'identite PSK inconnue': 'unknown PSK identity',
  'certificat client exige mais absent': 'client certificate required, but absent',
  'aucun protocole ALPN commun': 'no ALPN protocol in common',

  /* --------------------------- Erreurs HTTP/3 et QPACK -------------------- */
  'pas d erreur : fermeture ou annulation normale':
    'no error: a normal closure or cancellation',
  'violation du protocole sans code plus precis':
    'protocol violation, with no more specific code',
  /* Partagee avec QUIC 0x01 : les deux tables disent la meme chose. */
  'erreur interne du pair': 'internal error on the peer',
  'flux ouvert par le mauvais pair ou en trop':
    'stream opened by the wrong peer, or one too many',
  'flux de controle ou QPACK ferme': 'a control or QPACK stream was closed',
  'trame recue la ou elle est interdite': 'frame received where it is forbidden',
  'trame mal formee': 'malformed frame',
  'le pair genere trop de charge': 'the peer is generating too much load',
  'identifiant de flux ou de push invalide': 'invalid stream or push identifier',
  'trame SETTINGS invalide': 'invalid SETTINGS frame',
  'SETTINGS attendue en premier, absente': 'SETTINGS expected first, and missing',
  'requete refusee sans traitement : on peut la rejouer':
    'request refused without being processed: it can safely be replayed',
  'requete annulee': 'request cancelled',
  'flux ferme avant la fin de la requete': 'stream closed before the request ended',
  'message HTTP mal forme': 'malformed HTTP message',
  'echec de la connexion TCP derriere un CONNECT':
    'the TCP connection behind a CONNECT failed',
  'le pair demande un repli vers HTTP/1.1': 'the peer is asking to fall back to HTTP/1.1',
  'decodage QPACK impossible': 'QPACK decoding failed',
  'erreur sur le flux encodeur QPACK': 'error on the QPACK encoder stream',
  'erreur sur le flux decodeur QPACK': 'error on the QPACK decoder stream',

  /* ------------------------ Erreurs de transport QUIC --------------------- */
  'fermeture sans erreur': 'closed with no error',
  'serveur refuse la connexion': 'the server is refusing the connection',
  'donnees au-dela de la fenetre annoncee': 'data beyond the advertised window',
  'trop de flux ouverts': 'too many streams open',
  'trame recue dans un etat de flux incompatible':
    'frame received in an incompatible stream state',
  'taille finale de flux incoherente': 'inconsistent final stream size',
  'trame mal encodee': 'badly encoded frame',
  'parametre de transport invalide': 'invalid transport parameter',
  'trop d identifiants de connexion': 'too many connection identifiers',
  'violation generale du protocole': 'general protocol violation',
  'jeton d adresse invalide': 'invalid address token',
  'l application a ferme (code applicatif dans la trame)':
    'the application closed the connection (its own code is in the frame)',
  'trop de donnees cryptographiques en attente': 'too much cryptographic data pending',
  'mise a jour de cle invalide': 'invalid key update',
  'limite de paquets par cle atteinte': 'the packet-per-key limit was reached',
  'aucun chemin reseau utilisable (MTU)': 'no usable network path (MTU)',
  '0x0100 a 0x01ff : alerte TLS, code = 0x0100 + numero d alerte':
    '0x0100 to 0x01ff: a TLS alert, where the code is 0x0100 + the alert number',

  /* --------------------- Types d enregistrement DNS ----------------------- */
  'adresse IPv4': 'IPv4 address',
  'serveur de noms de la zone': 'name server for the zone',
  'alias vers un autre nom': 'alias to another name',
  'debut d autorite : serie, minuteries de la zone':
    'start of authority: serial number, and the zone timers',
  'nom inverse (in-addr.arpa, ip6.arpa)': 'reverse name (in-addr.arpa, ip6.arpa)',
  'materiel et systeme (rarement rempli)':
    'hardware and operating system (rarely filled in)',
  'serveur de courrier, avec priorite': 'mail server, with a priority',
  'texte libre : SPF, DKIM, DMARC, verifications':
    'free text: SPF, DKIM, DMARC, ownership checks',
  'adresse IPv6': 'IPv6 address',
  'service : priorite, poids, port, cible': 'service: priority, weight, port, target',
  'reecriture de nom (SIP, ENUM)': 'name rewriting (SIP, ENUM)',
  'pseudo-enregistrement EDNS': 'EDNS pseudo-record',
  'delegation signee (DNSSEC)': 'signed delegation (DNSSEC)',
  'signature DNSSEC': 'DNSSEC signature',
  'preuve d absence DNSSEC': 'DNSSEC proof that a name does not exist',
  'cle publique de zone': 'zone public key',
  'preuve d absence hachee': 'hashed proof that a name does not exist',
  'parametres NSEC3': 'NSEC3 parameters',
  'association certificat/service (DANE)': 'certificate-to-service association (DANE)',
  'DS publie par l enfant': 'DS published by the child zone',
  'DNSKEY publie par l enfant': 'DNSKEY published by the child zone',
  'liaison de service (ALPN, ECH, ports)': 'service binding (ALPN, ECH, ports)',
  'SVCB specialise pour HTTPS': 'SVCB specialised for HTTPS',
  'obsolete, remplace par TXT': 'obsolete, replaced by TXT',
  'toutes les donnees (souvent refuse, RFC 8482)':
    'everything the server holds (often refused, RFC 8482)',
  'URI associe a un nom': 'URI associated with a name',
  'autorites de certification autorisees a emettre':
    'certificate authorities allowed to issue for this name',

  /* ------------------------ Codes de reponse DNS -------------------------- */
  'pas d erreur': 'no error',
  'requete mal formee': 'malformed query',
  'echec du serveur (souvent DNSSEC ou amont injoignable)':
    'server failure (often DNSSEC, or an unreachable upstream)',
  'le nom n existe pas': 'the name does not exist',
  'operation non prise en charge': 'operation not supported',
  'refuse par politique': 'refused by policy',
  'le nom existe alors qu il ne devrait pas': 'the name exists when it should not',
  'jeu d enregistrements existe deja': 'the record set already exists',
  'jeu d enregistrements absent': 'the record set is missing',
  'serveur non autoritaire pour la zone': 'server not authoritative for the zone',
  'nom hors de la zone': 'name outside the zone',
  'version EDNS ou signature TSIG invalide': 'invalid EDNS version, or invalid TSIG signature',
  'cle non reconnue': 'key not recognised',
  'signature hors de la fenetre temporelle': 'signature outside its time window',
  'mode TKEY invalide': 'invalid TKEY mode',
  'nom de cle en double': 'duplicate key name',
  'algorithme non pris en charge': 'algorithm not supported',
  'MAC tronquee invalide': 'invalid truncated MAC',
  'cookie serveur invalide': 'invalid server cookie'
};
