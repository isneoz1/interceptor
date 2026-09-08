/* Tables de reference reseau — INTERCEPTOR (by NeoZ)
 *
 * Suites TLS, codes de fermeture WebSocket, erreurs HTTP/2 et codes d erreur
 * reseau de Firefox. Ce sont exactement les valeurs que la capture affiche :
 * l extension montre « TLS_AES_128_GCM_SHA256 » ou « NS_ERROR_NET_TIMEOUT »,
 * et cette table dit ce que cela veut dire.
 */

/* --------------------------------- TLS ------------------------------------ */
/* Champs : nom, version, echange de cle, authentification, chiffrement,
   integrite, solidite. « PFS » signale la confidentialite persistante. */
const S = [
  ['TLS_AES_128_GCM_SHA256', 'TLS 1.3', 'ECDHE', 'certificat', 'AES-128-GCM', 'SHA-256', 'forte'],
  ['TLS_AES_256_GCM_SHA384', 'TLS 1.3', 'ECDHE', 'certificat', 'AES-256-GCM', 'SHA-384', 'forte'],
  ['TLS_CHACHA20_POLY1305_SHA256', 'TLS 1.3', 'ECDHE', 'certificat', 'ChaCha20-Poly1305', 'SHA-256', 'forte'],
  ['TLS_AES_128_CCM_SHA256', 'TLS 1.3', 'ECDHE', 'certificat', 'AES-128-CCM', 'SHA-256', 'forte'],
  ['TLS_AES_128_CCM_8_SHA256', 'TLS 1.3', 'ECDHE', 'certificat', 'AES-128-CCM court', 'SHA-256', 'moyenne'],

  ['TLS_ECDHE_ECDSA_WITH_AES_128_GCM_SHA256', 'TLS 1.2', 'ECDHE', 'ECDSA', 'AES-128-GCM', 'SHA-256', 'forte'],
  ['TLS_ECDHE_ECDSA_WITH_AES_256_GCM_SHA384', 'TLS 1.2', 'ECDHE', 'ECDSA', 'AES-256-GCM', 'SHA-384', 'forte'],
  ['TLS_ECDHE_ECDSA_WITH_CHACHA20_POLY1305_SHA256', 'TLS 1.2', 'ECDHE', 'ECDSA', 'ChaCha20-Poly1305', 'SHA-256', 'forte'],
  ['TLS_ECDHE_RSA_WITH_AES_128_GCM_SHA256', 'TLS 1.2', 'ECDHE', 'RSA', 'AES-128-GCM', 'SHA-256', 'forte'],
  ['TLS_ECDHE_RSA_WITH_AES_256_GCM_SHA384', 'TLS 1.2', 'ECDHE', 'RSA', 'AES-256-GCM', 'SHA-384', 'forte'],
  ['TLS_ECDHE_RSA_WITH_CHACHA20_POLY1305_SHA256', 'TLS 1.2', 'ECDHE', 'RSA', 'ChaCha20-Poly1305', 'SHA-256', 'forte'],
  ['TLS_DHE_RSA_WITH_AES_128_GCM_SHA256', 'TLS 1.2', 'DHE', 'RSA', 'AES-128-GCM', 'SHA-256', 'forte'],
  ['TLS_DHE_RSA_WITH_AES_256_GCM_SHA384', 'TLS 1.2', 'DHE', 'RSA', 'AES-256-GCM', 'SHA-384', 'forte'],

  ['TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA256', 'TLS 1.2', 'ECDHE', 'ECDSA', 'AES-128-CBC', 'SHA-256', 'moyenne'],
  ['TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA256', 'TLS 1.2', 'ECDHE', 'RSA', 'AES-128-CBC', 'SHA-256', 'moyenne'],
  ['TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA384', 'TLS 1.2', 'ECDHE', 'RSA', 'AES-256-CBC', 'SHA-384', 'moyenne'],
  ['TLS_ECDHE_ECDSA_WITH_AES_128_CBC_SHA', 'TLS 1.0+', 'ECDHE', 'ECDSA', 'AES-128-CBC', 'SHA-1', 'moyenne'],
  ['TLS_ECDHE_RSA_WITH_AES_128_CBC_SHA', 'TLS 1.0+', 'ECDHE', 'RSA', 'AES-128-CBC', 'SHA-1', 'moyenne'],
  ['TLS_ECDHE_RSA_WITH_AES_256_CBC_SHA', 'TLS 1.0+', 'ECDHE', 'RSA', 'AES-256-CBC', 'SHA-1', 'moyenne'],
  ['TLS_DHE_RSA_WITH_AES_128_CBC_SHA', 'TLS 1.0+', 'DHE', 'RSA', 'AES-128-CBC', 'SHA-1', 'moyenne'],
  ['TLS_DHE_RSA_WITH_AES_256_CBC_SHA', 'TLS 1.0+', 'DHE', 'RSA', 'AES-256-CBC', 'SHA-1', 'moyenne'],

  ['TLS_RSA_WITH_AES_128_GCM_SHA256', 'TLS 1.2', 'RSA', 'RSA', 'AES-128-GCM', 'SHA-256', 'faible'],
  ['TLS_RSA_WITH_AES_256_GCM_SHA384', 'TLS 1.2', 'RSA', 'RSA', 'AES-256-GCM', 'SHA-384', 'faible'],
  ['TLS_RSA_WITH_AES_128_CBC_SHA256', 'TLS 1.2', 'RSA', 'RSA', 'AES-128-CBC', 'SHA-256', 'faible'],
  ['TLS_RSA_WITH_AES_128_CBC_SHA', 'TLS 1.0+', 'RSA', 'RSA', 'AES-128-CBC', 'SHA-1', 'faible'],
  ['TLS_RSA_WITH_AES_256_CBC_SHA', 'TLS 1.0+', 'RSA', 'RSA', 'AES-256-CBC', 'SHA-1', 'faible'],
  ['TLS_RSA_WITH_3DES_EDE_CBC_SHA', 'TLS 1.0+', 'RSA', 'RSA', '3DES', 'SHA-1', 'cassee'],
  ['TLS_RSA_WITH_RC4_128_SHA', 'TLS 1.0+', 'RSA', 'RSA', 'RC4', 'SHA-1', 'cassee'],
  ['TLS_RSA_WITH_RC4_128_MD5', 'TLS 1.0+', 'RSA', 'RSA', 'RC4', 'MD5', 'cassee'],
  ['TLS_ECDHE_RSA_WITH_3DES_EDE_CBC_SHA', 'TLS 1.0+', 'ECDHE', 'RSA', '3DES', 'SHA-1', 'cassee'],
  ['TLS_ECDHE_RSA_WITH_RC4_128_SHA', 'TLS 1.0+', 'ECDHE', 'RSA', 'RC4', 'SHA-1', 'cassee']
];

