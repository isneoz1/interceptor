/* Dictionnaire anglais — lectures d API (5.1) — SWIFT (by NeoZ)
 *
 * Complete dict-en.js (`...EN_API`) : JSON-RPC 2.0 et SOAP sur HTTP, les
 * problemes HTTP (RFC 9457), et les controles d un corps (type annonce,
 * compression mesuree).
 */
export const EN_API = {
  /* -------------------------- Tableau et recherche -------------------------- */
  'RPC': 'RPC',
  'Methode JSON-RPC ou operation SOAP': 'JSON-RPC method or SOAP operation',
  'methode JSON-RPC ou operation SOAP': 'JSON-RPC method or SOAP operation',

  /* -------------------------------- JSON-RPC -------------------------------- */
  'JSON-RPC 2.0': 'JSON-RPC 2.0',
  'lot de {n} element(s)': 'batch of {n} element(s)',
  'aucun : notification, sans reponse attendue': 'none: a notification, no response expected',
  'id {id}': 'id {id}',
  'Resultat, id {id}': 'Result, id {id}',

  /* ---------------------------------- SOAP ---------------------------------- */
  'SOAP {v}': 'SOAP {v}',
  'Operation': 'Operation',
  'Espace de noms de l operation': 'Operation namespace',
  'SOAPAction': 'SOAPAction',
  'Action (parametre du type)': 'Action (media type parameter)',
  'Blocs d en-tete': 'Header blocks',
  'faute': 'fault',
  '(faute sans message)': '(fault without a message)',
  'Sous-code': 'Subcode',
  'Acteur': 'Actor',
  'Role': 'Role',
  'Element de reponse': 'Response element',

  /* ----------------------------- Faits RPC ---------------------------------- */
  'statut HTTP {statut}, mais {n} erreur(s) JSON-RPC dans le corps : le verdict est dans la reponse, pas dans le statut':
    'HTTP status {statut}, but {n} JSON-RPC error(s) in the body: the verdict is in the response, not in the status',
  'reponse a une notification : un serveur ne doit pas repondre a une notification (JSON-RPC 2.0 §4.1)':
    'response to a notification: a server must not reply to a notification (JSON-RPC 2.0 §4.1)',
  'aucune reponse pour la requete d id {id} : un objet reponse devrait exister pour chaque requete (JSON-RPC 2.0 §6)':
    'no response for the request with id {id}: a response object should exist for each request (JSON-RPC 2.0 §6)',
  'la reponse porte l id {recu}, la requete l id {envoye}': 'the response carries id {recu}, the request id {envoye}',
  'tableau vide en reponse a un lot : un serveur ne doit pas renvoyer de tableau vide (JSON-RPC 2.0 §6)':
    'empty array in response to a batch: a server must not return an empty array (JSON-RPC 2.0 §6)',
  '{n} element(s) du lot ne sont pas des requetes JSON-RPC 2.0 valides':
    '{n} element(s) of the batch are not valid JSON-RPC 2.0 requests',
  '{n} element(s) de la reponse ne sont pas des reponses JSON-RPC 2.0 valides : il en faut exactement un parmi result et error (§5)':
    '{n} element(s) of the response are not valid JSON-RPC 2.0 responses: exactly one of result and error is required (§5)',
  'faute SOAP 1.1 servie avec le statut {statut} : SOAP 1.1 (§6.2) demande HTTP 500 pour une reponse qui porte une faute':
    'SOAP 1.1 fault served with status {statut}: SOAP 1.1 (§6.2) requires HTTP 500 for a response carrying a fault',
  'statut HTTP {statut}, mais la reponse porte une faute SOAP : le verdict est dans l enveloppe':
    'HTTP status {statut}, but the response carries a SOAP fault: the verdict is in the envelope',
  'SOAPAction vide : l intention est alors celle de l URL de la requete (SOAP 1.1)':
    'empty SOAPAction: the intent is then the one of the request URL (SOAP 1.1)',
  'enveloppe lue en partie : le corps capture s arrete avant la fin du XML':
    'envelope read in part: the captured body stops before the end of the XML',

  /* ------------------------- Probleme HTTP (RFC 9457) ----------------------- */
  'Probleme HTTP (RFC 9457)': 'HTTP problem (RFC 9457)',
  'Titre': 'Title',
  'Statut annonce': 'Announced status',
  'Occurrence': 'Occurrence',
  'aucun membre type : il vaut alors about:blank (RFC 9457 §3.1.1)':
    'no type member: it is then about:blank (RFC 9457 §3.1.1)',
  'type about:blank : le probleme n a pas d autre sens que son code HTTP, et le titre devrait reprendre la phrase du statut, « {phrase} », eventuellement traduite (RFC 9457 §4.2.1)':
    'about:blank type: the problem has no meaning beyond its HTTP code, and the title should be the status phrase, “{phrase}”, possibly localised (RFC 9457 §4.2.1)',
  'membre status {membre}, mais statut HTTP {statut} : le serveur doit servir le meme code que le membre status (RFC 9457 §3.1.2)':
    'status member {membre}, but HTTP status {statut}: the server must serve the same code as the status member (RFC 9457 §3.1.2)',
  'type relatif, resolu sur l adresse de la reponse : {resolu} (RFC 9457 §3.1.1)':
    'relative type, resolved against the response address: {resolu} (RFC 9457 §3.1.1)',
  'membre {nom} ignore : sa valeur n a pas le type prevu (RFC 9457 §3.1)':
    '{nom} member ignored: its value does not have the expected type (RFC 9457 §3.1)',

  /* ------------------------- security.txt (RFC 9116) ------------------------ */
  'security.txt (RFC 9116)': 'security.txt (RFC 9116)',
  '{n} champ(s)': '{n} field(s)',
  'aucun champ Contact : il doit toujours etre present (RFC 9116 §2.5.3)':
    'no Contact field: it must always be present (RFC 9116 §2.5.3)',
  'aucun champ Expires : il doit toujours etre present (RFC 9116 §2.5.5)':
    'no Expires field: it must always be present (RFC 9116 §2.5.5)',
  'Expires apparait {n} fois : une seule fois au plus (RFC 9116 §2.5.5)':
    'Expires appears {n} times: once at most (RFC 9116 §2.5.5)',
  'Expires illisible : « {v} » n est pas une date RFC 3339 (RFC 9116 §2.5.5)':
    'unreadable Expires: “{v}” is not an RFC 3339 date (RFC 9116 §2.5.5)',
  'expire depuis le {date} : ces informations sont perimees et ne devraient plus servir (RFC 9116 §2.5.5)':
    'expired since {date}: this information is stale and should no longer be used (RFC 9116 §2.5.5)',
  'Expires a plus d un an de la capture ({date}) : la RFC recommande moins d un an (RFC 9116 §2.5.5)':
    'Expires more than a year after the capture ({date}): the RFC recommends less than a year (RFC 9116 §2.5.5)',
  'Preferred-Languages apparait {n} fois : une seule fois au plus (RFC 9116 §2.5.8)':
    'Preferred-Languages appears {n} times: once at most (RFC 9116 §2.5.8)',
  'Contact {v} : une adresse web doit commencer par https:// (RFC 9116 §2.5.3)':
    'Contact {v}: a web address must start with https:// (RFC 9116 §2.5.3)',
  'Canonical {v} : une adresse web doit commencer par https:// (RFC 9116 §2.5.2)':
    'Canonical {v}: a web address must start with https:// (RFC 9116 §2.5.2)',
  'charge depuis {url}, absente des adresses Canonical du fichier : son contenu ne devrait pas etre tenu pour fiable (RFC 9116 §2.5.2)':
    'loaded from {url}, which is not among the file’s Canonical addresses: its content should not be trusted (RFC 9116 §2.5.2)',
  'fichier charge sans https : la RFC exige https pour y acceder (RFC 9116 §3)':
    'file loaded without https: the RFC requires https to access it (RFC 9116 §3)',
  'type {type} : la RFC demande text/plain en utf-8 (RFC 9116 §3)':
    '{type} type: the RFC requires text/plain in utf-8 (RFC 9116 §3)',
  'fichier a la racine du site : sa place est sous /.well-known/, qui l emporte si les deux existent (RFC 9116 §3)':
    'file at the root of the site: it belongs under /.well-known/, which wins if both exist (RFC 9116 §3)',
  'signe par une signature OpenPGP en clair, comme la RFC le recommande (§2.3) ; la signature n est pas verifiee ici':
    'signed with an OpenPGP cleartext signature, as the RFC recommends (§2.3); the signature is not verified here',
  'non signe : la RFC recommande une signature OpenPGP en clair (RFC 9116 §2.3)':
    'not signed: the RFC recommends an OpenPGP cleartext signature (RFC 9116 §2.3)',

  /* --------------------------- Controles d un corps ------------------------- */
  'annonce {type}, mais le corps n est pas du JSON : {nature} — il commence par « {debut} »':
    'announced as {type}, but the body is not JSON: {nature} — it starts with “{debut}”',
  'annonce {type}, mais le corps est du JSON valide': 'announced as {type}, but the body is valid JSON',
  'annonce {type}, mais les octets sont ceux d une image {format}': 'announced as {type}, but the bytes are those of a {format} image',
  'servi sans compression : {avant} ; en gzip, {apres} — {gain} % de moins, mesure sur les octets recus':
    'served without compression: {avant}; with gzip, {apres} — {gain} % less, measured on the bytes received',
  'une page HTML': 'an HTML page',
  'du XML': 'XML',
  'un corps vide': 'an empty body',
  'du texte': 'text'
};
