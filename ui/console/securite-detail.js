/* Lectures de securite du panneau de detail — INTERCEPTOR (by NeoZ)
 *
 * Ce que les onglets du detail montrent d une requete du point de vue de la
 * securite, quand il y a quelque chose a montrer — sinon rien, pour ne pas
 * encombrer :
 *
 *   En-tetes   les protections de la reponse ; pour un document, la CSP que
 *              ses chargements reels permettraient
 *   Requete    une demande OAuth 2.0 / OpenID Connect, un message SAML
 *   Reponse    une reponse de jeton OAuth, l empreinte SRI d un script ou
 *              d une feuille de style
 *
 * Toutes ces lignes sont des FAITS. Les alertes restent l affaire de
 * l analyseur, qui n en emet que pour une faille demontrable.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';
import { state, copy } from '../app.js';
import { poser } from './tools.js';
import { lireProtections, entetesEnObjet } from '../lib/protections.js';
import { ENTETES_INTEGRITE, lireEmpreintes, verifierEmpreintes, resumerVerification }
  from '../lib/integrite.js';
import { base64VersOctets, texteVersOctets } from '../lib/bytes.js';
import { proposerCsp, chargementsDe, LIMITES_CSP } from '../lib/csp-observee.js';
import { lireOAuth } from '../lib/oauth.js';
import { trouverSaml, decoderSaml } from '../lib/saml.js';

const SYMBOLE = { present: '✓', absent: '—', partiel: '◐', inoperant: '✗' };
const DOCUMENTS = new Set(['main_frame', 'sub_frame']);

function traduireValeurs(ligne) {
  const valeurs = { ...(ligne.valeurs || {}) };
  for (const cle of ligne.aTraduire || []) valeurs[cle] = t(valeurs[cle]);
  return valeurs;
}

const note = (texte, classe = 'note') => el('p', { class: classe, text: texte });

/* ------------------------ Integrite du corps ------------------------------ */
/* Un serveur peut annoncer l empreinte de ce qu il envoie. INTERCEPTOR a le
   corps : il peut donc la VERIFIER, ce que le navigateur ne fait pas. On ne
   dit pas « le serveur annonce sha-256=… », on dit si cela correspond. */
export function integrite(rec) {
  const box = frag();
  const recu = entetesEnObjet(rec.responseHeaders);
  const envoye = entetesEnObjet(rec.requestHeaders);

  for (const [nom, quoi] of Object.entries(ENTETES_INTEGRITE)) {
    /* L en-tete peut venir de la reponse (le serveur annonce ce qu il rend)
       ou de la requete (le client annonce ce qu il envoie). */
    for (const [valeur, corps, sens] of [
      [recu[nom], rec.responseBody, 'reponse'],
      [envoye[nom], rec.requestBody, 'requete']
    ]) {
      if (!valeur) continue;
      let annonces;
      try { annonces = lireEmpreintes(nom, valeur); }
      catch (e) {
        box.appendChild(el('p', { class: 'note ko',
          text: tp('{entete} illisible : {raison}', { entete: nom, raison: e.message }) }));
        continue;
      }
      if (!annonces.length) continue;

      const titre = nom + '  ·  ' + t(sens);
      box.appendChild(sec(titre, t(quoi.porte)));
      for (const a of annonces) {
        add(box, kv(a.algorithme, a.base64, { copy: true }));
        if (a.sens) box.appendChild(el('p', { class: 'note', text: t(a.sens) }));
      }
      const verdict = el('p', { class: 'note', text: t('Verification en cours…') });
      box.appendChild(verdict);
      const montrer = resultats => {
        const differe = resultats.some(r => r.verdict === 'differe');
        const conforme = resultats.some(r => r.verdict === 'correspond');
        const dit = resumerVerification(resultats);
        verdict.textContent = dit ? tp(dit.cle, dit.valeurs) : '';
        verdict.className = 'note ' + (differe ? 'ko' : conforme ? 'ok' : 'warn');
        for (const r of resultats) {
          if (r.verdict !== 'differe') continue;
          add(box, kv('Empreinte calculee', r.calcule, { copy: true, hl: true }));
        }
      };
      const nonVerifiable = (raison, valeurs) => {
        verdict.textContent = t('Non verifiable : ') + tp(raison, valeurs || {});
        verdict.className = 'note warn';
      };

      /* La reponse est verifiee A LA CAPTURE, sur les octets exacts que Firefox
         a remis (empreintes.js dit ce qu ils prouvent). Le texte conserve ne
         les redonne pas : le hacher de nouveau produirait une fausse discordance. */
      if (sens === 'reponse') {
        const faite = corps && Array.isArray(corps.integrite)
          ? corps.integrite.find(v => v.entete === nom) : null;
        if (!faite) nonVerifiable('la verification se fait a la capture, sur les octets recus ; ce corps n en a pas');
        else if (faite.raison) nonVerifiable(faite.raison, faite.valeurs);
        else montrer(faite.resultats);
        continue;
      }

      /* Le corps envoye : ses octets bruts, ou son texte quand il est prouve
         qu il les redonne exactement. */
      const octets = corps && corps.base64 != null ? base64VersOctets(corps.base64)
        : corps && corps.octetsExacts === true && corps.text != null ? texteVersOctets(corps.text)
        : null;
      if (!octets) {
        nonVerifiable(corps && corps.text != null
          ? 'le texte conserve ne redonne pas exactement les octets envoyes'
          : 'corps non capture');
        continue;
      }
      if (corps.truncated) { nonVerifiable('corps tronque a la capture : l empreinte porte sur le corps entier'); continue; }
      verifierEmpreintes(nom, valeur, octets).then(montrer).catch(() => {
        verdict.textContent = t('Verification impossible dans ce contexte.');
        verdict.className = 'note warn';
      });
    }
  }
  return box;
}

