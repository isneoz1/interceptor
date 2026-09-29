/* Signatures HTTP, WebAuthn, DNS — INTERCEPTOR (by NeoZ)
 *
 *   node tests/decodeurs.test.mjs
 *
 * Ce que la 4.6 ajoute, verifie contre des references independantes du code
 * teste :
 *
 *   1. champs structures : la serialisation stricte (RFC 9651, 4.1) ;
 *   2. signatures de messages HTTP : les exemples de la RFC 9421, extraits de
 *      son texte (vecteurs-rfc9421.json) — bases exactes, signatures RSA-PSS,
 *      ECDSA, HMAC et Ed25519 verifiees avec les cles publiees ;
 *   3. cles publiques : PKCS #1, JWK complete, refus d une cle privee ;
 *   4. CBOR sans perte ;
 *   5. WebAuthn : inscriptions et connexions fabriquees par fido2 (Yubico) et
 *      cryptography (vecteurs-webauthn.json), en ES256, EdDSA et RS256 ;
 *   6. DNS : messages fabriques par dnspython (vecteurs-dns.json), et
 *      l exemple de la RFC 8484 ;
 *   7. la boite a outils.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, egal, verifier, leve, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
const lire = nom => JSON.parse(fs.readFileSync(path.join(ici, nom), 'utf8'));

const cs = await import('../ui/lib/champs-structures.js');
const sig = await import('../ui/lib/signatures-http.js');
const cles = await import('../ui/lib/cles-publiques.js');
const { decoderCborBrut, lireCborPartiel } = await import('../ui/lib/binaires.js');
const wa = await import('../ui/lib/webauthn.js');
const dns = await import('../ui/lib/dns-message.js');
const { TRANSFORMATIONS, transformer } = await import('../ui/lib/catalogue.js');

const V9421 = lire('vecteurs-rfc9421.json');
const VWA = lire('vecteurs-webauthn.json');
const VDNS = lire('vecteurs-dns.json');

/* ===================== 1. Serialisation stricte (RFC 9651) ================= */
const redire = texte => cs.serialiserDictionnaire(cs.lireDictionnaire(texte));
egal('espaces reduits a un seul', redire('a=1,    b=2;x=1;y=2,   c=(a   b   c)'), 'a=1, b=2;x=1;y=2, c=(a b c)');
egal('une cle repetee garde sa premiere place et sa derniere valeur', redire('a=1, b=2, a=3'), 'a=3, b=2');
egal('un booleen vrai se reduit a sa cle', redire('a=?1, b=?0, c'), 'a, b=?0, c');
egal('decimal : zeros de fin retires', redire('a=1.50, b=-0.25'), 'a=1.5, b=-0.25');
egal('suite d octets : base64 complete', redire('a=:YQ:'), 'a=:YQ==:');
egal('date et chaine affichee', redire('d=@1659578233, s=%"f%c3%bc%25"'), 'd=@1659578233, s=%"f%c3%bc%25"');
egal('chaine : guillemet et barre oblique echappes', redire('a="x\\"y\\\\z"'), 'a="x\\"y\\\\z"');
egal('liste', cs.serialiserListe(cs.lireListe('a,   (b  c);p=1')), 'a, (b c);p=1');

/* ======================= 2. Signatures de messages ========================= */
const entetes = lignes => lignes.slice(1).map(l => { const i = l.indexOf(':'); return { name: l.slice(0, i), value: l.slice(i + 1).trim() }; });
const ALG = { b21: 'rsa-pss-sha512', b22: 'rsa-pss-sha512', b23: 'rsa-pss-sha512', b24: 'ecdsa-p256-sha256', b25: 'hmac-sha256', b26: 'ed25519' };
const CLE = { b21: 'rsaPss', b22: 'rsaPss', b23: 'rsaPss', b24: 'ecc', b25: 'secret', b26: 'ed25519' };
const INSTANT = Date.parse('2021-04-20T02:07:55Z');

function enregistrement({ requete = V9421.requete, reponse = V9421.reponse, statut = 200, url: adresse, ...reste } = {}) {
  return {
    method: 'POST', url: adresse || 'https://example.com/foo?param=Value&Pet=dog', statusCode: statut,
    startTime: INSTANT, endTime: INSTANT + 1000,
    requestHeaders: entetes(requete), responseHeaders: entetes(reponse),
    requestBody: { size: 18 }, responseBody: { size: 23 }, ...reste
  };
}
const signer = (liste, entree, valeur) => [...liste, { name: 'Signature-Input', value: entree }, ...(valeur ? [{ name: 'Signature', value: valeur }] : [])];

