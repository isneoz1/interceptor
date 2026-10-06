/* WebAuthn et cles d acces (passkeys) — SWIFT (by NeoZ)
 *
 * Une inscription ou une connexion par cle d acces traverse le reseau sous la
 * forme d un JSON dont les morceaux sont du base64url opaque :
 *
 *   clientDataJSON      ce que le navigateur a signe : type, defi, origine
 *   authenticatorData   ce que l authentificateur atteste : empreinte du
 *                       domaine (rpIdHash), drapeaux, compteur, et a
 *                       l inscription la cle publique (COSE)
 *   attestationObject   a l inscription : format d attestation et preuve
 *   signature           a la connexion : signature de
 *                       authenticatorData || SHA-256(clientDataJSON)
 *
 * On les ouvre (W3C Web Authentication, niveau 3, sections 5.8.1, 6.1, 6.5).
 * Tout ce qui est dit se constate sur les octets : l empreinte du domaine est
 * recalculee, la signature verifiee par crypto.subtle avec la cle publique
 * vue a l inscription. Rien n est suppose sur le serveur, qui seul decide.
 */
import { decoderCborBrut, lireCborPartiel } from './binaires.js';
import { octetsVersHex, octetsVersBase64 } from './bytes.js';
import { sujetCrypto, importerClePublique } from './cles-publiques.js';

/* Registre IANA des algorithmes COSE (valeurs de signature). */
export const ALGORITHMES_COSE = {
  '-7': 'ES256', '-8': 'EdDSA', '-9': 'ESP256', '-19': 'Ed25519', '-35': 'ES384', '-36': 'ES512',
  '-37': 'PS256', '-38': 'PS384', '-39': 'PS512', '-47': 'ES256K', '-51': 'ESP384', '-52': 'ESP512',
  '-53': 'Ed448', '-257': 'RS256', '-258': 'RS384', '-259': 'RS512', '-65535': 'RS1'
};

/* Drapeaux de authenticatorData (6.1). Les bits 1 et 5 sont reserves. */
export const DRAPEAUX = [
  [0x01, 'UP', 'utilisateur present'],
  [0x04, 'UV', 'utilisateur verifie'],
  [0x08, 'BE', 'cle sauvegardable'],
  [0x10, 'BS', 'cle sauvegardee'],
  [0x40, 'AT', 'cle publique jointe'],
  [0x80, 'ED', 'extensions jointes']
];

export const FAITS_WEBAUTHN = {
  rpId: 'rpIdHash = SHA-256 de « {rp} »',
  rpInconnu: 'rpIdHash ne correspond ni a {hote} ni a un de ses domaines parents',
  upAbsent: 'presence de l utilisateur non attestee (drapeau UP absent)',
  uvAbsent: 'utilisateur non verifie (drapeau UV absent) : seule sa presence est attestee',
  synchronisee: 'cle sauvegardee hors de l appareil (drapeaux BE et BS) : une cle synchronisee',
  compteurNul: 'compteur de signatures a 0 : cet authentificateur n en tient pas',
  typeInattendu: 'type {type} dans clientDataJSON, alors que {attendu} est attendu',
  attestationAucune: 'aucune attestation (format « none ») : le modele de l authentificateur n est pas prouve',
  aaguidNul: 'AAGUID nul : le modele de l authentificateur n est pas annonce',
  idDiffere: 'l identifiant annonce differe de celui que portent les donnees de l authentificateur',
  croise: 'ceremonie lancee depuis un cadre d une autre origine (crossOrigin)',
  defiCourt: 'defi de {n} octets : la specification en demande au moins 16 (WebAuthn, 13.4.3)',
  uvDecourage: 'le serveur ne demande pas la verification de l utilisateur (userVerification « discouraged »)',
  bitsReserves: 'bits reserves des drapeaux mis a 1 : {bits}'
};

