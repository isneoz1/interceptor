/* Panneaux « URL » et « Adresse IP » — INTERCEPTOR (by NeoZ)
 *
 * Une URL vue dans le tableau se decoupe ici en toutes ses parties, avec ce
 * que le port revele et ce que le nom de domaine cache. Une adresse ou un
 * prefixe donne le calcul complet du sous-reseau.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import { analyserUrl, analyserPrefixe, ipDansCidrV4, ipDansCidrV6, estIpv4, estIpv6 } from '../lib/net.js';
import { decrirePort, plagePort } from '../lib/ref-ports.js';
import { decouperPrefixe, resumerPrefixes, plageVersPrefixes, listerAdresses } from '../lib/net-plus.js';
import { normaliserUrl, scriptsDuNom, nomInverse, adresseDepuisNomInverse } from '../lib/url-plus.js';

/* ----------------------------------- URL ---------------------------------- */
export function panneauUrl(entree) {
  const box = frag();
  box.appendChild(sec('URL', 'chaque partie, sans rien masquer'));

  const brut = String(entree || '').trim();
  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Placez une URL dans le texte de travail. Le menu contextuel du tableau y envoie celle d une requete.') }));
    return box;
  }

  let u;
  try { u = analyserUrl(brut.split(/\s+/)[0]); }
  catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('URL illisible : ') + String(e.message || e) }));
    return box;
  }

  add(box, kv('URL normalisee', u.complete, { copy: true, hl: true }));

  /* Forme canonique RFC 3986 section 6.2 : deux URL qui designent la meme
     ressource donnent le meme texte. C est ce qui permet de dire « ces deux
     lignes du tableau sont en fait la meme requete ». */
  try {
    const canon = normaliserUrl(brut.split(/\s+/)[0]);
    add(box, kv('Forme canonique (RFC 3986)', canon.apres, { copy: true }));
    if (!canon.identique) {
      box.appendChild(el('p', { class: 'note', text:
        t('Cette URL n etait pas sous forme canonique : ') + canon.changements.map(c => t(c)).join(', ') + '.' }));
    }
  } catch {}

  add(box, kv('Schema', u.schema));
  if (u.schema === 'http') {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Schema en clair : tout le contenu circule lisible sur le reseau.') }));
  }
  add(box, kv('Hote', u.hote, { copy: true }));
  if (u.hoteTrompeur) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Ce domaine est ecrit en punycode : lu par un humain, il ressemble a un autre.') }));
    add(box, kv('Hote lisible', u.hoteUnicode, { copy: true }));
  }
  add(box, kv('Forme ASCII', u.hoteAscii, { copy: true }));

  /* Un nom peut etre parfaitement valide et pourtant se lire comme un autre :
     une seule lettre cyrillique dans un mot latin suffit. On le dit ici. */
  try {
    const ecritures = scriptsDuNom(u.hoteUnicode || u.hote);
    for (const fait of ecritures.faits) {
      box.appendChild(el('p', { class: ecritures.suspect ? 'note warn' : 'note', text: t(fait) }));
    }
  } catch {}
  add(box, kv('Etiquettes du nom', u.etiquettes.join('   ·   ')));
  add(box, kv('Deux dernieres etiquettes', u.deuxEtiquettes));
  box.appendChild(el('p', { class: 'note', text:
    t('Le domaine reellement enregistrable demande la liste publique des suffixes : les deux dernieres etiquettes n en sont qu une approximation.') }));
  add(box, kv('Adresse IP en guise d hote', u.estAdresseIp ? 'oui' : null));
  add(box, kv('Identifiant dans l URL', u.utilisateur, { copy: true }));
  if (u.motDePasse) {
    add(box, kv('Mot de passe dans l URL', u.motDePasse, { copy: true }));
    box.appendChild(el('p', { class: 'note warn', text:
      t('Un mot de passe dans l URL finit dans les journaux, l historique et l entete Referer.') }));
  }

  const service = u.portEffectif ? decrirePort(u.portEffectif) : null;
  add(box, kv('Port declare', u.port));
  add(box, kv('Port effectif', u.portEffectif, { always: true }));
  if (service) add(box, kv('Service connu sur ce port', service.service + ' — ' + service.note));
  if (u.portEffectif) add(box, kv('Plage du port', t(plagePort(u.portEffectif))));

  add(box, kv('Origine', u.origine, { copy: true }));
  add(box, kv('Chemin', u.chemin, { copy: true }));
  add(box, kv('Segments', u.segments.length ? u.segments.join('   /   ') : null));
  add(box, kv('Fichier', u.fichier));
  add(box, kv('Extension', u.extension));
  add(box, kv('Fragment', u.fragment, { copy: true }));
  add(box, kv('Longueur totale', u.longueur, { always: true }));

  box.appendChild(sec('Parametres', u.parametres.length));
  if (!u.parametres.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun parametre dans cette URL.') }));
  }
  for (const p of u.parametres) add(box, kv(p.cle, p.valeur, { copy: true }));

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Chercher cet hote dans les requetes', () => {
    document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view: 'requests', query: u.hote } }));
  }));
  actions.appendChild(button('Copier l origine', () => {
    if (!u.origine) return toast('Cette URL n a pas d origine', false);
    copy(u.origine, 'Origine copiee');
  }));
  box.appendChild(actions);
  return box;
}

