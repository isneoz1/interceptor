/* Panneau « Client WebSocket » — SWIFT (by D4RK)
 *
 * Ouvrir une connexion WebSocket, envoyer des messages, voir ceux qui
 * arrivent, en direct : ce que l on fait pour essayer un serveur temps reel
 * sans ecrire de page. Texte, ou octets ecrits en hexadecimal ; les messages
 * binaires recus sont montres en hexadecimal, entiers.
 *
 * La connexion vit hors du rendu : redessiner la boite a outils, changer
 * d onglet ou de vue ne la coupe pas. Elle ne s ouvre que sur un clic, et
 * seulement quand le rejeu a ete autorise — la meme permission que toute
 * requete envoyee depuis SWIFT. Les messages ne sont jamais tronques : un
 * long texte montre son debut, son compte et « Tout afficher ».
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { state, toast, copy } from '../app.js';
import { clock, bytes } from '../lib/format.js';
import { texteLong } from '../lib/texte-long.js';
import { octetsVersHex, hexVersOctets, texteVersOctets } from '../lib/bytes.js';
import { decrireFermetureWs } from '../lib/ref-reseau.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { envoiPermis, boutonAutoriser } from './tools-requete.js';

/* Une session a la fois. `messages` garde tout, dans l ordre d arrivee. */
const session = {
  ws: null, url: '', etat: 'fermee', protocole: '', ouverteA: null,
  fermeture: null, erreur: false, messages: []
};

/* Le redessin de la derniere vue rendue, appele quand un message arrive :
   au plus une fois tous les 120 ms, pour qu un flux rapide reste fluide. */
let relancer = null;
let minuteur = null;
function redessinerBientot() {
  if (minuteur) return;
  minuteur = setTimeout(() => {
    minuteur = null;
    if (relancer && state.view === 'tools') relancer();
  }, 120);
}

function ajouter(sens, donnee) {
  const binaire = typeof donnee !== 'string';
  const octets = binaire ? new Uint8Array(donnee) : null;
  session.messages.push({
    sens, a: Date.now(), binaire,
    texte: binaire ? octetsVersHex(octets, ' ') : donnee,
    taille: binaire ? octets.length : texteVersOctets(donnee).length
  });
  redessinerBientot();
}

function connecter(url, protocoles) {
  if (session.ws) deconnecter();
  let ws;
  try { ws = protocoles.length ? new WebSocket(url, protocoles) : new WebSocket(url); }
  catch (e) { toast(te(e), false); return; }
  ws.binaryType = 'arraybuffer';
  Object.assign(session, { ws, url, etat: 'connexion', protocole: '', ouverteA: null, fermeture: null, erreur: false });
  ws.addEventListener('open', () => {
    if (session.ws !== ws) return;
    session.etat = 'ouverte';
    session.ouverteA = Date.now();
    session.protocole = ws.protocol || '';
    redessinerBientot();
  });
  ws.addEventListener('message', ev => { if (session.ws === ws) ajouter('recu', ev.data); });
  ws.addEventListener('error', () => { if (session.ws === ws) { session.erreur = true; redessinerBientot(); } });
  ws.addEventListener('close', ev => {
    if (session.ws !== ws) return;
    session.ws = null;
    session.etat = 'fermee';
    session.fermeture = { code: ev.code, raison: ev.reason, propre: ev.wasClean };
    redessinerBientot();
  });
  redessinerBientot();
}

function deconnecter() {
  if (!session.ws) return;
  try { session.ws.close(1000); } catch { /* deja fermee */ }
}

function envoyer(texte, enHex) {
  if (!session.ws || session.ws.readyState !== 1) { toast('La connexion n est pas ouverte', false); return false; }
  if (enHex) {
    let octets;
    try { octets = hexVersOctets(texte); } catch (e) { toast(te(e), false); return false; }
    session.ws.send(octets);
    ajouter('envoye', octets);
  } else {
    session.ws.send(texte);
    ajouter('envoye', texte);
  }
  return true;
}

const ETATS = { connexion: 'connexion en cours…', ouverte: 'ouverte', fermee: 'fermee' };

let rendu = null;

