/* JSON-RPC et SOAP dans le panneau de detail — SWIFT (by NeoZ)
 *
 *   Requete  les methodes appelees (JSON-RPC), avec leurs parametres et leur
 *            id, ou l operation SOAP, son action et les blocs d en-tete
 *   Reponse  les resultats et les erreurs JSON-RPC, avec le sens des codes
 *            de la specification ; la faute SOAP ; l accord du statut HTTP
 *
 * Rien ne s affiche quand l echange n est ni l un ni l autre. La lecture vit
 * dans ui/lib/rpc-http.js.
 */
import { el, frag, kv, sec, add, jsonTree } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import {
  lireAppelRpc, lireReponseJsonRpc, lireSoap, faitsJsonRpc, faitsSoap, actionSoap
} from '../lib/rpc-http.js';

const TONS = {
  statut2xxErreurs: 'warn', notificationRepondue: 'warn', sansReponse: 'warn', idInattendu: 'warn',
  lotVide: 'ko', elementsInvalides: 'ko', reponsesInvalides: 'ko', soap11Statut: 'warn',
  soapStatut2xx: 'warn', soapIncomplet: 'warn'
};
const montrer = (box, faits) => {
  for (const f of faits) box.appendChild(el('p', { class: 'note ' + (TONS[f.cle] || ''), text: '•  ' + tp(f.texte, f.valeurs) }));
};

function appelDe(rec) {
  try { return lireAppelRpc(rec.requestBody, rec.requestHeaders); } catch { return null; }
}
const texteReponse = rec => (rec.responseBody && typeof rec.responseBody.text === 'string' ? rec.responseBody.text : '');

/** Le bloc RPC de l onglet Requete. */
export function rpcRequete(rec) {
  const box = frag();
  const appel = appelDe(rec);
  if (!appel) return box;
  if (appel.protocole === 'JSON-RPC') {
    const valides = appel.appels.filter(a => !a.invalide);
    box.appendChild(sec('JSON-RPC 2.0', appel.lot ? tp('lot de {n} element(s)', { n: appel.appels.length }) : null));
    montrer(box, faitsJsonRpc(appel, null));
    for (const a of valides) {
      const carte = el('div', { class: 'find info' }, [el('h4', { text: a.methode })]);
      add(carte, kv('Identifiant', a.notification ? t('aucun : notification, sans reponse attendue') : JSON.stringify(a.id)));
      if (a.params !== undefined) carte.appendChild(el('div', { class: 'tree' }, jsonTree(a.params, 'params')));
      box.appendChild(carte);
    }
    return box;
  }
  box.appendChild(sec(tp('SOAP {v}', { v: appel.version }), appel.operation ? appel.operation.nom : null));
  const action = actionSoap(rec.requestHeaders, rec.requestBody && rec.requestBody.contentType);
  montrer(box, faitsSoap(appel, null, { action }));
  add(box, kv('Operation', appel.operation ? appel.operation.nom : null, { hl: true }));
  add(box, kv('Espace de noms de l operation', appel.operation && appel.operation.espace, { copy: true }));
  if (action) add(box, kv(action.source === 'SOAPAction' ? 'SOAPAction' : 'Action (parametre du type)', action.valeur || '""', { copy: true }));
  add(box, kv('Blocs d en-tete', appel.entetes.length ? appel.entetes.join(', ') : null));
  return box;
}

/** Le bloc RPC de l onglet Reponse. */
export function rpcReponse(rec) {
  const box = frag();
  const appel = appelDe(rec);
  const texte = texteReponse(rec);
  if (!appel || !texte) return box;
  if (appel.protocole === 'JSON-RPC') {
    const reponse = lireReponseJsonRpc(texte);
    if (!reponse) return box;
    const erreurs = reponse.reponses.filter(r => r.erreur).length;
    box.appendChild(sec('JSON-RPC 2.0', erreurs ? tp('{n} erreur(s)', { n: erreurs }) : t('sans erreur')));
    montrer(box, faitsJsonRpc(appel, reponse, { statut: rec.statusCode }));
    for (const r of reponse.reponses) {
      if (r.invalide) continue;
      if (r.erreur) {
        const e = r.erreur;
        const carte = el('div', { class: 'find medium' }, [
          el('h4', { text: e.message || t('(erreur sans message)') }),
          el('p', { text: [tp('code {c}', { c: e.code }), e.sens ? e.sens : null, tp('id {id}', { id: JSON.stringify(r.id) })].filter(Boolean).join('  ·  ') })
        ]);
        if (e.donnees !== undefined) carte.appendChild(el('div', { class: 'tree' }, jsonTree(e.donnees, 'data')));
        box.appendChild(carte);
      } else {
        add(box, kv(tp('Resultat, id {id}', { id: JSON.stringify(r.id) }), typeof r.resultat === 'object' && r.resultat !== null ? null : JSON.stringify(r.resultat)));
        if (r.resultat !== null && typeof r.resultat === 'object') box.appendChild(el('div', { class: 'tree' }, jsonTree(r.resultat, 'result')));
      }
    }
    return box;
  }
  const reponse = lireSoap(texte);
  if (!reponse) return box;
  box.appendChild(sec(tp('SOAP {v}', { v: reponse.version }), reponse.faute ? t('faute') : (reponse.operation ? reponse.operation.nom : null)));
  montrer(box, faitsSoap(appel, reponse, { statut: rec.statusCode }));
  if (reponse.faute) {
    const f = reponse.faute;
    const carte = el('div', { class: 'find medium' }, [el('h4', { text: f.message || t('(faute sans message)') })]);
    add(carte, kv('Code', f.code, { copy: true }));
    add(carte, kv('Sous-code', f.sousCode, { copy: true }));
    add(carte, kv('Acteur', f.acteur));
    add(carte, kv('Noeud', f.noeud));
    add(carte, kv('Role', f.role));
    add(carte, kv('Detail', f.detail));
    box.appendChild(carte);
  } else {
    add(box, kv('Element de reponse', reponse.operation ? reponse.operation.nom : null));
    add(box, kv('Blocs d en-tete', reponse.entetes.length ? reponse.entetes.join(', ') : null));
  }
  return box;
}
