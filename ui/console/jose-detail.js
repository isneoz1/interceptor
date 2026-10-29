/* Jetons JWT, jeux de cles et documents de decouverte — SWIFT (by D4RK)
 *
 * Onglet En-tetes : chaque jeton JWT que porte la requete — entete
 * Authorization, cookie, adresse, corps — lu, date par rapport au moment de
 * la capture, et sa signature VERIFIEE avec la cle de son emetteur quand la
 * capture la contient : le document de decouverte de l emetteur donne
 * l adresse de son jeu de cles (« jwks_uri »), et le « kid » du jeton y
 * designe la cle (RFC 7515 §4.1.4). Rien n est a coller.
 *
 * Onglet Reponse : un jeu de cles (RFC 7517) et un document de decouverte
 * (RFC 8414, OpenID Connect Discovery) sont lus, et ce qu ils ont de travers
 * est dit — une cle privee publiee, un emetteur qui ne correspond pas a
 * l adresse du document.
 *
 * Les lectures vivent dans ui/lib/jwt.js, jwks.js et decouverte.js ; les
 * corps captures ailleurs, dans le noyau (background/core/jose-liens.js).
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { state, cmd, copy } from '../app.js';
import { clock } from '../lib/format.js';
import { poser } from './tools.js';
import { decoderJwt } from '../lib/inspect.js';
import { enteteJwt, ALGORITHMES_JWT, empreinteJwk } from '../lib/jwt.js';
import { lireJwks, verifierAvecJeu, nomCle } from '../lib/jwks.js';
import { lireDecouverte } from '../lib/decouverte.js';
import { parLots } from './detail-more.js';

const TAILLE_MAX = 256 * 1024;
const JETONS_MAX = 12;
const MOTIF_JWT = /eyJ[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]{2,}\.[A-Za-z0-9_-]*/g;
const note = (texte, alerte) => el('p', { class: 'note' + (alerte ? ' warn' : ''), text: texte });
/* Une ligne dont le nom est une donnee — un kid, un membre du document — :
   il s affiche tel quel, sans passer par la traduction. */
const donnee = (nom, valeur) => el('div', { class: 'kv' }, [el('span', { text: nom }), el('b', { text: valeur })]);

/* ------------------------------ Les jetons ------------------------------- */
function chercher(texte, ou, trouves) {
  if (typeof texte !== 'string' || !texte || texte.length > TAILLE_MAX) return;
  for (const m of texte.matchAll(MOTIF_JWT)) {
    const avant = m.index > 0 ? texte[m.index - 1] : '';
    /* Un morceau d un texte plus long n est pas un jeton. Un jeton chiffre
       (JWE) se reconnait plus loin a son en-tete (« enc »). */
    if (/[A-Za-z0-9_-]/.test(avant)) continue;
    if (!trouves.has(m[0])) trouves.set(m[0], ou);
  }
}

/** Les jetons que porte un enregistrement, et ou : [{ jeton, ou: { texte, valeurs } }]. */
export function jetonsDe(rec) {
  const trouves = new Map();
  chercher(rec.finalUrl || rec.url, { texte: 'l adresse' }, trouves);
  for (const h of rec.requestHeaders || []) {
    if (!h || typeof h.value !== 'string') continue;
    if (/^cookie$/i.test(h.name || '')) {
      for (const morceau of h.value.split(';')) {
        const i = morceau.indexOf('=');
        if (i > 0) chercher(morceau.slice(i + 1), { texte: 'le cookie « {nom} »', valeurs: { nom: morceau.slice(0, i).trim() } }, trouves);
      }
    } else chercher(h.value, { texte: 'l entete « {nom} »', valeurs: { nom: h.name } }, trouves);
  }
  chercher(rec.requestBody && rec.requestBody.text, { texte: 'le corps envoye' }, trouves);
  for (const h of rec.responseHeaders || []) {
    if (h && typeof h.value === 'string') chercher(h.value, { texte: 'l entete de reponse « {nom} »', valeurs: { nom: h.name } }, trouves);
  }
  chercher(rec.responseBody && rec.responseBody.text, { texte: 'le corps recu' }, trouves);
  const jetons = [];
  for (const [jeton, ou] of trouves) {
    let entete;
    try { entete = enteteJwt(jeton); } catch { continue; }
    /* Un en-tete JOSE est un objet ; « enc » le dit chiffre (RFC 7516). */
    if (!entete || typeof entete !== 'object' || Array.isArray(entete) || entete.enc !== undefined) continue;
    jetons.push({ jeton, ou, entete });
    if (jetons.length >= JETONS_MAX) break;
  }
  return jetons;
}

