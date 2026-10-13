/* Arbre JSON repliable — SWIFT (by NeoZ)
 *
 * Garantit qu aucun champ ne peut rester invisible : chaque cle, chaque
 * element, a sa ligne.
 *
 * Un nombre garde son ecriture : un NombreExact (lib/json-exact.js) ou un
 * BigInt s affichent tels que recus, la ou un double aurait arrondi un
 * identifiant au-dela de 2^53.
 *
 * Jusqu a cinq mille noeuds, tout l arbre est construit d emblee, comme
 * avant : la recherche de la page (Ctrl+F) trouve aussi ce qui est replie.
 * Au-dela, construire cent mille lignes d un coup figeait le panneau ; les
 * enfants d un noeud ne sont alors construits qu a son ouverture, par lots.
 */
import { el } from './dom.js';
import { t, deuxPoints } from './i18n.js';
import { NombreExact } from './json-exact.js';
import { listeProgressive } from './liste-progressive.js';

const SEUIL_IMMEDIAT = 5000;

function typeDe(valeur) {
  if (valeur === null) return 'null';
  if (valeur instanceof NombreExact || typeof valeur === 'bigint') return 'number';
  if (Array.isArray(valeur)) return 'array';
  return typeof valeur;
}

const entreesDe = (valeur, type) => (type === 'array' ? valeur.map((v, i) => [String(i), v]) : Object.entries(valeur));

/* Nombre de noeuds, compte jusqu a `max` + 1 au plus : la reponse n a besoin
   que de dire « petit » ou « grand ». */
function compterJusqua(valeur, max) {
  let n = 0;
  const pile = [valeur];
  while (pile.length && n <= max) {
    const v = pile.pop();
    n++;
    const type = typeDe(v);
    if (type === 'object' || type === 'array') for (const [, x] of entreesDe(v, type)) pile.push(x);
  }
  return n;
}

/**
 * @param valeur     la valeur a montrer
 * @param cle        son nom, ou null pour la racine
 * @param profondeur 0 a la racine : seule la racine est ouverte d emblee
 */
export function jsonTree(valeur, cle = null, profondeur = 0, paresseux) {
  const type = typeDe(valeur);
  if (type !== 'object' && type !== 'array') {
    return el('div', { class: 'row' }, [
      cle == null ? null : el('span', { class: 'k', text: deuxPoints(cle) }),
      el('span', { class: 'v', text: type === 'string' ? valeur : String(valeur) }),
      el('span', { class: 't', text: type === 'string' ? '' : '(' + type + ')' })
    ]);
  }
  if (paresseux === undefined) paresseux = compterJusqua(valeur, SEUIL_IMMEDIAT) > SEUIL_IMMEDIAT;

  const entrees = entreesDe(valeur, type);
  const libelle = (cle == null ? t('enregistrement') : cle) +
    (type === 'array' ? ' [' + entrees.length + ']' : ' {' + entrees.length + '}');

  const boite = el('details', { open: profondeur < 1 });
  boite.appendChild(el('summary', { text: libelle }));
  if (!entrees.length) {
    boite.appendChild(el('div', { class: 'row' }, el('span', { class: 't', text: t('vide') })));
    return boite;
  }
  const enfant = ([k, v]) => jsonTree(v, k, profondeur + 1, paresseux);
  if (!paresseux) {
    for (const e of entrees) boite.appendChild(enfant(e));
    return boite;
  }
  let construit = false;
  const construire = () => {
    if (construit) return;
    construit = true;
    const hote = el('div');
    boite.appendChild(hote);
    listeProgressive(hote, entrees, enfant);
  };
  if (profondeur < 1) construire();
  else boite.addEventListener('toggle', () => { if (boite.open) construire(); });
  return boite;
}