export const SUITES_TLS = S.map(([nom, version, echange, authentification, chiffrement, integrite, solidite]) => ({
  nom, version, echange, authentification, chiffrement, integrite, solidite,
  pfs: echange === 'ECDHE' || echange === 'DHE'
}));

const INDEX_TLS = new Map(SUITES_TLS.map(s => [s.nom, s]));

/**
 * Lecture d une suite de chiffrement telle que Firefox la nomme. Une suite
 * absente de la table est decrite par son nom, jamais inventee.
 */
export function decrireSuiteTls(nom) {
  const cle = String(nom || '').trim().toUpperCase();
  const connue = INDEX_TLS.get(cle);
  if (connue) return connue;
  if (!cle) return null;
  return {
    nom: cle, version: null, echange: null, authentification: null,
    chiffrement: null, integrite: null, solidite: 'inconnue de cette table',
    pfs: cle.includes('ECDHE') || cle.includes('DHE')
  };
}

export function chercherSuitesTls(question) {
  const q = String(question || '').trim().toLowerCase();
  if (!q) return SUITES_TLS;
  return SUITES_TLS.filter(s => s.nom.toLowerCase().includes(q) ||
    String(s.chiffrement).toLowerCase().includes(q) || String(s.solidite).includes(q));
}

/* ------------------------- Fermetures de WebSocket ------------------------ */
const W = [
  [1000, 'Fermeture normale', 'La transaction est terminee, des deux cotes.'],
  [1001, 'Depart', 'Le serveur s arrete, ou la page a ete quittee.'],
  [1002, 'Erreur de protocole', 'Une trame invalide a ete recue.'],
  [1003, 'Type refuse', 'Le point de terminaison ne sait pas traiter ce type de donnees.'],
  [1004, 'Reserve', 'Reserve, ne doit pas etre employe.'],
  [1005, 'Aucun code', 'Fermeture sans code : valeur posee par le navigateur.'],
  [1006, 'Fermeture anormale', 'Connexion coupee sans trame de fermeture : reseau, mandataire ou plantage.'],
  [1007, 'Donnees incoherentes', 'Message annonce en texte mais invalide en UTF-8.'],
  [1008, 'Regle violee', 'Le message enfreint une regle du service.'],
  [1009, 'Message trop grand', 'Trame au-dela de ce que le point de terminaison accepte.'],
  [1010, 'Extension manquante', 'Le client attendait une extension que le serveur n a pas negociee.'],
  [1011, 'Erreur interne', 'Le serveur a rencontre une condition imprevue.'],
  [1012, 'Redemarrage', 'Le service redemarre.'],
  [1013, 'Reessayer plus tard', 'Surcharge temporaire.'],
  [1014, 'Mauvaise passerelle', 'Reponse invalide d un serveur en amont.'],
  [1015, 'Echec TLS', 'La poignee de main TLS a echoue : valeur posee par le navigateur.']
];