/* -------------------------------- Adresses -------------------------------- */
export function panneauAdresse(entree, etat, redessiner, poser) {
  const box = frag();
  box.appendChild(sec('Adresse et sous-reseau', 'IPv4 et IPv6'));

  let brut = String(entree || '').trim().split(/\s+/)[0];
  if (!brut) {
    box.appendChild(el('p', { class: 'note', text:
      t('Placez une adresse ou un prefixe dans le texte de travail : 192.168.1.130/26, 2001:db8::1/64, ou un nom in-addr.arpa.') }));
    return box;
  }

  /* Un nom PTR est accepte tel quel : on le relit comme l adresse qu il
     designe, plutot que de rendre « adresse illisible » sur une entree
     parfaitement valide copiee depuis un journal DNS. */
  if (/\.(in-addr|ip6)\.arpa\.?$/i.test(brut)) {
    try {
      const retrouvee = adresseDepuisNomInverse(brut);
      box.appendChild(el('p', { class: 'note', text:
        t('Nom inverse lu comme l adresse ') + retrouvee + '.' }));
      brut = retrouvee;
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Nom inverse illisible : ') + String(e.message || e) }));
      return box;
    }
  }

  let bloc;
  try { bloc = analyserPrefixe(brut); }
  catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Adresse illisible : ') + String(e.message || e) }));
    return box;
  }

  add(box, kv('Famille', bloc.famille, { hl: true }));
  add(box, kv('Adresse', bloc.adresse, { copy: true }));
  add(box, kv('Prefixe', '/' + bloc.prefixe, { always: true }));
  add(box, kv('Categorie', bloc.categorie, { hl: true }));

  if (bloc.famille === 'IPv4') {
    add(box, kv('Masque de sous-reseau', bloc.masque, { copy: true }));
    add(box, kv('Masque joker', bloc.masqueJoker, { copy: true }));
    add(box, kv('Adresse de reseau', bloc.reseau, { copy: true }));
    add(box, kv('Adresse de diffusion', bloc.diffusion, { copy: true }));
    add(box, kv('Premiere adresse utilisable', bloc.premiere, { copy: true }));
    add(box, kv('Derniere adresse utilisable', bloc.derniere, { copy: true }));
    add(box, kv('Adresses au total', bloc.adresses, { always: true }));
    add(box, kv('Adresses utilisables', bloc.utilisables, { always: true }));
    add(box, kv('Valeur entiere', bloc.entier, { copy: true, always: true }));
    add(box, kv('Binaire', bloc.binaire, { copy: true }));
    add(box, kv('Hexadecimal', bloc.hexadecimal, { copy: true }));
  } else {
    add(box, kv('Ecriture longue', bloc.etendue, { copy: true }));
    add(box, kv('Premiere adresse', bloc.premiere, { copy: true }));
    add(box, kv('Derniere adresse', bloc.derniere, { copy: true }));
    add(box, kv('Adresses au total', bloc.adresses, { always: true }));
    add(box, kv('Hexadecimal', bloc.hexadecimal, { copy: true }));
  }
  const inverse = (() => { try { return nomInverse(bloc.adresse); } catch { return bloc.inverse; } })();
  add(box, kv('Nom inverse (DNS)', inverse, { copy: true }));

  /* ------------------------- Appartenance a un bloc ---------------------- */
  box.appendChild(sec('Appartenance', 'cette adresse est-elle dans ce prefixe ?'));
  const champ = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: '10.0.0.0/8', value: etat.prefixeTest || ''
  });
  champ.addEventListener('change', () => { etat.prefixeTest = champ.value; redessiner(); });
  box.appendChild(el('div', { class: 'actions' }, [champ]));

  if (etat.prefixeTest) {
    const adresse = brut.split('/')[0];
    try {
      const dedans = estIpv4(adresse) ? ipDansCidrV4(adresse, etat.prefixeTest)
        : estIpv6(adresse) ? ipDansCidrV6(adresse, etat.prefixeTest)
        : false;
      box.appendChild(el('p', { class: dedans ? 'note' : 'note warn', text: dedans
        ? t('Oui : cette adresse appartient au prefixe.')
        : t('Non : cette adresse est hors du prefixe.') }));
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Prefixe illisible : ') + String(e.message || e) }));
    }
  }

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Chercher cette adresse dans les requetes', () => {
    document.dispatchEvent(new CustomEvent('ic:goto',
      { detail: { view: 'requests', query: brut.split('/')[0] } }));
  }));
  box.appendChild(actions);

  if (bloc.famille === 'IPv4') ecrirePrefixes(box, brut, etat, redessiner, poser);
  return box;
}

