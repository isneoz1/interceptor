/* Dictionnaire anglais — tutoriel — INTERCEPTOR (by NeoZ)
 *
 * Les douze lecons ont leur texte dans content-en.js : titre, objectif et
 * corps y sont ecrits en anglais. Mais `localized()` ne transpose que ces
 * trois champs — les BOUTONS de chaque lecon et sa liste de verifications
 * restaient ceux de content-fr.js.
 *
 * Le tutoriel s affichait donc avec un texte anglais, des boutons francais et
 * une checklist francaise. Pour la vue dont le seul role est d accueillir
 * quelqu un qui decouvre l extension, c est le pire endroit ou laisser cela.
 *
 * Les libelles passent bien par `t` — `button()` et le rendu des
 * verifications l appellent tous deux. Il ne manquait que les entrees.
 */
export const EN_TUTORIEL = {
  /* ------------------------------ Bienvenue ------------------------------- */
  'Mettre en pause / reprendre': 'Pause / resume',
  'La capture est en cours': 'Capture is running',
  'Au moins une requete a ete enregistree': 'At least one request has been recorded',

  /* -------------------------------- Tableau ------------------------------- */
  'Aller au tableau': 'Go to the table',
  'Ouvrir le choix des colonnes': 'Open the column picker',
  'Activer / figer le suivi': 'Follow the stream, or freeze it',
  'Au moins dix requetes capturees': 'At least ten requests captured',
  'Vous avez trie une colonne': 'You sorted a column',
  'Vous avez selectionne au moins une ligne': 'You selected at least one row',

  /* -------------------------------- Filtrer ------------------------------- */
  /* Les deux exemples de filtre gardent leur syntaxe : elle ne se traduit
     pas, c est ce qu on tape dans la barre de recherche. */
  'Essayer status:>=400': 'Try status:>=400',
  'Essayer method:POST': 'Try method:POST',
  'Voir toute la syntaxe': 'See the whole syntax',
  'Vous avez utilise un filtre': 'You used a filter',
  'Vous avez essaye une facette': 'You tried a facet',

  /* --------------------------------- Detail ------------------------------- */
  'Ouvrir la premiere ligne': 'Open the first row',
  'Vous avez ouvert le detail d une requete': 'You opened the detail of a request',
  'Vous avez consulte plusieurs onglets du detail': 'You looked at several detail tabs',

  /* -------------------------------- Securite ------------------------------ */
  'Ouvrir la vue Securite': 'Open the Security view',
  'Ne garder que les alertes': 'Keep only the findings',
  'Regler l analyse': 'Configure the analyser',
  'Vous avez ouvert la vue Securite': 'You opened the Security view',
  'L analyse a tourne sur vos requetes': 'The analyser ran on your requests',

  /* ---------------------------------- Flux -------------------------------- */
  'Ouvrir Flux temps reel': 'Open Live streams',
  'Ouvrir le journal des cookies': 'Open the cookie log',
  'Ouvrir le journal de contexte': 'Open the context log',
  'Vous avez ouvert Flux temps reel': 'You opened Live streams',
  'Vous avez ouvert un journal': 'You opened a log',

  /* -------------------------------- Synthese ------------------------------ */
  'Ouvrir la synthese': 'Open the summary',
  'Ouvrir le diagnostic': 'Open the diagnostics',
  'Vous avez ouvert la synthese': 'You opened the summary',

  /* -------------------------------- Exporter ------------------------------ */
  'Ouvrir le menu Exporter': 'Open the Export menu',
  'Vous avez exporte au moins un fichier': 'You exported at least one file',

  /* --------------------------------- Regler ------------------------------- */
  'Voir l etat des couches': 'See the state of the capture layers',
  'Vous avez ouvert les reglages': 'You opened the settings',
  'Vous avez ouvert le diagnostic': 'You opened the diagnostics',

  /* ------------------------------- Intervenir ----------------------------- */
  'Ouvrir l editeur de regles': 'Open the rule editor',
  'Comprendre le rejeu': 'Understand replay',
  'Vous avez ouvert l editeur de regles': 'You opened the rule editor',

  /* --------------------------------- Outils ------------------------------- */
  'Y poser une valeur d essai': 'Drop a test value into it',
  'Vous avez ouvert la boite a outils': 'You opened the toolbox',

  /* -------------------------------- Limites ------------------------------- */
  'Lancer le test de couverture': 'Run the coverage test',
  'Ouvrir l aide complete': 'Open the full manual',
  'Une verification de couverture a ete lancee': 'A coverage check has been run',

  /* ------------------------ La navigation des lecons ---------------------- */
  'Marquer a refaire': 'Mark as to redo',
  'Lecon terminee ✔': 'Lesson done ✔',
  '{n} / {total} lecons terminees': '{n} / {total} lessons done',

  /* Assemblee a l execution, donc jamais une cle : la vue « Flux » comptait
     ses lignes en clair, et « 0 flux » restait francais en anglais. */
  '{n} flux': '{n} streams'
};
