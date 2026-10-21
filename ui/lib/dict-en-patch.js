/* Dictionnaire anglais — JSON Patch, Merge Patch et Pointer — SWIFT (by NeoZ)
 *
 * Les phrases du bloc de l onglet Requete (patch-detail.js), du panneau de la
 * boite a outils (tools-patch.js) et de la difference de structure de la vue
 * Comparaison. Les messages d erreur de lib/json-patch.js sont dans
 * dict-en-erreurs.js, avec les autres.
 */
export const EN_PATCH = {
  /* Le sens des operations (RFC 6902 §4) et des membres d un merge patch. */
  'ajouter {chemin} = {valeur}': 'add {chemin} = {valeur}',
  'retirer {chemin}': 'remove {chemin}',
  'remplacer {chemin} par {valeur}': 'replace {chemin} with {valeur}',
  'deplacer {de} vers {chemin}': 'move {de} to {chemin}',
  'copier {de} vers {chemin}': 'copy {de} to {chemin}',
  'verifier que {chemin} vaut {valeur} — sinon rien n est applique': 'check that {chemin} equals {valeur} — otherwise nothing is applied',
  'poser {chemin} = {valeur}': 'set {chemin} = {valeur}',
  '{chemin} : objet fusionne, cree vide s il n existe pas': '{chemin}: object merged, created empty if it does not exist',
  'remplacer tout le document par {valeur}': 'replace the whole document with {valeur}',

  /* L onglet Requete. */
  'JSON Patch (RFC 6902)': 'JSON Patch (RFC 6902)',
  'JSON Merge Patch (RFC 7396)': 'JSON Merge Patch (RFC 7396)',
  'Corps illisible en JSON : le serveur ne peut pas l appliquer.': 'Body unreadable as JSON: the server cannot apply it.',
  'Appliquees dans l ordre, en entier ou pas du tout : une seule qui echoue, et le document ne change pas (RFC 6902 §5).':
    'Applied in order, entirely or not at all: if a single one fails, the document does not change (RFC 6902 §5).',
  '{n} operation(s) invalide(s) : le patch entier ne peut pas reussir (RFC 6902 §5).': '{n} invalid operation(s): the whole patch cannot succeed (RFC 6902 §5).',
  'statut {statut} : le serveur dit l avoir applique, alors qu un patch invalide ne doit pas reussir.':
    'status {statut}: the server says it applied it, although an invalid patch must not succeed.',
  '{n} changement(s)': '{n} change(s)',
  'invalide': 'invalid',
  'ambigu': 'ambiguous',
  '{n} operation(s) ambigue(s) : un membre ecrit deux fois, que chaque lecteur JSON peut lire a sa facon (RFC 8259 §4).':
    '{n} ambiguous operation(s): a member written twice, which each JSON reader may read its own way (RFC 8259 §4).',
  'null retire un membre ; un objet se fusionne membre a membre ; un tableau ou une valeur simple remplace l ancienne en entier (RFC 7396 §2). Les chemins s ecrivent en JSON Pointer (RFC 6901).':
    'null removes a member; an object is merged member by member; an array or a simple value replaces the old one entirely (RFC 7396 §2). Paths are written as JSON Pointers (RFC 6901).',

  /* La boite a outils. */
  'JSON Patch': 'JSON Patch',
  'RFC 6902 · RFC 7396 · RFC 6901': 'RFC 6902 · RFC 7396 · RFC 6901',
  'Appliquer le JSON Patch': 'Apply the JSON Patch',
  'Appliquer le merge patch': 'Apply the merge patch',
  'Produire le JSON Patch': 'Produce the JSON Patch',
  'Produire le merge patch': 'Produce the merge patch',
  'Le texte de travail est le document. Collez a cote un patch a appliquer, ou le document vise pour obtenir le patch qui y mene.':
    'The working text is the document. Paste next to it a patch to apply, or the target document to get the patch that leads to it.',
  'le patch a appliquer, ou le document vise': 'the patch to apply, or the target document',
  'Il faut les deux textes : le document, et a cote le patch ou le document vise.': 'Both texts are needed: the document, and next to it the patch or the target document.',
  'Texte de travail illisible en JSON : {raison}': 'Working text unreadable as JSON: {raison}',
  'Second texte illisible en JSON : {raison}': 'Second text unreadable as JSON: {raison}',
  'operation #{n} : {raison} — rien n est applique (RFC 6902 §5)': 'operation #{n}: {raison} — nothing is applied (RFC 6902 §5)',
  'Document patche': 'Patched document',
  'Document fusionne': 'Merged document',
  'Merge patch': 'Merge patch',

  /* La vue Comparaison. */
  'Difference de structure : {n} operation(s) JSON Patch (RFC 6902)': 'Structural difference: {n} JSON Patch operation(s) (RFC 6902)',
  'Sans tenir compte de la mise en forme ni de l ordre des membres.': 'Regardless of formatting and member order.',
  'Copier le JSON Patch': 'Copy the JSON Patch',
  'JSON Patch copie': 'JSON Patch copied',
  'Calculer la difference de structure (JSON Patch)': 'Compute the structural difference (JSON Patch)'
};
