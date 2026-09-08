/* Tables de reference des protocoles — INTERCEPTOR (by NeoZ)
 *
 * Alertes TLS (RFC 8446 section 6 et registre IANA), erreurs HTTP/3 et QPACK
 * (RFC 9114 section 8.1, RFC 9204), erreurs de transport QUIC (RFC 9000
 * section 20.1), types d enregistrement et codes de reponse DNS (registre
 * IANA). Chaque ligne cite un code publie ; rien n est invente.
 */

/* --------------------------------- TLS ------------------------------------ */
const A = [
  [0, 'close_notify', 'fermeture normale de la connexion'],
  [10, 'unexpected_message', 'message recu hors de la sequence attendue'],
  [20, 'bad_record_mac', 'authentification d un enregistrement echouee (cle ou donnees corrompues)'],
  [21, 'decryption_failed_RESERVED', 'ancien code, ne doit plus etre emis'],
  [22, 'record_overflow', 'enregistrement plus long que la limite'],
  [30, 'decompression_failure_RESERVED', 'ancien code, compression retiree'],
  [40, 'handshake_failure', 'aucun jeu de parametres commun (suites, courbes, versions)'],
  [41, 'no_certificate_RESERVED', 'ancien code SSL 3.0'],
  [42, 'bad_certificate', 'certificat corrompu ou mal signe'],
  [43, 'unsupported_certificate', 'type de certificat non pris en charge'],
  [44, 'certificate_revoked', 'certificat revoque par son emetteur'],
  [45, 'certificate_expired', 'certificat expire ou pas encore valide'],
  [46, 'certificate_unknown', 'certificat refuse pour une autre raison'],
  [47, 'illegal_parameter', 'champ hors de portee ou incoherent'],
  [48, 'unknown_ca', 'autorite de certification inconnue ou non approuvee'],
  [49, 'access_denied', 'certificat valide mais acces refuse'],
  [50, 'decode_error', 'message impossible a decoder'],
  [51, 'decrypt_error', 'signature, echange de cle ou Finished invalide'],
  [60, 'export_restriction_RESERVED', 'ancien code, suites export retirees'],
  [70, 'protocol_version', 'version proposee reconnue mais refusee'],
  [71, 'insufficient_security', 'parametres proposes trop faibles pour le serveur'],
  [80, 'internal_error', 'erreur interne sans rapport avec le pair'],
  [86, 'inappropriate_fallback', 'repli de version detecte (TLS_FALLBACK_SCSV)'],
  [90, 'user_canceled', 'annule par l utilisateur, sans erreur de protocole'],
  [100, 'no_renegotiation_RESERVED', 'ancien code, renegociation retiree en TLS 1.3'],
  [109, 'missing_extension', 'extension obligatoire absente'],
  [110, 'unsupported_extension', 'extension recue la ou elle est interdite'],
  [111, 'certificate_unobtainable_RESERVED', 'ancien code'],
  [112, 'unrecognized_name', 'nom SNI inconnu du serveur'],
  [113, 'bad_certificate_status_response', 'reponse OCSP agrafee invalide'],
  [114, 'bad_certificate_hash_value_RESERVED', 'ancien code'],
  [115, 'unknown_psk_identity', 'identite PSK inconnue'],
  [116, 'certificate_required', 'certificat client exige mais absent'],
  [120, 'no_application_protocol', 'aucun protocole ALPN commun']
];
export const ALERTES_TLS = A.map(([code, nom, sens]) => ({ code, nom, sens }));
export const decrireAlerteTls = code => ALERTES_TLS.find(a => a.code === Number(code)) || null;

