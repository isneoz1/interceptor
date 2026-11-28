/* Panneau « Flux HTTP (SSE) » — SWIFT (by D4RK)
 *
 * Une reponse qui arrive au fil de l eau, lue en direct : des Server-Sent
 * Events (text/event-stream) — les notifications d une application, les
 * reponses mot a mot d une API de generation de texte —, des lignes JSON
 * (NDJSON), ou du texte brut. Contrairement a EventSource, la requete peut
 * etre un POST, avec des en-tetes et un corps : c est ainsi que la plupart
 * des API diffusent.
 *
 * Le flux vit hors du rendu, comme la session WebSocket : changer d outil ou
 * de vue ne le coupe pas, et le panneau ne se redessine que s il est a
 * l ecran, au plus une fois tous les 120 ms. Il ne s ouvre que sur un clic,
 * et seulement quand le rejeu a ete autorise. Rien n est tronque : un long
 * evenement montre son debut, son compte et « Tout afficher ».
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { state, toast, copy } from '../app.js';
import { clock, bytes, ms } from '../lib/format.js';
import { texteLong } from '../lib/texte-long.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { creerLecteurSse, creerLecteurLignes, formeDuFlux } from '../lib/flux-sse.js';
import { envoiPermis, boutonAutoriser, requeteDepuisTexte, lignesVersEntetes } from './tools-requete.js';

const ETATS = { arrete: 'arrete', connexion: 'connexion en cours…', ouvert: 'en reception', termine: 'termine', erreur: 'en echec' };
const FORMES = [['auto', 'Forme : d apres le type de contenu'], ['sse', 'Server-Sent Events'], ['lignes', 'Lignes JSON (NDJSON)'], ['texte', 'Texte brut']];
const NOMS_FORMES = { sse: 'Server-Sent Events', lignes: 'Lignes JSON (NDJSON)', texte: 'Texte brut' };

/* Une session a la fois, gardee hors du panneau. */
const flux = {
  controle: null, etat: 'arrete', url: '', methode: 'GET', statut: null, texteStatut: '', typeContenu: '',
  forme: null, elements: [], octets: 0, debut: null, fin: null, erreur: null, inacheve: false,
  dernierId: '', retry: null, commentaires: 0, champsIgnores: 0
};

let relancer = null;
let temoin = null;
let minuteur = null;
function redessinerBientot() {
  if (minuteur) return;
  minuteur = setTimeout(() => {
    minuteur = null;
    if (relancer && state.view === 'tools' && temoin && temoin.isConnected !== false) relancer();
  }, 120);
}

function arreter() {
  if (flux.controle) { try { flux.controle.abort(); } catch { /* deja termine */ } }
}

async function connecter({ url, methode, entetes, corps, forme, dernierId }) {
  arreter();
  const controle = new AbortController();
  Object.assign(flux, {
    controle, etat: 'connexion', url, methode, statut: null, texteStatut: '', typeContenu: '', forme: null,
    elements: [], octets: 0, debut: Date.now(), fin: null, erreur: null, inacheve: false,
    dernierId: '', retry: null, commentaires: 0, champsIgnores: 0
  });
  redessinerBientot();
  const enTetes = {};
  for (const h of lignesVersEntetes(entetes)) enTetes[h.name] = h.value;
  enTetes['X-Swift-Replay'] = '1';
  if (forme !== 'lignes' && forme !== 'texte' && !Object.keys(enTetes).some(k => k.toLowerCase() === 'accept')) enTetes.Accept = 'text/event-stream';
  if (dernierId) enTetes['Last-Event-ID'] = dernierId;
  try {
    const res = await fetch(url, {
      method: methode, headers: enTetes, credentials: 'include', cache: 'no-store', signal: controle.signal,
      body: corps && !['GET', 'HEAD'].includes(methode) ? corps : undefined
    });
    if (flux.controle !== controle) return;
    flux.statut = res.status;
    flux.texteStatut = res.statusText;
    flux.typeContenu = res.headers.get('content-type') || '';
    flux.forme = forme === 'auto' ? formeDuFlux(flux.typeContenu) : forme;
    flux.etat = 'ouvert';
    redessinerBientot();
    const sse = flux.forme === 'sse' ? creerLecteurSse() : null;
    const lignes = flux.forme === 'lignes' ? creerLecteurLignes() : null;
    const decodeur = new TextDecoder();
    const lecteur = res.body.getReader();
    for (;;) {
      const { value, done } = await lecteur.read();
      if (flux.controle !== controle) return;
      if (done) break;
      flux.octets += value.length;
      const texte = decodeur.decode(value, { stream: true });
      recevoir(texte, sse, lignes);
    }
    recevoir(decodeur.decode(), sse, lignes);
    if (sse) {
      const fin = sse.finir();
      flux.inacheve = fin.inacheve;
    }
    if (lignes) for (const l of lignes.finir()) flux.elements.push({ a: Date.now(), ...l });
    flux.etat = 'termine';
  } catch (e) {
    if (flux.controle !== controle) return;
    if (e && e.name === 'AbortError') flux.etat = 'arrete';
    else { flux.etat = 'erreur'; flux.erreur = String((e && e.message) || e); }
  }
  flux.fin = Date.now();
  flux.controle = null;
  redessinerBientot();
}

