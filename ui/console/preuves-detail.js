/* Signatures HTTP, WebAuthn et DNS dans le panneau de detail — SWIFT (by NeoZ)
 *
 *   En-tetes   les signatures de messages HTTP (RFC 9421) : ce qu elles
 *              couvrent, la base exacte signee, et la verification avec une
 *              cle fournie
 *   Requete    une inscription ou une connexion par cle d acces (WebAuthn),
 *              une question DNS par HTTPS
 *   Reponse    les options WebAuthn envoyees par le serveur, une reponse DNS
 *
 * Rien ne s affiche quand il n y a rien. Une signature de connexion WebAuthn
 * se verifie seule quand l inscription de la meme cle a ete capturee.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te, deuxPoints } from '../lib/i18n.js';
import { state, copy, cmd } from '../app.js';
import { poser } from './tools.js';
import { lireSignaturesHttp, verifierSignatureHttp, ALGORITHMES_SIGNATURE } from '../lib/signatures-http.js';
import {
  trouverCredential, trouverOptions, faitsCeremonie, verifierConnexion, DRAPEAUX
} from '../lib/webauthn.js';
import { messagesDnsDe, ligneEnregistrement, valeurOption } from '../lib/dns-message.js';

const note = (texte, classe = 'note') => el('p', { class: classe, text: texte });
const faits = (box, liste) => { for (const f of liste) box.appendChild(note('•  ' + tp(f.texte, f.valeurs || {}))); };
const dateDe = s => (Number.isInteger(s) ? new Date(s * 1000).toISOString() : null);

/* Ce qui est tape et ce qui a ete verifie survit au redessin du panneau ; la
   memoire reste bornee, meme apres des milliers de lignes ouvertes. */
const saisies = new Map();
const verdicts = new Map();
const BORNE = 200;
function retenir(table, cle, valeur) {
  if (!table.has(cle) && table.size >= BORNE) table.delete(table.keys().next().value);
  table.set(cle, valeur);
  return valeur;
}

function verdictNote(v) {
  if (!v) return null;
  if (v.erreur) return note(t('Verification impossible : ') + te(v.erreur), 'note warn');
  return note(v.valide ? tp('Signature valide ({alg})', { alg: v.algorithme }) : tp('Signature invalide ({alg})', { alg: v.algorithme }),
    'note ' + (v.valide ? 'ok' : 'ko'));
}

/* ------------------------- Signatures de messages ------------------------- */
function formulaireSignature(box, s, cle) {
  const etat = saisies.get(cle) || { texte: '', alg: s.parametres.alg || 'rsa-pss-sha512', forme: 'base64' };
  retenir(saisies, cle, etat);
  const zone = el('textarea', { class: 'field', rows: '4', spellcheck: 'false', dataset: { champ: 'sig-' + cle },
    placeholder: t('Cle publique (PEM, JWK ou certificat), ou secret partage pour hmac-sha256') });
  zone.value = etat.texte;
  zone.addEventListener('input', () => { etat.texte = zone.value; });
  box.appendChild(zone);
  const actions = el('div', { class: 'actions' });
  if (!s.parametres.alg) {
    const choix = el('select', { class: 'field', dataset: { champ: 'sig-alg-' + cle } });
    for (const nom of Object.keys(ALGORITHMES_SIGNATURE)) choix.appendChild(el('option', { value: nom, text: nom, selected: nom === etat.alg }));
    choix.addEventListener('change', () => { etat.alg = choix.value; });
    actions.appendChild(choix);
  }
  /* La forme du secret ne sert qu a HMAC : on ne la propose que la ou elle sert. */
  if (!s.parametres.alg || s.parametres.alg === 'hmac-sha256') {
    const forme = el('select', { class: 'field', title: t('Forme du secret partage') });
    for (const [v, libelle] of [['base64', 'secret en base64'], ['hex', 'secret en hexadecimal'], ['texte', 'secret en texte']]) {
      forme.appendChild(el('option', { value: v, text: t(libelle), selected: v === etat.forme }));
    }
    forme.addEventListener('change', () => { etat.forme = forme.value; });
    actions.appendChild(forme);
  }
  const sortie = el('div');
  actions.appendChild(button('Verifier la signature', () => {
    const alg = s.parametres.alg || etat.alg;
    verifierSignatureHttp({ base: s.base, signature: s.signature, algorithme: alg, cle: etat.texte, formeSecret: etat.forme })
      .then(v => v, e => ({ erreur: te(e), algorithme: alg }))
      .then(v => { retenir(verdicts, cle, v); sortie.textContent = ''; add(sortie, verdictNote(v)); });
  }));
  box.appendChild(actions);
  add(sortie, verdictNote(verdicts.get(cle)));
  box.appendChild(sortie);
}

