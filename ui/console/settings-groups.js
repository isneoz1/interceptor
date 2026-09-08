/* Description des reglages — INTERCEPTOR (by NeoZ)
 *
 * Donnees pures : la liste des groupes affiches par console/settings.js et les
 * profils rapides. Chaque cle citee ici existe dans DEFAULTS (core/config.js)
 * et a un effet reel — la regle du projet est qu aucun reglage ne soit
 * decoratif, dans les deux sens.
 */

/* Un groupe = un titre, une explication, une liste de champs.
   Types : bool, number, select, list (une valeur par ligne), types (grille). */
export const GROUPS = [
  {
    title: 'Interface',
    note: 'Confort de lecture. Ces reglages ne changent rien a la capture.',
    fields: [
      ['lang', 'Langue', 'select', [['fr', 'Francais'], ['en', 'Anglais']],
        'Toute l interface, l aide et le tutoriel changent de langue : {entrees} entrees traduites, et un test refuse la construction s il en manque une.'],
      ['simpleMode', 'Mode simple', 'bool', 'Ne garde que Requetes, Securite, Synthese, Reglages, Tutoriel et Aide. Les vues avancees restent accessibles en le desactivant.'],
      ['theme', 'Theme', 'select', [['sombre', 'Sombre'], ['clair', 'Clair'], ['auto', 'Suivre le systeme']]],
      ['highContrast', 'Contraste renforce', 'bool', 'Eclaircit les textes secondaires et marque davantage les separations.'],
      ['fontScale', 'Taille du texte (%)', 'number', 'Entre 80 et 140. Agit sur toute l interface : tableau, corps, journaux, boutons et aide.'],
      ['fontScaleAuto', 'Adapter en plus a la taille de la fenetre', 'bool', 'Un panneau lateral etroit resserre l affichage, un grand ecran l agrandit — sans jamais devenir minuscule ni enorme. Votre pourcentage reste applique par-dessus.'],
      ['clearOnNavigate', 'Vider un onglet a chaque navigation', 'bool', 'Comme le mode « ne pas conserver le journal » des outils de developpement.'],
      ['density', 'Densite du tableau', 'select', [['confort', 'Confortable'], ['compact', 'Compacte']]],
      ['timeFormat', 'Format de l heure', 'select', [['clock', 'Heure locale'], ['relative', 'Temps ecoule'], ['iso', 'ISO 8601']]],
      ['autoScroll', 'Suivre le flux par defaut', 'bool', 'Le tableau reste colle aux dernieres requetes.'],
      ['defaultScope', 'Perimetre par defaut', 'select', [['tab', 'Onglet actif'], ['all', 'Tout Firefox']]],
      ['wrapBodies', 'Replier les longues lignes des corps', 'bool'],
      ['prettyJson', 'Mettre en forme le JSON automatiquement', 'bool'],
      ['iconOpens', 'Ouvrir la console', 'select', [['popup', 'Fenetre compacte'], ['onglet', 'Onglet complet'], ['panneau', 'Panneau lateral'], ['fenetre', 'Fenetre detachee']], 'Comme l ancrage des outils de developpement de Firefox : choisissez ou la console s ouvre quand vous cliquez sur l icone. Les boutons d ancrage en haut de la console font la meme chose d un clic.'],
      ['consolePosition', 'Position de la fenetre detachee', 'select', [['droite', 'A droite'], ['gauche', 'A gauche'], ['haut', 'En haut'], ['bas', 'En bas'], ['centre', 'Au centre'], ['plein', 'Plein ecran'], ['libre', 'La ou je la laisse']], 'Utilisee uniquement quand la console s ouvre en fenetre detachee. « La ou je la laisse » retient la derniere position.'],
      ['badgeMode', 'Compteur sur l icone', 'select', [['requests', 'Nombre de requetes'], ['alerts', 'Nombre d alertes'], ['none', 'Aucun']]],
      ['notifyCritical', 'Notification bureau sur alerte critique', 'bool', 'Demande la permission « notifications » a l activation.'],
      ['tutorialAuto', 'Proposer le tutoriel a l installation', 'bool', 'Le tutoriel reste accessible a tout moment depuis la barre laterale.']
    ]
  },
  {
    title: 'Couches de capture',
    note: 'Chaque couche observe un plan different du trafic. En desactiver une reduit la couverture.',
    fields: [
      ['captureWebRequest', 'Couche webRequest', 'bool', 'Les 9 evenements du cycle de vie reseau. Prise en compte au prochain demarrage de l extension.'],
      ['capturePageHooks', 'Sondes du contexte page', 'bool', 'fetch, XHR, WebSocket, SSE, sendBeacon, WebRTC.'],
      ['captureWebSocketFrames', 'Trames WebSocket', 'bool', 'Contenu de chaque message, dans les deux sens.'],
      ['captureSse', 'Server-Sent Events', 'bool'],
      ['capturePerformance', 'PerformanceObserver', 'bool', 'Capte meme ce que sert un Service Worker ou le cache memoire.'],
      ['captureStacks', 'Piles d appel JavaScript', 'bool', 'Montre quelle ligne de code declenche chaque requete.'],
      ['captureWebRtc', 'WebRTC', 'bool', 'Pairs, candidats ICE, canaux de donnees.'],
      ['captureWorkers', 'Workers et Service Workers', 'bool'],
      ['captureJsCookies', 'Cookies poses en JavaScript', 'bool', 'Ajoute la pile d appel : on voit quelle ligne de code ecrit le cookie.'],
      ['captureWebTransport', 'WebTransport (HTTP/3)', 'bool', 'Sonde posee seulement si l API existe dans ce Firefox.'],
      ['capturePageVitals', 'Mesures de perception de page', 'bool', 'Premier affichage, plus grand element, decalages de mise en page, taches longues.'],
      ['captureNavigation', 'Navigation', 'bool', 'Transitions de page et de cadres.'],
      ['captureCookies', 'Mutations de cookies', 'bool', 'Inclut les cookies poses en JavaScript.'],
      ['captureSecurityInfo', 'TLS et certificats', 'bool', 'Version, suite, chaine complete.'],
      ['captureDns', 'Resolution DNS', 'bool', 'Nom canonique et adresses, en cache par hote.'],
      ['captureProxy', 'Couche proxy (avance)', 'bool', 'Permission demandee a l activation. Laisser desactive en cas de doute.']
    ]
  },
  {
    title: 'Corps de requete et de reponse',
    note: 'Une limite a 0 signifie illimite. Sans plafond, tout reste en memoire vive : sur une longue session avec des flux volumineux, la consommation peut atteindre plusieurs gigaoctets.',
    fields: [
      ['captureRequestBodies', 'Corps envoyes', 'bool'],
      ['captureResponseBodies', 'Corps recus', 'bool', 'Via StreamFilter, API exclusive a Firefox. Le flux est reecrit a l identique vers la page.'],
      ['captureBinaryBodies', 'Conserver le binaire', 'bool', 'Base64 et apercu hexadecimal.'],
      ['maxRequestBodyBytes', 'Limite par corps envoye (octets)', 'number'],
      ['maxResponseBodyBytes', 'Limite par corps recu (octets)', 'number'],
      ['maxBinaryBodyBytes', 'Limite du binaire conserve (octets)', 'number'],
      ['maxFrameBytes', 'Limite par trame ou message (octets)', 'number'],
      ['maxWebSocketFrames', 'Trames conservees par socket', 'number'],
      ['maxSseMessages', 'Messages SSE conserves par flux', 'number'],
      ['skipBodyTypes', 'Types sans capture de corps', 'types']
    ]
  },
  {
    title: 'Correlation anti-doublon',
    note: 'Trois couches peuvent rapporter la meme requete : webRequest, les sondes de page et PerformanceObserver. La correlation garantit une ligne unique. La desactiver fait apparaitre une ligne par couche.',
    fields: [
      ['dedupEnabled', 'Correlation active', 'bool'],
      ['dedupWindowMs', 'Fenetre de correlation (ms)', 'number', 'Au-dela, une observation orpheline devient sa propre ligne.'],
      ['dedupSweepMs', 'Periode de verification (ms)', 'number']
    ]
  },
  {
    title: 'Stockage',
    note: null,
    fields: [
      ['maxRecords', 'Requetes conservees en memoire', 'number', '0 = illimite'],
      ['persist', 'Persistance sur disque', 'bool', 'IndexedDB local : la capture survit au redemarrage de Firefox.'],
      ['persistMaxRecords', 'Requetes rechargees au demarrage', 'number', '0 = toutes']
    ]
  },
  {
    title: 'Filtres d ingestion',
    note: 'Applique avant tout enregistrement : ce qui est ecarte ici n existe nulle part dans la capture.',
    fields: [
      ['ignoreOwnRequests', 'Ignorer les requetes de l extension', 'bool'],
      ['ignoreTypes', 'Types de ressource ignores', 'types'],
      ['ignoreUrlPatterns', 'Ignorer les URL correspondant a', 'list', 'Expressions regulieres, une par ligne.'],
      ['onlyUrlPatterns', 'Ne capturer que les URL correspondant a', 'list', 'Laisser vide pour tout capturer.']
    ]
  },
  {
    title: 'Analyse automatique',
    note: 'Chaque requete terminee est auditee sans action de votre part. Les valeurs sensibles sont masquees dans les alertes.',
    fields: [
      ['analyzerEnabled', 'Analyse active', 'bool'],
      ['analyzeSecrets', 'Secrets exposes : cles de fournisseur, cle privee, jeton en URL', 'bool'],
      ['analyzeTransport', 'Transport : envoi en clair, certificat, TLS obsolete, suite cassee', 'bool'],
      ['analyzeHeaders', 'CORS exploitable (origine en miroir ou nulle avec credentials)', 'bool'],
      ['analyzeCookies', 'Cookies : pose en clair, prefixe ou SameSite non respecte', 'bool'],
      ['analyzeTrackers', 'Marquer les pisteurs (etiquette, jamais une alerte)', 'bool'],
      ['maskSecrets', 'Masquer les valeurs sensibles', 'bool', 'Desactive, les alertes montrent la valeur complete.'],
      ['extraTrackers', 'Domaines de pistage supplementaires', 'list', 'Un domaine par ligne.'],
      ['extraSecretPatterns', 'Motifs de secret personnels', 'list', 'Une ligne par motif :  Nom = expression reguliere = severite (critical, high, medium, low).']
    ]
  },
  {
    title: 'Journal interne',
    note: 'Le journal observe INTERCEPTOR lui-meme, pas le trafic : erreurs du noyau, commandes et leur duree. Il vit en memoire et ne sort jamais du navigateur.',
    fields: [
      ['debugEnabled', 'Journal de diagnostic', 'bool', 'Alimente la vue « Journal interne ». Desactive, plus rien n est enregistre.'],
      ['debugCaptureErrors', 'Enregistrer les erreurs internes', 'bool', 'Erreurs, avertissements et promesses rejetees du noyau, avec leur pile d appel.'],
      ['debugCaptureRpc', 'Tracer les commandes', 'bool', 'Chaque commande de l interface, sa duree et son echec eventuel.'],
      ['debugCaptureEvents', 'Tracer les evenements internes', 'bool', 'Flot detaille du noyau. Volumineux : a n activer que pour chercher une panne.'],
      ['debugMaxEntries', 'Entrees conservees dans le journal', 'number', '0 = illimite. Au-dela, les plus anciennes sont ecartees.']
    ]
  },
  {
    title: 'Interception active',
    note: 'Les deux seuls reglages capables de modifier ou d emettre du trafic. Desactives par defaut.',
    fields: [
      ['rulesEnabled', 'Moteur de regles', 'bool', 'Les regles se construisent dans la vue Regles.'],
      ['replayEnabled', 'Autoriser le rejeu de requete', 'bool', 'Ajoute l onglet Rejouer dans le detail : envoie une vraie requete apres confirmation.']
    ]
  },
  {
    title: 'Interception en direct',
    note: 'Suspend reellement le trafic pour le modifier avant son depart. Ne fonctionne que console ouverte : sans interface pour trancher, aucune requete n est retenue. Une echeance relache toujours la requete, et fermer la console relache tout.',
    fields: [
      ['interceptEnabled', 'Interception active', 'bool', 'Se pilote aussi depuis la vue Interception.'],
      ['interceptRequests', 'Suspendre les requetes sortantes', 'bool', 'Avant l emission : URL et entetes modifiables.'],
      ['interceptResponses', 'Suspendre les reponses entrantes', 'bool', 'A la reception des entetes : entetes de reponse modifiables.'],
      ['interceptFilter', 'Filtre des requetes a suspendre', 'text', 'Expression reguliere. Vide = toutes les requetes, ce qui est vite ingerable.'],
      ['interceptTimeoutMs', 'Echeance de securite (ms)', 'number', 'Passe ce delai, la requete repart seule. Ne peut jamais etre illimitee.']
    ]
  }
];