/* ------------------------------- Decodage --------------------------------- */
/** base64url ou base64, avec ou sans remplissage. */
export function octetsDe64(texte) {
  const net = String(texte).trim().replace(/-/g, '+').replace(/_/g, '/').replace(/\s+/g, '');
  const binaire = atob(net + '='.repeat((4 - (net.length % 4)) % 4));
  return Uint8Array.from(binaire, c => c.charCodeAt(0));
}
export const b64url = octets => octetsVersBase64(octets).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

function uuid(octets) {
  const h = octetsVersHex(octets);
  return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
}

/** clientDataJSON (5.8.1). */
export function lireDonneesClient(octets) {
  const texte = new TextDecoder('utf-8', { fatal: true }).decode(octets);
  const j = JSON.parse(texte);
  if (!j || typeof j.type !== 'string' || typeof j.challenge !== 'string') {
    throw new Error('clientDataJSON sans type ni defi');
  }
  return {
    type: j.type, defi: j.challenge, defiOctets: octetsDe64(j.challenge),
    origine: typeof j.origin === 'string' ? j.origin : null,
    croise: j.crossOrigin === true, origineHaute: typeof j.topOrigin === 'string' ? j.topOrigin : null,
    texte
  };
}

const COURBES = { 1: 'P-256', 2: 'P-384', 3: 'P-521', 6: 'Ed25519', 7: 'Ed448' };

/** Une cle COSE (RFC 9052, 7 ; RFC 9053) vers ses champs et sa JWK. */
export function lireCleCose(carte) {
  if (!(carte instanceof Map)) throw new Error('cle COSE : carte attendue');
  const kty = carte.get(1);
  const alg = carte.get(3);
  const cle = { kty, alg, algNom: ALGORITHMES_COSE[String(alg)] || null, crv: null, jwk: null };
  if (kty === 2) {
    cle.crv = COURBES[carte.get(-1)] || null;
    const x = carte.get(-2);
    const y = carte.get(-3);
    if (cle.crv && x instanceof Uint8Array && y instanceof Uint8Array) {
      cle.jwk = { kty: 'EC', crv: cle.crv, x: b64url(x), y: b64url(y) };
    }
  } else if (kty === 1) {
    cle.crv = COURBES[carte.get(-1)] || null;
    const x = carte.get(-2);
    if (cle.crv && x instanceof Uint8Array) cle.jwk = { kty: 'OKP', crv: cle.crv, x: b64url(x) };
  } else if (kty === 3) {
    const n = carte.get(-1);
    const e = carte.get(-2);
    if (n instanceof Uint8Array && e instanceof Uint8Array) cle.jwk = { kty: 'RSA', n: b64url(n), e: b64url(e) };
  }
  return cle;
}

/** authenticatorData (6.1). */
export function lireDonneesAuthentificateur(octets) {
  if (octets.length < 37) throw new Error('authenticatorData de ' + octets.length + ' octets : 37 au minimum');
  const flags = octets[32];
  const drapeaux = {};
  for (const [bit, nom] of DRAPEAUX) drapeaux[nom] = !!(flags & bit);
  const compteur = ((octets[33] << 24) >>> 0) + (octets[34] << 16) + (octets[35] << 8) + octets[36];
  const lu = {
    rpIdHash: octetsVersHex(octets.subarray(0, 32)), drapeaux, octetDrapeaux: flags,
    bitsReserves: flags & 0x22, compteur, aaguid: null, identifiant: null, cle: null, extensions: null
  };
  let pos = 37;
  if (drapeaux.AT) {
    if (octets.length < pos + 18) throw new Error('donnees d identifiant tronquees');
    lu.aaguid = uuid(octets.subarray(pos, pos + 16));
    const longueur = (octets[pos + 16] << 8) + octets[pos + 17];
    pos += 18;
    if (octets.length < pos + longueur) throw new Error('identifiant de credential tronque');
    lu.identifiant = b64url(octets.subarray(pos, pos + longueur));
    pos += longueur;
    const { valeur, fin } = lireCborPartiel(octets, pos);
    lu.cle = lireCleCose(valeur);
    pos = fin;
  }
  if (drapeaux.ED) {
    const { valeur, fin } = lireCborPartiel(octets, pos);
    lu.extensions = valeur instanceof Map ? [...valeur.keys()].map(String) : [];
    pos = fin;
  }
  if (pos !== octets.length) throw new Error((octets.length - pos) + ' octets en trop dans authenticatorData');
  return lu;
}