/* Un gabarit d erreur, traduit ; un message venu d un lecteur l est par te(). */
function gabarit(erreur) {
  const valeurs = { ...(erreur.valeurs || {}) };
  if (erreur.texte === '{erreur}') valeurs.erreur = te(valeurs.erreur);
  return tp(erreur.texte, valeurs);
}

export function signaturesHttp(rec) {
  const box = frag();
  let liste;
  try { liste = lireSignaturesHttp(rec); } catch { return box; }
  for (const s of liste) {
    const sens = t(s.sens === 'requete' ? 'requete' : 'reponse');
    box.appendChild(sec('Signature de message HTTP (RFC 9421)', (s.libelle ? s.libelle + '  ·  ' : '') + sens));
    if (s.erreurLecture) {
      box.appendChild(note(t('Illisible : ') + deuxPoints(s.erreurLecture.entete, gabarit(s.erreurLecture)), 'note warn'));
      continue;
    }
    const p = s.parametres;
    add(box, kv('Composants couverts', s.composants.length ? s.composants.join(' ') : t('(aucun)'), { copy: true }));
    add(box, kv('Creee le', dateDe(p.created)));
    add(box, kv('Expire le', dateDe(p.expires)));
    add(box, kv('Cle (keyid)', p.keyid, { copy: true }));
    add(box, kv('Algorithme', p.alg || t('non annonce')));
    add(box, kv('Nonce', p.nonce, { copy: true }));
    add(box, kv('Etiquette (tag)', p.tag));
    if (p.autres && p.autres.length) add(box, kv('Autres parametres', p.autres.join(', ')));
    faits(box, s.faits);
    if (s.erreurBase) {
      box.appendChild(note(t('Base de signature non reconstruite : ') + gabarit(s.erreurBase), 'note warn'));
      continue;
    }
    if (!s.signature) continue;
    box.appendChild(note(t('La base exacte que l emetteur a signee, reconstruite depuis ce que Firefox a rapporte :')));
    box.appendChild(el('pre', { class: 'pre', text: s.base }));
    box.appendChild(el('div', { class: 'actions' }, [button('Copier la base', () => copy(s.base, 'Base copiee'))]));
    formulaireSignature(box, s, rec.id + ':' + s.sens + ':' + s.libelle);
  }
  return box;
}

/* --------------------------------- WebAuthn -------------------------------- */
/* L inscription de la meme cle et la reponse qui a emis le defi vivent dans
   d autres lignes, et dans leurs corps : l interface n a que des resumes, le
   noyau cherche. Le panneau se redessine souvent ; la reponse est gardee tant
   que la capture ne change pas de taille. */
const SANS_LIEN = { inscription: null, emetteur: null };
const liens = new Map();
function liensDe(rec) {
  const cle = rec.id + ':' + (state.lastTotal || 0) + ':' + (state.records ? state.records.size : 0);
  if (!liens.has(cle)) {
    if (liens.size > 100) liens.clear();
    liens.set(cle, Promise.resolve()
      .then(() => cmd('webauthnLiens', { id: rec.id }))
      .then(r => (r && !r.error ? { ...SANS_LIEN, ...r } : SANS_LIEN), () => SANS_LIEN));
  }
  return liens.get(cle);
}

function drapeauxTexte(d) {
  return DRAPEAUX.filter(([, nom]) => d.drapeaux[nom]).map(([, nom, sens]) => nom + ' (' + t(sens) + ')').join(', ') || t('(aucun)');
}

