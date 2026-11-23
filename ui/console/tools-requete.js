/* Panneaux « Envoyer une requete » et « Resolution DNS » — SWIFT (by D4RK)
 *
 * La famille « Interroger le reseau » de la boite a outils : les seuls outils
 * qui emettent quelque chose, et seulement sur un clic.
 *
 *   Envoyer une requete  compose une requete de zero — ou la reprend d une
 *                        commande cURL, d une requete HTTP brute — et l envoie
 *                        par le meme chemin que le rejeu : depuis le noyau,
 *                        avec l en-tete X-Swift-Replay, et seulement quand le
 *                        rejeu a ete autorise. La reponse s affiche ici, et
 *                        la requete apparait dans le tableau.
 *   Resolution DNS       demande un nom au resolveur de Firefox — DNS sur
 *                        HTTPS s il est actif — et montre ce qu il rend.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { state, cmd, toast, copy, saveConfig } from '../app.js';
import { ms, bytes, clock, pretty } from '../lib/format.js';
import { texteLong } from '../lib/texte-long.js';
import { decrireStatut } from '../lib/ref-http.js';
import { estIpv4, estIpv6, categorieIpv4, categorieIpv6 } from '../lib/net.js';
import { analyserCurl } from '../../background/ingest/curl.js';
import { brutVersCurl } from './tools-import.js';

const METHODES = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];

/** Le rejeu autorise : la meme permission vaut pour toute requete envoyee d ici. */
export function envoiPermis() { return !!(state.config && state.config.replayEnabled); }

/** Le bouton qui donne la permission, la ou elle manque. */
export function boutonAutoriser(redessiner) {
  return button('Autoriser le rejeu', async () => {
    const config = await saveConfig({ replayEnabled: true });
    if (config) { toast('Rejeu autorise'); redessiner(); }
  }, { class: 'accent' });
}

/* ------------------------------ Requete -------------------------------- */
/* Une commande cURL, une requete HTTP brute ou une simple adresse, lue dans
   le texte de travail. Les deux premieres passent par l analyseur cURL du
   noyau : un seul lecteur pour l import et pour l envoi. */
export function requeteDepuisTexte(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut) return null;
  if (/^https?:\/\/\S+$/i.test(brut)) return { methode: 'GET', url: brut, entetes: '', corps: '' };
  let commande = null;
  if (/^curl(\.exe)?\s/i.test(brut)) commande = brut;
  else if (/^[A-Za-z]+\s+\S+\s+HTTP\/[\d.]+\s*$/m.test(brut.split('\n')[0])) {
    try { commande = brutVersCurl(brut); } catch { commande = null; }
  }
  if (!commande) return null;
  try {
    const c = analyserCurl(commande);
    return {
      methode: c.method || 'GET',
      url: c.url,
      entetes: (c.headers || []).map(h => h.name + ': ' + h.value).join('\n'),
      corps: c.body == null ? '' : String(c.body)
    };
  } catch { return null; }
}

function lignesVersEntetes(texte) {
  const out = [];
  for (const ligne of String(texte || '').split('\n')) {
    const i = ligne.indexOf(':');
    if (i <= 0) continue;
    const name = ligne.substring(0, i).trim();
    if (name) out.push({ name, value: ligne.substring(i + 1).trim() });
  }
  return out;
}

