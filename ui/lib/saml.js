/* SAML 2.0 — INTERCEPTOR (by NeoZ)
 *
 * Le SSO d entreprise passe souvent par SAML : le navigateur transporte une
 * demande (SAMLRequest) vers le fournisseur d identite, puis une reponse
 * (SAMLResponse) vers l application. Les deux sont du XML encode :
 *
 *   liaison HTTP-Redirect  base64 d un flux DEFLATE brut, dans l URL
 *   liaison HTTP-POST      base64 du XML, dans un formulaire
 *                          (SAML 2.0 Bindings, 3.4 et 3.5)
 *
 * On le decode, et on en tire ce qu on cherche en premier : qui l emet, pour
 * qui, jusqu a quand, et surtout CE QUI EST SIGNE — la reponse, l assertion,
 * ou rien. Le XML est lu par un decoupage structurel des balises, pas par des
 * expressions devinees : on sait ainsi dans quel element chaque signature se
 * trouve. Ce sont des faits ; seul le fournisseur de service sait ce qu il
 * exige, et on ne pretend pas le savoir a sa place.
 */

import { xmlJoli } from './codecs-format.js';

export const FAITS_SAML = {
  signeReponse: 'la reponse elle-meme est signee (Signature dans Response)',
  signeAssertion: 'l assertion est signee (Signature dans Assertion)',
  signeRedirect: 'le message est signe par la liaison Redirect (parametre Signature, algorithme {alg})',
  aucuneSignature: 'aucune signature dans ce message',
  chiffree: 'l assertion est chiffree (EncryptedAssertion) : son contenu ne se lit pas ici',
  sha1: 'algorithme {alg} : SHA-1, que le NIST interdit pour produire des signatures (SP 800-131A)',
  expiree: 'deja expiree au moment de la capture (NotOnOrAfter {fin})',
  pasEncore: 'pas encore valable au moment de la capture (NotBefore {debut})',
  nonCompresse: 'le message n est pas compresse, alors que la liaison Redirect exige DEFLATE (SAML 2.0 Bindings, 3.4.4.1)'
};

const ENTITES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
/* Un point de code hors d Unicode reste ecrit tel quel : il ne rend pas tout
   le message illisible. En une passe, pour que « &amp;#65; » redonne « &#65; ». */