/** attestationObject (6.5) : format, preuve, et les donnees de l authentificateur. */
export function lireObjetAttestation(octets) {
  const carte = decoderCborBrut(octets);
  if (!(carte instanceof Map) || typeof carte.get('fmt') !== 'string' || !(carte.get('authData') instanceof Uint8Array)) {
    throw new Error('attestationObject sans fmt ni authData');
  }
  const stmt = carte.get('attStmt');
  const preuve = {};
  if (stmt instanceof Map) {
    if (typeof stmt.get('alg') === 'number') {
      preuve.alg = stmt.get('alg');
      preuve.algNom = ALGORITHMES_COSE[String(stmt.get('alg'))] || null;
    }
    if (Array.isArray(stmt.get('x5c'))) preuve.certificats = stmt.get('x5c').length;
    if (stmt.get('sig') instanceof Uint8Array) preuve.signee = true;
  }
  return { format: carte.get('fmt'), preuve, donnees: lireDonneesAuthentificateur(carte.get('authData')) };
}

/* ------------------------------ Reconnaissance ---------------------------- */
function chercher(valeur, test, profondeur = 0) {
  if (!valeur || typeof valeur !== 'object' || profondeur > 4) return null;
  if (test(valeur)) return valeur;
  for (const v of Array.isArray(valeur) ? valeur : Object.values(valeur)) {
    const trouve = chercher(v, test, profondeur + 1);
    if (trouve) return trouve;
  }
  return null;
}

const estCredential = o => o.response && typeof o.response === 'object'
  && typeof o.response.clientDataJSON === 'string'
  && (typeof o.response.attestationObject === 'string' || typeof o.response.authenticatorData === 'string');

const estOptions = o => typeof o.challenge === 'string'
  && ((o.rp && o.user && Array.isArray(o.pubKeyCredParams))
    || (!o.user && ('allowCredentials' in o || 'rpId' in o || 'userVerification' in o)));

/** Un texte JSON, lu sans lever. */
function json(texte) {
  if (typeof texte !== 'string' || texte.length > 1_000_000) return null;
  const t = texte.trim();
  if (!t.startsWith('{') && !t.startsWith('[')) return null;
  try { return JSON.parse(t); } catch { return null; }
}

/** Une reponse d authentificateur (PublicKeyCredential en JSON), lue. */
export function lireCredential(o) {
  const r = o.response;
  const client = lireDonneesClient(octetsDe64(r.clientDataJSON));
  const lu = {
    genre: typeof r.attestationObject === 'string' ? 'inscription' : 'connexion',
    id: typeof o.id === 'string' ? o.id : null,
    rawId: typeof o.rawId === 'string' ? o.rawId : null,
    client, clientOctets: octetsDe64(r.clientDataJSON),
    attachement: typeof o.authenticatorAttachment === 'string' ? o.authenticatorAttachment : null,
    transports: Array.isArray(r.transports) ? r.transports.filter(x => typeof x === 'string') : [],
    attestation: null, donnees: null, donneesOctets: null, signature: null, utilisateur: null
  };
  if (lu.genre === 'inscription') {
    lu.attestation = lireObjetAttestation(octetsDe64(r.attestationObject));
    lu.donnees = lu.attestation.donnees;
  } else {
    lu.donneesOctets = octetsDe64(r.authenticatorData);
    lu.donnees = lireDonneesAuthentificateur(lu.donneesOctets);
    if (typeof r.signature === 'string') lu.signature = octetsDe64(r.signature);
    if (typeof r.userHandle === 'string' && r.userHandle) lu.utilisateur = r.userHandle;
  }
  return lu;
}

/** Cherche une ceremonie WebAuthn dans un corps de requete. */
export function trouverCredential(texte) {
  const o = chercher(json(texte), estCredential);
  return o ? lireCredential(o) : null;
}

