/* Panneau « Chiffrement » — INTERCEPTOR (by NeoZ)
 *
 * AES, derivation de cle et verification de signature. Tout passe par le
 * moteur du navigateur : ce panneau ne fait qu offrir les champs et montrer
 * le resultat, y compris quand il echoue.
 */
import { el, frag, kv, sec, add, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import {
  MODES_AES, HACHAGES_DISPONIBLES, tailleIv, aesChiffrer, aesDechiffrer, cleAesAleatoire,
  pbkdf2, hkdf, verifierSignature
} from '../lib/crypto-outils.js';

const FORMES = [['hex', 'Hexadecimal'], ['base64', 'Base64'], ['texte', 'Texte']];

const champ = (placeholder, valeur, surChangement, style) => {
  const n = el('input', {
    type: 'text', class: 'field', spellcheck: 'false',
    placeholder: t(placeholder), value: valeur || '', style: style || null
  });
  n.addEventListener('change', () => surChangement(n.value));
  return n;
};

const choix = (options, valeur, surChangement, largeur) => {
  const n = el('select', largeur ? { style: 'max-width:' + largeur } : null);
  for (const [cle, libelle] of options) {
    n.appendChild(el('option', { value: cle, text: t(libelle), selected: valeur === cle }));
  }
  n.addEventListener('change', () => surChangement(n.value));
  return n;
};

export function panneauChiffrement(entree, etat, redessiner, poser) {
  const box = frag();

  /* ---------------------------------- AES --------------------------------- */
  box.appendChild(sec('AES', 'le texte de travail est chiffre ou dechiffre'));
  const mode = etat.modeAes || 'AES-GCM';

  const barre = el('div', { class: 'actions' }, [
    choix(MODES_AES.map(m => [m, m]), mode, v => { etat.modeAes = v; redessiner(); }, '140px'),
    champ('cle', etat.cleAes, v => { etat.cleAes = v; }),
    choix(FORMES, etat.formeCleAes || 'hex', v => { etat.formeCleAes = v; redessiner(); }, '130px')
  ]);
  barre.appendChild(button('Tirer une cle de 32 octets', () => {
    etat.cleAes = cleAesAleatoire(32);
    etat.formeCleAes = 'hex';
    redessiner();
  }));
  box.appendChild(barre);

  const barre2 = el('div', { class: 'actions' }, [
    champ('vecteur d initialisation en hexadecimal, vide pour un tirage',
      etat.ivAes, v => { etat.ivAes = v; }),
    champ('donnees authentifiees (AES-GCM seulement)', etat.aadAes, v => { etat.aadAes = v; }, 'max-width:260px')
  ]);
  box.appendChild(barre2);
  add(box, kv('Vecteur attendu', tailleIv(mode) + ' octets, soit ' + (tailleIv(mode) * 2) + ' chiffres hexadecimaux'));

  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Chiffrer', async () => {
    try {
      etat.sortieAes = await aesChiffrer({
        texte: entree, cle: etat.cleAes, formeCle: etat.formeCleAes || 'hex',
        mode, iv: etat.ivAes, aad: etat.aadAes
      });
      etat.erreurAes = null;
    } catch (e) { etat.erreurAes = String(e.message || e); etat.sortieAes = null; }
    redessiner();
  }));
  actions.appendChild(button('Dechiffrer', async () => {
    try {
      const clair = await aesDechiffrer({
        donnees: entree, formeDonnees: /^[0-9a-fA-F\s]+$/.test(String(entree).trim()) ? 'hex' : 'base64',
        cle: etat.cleAes, formeCle: etat.formeCleAes || 'hex',
        mode, iv: etat.ivAes, aad: etat.aadAes
      });
      etat.erreurAes = null;
      etat.sortieAes = null;
      poser(clair);
      toast('Texte dechiffre : il remplace le texte de travail');
    } catch (e) { etat.erreurAes = String(e.message || e); redessiner(); }
  }));
  box.appendChild(actions);

  if (etat.erreurAes) {
    box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + etat.erreurAes }));
  }
  if (etat.sortieAes) {
    box.appendChild(sec('Resultat chiffre', etat.sortieAes.octets + ' octets'));
    add(box, kv('Base64', etat.sortieAes.base64, { copy: true }));
    add(box, kv('Hexadecimal', etat.sortieAes.hex, { copy: true }));
    add(box, kv('Vecteur employe', etat.sortieAes.iv, { copy: true, hl: true }));
    box.appendChild(el('p', { class: 'note', text:
      t('Sans ce vecteur, le message ne se dechiffre pas : il se conserve avec le message, il n a pas a rester secret.') }));
    box.appendChild(el('div', { class: 'actions' },
      button('Poser le chiffre comme texte de travail', () => poser(etat.sortieAes.base64))));
  }

  /* ---------------------------- Derivation de cle ------------------------- */
  box.appendChild(sec('Derivation de cle', 'PBKDF2 et HKDF, tels que les emploient les applications'));
  const barre3 = el('div', { class: 'actions' }, [
    champ('mot de passe ou cle de depart', etat.mdpKdf, v => { etat.mdpKdf = v; }),
    champ('sel', etat.selKdf, v => { etat.selKdf = v; }, 'max-width:160px'),
    champ('iterations', etat.iterations || '100000', v => { etat.iterations = v; }, 'max-width:120px'),
    choix(HACHAGES_DISPONIBLES.map(h => [h, h]),
      etat.hashKdf || 'SHA-256', v => { etat.hashKdf = v; }, '130px'),
    choix([['128', '128 bits'], ['256', '256 bits'], ['384', '384 bits'], ['512', '512 bits']],
      etat.bitsKdf || '256', v => { etat.bitsKdf = v; }, '130px')
  ]);
  barre3.appendChild(button('PBKDF2', async () => {
    try {
      etat.sortieKdf = await pbkdf2({
        motDePasse: etat.mdpKdf, sel: etat.selKdf,
        iterations: Number(etat.iterations || 100000),
        hash: etat.hashKdf || 'SHA-256', bits: Number(etat.bitsKdf || 256)
      });
      etat.sortieKdf.methode = 'PBKDF2';
      etat.erreurKdf = null;
    } catch (e) { etat.erreurKdf = String(e.message || e); }
    redessiner();
  }));
  barre3.appendChild(button('HKDF', async () => {
    try {
      etat.sortieKdf = await hkdf({
        cle: etat.mdpKdf, sel: etat.selKdf, info: etat.aadAes || '',
        hash: etat.hashKdf || 'SHA-256', bits: Number(etat.bitsKdf || 256)
      });
      etat.sortieKdf.methode = 'HKDF';
      etat.erreurKdf = null;
    } catch (e) { etat.erreurKdf = String(e.message || e); }
    redessiner();
  }));
  box.appendChild(barre3);
  box.appendChild(el('p', { class: 'note', text:
    t('PBKDF2 ralentit volontairement le calcul : c est le nombre d iterations qui protege un mot de passe, pas l empreinte choisie.') }));

  if (etat.erreurKdf) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + etat.erreurKdf }));
  if (etat.sortieKdf) {
    box.appendChild(sec('Cle derivee', etat.sortieKdf.methode + '   ·   ' + etat.sortieKdf.bits + ' bits'));
    add(box, kv('Hexadecimal', etat.sortieKdf.hex, { copy: true, hl: true }));
    add(box, kv('Base64', etat.sortieKdf.base64, { copy: true }));
    if (etat.sortieKdf.iterations) add(box, kv('Iterations', etat.sortieKdf.iterations, { always: true }));
    box.appendChild(el('div', { class: 'actions' },
      button('Employer comme cle AES', () => {
        etat.cleAes = etat.sortieKdf.hex;
        etat.formeCleAes = 'hex';
        redessiner();
      })));
  }

  /* ------------------------------- Signature ------------------------------ */
  box.appendChild(sec('Verifier une signature detachee', 'webhook, manifeste, paquet'));
  const barre4 = el('div', { class: 'actions' }, [
    champ('signature en base64', etat.signature, v => { etat.signature = v; }),
    choix([['RSASSA-PKCS1-v1_5', 'RSA'], ['RSA-PSS', 'RSA-PSS'], ['ECDSA', 'ECDSA'], ['HMAC', 'HMAC']],
      etat.algoSignature || 'RSASSA-PKCS1-v1_5', v => { etat.algoSignature = v; redessiner(); }, '150px'),
    choix(HACHAGES_DISPONIBLES.map(h => [h, h]),
      etat.hashSignature || 'SHA-256', v => { etat.hashSignature = v; }, '130px')
  ]);
  box.appendChild(barre4);

  const cleSignature = el('textarea', {
    class: 'field', spellcheck: 'false', rows: '3',
    placeholder: t('cle publique PEM ou JWK, ou secret partage pour HMAC')
  });
  cleSignature.value = etat.cleSignature || '';
  cleSignature.addEventListener('change', () => { etat.cleSignature = cleSignature.value; });
  box.appendChild(cleSignature);

  box.appendChild(el('div', { class: 'actions' }, button('Verifier', async () => {
    etat.cleSignature = cleSignature.value;
    try {
      etat.verdictSignature = {
        valide: await verifierSignature({
          donnees: entree, signature: etat.signature, cle: etat.cleSignature,
          algorithme: etat.algoSignature || 'RSASSA-PKCS1-v1_5',
          hash: etat.hashSignature || 'SHA-256',
          namedCurve: (etat.hashSignature || 'SHA-256') === 'SHA-384' ? 'P-384'
            : (etat.hashSignature || 'SHA-256') === 'SHA-512' ? 'P-521' : 'P-256'
        })
      };
    } catch (e) { etat.verdictSignature = { erreur: String(e.message || e) }; }
    redessiner();
  })));

  if (etat.verdictSignature) {
    const v = etat.verdictSignature;
    if (v.erreur) box.appendChild(el('p', { class: 'note warn', text: t('Echec : ') + v.erreur }));
    else if (v.valide) {
      add(box, kv('Verdict', t('signature valide'), { hl: true }));
      box.appendChild(el('p', { class: 'note', text:
        t('La signature couvre exactement le texte de travail, tel qu il est affiche.') }));
    } else {
      add(box, kv('Verdict', t('signature invalide'), { hl: true }));
      box.appendChild(el('p', { class: 'note warn', text:
        t('Signature invalide : le contenu, la cle ou l algorithme ne correspondent pas.') }));
    }
  }

  box.appendChild(el('p', { class: 'note', text:
    t('Rien ne sort de la machine : le moteur du navigateur fait tous ces calculs sur place.') }));
  return box;
}
