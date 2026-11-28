/* Panneau « Client GraphQL » — SWIFT (by D4RK)
 *
 * Ecrire une requete GraphQL, ses variables, l envoyer, lire la reponse :
 * les donnees, et les erreurs que le statut 200 cache. Puis demander au
 * serveur son schema par introspection, parcourir ses points d entree et
 * en tirer une requete prete a envoyer (lib/graphql-schema.js).
 *
 * L envoi passe par le rejeu du noyau, comme « Envoyer une requete » : avec
 * les cookies du site, l en-tete X-Swift-Replay, et la ligne apparait dans
 * le tableau, ou le detail lit l operation GraphQL comme pour toute
 * requete capturee. Seulement sur un clic, et quand le rejeu est autorise.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { cmd, toast, copy } from '../app.js';
import { ms, bytes, pretty } from '../lib/format.js';
import { texteLong } from '../lib/texte-long.js';
import { listeProgressive } from '../lib/liste-progressive.js';
import { operationsGraphql, lireRequeteGraphql, lireReponseGraphql, faitsGraphql } from '../lib/graphql-http.js';
import {
  REQUETE_INTROSPECTION, lireSchemaIntrospection, champsRacine, signatureChamp, squeletteOperation, chercherSchema
} from '../lib/graphql-schema.js';
import { envoiPermis, boutonAutoriser, lignesVersEntetes } from './tools-requete.js';

const RACINES = [['query', 'Requetes (Query)'], ['mutation', 'Mutations'], ['subscription', 'Abonnements (Subscription)']];

/* Ce que le texte de travail peut fournir : un corps JSON { query,
   variables } — celui d une requete capturee —, ou un document seul. */
export function graphqlDepuisTexte(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  if (!brut) return null;
  if (brut.startsWith('{') && /"query"\s*:/.test(brut)) {
    try {
      const j = JSON.parse(brut);
      if (j && typeof j.query === 'string') {
        return { requete: j.query, variables: j.variables ? JSON.stringify(j.variables, null, 2) : '', operation: j.operationName || '' };
      }
    } catch { /* pas du JSON : peut-etre un document */ }
  }
  return operationsGraphql(brut).length ? { requete: brut, variables: '', operation: '' } : null;
}

async function envoyer(etat, requete, variablesTexte, operation, limiteCorps) {
  let variables;
  if (String(variablesTexte || '').trim()) {
    try { variables = JSON.parse(variablesTexte); }
    catch { return { error: 'variables illisibles : un objet JSON est attendu' }; }
    if (!variables || typeof variables !== 'object' || Array.isArray(variables)) return { error: 'variables illisibles : un objet JSON est attendu' };
  }
  const corps = JSON.stringify({ query: requete, ...(variables ? { variables } : {}), ...(operation ? { operationName: operation } : {}) });
  const entetes = lignesVersEntetes(etat.gqlEntetes);
  if (!entetes.some(h => h.name.toLowerCase() === 'content-type')) entetes.push({ name: 'Content-Type', value: 'application/json' });
  if (!entetes.some(h => h.name.toLowerCase() === 'accept')) {
    entetes.push({ name: 'Accept', value: 'application/graphql-response+json, application/json' });
  }
  const res = await cmd('replay', { id: null, overrides: {
    method: 'POST', url: String(etat.gqlUrl || '').trim(), headers: entetes, body: corps, limiteCorps
  } });
  if (res.error) return res;
  return { ok: true, resultat: { ...res.result, corpsEnvoye: corps } };
}

