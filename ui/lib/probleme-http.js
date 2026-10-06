/* Problemes HTTP (RFC 9457) — SWIFT (by NeoZ)
 *
 * Une API qui echoue peut decrire l erreur dans une forme normalisee,
 * application/problem+json : type, title, status, detail, instance, et des
 * membres propres au type de probleme. Ce module la lit, et confronte le
 * membre status au statut HTTP reellement servi.
 *
 * Source, lue dans le texte : RFC 9457
 *   §3.1    un membre dont la valeur n a pas le type prevu est ignore
 *   §3.1.1  type absent : il vaut « about:blank » ; relatif, il se resout
 *           sur l adresse du document
 *   §3.1.2  status n est que consultatif, et le serveur doit servir le meme
 *           code dans la reponse HTTP
 *   §4.2.1  about:blank : aucun sens au-dela du code HTTP, et le titre
 *           devrait reprendre la phrase du statut, eventuellement traduite
 */
import { STATUTS } from './ref-http.js';

const PHRASES = new Map(STATUTS.map(s => [s.code, s.nom]));
const MEMBRES = new Set(['type', 'title', 'status', 'detail', 'instance']);

/* Les phrases des faits, traduites a l affichage : exportees pour que le
   controle de traduction les verifie une a une. */
export const FAITS_PROBLEME = {
  typeAbsent: 'aucun membre type : il vaut alors about:blank (RFC 9457 §3.1.1)',
  aboutBlank: 'type about:blank : le probleme n a pas d autre sens que son code HTTP, et le titre devrait reprendre la phrase du statut, « {phrase} », eventuellement traduite (RFC 9457 §4.2.1)',
  statutDifferent: 'membre status {membre}, mais statut HTTP {statut} : le serveur doit servir le meme code que le membre status (RFC 9457 §3.1.2)',
  typeRelatif: 'type relatif, resolu sur l adresse de la reponse : {resolu} (RFC 9457 §3.1.1)',
  membreIgnore: 'membre {nom} ignore : sa valeur n a pas le type prevu (RFC 9457 §3.1)'
};

/**
 * Le probleme decrit par une reponse application/problem+json, ou null.
 * @param {string} texte
 * @param {string} typeMedia  le type declare de la reponse
 */
export function lireProbleme(texte, typeMedia) {
  const type = String(typeMedia || '').toLowerCase().split(';')[0].trim();
  if (type !== 'application/problem+json') return null;
  let v;
  try { v = JSON.parse(String(texte || '')); } catch { return null; }
  if (!v || typeof v !== 'object' || Array.isArray(v)) return null;
  const ignores = [];
  const chaine = nom => {
    if (!(nom in v)) return null;
    if (typeof v[nom] === 'string') return v[nom];
    ignores.push(nom);
    return null;
  };
  const status = !('status' in v) ? null : Number.isInteger(v.status) ? v.status : (ignores.push('status'), null);
  return {
    type: chaine('type'),
    title: chaine('title'),
    status,
    detail: chaine('detail'),
    instance: chaine('instance'),
    extensions: Object.fromEntries(Object.entries(v).filter(([k]) => !MEMBRES.has(k))),
    ignores
  };
}

/** Les faits d un probleme, confronte au statut et a l adresse de la reponse. */
export function faitsProbleme(p, { statut = null, url = '' } = {}) {
  const faits = [];
  const dire = (cle, valeurs = {}) => faits.push({ cle, texte: FAITS_PROBLEME[cle], valeurs });
  if (!p) return faits;
  for (const nom of p.ignores) dire('membreIgnore', { nom });
  if (p.type === null) dire('typeAbsent');
  if ((p.type === null || p.type === 'about:blank') && PHRASES.has(statut)) {
    dire('aboutBlank', { phrase: PHRASES.get(statut) });
  }
  if (p.status !== null && statut !== null && p.status !== statut) dire('statutDifferent', { membre: p.status, statut });
  if (p.type && p.type !== 'about:blank' && url) {
    let absolu = true;
    try { new URL(p.type); } catch { absolu = false; }
    if (!absolu) {
      try { dire('typeRelatif', { resolu: new URL(p.type, url).href }); } catch { /* adresse illisible */ }
    }
  }
  return faits;
}