function formulaireConnexion(zone, lu, cle) {
  const etat = saisies.get(cle) || { texte: '', alg: 'ES256' };
  retenir(saisies, cle, etat);
  zone.appendChild(note(t('L inscription de cette cle n a pas ete capturee : collez sa cle publique pour verifier la signature.')));
  const champ = el('textarea', { class: 'field', rows: '3', spellcheck: 'false', dataset: { champ: 'wa-' + cle },
    placeholder: t('Cle publique (PEM, JWK ou certificat)') });
  champ.value = etat.texte;
  champ.addEventListener('input', () => { etat.texte = champ.value; });
  zone.appendChild(champ);
  const choix = el('select', { class: 'field' });
  for (const nom of ['ES256', 'EdDSA', 'Ed25519', 'RS256', 'PS256', 'ES384', 'ES512']) {
    choix.appendChild(el('option', { value: nom, text: nom, selected: nom === etat.alg }));
  }
  choix.addEventListener('change', () => { etat.alg = choix.value; });
  const sortie = el('div');
  zone.appendChild(el('div', { class: 'actions' }, [choix, button('Verifier la signature', () => {
    verifierConnexion(lu, etat.texte, etat.alg).then(v => v, e => ({ erreur: te(e), algorithme: etat.alg }))
      .then(v => { retenir(verdicts, cle, v); sortie.textContent = ''; add(sortie, verdictNote(v)); });
  })]));
  add(sortie, verdictNote(verdicts.get(cle)));
  zone.appendChild(sortie);
}

export function webauthnCeremonie(rec) {
  const box = frag();
  const corps = rec.requestBody;
  if (!corps || typeof corps.text !== 'string' || !corps.text.includes('clientDataJSON')) return box;
  let lu;
  try { lu = trouverCredential(corps.text); }
  catch (e) {
    box.appendChild(sec('WebAuthn', t('illisible')));
    box.appendChild(note(te(e), 'note warn'));
    return box;
  }
  if (!lu) return box;
  const d = lu.donnees;
  const c = { copy: true };
  box.appendChild(sec(lu.genre === 'inscription' ? 'WebAuthn — inscription d une cle d acces' : 'WebAuthn — connexion par cle d acces',
    lu.attachement || ''));
  add(box, kv('Type', lu.client.type));
  add(box, kv('Origine signee', lu.client.origine, c));
  add(box, kv('Origine du cadre parent', lu.client.origineHaute, c));
  add(box, kv('Defi', lu.client.defi, c));
  add(box, kv('Identifiant de la cle', d.identifiant || lu.rawId || lu.id, c));
  add(box, kv('rpIdHash', d.rpIdHash, c));
  add(box, kv('Drapeaux', drapeauxTexte(d)));
  add(box, kv('Compteur de signatures', String(d.compteur)));
  add(box, kv('AAGUID (modele)', d.aaguid, c));
  if (d.cle) add(box, kv('Cle publique', (d.cle.algNom || String(d.cle.alg)) + (d.cle.crv ? ' · ' + d.cle.crv : '')));
  if (lu.attestation) {
    const pr = lu.attestation.preuve;
    add(box, kv('Attestation', lu.attestation.format + (pr.algNom ? ' · ' + pr.algNom : '')
      + (pr.certificats ? ' · ' + tp('{n} certificat(s)', { n: pr.certificats }) : '')));
  }
  add(box, kv('Transports', lu.transports.join(', ') || null));
  add(box, kv('Utilisateur (userHandle)', lu.utilisateur, c));
  if (d.extensions && d.extensions.length) add(box, kv('Extensions', d.extensions.join(', ')));
  const zone = el('div');
  box.appendChild(zone);
  Promise.all([faitsCeremonie(lu), liensDe(rec)]).then(([liste, lien]) => {
    faits(zone, liste);
    if (lien.emetteur) zone.appendChild(note('•  ' + tp('defi emis par la reponse n° {id}', { id: lien.emetteur.id })));
    if (d.cle && d.cle.jwk) {
      zone.appendChild(el('div', { class: 'actions' }, [button('Copier la cle publique (JWK)',
        () => copy(JSON.stringify(d.cle.jwk), 'Cle copiee'))]));
    }
    if (lu.genre !== 'connexion' || !lu.signature) return;
    const ins = lien.inscription;
    if (!ins) { formulaireConnexion(zone, lu, rec.id + ':wa'); return; }
    verifierConnexion(lu, ins.jwk, ins.alg)
      .then(v => v, e => ({ erreur: te(e), algorithme: ins.alg }))
      .then(v => {
        zone.appendChild(note(tp('Cle publique prise dans l inscription capturee (ligne n° {id}).', { id: ins.id })));
        add(zone, verdictNote(v));
      });
  }).catch(e => zone.appendChild(note(te(e), 'note warn')));
  return box;
}