for (const [id, c] of Object.entries(V9421.cas)) {
  const rec = enregistrement();
  if (id === 'b24') rec.responseHeaders = signer(rec.responseHeaders, c.signatureInput, c.signature);
  else rec.requestHeaders = signer(rec.requestHeaders, c.signatureInput, c.signature);
  const [s] = sig.lireSignaturesHttp(rec).filter(x => x.libelle === 'sig-' + id);
  egal('RFC 9421 ' + id + ' : base exacte', s.base, c.base);
  const v = await sig.verifierSignatureHttp({ base: s.base, signature: s.signature, algorithme: ALG[id],
    cle: V9421.cles[CLE[id]], formeSecret: 'base64' });
  egal('RFC 9421 ' + id + ' : signature ' + ALG[id] + ' valide', v.valide, true);
  const alteree = await sig.verifierSignatureHttp({ base: s.base.replace('example.com', 'example.org'),
    signature: s.signature, algorithme: ALG[id], cle: V9421.cles[CLE[id]], formeSecret: 'base64' });
  if (s.base.includes('example.com')) egal('RFC 9421 ' + id + ' : base alteree, signature invalide', alteree.valide, false);
}

/* Une reponse qui couvre des composants de sa requete (;req), section 2.4. */
for (const [n, c] of V9421.reqres.entries()) {
  const rec = enregistrement({ reponse: V9421.reponse503, statut: 503 });
  rec.responseHeaders = signer(rec.responseHeaders, c.signatureInput, c.signature);
  const [s] = sig.lireSignaturesHttp(rec).filter(x => x.sens === 'reponse');
  egal('RFC 9421 2.4 exemple ' + (n + 1) + ' : base avec ;req exacte', s.base, c.base);
  const v = await sig.verifierSignatureHttp({ base: s.base, signature: s.signature, algorithme: 'ecdsa-p256-sha256', cle: V9421.cles.ecc });
  egal('RFC 9421 2.4 exemple ' + (n + 1) + ' : ECDSA valide', v.valide, true);
}
{
  const c = V9421.reqres[0];
  const rec = enregistrement({ reponse: V9421.reponse503, statut: 503 });
  rec.responseHeaders = signer(rec.responseHeaders, c.signatureInput, c.signature);
  const [s] = sig.lireSignaturesHttp(rec).filter(x => x.sens === 'reponse');
  /* Une JWK complete, partie privee comprise (RFC 9421, B.1.3) : seule la
     partie publique sert, et suffit. */
  const jwkComplete = JSON.stringify({ kty: 'EC', crv: 'P-256', kid: 'test-key-ecc-p256',
    d: 'UpuF81l-kOxbjf7T4mNSv0r5tN67Gim7rnf6EFpcYDs',
    x: 'qIVYZVLCrPZHGHjP17CTW0_-D9Lfw0EkjqF7xB4FivA', y: 'Mc4nN9LTDOBhfoUeg8Ye9WedFRhnZXZJA12Qp0zZ6F0' });
  const v = await sig.verifierSignatureHttp({ base: s.base, signature: s.signature, algorithme: 'ecdsa-p256-sha256', cle: jwkComplete });
  egal('JWK complete : verifiee avec sa seule partie publique', v.valide, true);
}

/* Les exemples de la section 2 : valeurs de champs et composants derives. */
const base = (liste, url, methode = 'GET', statut = null) => {
  const rec = { method: methode, url, statusCode: statut, startTime: 0,
    requestHeaders: statut ? [] : liste, responseHeaders: statut ? liste : [] };
  const [s] = sig.lireSignaturesHttp(rec);
  return s;
};
{
  const s = base([
    { name: 'Host', value: 'www.example.com' },
    { name: 'X-OWS-Header', value: '   Leading and trailing whitespace.   ' },
    { name: 'X-Obs-Fold-Header', value: 'Obsolete\r\n    line folding.' },
    { name: 'Cache-Control', value: 'max-age=60' }, { name: 'Cache-Control', value: '   must-revalidate' },
    { name: 'X-Empty-Header', value: '' },
    { name: 'Example-Dict', value: ' a=1, b=2;x=1;y=2, c=(a   b    c), d' },
    { name: 'Example-Header', value: 'value, with, lots' }, { name: 'Example-Header', value: 'of, commas' },
    { name: 'Priority', value: 'u=1,   i' },
    { name: 'Signature-Input', value: 'sig=("x-ows-header" "x-obs-fold-header" "cache-control" "x-empty-header" '
      + '"example-dict";key="a" "example-dict";key="d" "example-dict";key="b" "example-dict";key="c" '
      + '"example-header";bs "priority";sf);created=1' }
  ], 'https://www.example.com/');
  const lignes = s.base.split('\n');
  egal('2.1 : espaces de bord retires', lignes[0], '"x-ows-header": Leading and trailing whitespace.');
  egal('2.1 : pliage obsolete remplace par une espace', lignes[1], '"x-obs-fold-header": Obsolete line folding.');
  egal('2.1 : deux lignes jointes par « , »', lignes[2], '"cache-control": max-age=60, must-revalidate');
  egal('2.1 : champ vide', lignes[3], '"x-empty-header": ');
  egal('2.1.2 : membre entier', lignes[4], '"example-dict";key="a": 1');
  egal('2.1.2 : membre booleen implicite', lignes[5], '"example-dict";key="d": ?1');
  egal('2.1.2 : membre avec parametres', lignes[6], '"example-dict";key="b": 2;x=1;y=2');
  egal('2.1.2 : liste interne reserialisee', lignes[7], '"example-dict";key="c": (a b c)');
  egal('2.1.3 : chaque ligne enveloppee en octets', lignes[8], '"example-header";bs: :dmFsdWUsIHdpdGgsIGxvdHM=:, :b2YsIGNvbW1hcw==:');
  egal('2.1.1 : serialisation stricte d un champ connu', lignes[9], '"priority";sf: u=1, i');
}
{
  const s = base([{ name: 'Signature-Input', value: 'sig=("@method" "@target-uri" "@authority" "@scheme" "@request-target" "@path" "@query");created=1' }],
    'https://www.EXAMPLE.com:443/path?param=value&foo=bar&baz=bat%2Dman', 'POST');
  egal('2.2 : composants derives', s.base.split('\n').slice(0, 7).join('\n'), [
    '"@method": POST',
    '"@target-uri": https://www.example.com/path?param=value&foo=bar&baz=bat%2Dman',
    '"@authority": www.example.com',
    '"@scheme": https',
    '"@request-target": /path?param=value&foo=bar&baz=bat%2Dman',
    '"@path": /path',
    '"@query": ?param=value&foo=bar&baz=bat%2Dman'].join('\n'));
  egal('2.2.3 : port non par defaut garde', base([{ name: 'Signature-Input', value: 's=("@authority" "@query");created=1' }],
    'http://example.com:8080').base.split('\n').slice(0, 2).join('|'), '"@authority": example.com:8080|"@query": ?');
  egal('2.2.2 : identifiants user:pass et fragment exclus de la cible',
    base([{ name: 'Signature-Input', value: 's=("@target-uri");created=1' }], 'https://u:p@www.example.com/p?q=1#f').base.split('\n')[0],
    '"@target-uri": https://www.example.com/p?q=1');
}
{
  const s = base([{ name: 'Signature-Input', value: 'sig=("@query-param";name="var" "@query-param";name="bar" "@query-param";name="fa%C3%A7ade%22%3A%20");created=1' }],
    'https://www.example.com/parameters?var=this%20is%20a%20big%0Amultiline%20value&bar=with+plus+whitespace&fa%C3%A7ade%22%3A%20=something');
  egal('2.2.8 : parametres de l URL reencodes', s.base.split('\n').slice(0, 3).join('\n'), [
    '"@query-param";name="var": this%20is%20a%20big%0Amultiline%20value',
    '"@query-param";name="bar": with%20plus%20whitespace',
    '"@query-param";name="fa%C3%A7ade%22%3A%20": something'].join('\n'));
}

