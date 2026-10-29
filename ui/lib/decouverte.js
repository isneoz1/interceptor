/* Documents de decouverte OAuth et OpenID Connect — SWIFT (by D4RK)
 *
 * RFC 8414 et OpenID Connect Discovery 1.0 : un serveur d autorisation
 * publie, a une adresse « .well-known » derivee de son identifiant
 * d emetteur, ce qu il sait faire et ou trouver ses cles (« jwks_uri »).
 *
 * Ce document ne vaut que s il vient bien de cet emetteur : son « issuer »
 * doit etre identique a celui dont l adresse a ete derivee (RFC 8414 §3.3,
 * OpenID Connect Discovery §4.3), et c est aussi la valeur que portent les
 * jetons d identite qu il emet (« iss »). L adresse se derive de deux
 * facons quand l emetteur a un chemin : RFC 8414 §3 insere le segment
 * .well-known avant le chemin, OpenID Connect Discovery §4 l ajoute apres ;
 * pour « openid-configuration », RFC 8414 §5 admet les deux pendant la
 * transition. Un « / » final de l emetteur est retire avant la derivation :
 * l emetteur peut donc s ecrire avec ou sans.
 */

const SUFFIXES = ['openid-configuration', 'oauth-authorization-server'];

/**
 * Les emetteurs qu une adresse de decouverte designe.
 * @returns null si l adresse n en est pas une, sinon
 *          { suffixe, attendus: [{ emetteur, forme: 'insere'|'ajoute' }] }
 */
export function emetteursAttendus(adresse) {
  let u;
  try { u = new URL(adresse); } catch { return null; }
  const chemin = u.pathname;
  const origine = u.protocol + '//' + u.host;
  for (const suffixe of SUFFIXES) {
    const segment = '/.well-known/' + suffixe;
    const attendus = [];
    if (chemin === segment || chemin.startsWith(segment + '/')) {
      attendus.push({ emetteur: origine + chemin.slice(segment.length), forme: 'insere' });
    }
    if (chemin.endsWith(segment) && chemin !== segment) {
      attendus.push({ emetteur: origine + chemin.slice(0, -segment.length), forme: 'ajoute' });
    }
    if (attendus.length) return { suffixe, attendus };
  }
  return null;
}

/* L emetteur compare, « / » final mis a part : il est retire avant la
   derivation (RFC 8414 §3, OpenID Connect Discovery §4). */
const sansBarreFinale = s => (s.length > 1 && s.endsWith('/') ? s.slice(0, -1) : s);

/* Une URL https sans requete ni fragment, comme l exigent RFC 8414 §2 et
   OpenID Connect Discovery §3 pour l emetteur. */
function emetteurBienForme(s) {
  let u;
  try { u = new URL(s); } catch { return false; }
  return u.protocol === 'https:' && !u.search && !u.hash && !s.includes('?') && !s.includes('#');
}

const estHttps = s => {
  try { return new URL(s).protocol === 'https:'; } catch { return false; }
};

/* Les adresses que le document doit donner en https, et ce qui l exige. */
const EN_HTTPS = [
  ['jwks_uri', 'RFC 8414 §2, OpenID Connect Discovery §3', true],
  ['authorization_endpoint', 'OpenID Connect Discovery §3', false],
  ['token_endpoint', 'OpenID Connect Discovery §3', false],
  ['userinfo_endpoint', 'OpenID Connect Discovery §3', false],
  ['registration_endpoint', 'OpenID Connect Discovery §3', false]
];

/* Les membres exiges par OpenID Connect Discovery §3. */
const EXIGES_OIDC = ['authorization_endpoint', 'jwks_uri', 'response_types_supported',
  'subject_types_supported', 'id_token_signing_alg_values_supported'];

/* Ce que le document montre, dans cet ordre. */
export const CHAMPS_DECOUVERTE = ['issuer', 'authorization_endpoint', 'token_endpoint', 'userinfo_endpoint',
  'jwks_uri', 'registration_endpoint', 'end_session_endpoint', 'revocation_endpoint', 'introspection_endpoint',
  'pushed_authorization_request_endpoint', 'device_authorization_endpoint',
  'scopes_supported', 'response_types_supported', 'grant_types_supported', 'subject_types_supported',
  'id_token_signing_alg_values_supported', 'token_endpoint_auth_methods_supported',
  'code_challenge_methods_supported', 'claims_supported'];

