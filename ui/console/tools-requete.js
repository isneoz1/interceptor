/* Panneau « Envoyer une requete » — SWIFT (by D4RK)
 *
 * La famille « Interroger le reseau » de la boite a outils : les seuls outils
 * qui emettent quelque chose, et seulement sur un clic. Ce module porte aussi
 * ce que ses voisins partagent : la permission (celle du rejeu), le bouton
 * qui la donne, la lecture d une requete dans le texte de travail.
 *
 *   Envoyer une requete  compose une requete de zero — ou la reprend d une
 *                        commande cURL, d une requete HTTP brute — et l envoie
 *                        par le meme chemin que le rejeu : depuis le noyau,
 *                        avec l en-tete X-Swift-Replay, et seulement quand le
 *                        rejeu a ete autorise. La reponse s affiche ici, et
 *                        la requete apparait dans le tableau.
 *
 * Comme un client d API : des variables {{nom}} remplacees a l envoi, des
 * requetes enregistrees sous un nom, une collection qui s exporte et
 * s importe — une collection Postman aussi (lib/collection-requetes.js).
 * Elles restent dans le navigateur, dans le stockage local de l extension.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { state, cmd, toast, copy, saveConfig } from '../app.js';
import { ms, bytes, clock, pretty } from '../lib/format.js';
import { texteLong } from '../lib/texte-long.js';
import { decrireStatut } from '../lib/ref-http.js';
import { lireVariables, remplacerVariables, ecrireCollection, lireCollection } from '../lib/collection-requetes.js';
import { analyserCurl } from '../../background/ingest/curl.js';
import { brutVersCurl } from './tools-import.js';

const METHODES = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'];
const CLE_COLLECTION = 'swift-collection';

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

/** Les en-tetes ecrits « Nom: valeur », un par ligne. */
export function lignesVersEntetes(texte) {
  const out = [];
  for (const ligne of String(texte || '').split('\n')) {
    const i = ligne.indexOf(':');
    if (i <= 0) continue;
    const name = ligne.substring(0, i).trim();
    if (name) out.push({ name, value: ligne.substring(i + 1).trim() });
  }
  return out;
}

/* --------------------------- Collection gardee --------------------------- */
/* Les requetes enregistrees et les variables, dans le stockage local de
   l extension : la console, le panneau lateral et la fenetre compacte les
   partagent. Un stockage illisible ou plein n empeche jamais d envoyer. */
function chargerCollection(etat) {
  if (etat.reqCollection != null) return;
  etat.reqCollection = [];
  try {
    const brut = globalThis.localStorage ? globalThis.localStorage.getItem(CLE_COLLECTION) : null;
    if (brut) {
      const lue = lireCollection(brut);
      etat.reqCollection = lue.requetes;
      if (etat.reqVariables == null) etat.reqVariables = lue.variables;
    }
  } catch { /* stockage illisible : une collection vide */ }
  if (etat.reqVariables == null) etat.reqVariables = '';
}

function garderCollection(etat) {
  try {
    if (globalThis.localStorage) globalThis.localStorage.setItem(CLE_COLLECTION, ecrireCollection(etat.reqCollection, etat.reqVariables));
  } catch { toast('Le stockage local refuse la collection : elle reste le temps de la session', false); }
}

