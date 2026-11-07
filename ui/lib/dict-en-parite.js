/* Dictionnaire anglais : ce que la 5.9 reprend des meilleurs outils — SWIFT (by D4RK)
 *
 * Les regles de parametres d URL, les modeles « No Caching » et « Block
 * Cookies » de Charles, la reponse simulee chargee depuis un fichier, et les
 * outils de lecture ajoutes a la boite.
 */
export const EN_PARITE = {
  /* ------------------------------- Regles --------------------------------- */
  'Modifier les parametres d URL': 'Modify URL parameters',
  'La requete est redirigee vers la meme adresse, parametres reecrits ; les autres parametres gardent leur ecriture exacte.':
    'The request is redirected to the same address with its parameters rewritten; the other parameters keep their exact spelling.',
  'la requete repart avec ses parametres d URL reecrits : {ops}': 'the request leaves again with its URL parameters rewritten: {ops}',
  'sans {nom}': 'without {nom}',
  '(aucun parametre)': '(no parameter)',
  'Contenu binaire servi a la page, ecrit en base64 :': 'Binary content served to the page, written in base64:',
  'Seuls les 200 000 premiers caracteres de ce contenu sont gardes avec la requete.':
    'Only the first 200,000 characters of this content are kept with the request.',
  'Contenu binaire charge depuis « {fichier} » : la page recevra ces {n} octets.':
    'Binary content loaded from "{fichier}": the page will receive these {n} bytes.',
  'Revenir a un texte': 'Back to text',
  'Fichier trop gros : {n} octets, 5 Mo au plus': 'File too large: {n} bytes, 5 MB at most',
  'Charger depuis un fichier…': 'Load from a file…',
  'Fichier charge': 'File loaded',

  /* ------------------------------- Debit ---------------------------------- */
  'Limiter le debit de la reponse': 'Throttle the response',
  'Limiter le debit d un domaine (outil « Throttle » de Charles)': 'Throttle a domain (Charles\'s "Throttle" tool)',
  'Debit limite': 'Throttled',
  'Debit de la reponse': 'Response rate',
  'comme l outil « Throttle » de Charles': 'like Charles\'s "Throttle" tool',
  'Debit (ko/s, 1 ko = 1 000 octets)': 'Rate (kB/s, 1 kB = 1,000 bytes)',
  'La page recoit le corps de la reponse a ce debit, comme sur un reseau lent ; SWIFT, lui, l enregistre des son arrivee. Ne s ajoute pas a une simulation ni a un remplacement sur la meme requete.':
    'The page receives the response body at this rate, as on a slow network; SWIFT records it as soon as it arrives. It does not add to a simulation or a replacement on the same request.',
  'la page recoit le corps de la reponse a {n} ko/s': 'the page receives the response body at {n} kB/s',
  'aucun debit valide : la regle n agit pas': 'no valid rate: the rule does nothing',

  /* ------------------------------- Modeles -------------------------------- */
  'Desactiver le cache (outil « No Caching » de Charles)': 'Disable the cache (Charles\'s "No Caching" tool)',
  'Bloquer les cookies (outil « Block Cookies » de Charles)': 'Block cookies (Charles\'s "Block Cookies" tool)',
  'Ajouter un parametre a l URL': 'Add a URL parameter',
  'Retirer les parametres de suivi (utm_*, fbclid, gclid)': 'Remove tracking parameters (utm_*, fbclid, gclid)',
  'Bloquer la telemetrie': 'Block telemetry',
  'Bloquer les images': 'Block images',
  'Redirection de test': 'Test redirect',
  'User-Agent impose': 'Forced User-Agent',
  'Retirer Content-Security-Policy': 'Remove Content-Security-Policy',
  'Sans cache': 'No cache',
  'Sans cookies': 'No cookies',
  'Parametre de debogage': 'Debug parameter',
  'Sans parametres de suivi': 'No tracking parameters',
  'Nouvelle regle': 'New rule',
  'Regle': 'Rule',
  '{nom} (copie)': '{nom} (copy)',
  '{"statut":"simule par SWIFT"}': '{"status":"simulated by SWIFT"}',

  /* --------------------------- Neutraliser (defang) ----------------------- */
  'URL et IP — neutraliser pour un rapport (defang)': 'URL and IP — defang for a report',
  'URL et IP — retablir (refang)': 'URL and IP — refang',

  /* ------------------------- Metadonnees d image -------------------------- */
  'Metadonnees d image': 'Image metadata',
  'format non reconnu': 'format not recognised',
  'Cette image revele, a qui la telecharge :': 'This image reveals, to anyone who downloads it:',
  'La position ou la photo a ete prise : {lat}, {lon}, a {alt} m d altitude.': 'Where the photo was taken: {lat}, {lon}, at an altitude of {alt} m.',
  'La position ou la photo a ete prise : {lat}, {lon}.': 'Where the photo was taken: {lat}, {lon}.',
  '{nom} : {valeur}': '{nom}: {valeur}',
  'Ni position, ni nom, ni numero de serie dans ses metadonnees.': 'No position, no name, no serial number in its metadata.',
  'Latitude (GPS)': 'Latitude (GPS)',
  'Longitude (GPS)': 'Longitude (GPS)',
  'Altitude (GPS)': 'Altitude (GPS)',
  'Latitude (XMP)': 'Latitude (XMP)',
  'Longitude (XMP)': 'Longitude (XMP)',
  'Paquet XMP': 'XMP packet',
  'Collez une image en base64, en hexadecimal ou en URI de donnees : sa position GPS, son auteur, son appareil et son logiciel en sortent. Rien n est envoye nulle part.':
    'Paste an image in base64, hexadecimal or as a data URI: its GPS position, its author, its camera and its software come out. Nothing is sent anywhere.',
  'Lecture des metadonnees…': 'Reading the metadata…',
  'Ni JPEG, ni PNG, ni WebP : rien a lire.': 'Neither JPEG, PNG nor WebP: nothing to read.',
  'Description de l image': 'Image description',
  'Fabricant': 'Make',
  'Modele': 'Model',
  'Logiciel': 'Software',
  'Date de modification': 'Date modified',
  'Droits': 'Copyright',
  'Date de prise de vue': 'Date taken',
  'Date de numerisation': 'Date digitised',
  'Fuseau de la date de modification': 'Time zone of the date modified',
  'Fuseau de la prise de vue': 'Time zone of the date taken',
  'Commentaire': 'Comment',
  'Temps de pose': 'Exposure time',
  'Ouverture': 'Aperture',
  'Sensibilite ISO': 'ISO sensitivity',
  'Focale': 'Focal length',
  'Identifiant unique de l image': 'Unique image ID',
  'Proprietaire de l appareil': 'Camera owner',
  'Numero de serie du boitier': 'Camera body serial number',
  'Fabricant de l objectif': 'Lens make',
  'Modele de l objectif': 'Lens model',
  'Numero de serie de l objectif': 'Lens serial number',
  'Heure GPS (UTC)': 'GPS time (UTC)',
  'Date GPS': 'GPS date',
  'Referentiel GPS': 'GPS map datum',
  'Logiciel createur (XMP)': 'Creator tool (XMP)',
  'Createur (XMP)': 'Creator (XMP)',
  'Ville (XMP)': 'City (XMP)',
  'Region (XMP)': 'State (XMP)',
  'Pays (XMP)': 'Country (XMP)',
  'Droits (XMP)': 'Rights (XMP)',
  'Identifiant du document (XMP)': 'Document ID (XMP)',
  'Date de creation (XMP)': 'Date created (XMP)',
  'Bloc IPTC (Photoshop)': 'IPTC block (Photoshop)',
  'bloc EXIF trop court': 'EXIF block too short',
  'bloc EXIF sans ordre d octets': 'EXIF block without a byte order',
  'bloc EXIF sans la signature 42': 'EXIF block without the 42 signature',
  'IFD tronque': 'truncated IFD',
  'segment JPEG de longueur invalide': 'JPEG segment with an invalid length',
  'iTXt incomplet': 'incomplete iTXt',
  'paquet XMP de plus de 1 Mo : seul le premier Mo est lu': 'XMP packet over 1 MB: only the first MB is read',
  '{n} valeur(s) de plus de 4 096 caracteres, coupee(s) : la coupure est marquee « […] ».':
    '{n} value(s) longer than 4,096 characters, cut: the cut is marked “[…]”.',
  '{n} champ(s) au-dela des 200 premiers, non affiche(s).': '{n} field(s) beyond the first 200, not shown.',
  '{n} autre(s) erreur(s), non affichee(s).': '{n} other error(s), not shown.',

  /* ------------------ Ce que le navigateur annonce (UA) ------------------- */
  'Ce que le navigateur annonce': 'What the browser announces',
  'User-Agent et indices clients': 'User-Agent and client hints',
  'derive de {famille}, jeton {jeton}': 'derived from {famille}, token {jeton}',
  'non reconnu': 'not recognised',
  'Windows {n} (indices clients, Sec-CH-UA-Platform-Version {v})': 'Windows {n} (client hints, Sec-CH-UA-Platform-Version {v})',
  'Client automatique': 'Automated client',
  'Se declare mobile': 'Declares itself mobile',
  'Marque leurre (voulue par la specification)': 'Decoy brand (required by the specification)',
  'Marque': 'Brand',
  'Moteur': 'Engine',
  'Architecture': 'Architecture',
  'Derive de': 'Derived from',
  'Jeton du derive': 'Token of the derivative',
  'A savoir': 'Worth knowing',
  'Windows 11 s annonce aussi « Windows NT 10.0 » : seuls les indices clients (Sec-CH-UA-Platform-Version) les distinguent.':
    'Windows 11 also announces itself as "Windows NT 10.0": only the client hints (Sec-CH-UA-Platform-Version) tell them apart.',
  'macOS 10.15 est une valeur figee par les navigateurs : la version reelle peut etre plus recente.':
    'macOS 10.15 is a value frozen by browsers: the real version may be more recent.',
  'Version reduite : seul le numero majeur est reel, le reste vaut 0.0.0.':
    'Reduced version: only the major number is real, the rest reads 0.0.0.',
  'Chaine reduite : « Android 10; K » masque la version d Android et le modele de l appareil.':
    'Reduced string: "Android 10; K" hides the Android version and the device model.',
  'Depuis iOS 26, la chaine ecrit une version d iOS figee (18.6, puis 18.7) : la version affichee est celle de Safari, livre avec iOS.':
    'Since iOS 26, the string carries a frozen iOS version (18.6, then 18.7): the version shown is Safari\'s, which ships with iOS.',
  'Depuis iOS 26, la chaine ecrit une version d iOS figee (18.6, puis 18.7) : la version reelle peut etre plus recente.':
    'Since iOS 26, the string carries a frozen iOS version (18.6, then 18.7): the real version may be more recent.',
  'Chaine de plus de 2 048 caracteres : seuls les 2 048 premiers sont lus.':
    'String longer than 2,048 characters: only the first 2,048 are read.',
  'derive de {famille}': 'derived from {famille}'
};