/* Les cles d un emetteur, cherchees par le noyau ; gardees tant que la
   capture ne change pas de taille. */
const cles = new Map();
function clesDe(iss) {
  const cle = (iss || '') + ':' + (state.lastTotal || 0) + ':' + (state.records ? state.records.size : 0);
  if (!cles.has(cle)) {
    if (cles.size > 100) cles.clear();
    cles.set(cle, Promise.resolve()
      .then(() => cmd('clesJose', { iss: iss || '' }))
      /* Une reponse sans la forme attendue vaut une capture sans cles. */
      .then(r => (r && !r.error && Array.isArray(r.jeux) ? r : { decouverte: null, jeux: [] }), () => ({ decouverte: null, jeux: [] })));
  }
  return cles.get(cle);
}

/* L emplacement du document de decouverte d un emetteur, tel qu OpenID
   Connect Discovery §4 le derive : le « / » final retire, puis le suffixe. */
const adresseDecouverte = iss => iss.replace(/\/$/, '') + '/.well-known/openid-configuration';

/**
 * Le verdict d un jeton : { etat, ... }. Les etats : nonSigne, algorithme,
 * valide, invalide, secret, aucuneCle, sansCles.
 */
export async function verdictJeton(jeton, entete, charge) {
  const alg = typeof entete.alg === 'string' ? entete.alg : '';
  if (alg === 'none') return { etat: 'nonSigne' };
  if (!ALGORITHMES_JWT.includes(alg)) {
    const proche = ['none', ...ALGORITHMES_JWT].find(a => a.toLowerCase() === alg.toLowerCase());
    return { etat: 'algorithme', alg, proche: proche || null };
  }
  const iss = charge && typeof charge.iss === 'string' ? charge.iss : null;
  const trouve = await clesDe(iss);
  const jeux = [...trouve.jeux].sort((a, b) => Number(b.deLEmetteur) - Number(a.deLEmetteur));
  const echecs = [];
  for (const jeu of jeux) {
    const lu = lireJwks({ keys: jeu.keys });
    if (!lu) continue;
    const v = await verifierAvecJeu(jeton, lu, entete);
    if (v.valide) return { etat: 'valide', cle: v.cle, jeu, iss };
    /* Seul le jeu de l emetteur — relie a lui par son document de
       decouverte — peut condamner un jeton : la cle d un autre emetteur qui
       echoue ne prouve rien contre lui. */
    if (v.essais.length && jeu.deLEmetteur) echecs.push({ jeu, essais: v.essais });
  }
  if (echecs.length) return { etat: 'invalide', echec: echecs[0], iss, kid: typeof entete.kid === 'string' ? entete.kid : null };
  if (/^HS/.test(alg)) return { etat: 'secret' };
  const lies = jeux.filter(j => j.deLEmetteur).length;
  if (lies) return { etat: 'aucuneCle', n: lies, kid: typeof entete.kid === 'string' ? entete.kid : null, alg };
  return { etat: 'sansCles', iss, decouverte: trouve.decouverte };
}

