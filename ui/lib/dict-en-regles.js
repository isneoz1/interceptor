/* Dictionnaire anglais — vue « Regles » et fin des reglages
 * INTERCEPTOR (by NeoZ)
 *
 * La vue « Regles » ecrit en clair ce que chaque regle fera : « Si hote
 * contient « api.example.com », alors la requete part avec 750 ms de retard. »
 * Cette phrase etait assemblee a l execution, donc intraduisible — et c est
 * pourtant celle sur laquelle on se fie avant d activer une regle qui modifie
 * du trafic. Elle est desormais faite de gabarits, traduits ici un a un.
 */
export const EN_REGLES = {
  /* ------------------------------ L interrupteur -------------------------- */
  'Moteur de regles actif': 'Rules engine on',
  'Moteur de regles ACTIF': 'Rules engine ON',
  'Moteur de regles arrete': 'Rules engine stopped',
  'Desactive, aucune regle n est evaluee : les regles restent enregistrees.':
    'Turned off, no rule is evaluated: the rules stay saved.',
  'Par defaut INTERCEPTOR observe sans jamais modifier le trafic. Activer le moteur autorise le blocage, la redirection et la reecriture d entetes. A n utiliser que sur des cibles dont vous avez la responsabilite.':
    'By default INTERCEPTOR observes without ever modifying traffic. Turning the engine on allows blocking, redirection and header rewriting. Use it only on targets you are responsible for.',
  'Depuis le demarrage : {e} evaluations, {b} blocages, {r} redirections, {h} entetes modifies.':
    'Since startup: {e} evaluations, {b} blocks, {r} redirects, {h} headers modified.',
  '{n} regle(s)': '{n} rule(s)',

  /* --------------------------- Champs d une regle ------------------------- */
  'Hote contient': 'Host contains',
  'Type de ressource': 'Resource type',
  'Type de contenu': 'Content type',
  'URL (expression reguliere)': 'URL (regular expression)',
  'Corps servi a la page': 'Body served to the page',
  'Attente avant emission (ms)': 'Delay before sending (ms)',
  'Le code de statut d origine est conserve : Firefox ne permet pas de le reecrire depuis une extension.':
    'The original status code is kept: Firefox does not allow an extension to rewrite it.',
  'La requete part normalement, mais plus tard : de quoi reproduire un reseau lent sans rien changer d autre.':
    'The request leaves as normal, only later: enough to reproduce a slow network without changing anything else.',
  'Ne s applique qu aux reponses textuelles non compressees. Dans les autres cas le flux passe intact et la raison est inscrite sur la ligne.':
    'Applies only to uncompressed text responses. Otherwise the stream passes through untouched and the reason is recorded on the row.',

  /* ------------------- La phrase qui resume une regle ---------------------- */
  'Si {conditions}, alors {effet}.': 'If {conditions}, then {effet}.',
  ' ET ': ' AND ',
  'AUCUNE condition (toutes les requetes)': 'NO condition (every request)',
  'hote contient « {valeur} »': 'host contains "{valeur}"',
  'URL correspond a /{motif}/': 'URL matches /{motif}/',
  'methode {valeur}': 'method {valeur}',
  'type {valeur}': 'type {valeur}',
  'la requete est bloquee': 'the request is blocked',
  'la requete part vers {url}': 'the request goes to {url}',
  '(URL manquante)': '(URL missing)',
  'la requete http est renvoyee en https': 'the http request is sent over https instead',
  'la page recoit une reponse simulee ({n} octets), le corps reel restant enregistre':
    'the page receives a mocked response ({n} bytes), while the real body is still recorded',
  'la requete part avec {n} ms de retard': 'the request leaves {n} ms late',
  'la page recoit le corps du serveur avec « {cherche} » remplace par « {par} »':
    'the page receives the server body with "{cherche}" replaced by "{par}"',
  '(motif manquant)': '(pattern missing)',
  'les entetes sont reecrits': 'the headers are rewritten',
  /* « L expression d URL de cette regle est illisible… » vit deja dans
     dict-en-analyse.js : une cle ne se definit qu a un seul endroit. */

  /* ----------------------------- Fin des reglages ------------------------- */
  'Chargement…': 'Loading…',
  'Chargement des reglages…': 'Loading settings…',
  'Egalement accessible par le bouton « Colonnes » au-dessus du tableau.':
    'Also reachable from the "Columns" button above the table.',
  '{n} affichee(s)': '{n} shown',
  'Exportez pour conserver votre configuration, ou collez ci-dessous un fichier exporte pour la restaurer.':
    'Export to keep your configuration, or paste an exported file below to restore it.',
  '{n} ligne(s) enregistree(s)': '{n} line(s) saved',
  'Fichier illisible : {raison}': 'Unreadable file: {raison}',
  'Reglages ecrits — {fichier}': 'Settings written — {fichier}',
  'JSON invalide : {raison}': 'Invalid JSON: {raison}',
  '{n} reglage(s) appliques.': '{n} setting(s) applied.',
  '{n} reglage(s) appliques, {i} inconnus ignores.':
    '{n} setting(s) applied, {i} unknown ones ignored.',
  'Permission « {nom} » refusee': 'Permission "{nom}" denied',
  'Lecture de {fichier}…': 'Reading {fichier}…',
  '{n} requetes importees': '{n} requests imported',
  '{n} requetes importees, {i} ignorees': '{n} requests imported, {i} skipped'
};
