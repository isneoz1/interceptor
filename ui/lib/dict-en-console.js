/* Dictionnaire anglais — reste de la console — INTERCEPTOR (by NeoZ)
 *
 * Les libelles du tableau, du detail, des flux, des menus et de la fenetre
 * compacte. Avec ce fichier, le bouton FR / EN bascule vraiment toute
 * l interface : il ne reste plus une seule etiquette francaise en anglais.
 *
 * Ne sont pas traduits, volontairement : la syntaxe de filtre (`status:>=400`),
 * les noms propres, et les symboles.
 */
export const EN_CONSOLE = {
  /* ------------------------------- Requetes ------------------------------- */
  'Trier par': 'Sort by',
  'cliquer pour trier': 'click to sort',
  'Aucune ligne ne correspond au filtre. Videz la recherche ou changez de perimetre.':
    'No row matches the filter. Clear the search or change the scope.',
  'Naviguez sur un site : les requetes apparaissent ici en direct.':
    'Browse a site: requests appear here live.',
  'Filtrer :  method:POST   status:5xx   host:api.   size:>100000   -image   /regex/':
    'Filter:  method:POST   status:5xx   host:api.   size:>100000   -image   /regex/',

  /* ---------------------------- Menu de ligne ----------------------------- */
  'Ouvrir le detail': 'Open the detail',
  'Copier l URL': 'Copy the URL',
  'Copier en cURL': 'Copy as cURL',
  'Copier la ligne en JSON': 'Copy the row as JSON',
  'Analyser l URL dans la boite a outils': 'Analyse the URL in the toolbox',
  'Analyser les entetes dans la boite a outils': 'Analyse the headers in the toolbox',
  'Aucun entete capture sur cette ligne': 'No header captured on this row',
  'Filtrer sur cet hote': 'Filter on this host',
  'Filtrer sur ce type': 'Filter on this type',
  'Filtrer sur ce statut': 'Filter on this status',
  'Masquer cet hote': 'Hide this host',
  'Ajouter a la selection': 'Add to the selection',
  'Ouvrir l URL dans un onglet': 'Open the URL in a tab',
  'Bloquer cet hote (regle active)': 'Block this host (live rule)',
  'Supprimer cette ligne': 'Delete this row',
  'Aucune couleur': 'No colour',
  'Rouge': 'Red',
  'Orange': 'Orange',
  'Jaune': 'Yellow',
  'Vert': 'Green',
  'Bleu': 'Blue',
  'Violet': 'Purple',

  /* -------------------------------- En-tete ------------------------------- */
  'HAR 1.2 (DevTools, Charles…)': 'HAR 1.2 (DevTools, Charles…)',
  'Collection Postman v2.1': 'Postman collection v2.1',
  'Ouvrir le tutoriel': 'Open the tutorial',
  'Test de couverture': 'Coverage test',
  'Fenetres': 'Windows',
  'Ouvrir dans un onglet': 'Open in a tab',
  'Ouvrir le panneau lateral': 'Open the sidebar panel',
  'Maintenance': 'Maintenance',
  'Voir les raccourcis clavier': 'Show the keyboard shortcuts',
  'Rafraichir la liste des onglets': 'Refresh the tab list',
  'Purger le stockage sur disque': 'Purge the on-disk storage',
  'Redemarrer l extension': 'Restart the extension',

  /* --------------------------- Fenetre compacte --------------------------- */
  'Filtre': 'Filter',
  'Effacer le filtre': 'Clear the filter',
  'Tout': 'All',
  'Cet onglet': 'This tab',
  'Filtrer…  method:POST  status:5xx': 'Filter…  method:POST  status:5xx',
  'Requetes filtrees': 'Filtered requests',
  'HAR 1.2': 'HAR 1.2',
  'Rapport d alertes': 'Alert report',
  'Script cURL': 'cURL script',
  'Liste d URL': 'URL list',
  'Ouvrir la boite a outils': 'Open the toolbox',
  'Ouvrir les reglages': 'Open the settings',
  'Ouvrir l aide': 'Open the help',

  /* ------------------------------- Detail --------------------------------- */
  'URL finale': 'Final URL',
  'Erreur': 'Error',
  'Sens de l erreur': 'Meaning of the error',
  'Type MIME': 'MIME type',
  'Debut': 'Start',
  'Fin': 'End',
  'requestId Firefox': 'Firefox requestId',
  'Epinglee': 'Pinned',
  'Annotation': 'Note',
  'Marquage couleur': 'Colour mark',
  'Protocole reel': 'Real protocol',
  'Protocole': 'Protocol',
  'Protocoles': 'Protocols',
  'Depuis le cache': 'From the cache',
  'Nom canonique': 'Canonical name',
  'Adresses resolues': 'Resolved addresses',
  'Emis sur le fil': 'Sent on the wire',
  'Recu sur le fil': 'Received on the wire',
  'Encode': 'Encoded',
  'Decode': 'Decoded',
  'Type d initiateur': 'Initiator type',
  'Blocage du rendu': 'Render blocking',
  'Mode de livraison': 'Delivery mode',
  'Document': 'Document',
  'Tierce partie': 'Third party',
  'Classement de pistage Firefox': 'Firefox tracking classification',
  'Cadres parents': 'Parent frames',
  'Origine de la ligne': 'Origin of the row',
  'Navigation privee': 'Private browsing',
  'Conteneur': 'Container',
  'Signature de correlation': 'Correlation signature',
  'Nature': 'Nature',
  'Source': 'Source',
  'Type declare': 'Declared type',
  'Encodage': 'Encoding',
  'Octets conserves': 'Bytes kept',
  'Fichier joint': 'Attached file',
  'Remarque': 'Remark',
  'tout ce que le noyau conserve': 'everything the core keeps',
  'Transport': 'Transport',
  'Ce que vaut cette suite': 'What this cipher suite is worth',
  'Cette suite est cassee : le chiffrement negocie ne protege plus rien.':
    'This cipher suite is broken: the negotiated encryption no longer protects anything.',
  '  valeur': '  value',
  '  expiration': '  expiry',
  'Analysee le': 'Analysed on',
  'Ouverte': 'Opened',
  'Fermee': 'Closed',
  'Octets envoyes': 'Bytes sent',
  'Octets recus': 'Bytes received',
  'Avec credentials': 'With credentials',

  /* --------------------------------- Flux --------------------------------- */
  'Flux #': 'Stream #',
  'Rafraichir': 'Refresh',
  'Ouvrir la requete': 'Open the request',
  'Copier les messages affiches': 'Copy the displayed messages',
  'Volume': 'Volume',
  'Fermeture': 'Closure',
  'Sens du code': 'Meaning of the code',

  /* ----------------------------- Autres vues ------------------------------ */
  'analyse automatique de chaque requete': 'automatic analysis of every request',
  'Reprendre la selection': 'Take the selection',
  'Echanger': 'Swap',
  'Ouvrir la gauche': 'Open the left one',
  'Ouvrir la droite': 'Open the right one',
  'Copier la comparaison': 'Copy the comparison',
  'Difference de duree': 'Duration difference',
  'Difference de taille': 'Size difference',
  'Meme URL': 'Same URL',
  'Meme statut': 'Same status',
  'Activez « Journal interne » dans Reglages -> Journal interne pour enregistrer les erreurs et les commandes du noyau.':
    'Turn on « Internal log » in Settings -> Internal log to record the errors and commands of the core.',
  'INTERCEPTOR observe par lui-meme': 'INTERCEPTOR observed by itself',
  'ce qui doit s arreter': 'what must stop',
  'Vider ce journal': 'Clear this log',
  'un entete par ligne, format « Nom: valeur »': 'one header per line, « Name: value » format',
  'Taille recue': 'Size received',
  'Entetes refuses par le navigateur': 'Headers refused by the browser',
  'le corps reel du serveur reste enregistre': 'the real server body is still recorded',
  'Latence injectee': 'Injected latency',
  'plafonnee a 30 000 ms': 'capped at 30,000 ms',
  'Chercher-remplacer': 'Search and replace',
  'Regles au format JSON': 'Rules in JSON',
  'tableau': 'array',
  'Ajouter une operation': 'Add an operation',
  'un clic, plusieurs reglages': 'one click, several settings',
  'ce qui existe sur les sites visites': 'what exists on the visited sites',
  'reglage · API': 'setting · API',
  'Voir les alertes': 'See the alerts',
  'Voir le diagnostic': 'See the diagnostics',

  /* ---------------------------- Regles toutes faites ---------------------- */
  'Bloquer la telemetrie courante': 'Block common telemetry',
  'Bloquer les images d un domaine': 'Block the images of a domain',
  'Rediriger un domaine vers un autre': 'Redirect one domain to another',
  'Imposer un User-Agent': 'Force a User-Agent',
  'Forcer le HTTPS sur un domaine': 'Force HTTPS on a domain',
  'Simuler une reponse JSON': 'Mock a JSON response',
  'Retirer une entete de reponse': 'Strip a response header',

  /* ------------------------------- Colonnes ------------------------------- */
  'N°': 'No.',
  'Note': 'Note',
  'Sans trace reseau': 'No network trace',

  /* ----------------------------- Affichage --------------------------------- */
  'Taille du texte (%)': 'Text size (%)',
  'Entre 80 et 140. Agit sur toute l interface : tableau, corps, journaux, boutons et aide.':
    'Between 80 and 140. Applies to the whole interface: table, bodies, logs, buttons and help.',
  'Adapter en plus a la taille de la fenetre': 'Also adapt to the window size',
  'Un panneau lateral etroit resserre l affichage, un grand ecran l agrandit — sans jamais devenir minuscule ni enorme. Votre pourcentage reste applique par-dessus.':
    'A narrow sidebar tightens the display, a large screen enlarges it — never becoming tiny or huge. Your percentage still applies on top.',

  /* ------------------------------ Analyse ---------------------------------- */
  'Analyse automatique : uniquement des failles demontrables':
    'Automatic analysis: only demonstrable flaws',
  'Secrets exposes : cles de fournisseur, cle privee, jeton en URL':
    'Exposed secrets: vendor keys, private key, token in a URL',
  'Transport : envoi en clair, certificat, TLS obsolete, suite cassee':
    'Transport: cleartext sending, certificate, obsolete TLS, broken suite',
  'CORS exploitable (origine en miroir ou nulle avec credentials)':
    'Exploitable CORS (mirrored or null origin with credentials)',
  'Cookies : pose en clair, prefixe ou SameSite non respecte':
    'Cookies: set in the clear, prefix or SameSite not respected',
  'Marquer les pisteurs (etiquette, jamais une alerte)':
    'Tag known trackers (a label, never an alert)',

  /* ------------------------------- Tutoriel ------------------------------- */
  '◀ Precedente': '◀ Previous',
  'Suivante ▶': 'Next ▶',
  'Tout marquer comme lu': 'Mark everything as read',
  'Recommencer a zero': 'Start over',
  'Aide de reference': 'Reference help'
};
