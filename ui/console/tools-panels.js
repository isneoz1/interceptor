/* Panneaux de la boite a outils — INTERCEPTOR (by D4RK)
 *
 * Inspection d une valeur : jeton JWT, empreintes et signatures, mesures,
 * vidage hexadecimal, structures reconnues, expression reguliere.
 * Les autres familles ont leur propre module : tools-temps.js, tools-generer.js,
 * tools-reseau.js, tools-reference.js, tools-chiffres.js, tools-import.js.
 *
 * Chaque panneau lit le meme texte de travail que la vue « Boite a outils » :
 * on colle une fois, tous les outils regardent la meme matiere.
 */
import { el, frag, kv, sec, add, button, jsonTree } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import {
  decoderJwt, libelleClaim, entropie, vidageHex,
  analyserChaineRequete, analyserCookies, analyserEntetes, mesures
} from '../lib/inspect.js';
import { ALGORITHMES, empreinteHex, hmacHex, crc32, adler32, fnv1a32, djb2, sommeOctets }
  from '../lib/hashes.js';
import { EMPREINTES_SUP, empreinteSup, CRC_VARIANTES, crc, murmur3, xxhash32 }
  from '../lib/empreintes-tout.js';
import { verifierJwt, cleAttendue, ALGORITHMES_JWT } from '../lib/jwt.js';
import { frequences, caracteresCaches } from '../lib/codecs-text.js';
import { dureeLisible } from '../lib/temps.js';

/* ---------------------------------- JWT ----------------------------------- */
export function panneauJwt(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Jeton JWT', 'entete, charge utile, validite et signature'));

  if (!String(entree || '').trim()) {
    box.appendChild(el('p', { class: 'note', text: t('Collez un jeton dans le texte de travail.') }));
    return box;
  }

  let jwt;
  try { jwt = decoderJwt(entree); }
  catch (e) {
    box.appendChild(el('p', { class: 'note', text: t('Ce texte n est pas un JWT : ') + String(e.message || e) }));
    return box;
  }

  add(box, kv('Algorithme', jwt.algorithme, { hl: true }));
  if (jwt.algorithmeNul) {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Algorithme « none » : ce jeton n est pas signe. Un serveur qui l accepte est vulnerable.') }));
  }

  add(box, kv('Emis le', jwt.emisLe));
  add(box, kv('Valide a partir de', jwt.valideDes));
  add(box, kv('Expire le', jwt.expireLe, { hl: true }));
  if (jwt.expire === true) {
    box.appendChild(el('p', { class: 'note warn', text: t('Ce jeton est expire.') }));
  } else if (jwt.resteSecondes != null) {
    add(box, kv('Temps restant', dureeLisible(jwt.resteSecondes)));
  }
  if (jwt.pasEncoreValide) {
    box.appendChild(el('p', { class: 'note warn', text: t('Ce jeton n est pas encore valide.') }));
  }

  box.appendChild(sec('Entete', Object.keys(jwt.entete || {}).length));
  for (const [cle, valeur] of Object.entries(jwt.entete || {})) {
    add(box, kv(libelleClaim(cle) + ' (' + cle + ')', formaterValeur(valeur), { copy: true }));
  }

  box.appendChild(sec('Charge utile', Object.keys(jwt.charge || {}).length));
  for (const [cle, valeur] of Object.entries(jwt.charge || {})) {
    add(box, kv(libelleClaim(cle) + ' (' + cle + ')', formaterValeur(valeur), { copy: true }));
  }

  box.appendChild(sec('Charge utile brute'));
  box.appendChild(el('div', { class: 'tree' }, jsonTree(jwt.charge, 'charge')));

  add(box, kv('Signature', jwt.signature, { copy: true }));
  box.appendChild(panneauSignatureJwt(entree, jwt, etat, redessiner));
  return box;
}

/**
 * Verification reelle de la signature HMAC, quand on connait la cle. Sans cle,
 * on le dit : un jeton decode n est pas un jeton valide.
 */
