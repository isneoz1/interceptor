/* Dictionnaire anglais — guide et prise en main — SWIFT (by D4RK)
 *
 * La visite guidee, le guide rapide de l aide, les recherches toutes faites
 * du bouton « ? », le tableau vide qui dit quoi faire, la confirmation de
 * « Vider », l onglet suivi par le perimetre et la fabrication d un jeton
 * signe. Une cle par ligne, definie une seule fois dans tout le dictionnaire.
 */
export const EN_GUIDE = {
  /* ------------------------------ La visite ------------------------------ */
  'Bienvenue dans SWIFT': 'Welcome to SWIFT',
  'Deux minutes pour savoir ou se trouve chaque chose. Avancez avec « Suivante » ou les fleches du clavier ; Echap quitte la visite a tout moment.': 'Two minutes to learn where everything is. Move on with “Next” or the arrow keys; Esc leaves the tour at any time.',
  'La capture': 'Capture',
  'SWIFT enregistre le trafic de Firefox des son demarrage, sans rien a regler. Ce bouton met la capture en pause et la relance — touche P.': 'SWIFT records Firefox’s traffic from the moment it starts, with nothing to set up. This button pauses capture and resumes it — key P.',
  'La recherche': 'Search',
  'Du texte libre, ou des criteres precis : status:>=400, method:POST, host:api. Le bouton « ? » juste a cote propose des recherches toutes faites — touche / pour venir ici.': 'Free text, or precise criteria: status:>=400, method:POST, host:api. The “?” button right next to it offers ready-made searches — press / to come here.',
  'Les filtres d un clic': 'One-click filters',
  'Ces puces filtrent le tableau en un clic : API, erreurs, alertes, tiers, requetes lentes… Le chiffre de chacune dit combien de lignes elle garde.': 'These chips filter the table in one click: API, errors, alerts, third parties, slow requests… The number on each says how many rows it keeps.',
  'Le tableau des requetes': 'The request table',
  'Une ligne par requete reelle, jamais de doublon. Un clic ouvre tout ce qui a ete capture dans le panneau du bas ; un clic droit copie, filtre, bloque ou envoie a la boite a outils.': 'One row per real request, never a duplicate. A click opens everything captured in the bottom panel; a right-click copies, filters, blocks or sends to the toolbox.',
  'Le perimetre': 'The scope',
  '« Onglet actif » suit l onglet ou vous naviguez ; « Tout Firefox » montre tout ce qui a ete capture, tous onglets confondus.': '“Active tab” follows the tab you are browsing; “All of Firefox” shows everything captured, across all tabs.',
  'Les vues': 'The views',
  'Cette colonne ouvre les autres vues : Securite, Synthese, Flux temps reel, Boite a outils, Regles… Chacune suit le trafic en direct, sans bouton a presser. Survolez une vue pour savoir ce qu elle montre ; les touches 1 a 9 y menent aussi.': 'This column opens the other views: Security, Summary, Live streams, Toolbox, Rules… Each one follows the traffic live, with no button to press. Hover a view to learn what it shows; keys 1 to 9 lead there too.',
  'HAR fidele, HAR aux secrets masques pour partager, JSON, CSV, Postman, OpenAPI, rapport, ou script pour votre langage : sur les lignes filtrees, ou sur votre selection.': 'Faithful HAR, HAR with secrets masked for sharing, JSON, CSV, Postman, OpenAPI, a report, or a script for your language: on the filtered rows, or on your selection.',
  'Le menu Actions': 'The Actions menu',
  'Importer un HAR ou une session, tout reanalyser, ouvrir le tutoriel ou cette visite, ouvrir SWIFT dans un onglet ou dans le panneau lateral.': 'Import a HAR or a session, analyse everything again, open the tutorial or this tour, open SWIFT in a tab or in the sidebar.',
  'Ou s ouvre la console': 'Where the console opens',
  'Onglet, panneau lateral, fenetre detachee ou fenetre compacte : ce bouton choisit, et retient votre choix pour le clic sur l icone.': 'Tab, sidebar, detached window or compact window: this button chooses, and remembers your choice for the icon click.',
  'Les reglages': 'Settings',
  'Langue, theme clair ou sombre, taille du texte, mode simple, et quatre profils prets a l emploi. Le bouton FR / EN juste avant change la langue de toute l interface.': 'Language, light or dark theme, text size, simple mode, and four ready-made profiles. The FR / EN button just before it switches the language of the whole interface.',
  'La barre d etat': 'The status bar',
  'Les compteurs du noyau, en direct : requetes enregistrees, fusions de doublons, alertes, octets echanges, corps captures.': 'The core counters, live: requests recorded, duplicates merged, alerts, bytes exchanged, bodies captured.',
  'Ctrl+K pour tout trouver': 'Ctrl+K to find anything',
  'La palette ouvre n importe quelle vue, outil ou action par son nom, et repond aux questions : tapez 429, cache-status ou PROPFIND. Pour aller plus loin, le Tutoriel propose douze lecons, et l Aide contient tout le mode d emploi.': 'The palette opens any view, tool or action by its name, and answers questions: type 429, cache-status or PROPFIND. To go further, the Tutorial offers twelve lessons, and Help holds the whole manual.',
  'Precedente': 'Previous',
  'Suivante': 'Next',
  'Terminer': 'Finish',
  'Quitter la visite': 'Leave the tour',
  'Ouvrir la palette (Ctrl+K)': 'Open the palette (Ctrl+K)',
  'Visite guidee': 'Guided tour',
  'Visite guidee de l interface': 'Guided tour of the interface',
  'Lancer la visite guidee': 'Start the guided tour',
  'Revoir la visite guidee': 'Take the guided tour again',

  /* ----------------------- Recherches toutes faites ---------------------- */
  'Recherches toutes faites': 'Ready-made searches',
  '{quoi} — {requete}': '{quoi} — {requete}',
  'Tout ce qui echoue': 'Everything that fails',
  'Erreurs du serveur': 'Server errors',
  'Envois de donnees': 'Data sent (POST)',
  'Reponses de plus d un mega-octet': 'Responses over one megabyte',
  'Requetes de plus d une seconde': 'Requests over one second',
  'Alertes critiques': 'Critical alerts',
  'Tiers qui posent des cookies': 'Third parties that set cookies',
  'Mutations GraphQL': 'GraphQL mutations',
  'Pages servies sans CSP': 'Pages served without a CSP',
  'Trafic en clair': 'Cleartext traffic',
  'Adresses dont le retrait est annonce': 'Addresses whose retirement is announced',
  'Lignes epinglees': 'Pinned rows',
  'Effacer la recherche': 'Clear the search',
  'Toute la syntaxe de recherche': 'The whole search syntax',

  /* -------------------- Vider, perimetre, navigation --------------------- */
  'Cliquez de nouveau dans les quatre secondes pour effacer toute la capture': 'Click again within four seconds to erase the whole capture',
  'Perimetre observe — onglet suivi : {onglet}': 'Observed scope — tab followed: {onglet}',
  '{vue} — {indice}': '{vue} — {indice}',

  /* ---------------------------- Tableau vide ----------------------------- */
  'Rien de nouveau n est enregistre tant que la capture est en pause.': 'Nothing new is recorded while capture is paused.',
  'Reprendre la capture': 'Resume capture',
  'Rien sur cet onglet': 'Nothing on this tab',
  '{n} requete(s) capturee(s) dans les autres onglets.': '{n} request(s) captured in the other tabs.',
  'Voir tout Firefox': 'Show all of Firefox',
  'Astuce : Ctrl+K ouvre n importe quelle vue, outil ou action, et repond aux questions comme « 429 » ou « cache-status ».': 'Tip: Ctrl+K opens any view, tool or action, and answers questions such as “429” or “cache-status”.',
  'Rien sur cet onglet. Naviguez, ou basculez sur « Tout Firefox ».': 'Nothing on this tab. Browse, or switch to “All of Firefox”.',
  'Rien de capture pour le moment.': 'Nothing captured yet.',

  /* ----------------------------- Aide, tutoriel -------------------------- */
  'Sommaire de l aide': 'Help contents',
  'Ouvrir Workers et WebRTC': 'Open Workers and WebRTC',
  'Ouvrir l etat du systeme': 'Open System state',
  'Vous avez ouvert l etat du systeme': 'You opened System state',
  'Choisissez « Importer un fichier HAR » dans ce menu': 'Choose “Import a HAR file” in this menu',

  /* ------------------------- Fabriquer un jeton -------------------------- */
  'Fabriquer un jeton signe': 'Build a signed token',
  'HS256, HS384 ou HS512, avec votre cle partagee': 'HS256, HS384 or HS512, with your shared key',
  'entete JSON, par exemple {"alg":"HS256","typ":"JWT"}': 'JSON header, e.g. {"alg":"HS256","typ":"JWT"}',
  'charge utile JSON : sub, exp, role…': 'JSON payload: sub, exp, role…',
  'votre cle partagee : un texte, ou une JWK « oct »': 'your shared key: text, or an “oct” JWK',
  'Signer le jeton': 'Sign the token',
  'Repartir du modele': 'Start from the template',
  'Jeton signe': 'Signed token',
  'Verifie aussitot avec la meme cle : signature valide.': 'Verified at once with the same key: valid signature.',
  'La verification du jeton fabrique a echoue : ne l employez pas.': 'Verifying the token just built failed: do not use it.',
  'Le jeton est signe dans la page, avec la cle que vous donnez : rien n est envoye. Il ne vaut que pour un service qui partage cette cle, et dont vous avez la responsabilite.': 'The token is signed in the page, with the key you give: nothing is sent. It is only valid for a service that shares this key, and that you are responsible for.',
  'entete illisible : un objet JSON est attendu': 'unreadable header: a JSON object is expected',
  'charge utile illisible : un objet JSON est attendu': 'unreadable payload: a JSON object is expected',
  'signature par cle partagee : l entete doit annoncer « alg » HS256, HS384 ou HS512': 'shared-key signature: the header must announce “alg” HS256, HS384 or HS512',
  'cle partagee vide': 'empty shared key'
};