function texteVerdict(v) {
  switch (v.etat) {
    case 'nonSigne': return [t('Non signe (« alg: none ») : n importe qui peut ecrire ce jeton.'), true];
    case 'algorithme': return [v.proche
      ? tp('Algorithme « {alg} » inconnu : la casse compte, et ce n est pas « {proche} » (RFC 7515 §4.1.1). Un serveur conforme refuse ce jeton.', v)
      : tp('Algorithme « {alg} » : non verifiable ici.', v), true];
    case 'valide': return [v.jeu.deLEmetteur
      ? tp('Signature verifiee avec la cle {cle} que l emetteur {iss} publie a {url} (capturee a {heure}).',
        { cle: nomCle(v.cle), iss: v.iss, url: v.jeu.url, heure: v.jeu.at ? clock(v.jeu.at) : '?' })
      : v.iss
        ? tp('Signature verifiee avec la cle {cle} du jeu de cles capture a {url} — rien dans la capture ne relie ce jeu a l emetteur {iss}.',
          { cle: nomCle(v.cle), url: v.jeu.url, iss: v.iss })
        : tp('Signature verifiee avec la cle {cle} du jeu de cles capture a {url}.', { cle: nomCle(v.cle), url: v.jeu.url }), false];
    case 'invalide': return [v.kid !== null
      ? tp('Signature FAUSSE : la cle « {kid} » de {url}, que ce jeton designe, ne l a pas signe — jeton modifie, ou signe par une autre cle.',
        { kid: v.kid, url: v.echec.jeu.url })
      : tp('Signature FAUSSE : aucune des cles candidates de {url} ne l a signe.', { url: v.echec.jeu.url }), true];
    case 'secret': return [t('Signe avec une cle partagee (HMAC) : seul le serveur detient le secret. Si vous l avez, la boite a outils verifie la signature.'), false];
    case 'erreur': return [tp('Verification impossible : {raison}', v), true];
    case 'aucuneCle': return [v.kid !== null
      ? tp('Le jeu de cles de l emetteur ne contient pas la cle « {kid} » que ce jeton designe.', v)
      : tp('Aucune cle du jeu de l emetteur ne convient a l algorithme {alg}.', v), false];
    default: return [v.decouverte && v.decouverte.jwksUri
      ? tp('Signature non verifiee : le jeu de cles de l emetteur ({url}) n a pas ete capture. Ouvrez cette adresse dans un onglet, puis revenez ici.', { url: v.decouverte.jwksUri })
      : v.iss
        ? tp('Signature non verifiee : aucun jeu de cles de l emetteur dans la capture. Son document de decouverte ({url}) donne l adresse de ses cles (« jwks_uri ») : ouvrez-les dans un onglet, puis revenez ici.', { url: adresseDecouverte(v.iss) })
        : t('Signature non verifiee : aucun jeu de cles dans la capture, et le jeton ne nomme pas son emetteur (« iss »). La boite a outils verifie une cle publique collee.'), false];
  }
}

/* Les verdicts deja calcules, pour qu un redessin ne relance rien. */
const verdicts = new Map();
function verdictGarde(rec, jeton, entete, charge) {
  const cle = rec.id + ':' + jeton.length + ':' + jeton.slice(-24) + ':' + (state.lastTotal || 0) + ':' + (state.records ? state.records.size : 0);
  if (!verdicts.has(cle)) {
    if (verdicts.size > 200) verdicts.clear();
    verdicts.set(cle, verdictJeton(jeton, entete, charge).catch(e => ({ etat: 'erreur', raison: te(e) })));
  }
  return verdicts.get(cle);
}

/* Une date de revendication lue par rapport au moment de la capture. */
function dates(box, charge, capture) {
  const seconde = n => (typeof n === 'number' && Number.isFinite(n) && Math.abs(n * 1000) <= 8.64e15 ? n : null);
  const exp = seconde(charge.exp), nbf = seconde(charge.nbf), iat = seconde(charge.iat);
  if (iat !== null) add(box, kv('Emis le', new Date(iat * 1000).toISOString()));
  if (exp !== null) add(box, kv('Expire le', new Date(exp * 1000).toISOString(), { hl: true }));
  if (capture === null) return;
  if (exp !== null && exp <= capture) box.appendChild(note(t('Deja expire au moment de la capture.'), true));
  if (nbf !== null && nbf > capture) box.appendChild(note(t('Pas encore valide au moment de la capture.'), true));
}

/** Le bloc « Jetons JWT » de l onglet En-tetes. */
export function jetonsJwt(rec) {
  const box = frag();
  const jetons = jetonsDe(rec);
  if (!jetons.length) return box;
  const capture = typeof rec.startTime === 'number' && rec.startTime > 0 ? Math.floor(rec.startTime / 1000) : null;
  jetons.forEach(({ jeton, ou, entete }, i) => {
    let lu = null;
    try { lu = decoderJwt(jeton); } catch { lu = null; }
    const charge = lu && lu.charge && typeof lu.charge === 'object' ? lu.charge : {};
    box.appendChild(sec(tp('Jeton JWT {n}', { n: i + 1 }), tp('dans {ou}', { ou: tp(ou.texte, ou.valeurs || {}) })));
    add(box, kv('Algorithme', typeof entete.alg === 'string' ? entete.alg : t('absent'), { hl: true }));
    add(box, kv('Cle designee (kid)', typeof entete.kid === 'string' ? entete.kid : null));
    const texteDe = v => (typeof v === 'string' ? v : Array.isArray(v) ? v.map(String).join(', ') : null);
    add(box, kv('Emetteur (iss)', texteDe(charge.iss), { copy: true }));
    add(box, kv('Sujet (sub)', texteDe(charge.sub), { copy: true }));
    add(box, kv('Audience (aud)', texteDe(charge.aud), { copy: true }));
    dates(box, charge, capture);
    if (entete.alg === 'EdDSA') box.appendChild(note(t('« EdDSA » est deprecie depuis RFC 9864 : « Ed25519 » le remplace.')));
    const ligne = note(t('Verification de la signature…'));
    box.appendChild(ligne);
    verdictGarde(rec, jeton, entete, charge).then(v => {
      const [texte, alerte] = texteVerdict(v);
      ligne.textContent = texte;
      ligne.className = 'note' + (alerte ? ' warn' : '');
    });
    box.appendChild(el('div', { class: 'actions' }, [
      button('Ouvrir dans la boite a outils', () => poser(jeton, { vers: 'jwt' })),
      button('Copier le jeton', () => copy(jeton, 'Jeton copie'))
    ]));
  });
  return box;
}