export const FERMETURES_WS = W.map(([code, nom, sens]) => ({ code, nom, sens }));

export function decrireFermetureWs(code) {
  const n = Number(code);
  const connue = FERMETURES_WS.find(f => f.code === n);
  if (connue) return connue;
  if (n >= 3000 && n <= 3999) {
    return { code: n, nom: 'Code de bibliotheque', sens: 'Plage reservee aux bibliotheques et cadriciels (3000 a 3999).' };
  }
  if (n >= 4000 && n <= 4999) {
    return { code: n, nom: 'Code applicatif', sens: 'Plage libre, definie par l application (4000 a 4999).' };
  }
  return null;
}

/* ---------------------------- Erreurs HTTP/2 ------------------------------ */
const H = [
  [0x0, 'NO_ERROR', 'Fermeture propre, sans erreur.'],
  [0x1, 'PROTOCOL_ERROR', 'Erreur de protocole detectee.'],
  [0x2, 'INTERNAL_ERROR', 'Defaillance interne du point de terminaison.'],
  [0x3, 'FLOW_CONTROL_ERROR', 'Regles de controle de flux enfreintes.'],
  [0x4, 'SETTINGS_TIMEOUT', 'Les reglages n ont pas ete acquittes a temps.'],
  [0x5, 'STREAM_CLOSED', 'Trame recue sur un flux deja ferme.'],
  [0x6, 'FRAME_SIZE_ERROR', 'Trame de taille invalide.'],
  [0x7, 'REFUSED_STREAM', 'Flux refuse avant tout traitement : rejouable sans risque.'],
  [0x8, 'CANCEL', 'Le flux n est plus necessaire.'],
  [0x9, 'COMPRESSION_ERROR', 'Etat de compression des entetes corrompu.'],
  [0xa, 'CONNECT_ERROR', 'La connexion etablie par CONNECT a ete reinitialisee.'],
  [0xb, 'ENHANCE_YOUR_CALM', 'Trop de charge : le pair demande de ralentir.'],
  [0xc, 'INADEQUATE_SECURITY', 'Les proprietes de securite de la connexion sont insuffisantes.'],
  [0xd, 'HTTP_1_1_REQUIRED', 'Le pair exige un repli en HTTP/1.1.']
];

export const ERREURS_H2 = H.map(([code, nom, sens]) => ({ code, nom, sens }));

