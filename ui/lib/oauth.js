/* OAuth 2.0 et OpenID Connect — INTERCEPTOR (by NeoZ)
 *
 * Une connexion « avec Google », « avec GitHub », un SSO d entreprise : ce
 * sont des echanges OAuth 2.0, souvent OpenID Connect. On les reconnait a
 * leurs parametres normalises, et on dit ce qu ils contiennent — le flux, le
 * client, l URL de retour, la protection contre la falsification de requete —
 * puis ce que les RFC en disent, reference a l appui :
 *
 *   RFC 6749   OAuth 2.0
 *   RFC 7636   PKCE
 *   RFC 9700   OAuth 2.0 Security Best Current Practice (janvier 2025)
 *
 * Ce sont des FAITS, pas des alertes : un client confidentiel sans PKCE n est
 * pas vulnerable a coup sur ; la RFC le recommande, et c est ce qui est dit.
 * Aucune valeur secrete n est reproduite ici : on dit qu elle est presente.
 */

const LOCALE = /^(localhost|127(?:\.\d+){3}|\[::1\])$/i;

/* Les phrases de ce module, gabarits traduits a l affichage. */
export const FAITS_OAUTH = {
  implicite: 'response_type={rt} delivre un jeton dans la reponse d autorisation : la RFC 9700 (2.1.2) recommande de ne plus employer ce flux',
  sansPkce: 'aucun code_challenge : PKCE n est pas employe, alors que la RFC 9700 (2.1.1) l impose aux clients publics et le recommande a tous',
  plain: 'code_challenge_method=plain : la RFC 7636 (4.2) impose S256 des que le client en est capable',
  methodeParDefaut: 'code_challenge sans code_challenge_method : la methode vaut alors plain (RFC 7636, 4.3)',
  sansCsrf: 'ni state, ni PKCE, ni nonce : aucune protection contre la falsification de requete n est visible dans cette demande (RFC 9700, 2.1)',
  retourEnClair: 'redirect_uri en http : ce qui revient au client transite en clair (RFC 6749, 3.1.2.1)',
  motDePasse: 'grant_type=password : la RFC 9700 (2.4) interdit ce flux, qui confie le mot de passe au client',
  verifierPresent: 'code_verifier present : la demande de jeton prouve la possession du code (PKCE)',
  secretPresent: 'client_secret envoye dans le corps : client confidentiel',
  rafraichissement: 'un refresh_token est delivre : il permet d obtenir de nouveaux jetons sans l utilisateur',
  jetonIdentite: 'un id_token (JWT) est delivre : c est une reponse OpenID Connect'
};

function parametresUrl(url) {
  try { return new URL(url).searchParams; } catch { return new URLSearchParams(); }
}

function parametresCorps(corps) {
  if (!corps) return new URLSearchParams();
  if (corps.kind === 'formData' && corps.formData) {
    const p = new URLSearchParams();
    for (const [k, vs] of Object.entries(corps.formData)) for (const v of vs) p.append(k, String(v));
    return p;
  }
  if (typeof corps.text === 'string' && /x-www-form-urlencoded/i.test(String(corps.contentType || ''))) {
    return new URLSearchParams(corps.text);
  }
  return new URLSearchParams();
}

function hoteLocal(url) {
  try { return LOCALE.test(new URL(url).hostname); } catch { return false; }
}

/** Demande d autorisation : response_type et client_id, dans l URL. */
function autorisation(p) {
  if (!p.has('response_type') || !p.has('client_id')) return null;
  const rt = p.get('response_type');
  const types = rt.split(/\s+/);
  const scope = p.get('scope') || '';
  const out = {
    genre: 'autorisation',
    oidc: /\bopenid\b/.test(scope),
    champs: {
      response_type: rt, client_id: p.get('client_id'), redirect_uri: p.get('redirect_uri'),
      scope: scope || null, response_mode: p.get('response_mode'), prompt: p.get('prompt'),
      state: p.has('state') ? 'present' : null, nonce: p.has('nonce') ? 'present' : null,
      code_challenge: p.has('code_challenge') ? 'present' : null,
      code_challenge_method: p.get('code_challenge_method')
    },
    faits: []
  };
  const dire = (texte, valeurs = {}) => out.faits.push({ texte, valeurs });
  if (types.includes('token')) dire(FAITS_OAUTH.implicite, { rt });
  if (types.includes('code')) {
    if (!p.has('code_challenge')) dire(FAITS_OAUTH.sansPkce);
    else if (!p.has('code_challenge_method')) dire(FAITS_OAUTH.methodeParDefaut);
    else if (p.get('code_challenge_method') === 'plain') dire(FAITS_OAUTH.plain);
  }
  if (!p.has('state') && !p.has('code_challenge') && !p.has('nonce')) dire(FAITS_OAUTH.sansCsrf);
  const retour = p.get('redirect_uri');
  if (retour && /^http:/i.test(retour) && !hoteLocal(retour)) dire(FAITS_OAUTH.retourEnClair);
  return out;
}

/** Demande de jeton : grant_type dans un corps de formulaire. */
function demandeJeton(p) {
  if (!p.has('grant_type')) return null;
  const out = {
    genre: 'jeton',
    champs: {
      grant_type: p.get('grant_type'), client_id: p.get('client_id'), redirect_uri: p.get('redirect_uri'),
      scope: p.get('scope'), code: p.has('code') ? 'present' : null,
      code_verifier: p.has('code_verifier') ? 'present' : null,
      client_secret: p.has('client_secret') ? 'present' : null,
      refresh_token: p.has('refresh_token') ? 'present' : null
    },
    faits: []
  };
  const dire = texte => out.faits.push({ texte, valeurs: {} });
  if (p.get('grant_type') === 'password') dire(FAITS_OAUTH.motDePasse);
  if (p.has('code_verifier')) dire(FAITS_OAUTH.verifierPresent);
  if (p.has('client_secret')) dire(FAITS_OAUTH.secretPresent);
  return out;
}

/** Reponse de jeton : un objet JSON avec access_token et token_type (RFC 6749, 5.1). */
function reponseJeton(corps) {
  if (!corps || typeof corps.text !== 'string') return null;
  let j;
  try { j = JSON.parse(corps.text); } catch { return null; }
  if (!j || typeof j !== 'object' || typeof j.access_token !== 'string' || typeof j.token_type !== 'string') return null;
  const out = {
    genre: 'reponse',
    champs: {
      token_type: j.token_type,
      expires_in: Number.isFinite(Number(j.expires_in)) ? Number(j.expires_in) : null,
      scope: typeof j.scope === 'string' ? j.scope : null,
      refresh_token: typeof j.refresh_token === 'string' ? 'present' : null,
      id_token: typeof j.id_token === 'string' ? 'present' : null
    },
    idToken: typeof j.id_token === 'string' ? j.id_token : null,
    faits: []
  };
  if (out.champs.refresh_token) out.faits.push({ texte: FAITS_OAUTH.rafraichissement, valeurs: {} });
  if (out.champs.id_token) out.faits.push({ texte: FAITS_OAUTH.jetonIdentite, valeurs: {} });
  return out;
}

/**
 * Ce qu un enregistrement montre d OAuth, ou null.
 * @returns { demande, reponse } — l un ou l autre peut etre null
 */
export function lireOAuth(rec) {
  const demande = autorisation(parametresUrl(rec.url)) || demandeJeton(parametresCorps(rec.requestBody));
  const reponse = reponseJeton(rec.responseBody);
  return demande || reponse ? { demande, reponse } : null;
}