export function panneauRequete(entree, etat, redessiner) {
  const box = frag();
  const permis = envoiPermis();
  chargerCollection(etat);
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
  const variables = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '3', dataset: { champ: 'requete-variables' },
    placeholder: t('variables, une par ligne : base = https://api.example.com — puis {{base}} dans la requete')
  });
  variables.value = etat.reqVariables || '';
  const retenir = () => {
    etat.reqMethode = methode.value;
    etat.reqUrl = url.value;
    etat.reqEntetes = entetes.value;
    etat.reqCorps = corps.value;
    if (etat.reqVariables !== variables.value) { etat.reqVariables = variables.value; garderCollection(etat); }
  };
  for (const champ of [methode, url, entetes, corps, variables]) champ.addEventListener('change', retenir);
  box.appendChild(el('div', { class: 'actions' }, [methode, url]));
  box.appendChild(entetes);
  box.appendChild(corps);

  const actions = el('div', { class: 'actions' });
  if (permis) {
    actions.appendChild(button(etat.reqEnvoi ? 'Envoi…' : 'Envoyer', async () => {
      /* Un double clic, ou un clic pendant l envoi, n envoie pas deux fois. */
      if (etat.reqEnvoi) return;
      retenir();
      /* Les variables d abord : {{base}} devient une adresse. Une variable
         sans valeur arrete l envoi plutot que de partir telle quelle. */
      const vars = lireVariables(etat.reqVariables);
      const manquantes = new Set();
      const remplir = texte => {
        const r = remplacerVariables(texte, vars);
        for (const n of r.manquantes) manquantes.add(n);
        return r.texte;
      };
      const cible = remplir(String(etat.reqUrl || '').trim());
      const enTetes = remplir(etat.reqEntetes);
      const leCorps = remplir(etat.reqCorps);
      if (manquantes.size) return toast(tp('Variables sans valeur : {noms}', { noms: [...manquantes].join(', ') }), false);
      if (!/^https?:\/\//i.test(cible)) return toast('Adresse http ou https attendue', false);
      etat.reqEnvoi = true;
      redessiner();
      const res = await cmd('replay', { id: null, overrides: {
        method: etat.reqMethode, url: cible,
        headers: lignesVersEntetes(enTetes), body: leCorps ? leCorps : null
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

  /* ----------------------------- Variables ------------------------------ */
  box.appendChild(sec('Variables', 'remplacees a l envoi, dans l adresse, les en-tetes et le corps'));
  box.appendChild(variables);
  const vars = lireVariables(etat.reqVariables);
  const restantes = new Set();
  for (const texte of [etat.reqUrl, etat.reqEntetes, etat.reqCorps]) {
    for (const n of remplacerVariables(texte, vars).manquantes) restantes.add(n);
  }
  if (restantes.size) {
    box.appendChild(el('p', { class: 'note warn', text: tp('Variables sans valeur : {noms}', { noms: [...restantes].join(', ') }) }));
  } else if (vars.size) {
    box.appendChild(el('p', { class: 'note', text: tp('{n} variable(s) definie(s)', { n: vars.size }) }));
  }

  /* ------------------------- Requetes enregistrees ----------------------- */
  const collection = etat.reqCollection || [];
  box.appendChild(sec('Requetes enregistrees', collection.length));
  const nom = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.reqNom || '',
    placeholder: t('nom de la requete, par exemple Lister les comptes'), dataset: { champ: 'requete-nom' }
  });
  nom.addEventListener('change', () => { etat.reqNom = nom.value; });
  box.appendChild(el('div', { class: 'actions' }, [nom, button('Enregistrer la requete', () => {
    retenir();
    etat.reqNom = nom.value;
    const leNom = String(etat.reqNom || '').trim();
    if (!leNom) return toast('Donnez un nom a la requete', false);
    const nouvelle = { nom: leNom, methode: etat.reqMethode || 'GET', url: etat.reqUrl || '', entetes: etat.reqEntetes || '', corps: etat.reqCorps || '' };
    const i = collection.findIndex(r => r.nom === leNom);
    if (i >= 0) collection[i] = nouvelle; else collection.push(nouvelle);
    etat.reqCollection = collection;
    garderCollection(etat);
    toast(tp('Requete enregistree : {nom}', { nom: leNom }));
    redessiner();
  })]));
  for (const r of collection) {
    const ligne = el('div', { class: 'kv' }, [el('span', { text: r.nom }), el('b', { text: r.methode + ' ' + r.url })]);
    const charger = button('Charger', () => {
      etat.reqMethode = r.methode; etat.reqUrl = r.url; etat.reqEntetes = r.entetes; etat.reqCorps = r.corps; etat.reqNom = r.nom;
      redessiner();
    });
    const retirer = button('Supprimer', () => {
      etat.reqCollection = collection.filter(x => x !== r);
      garderCollection(etat);
      redessiner();
    }, { class: 'ghost' });
    box.appendChild(el('div', {}, [ligne, el('div', { class: 'actions' }, [charger, retirer])]));
  }
  if (!collection.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Aucune requete enregistree. Donnez un nom a la requete du formulaire et enregistrez-la : elle restera dans ce navigateur.') }));
  }
  box.appendChild(el('div', { class: 'actions' }, [
    button('Exporter la collection', () => copy(ecrireCollection(collection, etat.reqVariables), 'Collection copiee')),
    button('Importer depuis le texte de travail', () => {
      let lue;
      try { lue = lireCollection(entree); }
      catch (e) { return toast(te(e), false); }
      const parNom = new Map(collection.map(r => [r.nom, r]));
      for (const r of lue.requetes) parNom.set(r.nom, r);
      etat.reqCollection = [...parNom.values()];
      if (lue.variables && !String(etat.reqVariables || '').trim()) etat.reqVariables = lue.variables;
      garderCollection(etat);
      toast(tp('{n} requete(s) importee(s)', { n: lue.requetes.length }));
      redessiner();
    })
  ]));
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