function reponse(r) {
  const box = frag();
  box.appendChild(sec('Reponse recue', r.status + (r.statusText ? ' ' + r.statusText : '')));
  add(box, kv('Duree', ms(r.duration)));
  add(box, kv('Taille recue', bytes(r.bodySize)));
  const typeMedia = ((r.headers || []).find(h => h.name.toLowerCase() === 'content-type') || {}).value || '';
  const lue = lireReponseGraphql(r.body || '');
  const requete = lireRequeteGraphql({ methode: 'POST', url: r.url, corps: { contentType: 'application/json', text: r.corpsEnvoye } });
  for (const f of faitsGraphql(requete, lue, { statut: r.status, typeMedia })) {
    box.appendChild(el('p', { class: f.cle === 'statut200Erreurs' || f.cle === 'erreurRequete' || f.cle === 'erreurExecution' ? 'note warn' : 'note',
      text: tp(f.texte, f.valeurs) }));
  }
  if (lue) {
    for (const res of lue.resultats) {
      for (const e of res.erreurs) {
        const carte = el('div', { class: 'find high' }, [el('h4', { text: e.message || t('erreur sans message') })]);
        add(carte, kv('Chemin', e.chemin));
        add(carte, kv('Position dans la requete', e.lieux));
        add(carte, kv('Code', e.code));
        box.appendChild(carte);
      }
    }
  } else if (r.body) {
    box.appendChild(el('p', { class: 'note warn', text: t('Le corps recu n est pas un resultat GraphQL (ni data, ni errors).') }));
  }
  if (r.truncated) box.appendChild(el('p', { class: 'note warn', text: tp('Corps coupe : {n} caracteres recus, le noyau n en transmet pas davantage.', { n: r.bodySize }) }));
  if (r.body) {
    box.appendChild(texteLong(pretty(r.body, typeMedia), { seuil: 20000 }));
    box.appendChild(el('div', { class: 'actions' }, [button('Copier la reponse', () => copy(r.body, 'Reponse copiee'))]));
  }
  return box;
}

let rendus = [];