/* Ce qui ne peut pas etre reconstruit est dit, sans base inventee. */
const erreur = (liste, adresse = 'https://a.test/?x=1&x=2', statut = null) => {
  const s = base(liste, adresse, 'GET', statut);
  return s.erreurBase ? s.erreurBase.texte : null;
};
const E = sig.ERREURS_BASE;
egal('champ absent des en-tetes rapportes', erreur([{ name: 'Signature-Input', value: 's=("content-length");created=1' }]), E.absent);
egal('trailer', erreur([{ name: 'Signature-Input', value: 's=("expires";tr);created=1' }]), E.trailer);
egal('parametre inconnu', erreur([{ name: 'Signature-Input', value: 's=("@method";zz);created=1' }]), E.parametre);
egal('req sur une requete', erreur([{ name: 'Signature-Input', value: 's=("@method";req);created=1' }]), E.reqSurRequete);
egal('@status sur une requete', erreur([{ name: 'Signature-Input', value: 's=("@status");created=1' }]), E.statutRequete);
egal('composant en double', erreur([{ name: 'Signature-Input', value: 's=("@method" "@method");created=1' }]), E.doublon);
egal('composant derive inconnu', erreur([{ name: 'Signature-Input', value: 's=("@inconnu");created=1' }]), E.inconnu);
egal('parametre repete dans l URL', erreur([{ name: 'Signature-Input', value: 's=("@query-param";name="x");created=1' }]), E.parametreRequete);
egal('cle absente du dictionnaire', erreur([{ name: 'D', value: 'a=1' }, { name: 'Signature-Input', value: 's=("d";key="b");created=1' }]), E.cleAbsente);
egal('sf sur un type inconnu', erreur([{ name: 'X-Y', value: 'a' }, { name: 'Signature-Input', value: 's=("x-y";sf);created=1' }]), E.typeInconnu);
egal('bs et sf ensemble', erreur([{ name: 'Priority', value: 'u=1' }, { name: 'Signature-Input', value: 's=("priority";bs;sf);created=1' }]), E.incompatibles);
egal('@query-param sans name', erreur([{ name: 'Signature-Input', value: 's=("@query-param");created=1' }]), E.nomManquant);
egal('composant qui n est pas une chaine', erreur([{ name: 'Signature-Input', value: 's=("@method" 123);created=1' }]), E.pasUneChaine);
{
  const s = base([{ name: 'Signature-Input', value: 's=1' }, { name: 'Signature', value: 's=:AAAA:' }], 'https://a.test/');
  egal('libelle sans liste interne : dit', s.erreurLecture && s.erreurLecture.texte, E.listeAttendue);
  const t2 = base([{ name: 'Signature-Input', value: 's=(' }], 'https://a.test/');
  verifier('Signature-Input illisible : message du lecteur garde a part', t2.erreurLecture && t2.erreurLecture.entete === 'Signature-Input'
    && /liste interne non fermee/.test(t2.erreurLecture.valeurs.erreur), JSON.stringify(t2));
}

