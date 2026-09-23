/* Minutage vu par la page — INTERCEPTOR (by NeoZ)
 *
 * Resource Timing donne les phases d un chargement : attente, DNS, connexion,
 * TLS, premier octet, reception. Pour une ressource d une autre origine qui ne
 * l autorise pas, le navigateur met ces horodatages et les tailles a ZERO.
 * Ces zeros ne sont pas des mesures ; la sonde le signale par
 * `phasesFournies: false`, et ce module dit pourquoi — seulement quand les
 * en-tetes captures le prouvent.
 */
import { t } from './i18n.js';

const origineDe = u => { try { return new URL(u).origin; } catch { return null; } };

/**
 * La phrase a afficher a la place de phases ou de tailles masquees.
 *
 * La cause n est nommee que si elle est prouvee : autre origine que la page,
 * et aucun en-tete `Timing-Allow-Origin` dans la reponse capturee. Sinon on
 * dit le fait, sans lui inventer de cause.
 */
export function raisonMasque(rec) {
  const entetes = Array.isArray(rec.responseHeaders) ? rec.responseHeaders : null;
  const page = origineDe(rec.documentUrl || rec.originUrl || '');
  const cible = origineDe(rec.finalUrl || rec.url || '');
  const autorise = entetes && entetes.some(h => h && String(h.name).toLowerCase() === 'timing-allow-origin');
  if (entetes && entetes.length && !autorise && page && cible && page !== cible) {
    return t('Le navigateur masque le detail des phases et les tailles : la ressource vient d une autre origine, et sa reponse ne porte aucun en-tete Timing-Allow-Origin.');
  }
  return t('Le navigateur ne fournit pas le detail des phases ni les tailles de cette ressource.');
}