/** Cherche des options de creation ou de connexion dans un corps de reponse. */
export function trouverOptions(texte) {
  const o = chercher(json(texte), estOptions);
  if (!o) return null;
  const creation = !!o.user;
  let defiOctets = null;
  try { defiOctets = octetsDe64(o.challenge); } catch { /* defi illisible : on le montre tel quel */ }
  const selection = o.authenticatorSelection && typeof o.authenticatorSelection === 'object' ? o.authenticatorSelection : {};
  const uv = creation ? selection.userVerification : o.userVerification;
  const faits = [];
  if (defiOctets && defiOctets.length < 16) faits.push({ texte: FAITS_WEBAUTHN.defiCourt, valeurs: { n: defiOctets.length } });
  if (uv === 'discouraged') faits.push({ texte: FAITS_WEBAUTHN.uvDecourage, valeurs: {} });
  return {
    genre: creation ? 'creation' : 'connexion', defi: o.challenge,
    rp: creation ? (o.rp.id || o.rp.name || null) : (o.rpId || null),
    utilisateur: creation && o.user ? (o.user.name || o.user.displayName || null) : null,
    algorithmes: creation ? o.pubKeyCredParams.map(p => ALGORITHMES_COSE[String(p && p.alg)] || String(p && p.alg)) : [],
    verification: uv || null,
    residente: creation ? (selection.residentKey || (selection.requireResidentKey ? 'required' : null)) : null,
    attestation: creation ? (o.attestation || null) : null,
    delai: typeof o.timeout === 'number' ? o.timeout : null,
    autorises: Array.isArray(o.allowCredentials) ? o.allowCredentials.length : null,
    exclus: Array.isArray(o.excludeCredentials) ? o.excludeCredentials.length : null,
    faits
  };
}

/* --------------------------------- Faits ---------------------------------- */
async function sha256Hex(texte) {
  const tampon = await sujetCrypto().digest('SHA-256', new TextEncoder().encode(texte));
  return octetsVersHex(new Uint8Array(tampon));
}

/** Le domaine dont rpIdHash est l empreinte, parmi l hote de l origine et ses parents. */
export async function trouverRpId(rpIdHash, origine) {
  let hote;
  try { hote = new URL(origine).hostname; } catch { return { hote: null, rp: null }; }
  const labels = hote.split('.');
  for (let i = 0; i < labels.length; i++) {
    const candidat = labels.slice(i).join('.');
    if (await sha256Hex(candidat) === rpIdHash) return { hote, rp: candidat };
  }
  return { hote, rp: null };
}

/** Les faits d une ceremonie lue. */
export async function faitsCeremonie(lu) {
  const faits = [];
  const d = lu.donnees;
  const attendu = lu.genre === 'inscription' ? 'webauthn.create' : 'webauthn.get';
  if (lu.client.type !== attendu) faits.push({ texte: FAITS_WEBAUTHN.typeInattendu, valeurs: { type: lu.client.type, attendu } });
  if (lu.client.origine) {
    const { hote, rp } = await trouverRpId(d.rpIdHash, lu.client.origine);
    if (rp) faits.push({ texte: FAITS_WEBAUTHN.rpId, valeurs: { rp } });
    else if (hote) faits.push({ texte: FAITS_WEBAUTHN.rpInconnu, valeurs: { hote } });
  }
  if (lu.client.croise) faits.push({ texte: FAITS_WEBAUTHN.croise, valeurs: {} });
  if (!d.drapeaux.UP) faits.push({ texte: FAITS_WEBAUTHN.upAbsent, valeurs: {} });
  if (!d.drapeaux.UV) faits.push({ texte: FAITS_WEBAUTHN.uvAbsent, valeurs: {} });
  if (d.drapeaux.BE && d.drapeaux.BS) faits.push({ texte: FAITS_WEBAUTHN.synchronisee, valeurs: {} });
  if (d.bitsReserves) faits.push({ texte: FAITS_WEBAUTHN.bitsReserves, valeurs: { bits: '0x' + d.bitsReserves.toString(16) } });
  /* Un compteur s incremente a chaque connexion (6.1.1) : a 0 lors d une
     connexion, il n existe pas. A l inscription, 0 ne dit rien. */
  if (lu.genre === 'connexion' && d.compteur === 0) faits.push({ texte: FAITS_WEBAUTHN.compteurNul, valeurs: {} });
  if (lu.attestation && lu.attestation.format === 'none') faits.push({ texte: FAITS_WEBAUTHN.attestationAucune, valeurs: {} });
  if (d.aaguid && /^[0-]+$/.test(d.aaguid)) faits.push({ texte: FAITS_WEBAUTHN.aaguidNul, valeurs: {} });
  if (d.identifiant && ((lu.rawId && lu.rawId.replace(/=+$/, '') !== d.identifiant)
    || (lu.id && lu.id.replace(/=+$/, '') !== d.identifiant))) {
    faits.push({ texte: FAITS_WEBAUTHN.idDiffere, valeurs: {} });
  }
  return faits;
}