export function panneauWebSocket(entree, etat, redessiner) {
  relancer = redessiner;
  const box = frag();
  const permis = envoiPermis();
  box.appendChild(sec('Client WebSocket', ETATS[session.etat]));
  box.appendChild(el('p', { class: 'note warn', text:
    t('La connexion part du navigateur, vers l adresse que vous donnez, et reste ouverte tant que vous ne la fermez pas. A n ouvrir que vers des services dont vous avez la responsabilite.') }));

  if (etat.wsUrl == null) {
    const brut = String(entree || '').trim();
    etat.wsUrl = /^wss?:\/\/\S+$/i.test(brut) ? brut : '';
  }
  const adresse = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.wsUrl || '',
    placeholder: t('adresse, par exemple wss://echo.example/socket'), dataset: { champ: 'ws-url' }
  });
  adresse.addEventListener('change', () => { etat.wsUrl = adresse.value; });
  const protocoles = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.wsProtocoles || '',
    placeholder: t('sous-protocoles, separes par des virgules (facultatif)'), dataset: { champ: 'ws-protocoles' }
  });
  protocoles.addEventListener('change', () => { etat.wsProtocoles = protocoles.value; });
  box.appendChild(el('div', { class: 'actions' }, [adresse, protocoles]));

  const actions = el('div', { class: 'actions' });
  if (!permis) actions.appendChild(boutonAutoriser(redessiner));
  else if (session.ws) actions.appendChild(button('Fermer la connexion', () => { deconnecter(); redessiner(); }, { class: 'danger' }));
  else {
    actions.appendChild(button('Ouvrir la connexion', () => {
      etat.wsUrl = adresse.value.trim();
      etat.wsProtocoles = protocoles.value;
      if (!/^wss?:\/\//i.test(etat.wsUrl)) return toast('Adresse ws:// ou wss:// attendue', false);
      const liste = String(etat.wsProtocoles || '').split(',').map(p => p.trim()).filter(Boolean);
      connecter(etat.wsUrl, liste);
      redessiner();
    }, { class: 'accent' }));
  }
  box.appendChild(actions);

  /* -------------------------------- Etat -------------------------------- */
  if (session.url) {
    add(box, kv('Adresse', session.url, { copy: true }));
    add(box, kv('Etat', t(ETATS[session.etat]), { hl: session.etat === 'ouverte' }));
    add(box, kv('Sous-protocole accepte', session.protocole || null));
    add(box, kv('Ouverte a', session.ouverteA ? clock(session.ouverteA) : null));
  }
  if (session.erreur) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Le navigateur signale une erreur sur cette connexion, sans en donner la cause : un WebSocket ne la transmet jamais a la page. Adresse injoignable, certificat refuse, ws:// non chiffre refuse depuis une page securisee sont les cas habituels.') }));
  }
  if (session.fermeture) {
    const f = session.fermeture;
    const connue = decrireFermetureWs(f.code);
    add(box, kv('Code de fermeture', connue ? f.code + '  ' + t(connue.nom) : f.code, { hl: !f.propre }));
    if (connue && connue.sens) box.appendChild(el('p', { class: 'note', text: t(connue.sens) }));
    add(box, kv('Raison donnee', f.raison || null));
  }

  /* ------------------------------ Envoyer ------------------------------- */
  const message = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '3', dataset: { champ: 'ws-message' },
    placeholder: t('message a envoyer — du texte, ou des octets en hexadecimal')
  });
  message.value = etat.wsMessage || '';
  message.addEventListener('change', () => { etat.wsMessage = message.value; });
  const enHex = el('input', { type: 'checkbox', checked: !!etat.wsHex, dataset: { champ: 'ws-hex' } });
  enHex.addEventListener('change', () => { etat.wsHex = enHex.checked; });
  box.appendChild(message);
  box.appendChild(el('div', { class: 'actions' }, [
    button('Envoyer le message', () => {
      etat.wsMessage = message.value;
      etat.wsHex = enHex.checked;
      if (envoyer(etat.wsMessage, etat.wsHex)) redessiner();
    }, { class: session.etat === 'ouverte' ? 'accent' : '' }),
    button('Prendre le texte de travail', () => { etat.wsMessage = String(entree || ''); redessiner(); }),
    el('label', { class: 'inline' }, [enHex, el('span', { text: t('octets en hexadecimal') })])
  ]));

  /* ----------------------------- Messages ------------------------------- */
  const n = session.messages.length;
  box.appendChild(sec('Messages', n ? tp('{n} message(s), les plus recents en haut', { n }) : ''));
  if (!n) {
    box.appendChild(el('p', { class: 'note', text:
      t('Les messages envoyes et recus s affichent ici des qu ils passent, les plus recents en haut.') }));
    return box;
  }
  box.appendChild(el('div', { class: 'actions' }, [
    button('Copier le journal', () => copy(session.messages
      .map(m => clock(m.a) + '\t' + (m.sens === 'envoye' ? '>' : '<') + '\t' + m.texte).join('\n'), 'Journal copie')),
    button('Vider le journal', () => { session.messages.length = 0; redessiner(); }, { class: 'ghost' })
  ]));
  const hote = el('div');
  box.appendChild(hote);
  if (rendu) rendu.arreter();
  rendu = listeProgressive(hote, [...session.messages].reverse(), m => el('div', {
    class: 'frame ' + (m.sens === 'envoye' ? 'send' : 'recv'),
    title: m.binaire ? t('message binaire, montre en hexadecimal') : null
  }, [
    el('b', { text: (m.sens === 'envoye' ? '↑ ' : '↓ ') + clock(m.a) + '  ' + bytes(m.taille) }),
    texteLong(m.texte, { seuil: 4000 })
  ]));
  return box;
}

/** La session en cours, pour les tests et le panneau qui la montre. */
export function sessionWebSocket() { return session; }