/* ------------------------------ Protections ------------------------------- */
export function protections(rec) {
  const box = frag();
  const lignes = lireProtections(rec);
  if (!lignes.length) return box;
  box.appendChild(sec('Protections de la reponse', DOCUMENTS.has(rec.type) ? t('document') : t('ressource')));
  box.appendChild(note(t('Ce qui est en place, et ce qui s applique quand rien n est dit. Une protection absente n est pas une faille a elle seule.')));
  for (const l of lignes) {
    add(box, kv(l.nom, (SYMBOLE[l.etat] || '') + '  ' + tp(l.texte, traduireValeurs(l)),
      { hl: l.etat === 'inoperant' }));
  }
  return box;
}

/* ------------------------- CSP deduite des chargements -------------------- */
export function cspObservee(rec) {
  const box = frag();
  if (rec.type !== 'main_frame' && rec.type !== 'sub_frame') return box;
  const lignes = state.records ? [...state.records.values()] : [];
  const chargements = chargementsDe(rec, lignes);
  if (!chargements.length) return box;
  const p = proposerCsp(rec.finalUrl || rec.url, chargements);
  if (!p.retenus) return box;
  box.appendChild(sec('Une CSP deduite de ce que la page a charge', tp('{n} chargements', { n: p.retenus })));
  for (const d of p.directives) add(box, kv(d.nom, d.sources.join(' '), { copy: true }));
  for (const limite of LIMITES_CSP) box.appendChild(note('•  ' + t(limite)));
  box.appendChild(el('div', { class: 'actions' }, [
    button('Copier en Report-Only', () =>
      copy('Content-Security-Policy-Report-Only: ' + p.politique, t('Politique copiee'))),
    button('Copier la politique', () => copy('Content-Security-Policy: ' + p.politique, t('Politique copiee')))
  ]));
  return box;
}

/* --------------------------------- OAuth ---------------------------------- */
function champsOAuth(box, champs) {
  for (const [cle, valeur] of Object.entries(champs)) {
    if (valeur == null) continue;
    add(box, kv(cle, valeur === 'present' ? t('present') : String(valeur), { copy: valeur !== 'present' }));
  }
}

function faits(box, liste) {
  for (const f of liste) box.appendChild(note('•  ' + tp(f.texte, f.valeurs || {})));
}

export function oauthDemande(rec) {
  const box = frag();
  const lu = lireOAuth(rec);
  if (!lu || !lu.demande) return box;
  const d = lu.demande;
  box.appendChild(sec(d.genre === 'autorisation'
    ? (d.oidc ? 'OpenID Connect — demande d autorisation' : 'OAuth 2.0 — demande d autorisation')
    : 'OAuth 2.0 — demande de jeton', d.champs.response_type || d.champs.grant_type));
  champsOAuth(box, d.champs);
  faits(box, d.faits);
  return box;
}

export function oauthReponse(rec) {
  const box = frag();
  const lu = lireOAuth(rec);
  if (!lu || !lu.reponse) return box;
  const r = lu.reponse;
  box.appendChild(sec('OAuth 2.0 — reponse de jeton', r.champs.token_type));
  champsOAuth(box, r.champs);
  faits(box, r.faits);
  if (r.idToken) {
    box.appendChild(el('div', { class: 'actions' },
      button('Ouvrir l id_token dans la boite a outils', () => poser(r.idToken, { vers: 'jwt' }))));
  }
  return box;
}