function panneauSignatureJwt(entree, jwt, etat, redessiner) {
  const box = frag();
  const algo = String(jwt.algorithme || '').toUpperCase();
  const connu = ALGORITHMES_JWT.includes(algo);

  box.appendChild(sec('Verifier la signature', connu ? algo : algo || 'algorithme absent'));
  add(box, kv('Cle a fournir', t(cleAttendue(algo)), { hl: true }));

  if (!connu) {
    box.appendChild(el('p', { class: 'note', text:
      t('La signature n est pas verifiee : INTERCEPTOR ne detient pas la cle du serveur. Un JWT decode n est pas un JWT valide.') }));
    box.appendChild(el('p', { class: 'note', text:
      t('Cet algorithme ne se verifie pas dans un navigateur : les douze familles HS, RS, PS et ES le peuvent, les autres non.') }));
    return box;
  }

  const champ = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '3',
    placeholder: t('secret partage, cle publique PEM (-----BEGIN PUBLIC KEY-----) ou JWK')
  });
  champ.value = etat.cleJwt || '';
  champ.addEventListener('change', () => { etat.cleJwt = champ.value; etat.jwtVerdict = null; redessiner(); });
  box.appendChild(champ);

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Verifier', async () => {
    etat.cleJwt = champ.value;
    if (!etat.cleJwt) return toast('Cle vide', false);
    try { etat.jwtVerdict = await verifierJwt(entree, etat.cleJwt); }
    catch (e) { etat.jwtVerdict = { valide: false, erreur: String(e.message || e) }; }
    redessiner();
  }));
  box.appendChild(actions);

  if (etat.jwtVerdict) {
    const v = etat.jwtVerdict;
    if (v.erreur) {
      box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + v.erreur }));
    } else if (v.valide) {
      add(box, kv('Verdict', t('signature valide'), { hl: true }));
      add(box, kv('Methode employee', t(v.methode)));
      add(box, kv('Courbe', v.courbe));
      box.appendChild(el('p', { class: 'note', text:
        t('Signature valide : cette cle est bien celle qui a signe le jeton.') }));
    } else {
      add(box, kv('Verdict', t('signature invalide'), { hl: true }));
      box.appendChild(el('p', { class: 'note warn', text:
        t('Signature invalide : cette cle n a pas signe ce jeton.') }));
    }
  } else {
    box.appendChild(el('p', { class: 'note', text:
      t('Tant qu aucune cle n est fournie, la signature n est pas verifiee.') }));
  }
  return box;
}

