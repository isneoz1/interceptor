/* Une cle publique sous toutes ses formes — SWIFT (by D4RK)
 *
 *   node tests/cles.test.mjs
 *
 * Ce que la 5.8 ajoute, verifie contre des outils independants qui ont lu les
 * MEMES cles (tests/vecteurs-cles.json) : OpenSSL 3.5 (PEM SubjectPublicKeyInfo
 * et PKCS #1, epingle pin-sha256, certificats, leur empreinte SHA-256 et leur
 * identifiant de cle), OpenSSH 10.3 (lignes ssh-*, empreintes SHA256 et MD5)
 * et Node (JWK). Sept cles : Ed25519, Ed448, RSA 2048 et 3072, ECDSA P-256,
 * P-384 et P-521. Chaque cle est lue sous chacune de ses formes, et chacune
 * redonne toutes les autres a l octet pres.
 */
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { installerTout, installerPage, egal, verifier, bilan } from './harnais.mjs';

installerTout();
const ici = path.dirname(url.fileURLToPath(import.meta.url));
installerPage(path.resolve(ici, '..'));

let auBilan = false;
process.on('exit', () => {
  if (auBilan) return;
  console.log('  Cles : suite interrompue avant son bilan');
  process.exitCode = 1;
});

const V = JSON.parse(fs.readFileSync(path.join(ici, 'vecteurs-cles.json'), 'utf8'));
const C = await import('../ui/lib/cle-formes.js');
const { setLang } = await import('../ui/lib/i18n.js');
const net = s => String(s).replace(/\r/g, '').trim();
const texte = n => (n.textContent || '') + ' ' + (n.children || []).map(texte).join(' ');
const memeJwk = (a, b) => Object.keys(a).length === Object.keys(b).length && Object.keys(b).every(k => a[k] === b[k]);

/* ============ 1. Chaque forme de chaque cle redonne toutes les autres ======= */
for (const [nom, v] of Object.entries(V)) {
  if (nom === '_source') continue;
  const formes = [['PEM', v.pem], ['JWK', JSON.stringify(v.jwk)]];
  if (v.ssh) formes.push(['ligne OpenSSH', v.ssh]);
  if (v.pemPkcs1) formes.push(['PKCS #1', v.pemPkcs1]);
  if (v.certificat) formes.push(['certificat', v.certificat]);
  formes.push(['DER en base64', net(v.pem).split('\n').slice(1, -1).join('')]);
  for (const [forme, entree] of formes) {
    const lues = C.lireCles(entree);
    const f = await C.formesDe(lues[0]);
    const quoi = nom + ' lu en ' + forme;
    egal(quoi + ' : epingle pin-sha256 d OpenSSL', f.pin, v.pin);
    egal(quoi + ' : PEM d OpenSSL', net(f.pem), net(v.pem));
    verifier(quoi + ' : JWK de Node', memeJwk(f.jwk, v.jwk), JSON.stringify(f.jwk));
    if (v.ssh) {
      egal(quoi + ' : ligne d OpenSSH', f.ssh.split(' ').slice(0, 2).join(' '), v.ssh.split(' ').slice(0, 2).join(' '));
      egal(quoi + ' : empreinte SHA256 d ssh-keygen', f.empreinteSsh, v.empreinteSsh);
      egal(quoi + ' : empreinte MD5 d ssh-keygen', f.empreinteMd5, v.empreinteMd5);
    } else {
      egal(quoi + ' : OpenSSH n a pas de forme pour elle', f.ssh, null);
    }
    if (v.pemPkcs1) egal(quoi + ' : PKCS #1 d OpenSSL', net(f.pkcs1), net(v.pemPkcs1));
    if (forme === 'certificat') {
      egal(quoi + ' : empreinte SHA-256 du certificat d OpenSSL', f.empreinteCertificat, v.empreinteCertificat);
      egal(quoi + ' : identifiant de cle d OpenSSL (RFC 5280 §4.2.1.2)', f.identifiantCle, v.identifiantCle);
    }
  }
}
egal('le commentaire d une ligne OpenSSH est garde', C.lireCles(V.ed25519.ssh)[0].commentaire, 'essai@swift');