/* ---------------------------------- SAML ---------------------------------- */
export function saml(rec) {
  const box = frag();
  const trouve = trouverSaml(rec);
  if (!trouve) return box;
  box.appendChild(sec('SAML 2.0', trouve.nom + '  ·  ' + trouve.liaison));
  const zone = el('div');
  box.appendChild(zone);
  zone.appendChild(note(t('Decodage…')));
  /* Le decodage de la liaison Redirect passe par un flux DEFLATE, donc par
     une promesse : le reste de l onglet ne l attend pas. */
  decoderSaml(trouve, rec.startTime).then(({ xml, resume, faits: liste }) => {
    zone.textContent = '';
    const c = { copy: true };
    add(zone, kv('Message', resume.racine, c));
    add(zone, kv('Identifiant', resume.id, c));
    add(zone, kv('Emis le', resume.instant, c));
    add(zone, kv('Emetteur', resume.emetteur, c));
    add(zone, kv('Destination', resume.destination, c));
    add(zone, kv('En reponse a', resume.enReponseA, c));
    add(zone, kv('Retour vers', resume.retour, c));
    add(zone, kv('Statut', resume.statut, c));
    add(zone, kv('Sujet (NameID)', resume.nameId, c));
    add(zone, kv('Format du sujet', resume.formatNameId, c));
    add(zone, kv('Audience', resume.audiences.join(', ') || null, c));
    add(zone, kv('Valable a partir de', resume.nonAvant, c));
    add(zone, kv('Valable jusqu au', resume.nonApres, c));
    add(zone, kv('Destinataire', resume.destinataire, c));
    add(zone, kv('Session', resume.session, c));
    add(zone, kv('Attributs', resume.attributs.join(', ') || null, c));
    add(zone, kv('RelayState', trouve.relayState, c));
    faits(zone, liste);
    zone.appendChild(el('div', { class: 'actions' }, [
      button('Copier le XML', () => copy(xml, t('XML copie'))),
      button('Ouvrir le XML dans la boite a outils', () => poser(xml))
    ]));
  }).catch(e => {
    zone.textContent = '';
    zone.appendChild(note(t('Message SAML illisible : ') + String(e.message || e), 'note warn'));
  });
  return box;
}

/* ---------------------------------- SRI ----------------------------------- */
export function sri(rec) {
  const box = frag();
  const corps = rec.responseBody;
  if (rec.type !== 'script' && rec.type !== 'stylesheet') return box;
  box.appendChild(sec('Integrite de sous-ressource (SRI)', rec.type === 'script' ? 'script' : 'style'));
  if (!corps || (!corps.sri && !corps.sriRaison)) {
    box.appendChild(note(t('L empreinte se calcule a la capture, sur les octets recus ; ce corps n en a pas.'), 'note warn'));
    return box;
  }
  if (!corps.sri) {
    box.appendChild(note(t('Aucune empreinte : ') + tp(corps.sriRaison, corps.sriValeurs || {}), 'note warn'));
    return box;
  }
  for (const valeur of Object.values(corps.sri)) add(box, kv(valeur.split('-')[0], valeur, { copy: true }));
  const url = rec.finalUrl || rec.url;
  const balise = rec.type === 'script'
    ? '<script src="' + url + '" integrity="' + corps.sri.sha384 + '" crossorigin="anonymous"></script>'
    : '<link rel="stylesheet" href="' + url + '" integrity="' + corps.sri.sha384 + '" crossorigin="anonymous">';
  add(box, kv('Balise', balise, { copy: true }));
  /* Une autre origine doit repondre en CORS, sinon le navigateur refuse la
     ressource des qu elle porte crossorigin : c est ce que dit l en-tete. */
  const acao = (rec.responseHeaders || []).some(h => String(h.name).toLowerCase() === 'access-control-allow-origin');
  if (rec.thirdParty && !acao) {
    box.appendChild(note(t('Cette ressource vient d une autre origine et sa reponse ne porte pas Access-Control-Allow-Origin : chargee avec crossorigin, elle serait refusee.'), 'note warn'));
  }
  box.appendChild(el('div', { class: 'actions' },
    button('Copier la balise', () => copy(balise, t('Balise copiee')))));
  return box;
}