export const PROFILES = [
  ['Maximum', 'Tout capturer, aucune limite.', {
    capturing: true, captureWebRequest: true, capturePageHooks: true, captureWebSocketFrames: true,
    captureSse: true, capturePerformance: true, captureStacks: true, captureWebRtc: true,
    captureWorkers: true, captureNavigation: true, captureCookies: true, captureSecurityInfo: true,
    captureDns: true, captureRequestBodies: true, captureResponseBodies: true, captureBinaryBodies: true,
    maxRequestBodyBytes: 0, maxResponseBodyBytes: 0, maxBinaryBodyBytes: 0, maxFrameBytes: 0,
    maxWebSocketFrames: 0, maxSseMessages: 0, maxRecords: 0, skipBodyTypes: [], ignoreTypes: [],
    analyzerEnabled: true
  }],
  ['Equilibre', 'Tout observer, mais plafonner la memoire.', {
    captureRequestBodies: true, captureResponseBodies: true, captureBinaryBodies: false,
    maxRequestBodyBytes: 262144, maxResponseBodyBytes: 1048576, maxBinaryBodyBytes: 0,
    maxFrameBytes: 16384, maxWebSocketFrames: 500, maxSseMessages: 500, maxRecords: 20000,
    skipBodyTypes: ['image', 'media', 'font'], ignoreTypes: []
  }],
  ['Leger', 'Sessions tres longues, machine modeste.', {
    captureResponseBodies: false, captureRequestBodies: true, captureBinaryBodies: false,
    capturePerformance: true, captureStacks: false, maxRecords: 5000,
    maxWebSocketFrames: 100, maxSseMessages: 100, maxFrameBytes: 4096,
    skipBodyTypes: ['image', 'media', 'font', 'stylesheet', 'script'], ignoreTypes: []
  }],
  ['Observation discrete', 'Metadonnees seules, aucun contenu conserve.', {
    captureRequestBodies: false, captureResponseBodies: false, captureBinaryBodies: false,
    captureWebSocketFrames: false, captureSse: true, captureStacks: false, captureWebRtc: false,
    maxRecords: 10000, skipBodyTypes: [], ignoreTypes: []
  }]
];
