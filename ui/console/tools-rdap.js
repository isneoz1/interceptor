/* Panneau « Whois (RDAP) » — SWIFT (by D4RK)
 *
 * Qui a enregistre ce domaine et quand il expire, quel bureau
 * d enregistrement le gere, comment signaler un abus ; a qui appartient
 * cette adresse IP ou ce systeme autonome. La question part du noyau vers le
 * serveur RDAP que designe l IANA (lib/rdap.js), sur un clic, sans les
 * cookies de l utilisateur.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te } from '../lib/i18n.js';
import { cmd, toast, copy } from '../app.js';
import { ms } from '../lib/format.js';
import { texteLong } from '../lib/texte-long.js';
import {
  requeteRdap, lireRdap, STATUTS_RDAP, EVENEMENTS_RDAP, ROLES_RDAP, entiteDeRole, liensRdapLies, dateEvenement
} from '../lib/rdap.js';
import { envoiPermis, boutonAutoriser } from './tools-requete.js';

const CLASSES = new Map([['domain', 'domaine'], ['ip network', 'bloc d adresses'], ['autnum', 'systeme autonome'],
  ['entity', 'entite'], ['nameserver', 'serveur de noms']]);

/** Ce qu on peut demander, lu dans le texte de travail. */
export function requeteDepuisTexteRdap(texte) {
  const q = requeteRdap(texte);
  return q ? (q.type === 'autnum' ? 'AS' + q.valeur : q.valeur) : '';
}

function jours(date, maintenant = Date.now()) {
  const ms2 = Date.parse(date);
  return Number.isFinite(ms2) ? Math.floor((ms2 - maintenant) / 86400000) : null;
}

function carte(r) {
  const box = el('div', { class: 'find info' });
  if (r.statut === 404) {
    box.appendChild(el('h4', { text: r.requete ? r.requete.valeur : r.url }));
    box.appendChild(el('p', { class: 'note', text:
      t('Le registre ne connait pas cet objet (404) : un domaine absent n est peut-etre pas enregistre.') }));
    add(box, kv('Serveur interroge', r.url, { copy: true }));
    return box;
  }
  let lu;
  try { lu = lireRdap(r.json); }
  catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Reponse illisible : ') + te(e) }));
    return box;
  }
  const classe = lu.classe && CLASSES.has(lu.classe) ? t(CLASSES.get(lu.classe)) : (lu.classe || '');
  box.appendChild(el('h4', { text: (lu.nomUnicode || lu.nom || lu.poignee || '?') + (classe ? '  ·  ' + classe : '') }));
  if (lu.erreur) {
    box.appendChild(el('p', { class: 'note warn', text: tp('Erreur RDAP {code} : {titre}', { code: lu.erreur.code, titre: lu.erreur.titre || lu.erreur.description || '' }) }));
  }
  add(box, kv('Serveur interroge', r.url, { copy: true }));
  add(box, kv('Duree mesuree', ms(r.duree)));
  add(box, kv('Identifiant au registre', lu.poignee, { copy: true }));

  for (const e of lu.evenements) {
    const libelle = EVENEMENTS_RDAP.has(e.action) ? t(EVENEMENTS_RDAP.get(e.action)) : e.action;
    add(box, kv(libelle, e.date.replace('T', ' ').replace(/(\.\d+)?Z$/, ' UTC'), { hl: e.action === 'expiration' }));
  }
  const expiration = dateEvenement(lu, 'expiration');
  if (expiration) {
    const n = jours(expiration);
    if (n != null) {
      box.appendChild(el('p', { class: n < 0 ? 'note warn' : 'note', text: n < 0
        ? tp('Expire depuis {n} jour(s).', { n: -n })
        : tp('Expire dans {n} jour(s).', { n }) }));
    }
  }
  for (const s of lu.statuts) {
    add(box, kv(s, STATUTS_RDAP.has(s) ? t(STATUTS_RDAP.get(s)) : '—', { hl: /hold|redemption|pending delete/.test(s) }));
  }

  const registrar = entiteDeRole(lu, 'registrar');
  if (registrar) {
    add(box, kv('Bureau d enregistrement', registrar.nom || registrar.organisation || registrar.poignee, { copy: true }));
    for (const id of registrar.identifiants) add(box, kv('Identifiant', id));
  }
  const abus = entiteDeRole(lu, 'abuse');
  if (abus) add(box, kv('Contact abus', [abus.courriel, abus.telephone].filter(Boolean).join('  ·  ') || abus.nom, { copy: true }));
  for (const e of lu.entites) {
    if (e === registrar || e === abus) continue;
    const role = e.roles.map(x => (ROLES_RDAP.has(x) ? t(ROLES_RDAP.get(x)) : x)).join(', ');
    const qui = [e.organisation, e.nom, e.courriel, e.pays].filter(Boolean).join('  ·  ');
    if (qui) add(box, kv(role || t('Entite'), qui, { copy: true }));
  }

  if (lu.serveursDeNoms.length) {
    add(box, kv('Serveurs de noms', lu.serveursDeNoms.map(n => n.nom).join(', '), { copy: true }));
  }
  if (lu.dnssec) {
    add(box, kv('DNSSEC', lu.dnssec.signe ? tp('delegation signee ({n} DS)', { n: lu.dnssec.ds }) : t('delegation non signee')));
  }
  if (lu.plage) {
    add(box, kv('Plage', [lu.plage.debut, lu.plage.fin].filter(Boolean).join(' – '), { copy: true }));
    if (lu.plage.cidrs.length) add(box, kv('Prefixes', lu.plage.cidrs.join(', '), { copy: true }));
    add(box, kv('Type d attribution', lu.plage.type));
    add(box, kv('Bloc parent', lu.plage.parent));
  }
  if (lu.asn) add(box, kv('Numeros AS', lu.asn.fin != null && lu.asn.fin !== lu.asn.debut ? lu.asn.debut + ' – ' + lu.asn.fin : lu.asn.debut));
  add(box, kv('Pays', lu.pays));
  for (const a of lu.avis) box.appendChild(el('p', { class: 'note', text: '·  ' + a }));
  return { box, lu };
}