export function webauthnOptions(rec) {
  const box = frag();
  const corps = rec.responseBody;
  if (!corps || typeof corps.text !== 'string' || !corps.text.includes('challenge')) return box;
  let o;
  try { o = trouverOptions(corps.text); } catch { return box; }
  if (!o) return box;
  box.appendChild(sec(o.genre === 'creation' ? 'WebAuthn — options d inscription' : 'WebAuthn — options de connexion',
    t('envoyees par le serveur')));
  const c = { copy: true };
  add(box, kv('Defi', o.defi, c));
  add(box, kv('Domaine (rpId)', o.rp, c));
  add(box, kv('Utilisateur', o.utilisateur, c));
  add(box, kv('Algorithmes acceptes', o.algorithmes.join(', ') || null));
  add(box, kv('Verification de l utilisateur', o.verification));
  add(box, kv('Cle residente (passkey)', o.residente));
  add(box, kv('Attestation demandee', o.attestation));
  add(box, kv('Delai', o.delai != null ? tp('{n} ms', { n: o.delai }) : null));
  add(box, kv('Cles autorisees', o.autorises != null ? String(o.autorises) : null));
  add(box, kv('Cles exclues', o.exclus != null ? String(o.exclus) : null));
  faits(box, o.faits);
  return box;
}

/* ----------------------------------- DNS ----------------------------------- */
function afficherDns(box, lu, titre) {
  if (!lu) return;
  if (lu.erreur) {
    box.appendChild(sec(titre, 'RFC 8484'));
    box.appendChild(note(t('Message DNS illisible : ') + te(lu.erreur), 'note warn'));
    return;
  }
  const m = lu.message;
  box.appendChild(sec(titre, m.rcodeNom));
  add(box, kv('Identifiant du message', String(m.id)));
  add(box, kv('Drapeaux', Object.entries(m.drapeaux).filter(([, v]) => v).map(([k]) => k).join(' ') || t('(aucun)')));
  for (const q of m.questions) add(box, kv('Question', q.nom + '  ' + q.classeNom + '  ' + q.typeNom, { copy: true }));
  if (m.opt) {
    add(box, kv('EDNS', tp('version {version}, UDP {udp}', { version: m.opt.version, udp: m.opt.tailleUdp })
      + (m.opt.dnssecOk ? ', DO' : '')));
    for (const o of m.opt.options) add(box, kv(o.nom, valeurOption(o)));
  }
  const lignes = [];
  for (const [nom, liste] of [['REPONSE', m.reponses], ['AUTORITE', m.autorite], ['ADDITIONNEL', m.additionnels]]) {
    if (!liste.length) continue;
    lignes.push(';; ' + t(nom));
    for (const rr of liste) lignes.push(ligneEnregistrement(rr));
  }
  if (lignes.length) box.appendChild(el('pre', { class: 'pre', text: lignes.join('\n') }));
  faits(box, m.faits);
}

/* Le message ouvert dans la boite a outils, deja decode : la transformation
   DNS est choisie et appliquee pour l utilisateur. */
function versBoiteAOutils(box, lu) {
  if (!lu || !lu.message || !lu.brut) return;
  box.appendChild(el('div', { class: 'actions' }, [button('Ouvrir dans la boite a outils',
    () => poser(lu.brut, { transformation: 'dns-dec' }))]));
}

export function dnsQuestion(rec) {
  const box = frag();
  let lus;
  try { lus = messagesDnsDe(rec); } catch { return box; }
  afficherDns(box, lus.question, 'DNS par HTTPS — question');
  versBoiteAOutils(box, lus.question);
  return box;
}

export function dnsReponse(rec) {
  const box = frag();
  let lus;
  try { lus = messagesDnsDe(rec); } catch { return box; }
  afficherDns(box, lus.reponse, 'DNS par HTTPS — reponse');
  versBoiteAOutils(box, lus.reponse);
  return box;
}