export function decrireErreurH2(code) {
  const n = typeof code === 'string' ? parseInt(code, 16) : Number(code);
  return ERREURS_H2.find(e => e.code === n) || null;
}

/* ----------------------- Erreurs reseau de Firefox ------------------------ */
/* Ce sont les chaines que `webRequest.onErrorOccurred` place dans `error`,
   et que la vue Requetes affiche telles quelles. */
const F = [
  ['NS_ERROR_NET_TIMEOUT', 'Le serveur n a pas repondu dans le delai imparti.'],
  ['NS_ERROR_NET_RESET', 'La connexion a ete reinitialisee pendant l echange.'],
  ['NS_ERROR_NET_INTERRUPT', 'La connexion a ete coupee avant la fin de la reponse.'],
  ['NS_ERROR_CONNECTION_REFUSED', 'Le port est ferme, ou rien n ecoute a cette adresse.'],
  ['NS_ERROR_UNKNOWN_HOST', 'Le nom de domaine ne se resout pas.'],
  ['NS_ERROR_UNKNOWN_PROXY_HOST', 'Le nom du mandataire ne se resout pas.'],
  ['NS_ERROR_PROXY_CONNECTION_REFUSED', 'Le mandataire refuse la connexion.'],
  ['NS_ERROR_ABORT', 'La requete a ete abandonnee, souvent par la page elle-meme.'],
  ['NS_BINDING_ABORTED', 'Chargement interrompu : navigation, onglet ferme, ou regle de blocage.'],
  ['NS_ERROR_REDIRECT_LOOP', 'Boucle de redirections.'],
  ['NS_ERROR_CORRUPTED_CONTENT', 'Le contenu recu ne correspond pas a ce qui etait annonce.'],
  ['NS_ERROR_UNSAFE_CONTENT_TYPE', 'Type de contenu refuse pour des raisons de securite.'],
  ['NS_ERROR_DOCUMENT_NOT_CACHED', 'Le document demande n est pas dans le cache.'],
  ['NS_ERROR_MALFORMED_URI', 'URL invalide.'],
  ['NS_ERROR_UNKNOWN_PROTOCOL', 'Schema d URL inconnu du navigateur.'],
  ['NS_ERROR_PORT_ACCESS_NOT_ALLOWED', 'Firefox interdit ce port pour le trafic web.'],
  ['NS_ERROR_CONTENT_BLOCKED', 'Contenu bloque par une politique du navigateur.'],
  ['NS_ERROR_OFFLINE', 'Le navigateur est en mode hors ligne.'],
  ['NS_ERROR_FAILURE', 'Echec generique, sans cause plus precise.'],
  ['SSL_ERROR_NO_CYPHER_OVERLAP', 'Aucune suite de chiffrement commune entre le client et le serveur.'],
  ['SSL_ERROR_PROTOCOL_VERSION_ALERT', 'Le serveur refuse la version de TLS proposee.'],
  ['SSL_ERROR_BAD_CERT_DOMAIN', 'Le certificat ne couvre pas ce nom de domaine.'],
  ['SEC_ERROR_EXPIRED_CERTIFICATE', 'Le certificat est expire.'],
  ['SEC_ERROR_UNKNOWN_ISSUER', 'L autorite qui a signe le certificat est inconnue de Firefox.'],
  ['SEC_ERROR_REVOKED_CERTIFICATE', 'Le certificat a ete revoque.'],
  ['MOZILLA_PKIX_ERROR_SELF_SIGNED_CERT', 'Le certificat est auto-signe.'],
  ['MOZILLA_PKIX_ERROR_MITM_DETECTED', 'Une interception TLS est detectee sur le chemin.']
];

export const ERREURS_FIREFOX = F.map(([code, sens]) => ({ code, sens }));

/** Explique un code d erreur reseau, meme accompagne d un suffixe. */
export function decrireErreurReseau(valeur) {
  const brut = String(valeur || '').trim().toUpperCase();
  if (!brut) return null;
  return ERREURS_FIREFOX.find(e => brut.includes(e.code)) || null;
}
