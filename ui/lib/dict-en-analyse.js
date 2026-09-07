/* Dictionnaire anglais — analyses, trames et bandeau — INTERCEPTOR (by D4RK)
 *
 * Ce fichier couvre trois endroits qui parlaient encore francais en anglais :
 *   - le bandeau du bas et ses compteurs ;
 *   - les analyses branchees dans le panneau de detail (CSP, fraicheur, corps
 *     multipart) ;
 *   - le decodage des trames WebSocket et HTTP/2, et la forme canonique d URL.
 *
 * La cle reste le texte francais du code : une entree absente laisse le
 * francais s afficher, jamais un vide ni une cle brute.
 */
export const EN_ANALYSE = {
  /* ------------------------------ Bandeau du bas -------------------------- */
  'Connexion au noyau…': 'Connecting to the kernel…',
  'Enregistrees': 'Recorded',
  'En memoire': 'In memory',
  'Debit': 'Rate',
  'Entrant': 'Inbound',
  'Sortant': 'Outbound',
  'Sondes page': 'Page probes',
  'Simulees': 'Mocked',
  'Purgees': 'Dropped',
  'actif depuis': 'up for',

  /* ------------------------------- Journaux ------------------------------- */
  'supprime': 'removed',
  'pose': 'set',
  'ajoute': 'added',
  'modifie': 'changed',
  'explicite': 'explicit',

  /* -------------------------------- Regles -------------------------------- */
  'Bloquer la requete': 'Block the request',
  'Rediriger vers une autre URL': 'Redirect to another URL',
  'Forcer le HTTPS': 'Force HTTPS',
  'Modifier les entetes': 'Modify headers',
  'Simuler la reponse': 'Mock the response',
  'Retarder la requete': 'Delay the request',
  'Chercher-remplacer dans la reponse': 'Find and replace in the response',
  'Definir': 'Set',
  'Retirer': 'Remove',
  'L expression d URL de cette regle est illisible : elle ne correspondra a aucune requete tant qu elle n est pas corrigee.':
    'This rule has an unreadable URL expression: it will match no request until it is fixed.',

  /* --------------------- Fraicheur HTTP (RFC 9111) ------------------------ */
  'Fraicheur HTTP': 'HTTP freshness',
  'Stockable en cache': 'Storable in cache',
  'Duree de fraicheur': 'Freshness lifetime',
  'Determinee par': 'Determined by',
  'Age courant': 'Current age',
  'Encore fraiche pendant': 'Still fresh for',
  'Perimee depuis': 'Stale for',
  'Age annonce par l entete Age': 'Age declared by the Age header',
  'Age apparent (Date de la reponse)': 'Apparent age (response Date)',
  'Delai de reponse mesure': 'Measured response delay',
  'Temps de residence en cache': 'Time resident in cache',
  'Validateurs': 'Validators',
  'Vary': 'Vary',
  'Directives Cache-Control': 'Cache-Control directives',
  'non stockable': 'not storable',
  'max-age': 'max-age',
  's-maxage': 's-maxage',
  'Expires moins Date': 'Expires minus Date',
  'Expires (sans Date)': 'Expires (no Date)',
  'Expires invalide, donc deja perime': 'invalid Expires, therefore already stale',
  'heuristique : 10 % de l ecart Date / Last-Modified':
    'heuristic: 10% of the Date / Last-Modified gap',

  /* ------------------------ Politique de securite (CSP) ------------------- */
  'Politique de securite du contenu (CSP)': 'Content Security Policy (CSP)',
  'Politique CSP en observation': 'CSP policy in report-only mode',
  'Politique en observation : rien n est bloque, les violations sont seulement signalees.':
    'Report-only policy: nothing is blocked, violations are only reported.',
  'directive(s)': 'directive(s)',
  '(aucune source)': '(no source)',

  /* Constats produits par l analyseur de politique (ui/lib/csp.js). Ce sont
     des gabarits : {d} est la directive concernee, {s} une source, {n} un nom. */
  'politique vide : rien n est restreint': 'empty policy: nothing is restricted',
  'default-src absent : toute directive de recuperation non definie est sans restriction':
    'default-src absent: every undefined fetch directive is unrestricted',
  'ni script-src ni default-src : les scripts peuvent venir de n importe ou':
    'neither script-src nor default-src: scripts may come from anywhere',
  "{d} autorise 'unsafe-inline' : tout script inline injecte s executera":
    "{d} allows 'unsafe-inline': any injected inline script will run",
  "{d} porte 'unsafe-inline' mais aussi un nonce ou un hash : les navigateurs recents ignorent alors unsafe-inline":
    "{d} carries 'unsafe-inline' alongside a nonce or hash: recent browsers then ignore unsafe-inline",
  "{d} autorise 'unsafe-eval' : eval() et new Function() sont permis":
    "{d} allows 'unsafe-eval': eval() and new Function() are permitted",
  '{d} contient * : des scripts de toute origine sont acceptes':
    '{d} contains *: scripts from any origin are accepted',
  '{d} accepte le schema {s} entier : toute URL {s} peut fournir un script':
    '{d} accepts the whole {s} scheme: any {s} URL can supply a script',
  "'strict-dynamic' present : les listes d hotes et 'self' sont ignorees pour les scripts ; seuls nonce/hash comptent":
    "'strict-dynamic' present: host lists and 'self' are ignored for scripts; only nonces and hashes count",
  "{d} melange 'none' avec d autres sources : 'none' doit etre seul":
    "{d} mixes 'none' with other sources: 'none' must stand alone",
  '{d} accepte des jokers de sous-domaine : {h}':
    '{d} accepts subdomain wildcards: {h}',
  'object-src absent (et pas de default-src) : les greffons <object>/<embed> ne sont pas restreints':
    'object-src absent (and no default-src): <object>/<embed> plugins are unrestricted',
  'object-src autorise des greffons : {s}': 'object-src allows plugins: {s}',
  'base-uri absent : une balise <base> injectee peut rediriger toutes les URL relatives':
    'base-uri absent: an injected <base> tag can redirect every relative URL',
  'frame-ancestors absent : cette politique ne dit pas qui peut encadrer la page (voir X-Frame-Options)':
    'frame-ancestors absent: this policy does not say who may frame the page (see X-Frame-Options)',
  'form-action absent : un formulaire peut etre envoye vers n importe quelle origine':
    'form-action absent: a form can be submitted to any origin',
  'les styles en ligne sont autorises (style-src ou default-src)':
    'inline styles are allowed (style-src or default-src)',
  'connect-src contient * : fetch/XHR/WebSocket vers toute origine':
    'connect-src contains *: fetch/XHR/WebSocket to any origin',
  'directive inconnue ignoree par les navigateurs : {n}':
    'unknown directive, ignored by browsers: {n}',
  'directive depreciee ou retiree : {n} ({s})': 'deprecated or removed directive: {n} ({s})',
  'directive en double, seule la premiere compte : {n}':
    'duplicate directive, only the first one counts: {n}',
  'report-uri seul : deprecie, mais encore lu ; report-to est la forme actuelle':
    'report-uri alone: deprecated but still honoured; report-to is the current form',
  'aucune permission large detectee dans cette politique':
    'no broad permission detected in this policy',

  /* --------------------- Corps multipart (RFC 7578) ----------------------- */
  'Parties du formulaire': 'Form parts',
  'Frontiere': 'Boundary',
  'Marqueur de fin present': 'Closing marker present',
  '(champ sans nom)': '(unnamed field)',
  'Nom du champ': 'Field name',
  'Nom de fichier': 'File name',
  'Encodage de transfert': 'Transfer encoding',
  'fichier': 'file',
  'Decoder, hacher ou mesurer cette partie': 'Decode, hash or measure this part',
  'Partie copiee': 'Part copied',

  /* ------------------------ Trames WebSocket et HTTP/2 -------------------- */
  'Trames WebSocket et HTTP/2': 'WebSocket and HTTP/2 frames',
  'Trames WebSocket': 'WebSocket frames',
  'Trames HTTP/2': 'HTTP/2 frames',
  'trame(s) lue(s)': 'frame(s) read',
  'Opcode': 'Opcode',
  'Trame finale (FIN)': 'Final frame (FIN)',
  'Bits reserves RSV1 / RSV2 / RSV3': 'Reserved bits RSV1 / RSV2 / RSV3',
  'Masquee': 'Masked',
  'Cle de masquage': 'Masking key',
  'Longueur annoncee': 'Declared length',
  'Taille de l en-tete': 'Header size',
  'Charge utile complete': 'Payload complete',
  'Charge utile (hex)': 'Payload (hex)',
  'Longueur de la charge utile': 'Payload length',
  'Code de fermeture': 'Close code',
  'Raison': 'Reason',
  'Drapeaux': 'Flags',
  'Identifiant de flux': 'Stream identifier',
  'Bit reserve': 'Reserved bit',
  'doit etre a zero': 'must be zero',
  'Poser la charge utile comme texte de travail': 'Load the payload as working text',
  'Preface de connexion HTTP/2 reconnue en tete des octets.':
    'HTTP/2 connection preface recognised at the start of the bytes.',
  'Ces octets ne se lisent ni comme des trames WebSocket ni comme des trames HTTP/2.':
    'These bytes read neither as WebSocket frames nor as HTTP/2 frames.',
  'octet(s) en fin de tampon : plus court qu un en-tete de trame.':
    'byte(s) left at the end of the buffer: shorter than a frame header.',
  'octets': 'bytes',
  'flux': 'stream',
  'fragment': 'fragment',
  '7 bits': '7 bits',
  '16 bits': '16 bits',
  '64 bits': '64 bits',

  /* --------------------------- HPACK (RFC 7541) --------------------------- */
  'En-tetes decodes (HPACK)': 'Decoded headers (HPACK)',
  'en-tete(s)': 'header(s)',
  'Table dynamique': 'Dynamic table',
  'Bloc HPACK illisible : ': 'Unreadable HPACK block: ',
  'END_HEADERS absent : le bloc se poursuit dans une trame CONTINUATION.':
    'END_HEADERS absent: the block continues in a CONTINUATION frame.',
  /* Formes de representation, affichees au survol de chaque en-tete. */
  'indexe': 'indexed',
  'litteral indexe': 'literal, indexed',
  'litteral sans indexation': 'literal, not indexed',
  'litteral jamais indexe': 'literal, never indexed',
  'taille de table': 'table size update',

  /* Remarques produites par le decodeur (ui/lib/trames.js). */
  'bit RSV a 1 : reserve a une extension negociee (permessage-deflate par exemple)':
    'RSV bit set: reserved for a negotiated extension (permessage-deflate for instance)',
  'une trame de controle ne doit pas etre fragmentee (FIN=0)':
    'a control frame must not be fragmented (FIN=0)',
  'une trame de controle ne peut pas depasser 125 octets':
    'a control frame cannot exceed 125 bytes',
  'non masquee : envoyee par le serveur (le client doit toujours masquer)':
    'unmasked: sent by the server (a client must always mask)',
  'masquee : envoyee par le client': 'masked: sent by the client',
  'charge utile incomplete dans les octets fournis':
    'payload incomplete in the bytes provided',

  /* ------------------------- URL et adresses ------------------------------ */
  'Forme canonique (RFC 3986)': 'Canonical form (RFC 3986)',
  'Cette URL n etait pas sous forme canonique : ': 'This URL was not in canonical form: ',
  'schema en minuscules': 'scheme lowercased',
  'hote en minuscules': 'host lowercased',
  'port par defaut retire': 'default port removed',
  'segments . et .. resolus': 'dot segments resolved',
  'chemin vide remplace par /': 'empty path replaced with /',
  'pourcent-encodages du chemin normalises': 'percent-encodings in the path normalised',
  'pourcent-encodages de la requete normalises': 'percent-encodings in the query normalised',
  'parametres tries': 'parameters sorted',
  'Nom inverse lu comme l adresse ': 'Reverse name read as address ',
  'Nom inverse illisible : ': 'Unreadable reverse name: ',
  'Placez une adresse ou un prefixe dans le texte de travail : 192.168.1.130/26, 2001:db8::1/64, ou un nom in-addr.arpa.':
    'Put an address or a prefix in the working text: 192.168.1.130/26, 2001:db8::1/64, or an in-addr.arpa name.',
  'une seule ecriture par libelle, aucun caractere sosie':
    'a single script per label, no look-alike character',

  /* -------------------------- Tables de reference ------------------------- */
  'Erreurs HTTP/3': 'HTTP/3 errors',
  'Erreurs HTTP/3 et QPACK': 'HTTP/3 and QPACK errors',
  'Erreurs QUIC': 'QUIC errors',
  'Erreurs de transport QUIC': 'QUIC transport errors',
  'Alertes TLS': 'TLS alerts',
  'Types DNS': 'DNS types',
  'Types d enregistrement DNS': 'DNS record types',
  'Codes de reponse DNS': 'DNS response codes',

  /* ------------------------- Unites et types ------------------------------ */
  /* « o » est l abreviation d octet ; l anglais dit byte. Les multiples suivent
     la meme logique, en gardant le kilo minuscule de l usage. */
  'o': 'B',
  'Ko': 'kB',
  'Mo': 'MB',
  'Go': 'GB',
  'To': 'TB',
  'cadre': 'frame',
  'objet': 'object',
  'police': 'font',
  'speculatif': 'speculative',
  'autre': 'other',

  /* ------------------------------ Synthese -------------------------------- */
  '{n} requetes observees': '{n} requests observed',
  'erreur reseau': 'network error',
  'en cours': 'in flight',

  /* ---------------------------- Boite a outils ---------------------------- */
  '{t} transformations, {f} familles — tout se calcule en local':
    '{t} transformations, {f} families - everything is computed locally',
  '{t} disponibles, {f} familles': '{t} available, {f} families',

  /* ------------------------------ Divers ---------------------------------- */
  'alerte(s)': 'finding(s)',
  'Fenetre': 'Window',
  'Reconnaitre': 'Detect'
};
