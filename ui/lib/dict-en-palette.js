/* Dictionnaire anglais — palette de commandes — INTERCEPTOR (by NeoZ)
 *
 * La palette n a que trois textes a elle : son invite, sa ligne d aide et le
 * message quand rien ne correspond. Tout le reste — noms de vues, d outils,
 * d actions — vient des tables reelles, deja traduites la ou elles vivent.
 */
export const EN_PALETTE = {
  'Palette de commandes': 'Command palette',
  'Chercher une vue, un outil, une action…': 'Search a view, a tool, an action…',
  'Fleches pour choisir · Entree pour lancer · Echap pour fermer':
    'Arrows to choose · Enter to run · Esc to close',
  'Aucune commande ne correspond.': 'No command matches.',
  'Ouvrir la palette de commandes': 'Open the command palette',

  /* Les actions que la palette ajoute aux vues et aux outils. Elles vivent
     dans une table de console.js, comme les vues : leur texte doit donc etre
     traduit ici, il n apparait dans aucun appel litteral. */
  'Mettre la capture en pause ou la reprendre': 'Pause or resume the capture',
  'Suivre le flux ou le figer': 'Follow the stream or freeze it',
  'Placer le curseur dans la recherche': 'Put the cursor in the search box',

  /* --------------------------- Export assaini ----------------------------- */
  /* Un HAR fidele emporte l entete Authorization et les cookies de session :
     l envoyer, c est les divulguer. La seconde sortie les masque. */
  'HAR 1.2 — secrets masques, pour partage': 'HAR 1.2 — secrets masked, for sharing',
  '{n} requetes exportees — {fichier}': '{n} requests exported — {fichier}',
  '{n} requetes exportees — {fichier} · {m} valeur(s) masquee(s)':
    '{n} requests exported — {fichier} · {m} value(s) masked',

  /* Les groupes sous lesquels elles se rangent. */
  'Tableau': 'Table',
  'Vues': 'Views'
};