/* ----------------------------- Boite a outils ----------------------------- */
function resumeDonnees(d) {
  const drapeaux = DRAPEAUX.filter(([, nom]) => d.drapeaux[nom]).map(([, nom]) => nom);
  return {
    rpIdHash: d.rpIdHash, flags: drapeaux, signCount: d.compteur,
    ...(d.aaguid ? { aaguid: d.aaguid, credentialId: d.identifiant } : {}),
    ...(d.cle ? { credentialPublicKey: { alg: d.cle.algNom || d.cle.alg, kty: d.cle.kty, crv: d.cle.crv, jwk: d.cle.jwk } } : {}),
    ...(d.extensions ? { extensions: d.extensions } : {})
  };
}

/**
 * Un morceau de WebAuthn colle : la reponse JSON entiere, ou un seul de
 * clientDataJSON, authenticatorData, attestationObject (base64url ou base64).
 * Les noms de champs sont ceux de la specification.
 */
export function webauthnVersTexte(texte) {
  const brut = String(texte || '').trim();
  if (!brut) throw new Error('rien a decoder');
  const credential = brut.startsWith('{') ? trouverCredential(brut) : null;
  if (credential) {
    return JSON.stringify({
      ceremony: credential.genre === 'inscription' ? 'registration' : 'authentication',
      clientData: JSON.parse(credential.client.texte),
      ...(credential.attestation ? { fmt: credential.attestation.format } : {}),
      authenticatorData: resumeDonnees(credential.donnees)
    }, null, 2);
  }
  const octets = octetsDe64(brut);
  /* Un authenticatorData commence par une empreinte : son premier octet peut
     valoir « { » par hasard. On ne retient clientDataJSON que s il se lit. */
  if (octets[0] === 0x7b) {
    try { return JSON.stringify({ clientData: JSON.parse(lireDonneesClient(octets).texte) }, null, 2); }
    catch { /* pas un clientDataJSON */ }
  }
  try {
    const att = lireObjetAttestation(octets);
    return JSON.stringify({ fmt: att.format, attStmt: att.preuve, authenticatorData: resumeDonnees(att.donnees) }, null, 2);
  } catch { /* pas un attestationObject : peut-etre authenticatorData seul */ }
  return JSON.stringify({ authenticatorData: resumeDonnees(lireDonneesAuthentificateur(octets)) }, null, 2);
}

/* ------------------------------ Verification ------------------------------ */
/* ECDSA : WebAuthn transporte la signature en DER (6.5.6), crypto.subtle
   l attend en r||s de taille fixe. */
function derVersBrut(der, taille) {
  let i = 0;
  const lireLongueur = () => {
    let n = der[i++];
    if (n & 0x80) { const k = n & 0x7f; n = 0; for (let j = 0; j < k; j++) n = (n << 8) | der[i++]; }
    return n;
  };
  if (der[i++] !== 0x30) throw new Error('signature ECDSA : SEQUENCE DER attendue');
  lireLongueur();
  const entier = () => {
    if (der[i++] !== 0x02) throw new Error('signature ECDSA : INTEGER DER attendu');
    const n = lireLongueur();
    let v = der.subarray(i, i + n);
    i += n;
    while (v.length > taille && v[0] === 0) v = v.subarray(1);
    if (v.length > taille) throw new Error('signature ECDSA : entier trop long');
    const out = new Uint8Array(taille);
    out.set(v, taille - v.length);
    return out;
  };
  const r = entier();
  const s = entier();
  const brut = new Uint8Array(taille * 2);
  brut.set(r, 0);
  brut.set(s, taille);
  return brut;
}

