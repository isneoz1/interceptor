/* Panneau « JSON Patch » — SWIFT (by D4RK)
 *
 * Le texte de travail est un document JSON ; a cote, un second texte : un
 * patch a lui appliquer, ou le document vise. Quatre gestes :
 *   - appliquer un JSON Patch (RFC 6902) ou un merge patch (RFC 7396) ;
 *   - produire le JSON Patch, ou le merge patch, qui mene du premier au second.
 * Le resultat se recalcule a chaque dessin, a partir des deux textes du
 * moment : il ne peut pas survivre au texte dont il vient. Tout se fait sans
 * perte (lib/json-exact.js) : un grand entier garde ses chiffres, une cle en
 * double se voit.
 */
import { el, frag, sec, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { copy } from '../app.js';
import { lireJsonExact, ecrireJsonExact } from '../lib/json-exact.js';
import { appliquerPatch, appliquerMergePatch, produirePatch, produireMergePatch, patchEnArbre } from '../lib/json-patch.js';
import { texteLong } from '../lib/texte-long.js';

export const GESTES_PATCH = [
  ['appliquer', 'Appliquer le JSON Patch'],
  ['fusionner', 'Appliquer le merge patch'],
  ['produire', 'Produire le JSON Patch'],
  ['produireFusion', 'Produire le merge patch']
];

/* Le resultat d un geste : { ok, titre, texte } ou { ok: false, raison }. */
function calculer(geste, entree, autre) {
  let document, second;
  try { document = lireJsonExact(entree); }
  catch (e) { return { ok: false, raison: tp('Texte de travail illisible en JSON : {raison}', { raison: te(e) }) }; }
  try { second = lireJsonExact(autre); }
  catch (e) { return { ok: false, raison: tp('Second texte illisible en JSON : {raison}', { raison: te(e) }) }; }
  if (geste === 'appliquer') {
    const r = appliquerPatch(document, second);
    if (!r.ok) {
      return { ok: false, raison: r.index === null ? te(r.raison)
        : tp('operation #{n} : {raison} — rien n est applique (RFC 6902 §5)', { n: r.index + 1, raison: te(r.raison) }) };
    }
    return { ok: true, titre: t('Document patche'), texte: ecrireJsonExact(r.resultat, '  ') };
  }
  if (geste === 'fusionner') {
    const r = appliquerMergePatch(document, second);
    return r.ok ? { ok: true, titre: t('Document fusionne'), texte: ecrireJsonExact(r.resultat, '  ') } : { ok: false, raison: te(r.raison) };
  }
  if (geste === 'produire') {
    const ops = produirePatch(document, second);
    return { ok: true, titre: tp('{n} operation(s)', { n: ops.length }), texte: ecrireJsonExact(patchEnArbre(ops), '  ') };
  }
  const r = produireMergePatch(document, second);
  return r.ok ? { ok: true, titre: t('Merge patch'), texte: ecrireJsonExact(r.patch, '  ') } : { ok: false, raison: te(r.raison) };
}

export function panneauPatch(entree, etat, redessiner, poser) {
  const box = frag();
  box.appendChild(sec('JSON Patch', 'RFC 6902 · RFC 7396 · RFC 6901'));
  box.appendChild(el('p', { class: 'note', text:
    t('Le texte de travail est le document. Collez a cote un patch a appliquer, ou le document vise pour obtenir le patch qui y mene.') }));
  const zone = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '6', dataset: { champ: 'patch-autre' },
    placeholder: t('le patch a appliquer, ou le document vise')
  });
  zone.value = etat.patchAutre || '';
  zone.addEventListener('change', () => { etat.patchAutre = zone.value; redessiner(); });
  box.appendChild(zone);

  const barre = el('div', { class: 'actions' });
  for (const [geste, libelle] of GESTES_PATCH) {
    barre.appendChild(button(libelle, () => { etat.patchGeste = geste; redessiner(); },
      { class: etat.patchGeste === geste ? 'on' : 'ghost' }));
  }
  box.appendChild(barre);

  if (!etat.patchGeste) return box;
  if (!String(entree || '').trim() || !String(etat.patchAutre || '').trim()) {
    box.appendChild(el('p', { class: 'note', text: t('Il faut les deux textes : le document, et a cote le patch ou le document vise.') }));
    return box;
  }
  const r = calculer(etat.patchGeste, entree, etat.patchAutre);
  if (!r.ok) {
    box.appendChild(el('p', { class: 'note warn', text: r.raison }));
    return box;
  }
  box.appendChild(sec(r.titre));
  box.appendChild(texteLong(r.texte));
  box.appendChild(el('div', { class: 'actions' }, [
    button('Copier le resultat', () => copy(r.texte, 'Resultat copie')),
    button('Reprendre comme entree', () => poser(r.texte))
  ]));
  return box;
}
