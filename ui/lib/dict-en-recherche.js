/* Dictionnaire anglais — criteres de recherche — INTERCEPTOR (by NeoZ)
 *
 * La table FIELDS de ui/lib/filters.js decrit chaque critere de recherche.
 * La vue « Aide » en fait un tableau « Critere / Signification », et ces
 * descriptions vivent dans une donnee : le controle de couverture, qui ne lit
 * que les appels litteraux t('...'), ne les voyait pas. Le tableau entier
 * restait donc en francais dans une interface anglaise.
 */
export const EN_RECHERCHE = {
  /* ------------------------- Ce que porte la requete ---------------------- */
  'verbe HTTP': 'HTTP verb',
  'code de statut, accepte 2xx a 5xx': 'status code, accepts 2xx to 5xx',
  'type de ressource': 'resource type',
  'hote': 'host',
  'chemin et parametres': 'path and query',
  'type de contenu': 'content type',
  'protocole (http, https, ws...)': 'protocol (http, https, ws...)',
  'protocole reel (h2, h3...)': 'actual protocol (h2, h3...)',
  'adresse du serveur': 'server address',
  'version TLS': 'TLS version',
  'document a l origine': 'originating document',
  'message d erreur': 'error message',
  'pending, complete, error, aborted': 'pending, complete, error, aborted',

  /* ------------------------------ Ce qu on mesure ------------------------- */
  'taille en octets': 'size in bytes',
  'octets reellement echanges': 'bytes actually exchanged',
  'duree en millisecondes': 'duration in milliseconds',
  'nombre d alertes': 'number of alerts',
  'nombre de redirections': 'number of redirects',
  'nombre de trames WebSocket': 'number of WebSocket frames',
  'nombre de messages SSE': 'number of SSE messages',
  'nombre de Set-Cookie': 'number of Set-Cookie headers',

  /* ---------------------------- Ce qu on a ajoute ------------------------- */
  'marqueur pose par l analyse': 'tag set by the analyser',
  'niveau de risque': 'severity level',
  'couche de capture': 'capture layer',
  'annotation libre': 'free-form annotation',
  'marquage couleur': 'colour marking',
  'lignes epinglees': 'pinned rows',
  'classement de pistage etabli par Firefox': 'tracking classification set by Firefox',

  /* ------------------------------ Oui ou non ------------------------------ */
  'requete tierce': 'third-party request',
  'servi par le cache': 'served from cache',
  'corps de reponse capture': 'response body captured',
  'pile JavaScript presente': 'JavaScript stack present',
  'navigation privee': 'private browsing',
  'requete rejouee': 'replayed request',
  'ligne venue d un fichier HAR importe': 'row from an imported HAR file',

  /* ------------------------------ Identifiants ---------------------------- */
  'identifiant d onglet': 'tab id',
  'identifiant de cadre': 'frame id',
  'identifiant de ligne': 'row id',

  /* ------------------------ Les sections de l aide ------------------------ */
  /* Ces paragraphes se construisent dans render(), pour les deux langues :
     contrairement au reste du manuel ils n ont pas de jumeau dans
     content-en.js, et passent donc par le dictionnaire. */
  'Ecrivez du texte libre, ou combinez les criteres ci-dessous. Prefixez par un tiret pour exclure : « -image ». Encadrez de guillemets pour chercher une expression avec des espaces. Une expression reguliere s ecrit entre deux barres obliques : /\\/api\\/v[0-9]+\\//.':
    'Type free text, or combine the criteria below. Prefix with a dash to exclude: "-image". Wrap in quotes to search for a phrase containing spaces. A regular expression goes between two slashes: /\\/api\\/v[0-9]+\\//.',
  'La case « corps » a cote de la recherche delegue le travail au noyau : il cherche aussi dans les corps, les entetes, les trames WebSocket, les messages SSE et les piles JavaScript. Les corps ne transitent jamais en masse vers l interface, seuls les identifiants correspondants reviennent.':
    'The "bodies" box next to the search hands the work to the kernel: it also searches bodies, headers, WebSocket frames, SSE messages and JavaScript stacks. Bodies never travel to the interface in bulk - only the matching row ids come back.',
  'Un chargement temporaire (about:debugging) disparait a la fermeture de Firefox. Pour une installation durable il faut un paquet .xpi signe par Mozilla, ou Firefox Developer Edition / Nightly avec xpinstall.signatures.required = false dans about:config.':
    'A temporary load (about:debugging) disappears when Firefox closes. A lasting installation needs an .xpi signed by Mozilla, or Firefox Developer Edition / Nightly with xpinstall.signatures.required = false in about:config.',
  'Version {v} — {auteur} — console : {url}': 'Version {v} — {auteur} — console: {url}',
  'Copier l adresse de cette console': 'Copy this console address',
  'Adresse de la console copiee': 'Console address copied',

  /* --------------------------- Autour du tableau -------------------------- */
  /* « valeur » vit dans dict-en-panneaux2.js et « URL complete » dans
     dict-en.js : une cle ne se definit qu a un seul endroit. */
  '{aide}  (comparaisons > >= < <= =)': '{aide}  (comparisons > >= < <= =)'
};
