/* JSON Patch et JSON Merge Patch, onglet Requete — SWIFT (by NeoZ)
 *
 * Une requete PATCH qui envoie application/json-patch+json (RFC 6902) ou
 * application/merge-patch+json (RFC 7396) dit, operation par operation, ce
 * qu elle veut changer. Ce bloc le dit en clair, et signale ce qui rendrait
 * le patch invalide avant meme qu il touche le document : un membre « op »
 * ecrit deux fois, un pointeur mal forme, un deplacement dans son propre
 * enfant. La lecture vit dans ui/lib/json-patch.js.
 */
import { el, frag, sec } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { lireJsonExact, ecrireJsonExact } from '../lib/json-exact.js';
import { decrirePatch, decrireMergePatch } from '../lib/json-patch.js';
import { parLots } from './detail-more.js';

/* Le sens de chaque operation, en clair. */
export const SENS_OPERATIONS = {
  add: 'ajouter {chemin} = {valeur}',
  remove: 'retirer {chemin}',
  replace: 'remplacer {chemin} par {valeur}',
  move: 'deplacer {de} vers {chemin}',
  copy: 'copier {de} vers {chemin}',
  test: 'verifier que {chemin} vaut {valeur} — sinon rien n est applique'
};

export const SENS_FUSION = {
  poser: 'poser {chemin} = {valeur}',
  retirer: 'retirer {chemin}',
  fusionner: '{chemin} : objet fusionne, cree vide s il n existe pas',
  remplacer: 'remplacer tout le document par {valeur}'
};

const typeDe = rec => String((rec.requestBody && (rec.requestBody.contentType || rec.requestBody.mime))
  || (rec.requestHeaders || []).filter(h => h && /^content-type$/i.test(h.name || '')).map(h => h.value).pop() || '')
  .toLowerCase().split(';')[0].trim();

/* Les statuts qui disent la requete executee. 202 dit « acceptee, pas encore
   traitee » et 207 rend un resultat par partie : ni l un ni l autre n affirme
   que le patch a ete applique. */
const STATUTS_APPLIQUE = new Set([200, 201, 203, 204, 205]);

const compact = n => (n ? ecrireJsonExact(n, '') : '');
const affiche = p => (p === '' ? '""' : p);

/** Le bloc « JSON Patch » ou « JSON Merge Patch » de l onglet Requete. */
export function patchRequete(rec) {
  const box = frag();
  const corps = rec.requestBody;
  const type = typeDe(rec);
  if (!corps || typeof corps.text !== 'string' || !corps.text) return box;
  if (type !== 'application/json-patch+json' && type !== 'application/merge-patch+json') return box;
  let arbre;
  try { arbre = lireJsonExact(corps.text); }
  catch {
    box.appendChild(sec(type === 'application/json-patch+json' ? 'JSON Patch (RFC 6902)' : 'JSON Merge Patch (RFC 7396)'));
    box.appendChild(el('p', { class: 'note warn', text: t('Corps illisible en JSON : le serveur ne peut pas l appliquer.') }));
    return box;
  }
  if (type === 'application/json-patch+json') {
    const ops = decrirePatch(arbre);
    box.appendChild(sec('JSON Patch (RFC 6902)', ops ? tp('{n} operation(s)', { n: ops.length }) : null));
    if (!ops) {
      box.appendChild(el('p', { class: 'note warn', text: t('un JSON Patch est un tableau d operations (RFC 6902 §3)') }));
      return box;
    }
    box.appendChild(el('p', { class: 'note', text: t('Appliquees dans l ordre, en entier ou pas du tout : une seule qui echoue, et le document ne change pas (RFC 6902 §5).') }));
    const invalides = ops.filter(o => o.erreur && !o.ambigu).length;
    const ambigues = ops.filter(o => o.ambigu).length;
    if (invalides) {
      box.appendChild(el('p', { class: 'note warn', text: tp('{n} operation(s) invalide(s) : le patch entier ne peut pas reussir (RFC 6902 §5).', { n: invalides }) }));
      if (STATUTS_APPLIQUE.has(rec.statusCode)) {
        box.appendChild(el('p', { class: 'note warn', text: tp('statut {statut} : le serveur dit l avoir applique, alors qu un patch invalide ne doit pas reussir.', { statut: rec.statusCode }) }));
      }
    }
    if (ambigues) {
      box.appendChild(el('p', { class: 'note warn', text: tp('{n} operation(s) ambigue(s) : un membre ecrit deux fois, que chaque lecteur JSON peut lire a sa facon (RFC 8259 §4).', { n: ambigues }) }));
    }
    const hote = el('div');
    box.appendChild(hote);
    parLots(hote, ops, o => el('p', { class: 'note' + (o.erreur ? ' warn' : ''), text: '#' + (o.index + 1) + '  ' + (o.erreur
      ? t(o.ambigu ? 'ambigu' : 'invalide') + ' — ' + te(o.erreur)
      : tp(SENS_OPERATIONS[o.op], { chemin: affiche(o.path), de: affiche(o.from || ''), valeur: compact(o.valeur) })) }));
    return box;
  }
  const lignes = decrireMergePatch(arbre);
  box.appendChild(sec('JSON Merge Patch (RFC 7396)', tp('{n} changement(s)', { n: lignes.length })));
  box.appendChild(el('p', { class: 'note', text: t('null retire un membre ; un objet se fusionne membre a membre ; un tableau ou une valeur simple remplace l ancienne en entier (RFC 7396 §2). Les chemins s ecrivent en JSON Pointer (RFC 6901).') }));
  const hote = el('div');
  box.appendChild(hote);
  parLots(hote, lignes, l => el('p', { class: 'note', text: '•  ' + tp(SENS_FUSION[l.action], { chemin: affiche(l.chemin), valeur: compact(l.valeur) }) }));
  return box;
}
