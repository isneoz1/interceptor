/* Dictionnaire anglais — verdict et lectures (5.2) — SWIFT (by NeoZ)
 *
 * Complete dict-en.js (`...EN_LECTURES2`) : le verdict en une phrase, la
 * provenance declaree par Firefox (Sec-Fetch-*), Clear-Site-Data et les
 * cartes de source.
 */
export const EN_LECTURES2 = {
  /* -------------------------------- Verdict --------------------------------- */
  'Voir l onglet {onglet}': 'See the {onglet} tab',
  'En cours : la reponse n est pas encore arrivee': 'In progress: the response has not arrived yet',
  'Bloquee par la regle « {nom} »': 'Blocked by the “{nom}” rule',
  'Reponse simulee par la regle « {nom} » : la page a recu le contenu de la regle':
    'Response mocked by the “{nom}” rule: the page received the rule’s content',
  'Echec reseau : {sens}': 'Network failure: {sens}',
  'Echec : {erreur}': 'Failed: {erreur}',
  'Changement de protocole ({statut}) : la suite se lit dans l onglet Flux':
    'Protocol switch ({statut}): what follows is in the Streams tab',
  'Reponse {statut}, mais {n} erreur(s) GraphQL dans le corps': 'Response {statut}, but {n} GraphQL error(s) in the body',
  'Reponse {statut}, mais {n} erreur(s) JSON-RPC dans le corps': 'Response {statut}, but {n} JSON-RPC error(s) in the body',
  'Reponse {statut}, mais une faute SOAP dans l enveloppe': 'Response {statut}, but a SOAP fault in the envelope',
  'Reussie, servie par le cache ({statut} {phrase})': 'Succeeded, served from the cache ({statut} {phrase})',
  'Reussie : {statut} {phrase}': 'Succeeded: {statut} {phrase}',
  'Reussie : {statut} {phrase}, en {duree}': 'Succeeded: {statut} {phrase}, in {duree}',
  'Non modifiee (304) : le navigateur reutilise sa copie en cache': 'Not modified (304): the browser reuses its cached copy',
  'Redirigee ({statut} {phrase}) vers {cible}': 'Redirected ({statut} {phrase}) to {cible}',
  'Redirection ({statut} {phrase}) sans en-tete Location': 'Redirection ({statut} {phrase}) without a Location header',
  'Refusee par le serveur : {statut} {phrase}': 'Refused by the server: {statut} {phrase}',
  'Erreur du serveur : {statut} {phrase}': 'Server error: {statut} {phrase}',
  '{statut} {phrase} : « {titre} »': '{statut} {phrase}: “{titre}”',
  'Statut {statut}': 'Status {statut}',
  '{n} alerte(s) de securite sur cette requete': '{n} security alert(s) on this request',

  /* ------------------------ Provenance (Sec-Fetch-*) ------------------------ */
  'Provenance declaree par le navigateur': 'Origin declared by the browser',
  'Site d origine': 'Originating site',
  'Action de l utilisateur': 'User action',
  'oui : navigation declenchee par un clic ou une touche': 'yes: navigation triggered by a click or a key',
  'de la meme origine (meme schema, meme hote, meme port)': 'from the same origin (same scheme, host and port)',
  'du meme site, mais d une autre origine (un autre sous-domaine)': 'from the same site, but another origin (another subdomain)',
  'd un autre site': 'from another site',
  'sans page a l origine : saisie dans la barre d adresse, favori, lien ouvert de l exterieur':
    'with no originating page: typed in the address bar, a bookmark, a link opened from outside',
  'requete CORS : venue d une autre origine, sa reponse ne se lit que si le serveur l autorise':
    'CORS request: coming from another origin, its response is readable only if the server allows it',
  'navigation : chargement d un document': 'navigation: loading a document',
  'requete sans CORS : venue d une autre origine, sa reponse reste opaque pour la page':
    'no-CORS request: coming from another origin, its response stays opaque to the page',
  'reservee a la meme origine : refusee si elle en visait une autre': 'same origin only: refused if it targeted another one',
  'ouverture d un WebSocket': 'opening a WebSocket',
  'une destination vide : fetch(), XMLHttpRequest et les autres appels sans destination propre':
    'an empty destination: fetch(), XMLHttpRequest and other calls without a destination of their own',
  'la page principale': 'the main page',
  'un cadre (iframe)': 'a frame (iframe)',
  'un cadre (frame)': 'a frame (frame)',
  'une image': 'an image',
  'un script': 'a script',
  'une feuille de style': 'a stylesheet',
  'une police': 'a font',
  'un Worker': 'a Worker',
  'un SharedWorker': 'a SharedWorker',
  'un Service Worker': 'a Service Worker',
  'le manifeste de l application': 'the application manifest',
  'un son': 'an audio file',
  'une video': 'a video',
  'des sous-titres': 'subtitles',
  'un element object': 'an object element',
  'un element embed': 'an embed element',
  'un rapport du navigateur': 'a browser report',
  'une feuille XSLT': 'an XSLT stylesheet',
  'un AudioWorklet': 'an AudioWorklet',
  'un PaintWorklet': 'a PaintWorklet',

  /* ---------------------------- Clear-Site-Data ----------------------------- */
  'Effacement demande': 'Requested clearing',
  'aucun type reconnu : rien ne sera efface': 'no recognised type: nothing will be cleared',
  'le cache du site, pages prechargees comprises': 'the site cache, prerendered pages included',
  'les cookies et les identifiants HTTP de tout le domaine enregistre': 'the cookies and HTTP credentials of the whole registered domain',
  'le stockage du site : localStorage, sessionStorage, IndexedDB, et ses Service Workers':
    'the site storage: localStorage, sessionStorage, IndexedDB, and its Service Workers',
  'les pages ouvertes du site, rechargees': 'the open pages of the site, reloaded',
  'les Client Hints memorises pour le site (Accept-CH)': 'the Client Hints remembered for the site (Accept-CH)',
  'tout ce qui precede': 'everything above',
  'valeur {v} sans guillemets : la grammaire exige une chaine entre guillemets': 'value {v} without quotes: the grammar requires a quoted string',
  'type {v} inconnu de la specification': 'type {v} unknown to the specification',
  'reponse servie sans https : le navigateur ne traite pas Clear-Site-Data': 'response served without https: the browser does not process Clear-Site-Data',

  /* -------------------------------- Synthese -------------------------------- */
  'Domaines en erreur': 'Domains in error',
  '{n} requete(s)': '{n} request(s)',
  'Memes adresses telechargees plusieurs fois': 'Same addresses downloaded several times',
  '{n} fois · {taille}': '{n} times · {taille}',
  'Compression possible': 'Possible compression',
  'mesuree sur les octets recus': 'measured on the bytes received',
  'mesure impossible': 'measurement impossible',
  'Aucune reponse texte d au moins un kilo-octet servie sans compression.': 'No text response of at least one kilobyte served without compression.',
  '{n} reponse(s) texte servies sans compression : {avant} ; en gzip, {apres} — {gain} % de moins.':
    '{n} text response(s) served without compression: {avant}; with gzip, {apres} — {gain} % less.',
  'Les plus grosses economies': 'The largest savings',
  '{avant} → {apres}': '{avant} → {apres}',
  'Compresse en gzip chaque reponse texte servie sans compression, pour dire ce qu elle aurait pese.':
    'Compresses with gzip every text response served without compression, to tell what it would have weighed.',
  'Mesurer': 'Measure',
  'Mesure en cours…': 'Measuring…',
  'SWIFT — synthese': 'SWIFT — summary',
  'Requetes : {n}': 'Requests: {n}',
  'Domaines : {n}': 'Domains: {n}',
  'Recu : {n}': 'Received: {n}',
  'En erreur : {n}': 'In error: {n}',
  'Alertes : {n}': 'Alerts: {n}',
  'Domaines par volume :': 'Domains by volume:',
  'SWIFT — comparaison': 'SWIFT — comparison',
  'Corps :': 'Body:',

  /* ------------------------------ Tableau ----------------------------------- */
  'Requete masquee dans le tableau par le filtre ou le perimetre': 'This request is hidden in the table by the filter or the scope',

  /* ----------------------------- Raccourcis --------------------------------- */
  /* La liste vit dans ui/console/raccourcis.js : la fenetre « ? » l affichait
     en francais dans l interface anglaise, faute de ces entrees. */
  'Fleche haut / bas': 'Arrow up / down',
  'Ouvrir la requete precedente / suivante': 'Open the previous / next request',
  'Echap': 'Esc',
  'Fermer le detail, la palette, un menu ou la liste des raccourcis': 'Close the detail, the palette, a menu or the shortcut list',
  'Comparer les deux lignes selectionnees': 'Compare the two selected rows',
  '1 a 9': '1 to 9',
  'Basculer sur une vue': 'Switch to a view',
  'Afficher la liste des raccourcis': 'Show the shortcut list',
  'Ctrl+clic': 'Ctrl+click',
  'Ajouter une ligne a la selection': 'Add a row to the selection',
  'Maj+clic': 'Shift+click',
  'Selectionner une plage de lignes': 'Select a range of rows',
  'Clic droit': 'Right click',
  'Menu contextuel de la ligne': 'Row context menu',
  'Comme un clic sur l icone : la fenetre compacte, par defaut': 'Same as clicking the icon: the compact window, by default',
  'Ouvrir la console dans un onglet': 'Open the console in a tab',
  'Pause / reprise, meme hors de la console': 'Pause / resume, even outside the console',

  /* ---------------------------- Cartes de source ---------------------------- */
  'Carte de source': 'Source map',
  'Adresse de la carte': 'Map address',
  'Annoncee par': 'Announced by',
  'un commentaire sourceMappingURL': 'a sourceMappingURL comment',
  'l en-tete HTTP': 'the HTTP header',
  'carte de source annoncee : si elle est accessible, elle relie ce code minifie a ses sources d origine':
    'source map announced: if it is reachable, it links this minified code to its original sources',
  'carte integree dans le fichier (URI data:) : les sources d origine voyagent avec le code':
    'map embedded in the file (data: URI): the original sources travel with the code',
  'en-tete X-SourceMap : deprecie, SourceMap est le nom attendu (ECMA-426)': 'X-SourceMap header: deprecated, SourceMap is the expected name (ECMA-426)',
  'commentaire //@ : forme ancienne, //# est celle a ecrire (ECMA-426)': '//@ comment: old form, //# is the one to write (ECMA-426)'
};
