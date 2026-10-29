/* Les cles d un emetteur de jetons, dans la capture — SWIFT (by D4RK)
 *
 * Un jeton signe se verifie avec la cle publique de son emetteur. Cet
 * emetteur la publie dans un jeu de cles (JWKS), a l adresse que donne son
 * document de decouverte (« jwks_uri », RFC 8414, OpenID Connect Discovery) :
 * deux reponses que le navigateur a souvent recues pendant la connexion, et
 * dont seul le noyau garde les corps — l interface ne recoit que des resumes.
 *
 * Le document de decouverte relie un emetteur (« iss ») a son jeu de cles ;
 * un jeu capture ailleurs peut aussi contenir la bonne cle, mais rien ne le
 * relie a l emetteur, et l interface le dit. Seuls les corps de taille
 * raisonnable qui contiennent les mots attendus sont ouverts.
 */
import { store } from './store.js';
import { lireJwks } from '../../ui/lib/jwks.js';
import { lireDecouverte } from '../../ui/lib/decouverte.js';

const TAILLE_MAX = 256 * 1024;
const JEUX_MAX = 20;

function corps(r) {
  const c = r && r.responseBody;
  return c && typeof c.text === 'string' && c.text.length <= TAILLE_MAX ? c.text : null;
}

/**
 * @param iss  l emetteur annonce par le jeton, s il en annonce un
 * @returns { decouverte: { id, url, jwksUri, conforme } | null,
 *            jeux: [{ id, url, at, deLEmetteur, keys }] } — du plus recent au plus ancien
 */
export function clesJose({ iss } = {}) {
  const emetteur = typeof iss === 'string' && iss ? iss : null;
  let decouverte = null;
  const jeux = [];
  for (let i = store.order.length - 1; i >= 0; i--) {
    const r = store.records.get(store.order[i]);
    const texte = corps(r);
    if (!texte) continue;
    const adresse = r.finalUrl || r.url;
    if (emetteur && !decouverte && texte.includes('"issuer"') && adresse.includes('/.well-known/')) {
      const d = lireDecouverte(adresse, texte);
      if (d && d.issuer === emetteur) {
        decouverte = { id: r.id, url: adresse, jwksUri: typeof d.champs.jwks_uri === 'string' ? d.champs.jwks_uri : null, conforme: d.conforme };
      }
    }
    if (jeux.length < JEUX_MAX && texte.includes('"keys"') && texte.includes('"kty"')) {
      const jeu = lireJwks(texte);
      if (jeu && jeu.cles.length) jeux.push({ id: r.id, url: adresse, at: r.startTime || null, deLEmetteur: false, keys: jeu.cles.map(c => c.jwk) });
    }
  }
  if (decouverte && decouverte.jwksUri) {
    for (const jeu of jeux) jeu.deLEmetteur = jeu.url === decouverte.jwksUri;
  }
  return { decouverte, jeux };
}
