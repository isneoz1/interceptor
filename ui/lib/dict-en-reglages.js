/* Dictionnaire anglais — page des reglages — INTERCEPTOR (by NeoZ)
 *
 * Les titres et libelles courts vivent dans dict-en.js. Ici se trouvent les
 * phrases : notes de section, aides de champ, descriptions de profil. Ce sont
 * elles qui expliquent ce qu un reglage fait reellement, et elles restaient en
 * francais quand l interface passait en anglais.
 *
 * Meme regle que partout : la cle est le texte francais tel qu il apparait
 * dans le code, et une entree absente laisse le francais s afficher.
 */
export const EN_REGLAGES = {
  /* ---------------------------- Profils rapides --------------------------- */
  'Tout capturer, aucune limite.': 'Capture everything, no limits.',
  'Tout observer, mais plafonner la memoire.': 'Observe everything, but cap memory use.',
  'Sessions tres longues, machine modeste.': 'Very long sessions, modest machine.',
  'Metadonnees seules, aucun contenu conserve.': 'Metadata only, no content kept.',

  /* --------------------------- Notes de section --------------------------- */
  'Confort de lecture. Ces reglages ne changent rien a la capture.':
    'Reading comfort. These settings change nothing about the capture.',
  'Chaque couche observe un plan different du trafic. En desactiver une reduit la couverture.':
    'Each layer observes a different plane of the traffic. Turning one off reduces coverage.',
  'Une limite a 0 signifie illimite. Sans plafond, tout reste en memoire vive : sur une longue session avec des flux volumineux, la consommation peut atteindre plusieurs gigaoctets.':
    'A limit of 0 means unlimited. With no cap everything stays in RAM: over a long session with large streams, usage can reach several gigabytes.',
  'Applique avant tout enregistrement : ce qui est ecarte ici n existe nulle part dans la capture.':
    'Applied before anything is recorded: what is excluded here exists nowhere in the capture.',
  'Chaque requete terminee est auditee sans action de votre part. Les valeurs sensibles sont masquees dans les alertes.':
    'Every finished request is audited without any action from you. Sensitive values are masked in the alerts.',
  'Le journal observe INTERCEPTOR lui-meme, pas le trafic : erreurs du noyau, commandes et leur duree. Il vit en memoire et ne sort jamais du navigateur.':
    'The log observes INTERCEPTOR itself, not the traffic: kernel errors, commands and how long they took. It lives in memory and never leaves the browser.',
  'Les deux seuls reglages capables de modifier ou d emettre du trafic. Desactives par defaut.':
    'The only two settings able to modify or emit traffic. Off by default.',
  'Suspend reellement le trafic pour le modifier avant son depart. Ne fonctionne que console ouverte : sans interface pour trancher, aucune requete n est retenue. Une echeance relache toujours la requete, et fermer la console relache tout.':
    'Genuinely suspends traffic so you can modify it before it leaves. Works only with the console open: with no interface to decide, no request is held. A deadline always releases the request, and closing the console releases everything.',
  'Trois couches peuvent rapporter la meme requete : webRequest, les sondes de page et PerformanceObserver. La correlation garantit une ligne unique. La desactiver fait apparaitre une ligne par couche.':
    'Three layers can report the same request: webRequest, the page probes and PerformanceObserver. Correlation guarantees a single row. Turning it off makes one row appear per layer.',

  /* Gabarit a trou : tp() traduit d abord, puis remplace {entrees}. Une aide
     qui cite un nombre calcule doit passer par la, sinon la concatenation la
     rend intraduisible. */
  'Toute l interface, l aide et le tutoriel changent de langue : {entrees} entrees traduites, et un test refuse la construction s il en manque une.':
    'The whole interface, the help and the tutorial change language: {entrees} translated entries, and a test refuses the build if one is missing.',
  'Profil « {nom} » applique': 'Profile "{nom}" applied',

  /* ------------------------------- Interface ------------------------------ */
  'Ne garde que Requetes, Securite, Synthese, Reglages, Tutoriel et Aide. Les vues avancees restent accessibles en le desactivant.':
    'Keeps only Requests, Security, Summary, Settings, Tutorial and Help. The advanced views come back as soon as you turn it off.',
  'Eclaircit les textes secondaires et marque davantage les separations.':
    'Lightens secondary text and strengthens the separations.',
  'Comme le mode « ne pas conserver le journal » des outils de developpement.':
    'Like the "do not preserve log" mode in developer tools.',
  'Le tableau reste colle aux dernieres requetes.':
    'The table stays pinned to the most recent requests.',
  'Demande la permission « notifications » a l activation.':
    'Asks for the "notifications" permission when enabled.',
  'Le tutoriel reste accessible a tout moment depuis la barre laterale.':
    'The tutorial stays available at any time from the sidebar.',

  /* --------------------------- Couches de capture ------------------------- */
  'Les 9 evenements du cycle de vie reseau. Prise en compte au prochain demarrage de l extension.':
    'The 9 events of the network life cycle. Applied the next time the extension starts.',
  'fetch, XHR, WebSocket, SSE, sendBeacon, WebRTC.': 'fetch, XHR, WebSocket, SSE, sendBeacon, WebRTC.',
  'Contenu de chaque message, dans les deux sens.': 'The content of every message, in both directions.',
  'Capte meme ce que sert un Service Worker ou le cache memoire.':
    'Catches even what a Service Worker or the memory cache serves.',
  'Montre quelle ligne de code declenche chaque requete.':
    'Shows which line of code triggers each request.',
  'Pairs, candidats ICE, canaux de donnees.': 'Peers, ICE candidates, data channels.',
  'Ajoute la pile d appel : on voit quelle ligne de code ecrit le cookie.':
    'Adds the call stack: you see which line of code writes the cookie.',
  'Sonde posee seulement si l API existe dans ce Firefox.':
    'Probe installed only if the API exists in this Firefox.',
  'Premier affichage, plus grand element, decalages de mise en page, taches longues.':
    'First paint, largest element, layout shifts, long tasks.',
  'Transitions de page et de cadres.': 'Page and frame transitions.',
  'Inclut les cookies poses en JavaScript.': 'Includes cookies set from JavaScript.',
  'Version, suite, chaine complete.': 'Version, cipher suite, full chain.',
  'Nom canonique et adresses, en cache par hote.': 'Canonical name and addresses, cached per host.',
  'Permission demandee a l activation. Laisser desactive en cas de doute.':
    'Permission requested when enabled. Leave it off if in doubt.',

  /* ---------------------------------- Corps ------------------------------- */
  'Via StreamFilter, API exclusive a Firefox. Le flux est reecrit a l identique vers la page.':
    'Through StreamFilter, a Firefox-only API. The stream is rewritten byte for byte to the page.',
  'Base64 et apercu hexadecimal.': 'Base64 and a hexadecimal preview.',

  /* ------------------------------ Correlation ----------------------------- */
  'Au-dela, une observation orpheline devient sa propre ligne.':
    'Past that, an orphan observation becomes its own row.',

  /* ------------------------------- Stockage ------------------------------- */
  '0 = illimite': '0 = unlimited',
  'IndexedDB local : la capture survit au redemarrage de Firefox.':
    'Local IndexedDB: the capture survives a Firefox restart.',
  '0 = toutes': '0 = all of them',

  /* -------------------------------- Filtres ------------------------------- */
  'Expressions regulieres, une par ligne.': 'Regular expressions, one per line.',
  'Laisser vide pour tout capturer.': 'Leave empty to capture everything.',

  /* -------------------------------- Analyse ------------------------------- */
  'Desactive, les alertes montrent la valeur complete.':
    'Turned off, the alerts show the full value.',
  'Un domaine par ligne.': 'One domain per line.',
  'Une ligne par motif :  Nom = expression reguliere = severite (critical, high, medium, low).':
    'One line per pattern:  Name = regular expression = severity (critical, high, medium, low).',

  /* --------------------------- Journal interne ---------------------------- */
  'Journal de diagnostic': 'Diagnostic log',
  'Alimente la vue « Journal interne ». Desactive, plus rien n est enregistre.':
    'Feeds the "Internal log" view. Turned off, nothing is recorded any more.',
  'Enregistrer les erreurs internes': 'Record internal errors',
  'Erreurs, avertissements et promesses rejetees du noyau, avec leur pile d appel.':
    'Kernel errors, warnings and rejected promises, with their call stack.',
  'Tracer les commandes': 'Trace commands',
  'Chaque commande de l interface, sa duree et son echec eventuel.':
    'Every interface command, how long it took and whether it failed.',
  'Tracer les evenements internes': 'Trace internal events',
  'Flot detaille du noyau. Volumineux : a n activer que pour chercher une panne.':
    'The kernel in full detail. Voluminous: turn it on only to chase a fault.',
  'Entrees conservees dans le journal': 'Entries kept in the log',
  '0 = illimite. Au-dela, les plus anciennes sont ecartees.':
    '0 = unlimited. Past that, the oldest are dropped.',

  /* ------------------------------ Interception ---------------------------- */
  'Les regles se construisent dans la vue Regles.': 'Rules are built in the Rules view.',
  'Ajoute l onglet Rejouer dans le detail : envoie une vraie requete apres confirmation.':
    'Adds the Replay tab to the detail panel: sends a real request after confirmation.',
  'Se pilote aussi depuis la vue Interception.': 'Also driven from the Interception view.',
  'Suspendre les requetes sortantes': 'Hold outgoing requests',
  'Avant l emission : URL et entetes modifiables.': 'Before sending: URL and headers can be edited.',
  'Suspendre les reponses entrantes': 'Hold incoming responses',
  'A la reception des entetes : entetes de reponse modifiables.':
    'When the headers arrive: response headers can be edited.',
  'Filtre des requetes a suspendre': 'Filter for requests to hold',
  'Expression reguliere. Vide = toutes les requetes, ce qui est vite ingerable.':
    'A regular expression. Empty = every request, which quickly becomes unmanageable.',
  'Passe ce delai, la requete repart seule. Ne peut jamais etre illimitee.':
    'Past this delay the request leaves on its own. It can never be unlimited.'
};