/* ======================= 2. Plusieurs cles, et des refus ================== */
const fichier = ['# cles autorisees', 'from="10.0.0.1",no-pty ' + V.ed25519.ssh, '', V.rsa2048.ssh, 'command="true" ' + V.ec256.ssh].join('\n');
egal('un fichier authorized_keys entier : trois cles, options et commentaires compris', C.lireCles(fichier).length, 3);
egal('un jeu de cles JWK : chaque cle', C.lireCles(JSON.stringify({ keys: [V.ed25519.jwk, V.rsa2048.jwk] })).length, 2);
egal('deux PEM colles ensemble', C.lireCles(V.ec256.pem + '\n' + V.ec384.pem).length, 2);
const refus = entree => { try { C.lireCles(entree); return null; } catch (e) { return e.message; } };
verifier('une cle privee est refusee', /cle privee/.test(refus('-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEIA==\n-----END PRIVATE KEY-----') || ''));
verifier('une cle privee OpenSSH aussi', /cle privee/.test(refus('-----BEGIN OPENSSH PRIVATE KEY-----\nb3BlbnNzaA==\n-----END OPENSSH PRIVATE KEY-----') || ''));
verifier('une JWK symetrique n est pas une cle publique', /symetrique/.test(refus('{"kty":"oct","k":"AAAA"}') || ''));
const menteuse = 'ssh-rsa ' + V.ed25519.ssh.split(' ')[1];
verifier('une ligne qui annonce un autre type que sa cle est refusee', /annonce ssh-rsa, la cle est ssh-ed25519/.test(refus(menteuse) || ''), refus(menteuse));
verifier('une coordonnee de mauvaise taille est refusee (RFC 7518 §6.2.1.2)', /32 octets/.test(refus(JSON.stringify({ ...V.ec256.jwk, x: 'AAAA' })) || ''));
verifier('un texte quelconque est refuse, et dit pourquoi', /cle publique attendue/.test(refus('bonjour') || ''));

/* ========================= 3. L interface ================================ */
const { panneauClePublique } = await import('../ui/console/tools-cle.js');
const attendre = () => new Promise(r => setTimeout(r, 30));
for (const langue of ['fr', 'en']) {
  setLang(langue);
  const entree = V.ec256.pem + '\n' + V.ec256.ssh + '\n' + V.rsa2048.pem;
  panneauClePublique(entree, {}, () => {});
  for (let i = 0; i < 40 && !texte(panneauClePublique(entree, {}, () => {})).includes(V.ec256.pin); i++) await attendre();
  const boite = document.createElement('div');
  boite.appendChild(panneauClePublique(entree, {}, () => {}));
  const vu = texte(boite);
  verifier('boite a outils [' + langue + '] : les empreintes de chaque cle', vu.includes(V.ec256.pin) && vu.includes(V.ec256.empreinteSsh) && vu.includes(V.rsa2048.pin));
  verifier('boite a outils [' + langue + '] : la meme cle sous deux formes est reconnue',
    vu.includes(langue === 'en' ? 'Keys 1, 2 are the same key' : 'Les cles 1, 2 sont la meme cle'), vu.slice(0, 400));
  const ed448 = document.createElement('div');
  panneauClePublique(V.ed448.pem, {}, () => {});
  for (let i = 0; i < 40 && !texte(panneauClePublique(V.ed448.pem, {}, () => {})).includes(V.ed448.pin); i++) await attendre();
  ed448.appendChild(panneauClePublique(V.ed448.pem, {}, () => {}));
  verifier('boite a outils [' + langue + '] : Ed448, sans forme OpenSSH, le dit', texte(ed448).includes(langue === 'en' ? 'OpenSSH has no form for this key' : 'OpenSSH n a pas de forme pour cette cle'));
  const erreur = document.createElement('div');
  panneauClePublique('bonjour', {}, () => {});
  await attendre();
  erreur.appendChild(panneauClePublique('bonjour', {}, () => {}));
  verifier('boite a outils [' + langue + '] : un texte qui n est pas une cle est dit tel', texte(erreur).includes(langue === 'en' ? 'public key expected' : 'cle publique attendue'));
}
setLang('fr');

auBilan = true;
bilan('Une cle publique sous toutes ses formes');
