/* Priorite d une reponse (Priority) — SWIFT (by D4RK)
 *
 * RFC 9218 : le client dit dans quel ordre il voudrait recevoir les reponses,
 * et le serveur peut donner son propre avis. Un dictionnaire de champ
 * structure, deux parametres :
 *   u  urgence, entier de 0 a 7, la plus petite valeur passe d abord ;
 *      3 par defaut ; 7 est reserve aux taches de fond (4.1)
 *   i  incremental : la reponse sert deja par morceaux ; faux par defaut (4.2)
 * Un parametre inconnu, hors bornes ou d un mauvais type est ignore (4).
 * Absent d une requete, un parametre vaut sa valeur par defaut ; absent d une
 * reponse, il laisse la valeur du client inchangee (8).
 */
import { lireDictionnaire } from './champs-structures.js';

export const FAITS_PRIORITE = {
  urgence: 'urgence {u} sur une echelle de 0 (la plus pressee) a 7',
  urgenceDefaut: 'urgence 3, la valeur par defaut',
  fond: 'urgence 7 : reservee aux taches de fond, a ne pas employer pour une reponse dont l interaction depend (RFC 9218 §4.1)',
  incremental: 'incrementale : la reponse sert deja par morceaux, a mesure qu elle arrive',
  nonIncremental: 'non incrementale : la reponse ne sert qu entiere',
  ignore: 'parametre {cle}={valeur} ignore : {raison} (RFC 9218 §4)',
  horsBornes: 'hors des bornes 0 a 7',
  mauvaisType: 'type inattendu',
  illisible: 'Priority illisible : un dictionnaire de champ structure est attendu (RFC 9218 §5)',
  reponseInchangee: 'le serveur ne dit rien de {param} : la valeur du client reste (RFC 9218 §8)',
  pasUnAccuse: 'une priorite dans la reponse n est pas l accuse d une priorisation (RFC 9218 §5)'
};

/**
 * @param valeur  texte de l en-tete Priority (null si absent)
 * @param sens    'requete' ou 'reponse' : les valeurs absentes ne s y lisent pas pareil
 * @returns null si absent, sinon { u, i, uExplicite, iExplicite, faits }
 *   En reponse, u et i valent null quand le serveur ne les donne pas.
 */
export function lirePriorite(valeur, sens = 'requete') {
  if (valeur == null) return null;
  const faits = [];
  const dire = (cle, v = {}) => faits.push({ cle, texte: FAITS_PRIORITE[cle], valeurs: v });
  let membres;
  try { membres = lireDictionnaire(String(valeur)); }
  catch { dire('illisible'); return { u: null, i: null, uExplicite: false, iExplicite: false, faits }; }

  let u = null;
  let i = null;
  for (const m of membres) {
    if (m.cle === 'u') {
      if (m.type !== 'entier') { dire('ignore', { cle: 'u', valeur: String(m.valeur), raison: FAITS_PRIORITE.mauvaisType }); continue; }
      if (m.valeur < 0 || m.valeur > 7) { dire('ignore', { cle: 'u', valeur: String(m.valeur), raison: FAITS_PRIORITE.horsBornes }); continue; }
      u = m.valeur;
    } else if (m.cle === 'i') {
      if (m.type !== 'booleen') { dire('ignore', { cle: 'i', valeur: String(m.valeur), raison: FAITS_PRIORITE.mauvaisType }); continue; }
      i = m.valeur;
    }
  }
  const uExplicite = u != null;
  const iExplicite = i != null;
  if (sens === 'requete') {
    if (u == null) u = 3;
    if (i == null) i = false;
  }

  if (u != null) dire(uExplicite ? 'urgence' : 'urgenceDefaut', { u });
  if (u === 7) dire('fond');
  if (i != null) dire(i ? 'incremental' : 'nonIncremental');
  if (sens === 'reponse') {
    if (!uExplicite) dire('reponseInchangee', { param: 'u' });
    if (!iExplicite) dire('reponseInchangee', { param: 'i' });
    dire('pasUnAccuse');
  }
  return { u, i, uExplicite, iExplicite, faits };
}
