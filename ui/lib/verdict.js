/* Le verdict d une requete en une phrase — SWIFT (by NeoZ)
 *
 * Le haut de l onglet Resume dit en une phrase ce qui s est passe, et quel
 * onglet en donne le detail. Rien n y est nouveau ni devine : chaque verdict
 * reprend une lecture deja faite et prouvee ailleurs — le statut et sa phrase
 * IANA, l erreur reseau de Firefox, une regle appliquee, une erreur GraphQL ou
 * JSON-RPC, une faute SOAP, un probleme RFC 9457, les alertes de l analyseur.
 *
 * L ordre compte : une requete bloquee par une regle n a pas de statut, une
 * reponse 200 qui porte une erreur GraphQL n est pas une reussite.
 */
import { decrireStatut } from './ref-http.js';
import { decrireErreurReseau } from './ref-reseau.js';
import { lireRequeteGraphql, lireReponseGraphql } from './graphql-http.js';
import { lireAppelRpc, lireReponseJsonRpc, lireSoap } from './rpc-http.js';
import { lireProbleme } from './probleme-http.js';

/* Les phrases, traduites a l affichage : exportees pour que le controle de
   traduction les verifie une a une. */
export const VERDICTS = {
  enCours: 'En cours : la reponse n est pas encore arrivee',
  bloquee: 'Bloquee par la regle « {nom} »',
  simulee: 'Reponse simulee par la regle « {nom} » : la page a recu le contenu de la regle',
  echecReseau: 'Echec reseau : {sens}',
  echecBrut: 'Echec : {erreur}',
  protocole: 'Changement de protocole ({statut}) : la suite se lit dans l onglet Flux',
  graphqlErreurs: 'Reponse {statut}, mais {n} erreur(s) GraphQL dans le corps',
  jsonRpcErreurs: 'Reponse {statut}, mais {n} erreur(s) JSON-RPC dans le corps',
  soapFaute: 'Reponse {statut}, mais une faute SOAP dans l enveloppe',
  cache: 'Reussie, servie par le cache ({statut} {phrase})',
  reussie: 'Reussie : {statut} {phrase}',
  reussieDuree: 'Reussie : {statut} {phrase}, en {duree}',
  nonModifiee: 'Non modifiee (304) : le navigateur reutilise sa copie en cache',
  redirigee: 'Redirigee ({statut} {phrase}) vers {cible}',
  redirectionSansCible: 'Redirection ({statut} {phrase}) sans en-tete Location',
  refusee: 'Refusee par le serveur : {statut} {phrase}',
  erreurServeur: 'Erreur du serveur : {statut} {phrase}',
  probleme: '{statut} {phrase} : « {titre} »',
  statutSeul: 'Statut {statut}',
  alertes: '{n} alerte(s) de securite sur cette requete'
};

const entete = (liste, nom) => {
  const h = (liste || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value ?? '') : null;
};
const texteDe = corps => (corps && typeof corps.text === 'string' ? corps.text : '');

/* Les erreurs que porte le corps d une reponse 2xx : GraphQL, JSON-RPC, SOAP. */
function erreursDuCorps(rec) {
  const texte = texteDe(rec.responseBody);
  if (!texte) return null;
  try {
    const gql = lireRequeteGraphql({ methode: rec.method, url: rec.url, corps: rec.requestBody || null });
    if (gql) {
      const r = lireReponseGraphql(texte);
      const n = r ? r.resultats.reduce((s, x) => s + x.erreurs.length, 0) : 0;
      return n ? { cle: 'graphqlErreurs', n } : null;
    }
    const appel = lireAppelRpc(rec.requestBody, rec.requestHeaders);
    if (appel && appel.protocole === 'JSON-RPC') {
      const r = lireReponseJsonRpc(texte);
      const n = r ? r.reponses.filter(x => x.erreur).length : 0;
      return n ? { cle: 'jsonRpcErreurs', n } : null;
    }
    if (appel) {
      const r = lireSoap(texte);
      return r && r.faute ? { cle: 'soapFaute', n: 1 } : null;
    }
  } catch { /* corps illisible : pas de verdict tire du corps */ }
  return null;
}

/**
 * Le verdict d un enregistrement complet.
 * @returns {{ cle:string, texte:string, valeurs:object, ton:string, onglet:string|null, aTraduire?:string[] }}
 */
export function verdictDe(rec) {
  const dire = (cle, valeurs, ton, onglet = null, aTraduire = []) =>
    ({ cle, texte: VERDICTS[cle], valeurs, ton, onglet, aTraduire });
  const regles = rec.rulesApplied || [];
  const bloc = regles.find(r => r.action === 'block');
  if (bloc) return dire('bloquee', { nom: bloc.name || bloc.id }, 'warn');
  const simulation = regles.find(r => r.action === 'mock');

  if (rec.error) {
    const cause = decrireErreurReseau(rec.error);
    return cause
      ? dire('echecReseau', { sens: cause.sens }, 'ko', null, ['sens'])
      : dire('echecBrut', { erreur: rec.error }, 'ko');
  }
  const statut = Number(rec.statusCode) || 0;
  if (!statut) return dire('enCours', {}, 'info');
  if (simulation) return dire('simulee', { nom: simulation.name || simulation.id }, 'warn', 'response');

  const phrase = (decrireStatut(statut) || {}).nom || '';
  if (statut === 101) return dire('protocole', { statut }, 'info', 'streams');
  if (statut >= 200 && statut < 300) {
    const erreurs = erreursDuCorps(rec);
    if (erreurs) return dire(erreurs.cle, { statut, n: erreurs.n }, 'warn', 'response');
    if (rec.fromCache) return dire('cache', { statut, phrase }, 'ok');
    return rec.duration != null
      ? dire('reussieDuree', { statut, phrase, duree: rec.duration }, 'ok')
      : dire('reussie', { statut, phrase }, 'ok');
  }
  if (statut === 304) return dire('nonModifiee', {}, 'ok');
  if (statut >= 300 && statut < 400) {
    const cible = entete(rec.responseHeaders, 'location');
    return cible
      ? dire('redirigee', { statut, phrase, cible }, 'info', 'headers')
      : dire('redirectionSansCible', { statut, phrase }, 'warn', 'headers');
  }
  if (statut >= 400) {
    const ton = statut >= 500 ? 'ko' : 'warn';
    const probleme = lireProbleme(texteDe(rec.responseBody), rec.mime);
    if (probleme && probleme.title) return dire('probleme', { statut, phrase, titre: probleme.title }, ton, 'response');
    return dire(statut >= 500 ? 'erreurServeur' : 'refusee', { statut, phrase }, ton, rec.responseBody ? 'response' : null);
  }
  return dire('statutSeul', { statut }, 'info');
}

/** La ligne des alertes, quand l analyseur en a trouve. */
export function alertesDe(rec) {
  const a = rec.analysis;
  if (!a || !Array.isArray(a.findings) || !a.findings.length) return null;
  const grave = a.findings.some(f => f.severity === 'critical' || f.severity === 'high');
  return { cle: 'alertes', texte: VERDICTS.alertes, valeurs: { n: a.findings.length }, ton: grave ? 'ko' : 'warn', onglet: 'analysis', aTraduire: [] };
}
