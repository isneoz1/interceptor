/* Un certificat X.509, lu en entier — SWIFT (by NeoZ)
 *
 * Le meme rendu sert a la boite a outils (un bloc PEM colle) et a l onglet
 * Securite (le certificat que Firefox a recu du serveur) : un seul endroit
 * decide de ce qu on montre, et les deux ne peuvent pas diverger.
 *
 * Tout vient du DER, lu par asn1.js ; rien n est deduit ni complete.
 */
import { el, kv, sec, add } from '../lib/dom.js';
import { t, tp } from '../lib/i18n.js';

/* Ce que declare chaque politique du CA/Browser Forum (Baseline Requirements,
   section 7.1.6.1) : le niveau de verification reellement engage. */
function sensValidation(code) {
  if (code === 'DV') return t('DV — aucune identite affirmee : seul le controle du domaine a ete verifie');
  if (code === 'OV') return t('OV — l identite de l organisation titulaire est affirmee');
  if (code === 'IV') return t('IV — l identite de la personne titulaire est affirmee');
  if (code === 'EV') return t('EV — validation etendue de l organisation titulaire');
  return null;
}

/* Les titres et libelles restent ecrits dans les appels a sec() et kv() :
   c est la que le controle de traduction les voit. */
function lignes(box, valeurs, fabriquer) {
  for (const v of valeurs || []) add(box, fabriquer(v));
}

/**
 * Ecrit dans `box` le contenu d un certificat deja resume par
 * `resumerCertificat`.
 */
export function blocCertificat(box, resume) {
  box.appendChild(sec('Certificat', resume.version));
  add(box, kv('Sujet', resume.sujet, { copy: true, hl: true }));
  add(box, kv('Emetteur', resume.emetteur, { copy: true }));
  add(box, kv('Numero de serie', resume.numeroDeSerie, { copy: true }));
  add(box, kv('Algorithme de signature', resume.algorithmeDeSignature));
  add(box, kv('Algorithme de cle', resume.algorithmeDeCle));
  add(box, kv('Taille de cle', resume.tailleDeCle));
  add(box, kv('Courbe', resume.courbe));
  add(box, kv('Valide a partir de', resume.valideDes));
  add(box, kv('Valide jusqu au', resume.valideJusqua, { hl: true }));
  if (resume.expire) {
    box.appendChild(el('p', { class: 'note warn', text: t('Ce certificat est expire.') }));
  } else if (resume.joursRestants != null) {
    add(box, kv('Jours restants', resume.joursRestants, { always: true }));
  }
  add(box, kv('Autorite de certification', resume.autorite === null ? null : (resume.autorite ? t('oui') : t('non'))));
  add(box, kv('Niveau de validation', sensValidation(resume.validation), { hl: true }));

  if (resume.noms.length) {
    box.appendChild(sec('Noms couverts', resume.noms.length));
    lignes(box, resume.noms, v => kv('nom', v, { copy: true }));
  }
  if (resume.adressesIp.length) {
    box.appendChild(sec('Adresses IP couvertes', resume.adressesIp.length));
    lignes(box, resume.adressesIp, v => kv('adresse', v, { copy: true }));
  }
  if (resume.courriels.length) {
    box.appendChild(sec('Adresses de courriel', resume.courriels.length));
    lignes(box, resume.courriels, v => kv('courriel', v, { copy: true }));
  }
  if (resume.uris.length) {
    box.appendChild(sec('URI du sujet', resume.uris.length));
    lignes(box, resume.uris, v => kv('URI', v, { copy: true }));
  }

  if (resume.usages.length) {
    box.appendChild(sec('Usages de la cle', resume.usages.length));
    for (const u of resume.usages) add(box, kv('usage', t(u)));
  }
  if (resume.usagesEtendus.length) {
    box.appendChild(sec('Usages etendus', resume.usagesEtendus.length));
    for (const u of resume.usagesEtendus) add(box, kv('usage', t(u)));
  }

  /* Ou verifier que le certificat n a pas ete revoque, et ou trouver celui
     de l autorite : les adresses que le certificat donne lui-meme. */
  const revocation = (resume.ocsp || []).length + (resume.crl || []).length + (resume.emetteurCa || []).length;
  if (revocation) {
    box.appendChild(sec('Revocation et autorite', revocation));
    for (const u of resume.ocsp) add(box, kv('Repondeur OCSP', u, { copy: true }));
    for (const u of resume.crl) add(box, kv('Liste de revocation (CRL)', u, { copy: true }));
    for (const u of resume.emetteurCa) add(box, kv('Certificat de l emetteur', u, { copy: true }));
  }

  if (resume.sct && resume.sct.length) {
    box.appendChild(sec('Preuves de transparence (SCT)', resume.sct.length));
    for (const s of resume.sct) {
      /* Ce qui n a pas ete lu est dit tel quel, sans champ invente. */
      if (s.version === null) {
        add(box, kv('SCT', tp('version inconnue de la RFC 6962 (octet {octet}) : non lu', { octet: s.octetDeVersion })));
      } else if (s.tronque) {
        add(box, kv('SCT', t('v1 tronque : non lu')));
      } else {
        add(box, kv(s.horodatage, t('journal') + ' ' + s.journal + (s.signature ? '  ·  ' + s.signature : '')
          + '  ·  ' + s.version, { copy: true }));
      }
    }
  }

  add(box, kv('Identifiant de cle', resume.identifiantCle, { copy: true }));
  add(box, kv('Identifiant de cle de l autorite', resume.identifiantCleAutorite, { copy: true }));

  if (resume.politiques && resume.politiques.length) {
    box.appendChild(sec('Politiques de certification', resume.politiques.length));
    for (const p of resume.politiques) add(box, kv(p.oid, p.nom !== p.oid ? t(p.nom) : ''));
  }

  box.appendChild(sec('Extensions', resume.extensions.length));
  for (const ext of resume.extensions) {
    add(box, kv(t(ext.nom), ext.oid + (ext.critique ? '   ·   ' + t('critique') : '')));
  }
  return box;
}