export function panneauRequete(entree, etat, redessiner) {
  const box = frag();
  const permis = envoiPermis();
  box.appendChild(sec('Envoyer une requete', permis ? 'le rejeu est autorise' : 'demande l autorisation du rejeu'));
  box.appendChild(el('p', { class: 'note warn', text:
    t('La requete part du navigateur avec vos cookies pour ce site, porte l en-tete X-Swift-Replay, et apparait dans le tableau comme une ligne normale. A n envoyer qu a des services dont vous avez la responsabilite.') }));

  /* Premier passage : le formulaire se remplit du texte de travail s il
     contient une commande cURL, une requete brute ou une adresse. */
  if (etat.reqUrl == null) {
    const lue = requeteDepuisTexte(entree);
    etat.reqMethode = lue ? lue.methode : 'GET';
    etat.reqUrl = lue ? lue.url : '';
    etat.reqEntetes = lue ? lue.entetes : '';
    etat.reqCorps = lue ? lue.corps : '';
  }

  const methode = el('select', { dataset: { champ: 'requete-methode' } });
  const liste = METHODES.includes(etat.reqMethode) ? METHODES : [...METHODES, etat.reqMethode];
  for (const m of liste) methode.appendChild(el('option', { value: m, text: m, selected: m === etat.reqMethode }));
  const url = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.reqUrl || '',
    placeholder: t('adresse, par exemple https://api.example.com/v1/ressource'), dataset: { champ: 'requete-url' }
  });
  const entetes = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '4', dataset: { champ: 'requete-entetes' },
    placeholder: t('un en-tete par ligne : Nom: valeur')
  });
  entetes.value = etat.reqEntetes || '';
  const corps = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '4', dataset: { champ: 'requete-corps' },
    placeholder: t('corps de la requete (facultatif)')
  });
  corps.value = etat.reqCorps || '';
  const retenir = () => {
    etat.reqMethode = methode.value;
    etat.reqUrl = url.value;
    etat.reqEntetes = entetes.value;
    etat.reqCorps = corps.value;
  };
  for (const champ of [methode, url, entetes, corps]) champ.addEventListener('change', retenir);
  box.appendChild(el('div', { class: 'actions' }, [methode, url]));
  box.appendChild(entetes);
  box.appendChild(corps);

  const actions = el('div', { class: 'actions' });
  if (permis) {
    actions.appendChild(button(etat.reqEnvoi ? 'Envoi…' : 'Envoyer', async () => {
      /* Un double clic, ou un clic pendant l envoi, n envoie pas deux fois. */
      if (etat.reqEnvoi) return;
      retenir();
      const cible = String(etat.reqUrl || '').trim();
      if (!/^https?:\/\//i.test(cible)) return toast('Adresse http ou https attendue', false);
      etat.reqEnvoi = true;
      redessiner();
      const res = await cmd('replay', { id: null, overrides: {
        method: etat.reqMethode, url: cible,
        headers: lignesVersEntetes(etat.reqEntetes), body: etat.reqCorps ? etat.reqCorps : null
      } });
      etat.reqEnvoi = false;
      if (res.error) { etat.reqErreur = res.error; toast(te(res.error), false); }
      else {
        etat.reqErreur = null;
        etat.reqResultats = [res.result, ...(etat.reqResultats || [])];
        toast(tp('Requete envoyee — statut {statut}', { statut: res.result.status }));
      }
      redessiner();
    }, { class: 'accent' }));
  } else {
    actions.appendChild(boutonAutoriser(redessiner));
  }
  actions.appendChild(button('Reprendre le texte de travail', () => {
    const lue = requeteDepuisTexte(entree);
    if (!lue) return toast('Ni commande cURL, ni requete HTTP brute, ni adresse dans le texte de travail', false);
    etat.reqMethode = lue.methode; etat.reqUrl = lue.url; etat.reqEntetes = lue.entetes; etat.reqCorps = lue.corps;
    redessiner();
  }));
  actions.appendChild(button('Vider le formulaire', () => {
    etat.reqMethode = 'GET'; etat.reqUrl = ''; etat.reqEntetes = ''; etat.reqCorps = '';
    redessiner();
  }, { class: 'ghost' }));
  box.appendChild(actions);

  if (etat.reqErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.reqErreur) }));
  const resultats = etat.reqResultats || [];
  if (resultats.length) box.appendChild(reponseRecue(resultats[0]));
  if (resultats.length > 1) {
    box.appendChild(sec('Envois precedents', resultats.length - 1));
    for (const r of resultats.slice(1)) add(box, kv(clock(r.at), r.method + ' ' + r.url + '  →  ' + r.status, { copy: true }));
  }
  return box;
}

function reponseRecue(r) {
  const box = frag();
  box.appendChild(sec('Reponse recue', r.status + (r.statusText ? ' ' + r.statusText : '')));
  const sens = decrireStatut(r.status);
  add(box, kv('Requete', r.method + ' ' + r.url, { copy: true }));
  if (sens) add(box, kv('Sens du statut', t(sens.sens)));
  add(box, kv('Duree', ms(r.duration)));
  add(box, kv('Taille recue', bytes(r.bodySize)));
  if (r.refusedHeaders && r.refusedHeaders.length) {
    add(box, kv('Entetes refuses par le navigateur', r.refusedHeaders.join(', ')));
  }
  box.appendChild(sec('Entetes recues', (r.headers || []).length));
  for (const h of r.headers || []) add(box, kv(h.name, h.value, { copy: true }));
  if (r.body) {
    box.appendChild(sec('Corps recu', r.truncated
      ? tp('les 200 000 premiers caracteres sur {n} : le noyau ne transmet pas la suite', { n: r.bodySize })
      : tp('{n} caracteres', { n: r.bodySize })));
    box.appendChild(texteLong(pretty(r.body, ''), { seuil: 20000 }));
    box.appendChild(el('div', { class: 'actions' }, [button('Copier la reponse', () => copy(r.body, 'Reponse copiee'))]));
  }
  return box;
}

