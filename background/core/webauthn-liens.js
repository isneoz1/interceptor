/* WebAuthn : ce qu une ceremonie doit a d autres lignes — INTERCEPTOR (by NeoZ)
 *
 * Une connexion par cle d acces se verifie avec la cle publique vue a
 * l INSCRIPTION de la meme cle, et son defi a ete emis par une REPONSE du
 * serveur. Les deux vivent dans d autres lignes de la capture, et dans leurs
 * corps — que seul le noyau garde : l interface ne recoit que des resumes.
 *
 * La recherche reste bon marche sur une grande capture : seuls les corps JSON
 * de taille raisonnable qui contiennent le mot attendu sont ouverts.
 */
import { store } from './store.js';
import { trouverCredential, trouverOptions, b64url, octetsDe64 } from '../../ui/lib/webauthn.js';

const TAILLE_MAX = 256 * 1024;

/* Un defi ou un identifiant ramene a une seule forme : base64url sans
   remplissage. Un serveur peut ecrire l un ou l autre en base64. */
function forme(texte) {
  try { return b64url(octetsDe64(texte)); } catch { return null; }
}

function corpsLisible(corps, mot) {
  return !!corps && typeof corps.text === 'string' && corps.text.length <= TAILLE_MAX && corps.text.includes(mot);
}

/**
 * @returns { inscription: { id, url, jwk, alg } | null, emetteur: { id, url } | null }
 */
export function liensWebAuthn(id) {
  const vide = { inscription: null, emetteur: null };
  const rec = store.get(id);
  if (!rec || !corpsLisible(rec.requestBody, 'clientDataJSON')) return vide;
  let lu = null;
  try { lu = trouverCredential(rec.requestBody.text); } catch { return vide; }
  if (!lu) return vide;

  const defi = forme(lu.client.defi);
  const identifiant = lu.genre === 'connexion' ? forme(lu.rawId || lu.id || '') : null;
  let inscription = null;
  let emetteur = null;
  for (let i = store.order.length - 1; i >= 0 && (!emetteur || (identifiant && !inscription)); i--) {
    const r = store.records.get(store.order[i]);
    if (!r || r.id === id) continue;
    if (!emetteur && defi && /json/i.test(String(r.mime || '')) && corpsLisible(r.responseBody, 'challenge')) {
      try {
        const o = trouverOptions(r.responseBody.text);
        if (o && forme(o.defi) === defi) emetteur = { id: r.id, url: r.finalUrl || r.url };
      } catch { /* corps sans options lisibles */ }
    }
    if (identifiant && !inscription && corpsLisible(r.requestBody, 'attestationObject')) {
      try {
        const ins = trouverCredential(r.requestBody.text);
        if (ins && ins.genre === 'inscription' && ins.donnees.identifiant === identifiant && ins.donnees.cle && ins.donnees.cle.jwk) {
          inscription = { id: r.id, url: r.finalUrl || r.url, jwk: ins.donnees.cle.jwk, alg: ins.donnees.cle.algNom };
        }
      } catch { /* inscription illisible */ }
    }
  }
  return { inscription, emetteur };
}