/**
 * Lit un document de decouverte capture.
 * @returns null si l adresse ou le corps n en est pas un, sinon
 *          { suffixe, oidc, issuer, conforme, attendus, champs, faits }
 */
export function lireDecouverte(adresse, texte) {
  const lieu = emetteursAttendus(adresse);
  if (!lieu) return null;
  let doc;
  try { doc = JSON.parse(texte); } catch { return null; }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return null;
  const oidc = lieu.suffixe === 'openid-configuration';
  const issuer = typeof doc.issuer === 'string' ? doc.issuer : null;
  const faits = [];
  const fait = (texte, valeurs = {}, grave = false) => faits.push({ texte, valeurs, grave });

  const conforme = issuer !== null
    && lieu.attendus.some(a => sansBarreFinale(a.emetteur) === sansBarreFinale(issuer));
  if (issuer === null) {
    fait('issuer absent : il est exige ({ref})', { ref: oidc ? 'OpenID Connect Discovery §3' : 'RFC 8414 §2' }, true);
  } else if (!conforme) {
    fait('issuer « {issuer} » : ce document a ete lu a une adresse qui designe {attendu} — il ne doit pas etre utilise ({ref})', {
      issuer, attendu: lieu.attendus.map(a => a.emetteur).join(' | '),
      ref: oidc ? 'OpenID Connect Discovery §4.3, RFC 8414 §3.3' : 'RFC 8414 §3.3'
    }, true);
  }
  if (issuer !== null && !emetteurBienForme(issuer)) {
    fait('issuer « {issuer} » : une URL https sans requete ni fragment est exigee ({ref})',
      { issuer, ref: oidc ? 'OpenID Connect Discovery §3' : 'RFC 8414 §2' }, true);
  }
  if (!oidc && lieu.attendus.every(a => a.forme === 'ajoute')) {
    fait('ce document est publie apres le chemin de l emetteur : RFC 8414 §3 place « .well-known » avant lui');
  }
  for (const [nom, ref, pourTous] of EN_HTTPS) {
    if (typeof doc[nom] !== 'string' || (!pourTous && !oidc)) continue;
    if (!estHttps(doc[nom])) fait('{nom} « {valeur} » : cette adresse doit etre en https ({ref})', { nom, valeur: doc[nom], ref }, true);
  }
  if (oidc) {
    for (const nom of EXIGES_OIDC) if (doc[nom] === undefined) fait('{nom} absent : il est exige (OpenID Connect Discovery §3)', { nom }, true);
    const algs = Array.isArray(doc.id_token_signing_alg_values_supported) ? doc.id_token_signing_alg_values_supported : null;
    if (algs && !algs.includes('RS256')) fait('id_token_signing_alg_values_supported ne contient pas RS256, qui doit y figurer (OpenID Connect Discovery §3)', {}, true);
    if (algs && algs.includes('none')) {
      fait('« none » figure parmi les algorithmes des jetons d identite : permis, mais jamais pour un jeton remis par le point d autorisation (OpenID Connect Discovery §3)');
    }
  } else if (doc.response_types_supported === undefined) {
    fait('response_types_supported absent : il est exige (RFC 8414 §2)', {}, true);
  }
  const pkce = doc.code_challenge_methods_supported;
  if (pkce === undefined) {
    fait('code_challenge_methods_supported absent : le serveur annonce ainsi qu il ne prend pas en charge PKCE (RFC 8414 §2)');
  } else if (Array.isArray(pkce) && !pkce.includes('S256')) {
    fait('code_challenge_methods_supported sans « S256 », que tout serveur doit prendre en charge (RFC 7636 §4.2)', {}, true);
  }
  const champs = {};
  for (const nom of CHAMPS_DECOUVERTE) if (doc[nom] !== undefined) champs[nom] = doc[nom];
  return { suffixe: lieu.suffixe, oidc, issuer, conforme, attendus: lieu.attendus, champs, faits };
}