export function panneauGraphql(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Client GraphQL', 'requete, variables, introspection du schema'));
  box.appendChild(el('p', { class: 'note warn', text:
    t('La requete part du navigateur avec vos cookies pour ce site, porte l en-tete X-Swift-Replay, et apparait dans le tableau comme une ligne normale. A n envoyer qu a des services dont vous avez la responsabilite.') }));

  if (etat.gqlRequete == null) {
    const lu = graphqlDepuisTexte(entree);
    etat.gqlRequete = lu ? lu.requete : '';
    etat.gqlVariables = lu ? lu.variables : '';
    etat.gqlOperation = lu ? lu.operation : '';
  }
  const url = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.gqlUrl || '',
    placeholder: t('point d acces, par exemple https://api.example.com/graphql'), dataset: { champ: 'gql-url' }
  });
  const entetes = el('textarea', { class: 'field', spellcheck: 'false', rows: '2', dataset: { champ: 'gql-entetes' },
    placeholder: t('un en-tete par ligne : Nom: valeur') });
  entetes.value = etat.gqlEntetes || '';
  const requete = el('textarea', { class: 'field', spellcheck: 'false', rows: '8', dataset: { champ: 'gql-requete' },
    placeholder: t('requete GraphQL, par exemple query { me { id name } }') });
  requete.value = etat.gqlRequete || '';
  const variables = el('textarea', { class: 'field', spellcheck: 'false', rows: '3', dataset: { champ: 'gql-variables' },
    placeholder: t('variables en JSON (facultatif), par exemple {"id": "42"}') });
  variables.value = etat.gqlVariables || '';
  const retenir = () => {
    etat.gqlUrl = url.value; etat.gqlEntetes = entetes.value; etat.gqlRequete = requete.value; etat.gqlVariables = variables.value;
  };
  for (const c of [url, entetes, requete, variables]) c.addEventListener('change', retenir);
  box.appendChild(url);
  box.appendChild(entetes);
  box.appendChild(requete);

  /* Plusieurs operations dans le document : il faut dire laquelle executer. */
  const operations = operationsGraphql(etat.gqlRequete || '').filter(o => o.nom);
  let choix = null;
  if (operations.length > 1) {
    choix = el('select', { dataset: { champ: 'gql-operation' } });
    for (const o of operations) choix.appendChild(el('option', { value: o.nom, text: o.type + ' ' + o.nom, selected: etat.gqlOperation === o.nom }));
    choix.addEventListener('change', () => { etat.gqlOperation = choix.value; });
    box.appendChild(el('div', { class: 'actions' }, [el('span', { class: 'note', text: t('Operation a executer') }), choix]));
  }
  box.appendChild(variables);

  const pret = () => {
    retenir();
    if (choix) etat.gqlOperation = choix.value;
    if (!/^https?:\/\//i.test(String(etat.gqlUrl || '').trim())) { toast('Adresse http ou https attendue', false); return false; }
    return true;
  };
  const actions = el('div', { class: 'actions' });
  if (!envoiPermis()) actions.appendChild(boutonAutoriser(redessiner));
  else {
    actions.appendChild(button(etat.gqlEnvoi ? 'Envoi…' : 'Envoyer', async () => {
      if (etat.gqlEnvoi || !pret()) return;
      if (!String(etat.gqlRequete || '').trim()) return toast('Requete GraphQL vide', false);
      etat.gqlEnvoi = true;
      redessiner();
      const res = await envoyer(etat, etat.gqlRequete, etat.gqlVariables, operations.length > 1 ? etat.gqlOperation : '', 200000);
      etat.gqlEnvoi = false;
      if (res.error) { etat.gqlErreur = res.error; toast(te(res.error), false); }
      else { etat.gqlErreur = null; etat.gqlReponse = res.resultat; }
      redessiner();
    }, { class: 'accent' }));
    actions.appendChild(button(etat.gqlIntrospection ? 'Lecture du schema…' : 'Lire le schema (introspection)', async () => {
      if (etat.gqlIntrospection || !pret()) return;
      etat.gqlIntrospection = true;
      redessiner();
      const res = await envoyer(etat, REQUETE_INTROSPECTION, '', '', 32 * 1024 * 1024);
      etat.gqlIntrospection = false;
      if (res.error) { etat.gqlErreur = res.error; toast(te(res.error), false); redessiner(); return; }
      etat.gqlReponse = res.resultat;
      try {
        etat.gqlSchema = lireSchemaIntrospection(JSON.parse(res.resultat.body));
        etat.gqlErreur = null;
        toast(tp('Schema lu : {n} types', { n: etat.gqlSchema.nombre }));
      } catch (e) {
        etat.gqlErreur = String((e && e.message) || e);
        toast('Le serveur n a pas livre son schema : l introspection est peut-etre desactivee', false);
      }
      redessiner();
    }));
  }
  actions.appendChild(button('Reprendre le texte de travail', () => {
    const lu = graphqlDepuisTexte(entree);
    if (!lu) return toast('Ni requete GraphQL, ni corps JSON avec une cle query dans le texte de travail', false);
    etat.gqlRequete = lu.requete; etat.gqlVariables = lu.variables; etat.gqlOperation = lu.operation;
    redessiner();
  }));
  box.appendChild(actions);

  if (etat.gqlErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.gqlErreur) }));
  if (etat.gqlReponse) box.appendChild(reponse(etat.gqlReponse));

  /* ------------------------------- Schema ------------------------------- */
  const schema = etat.gqlSchema;
  if (!schema) {
    if (!etat.gqlReponse) {
      box.appendChild(el('p', { class: 'note', text:
        t('« Lire le schema » demande au serveur la liste de ses types et de ses points d entree ; chaque champ peut alors devenir une requete prete a envoyer.') }));
    }
    return box;
  }
  box.appendChild(sec('Schema', tp('{n} types', { n: schema.nombre })));
  const filtre = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.gqlFiltre || '',
    placeholder: t('chercher un type ou un champ'), dataset: { champ: 'gql-filtre' }
  });
  filtre.addEventListener('change', () => { etat.gqlFiltre = filtre.value; redessiner(); });
  box.appendChild(filtre);
  const mot = String(etat.gqlFiltre || '').trim();
  if (mot) {
    const trouves = chercherSchema(schema, mot);
    box.appendChild(sec('Resultats', trouves.length));
    for (const x of trouves) add(box, kv(x.type, x.champ ? signatureChamp(x.champ) : x.genre, { copy: true }));
  }
  const inserer = (operation, nom) => {
    const s = squeletteOperation(schema, operation, nom, { profondeur: 2 });
    etat.gqlRequete = s.requete;
    etat.gqlVariables = Object.keys(s.variables).length ? JSON.stringify(s.variables, null, 2) : '';
    etat.gqlOperation = '';
    toast(tp('Requete preparee pour {nom}', { nom }));
    redessiner();
  };
  for (const r of rendus) r.arreter();
  rendus = [];
  for (const [operation, libelle] of RACINES) {
    const champs = champsRacine(schema, operation);
    if (!champs.length) continue;
    box.appendChild(sec(libelle, champs.length));
    const hote = el('div');
    box.appendChild(hote);
    rendus.push(listeProgressive(hote, champs, c => {
      const ligne = el('div', { class: 'kv' + (c.deprecie ? ' hl' : '') }, [
        el('span', { text: signatureChamp(c) }),
        el('b', { text: c.description || (c.deprecie ? t('deprecie') + (c.raison ? ' : ' + c.raison : '') : '') })
      ]);
      const preparer = button('Preparer la requete', () => inserer(operation, c.nom), { class: 'ghost' });
      return el('div', {}, [ligne, preparer]);
    }));
  }
  box.appendChild(el('div', { class: 'actions' }, [
    button('Copier la requete d introspection', () => copy(REQUETE_INTROSPECTION, 'Requete copiee'))
  ]));
  return box;
}