/* -------------------------------- DNS ---------------------------------- */
/* Le nom a resoudre, lu dans le texte de travail : une adresse complete, ou
   un nom d hote seul. Un nom international passe en punycode, la forme que
   DNS connait. */
export function nomDepuisTexte(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut || /\s/.test(brut)) return '';
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(brut) ? brut : 'http://' + brut);
    const hote = u.hostname.replace(/^\[|\]$/g, '');
    return estIpv4(hote) || estIpv6(hote) ? '' : hote;
  } catch { return ''; }
}

function categorie(adresse) {
  try {
    if (estIpv4(adresse)) return t(categorieIpv4(adresse));
    if (estIpv6(adresse)) return t(categorieIpv6(adresse));
  } catch { /* adresse inattendue : on la montre sans categorie */ }
  return '';
}

export function panneauDns(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Resolution DNS', 'par le resolveur de Firefox, sur votre clic'));

  if (etat.dnsNom == null) etat.dnsNom = nomDepuisTexte(entree);
  const nom = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.dnsNom || '',
    placeholder: t('nom d hote, par exemple example.com'), dataset: { champ: 'dns-nom' }
  });
  nom.addEventListener('change', () => { etat.dnsNom = nom.value; });
  const famille = el('select', { dataset: { champ: 'dns-famille' } });
  for (const [valeur, libelle] of [['', 'IPv4 et IPv6'], ['ipv4', 'IPv4 seulement'], ['ipv6', 'IPv6 seulement']]) {
    famille.appendChild(el('option', { value: valeur, text: t(libelle), selected: (etat.dnsFamille || '') === valeur }));
  }
  famille.addEventListener('change', () => { etat.dnsFamille = famille.value; });
  const sansCache = el('input', { type: 'checkbox', checked: !!etat.dnsSansCache, dataset: { champ: 'dns-sans-cache' } });
  sansCache.addEventListener('change', () => { etat.dnsSansCache = sansCache.checked; });

  const resoudre = button(etat.dnsEnCours ? 'Resolution…' : 'Resoudre', async () => {
    if (etat.dnsEnCours) return;
    etat.dnsNom = nom.value;
    etat.dnsFamille = famille.value;
    etat.dnsSansCache = sansCache.checked;
    const cible = nomDepuisTexte(etat.dnsNom);
    if (!cible) return toast('Nom d hote attendu, par exemple example.com', false);
    etat.dnsEnCours = true;
    redessiner();
    const res = await cmd('dnsResolve', { nom: cible, sansCache: etat.dnsSansCache, famille: etat.dnsFamille });
    etat.dnsEnCours = false;
    if (res.error) { etat.dnsErreur = res.error; toast(te(res.error), false); }
    else { etat.dnsErreur = null; etat.dnsResultats = [res.resultat, ...(etat.dnsResultats || [])]; }
    redessiner();
  }, { class: 'accent' });
  box.appendChild(el('div', { class: 'actions' }, [nom, famille, resoudre]));
  box.appendChild(el('div', { class: 'actions' }, [
    el('label', { class: 'inline' }, [sansCache, el('span', { text: t('Ignorer le cache de Firefox') })])
  ]));

  if (etat.dnsErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.dnsErreur) }));
  const resultats = etat.dnsResultats || [];
  if (!resultats.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Firefox resout le nom comme pour une page : par DNS sur HTTPS si son reglage TRR est actif, sinon par le systeme. Rien ne part sans un clic sur « Resoudre ».') }));
  }
  for (const r of resultats) {
    const carte = el('div', { class: 'find info' }, [el('h4', { text: r.nom })]);
    add(carte, kv('Adresses', r.adresses.length, { always: true }));
    for (const a of r.adresses) add(carte, kv(a, categorie(a) || '—', { copy: true }));
    add(carte, kv('Nom canonique', r.canonique && r.canonique !== r.nom ? r.canonique : null, { copy: true }));
    add(carte, kv('DNS sur HTTPS (TRR)', r.trr ? t('oui') : t('non')));
    add(carte, kv('Duree mesuree', ms(r.duree)));
    add(carte, kv('Resolu a', clock(r.a)));
    if (r.adresses.length) {
      carte.appendChild(el('div', { class: 'actions' }, [
        button('Copier les adresses', () => copy(r.adresses.join('\n'), 'Adresses copiees'))
      ]));
    }
    box.appendChild(carte);
  }
  return box;
}
