/* Dictionnaire anglais — GraphQL sur HTTP (5.0) — SWIFT (by NeoZ)
 *
 * Complete dict-en.js (`...EN_GRAPHQL`) : la lecture des requetes et des
 * reponses GraphQL, la colonne et le filtre du tableau, les faits constates.
 */
export const EN_GRAPHQL = {
  /* -------------------------- Tableau et recherche -------------------------- */
  'GraphQL': 'GraphQL',
  'Operation GraphQL executee': 'Executed GraphQL operation',
  'operation GraphQL (type et nom)': 'GraphQL operation (type and name)',
  'requete persistee': 'persisted query',

  /* ------------------------------- La requete ------------------------------- */
  'GET, parametres d URL': 'GET, URL parameters',
  'POST, corps JSON': 'POST, JSON body',
  'POST, lot JSON': 'POST, JSON batch',
  'POST, document brut (application/graphql)': 'POST, raw document (application/graphql)',
  'POST, formulaire multipart (envoi de fichiers)': 'POST, multipart form (file upload)',
  'Operation executee': 'Executed operation',
  'Operations du document': 'Operations in the document',
  'operationName': 'operationName',
  'Operation {n} sur {total}': 'Operation {n} of {total}',
  'Requete persistee': 'Persisted query',
  'version {v} · SHA-256 {h}': 'version {v} · SHA-256 {h}',
  'Le hachage annonce n a pas la forme d un SHA-256 : 64 chiffres hexadecimaux.':
    'The announced hash is not shaped like a SHA-256: 64 hexadecimal digits.',
  'Verification du hachage…': 'Checking the hash…',
  'Le hachage correspond au texte envoye : SHA-256 recalcule a l identique.':
    'The hash matches the text sent: SHA-256 recomputed identically.',
  'Le hachage ne correspond pas au texte envoye : SHA-256 recalcule {h}.':
    'The hash does not match the text sent: recomputed SHA-256 {h}.',
  'Calcul SHA-256 indisponible dans ce contexte.': 'SHA-256 unavailable in this context.',
  'Copier le document': 'Copy the document',
  'Document copie': 'Document copied',
  'Hacher, mesurer ou comparer ce document': 'Hash, measure or compare this document',

  /* ------------------------------- La reponse ------------------------------- */
  '{n} erreur(s)': '{n} error(s)',
  'sans erreur': 'no errors',
  'Resultat {n}': 'Result {n}',
  'chemin {c}': 'path {c}',
  'ligne:colonne {l}': 'line:column {l}',
  'code {c}': 'code {c}',
  '(erreur sans message)': '(error without a message)',
  'Types du schema': 'Schema types',
  '{n}, dont {p} propres a l API': '{n}, of which {p} belong to the API',
  'Type des requetes': 'Query type',
  'Type des mutations': 'Mutation type',
  'Type des abonnements': 'Subscription type',
  'Directives': 'Directives',

  /* ------------------------------ Les faits lus ----------------------------- */
  'mutation envoyee en GET : GraphQL over HTTP (§4.3) interdit d executer une mutation sur une requete GET et demande un statut 4xx, 405 recommande':
    'mutation sent with GET: GraphQL over HTTP (§4.3) forbids executing a mutation from a GET request and requires a 4xx status, 405 recommended',
  'le serveur l a executee (statut {statut}) : une requete GET part d un simple lien ou d une image, avec les cookies du site':
    'the server executed it (status {statut}): a GET request can come from a mere link or image, with the site cookies',
  'le serveur l a refusee (statut {statut}), comme le demande la specification':
    'the server refused it (status {statut}), as the specification requires',
  'le document contient {n} operations et aucun operationName : le serveur ne peut pas choisir laquelle executer (GraphQL §6.1)':
    'the document holds {n} operations and no operationName: the server cannot choose which one to execute (GraphQL §6.1)',
  'operationName « {nom} » ne designe aucune operation du document (GraphQL §6.1)':
    'operationName “{nom}” names no operation of the document (GraphQL §6.1)',
  'le parametre {nom} n est pas du JSON valide': 'the {nom} parameter is not valid JSON',
  'requete d introspection : elle demande le schema de l API (__schema ou __type)':
    'introspection query: it asks for the API schema (__schema or __type)',
  'requete persistee : seul le hachage SHA-256 du document est envoye, le serveur doit deja le connaitre':
    'persisted query: only the SHA-256 hash of the document is sent, the server must already know it',
  'lot de {n} operations dans une seule requete HTTP (pratique d Apollo et d autres serveurs, hors de la specification GraphQL over HTTP)':
    'batch of {n} operations in a single HTTP request (an Apollo and other servers practice, outside the GraphQL over HTTP specification)',
  'statut HTTP {statut}, mais {n} erreur(s) GraphQL dans le corps : le verdict est dans la reponse, pas dans le statut':
    'HTTP status {statut}, but {n} GraphQL error(s) in the body: the verdict is in the response, not in the status',
  'reponse sans entree data servie avec le statut {statut} : pour application/graphql-response+json, GraphQL over HTTP (§5) demande un statut 4xx ou 5xx':
    'response without a data entry served with status {statut}: for application/graphql-response+json, GraphQL over HTTP (§5) requires a 4xx or 5xx status',
  'reponse avec des donnees servie avec le statut {statut} : pour application/graphql-response+json, GraphQL over HTTP (§5) demande un statut 2xx quand data n est pas null':
    'response with data served with status {statut}: for application/graphql-response+json, GraphQL over HTTP (§5) requires a 2xx status when data is not null',
  'type application/graphql-response+json : celui que definit GraphQL over HTTP pour les reponses':
    'application/graphql-response+json type: the one GraphQL over HTTP defines for responses',
  'type application/json : accepte pour les clients qui n annoncent pas application/graphql-response+json (GraphQL over HTTP §5)':
    'application/json type: accepted for clients that do not announce application/graphql-response+json (GraphQL over HTTP §5)',
  'le serveur ne connait pas ce hachage (PERSISTED_QUERY_NOT_FOUND) : le client renvoie normalement la requete avec son texte complet':
    'the server does not know this hash (PERSISTED_QUERY_NOT_FOUND): the client normally sends the query again with its full text',
  'le serveur a repondu a l introspection : son schema ({n} types) est livre a qui le demande':
    'the server answered the introspection: its schema ({n} types) is handed to anyone who asks',
  'resultat complet : des donnees, aucune erreur': 'complete result: data, no errors',
  'resultat partiel : des champs ont echoue, les autres sont la (GraphQL §7.1)':
    'partial result: some fields failed, the others are there (GraphQL §7.1)',
  'erreur d execution : data vaut null, aucun resultat n a pu etre produit (GraphQL §7.1)':
    'execution error: data is null, no result could be produced (GraphQL §7.1)',
  'erreur de requete : aucune entree data, rien n a ete execute (GraphQL §7.1)':
    'request error: no data entry, nothing was executed (GraphQL §7.1)',

  /* ------------------------- Faits de l analyseur --------------------------- */
  'mutation GraphQL executee sur une requete GET (statut {statut}) : GraphQL over HTTP (§4.3) l interdit, et un simple lien ou une image peut la declencher avec les cookies du site':
    'GraphQL mutation executed from a GET request (status {statut}): GraphQL over HTTP (§4.3) forbids it, and a mere link or image can trigger it with the site cookies',
  'le serveur a repondu a une introspection GraphQL : son schema ({n} types) est livre a qui le demande':
    'the server answered a GraphQL introspection: its schema ({n} types) is handed to anyone who asks'
};