export function panneauRdap(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Whois (RDAP)', 'domaine, adresse IP ou numero AS, aupres du registre qui en repond'));
  box.appendChild(el('p', { class: 'note warn', text:
    t('La question part du navigateur, sans vos cookies, vers le serveur RDAP que designe l IANA pour ce domaine ou cette adresse, ou vers celui que vous donnez. Elle porte l en-tete X-Swift-Replay et apparait dans le tableau.') }));

  if (etat.rdapRequete == null) etat.rdapRequete = requeteDepuisTexteRdap(entree);
  const champ = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.rdapRequete || '',
    placeholder: t('domaine, adresse IP ou numero AS, par exemple example.com'), dataset: { champ: 'rdap-requete' }
  });
  champ.addEventListener('change', () => { etat.rdapRequete = champ.value; });
  const serveur = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.rdapServeur || '',
    placeholder: t('serveur RDAP (facultatif), par exemple https://rdap.example/'), dataset: { champ: 'rdap-serveur' }
  });
  serveur.addEventListener('change', () => { etat.rdapServeur = serveur.value; });
  box.appendChild(el('div', { class: 'actions' }, [champ, serveur]));

  const interroger = async args => {
    if (etat.rdapEnCours) return;
    etat.rdapEnCours = true;
    etat.rdapErreur = null;
    redessiner();
    const res = await cmd('rdap', args);
    etat.rdapEnCours = false;
    if (res.error) { etat.rdapErreur = res.error; toast(te(res.error), false); }
    else etat.rdapResultats = [res.resultat, ...(etat.rdapResultats || [])];
    redessiner();
  };

  const actions = el('div', { class: 'actions' });
  if (!envoiPermis()) actions.appendChild(boutonAutoriser(redessiner));
  else {
    actions.appendChild(button(etat.rdapEnCours ? 'Interrogation…' : 'Interroger', () => {
      etat.rdapRequete = champ.value;
      etat.rdapServeur = serveur.value;
      if (!requeteRdap(etat.rdapRequete)) return toast('Domaine, adresse IP ou numero AS attendu', false);
      return interroger({ requete: etat.rdapRequete, serveur: etat.rdapServeur });
    }, { class: 'accent' }));
  }
  box.appendChild(actions);

  if (etat.rdapErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.rdapErreur) }));
  const resultats = etat.rdapResultats || [];
  if (!resultats.length) {
    box.appendChild(el('p', { class: 'note', text:
      t('RDAP remplace whois : des reponses en JSON, les memes champs partout — dates d enregistrement et d expiration, statuts, bureau d enregistrement, contact abus, serveurs de noms, DNSSEC. Rien ne part sans un clic sur « Interroger ».') }));
  }
  for (const r of resultats) {
    const fait = carte(r);
    const hote = fait.box || fait;
    if (fait.lu && envoiPermis()) {
      const lies = liensRdapLies(fait.lu);
      if (lies.length) {
        const rangee = el('div', { class: 'actions' });
        for (const l of lies) {
          rangee.appendChild(button(tp('Interroger aussi {hote}', { hote: (() => { try { return new URL(l.href).host; } catch { return l.href; } })() }),
            () => interroger({ url: l.href })));
        }
        hote.appendChild(rangee);
      }
    }
    if (r.json) {
      const json = JSON.stringify(r.json, null, 2);
      hote.appendChild(el('div', { class: 'actions' }, [button('Copier la reponse JSON', () => copy(json, 'Reponse copiee'))]));
      hote.appendChild(texteLong(json, { seuil: 1500 }));
    }
    box.appendChild(hote);
  }
  return box;
}