function formaterValeur(v) {
  if (v == null) return '';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/* ------------------------- Empreintes et signatures ----------------------- */
export function panneauEmpreintes(entree, redessiner, etat) {
  const box = frag();
  const resultats = etat.empreintes;
  box.appendChild(sec('Empreintes', ALGORITHMES.length + ' algorithmes'));

  const actions = el('div', { class: 'actions' });
  for (const algo of ALGORITHMES) {
    actions.appendChild(button(algo, async () => {
      try { resultats[algo] = await empreinteHex(algo, entree); redessiner(); }
      catch (e) { toast(String(e.message || e), false); }
    }));
  }
  actions.appendChild(button('Tout calculer', async () => {
    try {
      for (const algo of ALGORITHMES) resultats[algo] = await empreinteHex(algo, entree);
      redessiner();
    } catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(actions);

  for (const algo of ALGORITHMES) {
    if (resultats[algo]) add(box, kv(algo, resultats[algo], { copy: true }));
  }
  if (!Object.keys(resultats).length) {
    box.appendChild(el('p', { class: 'note', text:
      t('Choisissez un algorithme pour calculer l empreinte du texte de travail.') }));
  }
  box.appendChild(el('p', { class: 'note', text:
    t('MD5 et SHA-1 sont casses pour la signature : ils reconnaissent une valeur, ils ne prouvent rien.') }));

  /* --- Empreintes supplementaires : SHA-3, Keccak, SHAKE, RIPEMD, SM3,
         MD4, NTLM, BLAKE2 — calculees sans le navigateur --- */
  box.appendChild(sec('Empreintes supplementaires', EMPREINTES_SUP.length + ' familles'));
  const supActions = el('div', { class: 'actions' });
  for (const [nom] of EMPREINTES_SUP) {
    supActions.appendChild(button(nom, () => {
      try { resultats[nom] = empreinteSup(nom, entree); redessiner(); }
      catch (e) { toast(String(e.message || e), false); }
    }));
  }
  supActions.appendChild(button('Toutes', () => {
    try { for (const [nom] of EMPREINTES_SUP) resultats[nom] = empreinteSup(nom, entree); redessiner(); }
    catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(supActions);
  for (const [nom] of EMPREINTES_SUP) {
    if (resultats[nom]) add(box, kv(nom, resultats[nom], { copy: true }));
  }
  box.appendChild(el('p', { class: 'note', text:
    t('MD4 et NTLM ne protegent plus rien : ils servent a relire une valeur, jamais a prouver une identite.') }));

  /* --- Sommes de controle : instantanees, aucune raison de les cacher --- */
  box.appendChild(sec('Sommes de controle', 'calculees a chaque affichage'));
  const somme = sommeOctets(entree);
  add(box, kv('CRC-32', crc32(entree), { copy: true }));
  add(box, kv('Adler-32', adler32(entree), { copy: true }));
  add(box, kv('FNV-1a 32', fnv1a32(entree), { copy: true }));
  add(box, kv('djb2', djb2(entree), { copy: true }));
  add(box, kv('MurmurHash3', murmur3(entree), { copy: true }));
  add(box, kv('xxHash32', xxhash32(entree), { copy: true }));
  add(box, kv('Somme des octets', somme.somme + '  (complement : ' + somme.complement + ')'));

  /* --- Variantes CRC nommees : on choisit, on lit la valeur et son usage --- */
  box.appendChild(sec('Variantes CRC', CRC_VARIANTES.length + ' normalisees'));
  const crcChoix = el('select');
  for (const v of CRC_VARIANTES) {
    crcChoix.appendChild(el('option', { value: v.nom, text: v.nom, selected: v.nom === (etat.crcVariante || 'CRC-32/ISO-HDLC') }));
  }
  crcChoix.addEventListener('change', () => { etat.crcVariante = crcChoix.value; etat.crcSortie = null; redessiner(); });
  const crcBarre = el('div', { class: 'actions' }, [crcChoix]);
  crcBarre.appendChild(button('Calculer', () => {
    etat.crcVariante = crcChoix.value;
    etat.crcSortie = crc(entree, etat.crcVariante);
    redessiner();
  }));
  box.appendChild(crcBarre);
  const varActive = CRC_VARIANTES.find(v => v.nom === (etat.crcVariante || 'CRC-32/ISO-HDLC'));
  if (varActive) box.appendChild(el('p', { class: 'note', text: t(varActive.usage) }));
  if (etat.crcSortie) add(box, kv(etat.crcVariante, '0x' + etat.crcSortie, { copy: true }));

  /* ------------------------------ HMAC ------------------------------ */
  box.appendChild(sec('HMAC', 'signature a cle partagee'));
  const cle = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('cle de signature'), value: etat.cleHmac || ''
  });
  cle.addEventListener('change', () => { etat.cleHmac = cle.value; });
  const choix = el('select');
  for (const algo of ['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1']) {
    choix.appendChild(el('option', { value: algo, text: algo, selected: etat.algoHmac === algo }));
  }
  choix.addEventListener('change', () => { etat.algoHmac = choix.value; });
  const barre = el('div', { class: 'actions' }, [cle, choix]);
  barre.appendChild(button('Signer', async () => {
    etat.cleHmac = cle.value;
    etat.algoHmac = choix.value;
    try { etat.hmac = await hmacHex(choix.value, cle.value, entree); redessiner(); }
    catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(barre);
  if (etat.hmac) add(box, kv('HMAC-' + (etat.algoHmac || 'SHA-256'), etat.hmac, { copy: true }));
  else box.appendChild(el('p', { class: 'note', text:
    t('Le HMAC signe le texte de travail avec la cle donnee : c est ce que verifie un webhook.') }));
  return box;
}

/* --------------------------- Mesures et entropie -------------------------- */
export function panneauMesures(entree) {
  const box = frag();
  const m = mesures(entree);
  const h = entropie(entree);

  box.appendChild(sec('Mesures', 'taille reelle du texte de travail'));
  add(box, kv('Caracteres', m.caracteres, { always: true }));
  add(box, kv('Octets (UTF-8)', m.octets, { always: true }));
  add(box, kv('Lignes', m.lignes, { always: true }));
  add(box, kv('Mots', m.mots, { always: true }));

  box.appendChild(sec('Entropie', 'bits par octet, maximum 8'));
  add(box, kv('Entropie par octet', h.parOctet, { hl: true, always: true }));
  add(box, kv('Entropie totale (bits)', h.bits, { always: true }));
  add(box, kv('Octets distincts', h.distincts, { always: true }));
  box.appendChild(el('p', { class: 'note', text: t(lectureEntropie(h)) }));

  const caches = caracteresCaches(entree);
  box.appendChild(sec('Caracteres invisibles', caches.length));
  if (!caches.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucun caractere invisible ou trompeur.') }));
  } else {
    box.appendChild(el('p', { class: 'note warn', text:
      t('Des caracteres invisibles se cachent dans ce texte : ils servent a masquer du contenu.') }));
    for (const c of caches) add(box, kv('Position ' + c.index, c.code));
  }

  const freq = frequences(entree, 15);
  box.appendChild(sec('Caracteres les plus frequents', freq.length));
  for (const f of freq) {
    add(box, kv(f.caractere + '  ' + f.code, f.nombre + '   ·   ' + f.part + ' %'));
  }
  return box;
}

/** Lecture honnete de l entropie : un indice, jamais un verdict. */
function lectureEntropie(h) {
  if (!h.octets) return 'Texte vide.';
  if (h.parOctet >= 7.5) return 'Tres desordonne : donnees compressees, chiffrees ou binaires.';
  if (h.parOctet >= 5.5) return 'Desordonne : ressemble a un jeton ou a une cle aleatoire.';
  if (h.parOctet >= 3.5) return 'Ordinaire : ressemble a du texte, du JSON ou du code.';
  return 'Tres repetitif : peu de caracteres distincts.';
}

/* --------------------------- Vidage hexadecimal --------------------------- */
export function panneauHex(entree) {
  const box = frag();
  box.appendChild(sec('Vidage hexadecimal', 'decalage, octets, colonne lisible'));
  if (!String(entree || '').length) {
    box.appendChild(el('p', { class: 'note', text: t('Texte de travail vide.') }));
    return box;
  }
  const vidage = vidageHex(entree);
  box.appendChild(el('pre', { class: 'pre nowrap', text: vidage }));
  box.appendChild(el('div', { class: 'actions' },
    button('Copier le vidage', () => copy(vidage, 'Vidage copie'))));
  return box;
}

/* -------------------------- Analyse de structures ------------------------- */
export function panneauAnalyse(entree) {
  const box = frag();
  const brut = String(entree || '');

  const requete = analyserChaineRequete(brut);
  box.appendChild(sec('Parametres d URL', requete.length));
  if (!requete.length) box.appendChild(el('p', { class: 'note', text: t('Aucun couple cle=valeur reconnu.') }));
  for (const p of requete) add(box, kv(p.cle, p.valeur, { copy: true }));

  const cookies = analyserCookies(brut);
  box.appendChild(sec('Cookies', cookies.length));
  if (!cookies.length) box.appendChild(el('p', { class: 'note', text: t('Aucun cookie reconnu.') }));
  for (const c of cookies) add(box, kv(c.cle, c.valeur, { copy: true }));

  const entetes = analyserEntetes(brut);
  const vrais = entetes.filter(h => h.valeur);
  box.appendChild(sec('Entetes', vrais.length));
  if (!vrais.length) box.appendChild(el('p', { class: 'note', text: t('Aucune ligne « Nom: valeur » reconnue.') }));
  for (const h of vrais) add(box, kv(h.cle, h.valeur, { copy: true }));
  return box;
}

/* --------------------------- Expressions regulieres ----------------------- */
export function panneauRegex(entree, etat, redessiner) {
  const box = frag();
  box.appendChild(sec('Expression reguliere', 'testee sur le texte de travail'));

  const champ = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: '([a-z]+)=([0-9]+)', value: etat.motif
  });
  const options = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: 'gi', value: etat.options, style: 'max-width:90px'
  });
  const remplacement = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t('remplacement, $1 pour un groupe'), value: etat.remplacement || ''
  });
  champ.addEventListener('change', () => { etat.motif = champ.value; redessiner(); });
  options.addEventListener('change', () => { etat.options = options.value; redessiner(); });
  remplacement.addEventListener('change', () => { etat.remplacement = remplacement.value; redessiner(); });
  box.appendChild(el('div', { class: 'actions' }, [champ, options]));
  box.appendChild(el('div', { class: 'actions' }, [remplacement]));

  if (!etat.motif) {
    box.appendChild(el('p', { class: 'note', text: t('Ecrivez une expression pour voir ses correspondances.') }));
    return box;
  }

  let re;
  try { re = new RegExp(etat.motif, etat.options.includes('g') ? etat.options : etat.options + 'g'); }
  catch (e) {
    box.appendChild(el('p', { class: 'note warn', text: t('Expression invalide : ') + String(e.message || e) }));
    return box;
  }

  const trouves = [];
  let m, garde = 0;
  while ((m = re.exec(String(entree))) !== null && garde++ < 500) {
    trouves.push({ texte: m[0], index: m.index, groupes: m.slice(1) });
    if (m.index === re.lastIndex) re.lastIndex++;
  }

  box.appendChild(sec('Correspondances', trouves.length + (garde >= 500 ? ' (arretees a 500)' : '')));
  if (!trouves.length) {
    box.appendChild(el('p', { class: 'note', text: t('Aucune correspondance.') }));
    return box;
  }
  for (const tr of trouves) {
    add(box, kv('@' + tr.index, tr.texte + (tr.groupes.length
      ? '   ·   ' + tr.groupes.map((g, i) => '$' + (i + 1) + '=' + g).join('  ') : ''), { copy: true }));
  }

  if (etat.remplacement) {
    const resultat = String(entree).replace(re, etat.remplacement);
    box.appendChild(sec('Apres remplacement', resultat.length + ' caracteres'));
    box.appendChild(el('pre', { class: 'pre', text: resultat }));
    box.appendChild(el('div', { class: 'actions' },
      button('Copier le resultat', () => copy(resultat, 'Resultat copie'))));
  }
  return box;
}