/* -------------------------------- HTTP/3 ---------------------------------- */
const H3 = [
  [0x0100, 'H3_NO_ERROR', 'pas d erreur : fermeture ou annulation normale'],
  [0x0101, 'H3_GENERAL_PROTOCOL_ERROR', 'violation du protocole sans code plus precis'],
  [0x0102, 'H3_INTERNAL_ERROR', 'erreur interne du pair'],
  [0x0103, 'H3_STREAM_CREATION_ERROR', 'flux ouvert par le mauvais pair ou en trop'],
  [0x0104, 'H3_CLOSED_CRITICAL_STREAM', 'flux de controle ou QPACK ferme'],
  [0x0105, 'H3_FRAME_UNEXPECTED', 'trame recue la ou elle est interdite'],
  [0x0106, 'H3_FRAME_ERROR', 'trame mal formee'],
  [0x0107, 'H3_EXCESSIVE_LOAD', 'le pair genere trop de charge'],
  [0x0108, 'H3_ID_ERROR', 'identifiant de flux ou de push invalide'],
  [0x0109, 'H3_SETTINGS_ERROR', 'trame SETTINGS invalide'],
  [0x010a, 'H3_MISSING_SETTINGS', 'SETTINGS attendue en premier, absente'],
  [0x010b, 'H3_REQUEST_REJECTED', 'requete refusee sans traitement : on peut la rejouer'],
  [0x010c, 'H3_REQUEST_CANCELLED', 'requete annulee'],
  [0x010d, 'H3_REQUEST_INCOMPLETE', 'flux ferme avant la fin de la requete'],
  [0x010e, 'H3_MESSAGE_ERROR', 'message HTTP mal forme'],
  [0x010f, 'H3_CONNECT_ERROR', 'echec de la connexion TCP derriere un CONNECT'],
  [0x0110, 'H3_VERSION_FALLBACK', 'le pair demande un repli vers HTTP/1.1'],
  [0x0200, 'QPACK_DECOMPRESSION_FAILED', 'decodage QPACK impossible'],
  [0x0201, 'QPACK_ENCODER_STREAM_ERROR', 'erreur sur le flux encodeur QPACK'],
  [0x0202, 'QPACK_DECODER_STREAM_ERROR', 'erreur sur le flux decodeur QPACK']
];
export const ERREURS_H3 = H3.map(([code, nom, sens]) => ({ code, hex: '0x' + code.toString(16).padStart(4, '0'), nom, sens }));
export const decrireErreurH3 = code => ERREURS_H3.find(e => e.code === Number(code)) || null;

/* --------------------------------- QUIC ----------------------------------- */
const Q = [
  [0x00, 'NO_ERROR', 'fermeture sans erreur'],
  [0x01, 'INTERNAL_ERROR', 'erreur interne du pair'],
  [0x02, 'CONNECTION_REFUSED', 'serveur refuse la connexion'],
  [0x03, 'FLOW_CONTROL_ERROR', 'donnees au-dela de la fenetre annoncee'],
  [0x04, 'STREAM_LIMIT_ERROR', 'trop de flux ouverts'],
  [0x05, 'STREAM_STATE_ERROR', 'trame recue dans un etat de flux incompatible'],
  [0x06, 'FINAL_SIZE_ERROR', 'taille finale de flux incoherente'],
  [0x07, 'FRAME_ENCODING_ERROR', 'trame mal encodee'],
  [0x08, 'TRANSPORT_PARAMETER_ERROR', 'parametre de transport invalide'],
  [0x09, 'CONNECTION_ID_LIMIT_ERROR', 'trop d identifiants de connexion'],
  [0x0a, 'PROTOCOL_VIOLATION', 'violation generale du protocole'],
  [0x0b, 'INVALID_TOKEN', 'jeton d adresse invalide'],
  [0x0c, 'APPLICATION_ERROR', 'l application a ferme (code applicatif dans la trame)'],
  [0x0d, 'CRYPTO_BUFFER_EXCEEDED', 'trop de donnees cryptographiques en attente'],
  [0x0e, 'KEY_UPDATE_ERROR', 'mise a jour de cle invalide'],
  [0x0f, 'AEAD_LIMIT_REACHED', 'limite de paquets par cle atteinte'],
  [0x10, 'NO_VIABLE_PATH', 'aucun chemin reseau utilisable (MTU)'],
  [0x0100, 'CRYPTO_ERROR', '0x0100 a 0x01ff : alerte TLS, code = 0x0100 + numero d alerte']
];
export const ERREURS_QUIC = Q.map(([code, nom, sens]) => ({ code, hex: '0x' + code.toString(16).padStart(2, '0'), nom, sens }));
export function decrireErreurQuic(code) {
  const n = Number(code);
  if (n >= 0x0100 && n <= 0x01ff) {
    const alerte = decrireAlerteTls(n - 0x0100);
    return { code: n, hex: '0x' + n.toString(16), nom: 'CRYPTO_ERROR', sens: 'alerte TLS ' + (n - 0x0100) + (alerte ? ' ' + alerte.nom : '') };
  }
  return ERREURS_QUIC.find(e => e.code === n) || null;
}

