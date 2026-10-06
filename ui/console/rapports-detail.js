/* Rapports du navigateur dans le panneau de detail — SWIFT (by NeoZ)
 *
 *   Requete   les rapports que porte un POST du navigateur : violation de la
 *             CSP, erreur reseau (NEL), API depreciee, intervention… chacun
 *             avec ses champs dans l ordre ou on les lit
 *   En-tetes  ou la reponse demande d envoyer les rapports : Reporting-
 *             Endpoints, Report-To et NEL, et ce que le navigateur en fera
 *
 * Rien ne s affiche quand il n y a rien. La lecture vit dans ui/lib/rapports.js.
 */
import { el, frag, kv, sec, add } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { lireRapports, lireCollecte, NOMS_TYPES } from '../lib/rapports.js';

const TONS = {
  cspBloque: 'warn', endpointNonChaine: 'ko', endpointNonSur: 'ko', endpointIllisible: 'ko',
  reponseNonSure: 'ko', illisible: 'ko', nelSuppression: 'warn'
};
const note = (texte, ton) => el('p', { class: 'note' + (ton ? ' ' + ton : ''), text: texte });
/* Une valeur marquee a traduire (le sens d une erreur NEL) l est ici. */
const montrer = (box, faits) => {
  for (const f of faits) {
    const valeurs = { ...f.valeurs };
    for (const cle of f.aTraduire || []) valeurs[cle] = t(valeurs[cle]);
    box.appendChild(note('•  ' + tp(f.texte, valeurs), TONS[f.cle]));
  }
};

/** Le bloc des rapports, dans l onglet Requete. */
export function rapportsRequete(rec) {
  const box = frag();
  const corps = rec.requestBody;
  if (!corps || typeof corps.text !== 'string' || !corps.text) return box;
  const lu = lireRapports(corps.text, corps.contentType);
  if (!lu) return box;
  box.appendChild(sec('Rapports du navigateur', lu.rapports.length));
  for (const r of lu.rapports) {
    const carte = el('div', { class: 'find ' + (r.type === 'csp-violation' || r.type === 'network-error' ? 'medium' : 'info') }, [
      el('h4', { text: t(NOMS_TYPES[r.type] || r.type) + (r.url ? '   ·   ' + r.url : '') })
    ]);
    montrer(carte, r.faits);
    for (const [libelle, valeur] of r.lignes) add(carte, kv(libelle, valeur, { copy: true }));
    add(carte, kv('Navigateur', r.agent));
    box.appendChild(carte);
  }
  return box;
}

/** Le bloc de collecte des rapports, dans l onglet En-tetes. */
export function collecteRapports(rec) {
  const box = frag();
  const lu = lireCollecte(rec.responseHeaders, rec.finalUrl || rec.url);
  if (!lu) return box;
  box.appendChild(sec('Collecte des rapports', 'Reporting-Endpoints · Report-To · NEL'));
  montrer(box, lu.faits);
  for (const p of lu.points) add(box, kv(tp('Point de collecte « {nom} »', { nom: p.nom }), p.url, { copy: true }));
  for (const g of lu.groupes) {
    add(box, kv(tp('Groupe « {nom} »', { nom: g.groupe }),
      g.urls.join('  ·  ') + (g.maxAge != null ? '   (max_age ' + g.maxAge + ' s)' : '')));
  }
  if (lu.nel) {
    add(box, kv('NEL : groupe de destination', lu.nel.groupe));
    add(box, kv('NEL : duree de la politique', lu.nel.maxAge != null ? lu.nel.maxAge + ' s' : null));
  }
  return box;
}