const PARAMETRES = {
  ES256: { cle: { name: 'ECDSA', namedCurve: 'P-256' }, verif: { name: 'ECDSA', hash: 'SHA-256' }, der: 32 },
  ESP256: { cle: { name: 'ECDSA', namedCurve: 'P-256' }, verif: { name: 'ECDSA', hash: 'SHA-256' }, der: 32 },
  ES384: { cle: { name: 'ECDSA', namedCurve: 'P-384' }, verif: { name: 'ECDSA', hash: 'SHA-384' }, der: 48 },
  ESP384: { cle: { name: 'ECDSA', namedCurve: 'P-384' }, verif: { name: 'ECDSA', hash: 'SHA-384' }, der: 48 },
  ES512: { cle: { name: 'ECDSA', namedCurve: 'P-521' }, verif: { name: 'ECDSA', hash: 'SHA-512' }, der: 66 },
  ESP512: { cle: { name: 'ECDSA', namedCurve: 'P-521' }, verif: { name: 'ECDSA', hash: 'SHA-512' }, der: 66 },
  EdDSA: { cle: { name: 'Ed25519' }, verif: { name: 'Ed25519' } },
  Ed25519: { cle: { name: 'Ed25519' }, verif: { name: 'Ed25519' } },
  RS256: { cle: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, verif: { name: 'RSASSA-PKCS1-v1_5' } },
  RS384: { cle: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-384' }, verif: { name: 'RSASSA-PKCS1-v1_5' } },
  RS512: { cle: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-512' }, verif: { name: 'RSASSA-PKCS1-v1_5' } },
  PS256: { cle: { name: 'RSA-PSS', hash: 'SHA-256' }, verif: { name: 'RSA-PSS', saltLength: 32 } },
  PS384: { cle: { name: 'RSA-PSS', hash: 'SHA-384' }, verif: { name: 'RSA-PSS', saltLength: 48 } },
  PS512: { cle: { name: 'RSA-PSS', hash: 'SHA-512' }, verif: { name: 'RSA-PSS', saltLength: 64 } }
};

/**
 * Verifie la signature d une connexion.
 * @param cle  JWK (objet) de l inscription, ou cle publique collee (PEM / JWK)
 * @param algNom  le nom COSE (ES256, EdDSA, RS256…)
 */
export async function verifierConnexion(lu, cle, algNom) {
  if (lu.genre !== 'connexion' || !lu.signature) throw new Error('aucune signature de connexion');
  const p = PARAMETRES[algNom];
  if (!p) throw new Error('algorithme non verifiable ici : ' + (algNom || 'inconnu'));
  const texteCle = typeof cle === 'string' ? cle : JSON.stringify(cle);
  let importee;
  try { importee = await importerClePublique(texteCle, p.cle); }
  catch (e) {
    if (p.cle.name === 'Ed25519' && /algorithm|not supported|NotSupported/i.test(String(e.name) + String(e.message))) {
      throw new Error('Ed25519 n est pas pris en charge par ce Firefox (il l est a partir de la version 129)');
    }
    throw e;
  }
  const empreinte = new Uint8Array(await sujetCrypto().digest('SHA-256', lu.clientOctets));
  const signe = new Uint8Array(lu.donneesOctets.length + 32);
  signe.set(lu.donneesOctets, 0);
  signe.set(empreinte, lu.donneesOctets.length);
  const signature = p.der ? derVersBrut(lu.signature, p.der) : lu.signature;
  return { valide: await sujetCrypto().verify(p.verif, importee, signature, signe), algorithme: algNom };
}
