/* Panneau « Lire une reponse » — SWIFT (by D4RK)
 *
 * Juger les en-tetes d un site sans l avoir capture : on colle la sortie de
 * `curl -I`, ou un bloc copie ailleurs, et la reponse est lue exactement
 * comme une reponse capturee — protections, fraicheur HTTP, CSP, CORS,
 * signaux du serveur, collecte de rapports, jetons. C est l onglet En-tetes
 * du detail qui fait ce travail : une seule lecture, deja eprouvee, pour le
 * trafic capture et pour ce qui est colle.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { lireReponseBrute, enregistrementDepuisReponse, adresseLue } from '../lib/reponse-brute.js';
import { texteLong } from '../lib/texte-long.js';
import { decrireStatut } from '../lib/ref-http.js';
import { headers } from './detail-parts.js';

export function panneauReponse(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Lire une reponse', 'en-tetes colles, lus comme une reponse capturee'));

  /* L adresse et la nature de la reponse changent ce qui s applique : HSTS
     ne vaut qu en https, la CSP et l encadrement que pour une page. */
  const adresse = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.reponseUrl || '',
    placeholder: t('adresse de la reponse, par exemple https://site.example/page'),
    dataset: { champ: 'reponse-url' }
  });
  adresse.addEventListener('change', () => { etat.reponseUrl = adresse.value; redessiner(); });
  const nature = el('select', { dataset: { champ: 'reponse-type' } });
  for (const [valeur, libelle] of [['main_frame', 'Une page (document)'], ['xmlhttprequest', 'Une ressource ou un appel d API']]) {
    nature.appendChild(el('option', { value: valeur, text: t(libelle), selected: (etat.reponseType || 'main_frame') === valeur }));
  }
  nature.addEventListener('change', () => { etat.reponseType = nature.value; redessiner(); });
  box.appendChild(el('div', { class: 'actions' }, [adresse, nature]));

  const lue = lireReponseBrute(entree);
  if (!lue.entetes.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Collez dans le texte de travail les en-tetes d une reponse : la sortie de curl -I https://site.example/, ou un bloc « Nom: valeur » copie ailleurs. La ligne de statut est lue si elle est la.') }));
    return box;
  }

  const rec = enregistrementDepuisReponse(lue, etat.reponseUrl, etat.reponseType || 'main_frame');
  box.appendChild(sec('Ce qui a ete lu', tp('{n} en-tete(s)', { n: lue.entetes.length })));
  if (lue.statut != null) {
    const sens = decrireStatut(lue.statut);
    add(box, kv('Statut', lue.statut + (lue.raison ? ' ' + lue.raison : '') + (sens && sens.sens ? '   ·   ' + t(sens.sens) : ''), { hl: true }));
  } else {
    box.appendChild(el('p', { class: 'note', text: t('Aucune ligne de statut : seuls les en-tetes sont lus.') }));
  }
  add(box, kv('Adresse', rec.url));
  const donnee = String(etat.reponseUrl || '').trim();
  if (!donnee) {
    box.appendChild(el('p', { class: 'note', text:
      t('Aucune adresse donnee : la reponse est lue comme venant de https://example.com/. Donnez la vraie adresse pour juger HSTS et ce qui depend du site.') }));
  } else if (!adresseLue(donnee)) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Adresse illisible ou ni http ni https : la reponse est lue comme venant de https://example.com/.') }));
  }
  if (lue.curlVerbeux) {
    box.appendChild(el('p', { class: 'note', text:
      tp('Sortie de curl -v : la reponse est lue, {n} ligne(s) de la requete et des remarques de curl laissees de cote.', { n: lue.curlVerbeux }) }));
  }
  if (lue.reponses > 1) {
    box.appendChild(el('p', { class: 'note', text:
      tp('{n} reponses collees (des redirections ou des reponses provisoires) : seule la derniere est lue, celle que le navigateur garde.', { n: lue.reponses }) }));
  }
  if (lue.ignorees.length) {
    box.appendChild(el('p', { class: 'note warn', text:
      tp('{n} ligne(s) ni ligne de statut ni en-tete « Nom: valeur » : laissees de cote, les voici.', { n: lue.ignorees.length }) }));
    box.appendChild(texteLong(lue.ignorees.join('\n'), { seuil: 2000 }));
  }

  box.appendChild(headers(rec, { reponseSeule: true }));
  return box;
}
