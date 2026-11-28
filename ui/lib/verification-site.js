/* Le bilan d un site, en une verification — SWIFT (by D4RK)
 *
 * L outil « Verifier un site » envoie trois requetes — la page d accueil en
 * https, la meme en http, et /.well-known/security.txt — puis lit ce que la
 * capture en a retenu : la session TLS et le certificat, les redirections,
 * les en-tetes, les cookies poses. Ce module en fait un bilan, ligne par
 * ligne, de la meme forme que les protections d une reponse
 * (lib/protections.js) : { nom, etat, texte, valeurs }, ou `etat` vaut
 * present, partiel, absent, inoperant ou info.
 *
 * Comme le reste de SWIFT : des faits, pas une note. Une protection absente
 * n est pas une faille a elle seule, et ce qui ne se voit pas d ici — une
 * couche de capture en pause, un certificat que Firefox n a pas transmis —
 * est dit comme tel.
 */
import { lireProtections } from './protections.js';
import { lireAltSvc } from './alt-svc.js';
import { lireSecurityTxt, faitsSecurityTxt } from './security-txt.js';
import { decrireSuiteTls } from './ref-reseau.js';
import { resumerCertificat } from './asn1.js';
import { base64VersOctets } from './bytes.js';

/* Un nom d hote tel que DNS l accepte (RFC 1123 2.1), deja en punycode. Le
   soulignement est admis, que des noms de service emploient (_dmarc). */
export const NOM_HOTE = /^(?=.{1,253}$)([a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)(\.[a-z0-9_](?:[a-z0-9_-]{0,61}[a-z0-9_])?)*$/i;

/**
 * L hote a verifier, avec son port s il en a un : « example.com »,
 * « https://example.com/page » et « example.com:8443 » sont acceptes ; un nom
 * international passe en punycode.
 * @returns { nom, cible } ou null
 */
export function hoteAVerifier(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut || /\s/.test(brut)) return null;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : 'https://' + brut);
    if (!/^https?:$/.test(u.protocol) || !u.hostname) return null;
    const nom = u.hostname.replace(/^\[|\]$/g, '');
    if (!NOM_HOTE.test(nom) && !/^[0-9a-f:.]+$/i.test(nom)) return null;
    return { nom, cible: u.host };
  } catch { return null; }
}