function recevoir(texte, sse, lignes) {
  if (!texte) return;
  const a = Date.now();
  if (sse) {
    for (const ev of sse.pousser(texte)) flux.elements.push({ a, ...ev });
    flux.dernierId = sse.etat.dernierId;
    flux.retry = sse.etat.retry;
    flux.commentaires = sse.etat.commentaires;
    flux.champsIgnores = sse.etat.champsIgnores;
  } else if (lignes) {
    for (const l of lignes.pousser(texte)) flux.elements.push({ a, ...l });
  } else {
    flux.elements.push({ a, morceau: texte });
  }
  redessinerBientot();
}

/* Le contenu d un element, mis en forme s il est du JSON. */
function contenu(texte) {
  const brut = String(texte == null ? '' : texte);
  if (/^\s*[[{]/.test(brut)) {
    try { return JSON.stringify(JSON.parse(brut), null, 2); } catch { /* pas du JSON : tel quel */ }
  }
  return brut;
}

let rendu = null;

export function panneauSse(entree, etat, redessiner) {
  relancer = redessiner;
  const box = frag();
  temoin = sec('Flux HTTP (SSE)', ETATS[flux.etat]);
  box.appendChild(temoin);
  box.appendChild(el('p', { class: 'note warn', text:
    t('La requete part du navigateur avec vos cookies pour ce site, porte l en-tete X-Swift-Replay, et reste ouverte tant que le serveur envoie. A n ouvrir que vers des services dont vous avez la responsabilite.') }));

  if (etat.sseUrl == null) {
    const lue = requeteDepuisTexte(entree);
    etat.sseUrl = lue ? lue.url : '';
    etat.sseMethode = lue ? lue.methode : 'GET';
    etat.sseEntetes = lue ? lue.entetes : '';
    etat.sseCorps = lue ? lue.corps : '';
  }
  const methode = el('select', { dataset: { champ: 'sse-methode' } });
  for (const m of ['GET', 'POST', 'PUT', 'PATCH']) methode.appendChild(el('option', { value: m, text: m, selected: (etat.sseMethode || 'GET') === m }));
  const url = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.sseUrl || '',
    placeholder: t('adresse du flux, par exemple https://api.example.com/events'), dataset: { champ: 'sse-url' }
  });
  const entetes = el('textarea', { class: 'field', spellcheck: 'false', rows: '3', dataset: { champ: 'sse-entetes' },
    placeholder: t('un en-tete par ligne : Nom: valeur') });
  entetes.value = etat.sseEntetes || '';
  const corps = el('textarea', { class: 'field', spellcheck: 'false', rows: '3', dataset: { champ: 'sse-corps' },
    placeholder: t('corps de la requete (facultatif)') });
  corps.value = etat.sseCorps || '';
  const forme = el('select', { dataset: { champ: 'sse-forme' } });
  for (const [valeur, libelle] of FORMES) forme.appendChild(el('option', { value: valeur, text: t(libelle), selected: (etat.sseForme || 'auto') === valeur }));
  const dernier = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.sseId || '',
    placeholder: t('Last-Event-ID, pour reprendre un flux (facultatif)'), dataset: { champ: 'sse-id' }
  });
  const retenir = () => {
    etat.sseMethode = methode.value; etat.sseUrl = url.value; etat.sseEntetes = entetes.value;
    etat.sseCorps = corps.value; etat.sseForme = forme.value; etat.sseId = dernier.value;
  };
  for (const c of [methode, url, entetes, corps, forme, dernier]) c.addEventListener('change', retenir);
  box.appendChild(el('div', { class: 'actions' }, [methode, url]));
  box.appendChild(entetes);
  box.appendChild(corps);
  box.appendChild(el('div', { class: 'actions' }, [forme, dernier]));

  const actions = el('div', { class: 'actions' });
  if (!envoiPermis()) actions.appendChild(boutonAutoriser(redessiner));
  else if (flux.controle) actions.appendChild(button('Arreter le flux', () => { arreter(); redessiner(); }, { class: 'danger' }));
  else {
    actions.appendChild(button('Ouvrir le flux', () => {
      retenir();
      const cible = String(etat.sseUrl || '').trim();
      if (!/^https?:\/\//i.test(cible)) return toast('Adresse http ou https attendue', false);
      connecter({ url: cible, methode: etat.sseMethode || 'GET', entetes: etat.sseEntetes, corps: etat.sseCorps,
        forme: etat.sseForme || 'auto', dernierId: String(etat.sseId || '').trim() });
      redessiner();
    }, { class: 'accent' }));
  }
  actions.appendChild(button('Reprendre le texte de travail', () => {
    const lue = requeteDepuisTexte(entree);
    if (!lue) return toast('Ni commande cURL, ni requete HTTP brute, ni adresse dans le texte de travail', false);
    etat.sseMethode = lue.methode; etat.sseUrl = lue.url; etat.sseEntetes = lue.entetes; etat.sseCorps = lue.corps;
    redessiner();
  }));
  box.appendChild(actions);

  /* -------------------------------- Etat -------------------------------- */
  if (flux.url) {
    add(box, kv('Adresse', flux.methode + ' ' + flux.url, { copy: true }));
    add(box, kv('Statut', flux.statut == null ? null : flux.statut + (flux.texteStatut ? ' ' + flux.texteStatut : ''), { hl: flux.statut >= 400 }));
    add(box, kv('Type de contenu', flux.typeContenu || null));
    add(box, kv('Forme lue', flux.forme ? t(NOMS_FORMES[flux.forme]) : null));
    add(box, kv('Recu', bytes(flux.octets), { always: true }));
    add(box, kv('Duree', flux.debut ? ms((flux.fin || Date.now()) - flux.debut) : null));
    add(box, kv('Dernier identifiant (id)', flux.dernierId || null, { copy: true }));
    add(box, kv('Delai de reconnexion annonce (retry)', flux.retry == null ? null : ms(flux.retry)));
    add(box, kv('Commentaires', flux.commentaires || null));
    add(box, kv('Champs inconnus ignores', flux.champsIgnores || null));
  }
  if (flux.erreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(flux.erreur) }));
  if (flux.forme === 'sse' && flux.etat === 'termine' && flux.inacheve) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Le flux s est termine au milieu d un evenement, sans ligne vide finale : cet evenement n a pas ete distribue, comme le veut la norme.') }));
  }
  if (flux.forme && flux.forme !== 'sse' && flux.typeContenu && formeDuFlux(flux.typeContenu) === 'sse') {
    box.appendChild(el('p', { class: 'note', text: t('Le serveur annonce text/event-stream : la forme « Server-Sent Events » le lirait evenement par evenement.') }));
  }

  /* ------------------------------ Elements ------------------------------ */
  const n = flux.elements.length;
  box.appendChild(sec(flux.forme === 'texte' ? 'Morceaux recus' : 'Evenements recus', n ? tp('{n} element(s), les plus recents en haut', { n }) : ''));
  if (!n) {
    box.appendChild(el('p', { class: 'note', text:
      t('Les evenements s affichent ici des qu ils arrivent, les plus recents en haut. Rien ne part sans un clic sur « Ouvrir le flux ».') }));
    return box;
  }
  box.appendChild(el('div', { class: 'actions' }, [
    button('Copier le journal', () => copy(flux.elements.map(e => clock(e.a) + '\t' + (e.morceau != null ? e.morceau
      : e.ligne != null ? e.ligne : (e.type + '\t' + e.data))).join('\n'), 'Journal copie')),
    button('Vider le journal', () => { flux.elements.length = 0; redessiner(); }, { class: 'ghost' })
  ]));
  const hote = el('div');
  box.appendChild(hote);
  if (rendu) rendu.arreter();
  rendu = listeProgressive(hote, [...flux.elements].reverse(), e => {
    if (e.morceau != null) {
      return el('div', { class: 'frame recv' }, [el('b', { text: '↓ ' + clock(e.a) + '  ' + bytes(new TextEncoder().encode(e.morceau).length) }),
        texteLong(e.morceau, { seuil: 4000 })]);
    }
    if (e.ligne != null) {
      return el('div', { class: 'frame recv' }, [el('b', { text: '#' + e.n + '  ' + clock(e.a) + (e.erreur ? '  ' + t('JSON invalide') : '') }),
        texteLong(e.json !== undefined ? JSON.stringify(e.json, null, 2) : e.ligne, { seuil: 4000 })]);
    }
    return el('div', { class: 'frame recv' }, [
      el('b', { text: '#' + e.n + '  ' + clock(e.a) + '  ' + e.type + (e.id ? '  id ' + e.id : '') }),
      texteLong(contenu(e.data), { seuil: 4000 })
    ]);
  });
  return box;
}

/** La session en cours, pour les tests. */
export function fluxSse() { return flux; }
