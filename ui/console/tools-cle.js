/* Panneau « Cle publique » — SWIFT (by D4RK)
 *
 * Une cle publique collee sous n importe quelle forme — PEM, certificat, JWK
 * ou jeu de cles, ligne OpenSSH (un fichier authorized_keys entier), DER en
 * base64 — et toutes ses autres formes et empreintes : l epingle pin-sha256,
 * les empreintes OpenSSH, l empreinte JWK, l identifiant de cle d un
 * certificat. Plusieurs cles collees ensemble sont comparees : la meme cle
 * sous deux formes est reconnue. La lecture vit dans ui/lib/cle-formes.js.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { copy } from '../app.js';
import { lireCles, formesDe } from '../lib/cle-formes.js';
import { empreinteJwk } from '../lib/jwt.js';
import { texteLong } from '../lib/texte-long.js';
import { listeProgressive } from '../lib/liste-progressive.js';

/* Les formes se calculent une fois par texte colle : un redessin les reprend. */
const calculs = new Map();
const resultats = new Map();
function calculer(entree) {
  if (!calculs.has(entree)) {
    if (calculs.size > 20) { calculs.clear(); resultats.clear(); }
    calculs.set(entree, (async () => {
      const cles = lireCles(entree);
      const sortie = [];
      for (const lue of cles) {
        const formes = await formesDe(lue);
        let empreinte = null;
        try { empreinte = await empreinteJwk(formes.jwk); } catch { empreinte = null; }
        sortie.push({ lue, formes, empreinte });
      }
      return sortie;
    /* L erreur est gardee telle quelle, et traduite a l affichage : la langue
       peut changer entre-temps. */
    })().then(r => { resultats.set(entree, { ok: true, cles: r }); }, e => { resultats.set(entree, { ok: false, erreur: e }); }));
  }
  return calculs.get(entree);
}

function forme(box, titre, texte) {
  if (!texte) return;
  box.appendChild(sec(titre));
  box.appendChild(texteLong(texte));
  box.appendChild(el('div', { class: 'actions' }, button('Copier', () => copy(texte, 'Copie'))));
}

function blocCle(box, { lue, formes, empreinte }, n) {
  const precision = lue.kid ? 'kid ' + lue.kid : lue.commentaire || '';
  box.appendChild(sec(tp('Cle {n}', { n }), t(lue.source) + (precision ? ' — ' + precision : '')));
  add(box, kv('Type', lue.cle.genre === 'RSA' ? 'RSA, ' + formes.taille : lue.cle.genre === 'EC' ? 'ECDSA, ' + formes.taille : formes.taille, { hl: true }));
  add(box, kv('Epingle pin-sha256 (RFC 7469)', formes.pin, { copy: true, hl: true }));
  add(box, kv('Empreinte OpenSSH (SHA256)', formes.empreinteSsh, { copy: true }));
  add(box, kv('Empreinte OpenSSH (MD5)', formes.empreinteMd5, { copy: true }));
  add(box, kv('Empreinte JWK (RFC 7638)', empreinte, { copy: true }));
  add(box, kv('Identifiant de cle (RFC 5280 §4.2.1.2)', formes.identifiantCle, { copy: true }));
  add(box, kv('Empreinte du certificat (SHA-256)', formes.empreinteCertificat, { copy: true }));
  if (!formes.ssh) box.appendChild(el('p', { class: 'note', text: t('OpenSSH n a pas de forme pour cette cle.') }));
  forme(box, 'PEM (SubjectPublicKeyInfo)', formes.pem);
  forme(box, 'PEM (PKCS #1)', formes.pkcs1);
  forme(box, 'JWK', JSON.stringify(formes.jwk, null, 2));
  forme(box, 'Ligne OpenSSH', formes.ssh);
}

/* Plusieurs cles : celles qui sont la meme, reconnues a leur epingle. */
function memes(box, cles) {
  const groupes = new Map();
  cles.forEach((c, i) => {
    if (!groupes.has(c.formes.pin)) groupes.set(c.formes.pin, []);
    groupes.get(c.formes.pin).push(i + 1);
  });
  const doubles = [...groupes.values()].filter(g => g.length > 1);
  if (!doubles.length) {
    box.appendChild(el('p', { class: 'note', text: tp('Ces {n} cles sont toutes differentes.', { n: cles.length }) }));
    return;
  }
  for (const g of doubles) {
    box.appendChild(el('p', { class: 'note', text: tp('Les cles {liste} sont la meme cle, sous des formes differentes.', { liste: g.join(', ') }) }));
  }
}

export function panneauClePublique(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Cle publique', 'une cle, toutes ses formes et empreintes'));
  box.appendChild(el('p', { class: 'note', text: t('Collez une cle publique : PEM, certificat, JWK ou jeu de cles, ligne OpenSSH (un fichier authorized_keys entier), ou DER en base64. Ses autres formes et ses empreintes en sortent — de quoi dire si deux cles vues a deux endroits sont la meme.') }));
  const texte = String(entree || '').trim();
  if (!texte) return box;
  const fini = resultats.get(texte);
  if (!fini) {
    box.appendChild(el('p', { class: 'note', text: t('Calcul des formes de la cle…') }));
    calculer(texte).then(() => redessiner());
    return box;
  }
  if (!fini.ok) {
    box.appendChild(el('p', { class: 'note warn', text: te(fini.erreur) }));
    return box;
  }
  if (fini.cles.length > 1) memes(box, fini.cles);
  /* Un fichier authorized_keys peut en compter des centaines : rendues par
     lots, toutes, sans plafond. */
  const hote = el('div');
  box.appendChild(hote);
  listeProgressive(hote, fini.cles.map((c, i) => [c, i + 1]), ([c, n]) => {
    const bloc = el('div');
    blocCle(bloc, c, n);
    return bloc;
  });
  return box;
}