/* ------------------------- Operations sur les prefixes -------------------- */
function ecrirePrefixes(box, brut, etat, redessiner, poser) {
  box.appendChild(sec('Decouper', 'en sous-reseaux de taille egale'));
  const taille = el('input', {
    type: 'number', class: 'field', min: '0', max: '32', style: 'max-width:110px',
    value: String(etat.sousPrefixe || 26)
  });
  taille.addEventListener('change', () => { etat.sousPrefixe = Number(taille.value); redessiner(); });
  const barre = el('div', { class: 'actions' }, [el('span', { class: 'note', text: '/' }), taille]);
  barre.appendChild(button('Decouper', () => { etat.decoupe = true; redessiner(); }));
  box.appendChild(barre);

  if (etat.decoupe) {
    try {
      const r = decouperPrefixe(brut, etat.sousPrefixe || 26);
      box.appendChild(sec('Sous-reseaux', r.total + (r.affiches < r.total ? '   ·   ' + r.affiches + ' affiches' : '')));
      for (const sous of r.sousReseaux) {
        add(box, kv(sous.cidr, sous.premiere + '  a  ' + sous.derniere, { copy: true }));
      }
      box.appendChild(el('div', { class: 'actions' },
        button('Poser la liste comme entree',
          () => poser(r.sousReseaux.map(s => s.cidr).join('\n')))));
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Decoupage impossible : ') + String(e.message || e) }));
    }
  }

  box.appendChild(sec('Resumer', 'le plus petit prefixe qui couvre une liste'));
  const zone = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '3',
    placeholder: t('un prefixe ou une adresse par ligne : 10.0.1.0/24, 10.0.2.5...')
  });
  zone.value = etat.listePrefixes || '';
  zone.addEventListener('change', () => { etat.listePrefixes = zone.value; redessiner(); });
  box.appendChild(zone);
  if (etat.listePrefixes && etat.listePrefixes.trim()) {
    try {
      const r = resumerPrefixes(etat.listePrefixes);
      add(box, kv('Prefixes lus', r.prefixes, { always: true }));
      add(box, kv('Resume', r.resume, { copy: true, hl: true }));
      add(box, kv('Etendue', r.premiere + '  a  ' + r.derniere));
      add(box, kv('Adresses couvertes', r.adresses, { always: true }));
      if (!r.couvertureExacte) {
        box.appendChild(el('p', { class: 'note warn', text:
          t('Ce resume couvre plus large que la liste : il inclut des adresses qui n y figuraient pas.') }));
      }
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Resume impossible : ') + String(e.message || e) }));
    }
  }

  box.appendChild(sec('Plage vers prefixes', 'la liste minimale qui couvre exactement une plage'));
  const debut = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: '192.0.2.5', value: etat.plageDebut || '', style: 'max-width:180px'
  });
  const fin = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: '192.0.2.20', value: etat.plageFin || '', style: 'max-width:180px'
  });
  debut.addEventListener('change', () => { etat.plageDebut = debut.value; redessiner(); });
  fin.addEventListener('change', () => { etat.plageFin = fin.value; redessiner(); });
  box.appendChild(el('div', { class: 'actions' }, [debut, fin]));
  if (etat.plageDebut && etat.plageFin) {
    try {
      const prefixes = plageVersPrefixes(etat.plageDebut, etat.plageFin);
      box.appendChild(sec('Prefixes', prefixes.length));
      for (const p of prefixes) add(box, kv('prefixe', p, { copy: true }));
      box.appendChild(el('div', { class: 'actions' },
        button('Poser la liste comme entree', () => poser(prefixes.join('\n')))));
    } catch (e) {
      box.appendChild(el('p', { class: 'note warn', text: t('Conversion impossible : ') + String(e.message || e) }));
    }
  }

  box.appendChild(sec('Enumerer', 'les premieres adresses du bloc'));
  box.appendChild(el('div', { class: 'actions' }, button('Lister jusqu a 256 adresses', () => {
    try {
      const r = listerAdresses(brut, 256);
      poser(r.adresses.join('\n'));
      toast(r.affichees + ' adresses posees sur ' + r.total);
    } catch (e) { toast(String(e.message || e), false); }
  })));
}
