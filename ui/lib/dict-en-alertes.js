/* Dictionnaire anglais — alertes de securite — INTERCEPTOR (by NeoZ)
 *
 * Titres d alerte, gabarits de preuve et atomes inseres dans ces gabarits.
 * Les gabarits gardent leurs trous (`{hote}`, `{acao}`...) : `tp()` y place
 * les valeurs apres traduction.
 *
 * Rappel de la regle qui gouverne cette liste : une alerte ne sort que si
 * elle est demontrable et exploitable. Il n y a donc ici ni « entete
 * manquant », ni « donnee personnelle », ni « pisteur ».
 */
export const EN_ALERTES = {
  /* ------------------------------- Affichage ------------------------------ */
  'Preuve : ': 'Evidence: ',

  /* ------------------------------- Titres --------------------------------- */
  'Identifiants ecrits dans l URL': 'Credentials written in the URL',
  'Jeton passe en query string': 'Token passed in the query string',
  'Jeton JWT non signe (alg: none)': 'Unsigned JWT (alg: none)',
  'Donnees envoyees en clair (HTTP)': 'Data sent in the clear (HTTP)',
  'Contenu mixte sur page HTTPS': 'Mixed content on an HTTPS page',
  'Certificat non fiable': 'Untrusted certificate',
  'Certificat : domaine non concordant': 'Certificate: domain mismatch',
  'Certificat expire ou pas encore valide': 'Certificate expired or not yet valid',
  'Version TLS obsolete': 'Obsolete TLS version',
  'Suite de chiffrement cassee': 'Broken cipher suite',
  'CORS : origine renvoyee en miroir avec credentials':
    'CORS: origin mirrored back with credentials',
  'CORS : origine « null » avec credentials': 'CORS: « null » origin with credentials',
  'Cookie pose en clair': 'Cookie set in the clear',
  'Prefixe __Host- non respecte': '__Host- prefix not respected',
  'Prefixe __Secure- non respecte': '__Secure- prefix not respected',
  'SameSite=None sans Secure': 'SameSite=None without Secure',

  /* ------------------------------- Preuves -------------------------------- */
  'une valeur au format propre a ce fournisseur a ete trouvee dans « {ou} » : ce format ne designe qu un identifiant secret, il ne se confond avec rien':
    'a value in this vendor own format was found in « {ou} »: that format only ever designates a secret credential, it cannot be confused with anything else',
  'l URL contient « {utilisateur}:***@ » : le mot de passe voyage dans l adresse, donc dans l historique, les journaux et l entete Referer':
    'the URL contains « {utilisateur}:***@ »: the password travels inside the address, therefore into history, logs and the Referer header',
  'le parametre « {nom} » porte une valeur de {taille} caracteres ; une URL est journalisee par le serveur, les mandataires et le cache du navigateur':
    'the « {nom} » parameter carries a {taille}-character value; a URL is logged by the server, by proxies and by the browser cache',
  'l entete du jeton declare « alg: none » : sa charge utile se modifie sans cle':
    'the token header declares « alg: none »: its payload can be changed without any key',
  'schema http vers {hote}, avec {raisons} : tout intermediaire du chemin lit et modifie ce contenu':
    'http scheme to {hote}, carrying {raisons}: any intermediary on the path reads and alters this content',
  'la page est en https, cette ressource en http : elle est modifiable en chemin':
    'the page is https, this resource is http: it can be altered on the path',
  'Firefox rejette la chaine de certification de {hote}':
    'Firefox rejects the certificate chain of {hote}',
  'le certificat presente ne couvre pas {hote}':
    'the presented certificate does not cover {hote}',
  'la periode de validite du certificat ne couvre pas la date du jour':
    'the validity period of the certificate does not cover today',
  '{version} est retire depuis 2020 : ses modes de chiffrement sont attaquables':
    '{version} has been withdrawn since 2020: its cipher modes are attackable',
  '{suite} emploie un algorithme casse (RC4, 3DES, DES, NULL, export ou MD5)':
    '{suite} uses a broken algorithm (RC4, 3DES, DES, NULL, export or MD5)',
  'la requete annonce Origin: {origine} et la reponse renvoie exactement Access-Control-Allow-Origin: {acao} avec Allow-Credentials: true — n importe quel site peut donc lire cette reponse authentifiee':
    'the request announces Origin: {origine} and the response returns exactly Access-Control-Allow-Origin: {acao} with Allow-Credentials: true — any site can therefore read this authenticated response',
  'un document sandbox ou une page locale presente Origin: null : la reponse authentifiee lui est ouverte':
    'a sandboxed document or a local page presents Origin: null: the authenticated response is open to it',
  'pose par une reponse http sans attribut Secure : il repartira en clair':
    'set by an http response with no Secure attribute: it will travel back in the clear',
  '__Host- exige Secure, Path=/ et aucun Domain : le navigateur rejette ce cookie':
    '__Host- requires Secure, Path=/ and no Domain: the browser rejects this cookie',
  '__Secure- exige l attribut Secure : le navigateur rejette ce cookie':
    '__Secure- requires the Secure attribute: the browser rejects this cookie',
  'SameSite=None impose Secure : le navigateur rejette ce cookie':
    'SameSite=None requires Secure: the browser rejects this cookie',

  /* ------------------- Atomes inseres dans les gabarits ------------------- */
  'entete Authorization': 'Authorization header',
  'cookie envoye': 'cookie sent',
  'corps de requete': 'request body'
};