const point = (brut, code) => (code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : brut);
const desechapper = s => String(s).replace(/&(?:(amp|lt|gt|quot|apos)|#(\d{1,8})|#x([0-9a-fA-F]{1,8}));/g,
  (brut, nomme, dec, hex) => nomme ? ENTITES[nomme]
    : point(brut, dec !== undefined ? Number(dec) : parseInt(hex, 16)));

/* Un message SAML vient du reseau : il peut etre hostile. Au-dela, il n est
   pas lu — un vrai message pese quelques dizaines de kilo-octets. */
const TAILLE_MAX = 4 * 1024 * 1024;

const blanc = c => c === ' ' || c === '\n' || c === '\r' || c === '\t';

/* Attributs d une balise, lus caractere par caractere. Une expression
   reguliere pouvait revenir en arriere sur un long nom sans « = » : le temps
   croissait comme le carre de la longueur. */
function lireAttributs(s) {
  const out = {};
  const n = s.length;
  let i = 0;
  while (i < n) {
    while (i < n && blanc(s[i])) i++;
    const debut = i;
    while (i < n && s[i] !== '=' && !blanc(s[i]) && s[i] !== '/') i++;
    const brut = s.slice(debut, i);
    while (i < n && blanc(s[i])) i++;
    if (s[i] !== '=') { if (i === debut) i++; continue; }
    i++;
    while (i < n && blanc(s[i])) i++;
    const guillemet = s[i];
    if (guillemet !== '"' && guillemet !== "'") continue;
    const fin = s.indexOf(guillemet, i + 1);
    if (fin < 0) break;
    const valeur = s.slice(i + 1, fin);
    i = fin + 1;
    if (!brut) continue;
    const nom = brut.includes(':') && !brut.startsWith('xmlns') ? brut.split(':').pop() : brut;
    out[nom] = desechapper(valeur);
  }
  return out;
}

/**
 * Decoupe le XML en textes et en balises, en une seule lecture.
 *
 * L ancienne expression reguliere relisait tout le reste du texte a chaque
 * « < » sans « > » : 110 Ko hostiles figeaient l onglet deux secondes et
 * demie, et le temps quadruplait a chaque doublement. Ici chaque caractere est
 * lu une fois, et un « > » ecrit dans une valeur d attribut entre guillemets —
 * que XML n oblige pas a echapper — ne coupe plus la balise.
 */
function* morceauxXml(texte) {
  const n = texte.length;
  let i = 0;
  while (i < n) {
    const lt = texte.indexOf('<', i);
    if (lt < 0) { yield { texte: texte.slice(i) }; return; }
    if (lt > i) yield { texte: texte.slice(i, lt) };
    if (texte.startsWith('<!--', lt)) {
      const fin = texte.indexOf('-->', lt + 4);
      if (fin < 0) throw new Error('commentaire XML non ferme');
      i = fin + 3;
      continue;
    }
    if (texte.startsWith('<![CDATA[', lt)) {
      const fin = texte.indexOf(']]>', lt + 9);
      if (fin < 0) throw new Error('section CDATA non fermee');
      yield { texte: texte.slice(lt + 9, fin), brut: true };
      i = fin + 3;
      continue;
    }
    if (texte.startsWith('<?', lt)) {
      const fin = texte.indexOf('?>', lt + 2);
      if (fin < 0) throw new Error('instruction XML non fermee');
      i = fin + 2;
      continue;
    }
    if (texte.startsWith('<!', lt)) {
      const fin = texte.indexOf('>', lt + 2);
      if (fin < 0) throw new Error('declaration XML non fermee');
      i = fin + 1;
      continue;
    }
    let j = lt + 1;
    let guillemet = null;
    for (; j < n; j++) {
      const c = texte[j];
      if (guillemet) { if (c === guillemet) guillemet = null; }
      else if (c === '"' || c === "'") guillemet = c;
      else if (c === '>') break;
    }
    if (j >= n) throw new Error('balise XML non fermee');
    yield { balise: texte.slice(lt + 1, j) };
    i = j + 1;
  }
}

const NOM_XML = /^[A-Za-z_][\w.-]*$/;

/* « /saml:Issuer », « ds:Signature Id="x" / » : sens, nom local, attributs. */
function lireBalise(balise) {
  const fermante = balise[0] === '/';
  let k = fermante ? 1 : 0;
  const debut = k;
  while (k < balise.length && !blanc(balise[k]) && balise[k] !== '/') k++;
  const qualifie = balise.slice(debut, k);
  const deux = qualifie.indexOf(':');
  const nom = deux < 0 ? qualifie : qualifie.slice(deux + 1);
  if (!NOM_XML.test(nom) || (deux >= 0 && !NOM_XML.test(qualifie.slice(0, deux)))) return null;
  const reste = balise.slice(k);
  const autofermante = !fermante && reste.trimEnd().endsWith('/');
  return { fermante, nom, attrs: autofermante ? reste.trimEnd().slice(0, -1) : reste, autofermante };
}

/**
 * Lit un message SAML (texte XML).
 * @returns le resume, ou leve si ce n est pas du SAML
 */
export function lireSaml(xml) {
  const texte = String(xml || '');
  if (texte.length > TAILLE_MAX) throw new Error('message SAML de plus de 4 Mo : non lu');
  const pile = [];
  const r = {
    racine: null, id: null, version: null, instant: null, destination: null, enReponseA: null,
    retour: null, emetteur: null, statut: null, nameId: null, formatNameId: null, audiences: [],
    nonAvant: null, nonApres: null, destinataire: null, session: null, attributs: [],
    signatures: [], chiffree: false, algorithmesSignature: [], algorithmesEmpreinte: []
  };
  let capte = null;          // element dont on attend le texte
  let tampon = '';
  for (const m of morceauxXml(texte)) {
    if (m.texte !== undefined) {
      if (capte) tampon += m.brut ? m.texte : desechapper(m.texte);
      continue;
    }
    const b = lireBalise(m.balise);
    if (!b) continue;
    const { fermante, nom, attrs, autofermante } = b;
    if (fermante) {
      if (capte && capte.nom === nom && capte.profondeur === pile.length) {
        const valeur = tampon.trim();
        if (nom === 'Issuer' && !r.emetteur) r.emetteur = valeur;
        else if (nom === 'NameID' && !r.nameId) r.nameId = valeur;
        else if (nom === 'Audience') r.audiences.push(valeur);
        capte = null;
        tampon = '';
      }
      pile.pop();
      continue;
    }
    const a = lireAttributs(attrs);
    const parent = pile.length ? pile[pile.length - 1] : null;
    if (!r.racine) {
      r.racine = nom;
      r.id = a.ID || null;
      r.version = a.Version || null;
      r.instant = a.IssueInstant || null;
      r.destination = a.Destination || null;
      r.enReponseA = a.InResponseTo || null;
      r.retour = a.AssertionConsumerServiceURL || null;
    }
    if (nom === 'StatusCode' && !r.statut) r.statut = a.Value || null;
    if (nom === 'NameID' && a.Format) r.formatNameId = a.Format;
    if (nom === 'Conditions') { r.nonAvant = a.NotBefore || null; r.nonApres = a.NotOnOrAfter || null; }
    if (nom === 'SubjectConfirmationData') r.destinataire = a.Recipient || r.destinataire;
    if (nom === 'AuthnStatement' && a.SessionIndex) r.session = a.SessionIndex;
    if (nom === 'Attribute' && a.Name) r.attributs.push(a.FriendlyName ? a.FriendlyName + ' (' + a.Name + ')' : a.Name);
    if (nom === 'Signature') r.signatures.push(parent || '(racine)');
    if (nom === 'EncryptedAssertion') r.chiffree = true;
    if (nom === 'SignatureMethod' && a.Algorithm) r.algorithmesSignature.push(a.Algorithm);
    if (nom === 'DigestMethod' && a.Algorithm) r.algorithmesEmpreinte.push(a.Algorithm);
    if (autofermante) continue;
    pile.push(nom);
    if (['Issuer', 'NameID', 'Audience'].includes(nom)) { capte = { nom, profondeur: pile.length }; tampon = ''; }
  }
  if (!r.racine || !/^(AuthnRequest|Response|LogoutRequest|LogoutResponse|ArtifactResolve|ArtifactResponse|AttributeQuery|Assertion)$/.test(r.racine)) {
    throw new Error('ce XML n est pas un message SAML 2.0');
  }
  return r;
}

/* Le base64 d un parametre, tolerant l encodage d URL et les retours a la ligne. */
function base64VersOctets(texte) {
  const net = String(texte).replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/');
  const binaire = atob(net);
  const o = new Uint8Array(binaire.length);
  for (let i = 0; i < binaire.length; i++) o[i] = binaire.charCodeAt(i);
  return o;
}

/* Quelques octets DEFLATE peuvent se deplier en gigaoctets : on lit morceau
   par morceau, et on s arrete au-dela de TAILLE_MAX. */
async function inflerBrut(octets) {
  const lecteur = new Blob([octets]).stream().pipeThrough(new DecompressionStream('deflate-raw')).getReader();
  const morceaux = [];
  let total = 0;
  for (;;) {
    const { done, value } = await lecteur.read();
    if (done) break;
    total += value.length;
    if (total > TAILLE_MAX) {
      await lecteur.cancel().catch(() => {});
      throw Object.assign(new Error('message SAML de plus de 4 Mo une fois decompresse : non lu'), { tropGrand: true });
    }
    morceaux.push(value);
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const m of morceaux) { out.set(m, pos); pos += m.length; }
  return out;
}

/**
 * Trouve un message SAML dans une requete : dans l URL (Redirect) ou dans un
 * corps de formulaire (POST).
 * @returns { nom, liaison, valeur, relayState, sigAlg, signe } ou null
 */
export function trouverSaml(rec) {
  let p = null;
  let liaison = null;
  try {
    const u = new URL(rec.url);
    if (u.searchParams.has('SAMLRequest') || u.searchParams.has('SAMLResponse')) { p = u.searchParams; liaison = 'HTTP-Redirect'; }
  } catch { /* URL illisible */ }
  if (!p) {
    const corps = rec.requestBody;
    let q = null;
    if (corps && corps.kind === 'formData' && corps.formData) {
      q = new URLSearchParams();
      for (const [k, vs] of Object.entries(corps.formData)) for (const v of vs) q.append(k, String(v));
    } else if (corps && typeof corps.text === 'string' && /x-www-form-urlencoded/i.test(String(corps.contentType || ''))) {
      q = new URLSearchParams(corps.text);
    }
    if (q && (q.has('SAMLRequest') || q.has('SAMLResponse'))) { p = q; liaison = 'HTTP-POST'; }
  }
  if (!p) return null;
  const nom = p.has('SAMLRequest') ? 'SAMLRequest' : 'SAMLResponse';
  return {
    nom, liaison, valeur: p.get(nom),
    relayState: p.get('RelayState'),
    sigAlg: p.get('SigAlg'),
    signe: p.has('Signature')
  };
}

/**
 * Pour la boite a outils : une valeur SAMLRequest ou SAMLResponse collee a la
 * main, encodee pour l URL ou non, compressee (Redirect) ou non (POST).
 * @returns le XML, mis en forme
 */
export async function decoderSamlTexte(texte) {
  let brut = String(texte || '').trim();
  if (!brut) throw new Error('rien a decoder');
  if (/%[0-9a-f]{2}/i.test(brut)) brut = decodeURIComponent(brut);
  const octets = base64VersOctets(brut);
  const xmlOctets = octets[0] === 0x3c ? octets : await inflerBrut(octets);
  const xml = new TextDecoder('utf-8').decode(xmlOctets);
  lireSaml(xml);                     // leve si ce n est pas un message SAML
  return xmlJoli(xml);
}

/**
 * Decode et lit un message trouve par trouverSaml.
 * @param instant  ms, moment de la capture, pour dire si l assertion etait valable
 * @returns { xml, resume, faits }
 */
export async function decoderSaml(trouve, instant) {
  const octets = base64VersOctets(trouve.valeur);
  const faits = [];
  let xmlOctets = octets;
  if (trouve.liaison === 'HTTP-Redirect') {
    try { xmlOctets = await inflerBrut(octets); }
    catch (e) {
      if (e && e.tropGrand) throw e;
      /* Certains emetteurs n appliquent pas DEFLATE : on le dit, et on lit. */
      if (octets[0] !== 0x3c) throw new Error('ni DEFLATE ni XML : message illisible');
      faits.push({ texte: FAITS_SAML.nonCompresse, valeurs: {} });
    }
  }
  const xml = new TextDecoder('utf-8').decode(xmlOctets);
  const resume = lireSaml(xml);

  const signes = new Set(resume.signatures);
  if (signes.has('Response')) faits.push({ texte: FAITS_SAML.signeReponse, valeurs: {} });
  if (signes.has('Assertion')) faits.push({ texte: FAITS_SAML.signeAssertion, valeurs: {} });
  if (trouve.liaison === 'HTTP-Redirect' && trouve.signe) {
    faits.push({ texte: FAITS_SAML.signeRedirect, valeurs: { alg: trouve.sigAlg || '?' } });
  }
  if (!signes.size && !(trouve.liaison === 'HTTP-Redirect' && trouve.signe) && !resume.chiffree) {
    faits.push({ texte: FAITS_SAML.aucuneSignature, valeurs: {} });
  }
  if (resume.chiffree) faits.push({ texte: FAITS_SAML.chiffree, valeurs: {} });
  for (const alg of new Set([...resume.algorithmesSignature, ...resume.algorithmesEmpreinte,
    ...(trouve.sigAlg ? [trouve.sigAlg] : [])])) {
    if (/sha1\b|#sha1$|rsa-sha1|dsa-sha1/i.test(alg)) faits.push({ texte: FAITS_SAML.sha1, valeurs: { alg } });
  }
  if (instant && resume.nonApres && Date.parse(resume.nonApres) <= instant) {
    faits.push({ texte: FAITS_SAML.expiree, valeurs: { fin: resume.nonApres } });
  }
  if (instant && resume.nonAvant && Date.parse(resume.nonAvant) > instant) {
    faits.push({ texte: FAITS_SAML.pasEncore, valeurs: { debut: resume.nonAvant } });
  }
  return { xml, resume, faits };
}