export const FAITS_VERIFICATION = {
  joignable: 'repond {statut} en {duree} ms',
  joignableRedirige: 'repond {statut} en {duree} ms, apres redirection vers {url}',
  injoignable: 'injoignable en https : {erreur}',
  tls13: 'TLS 1.3',
  tls12: 'TLS 1.2',
  tlsAncien: '{version} : version abandonnee, que les navigateurs recents refusent',
  tlsInconnu: '{version}',
  tlsNonLu: 'non lue : la capture ne l a pas retenue (capture en pause, couche TLS desactivee, ou filtre)',
  suite: '{suite} — solidite {solidite}',
  echangePq: '{groupe} : echange hybride post-quantique',
  echange: '{groupe}',
  ech: 'le nom du site a voyage chiffre (Encrypted Client Hello)',
  sansEch: 'le nom du site est passe en clair dans la poignee de main (pas d ECH)',
  certExpire: 'expire depuis le {date}',
  certBientot: 'expire le {date}, dans {n} jour(s)',
  certValide: 'valide jusqu au {date}, encore {n} jours',
  certHorsPeriode: 'hors de sa periode de validite selon Firefox',
  certAbsent: 'Firefox n a pas transmis la chaine de certificats de cette connexion : date de fin, emetteur et noms couverts ne sont pas lus',
  emetteur: '{emetteur}',
  couvre: 'couvre {hote} ({n} nom(s) au total)',
  neCouvrePas: 'ne couvre pas {hote} : le navigateur refuse la connexion',
  nomsInconnus: 'les noms couverts n ont pas pu etre lus dans le certificat',
  reconnu: 'reconnu par Firefox',
  nonReconnu: 'non reconnu par Firefox : autorite inconnue, ou certificat auto-signe',
  ctConforme: 'conforme a la politique de transparence des certificats de Firefox',
  ctInsuffisant: 'preuves de transparence insuffisantes ({statut})',
  ctNonApplicable: 'transparence non exigee pour ce certificat ({statut})',
  versHttps: 'http:// mene a {url}',
  firefoxHttps: 'Firefox est passe seul en https (HSTS deja connu, ou mode HTTPS uniquement) : le serveur n a pas ete interroge en clair',
  resteHttp: 'le site repond en clair, sans rediriger vers https',
  port80Ferme: 'http:// ne repond pas : seul https est servi',
  chaine: '{n} redirection(s) : {chaine}',
  sansCookie: 'aucun cookie pose a la premiere visite',
  cookiesSurs: '{n} cookie(s) pose(s), tous avec Secure, HttpOnly et SameSite',
  cookiesManques: '{n} cookie(s) pose(s) : {manques}',
  sansSecure: 'sans Secure : {noms}',
  sansHttpOnly: 'sans HttpOnly : {noms}',
  sansSameSite: 'sans SameSite : {noms}',
  h3: 'HTTP/3 annonce (Alt-Svc : {alpn})',
  sansH3: 'pas d HTTP/3 annonce par Alt-Svc',
  serveur: 'annonce « {valeur} »',
  txtPresent: 'present, contact {contact}',
  txtSansContact: 'present, sans contact',
  txtAbsent: 'aucun security.txt (RFC 9116) : pas d adresse publiee pour signaler une faille',
  txtInjoignable: 'non lu : {erreur}',
  txtPasTexte: 'repond {statut} avec un contenu {type} : pas un security.txt',
  constats: '{n} constat(s) de l analyseur sur la page'
};

export const NOMS_VERIFICATION = ['Connexion', 'Certificat', 'Redirections', 'Protections', 'Cookies', 'Annonces',
  'Joignable en https', 'Version TLS', 'Chiffrement', 'Echange de cles', 'ECH', 'Validite', 'Emetteur', 'Noms couverts',
  'Confiance', 'Transparence', 'http vers https', 'Chaine', 'Cookies poses', 'HTTP/3', 'Serveur', 'X-Powered-By',
  'security.txt', 'Analyseur'];

const ligne = (nom, etat, cle, valeurs = {}, aTraduire) => ({ nom, etat, texte: FAITS_VERIFICATION[cle], valeurs, aTraduire });
const jour = ms => new Date(ms).toISOString().substring(0, 10);
const entete = (liste, nom) => {
  const h = (liste || []).find(x => x && String(x.name || '').toLowerCase() === nom);
  return h ? String(h.value == null ? '' : h.value) : null;
};

/** Un nom de certificat couvre-t-il l hote ? (RFC 6125 6.4.3 : l etoile ne
 *  remplace qu une etiquette, la plus a gauche.) */
export function nomCouvre(nom, hote) {
  const n = String(nom || '').toLowerCase().replace(/\.$/, '');
  const h = String(hote || '').toLowerCase().replace(/\.$/, '');
  if (!n || !h) return false;
  if (n === h) return true;
  if (n.startsWith('*.')) {
    const reste = n.substring(2);
    const k = h.indexOf('.');
    return k > 0 && h.substring(k + 1) === reste;
  }
  return false;
}

/* Les attributs de chaque Set-Cookie (RFC 6265bis). */
function cookiesPoses(entetes) {
  return (entetes || []).filter(h => h && String(h.name || '').toLowerCase() === 'set-cookie')
    .flatMap(h => String(h.value == null ? '' : h.value).split('\n'))
    .filter(v => v.trim())
    .map(v => {
      const parts = v.split(';').map(p => p.trim());
      const nom = parts[0].split('=')[0].trim() || '?';
      const attributs = new Set(parts.slice(1).map(p => p.split('=')[0].trim().toLowerCase()));
      return { nom, secure: attributs.has('secure'), httpOnly: attributs.has('httponly'), sameSite: attributs.has('samesite') };
    });
}

