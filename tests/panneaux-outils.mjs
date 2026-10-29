/* Les panneaux de la boite a outils, tels que les tests les appellent — SWIFT (by D4RK)
 *
 * Partage par rendu.test.mjs, qui les eprouve avec des entrees hostiles, et par
 * langue.test.mjs, qui verifie qu aucun texte francais ne sort de l interface
 * anglaise : une seule liste, que les deux suites tiennent a jour ensemble.
 */
export const LISTE_PANNEAUX = [
  ['cles', 'tools-chiffres.js', (m, e, s) => m.panneauCles(e, s, () => {}, () => {})],
  ['identifier', 'tools-chiffres.js', (m, e) => m.panneauIdentifier(e)],
  ['chiffrement', 'tools-crypto.js', (m, e, s) => m.panneauChiffrement(e, s, () => {}, () => {})],
  ['jwt', 'tools-panels.js', (m, e, s) => m.panneauJwt(e, s, () => {})],
  ['empreintes', 'tools-panels.js', (m, e, s) => m.panneauEmpreintes(e, () => {}, s)],
  ['mesures', 'tools-panels.js', (m, e) => m.panneauMesures(e)],
  ['hex', 'tools-panels.js', (m, e) => m.panneauHex(e)],
  ['analyse', 'tools-panels.js', (m, e) => m.panneauAnalyse(e)],
  ['regex', 'tools-panels.js', (m, e, s) => m.panneauRegex(e, s, () => {})],
  ['binaire', 'tools-binaire.js', (m, e, s) => m.panneauBinaire(e, s, () => {}, () => {})],
  ['code', 'tools-code.js', (m, e, s) => m.panneauCode(e, s, () => {}, () => {})],
  ['otp', 'tools-otp.js', (m, e, s) => m.panneauOtp(e, s, () => {})],
  ['temps', 'tools-temps.js', (m, e) => m.panneauHorodatage(e)],
  ['nombres', 'tools-temps.js', (m, e, s) => m.panneauNombres(e, s, () => {})],
  ['entetes', 'tools-entetes.js', (m, e) => m.panneauEntetes(e)],
  ['chercher', 'tools-chercher.js', (m, e, s) => m.panneauChercher(e, s, () => {}, () => {})],
  ['comparer', 'tools-diff.js', (m, e, s) => m.panneauComparer(e, s, () => {}, () => {})],
  ['patch', 'tools-patch.js', (m, e, s) => m.panneauPatch(e, s, () => {}, () => {})],
  ['cle', 'tools-cle.js', (m, e, s) => m.panneauClePublique(e, s, () => {})],
  ['url', 'tools-reseau.js', (m, e) => m.panneauUrl(e)],
  ['adresse', 'tools-reseau.js', (m, e, s) => m.panneauAdresse(e, s, () => {}, () => {})],
  ['reference', 'tools-reference.js', (m, e, s) => m.panneauReference(e, s, () => {})],
  ['generer', 'tools-generer.js', (m, e, s) => m.panneauGenerateurs(() => {}, s, () => {})],
  ['importer', 'tools-import.js', (m, e, s) => m.panneauImport(e, s, () => {})]
];

/** Les panneaux, chacun pret a etre rendu : [nom, (entree, etat) => noeud]. */
export async function chargerPanneaux() {
  const panneaux = [];
  for (const [nom, fichier, appeler] of LISTE_PANNEAUX) {
    const mod = await import('../ui/console/' + fichier);
    panneaux.push([nom, (entree, etat) => appeler(mod, entree, etat)]);
  }
  return panneaux;
}

/** L etat de la boite a outils, neuf, tel qu un panneau le recoit. */
export const etatOutils = () => ({
  empreintes: {}, cleHmac: '', algoHmac: 'SHA-256', hmac: null, cleJwt: '', jwtVerdict: null,
  motif: '', options: 'gi', remplacement: '', cleXor: '', xorHex: false, xorCandidats: null,
  cleVigenere: '', base: 10, prefixeTest: '', familleRef: 'tout', questionRef: undefined,
  modeAes: 'AES-GCM', cleAes: '', formeCleAes: 'hex', ivAes: '', aadAes: '',
  sortieAes: null, erreurAes: null, mdpKdf: '', selKdf: '', iterations: '100000',
  hashKdf: 'SHA-256', bitsKdf: '256', sortieKdf: null, erreurKdf: null,
  signature: '', cleSignature: '', algoSignature: 'RSASSA-PKCS1-v1_5',
  hashSignature: 'SHA-256', verdictSignature: null, familleBinaire: 'auto', arbreDer: false,
  jeuChoisi: 'utf-8', autreTexte: '', motifChoisi: '', numeroLuhn: '', cheminJson: '',
  /* Le panneau JSON Patch calcule a chaque dessin : chaque entree hostile y
     passe par l application d un vrai patch. */
  patchGeste: 'appliquer', patchAutre: '[{"op":"add","path":"/a","value":12345678901234567890}]',
  selecteur: '', typeSelecteur: 'css', sousPrefixe: 26, decoupe: false, listePrefixes: '',
  plageDebut: '', plageFin: '', longueurMdp: 24,
  jeuxMdp: ['minuscules', 'majuscules', 'chiffres', 'symboles'], dernierMdp: null,
  importBrut: false, codeSens: 'lisible', codeStyle: 'securise', codeEmbellir: true,
  codeSortie: null, otpForme: 'base32', otpAlgo: 'SHA-1', otpChiffres: 6, otpPas: 30,
  otpSecret: null, otpResultat: null, otpVoisins: null, otpCompteur: 0
});
