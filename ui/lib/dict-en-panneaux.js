/* Dictionnaire anglais — panneaux de la boite a outils
 * INTERCEPTOR (by D4RK)
 *
 * Suite de dict-en-tools.js, dont il complete la table (`...EN_PANNEAUX`).
 * Meme regle : la cle est le texte francais tel qu il apparait dans le code.
 */
export const EN_PANNEAUX = {
  /* ---------------------------- Cles et essais ---------------------------- */
  'XOR': 'XOR',
  'cle repetee, operation reciproque': 'repeated key, self-reversing operation',
  'cle en texte, ou en hexadecimal': 'key as text, or as hexadecimal',
  'Cle en hexadecimal': 'Key in hexadecimal',
  'Sans cle, essayez les 255 cles d un seul octet ci-dessous.':
    'With no key, try the 255 single-byte keys below.',
  'Essayer les 255 cles d un octet': 'Try the 255 single-byte keys',
  'Cles d un octet retenues': 'Single-byte keys kept',
  'Le meme resultat, en octets': 'The same result, as bytes',
  'Cesar': 'Caesar',
  'les vingt-cinq decalages': 'all twenty-five shifts',
  'Vigenere': 'Vigenere',
  'cle en lettres': 'key in letters',
  'Chiffrer': 'Encipher',
  'Dechiffrer': 'Decipher',

  /* ------------------------------ Identifier ------------------------------ */
  'ce que la forme du texte laisse deviner': 'what the shape of the text suggests',
  'Collez une empreinte, un jeton ou le debut d un contenu binaire.':
    'Paste a hash, a token, or the start of some binary content.',
  'Empreinte': 'Hash',
  'Candidat': 'Candidate',
  'Signature de contenu': 'Content signature',
  'Aucune signature connue au debut de ce contenu. Un corps binaire doit d abord etre decode depuis le base64 ou l hexadecimal.':
    'No known signature at the start of this content. A binary body must first be decoded from base64 or hexadecimal.',
  'Formes reconnues': 'Recognised shapes',
  'lecture directe': 'read directly',
  'Uniquement hexadecimal': 'Hexadecimal only',
  'Alphabet base64': 'Base64 alphabet',
  'Alphabet base64 URL': 'Base64 URL alphabet',
  'Trois parties separees par des points': 'Three parts separated by dots',
  'Forme d UUID': 'UUID shape',
  'Chiffres seulement': 'Digits only',
  'Commence par un accolade ou un crochet': 'Starts with a brace or a bracket',

  /* -------------------------------- Generer ------------------------------- */
  'Identifiants': 'Identifiers',
  'formats normalises': 'standardised formats',
  'UUID v7': 'UUID v7',
  'ULID': 'ULID',
  'NanoID': 'NanoID',
  'Seize octets au hasard': 'Sixteen random bytes',
  'Horodate : deux identifiants se trient dans l ordre de creation':
    'Timestamped: two identifiers sort in creation order',
  'Horodate, ecrit en base 32 Crockford': 'Timestamped, written in Crockford base 32',
  'Vingt et un caracteres d URL': 'Twenty-one URL-safe characters',
  'Suites aleatoires': 'Random sequences',
  'longueur en octets': 'length in bytes',
  '32 octets en base64': '32 bytes as base64',
  '32 octets en base64 URL': '32 bytes as base64 URL',
  'Mot de passe': 'Password',
  'tirage sans biais': 'unbiased draw',
  'Longueur': 'Length',
  'Minuscules': 'Lowercase',
  'Majuscules': 'Uppercase',
  'Chiffres': 'Digits',
  'Symboles': 'Symbols',
  'Tirer un mot de passe': 'Draw a password',
  'Alphabet employe': 'Alphabet used',
  'Poser comme texte de travail': 'Set as working text',
  'valeurs d essai': 'test values',
  'Adresse materielle': 'Hardware address',
  'Marquee « administree localement », comme il se doit':
    'Marked « locally administered », as it should be',
  'Adresse IPv4 privee': 'Private IPv4 address',
  'Port dynamique': 'Dynamic port',
  'Valeurs limites': 'Edge-case values',
  'Des cas qui font tomber les validateurs mal ecrits : longueur, encodage, sens d ecriture. A employer sur ses propres services.':
    'Cases that break sloppy validators: length, encoding, writing direction. To be used on your own services.',
  'Valeur posee : ': 'Value set: ',
  'caracteres': 'characters',

  /* ------------------------------- Importer ------------------------------- */
  'Commande cURL': 'cURL command',
  'Requete HTTP brute': 'Raw HTTP request',
  'Collez une requete complete dans le texte de travail : ligne de commande, entetes, ligne vide, corps.':
    'Paste a complete request into the working text: request line, headers, blank line, body.',
  'Requete illisible : ': 'Request cannot be read: ',
  'Creer la requete': 'Create the request',
  'Copier la commande cURL equivalente': 'Copy the equivalent cURL command',
  'Apercu': 'Preview',
  'Methode': 'Method',
  'Corps': 'Body',

  /* ---------------------------------- JWT --------------------------------- */
  'entete, charge utile, validite et signature': 'header, payload, validity and signature',
  'Verifier la signature': 'Verify the signature',
  'cle partagee du serveur': 'shared key of the server',
  'Verifier': 'Verify',
  'Seules les signatures HS256, HS384 et HS512 se verifient ici : elles emploient une cle partagee. RS, ES et PS demandent la cle publique du serveur.':
    'Only HS256, HS384 and HS512 signatures can be verified here: they use a shared key. RS, ES and PS need the public key of the server.',
  'Signature valide : cette cle est bien celle qui a signe le jeton.':
    'Valid signature: this key is indeed the one that signed the token.',
  'Signature invalide : cette cle n a pas signe ce jeton.':
    'Invalid signature: this key did not sign this token.',
  'Signature attendue': 'Expected signature',
  'Tant qu aucune cle n est fournie, la signature n est pas verifiee.':
    'As long as no key is given, the signature is not verified.',

  /* -------------------------- Signature d un jeton ------------------------ */
  'Cle a fournir': 'Key to provide',
  'la cle partagee du serveur, telle quelle': 'the shared key of the server, as it is',
  'la cle publique RSA, en PEM ou en JWK': 'the RSA public key, as PEM or JWK',
  'la cle publique de la courbe, en PEM ou en JWK': 'the public key of the curve, as PEM or JWK',
  'aucune : ce jeton n est pas signe': 'none: this token is not signed',
  'algorithme non verifiable par une extension': 'algorithm an extension cannot verify',
  'Cet algorithme ne se verifie pas dans un navigateur : les douze familles HS, RS, PS et ES le peuvent, les autres non.':
    'This algorithm cannot be verified in a browser: the twelve HS, RS, PS and ES families can, the others cannot.',
  'secret partage, cle publique PEM (-----BEGIN PUBLIC KEY-----) ou JWK':
    'shared secret, PEM public key (-----BEGIN PUBLIC KEY-----) or JWK',
  'Verdict': 'Verdict',
  'signature valide': 'valid signature',
  'signature invalide': 'invalid signature',
  'Methode employee': 'Method used',
  'Courbe': 'Curve',
  'cle partagee (HMAC)': 'shared key (HMAC)',
  'cle publique RSA': 'RSA public key',
  'cle publique RSA-PSS': 'RSA-PSS public key',
  'cle publique sur courbe elliptique': 'public key on an elliptic curve',

  /* ------------------------------ Empreintes ------------------------------ */
  'MD5 et SHA-1 sont casses pour la signature : ils reconnaissent une valeur, ils ne prouvent rien.':
    'MD5 and SHA-1 are broken for signing: they recognise a value, they prove nothing.',
  'Sommes de controle': 'Checksums',
  'calculees a chaque affichage': 'computed on every render',
  'CRC-32': 'CRC-32',
  'Adler-32': 'Adler-32',
  'FNV-1a 32': 'FNV-1a 32',
  'djb2': 'djb2',
  'Somme des octets': 'Sum of the bytes',
  'HMAC': 'HMAC',
  'signature a cle partagee': 'shared-key signature',
  'cle de signature': 'signing key',
  'Signer': 'Sign',
  'Le HMAC signe le texte de travail avec la cle donnee : c est ce que verifie un webhook.':
    'HMAC signs the working text with the given key: that is what a webhook verifies.',

  /* -------------------------------- Mesures ------------------------------- */
  'taille reelle du texte de travail': 'true size of the working text',
  'bits par octet, maximum 8': 'bits per byte, maximum 8',
  'Caracteres invisibles': 'Invisible characters',
  'Aucun caractere invisible ou trompeur.': 'No invisible or deceptive character.',
  'Des caracteres invisibles se cachent dans ce texte : ils servent a masquer du contenu.':
    'Invisible characters hide in this text: they are used to conceal content.',
  'Position ': 'Position ',
  'Caracteres les plus frequents': 'Most frequent characters',
  'decalage, octets, colonne lisible': 'offset, bytes, readable column',

  /* -------------------------- Expression reguliere ------------------------ */
  'testee sur le texte de travail': 'tested against the working text',
  'remplacement, $1 pour un groupe': 'replacement, $1 for a group',
  'Apres remplacement': 'After replacement',

  /* ---------------------------------- URL --------------------------------- */
  'chaque partie, sans rien masquer': 'every part, nothing hidden',
  'Placez une URL dans le texte de travail. Le menu contextuel du tableau y envoie celle d une requete.':
    'Put a URL into the working text. The table context menu sends the URL of a request here.',
  'URL illisible : ': 'URL cannot be read: ',
  'URL normalisee': 'Normalised URL',
  'Schema en clair : tout le contenu circule lisible sur le reseau.':
    'Cleartext scheme: all content travels readable on the network.',
  'Ce domaine est ecrit en punycode : lu par un humain, il ressemble a un autre.':
    'This domain is written in punycode: read by a human, it looks like another one.',
  'Hote lisible': 'Readable host',
  'Forme ASCII': 'ASCII form',
  'Etiquettes du nom': 'Labels of the name',
  'Deux dernieres etiquettes': 'Last two labels',
  'Le domaine reellement enregistrable demande la liste publique des suffixes : les deux dernieres etiquettes n en sont qu une approximation.':
    'The truly registrable domain needs the public suffix list: the last two labels are only an approximation.',
  'Adresse IP en guise d hote': 'IP address used as host',
  'Identifiant dans l URL': 'Username in the URL',
  'Mot de passe dans l URL': 'Password in the URL',
  'Un mot de passe dans l URL finit dans les journaux, l historique et l entete Referer.':
    'A password in the URL ends up in logs, history and the Referer header.',
  'Port declare': 'Declared port',
  'Port effectif': 'Effective port',
  'Service connu sur ce port': 'Known service on this port',
  'Plage du port': 'Port range',
  'Segments': 'Segments',
  'Fichier': 'File',
  'Fragment': 'Fragment',
  'Longueur totale': 'Total length',
  'Aucun parametre dans cette URL.': 'No parameter in this URL.',
  'Chercher cet hote dans les requetes': 'Search this host in the requests',
  'Copier l origine': 'Copy the origin',

  /* ------------------------------- Adresse IP ----------------------------- */
  'Adresse et sous-reseau': 'Address and subnet',
  'IPv4 et IPv6': 'IPv4 and IPv6',
  'Placez une adresse ou un prefixe dans le texte de travail : 192.168.1.130/26, 2001:db8::1/64.':
    'Put an address or a prefix into the working text: 192.168.1.130/26, 2001:db8::1/64.',
  'Adresse illisible : ': 'Address cannot be read: ',
  'Famille': 'Family',
  'Adresse': 'Address',
  'Prefixe': 'Prefix',
  'Categorie': 'Category',
  'Masque de sous-reseau': 'Subnet mask',
  'Masque joker': 'Wildcard mask',
  'Adresse de reseau': 'Network address',
  'Adresse de diffusion': 'Broadcast address',
  'Premiere adresse utilisable': 'First usable address',
  'Derniere adresse utilisable': 'Last usable address',
  'Adresses au total': 'Addresses in total',
  'Adresses utilisables': 'Usable addresses',
  'Valeur entiere': 'Integer value',
  'Binaire': 'Binary',
  'Ecriture longue': 'Long form',
  'Premiere adresse': 'First address',
  'Derniere adresse': 'Last address',
  'Nom inverse (DNS)': 'Reverse name (DNS)',
  'Appartenance': 'Membership',
  'cette adresse est-elle dans ce prefixe ?': 'is this address inside this prefix?',
  'Oui : cette adresse appartient au prefixe.': 'Yes: this address belongs to the prefix.',
  'Non : cette adresse est hors du prefixe.': 'No: this address is outside the prefix.',
  'Prefixe illisible : ': 'Prefix cannot be read: ',
  'Chercher cette adresse dans les requetes': 'Search this address in the requests',

  /* ------------------------------- Reference ------------------------------ */
  'tables completes, hors ligne': 'complete tables, offline',
  'chercher un code, un nom, un mot': 'search a code, a name, a word',
  'Codes de statut': 'Status codes',
  'Types de media': 'Media types',
  'Ports': 'Ports',
  'Aucun code ne correspond.': 'No code matches.',
  'Aucune methode ne correspond.': 'No method matches.',
  'Aucun entete ne correspond.': 'No header matches.',
  'Aucun type ne correspond.': 'No media type matches.',
  'Aucun port ne correspond.': 'No port matches.',
  'Sure (ne modifie rien)': 'Safe (changes nothing)',
  'Idempotente': 'Idempotent',
  'Reponse cachable': 'Cacheable response',
  'Extensions': 'Extensions',
  'Plage': 'Range',
  'requete': 'request',
  'reponse': 'response',
  'les deux': 'both',

  /* ------------------------------ Horodatage ------------------------------ */
  'Maintenant': 'Now',
  'Placez une valeur dans le texte de travail pour la convertir : nombre, date ISO, date HTTP ou duree.':
    'Put a value into the working text to convert it: number, ISO date, HTTP date or duration.',
  'Chaque origine possible est montree. Seules celles qui tombent entre 1970 et 2200 sont retenues.':
    'Every possible epoch is shown. Only those landing between 1970 and 2200 are kept.',
  'Heure locale': 'Local time',
  'Toutes les ecritures': 'Every notation',
  'Ecart avec maintenant': 'Gap from now',
  'Ecart : ': 'Gap: ',
  'identiques': 'identical',
  'le second est posterieur': 'the second one is later',
  'le second est anterieur': 'the second one is earlier',
  'Copier l ISO': 'Copy the ISO form',
  'Lue comme une duree': 'Read as a duration',
  'Secondes': 'Seconds',
  'Minutes': 'Minutes',
  'Heures': 'Hours',
  'Jours': 'Days',
  'Echeance si elle part maintenant': 'Deadline if it starts now',
  'ISO 8601 (UTC)': 'ISO 8601 (UTC)',
  'ISO 8601 (local)': 'ISO 8601 (local)',
  'Date HTTP (RFC 7231)': 'HTTP date (RFC 7231)',
  'Secondes depuis 1970': 'Seconds since 1970',
  'Millisecondes depuis 1970': 'Milliseconds since 1970',
  'Microsecondes depuis 1970': 'Microseconds since 1970',
  'Windows FILETIME': 'Windows FILETIME',
  'Ticks .NET': '.NET ticks',
  'Secondes depuis 2001 (Apple)': 'Seconds since 2001 (Apple)',
  'Serie Excel': 'Excel serial',
  'Jour julien': 'Julian day',
  'Jour de la semaine': 'Day of the week',
  'Mois': 'Month',
  'Semaine ISO': 'ISO week',
  'Jour de l annee': 'Day of the year',
  'Trimestre': 'Quarter',
  'Annee bissextile': 'Leap year',

  /* -------------------------- Lectures d horodatage ----------------------- */
  'Secondes depuis 1970 (Unix)': 'Seconds since 1970 (Unix)',
  'Millisecondes depuis 1970 (Unix)': 'Milliseconds since 1970 (Unix)',
  'Nanosecondes depuis 1970': 'Nanoseconds since 1970',
  'Pas de 100 ns depuis 1601 (Windows FILETIME)': '100 ns steps since 1601 (Windows FILETIME)',
  'Microsecondes depuis 1601 (Chrome, WebKit)': 'Microseconds since 1601 (Chrome, WebKit)',
  'Secondes depuis 1904 (HFS, QuickTime)': 'Seconds since 1904 (HFS, QuickTime)',
  'Secondes depuis 2001 (Apple, Cocoa)': 'Seconds since 2001 (Apple, Cocoa)',
  'Pas de 100 ns depuis l an 1 (.NET ticks)': '100 ns steps since year 1 (.NET ticks)',
  'Jours depuis 1899-12-30 (serie Excel)': 'Days since 1899-12-30 (Excel serial)',
  'Date interpretee par le moteur': 'Date parsed by the engine',

  /* -------------------------------- Nombres ------------------------------- */
  'toutes les bases, sans perte de chiffre': 'every base, without losing a digit',
  'Le texte de travail est lu en :': 'The working text is read as:',
  'Placez un nombre dans le texte de travail : il sera reecrit dans toutes les bases.':
    'Put a number into the working text: it will be rewritten in every base.',
  'Binaire (2)': 'Binary (2)',
  'Octal (8)': 'Octal (8)',
  'Decimal (10)': 'Decimal (10)',
  'Hexadecimal (16)': 'Hexadecimal (16)',
  'Base 32': 'Base 32',
  'Base 36': 'Base 36',
  'Ecritures de « ': 'Notations of « ',
  'Base 64 (alphabet standard)': 'Base 64 (standard alphabet)',
  'Proprietes': 'Properties',
  'Signe': 'Sign',
  'negatif': 'negative',
  'positif': 'positive',
  'nul': 'zero',
  'Bits necessaires': 'Bits needed',
  'Parite': 'Parity',
  'pair': 'even',
  'impair': 'odd',
  'Tient dans un entier sur 32 bits': 'Fits in a 32-bit integer',
  'Tient dans un nombre JavaScript sur': 'Fits exactly in a JavaScript number',
  'oui, exactement': 'yes, exactly',
  'non, la precision serait perdue': 'no, precision would be lost',
  'Lu comme une adresse IPv4': 'Read as an IPv4 address',
  'Lu comme un port': 'Read as a port',
  'Copier en hexadecimal': 'Copy as hexadecimal',
  'Copier en decimal': 'Copy as decimal',

  /* ------------------- Reference employee dans le detail ------------------- */
  'Sens du statut': 'Meaning of the status',
  'Famille du statut': 'Status family',
  'Type de media': 'Media type',

  /* --------------------------------- Divers ------------------------------- */
  'Applique chaque decodage et ne garde que ceux qui rendent un resultat lisible':
    'Applies every decoding and keeps only those that give a readable result',
  'oui': 'yes',
  'non': 'no'
};