/* --------------------------- Un jeu de cles recu -------------------------- */
const corpsRecu = rec => (rec.responseBody && typeof rec.responseBody.text === 'string'
  && rec.responseBody.text.length <= TAILLE_MAX ? rec.responseBody.text : null);

function decrireCle(c) {
  const morceaux = [c.kty];
  if (c.crv) morceaux.push(c.crv);
  if (c.bits !== null) morceaux.push(tp('{n} bits', { n: c.bits }));
  if (c.alg) morceaux.push(c.alg);
  if (c.use) morceaux.push(tp('usage {use}', { use: c.use }));
  return morceaux.join(' · ');
}

/** Le bloc « Jeu de cles JWK » de l onglet Reponse. */
export function jwksReponse(rec) {
  const box = frag();
  const texte = corpsRecu(rec);
  if (!texte || !texte.includes('"keys"')) return box;
  const jeu = lireJwks(texte);
  if (!jeu) return box;
  box.appendChild(sec('Jeu de cles JWK (RFC 7517)', tp('{n} cle(s)', { n: jeu.cles.length })));
  for (const f of jeu.faits) box.appendChild(note('•  ' + tp(f.texte, f.valeurs), f.grave));
  const hote = el('div');
  box.appendChild(hote);
  parLots(hote, jeu.cles, c => {
    const ligne = el('div');
    ligne.appendChild(donnee(nomCle(c), decrireCle(c)));
    const empreinte = el('p', { class: 'note', text: '' });
    ligne.appendChild(empreinte);
    empreinteJwk(c.jwk).then(e => { empreinte.textContent = tp('empreinte RFC 7638 : {e}', { e }); }, () => {});
    return ligne;
  });
  return box;
}

/* ------------------------ Un document de decouverte ----------------------- */
const valeurLisible = v => (Array.isArray(v) ? v.join(', ') : typeof v === 'object' && v !== null ? JSON.stringify(v) : String(v));

/** Le bloc « Decouverte » de l onglet Reponse. */
export function decouverteReponse(rec) {
  const box = frag();
  const texte = corpsRecu(rec);
  if (!texte) return box;
  const d = lireDecouverte(rec.finalUrl || rec.url, texte);
  if (!d) return box;
  box.appendChild(sec(d.oidc ? 'Decouverte OpenID Connect' : 'Metadonnees du serveur d autorisation (RFC 8414)', d.issuer || ''));
  if (d.conforme) {
    box.appendChild(note(t('issuer conforme : c est bien l emetteur que designe l adresse de ce document (RFC 8414 §3.3, OpenID Connect Discovery §4.3).')));
  }
  for (const f of d.faits) box.appendChild(note('•  ' + tp(f.texte, f.valeurs), f.grave));
  for (const [nom, valeur] of Object.entries(d.champs)) box.appendChild(donnee(nom, valeurLisible(valeur)));
  /* Le jeu de cles annonce, s il a ete capture : un clic l ouvre. */
  const jwks = typeof d.champs.jwks_uri === 'string' ? d.champs.jwks_uri : null;
  if (jwks && state.records) {
    const capte = [...state.records.values()].find(r => r && (r.finalUrl || r.url) === jwks);
    if (capte) {
      box.appendChild(el('div', { class: 'actions' }, button('Ouvrir le jeu de cles capture', () =>
        document.dispatchEvent(new CustomEvent('ic:goto', { detail: { id: capte.id } })))));
    } else {
      box.appendChild(note(t('Le jeu de cles (jwks_uri) n a pas ete capture : ouvrez son adresse dans un onglet pour que les jetons de cet emetteur soient verifies.')));
    }
  }
  return box;
}