/* ---------------------------------- DNS ----------------------------------- */
const T = [
  [1, 'A', 'adresse IPv4'], [2, 'NS', 'serveur de noms de la zone'], [5, 'CNAME', 'alias vers un autre nom'],
  [6, 'SOA', 'debut d autorite : serie, minuteries de la zone'], [12, 'PTR', 'nom inverse (in-addr.arpa, ip6.arpa)'],
  [13, 'HINFO', 'materiel et systeme (rarement rempli)'], [15, 'MX', 'serveur de courrier, avec priorite'],
  [16, 'TXT', 'texte libre : SPF, DKIM, DMARC, verifications'], [28, 'AAAA', 'adresse IPv6'],
  [33, 'SRV', 'service : priorite, poids, port, cible'], [35, 'NAPTR', 'reecriture de nom (SIP, ENUM)'],
  [41, 'OPT', 'pseudo-enregistrement EDNS'], [43, 'DS', 'delegation signee (DNSSEC)'],
  [46, 'RRSIG', 'signature DNSSEC'], [47, 'NSEC', 'preuve d absence DNSSEC'], [48, 'DNSKEY', 'cle publique de zone'],
  [50, 'NSEC3', 'preuve d absence hachee'], [51, 'NSEC3PARAM', 'parametres NSEC3'],
  [52, 'TLSA', 'association certificat/service (DANE)'], [59, 'CDS', 'DS publie par l enfant'],
  [60, 'CDNSKEY', 'DNSKEY publie par l enfant'], [64, 'SVCB', 'liaison de service (ALPN, ECH, ports)'],
  [65, 'HTTPS', 'SVCB specialise pour HTTPS'], [99, 'SPF', 'obsolete, remplace par TXT'],
  [255, 'ANY', 'toutes les donnees (souvent refuse, RFC 8482)'], [256, 'URI', 'URI associe a un nom'],
  [257, 'CAA', 'autorites de certification autorisees a emettre']
];
export const TYPES_DNS = T.map(([code, nom, sens]) => ({ code, nom, sens }));
export const decrireTypeDns = v => TYPES_DNS.find(t => t.code === Number(v) || t.nom === String(v).toUpperCase()) || null;

const R = [
  [0, 'NoError', 'pas d erreur'], [1, 'FormErr', 'requete mal formee'], [2, 'ServFail', 'echec du serveur (souvent DNSSEC ou amont injoignable)'],
  [3, 'NXDomain', 'le nom n existe pas'], [4, 'NotImp', 'operation non prise en charge'], [5, 'Refused', 'refuse par politique'],
  [6, 'YXDomain', 'le nom existe alors qu il ne devrait pas'], [7, 'YXRRSet', 'jeu d enregistrements existe deja'],
  [8, 'NXRRSet', 'jeu d enregistrements absent'], [9, 'NotAuth', 'serveur non autoritaire pour la zone'],
  [10, 'NotZone', 'nom hors de la zone'], [16, 'BADVERS / BADSIG', 'version EDNS ou signature TSIG invalide'],
  [17, 'BADKEY', 'cle non reconnue'], [18, 'BADTIME', 'signature hors de la fenetre temporelle'],
  [19, 'BADMODE', 'mode TKEY invalide'], [20, 'BADNAME', 'nom de cle en double'], [21, 'BADALG', 'algorithme non pris en charge'],
  [22, 'BADTRUNC', 'MAC tronquee invalide'], [23, 'BADCOOKIE', 'cookie serveur invalide']
];
export const RCODES_DNS = R.map(([code, nom, sens]) => ({ code, nom, sens }));
export const decrireRcodeDns = code => RCODES_DNS.find(r => r.code === Number(code)) || null;