/**
 * @param hote         l hote verifie
 * @param https        { sonde, rec } — sonde : ce que fetch a vu ; rec : l enregistrement capture, ou null
 * @param http         idem, pour http://
 * @param securityTxt  idem, pour /.well-known/security.txt (la sonde porte le corps)
 * @param maintenant   l instant du bilan
 * @returns [{ nom, lignes }]
 */
export function bilanSite({ hote, https = {}, http = {}, securityTxt = {}, maintenant = Date.now() }) {
  const sections = [];
  const sonde = https.sonde || {};
  const rec = https.rec || null;
  const s = rec && rec.security ? rec.security : null;

  /* ------------------------------- Connexion ------------------------------ */
  const connexion = [];
  if (sonde.erreur) connexion.push(ligne('Joignable en https', 'inoperant', 'injoignable', { erreur: sonde.erreur }));
  else if (sonde.redirige && sonde.urlFinale) connexion.push(ligne('Joignable en https', 'present', 'joignableRedirige', { statut: sonde.statut, duree: sonde.duree, url: sonde.urlFinale }));
  else connexion.push(ligne('Joignable en https', 'present', 'joignable', { statut: sonde.statut, duree: sonde.duree }));
  if (!sonde.erreur) {
    if (!s) connexion.push(ligne('Version TLS', 'info', 'tlsNonLu'));
    else {
      const v = String(s.protocolVersion || '');
      if (v === 'TLSv1.3') connexion.push(ligne('Version TLS', 'present', 'tls13'));
      else if (v === 'TLSv1.2') connexion.push(ligne('Version TLS', 'present', 'tls12'));
      else if (/^(TLSv1(\.[01])?|SSLv[23])$/.test(v)) connexion.push(ligne('Version TLS', 'inoperant', 'tlsAncien', { version: v }));
      else connexion.push(ligne('Version TLS', 'info', 'tlsInconnu', { version: v || '?' }));
      if (s.cipherSuite) {
        const suite = decrireSuiteTls(s.cipherSuite);
        const solidite = suite ? suite.solidite : 'inconnue de cette table';
        connexion.push(ligne('Chiffrement', solidite === 'cassee' ? 'inoperant' : solidite === 'faible' ? 'partiel' : 'present',
          'suite', { suite: s.cipherSuite, solidite }, ['solidite']));
      }
      if (s.keaGroupName) {
        const pq = /mlkem|kyber/i.test(s.keaGroupName);
        connexion.push(ligne('Echange de cles', 'present', pq ? 'echangePq' : 'echange', { groupe: s.keaGroupName }));
      }
      connexion.push(s.usedEch ? ligne('ECH', 'present', 'ech') : ligne('ECH', 'info', 'sansEch'));
    }
  }
  sections.push({ nom: 'Connexion', lignes: connexion });

  /* ------------------------------ Certificat ------------------------------ */
  /* Firefox ne transmet pas toujours la chaine — pour un certificat accepte
     par une exception, par exemple — : ce qui reste lisible l est quand
     meme, et l absence est dite. */
  const certs = s && Array.isArray(s.certificates) ? s.certificates : [];
  if (s) {
    const c = certs.length ? certs[0] : null;
    const certificat = [];
    const fin = c ? Number(c.validityEnd) : NaN;
    if (!c) certificat.push(ligne('Certificat', 'info', 'certAbsent'));
    if (s.isNotValidAtThisTime) certificat.push(ligne('Validite', 'inoperant', 'certHorsPeriode'));
    else if (Number.isFinite(fin) && fin > 0) {
      const n = Math.floor((fin - maintenant) / 86400000);
      if (fin < maintenant) certificat.push(ligne('Validite', 'inoperant', 'certExpire', { date: jour(fin) }));
      else if (n <= 14) certificat.push(ligne('Validite', 'partiel', 'certBientot', { date: jour(fin), n }));
      else certificat.push(ligne('Validite', 'present', 'certValide', { date: jour(fin), n }));
    }
    const emetteur = c ? (/(?:^|,)\s*O=([^,]+)/.exec(String(c.issuer || '')) || [])[1] : null;
    const cn = c ? (/(?:^|,)\s*CN=([^,]+)/.exec(String(c.issuer || '')) || [])[1] : null;
    if (emetteur || cn) certificat.push(ligne('Emetteur', 'info', 'emetteur', { emetteur: [emetteur, cn].filter(Boolean).join(' — ') }));
    let noms = null;
    if (c && c.der) { try { noms = resumerCertificat(base64VersOctets(c.der)).noms || []; } catch { noms = null; } }
    if (s.isDomainMismatch) certificat.push(ligne('Noms couverts', 'inoperant', 'neCouvrePas', { hote }));
    else if (noms) {
      certificat.push(noms.some(n => nomCouvre(n, hote))
        ? ligne('Noms couverts', 'present', 'couvre', { hote, n: noms.length })
        : ligne('Noms couverts', 'inoperant', 'neCouvrePas', { hote }));
    } else if (c) certificat.push(ligne('Noms couverts', 'info', 'nomsInconnus'));
    certificat.push(s.isUntrusted ? ligne('Confiance', 'inoperant', 'nonReconnu') : ligne('Confiance', 'present', 'reconnu'));
    const ct = String(s.certificateTransparencyStatus || '');
    if (ct === 'policy_compliant') certificat.push(ligne('Transparence', 'present', 'ctConforme'));
    else if (/^policy_not/.test(ct)) certificat.push(ligne('Transparence', 'partiel', 'ctInsuffisant', { statut: ct }));
    else if (ct) certificat.push(ligne('Transparence', 'info', 'ctNonApplicable', { statut: ct }));
    sections.push({ nom: 'Certificat', lignes: certificat });
  }

  /* ----------------------------- Redirections ----------------------------- */
  const redirections = [];
  const sh = http.sonde || {};
  const rh = http.rec || null;
  const interne = rh && Array.isArray(rh.redirects) && rh.redirects.length
    && /internal redirect/i.test(String(rh.redirects[0].statusLine || ''));
  if (sh.erreur && !/^https:/i.test(String(sh.urlFinale || ''))) redirections.push(ligne('http vers https', 'info', 'port80Ferme'));
  else if (interne) redirections.push(ligne('http vers https', 'info', 'firefoxHttps'));
  else if (/^https:/i.test(String(sh.urlFinale || ''))) redirections.push(ligne('http vers https', 'present', 'versHttps', { url: sh.urlFinale }));
  else if (sh.statut) redirections.push(ligne('http vers https', 'absent', 'resteHttp'));
  const sauts = rec && Array.isArray(rec.redirects) ? rec.redirects : [];
  if (sauts.length) {
    const chaine = [sauts[0].from, ...sauts.map(r => r.to)].join(' → ');
    redirections.push(ligne('Chaine', 'info', 'chaine', { n: sauts.length, chaine }));
  }
  if (redirections.length) sections.push({ nom: 'Redirections', lignes: redirections });

  /* ------------------------------ Protections ----------------------------- */
  /* La page d accueil est un document : ses protections se lisent comme
     celles d une page, meme si la requete est partie du noyau. */
  if (rec && Array.isArray(rec.responseHeaders) && rec.responseHeaders.length) {
    const adresse = String(rec.finalUrl || rec.url || '');
    const lignes = lireProtections({ ...rec, type: 'main_frame', scheme: rec.scheme || adresse.split(':')[0] });
    if (lignes.length) sections.push({ nom: 'Protections', lignes, protections: true });
  }

  /* -------------------------------- Cookies ------------------------------- */
  if (rec) {
    const cookies = cookiesPoses(rec.responseHeaders);
    const liste = noms => noms.join(', ');
    if (!cookies.length) sections.push({ nom: 'Cookies', lignes: [ligne('Cookies poses', 'present', 'sansCookie')] });
    else {
      const sansSecure = cookies.filter(k => !k.secure).map(k => k.nom);
      const sansHttpOnly = cookies.filter(k => !k.httpOnly).map(k => k.nom);
      const sansSameSite = cookies.filter(k => !k.sameSite).map(k => k.nom);
      const lignes = [];
      if (!sansSecure.length && !sansHttpOnly.length && !sansSameSite.length) lignes.push(ligne('Cookies poses', 'present', 'cookiesSurs', { n: cookies.length }));
      else {
        lignes.push(ligne('Cookies poses', 'partiel', 'cookiesManques', { n: cookies.length,
          manques: [sansSecure.length ? 'Secure' : '', sansHttpOnly.length ? 'HttpOnly' : '', sansSameSite.length ? 'SameSite' : ''].filter(Boolean).join(', ') }));
        if (sansSecure.length) lignes.push(ligne('Secure', 'partiel', 'sansSecure', { noms: liste(sansSecure) }));
        if (sansHttpOnly.length) lignes.push(ligne('HttpOnly', 'info', 'sansHttpOnly', { noms: liste(sansHttpOnly) }));
        if (sansSameSite.length) lignes.push(ligne('SameSite', 'info', 'sansSameSite', { noms: liste(sansSameSite) }));
      }
      sections.push({ nom: 'Cookies', lignes });
    }
  }

  /* ------------------------------- Annonces ------------------------------- */
  const annonces = [];
  const entetes = rec && Array.isArray(rec.responseHeaders) && rec.responseHeaders.length ? rec.responseHeaders : (sonde.entetes || []);
  if (!sonde.erreur) {
    const alt = lireAltSvc(entetes);
    const h3 = alt ? alt.services.filter(x => /^h3/.test(String(x.alpn))).map(x => x.alpn) : [];
    annonces.push(h3.length ? ligne('HTTP/3', 'present', 'h3', { alpn: [...new Set(h3)].join(', ') }) : ligne('HTTP/3', 'info', 'sansH3'));
    const serveur = entete(entetes, 'server');
    if (serveur) annonces.push(ligne('Serveur', 'info', 'serveur', { valeur: serveur }));
    const moteur = entete(entetes, 'x-powered-by');
    if (moteur) annonces.push(ligne('X-Powered-By', 'info', 'serveur', { valeur: moteur }));
  }
  const st = securityTxt.sonde || {};
  const type = String(st.typeContenu || '').toLowerCase();
  if (st.erreur) annonces.push(ligne('security.txt', 'info', 'txtInjoignable', { erreur: st.erreur }));
  else if (st.statut === 200 && /^text\/plain\b/.test(type)) {
    const lu = lireSecurityTxt(String(st.corps || ''));
    const contact = lu ? (lu.champs.find(c => c.nom === 'Contact') || {}).valeur : null;
    annonces.push(contact ? ligne('security.txt', 'present', 'txtPresent', { contact }) : ligne('security.txt', 'partiel', 'txtSansContact'));
    for (const f of faitsSecurityTxt(lu, { url: st.urlFinale || '', typeMedia: st.typeContenu || '', maintenant })) {
      if (f.cle === 'signe' || f.cle === 'nonSigne') continue;
      annonces.push({ nom: 'security.txt', etat: 'partiel', texte: f.texte, valeurs: f.valeurs });
    }
  } else if (st.statut === 404 || st.statut === 410) annonces.push(ligne('security.txt', 'absent', 'txtAbsent'));
  else if (st.statut) annonces.push(ligne('security.txt', 'absent', 'txtPasTexte', { statut: st.statut, type: type.split(';')[0] || '?' }));
  const constats = rec && rec.analysis && Array.isArray(rec.analysis.findings) ? rec.analysis.findings.length : 0;
  if (constats) annonces.push(ligne('Analyseur', 'info', 'constats', { n: constats }));
  if (annonces.length) sections.push({ nom: 'Annonces', lignes: annonces });
  return sections;
}
