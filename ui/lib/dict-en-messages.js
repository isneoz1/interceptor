/* Dictionnaire anglais : les messages d une ligne — SWIFT (by D4RK)
 *
 * Ce que toast() affiche apres un geste : une copie, un enregistrement, un
 * refus. Ces messages arrivent souvent par un detour — copy(texte, message),
 * commit(regles, message) — que la lecture des appels a t() ne voit pas ;
 * tests/langue.test.mjs les cherche aussi la.
 */
export const EN_MESSAGES = {
  /* -------------------------------- Copies -------------------------------- */
  'Comparaison copiee': 'Comparison copied',
  'Hote copie': 'Host copied',
  'Synthese copiee': 'Summary copied',
  'Structure copiee': 'Structure copied',
  'Liste copiee': 'List copied',
  'Ligne copiee': 'Line copied',
  'Difference copiee': 'Difference copied',
  'Valeur copiee': 'Value copied',
  'Mot de passe copie': 'Password copied',
  'Commande copiee': 'Command copied',
  'Vidage copie': 'Dump copied',
  'Origine copiee': 'Origin copied',
  'Date copiee': 'Date copied',
  'Texte de travail copie': 'Working text copied',
  'Reglages copies': 'Settings copied',
  'Regles copiees': 'Rules copied',

  /* -------------------------------- Regles -------------------------------- */
  'Regle ajoutee': 'Rule added',
  'Modele ajoute': 'Template added',
  'Regle dupliquee': 'Rule duplicated',
  'Regle supprimee': 'Rule deleted',
  'Toutes les regles supprimees': 'All rules deleted',
  'Regles enregistrees': 'Rules saved',

  /* --------------------------- Gestes et refus ---------------------------- */
  'Repere pose dans le journal': 'Marker added to the log',
  'Cette requete ne transporte pas de corps texte': 'This request carries no text body',
  'Aucun corps de reponse texte capture': 'No text response body captured',
  'Aucun entete capture': 'No header captured',
  'Ouvrez le panneau lateral avec Alt+Shift+S': 'Open the sidebar with Alt+Shift+S',
  'Ouvrez le panneau avec Alt+Shift+S': 'Open the sidebar with Alt+Shift+S',
  'Redemarrage refuse': 'Restart refused',
  'Reglages importes': 'Settings imported',
  'Aucune reparation possible sur ce texte': 'No repair is possible on this text',
  'Aucune cle ne rend un texte lisible': 'No key gives a readable text',
  'Texte dechiffre : il remplace le texte de travail': 'Decrypted text: it replaces the working text',
  'Lecture du presse-papiers refusee par le navigateur': 'The browser refused to read the clipboard',
  'Cle vide': 'Empty key',
  'Cette URL n a pas d origine': 'This URL has no origin',
  'Texte colle depuis le presse-papiers': 'Text pasted from the clipboard',
  'Texte de travail vide': 'The working text is empty',
  'Instantane indisponible : le noyau demarre peut-etre encore': 'Snapshot unavailable: the kernel may still be starting',
  'Noyau indisponible': 'Kernel unavailable'
};
