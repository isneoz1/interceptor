/* Panneau « Verifier un site » — SWIFT (by D4RK)
 *
 * Un nom de domaine, un clic : la session TLS et le certificat, le passage
 * de http a https, les protections de la page, les cookies qu elle pose a la
 * premiere visite, ce qu elle annonce (HTTP/3, logiciel du serveur) et son
 * security.txt. Trois requetes partent du noyau, sans les cookies de
 * l utilisateur ; la capture les enregistre comme les autres, et c est dans
 * ces enregistrements que tout se lit — par le meme code que le detail
 * (lib/verification-site.js, lib/protections.js).
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t, tp, te, deuxPoints } from '../lib/i18n.js';
import { cmd, toast, copy } from '../app.js';
import { clock } from '../lib/format.js';
import { bilanSite, hoteAVerifier } from '../lib/verification-site.js';
import { envoiPermis, boutonAutoriser } from './tools-requete.js';

const SYMBOLE = { present: '✓', absent: '—', partiel: '◐', inoperant: '✗', info: '·' };

/** Le nom a verifier, lu dans le texte de travail : une adresse http(s)
 *  complete — « https://localhost:8443/ » compris —, ou un nom qui a au
 *  moins un point, pour ne pas prendre un mot pour un site. */
export function hoteDepuisTexte(texte) {
  const brut = String(texte == null ? '' : texte).trim();
  const h = hoteAVerifier(brut);
  if (!h) return '';
  return /^https?:\/\//i.test(brut) || /\./.test(h.nom) ? h.cible : '';
}

const traduireValeurs = l => {
  const valeurs = { ...(l.valeurs || {}) };
  for (const cle of l.aTraduire || []) valeurs[cle] = t(valeurs[cle]);
  return valeurs;
};

function ouvrirDansLeDetail(id) {
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', id } }));
}

export function panneauVerifier(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Verifier un site', 'TLS, certificat, redirections, protections, cookies et security.txt, en un clic'));
  box.appendChild(el('p', { class: 'note warn', text:
    t('Trois requetes partent du navigateur, sans vos cookies : la page d accueil en https, la meme en http, et /.well-known/security.txt. Elles portent l en-tete X-Swift-Replay et apparaissent dans le tableau, comme une visite ordinaire.') }));

  if (etat.verifHote == null) etat.verifHote = hoteDepuisTexte(entree);
  const champ = el('input', {
    type: 'text', class: 'field', spellcheck: 'false', value: etat.verifHote || '',
    placeholder: t('nom de domaine ou adresse, par exemple example.com'), dataset: { champ: 'verif-hote' }
  });
  champ.addEventListener('change', () => { etat.verifHote = champ.value; });
  const actions = el('div', { class: 'actions' }, [champ]);
  if (!envoiPermis()) actions.appendChild(boutonAutoriser(redessiner));
  else {
    actions.appendChild(button(etat.verifEnCours ? 'Verification…' : 'Verifier', async () => {
      if (etat.verifEnCours) return;
      etat.verifHote = champ.value;
      if (!hoteAVerifier(etat.verifHote)) return toast('Nom de domaine ou adresse attendu, par exemple example.com', false);
      etat.verifEnCours = true;
      etat.verifErreur = null;
      redessiner();
      const res = await cmd('verifierSite', { hote: etat.verifHote });
      if (res.error) {
        etat.verifEnCours = false;
        etat.verifErreur = res.error;
        toast(te(res.error), false);
        redessiner();
        return;
      }
      /* Les enregistrements complets : TLS, certificat, redirections et
         cookies ne sont que dans la capture. */
      const sondes = res.resultat.sondes || [];
      const recs = await Promise.all(sondes.map(s => (s.recordId == null ? null
        : cmd('record', { id: s.recordId }).then(r => (r && r.record) || null))));
      const parRole = {};
      sondes.forEach((s, i) => { parRole[s.role] = { sonde: s, rec: recs[i] }; });
      etat.verifResultat = {
        ...res.resultat,
        parRole,
        sections: bilanSite({ hote: res.resultat.hote, https: parRole.https || {}, http: parRole.http || {},
          securityTxt: parRole['security.txt'] || {}, maintenant: Date.now() })
      };
      etat.verifEnCours = false;
      redessiner();
    }, { class: 'accent' }));
  }
  box.appendChild(actions);

  if (etat.verifErreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + te(etat.verifErreur) }));
  const r = etat.verifResultat;
  if (!r) {
    box.appendChild(el('p', { class: 'note', text:
      t('Donnez un nom de domaine : le bilan dit ce qui protege la connexion et la page, ligne par ligne. Rien ne part sans un clic sur « Verifier ».') }));
    return box;
  }

  box.appendChild(sec(r.hote, tp('verifie a {heure}', { heure: clock(r.a) })));
  const sansCapture = ['https', 'http', 'security.txt'].filter(role => r.parRole[role] && r.parRole[role].sonde && !r.parRole[role].sonde.erreur && !r.parRole[role].rec);
  if (sansCapture.length) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('La capture n a pas retenu une partie de ces requetes (en pause, ou filtree) : pour elles, seul ce que fetch voit est lu — ni TLS, ni certificat, ni cookies.') }));
  }
  for (const section of r.sections) {
    box.appendChild(sec(section.nom, section.lignes.length));
    for (const l of section.lignes) {
      add(box, kv(l.nom, SYMBOLE[l.etat] + '  ' + tp(l.texte, traduireValeurs(l)), { hl: l.etat === 'inoperant' }));
    }
  }

  const liens = el('div', { class: 'actions' });
  const id = role => r.parRole[role] && r.parRole[role].sonde ? r.parRole[role].sonde.recordId : null;
  if (id('https') != null) liens.appendChild(button('Ouvrir la page dans le detail', () => ouvrirDansLeDetail(id('https'))));
  if (id('http') != null) liens.appendChild(button('Ouvrir la version http', () => ouvrirDansLeDetail(id('http'))));
  if (id('security.txt') != null) liens.appendChild(button('Ouvrir security.txt', () => ouvrirDansLeDetail(id('security.txt'))));
  liens.appendChild(button('Copier le bilan', () => {
    const lignes = [r.hote];
    for (const s of r.sections) {
      lignes.push('', t(s.nom));
      for (const l of s.lignes) lignes.push(SYMBOLE[l.etat] + ' ' + deuxPoints(t(l.nom), tp(l.texte, traduireValeurs(l))));
    }
    copy(lignes.join('\n'), 'Bilan copie');
  }));
  box.appendChild(liens);
  return box;
}
