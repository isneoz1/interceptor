/* Panneau « Codes OTP » — INTERCEPTOR (by D4RK)
 *
 * A quoi il sert : une capture montre un champ « code » a six chiffres refuse
 * par le serveur. Avec le secret que l on possede deja (celui de son propre
 * compte de test), on recalcule le code attendu au bon instant pour savoir si
 * le probleme venait du code ou d ailleurs.
 *
 * Il ne devine aucun secret et ne contourne aucune authentification : il
 * refait le calcul public de TOTP/HOTP a partir d un secret fourni.
 */
import { el, frag, sec, add, kv, button } from '../lib/dom.js';
import { t } from '../lib/i18n.js';
import { copy, toast } from '../app.js';
import {
  secretVersOctets, totp, hotp, totpVoisins, lireOtpauth, secretAleatoire, ALGOS_OTP
} from '../lib/otp.js';

export function panneauOtp(entree, etat, redessiner) {
  const box = frag();
  const brut = String(entree || '').trim();
  if (!etat.otpForme) etat.otpForme = 'base32';
  if (!etat.otpAlgo) etat.otpAlgo = 'SHA-1';
  if (!etat.otpChiffres) etat.otpChiffres = 6;
  if (!etat.otpPas) etat.otpPas = 30;

  box.appendChild(sec('Codes OTP', 'TOTP et HOTP, calcules a partir d un secret que vous fournissez'));

  /* Un lien otpauth:// colle remplit tous les champs d un coup. */
  if (/^otpauth:\/\//i.test(brut)) {
    box.appendChild(el('div', { class: 'actions' },
      button('Lire le lien otpauth colle', () => {
        try {
          const p = lireOtpauth(brut);
          etat.otpSecret = p.secret; etat.otpForme = 'base32';
          etat.otpAlgo = p.algorithme; etat.otpChiffres = p.chiffres; etat.otpPas = p.pas;
          etat.otpType = p.type;
          toast(t('Lien otpauth lu') + ' : ' + (p.emetteur || p.compte || ''));
          redessiner();
        } catch (e) { toast(String(e.message || e), false); }
      })));
  }

  /* --------------------------- Secret et options ------------------------- */
  const secret = el('input', {
    type: 'text', class: 'field bloc', spellcheck: 'false',
    placeholder: t('secret (base32, ex. JBSWY3DPEHPK3PXP)'),
    value: etat.otpSecret != null ? etat.otpSecret : (brut && !/^otpauth/i.test(brut) ? brut : '')
  });
  secret.addEventListener('change', () => { etat.otpSecret = secret.value; });
  box.appendChild(secret);

  const forme = choix(['base32', 'hex', 'texte'], etat.otpForme, v => { etat.otpForme = v; });
  const algo = choix(ALGOS_OTP, etat.otpAlgo, v => { etat.otpAlgo = v; });
  const chiffres = choix(['6', '7', '8'], String(etat.otpChiffres), v => { etat.otpChiffres = Number(v); });
  const pas = choix(['30', '60'], String(etat.otpPas), v => { etat.otpPas = Number(v); });

  box.appendChild(ligne([['Format du secret', forme], ['Algorithme', algo],
    ['Chiffres', chiffres], ['Pas (s)', pas]]));

  /* ------------------------------- Actions ------------------------------- */
  const actions = el('div', { class: 'actions' });
  actions.appendChild(button('Code TOTP maintenant', async () => {
    const oc = octets(); if (!oc) return;
    try {
      const r = await totp(oc, { chiffres: etat.otpChiffres, algorithme: etat.otpAlgo, pas: etat.otpPas });
      etat.otpResultat = { type: 'totp', code: r.code, restantes: r.restantes, fenetre: r.fenetre };
      redessiner();
    } catch (e) { toast(String(e.message || e), false); }
  }));
  actions.appendChild(button('Fenetres voisines', async () => {
    const oc = octets(); if (!oc) return;
    try {
      etat.otpVoisins = await totpVoisins(oc,
        { chiffres: etat.otpChiffres, algorithme: etat.otpAlgo, pas: etat.otpPas }, 1);
      redessiner();
    } catch (e) { toast(String(e.message || e), false); }
  }, { class: 'ghost' }));
  box.appendChild(actions);

  /* HOTP a compteur explicite, pour les jetons a evenement. */
  const compteur = el('input', {
    type: 'number', class: 'field', value: String(etat.otpCompteur || 0), min: '0', style: 'max-width:12rem'
  });
  compteur.addEventListener('change', () => { etat.otpCompteur = Number(compteur.value); });
  const hbar = el('div', { class: 'actions' }, [compteur]);
  hbar.appendChild(button('Code HOTP a ce compteur', async () => {
    const oc = octets(); if (!oc) return;
    try {
      const code = await hotp(oc, Number(compteur.value) || 0,
        { chiffres: etat.otpChiffres, algorithme: etat.otpAlgo });
      etat.otpResultat = { type: 'hotp', code, compteur: Number(compteur.value) || 0 };
      redessiner();
    } catch (e) { toast(String(e.message || e), false); }
  }));
  box.appendChild(hbar);

  /* ------------------------------ Resultats ------------------------------ */
  const r = etat.otpResultat;
  if (r) {
    box.appendChild(sec('Code calcule', r.type.toUpperCase()));
    const carte = el('div', { class: 'find info' }, [
      el('h4', { class: 'otp-code', text: r.code })
    ]);
    if (r.type === 'totp') carte.appendChild(el('p', { class: 'note',
      text: t('valable encore') + ' ' + r.restantes + ' s — ' + t('fenetre') + ' ' + r.fenetre }));
    else carte.appendChild(el('p', { class: 'note', text: t('compteur') + ' ' + r.compteur }));
    carte.appendChild(el('div', { class: 'actions' },
      button('Copier le code', () => copy(r.code, 'Code copie'))));
    box.appendChild(carte);
  }

  if (etat.otpVoisins) {
    box.appendChild(sec('Fenetres voisines',
      'un serveur accepte souvent la precedente et la suivante'));
    for (const v of etat.otpVoisins) {
      const quand = v.decalage === 0 ? t('maintenant')
        : (v.decalage < 0 ? t('precedente') : t('suivante'));
      add(box, kv(quand + ' (' + (v.decalage > 0 ? '+' : '') + v.decalage + ')', v.code, { copy: true }));
    }
  }

  /* ------------------------- Fabriquer un secret ------------------------- */
  box.appendChild(sec('Secret de test', 'pour vos propres essais'));
  box.appendChild(el('div', { class: 'actions' },
    button('Generer un secret aleatoire', () => {
      const s = secretAleatoire(20);
      etat.otpSecret = s.base32;
      toast('Secret genere');
      redessiner();
    })));

  box.appendChild(el('p', { class: 'note', text:
    t('Le secret reste sur cette page et ne part nulle part. Cet outil recalcule un code public a partir du secret que vous donnez.') }));
  return box;

  function octets() {
    etat.otpSecret = secret.value;
    try { return secretVersOctets(secret.value, etat.otpForme); }
    catch (e) { toast(String(e.message || e), false); return null; }
  }
}

/* ------------------------------ Fabriques UI ------------------------------ */
function choix(valeurs, actif, onChange) {
  const s = el('select');
  for (const v of valeurs) s.appendChild(el('option', { value: v, text: v, selected: v === actif }));
  s.addEventListener('change', () => onChange(s.value));
  return s;
}

function ligne(couples) {
  const rangee = el('div', { class: 'actions wrap' });
  for (const [libelle, champ] of couples) {
    rangee.appendChild(el('label', { class: 'inline' }, [el('span', { text: t(libelle) }), champ]));
  }
  return rangee;
}