/* Les faits. */
const faits = (rec, sens = 'requete') => sig.lireSignaturesHttp(rec).filter(s => s.sens === sens).flatMap(s => s.faits.map(f => f.texte));
const F = sig.FAITS_SIGNATURE;
{
  const rec = enregistrement();
  rec.requestHeaders = signer(rec.requestHeaders, V9421.cas.b21.signatureInput, V9421.cas.b21.signature);
  verifier('aucun composant : dit', faits(rec).includes(F.vide));
  const b25 = enregistrement();
  b25.requestHeaders = signer(b25.requestHeaders, V9421.cas.b25.signatureInput, V9421.cas.b25.signature);
  verifier('corps non couvert : dit', faits(b25).includes(F.contenuNonCouvert));
  verifier('hmac : algorithme symetrique dit seulement quand alg l annonce', !faits(b25).includes(F.symetrique));
  const b22 = enregistrement();
  b22.requestHeaders = signer(b22.requestHeaders, V9421.cas.b22.signatureInput, V9421.cas.b22.signature);
  verifier('Content-Digest couvert : pas de fait « non couvert »', !faits(b22).includes(F.contenuNonCouvert));
  /* Dans une reponse, « content-digest;req » couvre le corps de la REQUETE :
     celui de la reponse reste non couvert, et c est dit. */
  const req = enregistrement({ reponse: V9421.reponse503, statut: 503 });
  req.responseHeaders = signer(req.responseHeaders, 'r=("@status" "content-digest";req);created=1618884479', 'r=:AAAA:');
  verifier('content-digest;req ne couvre pas le corps de la reponse', faits(req, 'reponse').includes(F.contenuNonCouvert));
}
{
  const r = enregistrement({ startTime: Date.parse('2030-01-01T00:00:00Z') });
  r.requestHeaders = signer(r.requestHeaders, 'e=("@method");created=1618884473;expires=1618884533;alg="hmac-sha256"', 'e=:AAAA:');
  verifier('expiree au moment de la capture', faits(r).includes(F.expiree));
  verifier('hmac annonce : symetrique', faits(r).includes(F.symetrique));
  const futur = enregistrement();
  futur.requestHeaders = signer(futur.requestHeaders, 'f=("@method");created=1900000000', 'f=:AAAA:');
  verifier('creee apres la capture', faits(futur).includes(F.future));
  const sansValeur = enregistrement();
  sansValeur.requestHeaders = signer(sansValeur.requestHeaders, 'g=("@method");created=1');
  verifier('libelle sans valeur', faits(sansValeur).includes(F.sansValeur));
  const orpheline = enregistrement();
  orpheline.requestHeaders = [...orpheline.requestHeaders, { name: 'Signature', value: 'h=:AAAA:' }];
  verifier('valeur sans libelle', faits(orpheline).includes(F.sansEntree));
  const alg = enregistrement();
  alg.requestHeaders = signer(alg.requestHeaders, 'i=("@method");alg="rsa-sha1"', 'i=:AAAA:');
  verifier('algorithme hors registre', faits(alg).includes(F.algInconnu));
  const redirigee = enregistrement({ redirects: [{ from: 'https://a.test/', to: 'https://example.com/foo?param=Value&Pet=dog' }],
    finalUrl: 'https://example.com/foo?param=Value&Pet=dog', url: 'https://a.test/' });
  redirigee.requestHeaders = signer(redirigee.requestHeaders, 'j=("@method");created=1', 'j=:AAAA:');
  verifier('requete redirigee : dit', faits(redirigee).includes(F.redirigee));
  egal('requete ordinaire : aucune signature', sig.lireSignaturesHttp(enregistrement()).length, 0);
}
{
  let refus = null;
  try { await sig.verifierSignatureHttp({ base: 'x', signature: new Uint8Array(1), algorithme: 'rsa-sha1', cle: 'k' }); }
  catch (e) { refus = e.message; }
  verifier('verification : algorithme hors registre refuse', /non verifiable/.test(refus || ''), refus);
}

