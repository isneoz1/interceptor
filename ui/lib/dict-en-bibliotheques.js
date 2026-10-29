/* Dictionnaire anglais : ce que rendent les bibliotheques — SWIFT (by D4RK)
 *
 * Les modules de ui/lib rendent leurs libelles et leurs remarques en francais,
 * cle du dictionnaire : les motifs de recherche, les valeurs limites, les
 * remarques sur une empreinte, les caracteres invisibles, les origines d un
 * horodatage. Le panneau qui les affiche les traduit ; ces entrees sont les
 * leurs. tests/langue.test.mjs rend chaque outil en anglais pour qu aucune
 * ne manque.
 */
export const EN_BIBLIOTHEQUES = {
  /* ------------------------- Motifs de recherche ------------------------- */
  'Adresse de courriel': 'Email address',
  'Forme seulement : la seule preuve d existence reste l envoi.': 'Shape only: the only proof it exists is sending to it.',
  'URL http ou https': 'http or https URL',
  'Toute adresse web dans un texte.': 'Any web address in a text.',
  'Nom de domaine': 'Domain name',
  'Un hote ecrit en clair, sans schema.': 'A host written plainly, without a scheme.',
  'Adresse IPv4': 'IPv4 address',
  'Chaque octet est borne a 255 : les fausses adresses sont ecartees.': 'Each byte is capped at 255: false addresses are left out.',
  'Adresse IPv6': 'IPv6 address',
  'Forme abregee comprise ; a confirmer dans l onglet Adresse IP.': 'Shortened form included; confirm it in the IP address tab.',
  'Adresse materielle (MAC)': 'Hardware address (MAC)',
  'Six octets separes.': 'Six separated bytes.',
  'Toutes versions confondues.': 'Every version.',
  'Un entete JSON encode commence toujours par « eyJ ».': 'An encoded JSON header always starts with "eyJ".',
  'Entete Authorization': 'Authorization header',
  'A employer sur un bloc d entetes colle.': 'For a pasted block of headers.',
  'Cle privee au format PEM': 'PEM private key',
  'Une cle privee ne devrait jamais circuler dans une reponse.': 'A private key should never travel in a response.',
  'Empreinte hexadecimale': 'Hexadecimal digest',
  'MD5, SHA-1, SHA-256 et suivantes.': 'MD5, SHA-1, SHA-256 and the longer ones.',
  'Chaine base64 longue': 'Long base64 string',
  'Souvent un jeton, une image en ligne ou un corps encode.': 'Often a token, an inline image or an encoded body.',
  'Date ISO 8601': 'ISO 8601 date',
  'Le format que rendent la plupart des API.': 'The format most APIs return.',
  'Horodatage Unix (10 chiffres)': 'Unix timestamp (10 digits)',
  'Secondes depuis 1970, de 2001 a 2033.': 'Seconds since 1970, from 2001 to 2033.',
  'Version semantique': 'Semantic version',
  'Couleur hexadecimale': 'Hexadecimal colour',
  'Dans une feuille de style.': 'In a style sheet.',
  'Numero de carte (forme)': 'Card number (shape)',
  'Forme seulement. La cle de Luhn, elle, se verifie : voir l outil dedie.':
    'Shape only. The Luhn check digit, though, can be verified: see the dedicated tool.',
  'Parametre de requete': 'Query parameter',
  'Couples cle=valeur dans une URL.': 'key=value pairs in a URL.',
  'Balise HTML': 'HTML tag',
  'Ouvre ou ferme un element.': 'Opens or closes an element.',
  'Commentaire HTML': 'HTML comment',
  'Un commentaire oublie livre parfois une adresse interne.': 'A forgotten comment sometimes gives away an internal address.',
  '$.a.b[0], $.a[*], $..cle': '$.a.b[0], $.a[*], $..key',

  /* ---------------------------- Valeurs limites --------------------------- */
  'Chaine vide': 'Empty string',
  'Espace seul': 'A single space',
  'Tres longue (1 000 caracteres)': 'Very long (1,000 characters)',
  'Emoji hors du plan de base': 'Emoji outside the basic plane',
  'Ecriture de droite a gauche': 'Right-to-left script',
  'Espace insecable': 'Non-breaking space',
  'Largeur nulle': 'Zero width',
  'Accents decomposes': 'Decomposed accents',
  'Retours a la ligne melanges': 'Mixed line endings',
  'Nombre maximal exact': 'Largest exact number',
  'Nombre au-dela du sur': 'Number beyond the safe range',
  'Zero negatif': 'Negative zero',
  'Notation scientifique': 'Scientific notation',
  'Vrai et faux en texte': 'True and false as text',
  'Nul en texte': 'Null as text',
  'JSON imbrique profond': 'Deeply nested JSON',

  /* ------------------------------ Empreintes ------------------------------ */
  'Format bcrypt reconnu a son prefixe.': 'bcrypt format, recognised by its prefix.',
  'Format Argon2 reconnu a son prefixe.': 'Argon2 format, recognised by its prefix.',
  'Format crypt(3) Unix.': 'Unix crypt(3) format.',
  'Format LDAP.': 'LDAP format.',
  'Trois parties separees par des points : voir l onglet JWT.': 'Three parts separated by dots: see the JWT tab.',
  'Longueur de {n} caracteres hexadecimaux : plusieurs algorithmes la partagent, la liste est une piste, pas une reponse.':
    '{n} hexadecimal characters long: several algorithms share this length, so the list is a lead, not an answer.',
  'empreinte encodee en base64': 'base64-encoded digest',
  'Alphabet base64 : essayez « Base64 vers hexadecimal » pour retrouver la longueur reelle.':
    'Base64 alphabet: try "Base64 to hexadecimal" to find the real length.',
  'Aucune forme connue ne correspond a cette longueur.': 'No known format matches this length.',

  /* -------------------------------- Journaux ------------------------------ */
  'Toute pose, modification ou suppression de cookie observee par Firefox, y compris celles faites en JavaScript et invisibles dans les entetes.':
    'Every cookie set, change or removal Firefox observes, including those made in JavaScript and invisible in the headers.',
  'Les huit evenements de webNavigation : debut, validation, DOM, chargement, erreurs, nouvelles cibles, fragments et historique.':
    'The eight webNavigation events: start, commit, DOM, load, errors, new targets, fragments and history.',
  'Workers, Service Workers, WebRTC, etat des sondes de page : ce que le reseau seul ne montre pas.':
    'Workers, Service Workers, WebRTC, the state of the page probes: what the network alone does not show.',

  /* ------------------------ Caracteres, temps, divers ---------------------- */
  '(espace)': '(space)',
  '(fin de ligne)': '(line feed)',
  '(tabulation)': '(tab)',
  '(rien)': '(nothing)',
  'Secondes depuis 1900 (NTP)': 'Seconds since 1900 (NTP)',
  'Secondes depuis 1980 (GPS, sans secondes intercalaires)': 'Seconds since 1980 (GPS, without leap seconds)',
  'Identifiant du jeton': 'Token ID',
  'saut {n}': 'hop {n}',
  'il y a {n} jours': '{n} days ago',
  'un texte s arrete a {n} caracteres, l autre continue': 'one text stops at {n} characters, the other goes on'
};