/* ============================ 3. Cles publiques ============================ */
{
  const cle = await cles.importerClePublique(V9421.cles.rsaPkcs1, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' });
  egal('PEM PKCS #1 : enveloppe en SubjectPublicKeyInfo, 2048 bits', cle.algorithm.modulusLength, 2048);
  leve('PEM prive refuse', () => cles.lirePem('-----BEGIN PRIVATE KEY-----\nAAAA\n-----END PRIVATE KEY-----'));
  leve('JWK symetrique refusee comme cle publique', () => cles.jwkPublique({ kty: 'oct', k: 'AAAA' }));
  egal('JWK : partie privee retiree', JSON.stringify(cles.jwkPublique({ kty: 'EC', crv: 'P-256', x: 'a', y: 'b', d: 'c', key_ops: ['sign'] })),
    '{"kty":"EC","crv":"P-256","x":"a","y":"b"}');

  /* Un certificat colle : sa cle publique verifie l exemple B.2.4. Le
     certificat est fabrique par cryptography avec la cle publiee par la RFC. */
  const c = V9421.cas.b24;
  const rec = enregistrement();
  rec.responseHeaders = signer(rec.responseHeaders, c.signatureInput, c.signature);
  const [s] = sig.lireSignaturesHttp(rec);
  const parCertificat = await sig.verifierSignatureHttp({ base: s.base, signature: s.signature,
    algorithme: 'ecdsa-p256-sha256', cle: V9421.cles.eccCertificat });
  egal('certificat PEM : sa cle publique verifie B.2.4', parCertificat.valide, true);
  const chaine = V9421.cles.eccCertificat + '\n-----BEGIN CERTIFICATE-----\nAAAA\n-----END CERTIFICATE-----';
  egal('chaine de certificats : seul le premier est lu',
    (await sig.verifierSignatureHttp({ base: s.base, signature: s.signature, algorithme: 'ecdsa-p256-sha256', cle: chaine })).valide, true);
  const nue = V9421.cles.ecc.replace(/-----[A-Z ]+-----/g, '').trim();
  egal('cle SPKI en base64 nu', (await sig.verifierSignatureHttp({ base: s.base, signature: s.signature,
    algorithme: 'ecdsa-p256-sha256', cle: nue })).valide, true);
  const certificatNu = V9421.cles.eccCertificat.replace(/-----[A-Z ]+-----/g, '').trim();
  egal('certificat en base64 nu', (await sig.verifierSignatureHttp({ base: s.base, signature: s.signature,
    algorithme: 'ecdsa-p256-sha256', cle: certificatNu })).valide, true);
  let refus = null;
  try { await cles.importerClePublique('pas une cle', { name: 'ECDSA', namedCurve: 'P-256' }); } catch (e) { refus = e.message; }
  verifier('texte quelconque : refus qui dit quoi coller', /PEM, JWK, certificat/.test(refus || ''), refus);
}

/* =============================== 4. CBOR brut ============================== */
{
  const carte = decoderCborBrut(Uint8Array.from([0xa2, 0x01, 0x02, 0x20, 0x43, 1, 2, 3]));
  verifier('carte aux cles entieres, octets gardes', carte instanceof Map && carte.get(1) === 2
    && carte.get(-1) instanceof Uint8Array && carte.get(-1).join() === '1,2,3');
  egal('chaine d octets de longueur indefinie', decoderCborBrut(Uint8Array.from([0x5f, 0x42, 1, 2, 0x41, 3, 0xff])).join(), '1,2,3');
  egal('lecture partielle : position de fin', lireCborPartiel(Uint8Array.from([0x01, 0x02]), 0).fin, 1);
  leve('octets en trop refuses', () => decoderCborBrut(Uint8Array.from([0x01, 0x02])));
}

/* ================================ 5. WebAuthn ============================== */
for (const v of VWA) {
  const ins = wa.trouverCredential(JSON.stringify({ credential: v.inscription }));
  const con = wa.trouverCredential(JSON.stringify(v.connexion));
  egal(v.nom + ' : inscription reconnue', ins && ins.genre, 'inscription');
  egal(v.nom + ' : format d attestation', ins.attestation.format, 'none');
  egal(v.nom + ' : rpIdHash lu', ins.donnees.rpIdHash, v.rpIdHash);
  egal(v.nom + ' : AAGUID', ins.donnees.aaguid, v.aaguid);
  egal(v.nom + ' : identifiant de la cle', ins.donnees.identifiant, v.credentialId);
  egal(v.nom + ' : algorithme COSE', ins.donnees.cle.alg, v.alg);
  verifier(v.nom + ' : drapeaux UP UV BE BS AT', ['UP', 'UV', 'BE', 'BS', 'AT'].every(d => ins.donnees.drapeaux[d]) && !ins.donnees.drapeaux.ED);
  egal(v.nom + ' : type signe', ins.client.type, 'webauthn.create');
  egal(v.nom + ' : origine signee', ins.client.origine, v.origine);
  egal(v.nom + ' : defi', ins.client.defi, v.defiCreation);
  egal(v.nom + ' : connexion reconnue', con.genre, 'connexion');
  egal(v.nom + ' : compteur', con.donnees.compteur, v.nom === 'rs256' ? 0 : 7);
  const fi = (await wa.faitsCeremonie(ins)).map(f => f.texte);
  const fc = (await wa.faitsCeremonie(con)).map(f => f.texte);
  verifier(v.nom + ' : rpIdHash = SHA-256 de example.com, recalcule', fi.includes(wa.FAITS_WEBAUTHN.rpId));
  verifier(v.nom + ' : cle synchronisee dite', fi.includes(wa.FAITS_WEBAUTHN.synchronisee));
  verifier(v.nom + ' : aucune attestation dite', fi.includes(wa.FAITS_WEBAUTHN.attestationAucune));
  verifier(v.nom + ' : UV absent a la connexion dit', fc.includes(wa.FAITS_WEBAUTHN.uvAbsent));
  egal(v.nom + ' : compteur nul dit seulement quand il l est', fc.includes(wa.FAITS_WEBAUTHN.compteurNul), v.nom === 'rs256');
  egal(v.nom + ' : signature verifiee avec la cle COSE de l inscription',
    (await wa.verifierConnexion(con, ins.donnees.cle.jwk, ins.donnees.cle.algNom)).valide, true);
  egal(v.nom + ' : signature verifiee avec la cle publique en PEM', (await wa.verifierConnexion(con, v.spki, ins.donnees.cle.algNom)).valide, true);
  const alteree = { ...con, clientOctets: new TextEncoder().encode(con.client.texte.replace('login', 'logon')) };
  egal(v.nom + ' : clientDataJSON altere, signature invalide', (await wa.verifierConnexion(alteree, ins.donnees.cle.jwk, ins.donnees.cle.algNom)).valide, false);
}
{
  const [v] = VWA;
  const melange = { ...v.inscription, response: { ...v.inscription.response, clientDataJSON: v.connexion.response.clientDataJSON } };
  const lu = wa.trouverCredential(JSON.stringify(melange));
  verifier('type inattendu dit', (await wa.faitsCeremonie(lu)).some(f => f.texte === wa.FAITS_WEBAUTHN.typeInattendu));
  const ailleurs = wa.trouverCredential(JSON.stringify(v.connexion));
  ailleurs.client = { ...ailleurs.client, origine: 'https://autre.test' };
  verifier('rpIdHash sans rapport avec l origine : dit', (await wa.faitsCeremonie(ailleurs)).some(f => f.texte === wa.FAITS_WEBAUTHN.rpInconnu));
  const autreId = wa.trouverCredential(JSON.stringify({ ...v.inscription, id: 'AAAA', rawId: 'AAAA' }));
  verifier('identifiant annonce different : dit', (await wa.faitsCeremonie(autreId)).some(f => f.texte === wa.FAITS_WEBAUTHN.idDiffere));
  leve('authenticatorData tronque refuse', () => wa.lireDonneesAuthentificateur(new Uint8Array(20)));
  egal('rien dans un corps ordinaire', wa.trouverCredential('{"nom":"x"}'), null);
}
{
  const options = wa.trouverOptions(JSON.stringify({ publicKey: { challenge: 'AAECAwQFBgcICQ', rp: { id: 'example.com', name: 'E' },
    user: { id: 'dQ', name: 'alice' }, pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
    authenticatorSelection: { userVerification: 'discouraged', residentKey: 'required' }, attestation: 'none' } }));
  egal('options d inscription', options.genre, 'creation');
  egal('algorithmes nommes d apres le registre COSE', options.algorithmes.join(), 'ES256,RS256');
  verifier('defi de 10 octets : trop court dit', options.faits.some(f => f.texte === wa.FAITS_WEBAUTHN.defiCourt && f.valeurs.n === 10));
  verifier('verification decouragee : dite', options.faits.some(f => f.texte === wa.FAITS_WEBAUTHN.uvDecourage));
  const connexion = wa.trouverOptions(JSON.stringify({ challenge: 'AAECAwQFBgcICQoLDA0ODw', rpId: 'example.com', allowCredentials: [], userVerification: 'required' }));
  egal('options de connexion', connexion.genre, 'connexion');
  egal('defi de 16 octets : rien a dire', connexion.faits.length, 0);
}

/* =================================== 6. DNS ================================ */
const octets64 = t => Uint8Array.from(Buffer.from(t, 'base64url'));
{
  const q = dns.lireMessageDns(octets64(VDNS.requete));
  egal('requete : question', q.questions.map(x => x.nom + ' ' + x.typeNom).join(), 'www.example.com. HTTPS');
  egal('requete : identifiant 0, rien a dire', q.faits.some(f => f.texte === dns.FAITS_DNS.identifiant), false);
  verifier('requete : RD', q.drapeaux.RD && !q.reponse);
  verifier('requete : EDNS avec DO', q.opt && q.opt.dnssecOk);
  egal('requete : sous-reseau du client', q.opt.options.find(o => o.code === 8).valeur, '192.0.2.0/24');
  verifier('requete : faits DO, sous-reseau, rembourrage',
    [dns.FAITS_DNS.dnssecDemande, dns.FAITS_DNS.sousReseau, dns.FAITS_DNS.rembourrage].every(t => q.faits.some(f => f.texte === t)));
  const autre = octets64(VDNS.requete);
  autre[0] = 0x12; autre[1] = 0x34;
  verifier('identifiant non nul dans une requete DoH : dit', dns.lireMessageDns(autre).faits.some(f => f.texte === dns.FAITS_DNS.identifiant && f.valeurs.id === 0x1234));
}
{
  const r = dns.lireMessageDns(octets64(VDNS.reponse));
  const attendues = [
    'www.example.com.\t300\tIN\tCNAME\tcdn.example.net.',
    'cdn.example.net.\t60\tIN\tHTTPS\t1 . alpn=h3,h2 port=8443 ipv4hint=192.0.2.7 ech=AEX+DQBBgQAgACBlvqoeGhHq',
    'cdn.example.net.\t60\tIN\tA\t192.0.2.7',
    'cdn.example.net.\t60\tIN\tA\t198.51.100.9',
    'cdn.example.net.\t60\tIN\tAAAA\t2001:db8::7',
    'cdn.example.net.\t60\tIN\tAAAA\t2001:db8:0:1::1:0',
    'example.com.\t3600\tIN\tMX\t10 mail.example.com.',
    'example.com.\t3600\tIN\tTXT\t"v=spf1 -all" "second \\"texte\\""',
    '_sip._tcp.example.com.\t3600\tIN\tSRV\t10 60 5060 sip.example.com.',
    'example.com.\t3600\tIN\tCAA\t0 issue "letsencrypt.org"',
    'example.com.\t3600\tIN\tDS\t370 13 2 BE74359954660069D5C63D200C39F5603827D7DD02B56F120EE9F3A86764247C',
    'example.com.\t3600\tIN\tTYPE999\t\\# 3 abcdef'
  ];
  const lues = r.reponses.map(dns.ligneEnregistrement);
  egal('reponse : douze enregistrements', lues.length, attendues.length);
  for (const a of attendues) verifier('reponse : ' + a.split('\t')[3] + ' lu comme dnspython l a ecrit', lues.includes(a), a);
  egal('reponse : SOA dans l autorite', dns.ligneEnregistrement(r.autorite[0]),
    'example.com.\t900\tIN\tSOA\tns1.example.com. hostmaster.example.com. 2026092401 7200 3600 1209600 300');
  verifier('reponse : AD dit', r.faits.some(f => f.texte === dns.FAITS_DNS.authentifie));
  const ede = r.faits.find(f => f.texte === dns.FAITS_DNS.erreurEtendue);
  egal('reponse : erreur etendue 3, nom du registre IANA', ede && ede.valeurs.code + ' ' + ede.valeurs.nom, '3 Stale Answer');
  egal('reponse : statut', r.rcodeNom, 'NoError');
}
{
  const nx = dns.lireMessageDns(octets64(VDNS.nxdomain));
  egal('NXDOMAIN', nx.rcodeNom + ' ' + nx.id, 'NXDomain 4242');
  /* L exemple de la RFC 8484, 4.1.1 : une requete GET. */
  const texte = dns.dnsVersTexte('https://dnsserver.example.net/dns-query?dns=AAABAAABAAAAAAAAA3d3dwdleGFtcGxlA2NvbQAAAQAB');
  verifier('RFC 8484 4.1.1 : www.example.com A', texte.includes(';www.example.com.\t\tIN\tA'), texte);
}
{
  const entete = [0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0];
  leve('pointeur qui vise en avant : refuse', () => dns.lireMessageDns(Uint8Array.from([...entete, 0xc0, 0x0c, 0, 1, 0, 1])));
  leve('type de label reserve : refuse', () => dns.lireMessageDns(Uint8Array.from([...entete, 0x40, 0, 0, 1, 0, 1])));
  leve('message tronque : refuse', () => dns.lireMessageDns(octets64(VDNS.reponse).subarray(0, 40)));
  leve('octets en trop : refuses', () => dns.lireMessageDns(Uint8Array.from([...octets64(VDNS.nxdomain), 0])));
  const long = [];
  for (let k = 0; k < 5; k++) long.push(63, ...new Array(63).fill(0x61));
  leve('nom de plus de 255 octets : refuse', () => dns.lireMessageDns(Uint8Array.from([...entete, ...long, 0, 0, 1, 0, 1])));
  /* 253 octets de labels + la racine = 254 : un nom valide. */
  const juste = [];
  for (let k = 0; k < 3; k++) juste.push(63, ...new Array(63).fill(0x61));
  juste.push(61, ...new Array(61).fill(0x62));
  verifier('nom de 255 octets, racine comprise : accepte', dns.lireMessageDns(Uint8Array.from([...entete, ...juste, 0, 0, 1, 0, 1])).questions.length === 1);
}
{
  const hex = h => Uint8Array.from(h.replace(/\s+/g, '').match(/../g), x => parseInt(x, 16));
  /* Un HTTPS dont la liste « mandatory » nomme une cle inconnue : le format
     de presentation de la RFC 9460 l ecrit keyNNN. */
  const svcb = dns.lireMessageDns(hex('0000 8180 0000 0001 0000 0000  00 0041 0001 0000003c 0016'
    + ' 0001 00  0000 0004 0001 0063  0001 0003 02 6832  0063 0000'));
  egal('SVCB : cle inconnue ecrite keyNNN', svcb.reponses[0].donnees, '1 . mandatory=alpn,key99 alpn=h2 key99');
  /* EDNS Client Subnet dans une famille ni IPv4 ni IPv6 : montre en hexadecimal. */
  const ecs = dns.lireMessageDns(hex('0000 0100 0000 0000 0000 0001  00 0029 04d0 00000000 0008  0008 0004 0003 1800'));
  egal('ECS d une famille inconnue : hexadecimal, pas une adresse inventee', ecs.opt.options[0].valeur, '00031800');
  verifier('boite a outils : message en hexadecimal', dns.dnsVersTexte(Buffer.from(octets64(VDNS.nxdomain)).toString('hex')).includes('NXDomain'));
}
{
  const get = { method: 'GET', url: 'https://doh.test/dns-query?dns=' + VDNS.requete, requestHeaders: [],
    responseHeaders: [{ name: 'content-type', value: 'application/dns-message' }],
    responseBody: { kind: 'binary', base64: Buffer.from(octets64(VDNS.reponse)).toString('base64') } };
  const lus = dns.messagesDnsDe(get);
  verifier('trafic : question lue dans le parametre dns=', !!(lus.question && lus.question.message));
  verifier('trafic : reponse lue dans le corps', !!(lus.reponse && lus.reponse.message));
  egal('trafic : la question se rouvre dans la boite a outils, decodee a l identique',
    transformer('dns-dec', lus.question.brut).valeur, dns.dnsVersTexte(VDNS.requete));
  const post = { method: 'POST', url: 'https://doh.test/dns-query', requestHeaders: [{ name: 'Content-Type', value: 'application/dns-message' }],
    requestBody: { kind: 'raw', text: 'approche', octetsExacts: false }, responseHeaders: [] };
  egal('trafic : corps envoye non conserve en octets, dit', dns.messagesDnsDe(post).question.erreur, 'octets du corps envoye non conserves');
  const sansBase = { ...get, responseBody: { kind: 'binary', base64: null } };
  egal('trafic : corps binaire non conserve, dit', dns.messagesDnsDe(sansBase).reponse.erreur, 'corps binaire non conserve (reglage « corps binaires »)');
  egal('trafic : rien sur une requete ordinaire', JSON.stringify(dns.messagesDnsDe({ method: 'GET', url: 'https://a.test/', requestHeaders: [], responseHeaders: [] })),
    '{"question":null,"reponse":null}');
}

/* ============ 5 bis. Les liens d une ceremonie, cherches par le noyau ======= */
/* L interface n a que des resumes, sans corps : c est le noyau qui retrouve
   l inscription de la meme cle et la reponse qui a emis le defi. */
{
  const { store } = await import('../background/core/store.js');
  const { liensWebAuthn } = await import('../background/core/webauthn-liens.js');
  const [v] = VWA;
  const corps = objet => ({ kind: 'raw', text: JSON.stringify(objet), size: JSON.stringify(objet).length });
  const inscription = store.create({ url: 'https://login.example.com/register', method: 'POST', type: 'xmlhttprequest' });
  inscription.requestBody = corps(v.inscription);
  const options = store.create({ url: 'https://login.example.com/options', method: 'POST', type: 'xmlhttprequest', mime: 'application/json' });
  options.responseBody = { kind: 'text', text: JSON.stringify({ publicKey: { challenge: v.defiConnexion, rpId: 'example.com', allowCredentials: [] } }), size: 90 };
  const grosse = store.create({ url: 'https://login.example.com/gros', method: 'GET', type: 'xmlhttprequest', mime: 'application/json' });
  grosse.responseBody = { kind: 'text', text: '"challenge"' + ' '.repeat(300 * 1024), size: 300 * 1024 };
  const connexion = store.create({ url: 'https://login.example.com/login', method: 'POST', type: 'xmlhttprequest' });
  connexion.requestBody = corps({ credential: v.connexion });
  const l = liensWebAuthn(connexion.id);
  egal('noyau : inscription de la meme cle retrouvee', l.inscription && l.inscription.id, inscription.id);
  egal('noyau : reponse qui a emis le defi retrouvee', l.emetteur && l.emetteur.id, options.id);
  const lu = wa.trouverCredential(connexion.requestBody.text);
  egal('noyau : sa cle verifie la connexion', (await wa.verifierConnexion(lu, l.inscription.jwk, l.inscription.alg)).valide, true);
  const seule = store.create({ url: 'https://autre.test/login', method: 'POST', type: 'xmlhttprequest' });
  seule.requestBody = corps(VWA[1].connexion);
  egal('noyau : sans inscription capturee, rien d invente', liensWebAuthn(seule.id).inscription, null);
  egal('noyau : ligne sans ceremonie', JSON.stringify(liensWebAuthn(options.id)), '{"inscription":null,"emetteur":null}');
}

/* ============================ 7. Boite a outils ============================ */
for (const cle of ['dns-dec', 'webauthn-dec']) {
  const tr = TRANSFORMATIONS.find(x => x.cle === cle);
  verifier(cle + ' : au catalogue', !!tr);
  /* Douze octets quelconques font un en-tete DNS : « Tout essayer » ne doit
     pas le proposer, ce serait une fausse piste. */
  egal(cle + ' : jamais tente par « Tout essayer »', tr && tr.decode, false);
}
verifier('boite a outils : message DNS decode', transformer('dns-dec', VDNS.reponse).valeur.includes('CNAME'));
{
  const sortie = JSON.parse(transformer('webauthn-dec', JSON.stringify(VWA[0].inscription)).valeur);
  egal('boite a outils : ceremonie WebAuthn decodee', sortie.ceremony + ' ' + sortie.authenticatorData.credentialPublicKey.alg, 'registration ES256');
  const seul = JSON.parse(transformer('webauthn-dec', VWA[0].connexion.response.authenticatorData).valeur);
  egal('boite a outils : authenticatorData seul', seul.authenticatorData.signCount, 7);
}

bilan('Signatures, WebAuthn et DNS');
