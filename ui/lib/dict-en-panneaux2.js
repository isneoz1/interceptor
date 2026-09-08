/* Dictionnaire anglais — panneaux Chiffrement, Binaire, Entetes, Comparer,
 * Chercher et operations sur les prefixes. INTERCEPTOR (by D4RK)
 *
 * Suite de dict-en-panneaux.js, dont il complete la table (`...EN_PANNEAUX2`).
 * Meme regle : la cle est le texte francais tel qu il apparait dans le code.
 */
export const EN_PANNEAUX2 = {
  /* ------------------------- Onglets ajoutes ------------------------------ */
  'Chiffrement': 'Encryption',
  'Entetes': 'Headers',
  'Chercher': 'Find',

  /* ------------------------------ Chiffrement ----------------------------- */
  'AES': 'AES',
  'le texte de travail est chiffre ou dechiffre': 'the working text is encrypted or decrypted',
  'Tirer une cle de 32 octets': 'Draw a 32-byte key',
  'cle': 'key',
  'vecteur d initialisation en hexadecimal, vide pour un tirage':
    'initialisation vector in hexadecimal, empty to draw one',
  'donnees authentifiees (AES-GCM seulement)': 'authenticated data (AES-GCM only)',
  'Vecteur attendu': 'Expected vector',
  'Chiffrer': 'Encrypt',
  'Dechiffrer': 'Decrypt',
  'Resultat chiffre': 'Encrypted result',
  'Vecteur employe': 'Vector used',
  'Sans ce vecteur, le message ne se dechiffre pas : il se conserve avec le message, il n a pas a rester secret.':
    'Without this vector the message cannot be decrypted: keep it with the message, it does not need to stay secret.',
  'Poser le chiffre comme texte de travail': 'Set the ciphertext as working text',
  'Derivation de cle': 'Key derivation',
  'PBKDF2 et HKDF, tels que les emploient les applications':
    'PBKDF2 and HKDF, as applications actually use them',
  'mot de passe ou cle de depart': 'password or starting key',
  'sel': 'salt',
  'iterations': 'iterations',
  'Iterations': 'Iterations',
  'PBKDF2': 'PBKDF2',
  'HKDF': 'HKDF',
  '128 bits': '128 bits',
  '256 bits': '256 bits',
  '384 bits': '384 bits',
  '512 bits': '512 bits',
  'PBKDF2 ralentit volontairement le calcul : c est le nombre d iterations qui protege un mot de passe, pas l empreinte choisie.':
    'PBKDF2 deliberately slows the computation: it is the iteration count that protects a password, not the chosen hash.',
  'Cle derivee': 'Derived key',
  'Employer comme cle AES': 'Use as the AES key',
  'Verifier une signature detachee': 'Verify a detached signature',
  'webhook, manifeste, paquet': 'webhook, manifest, package',
  'signature en base64': 'signature in base64',
  'RSA': 'RSA',
  'RSA-PSS': 'RSA-PSS',
  'ECDSA': 'ECDSA',
  'cle publique PEM ou JWK, ou secret partage pour HMAC':
    'PEM or JWK public key, or shared secret for HMAC',
  'La signature couvre exactement le texte de travail, tel qu il est affiche.':
    'The signature covers exactly the working text, as displayed.',
  'Signature invalide : le contenu, la cle ou l algorithme ne correspondent pas.':
    'Invalid signature: the content, the key or the algorithm does not match.',
  'Rien ne sort de la machine : le moteur du navigateur fait tous ces calculs sur place.':
    'Nothing leaves the machine: the browser engine does all of this locally.',

  /* --------------------------- Import (complements) ----------------------- */
  'Collez une commande cURL dans le texte de travail. Celles que produit INTERCEPTOR sont relues telles quelles, tout comme celles copiees depuis un autre navigateur.':
    'Paste a cURL command into the working text. The ones INTERCEPTOR produces are read back as they are, and so are those copied from another browser.',
  'La requete creee n a pas ete emise : elle apparait dans le tableau avec l etat « pending ». Utilisez l onglet « Rejouer » de son detail pour l envoyer reellement.':
    'The created request has not been sent: it appears in the table in the « pending » state. Use the « Replay » tab of its detail to actually send it.',

  /* -------------------------------- Binaire ------------------------------- */
  'le texte de travail est lu en base64 ou en hexadecimal':
    'the working text is read as base64 or hexadecimal',
  'Reconnaitre': 'Recognise',
  'Protocol Buffers': 'Protocol Buffers',
  'MessagePack': 'MessagePack',
  'CBOR': 'CBOR',
  'ASN.1 et certificats': 'ASN.1 and certificates',
  'Jeux de caracteres': 'Character sets',
  'Rien a lire : ': 'Nothing to read: ',
  'Octets lus': 'Bytes read',
  'Premiers octets': 'First bytes',
  'Signature de fichier': 'File signature',
  'hexadecimal': 'hexadecimal',
  'base64': 'base64',
  'decode sans reste': 'decoded with nothing left over',
  'Copier en JSON': 'Copy as JSON',
  'Formats qui acceptent ces octets': 'Formats that accept these bytes',
  'Aucun des trois formats ne lit ces octets jusqu au bout. Ce peut etre du texte, une image, ou un format non gere.':
    'None of the three formats reads these bytes to the end. It may be text, an image, or an unsupported format.',
  'Plusieurs formats acceptent la meme suite d octets : seule la source dit lequel est le bon.':
    'Several formats accept the same byte sequence: only the source says which one is right.',
  'Collez un bloc PEM (-----BEGIN CERTIFICATE-----) ou du DER en base64.':
    'Paste a PEM block (-----BEGIN CERTIFICATE-----) or DER in base64.',
  'Bloc illisible : ': 'Block cannot be read: ',
  'Bloc': 'Block',
  'Certificat': 'Certificate',
  'Sujet': 'Subject',
  'Emetteur': 'Issuer',
  'Numero de serie': 'Serial number',
  'Algorithme de signature': 'Signature algorithm',
  'Algorithme de cle': 'Key algorithm',
  'Taille de cle': 'Key size',
  'Valide jusqu au': 'Valid until',
  'Ce certificat est expire.': 'This certificate has expired.',
  'Jours restants': 'Days left',
  'Autorite de certification': 'Certificate authority',
  'Noms couverts': 'Names covered',
  'nom': 'name',
  'Usages de la cle': 'Key usages',
  'Usages etendus': 'Extended usages',
  'usage': 'usage',
  'critique': 'critical',
  'Ce bloc n est pas un certificat : ': 'This block is not a certificate: ',
  'Voir la structure ASN.1': 'Show the ASN.1 structure',
  'Masquer la structure ASN.1': 'Hide the ASN.1 structure',
  'Ce texte porte les traces d un UTF-8 relu dans un autre jeu : ':
    'This text bears the marks of UTF-8 re-read in another character set: ',
  'Reparer le texte': 'Repair the text',
  'Lectures possibles': 'Possible readings',
  'caracteres perdus': 'characters lost',
  'Decoder avec ce jeu': 'Decode with this character set',

  /* -------------------------------- Entetes ------------------------------- */
  'Collez une ligne « Nom: valeur », ou un bloc entier copie depuis l onglet En-tetes d une requete.':
    'Paste a « Name: value » line, or a whole block copied from the Headers tab of a request.',
  'Entetes decoupes en detail': 'Headers broken down in detail',
  'Aucune ligne « Nom: valeur » reconnue dans ce texte.':
    'No « Name: value » line recognised in this text.',
  'Lignes lues': 'Lines read',
  'analysees en detail': 'analysed in detail',
  'point(s) a regarder de pres, listes sous chaque entete.':
    'point(s) worth a closer look, listed under each header.',
  'Cet entete n a pas de decoupage particulier : sa valeur est rendue telle quelle.':
    'This header has no specific breakdown: its value is shown as it is.',
  'Copier la valeur': 'Copy the value',
  'Les avertissements portent sur des faits verifiables : un attribut absent, une directive qui annule la protection. Aucun n est une question de gout.':
    'The warnings are about verifiable facts: a missing attribute, a directive that cancels the protection. None is a matter of taste.',

  /* ------------------------------- Comparer ------------------------------- */
  'le texte de travail, face a un autre': 'the working text, against another one',
  'collez ici le second texte : la reponse d hier, l autre environnement, la valeur attendue':
    'paste the second text here: yesterday response, the other environment, the expected value',
  'Echanger les deux': 'Swap the two',
  'Les deux textes sont vides.': 'Both texts are empty.',
  'Comparaison impossible : ': 'Comparison impossible: ',
  'de lignes communes': 'of lines in common',
  'Lignes identiques': 'Identical lines',
  'Lignes seulement a gauche': 'Lines only on the left',
  'Lignes seulement a droite': 'Lines only on the right',
  'Les deux textes sont identiques, ligne pour ligne.':
    'Both texts are identical, line for line.',
  'Ils different pourtant caractere par caractere : voir ci-dessous.':
    'They differ character by character all the same: see below.',
  'Premiere difference': 'First difference',
  'position ': 'position ',
  'A gauche': 'On the left',
  'A droite': 'On the right',
  'Ligne a ligne': 'Line by line',
  'lignes': 'lines',
  'Affichage limite a 600 lignes ; le format unifie ci-dessous les porte toutes.':
    'Display limited to 600 lines; the unified format below carries them all.',
  'Mot a mot': 'Word by word',
  'sur une seule ligne, la difference se voit mieux':
    'on a single line the difference shows better',
  'Copier le format unifie': 'Copy the unified format',
  'Poser le format unifie comme entree': 'Set the unified format as input',

  /* ------------------------------- Chercher ------------------------------- */
  'Motifs courants': 'Common patterns',
  'formes reconnues': 'recognised shapes',
  'Expression': 'Expression',
  'Trouvailles': 'Findings',
  'valeur': 'value',
  'Rien de cette forme dans le texte de travail.': 'Nothing of that shape in the working text.',
  'Copier la liste': 'Copy the list',
  'Poser la liste comme entree': 'Set the list as input',
  'Cle de Luhn': 'Luhn checksum',
  'carte bancaire, IMEI, numero de securite sociale canadien':
    'payment card, IMEI, Canadian social insurance number',
  'numero a verifier': 'number to check',
  'Somme de controle': 'Checksum',
  'juste': 'correct',
  'fausse': 'wrong',
  'La cle est juste : le numero est bien forme. Cela ne dit rien de son existence.':
    'The checksum is correct: the number is well formed. That says nothing about it existing.',
  'La cle est fausse : il y a une faute de frappe, ou ce n est pas un numero de ce type.':
    'The checksum is wrong: there is a typo, or this is not a number of that kind.',
  'Chemin dans le JSON': 'Path in the JSON',
  'Tous les chemins': 'Every path',
  'Resultats': 'Results',
  'Ce chemin ne mene a rien dans ce document.': 'This path leads nowhere in this document.',
  'Selecteur dans le HTML': 'Selector in the HTML',
  'CSS ou XPath, sur le texte de travail': 'CSS or XPath, on the working text',
  'CSS': 'CSS',
  'XPath': 'XPath',
  'L analyseur HTML du navigateur n est pas disponible dans ce contexte.':
    'The browser HTML parser is not available in this context.',
  'Elements trouves': 'Elements found',
  'Aucun element ne correspond.': 'No element matches.',
  'Selecteur refuse : ': 'Selector refused: ',
  'attributs': 'attributes',

  /* --------------------------- Prefixes reseau ---------------------------- */
  'Decouper': 'Split',
  'en sous-reseaux de taille egale': 'into subnets of equal size',
  'Sous-reseaux': 'Subnets',
  'Decoupage impossible : ': 'Split impossible: ',
  'Resumer': 'Summarise',
  'le plus petit prefixe qui couvre une liste': 'the smallest prefix covering a list',
  'un prefixe ou une adresse par ligne : 10.0.1.0/24, 10.0.2.5...':
    'one prefix or address per line: 10.0.1.0/24, 10.0.2.5...',
  'Prefixes lus': 'Prefixes read',
  'Resume': 'Summary',
  'Etendue': 'Span',
  'Adresses couvertes': 'Addresses covered',
  'Ce resume couvre plus large que la liste : il inclut des adresses qui n y figuraient pas.':
    'This summary covers more than the list: it includes addresses that were not in it.',
  'Resume impossible : ': 'Summary impossible: ',
  'Plage vers prefixes': 'Range to prefixes',
  'la liste minimale qui couvre exactement une plage':
    'the minimal list that covers a range exactly',
  'Prefixes': 'Prefixes',
  'prefixe': 'prefix',
  'Conversion impossible : ': 'Conversion impossible: ',
  'Enumerer': 'Enumerate',
  'les premieres adresses du bloc': 'the first addresses of the block',
  'Lister jusqu a 256 adresses': 'List up to 256 addresses',

  /* ---------------------------- Reference reseau -------------------------- */
  'Suites TLS': 'TLS cipher suites',
  'Fermetures WebSocket': 'WebSocket close codes',
  'Erreurs HTTP/2': 'HTTP/2 errors',
  'Erreurs reseau': 'Network errors',
  'Aucune suite ne correspond.': 'No cipher suite matches.',
  'Aucune entree ne correspond.': 'No entry matches.',
  'Version': 'Version',
  'Echange de cle': 'Key exchange',
  'Authentification': 'Authentication',
  'Integrite': 'Integrity',
  'Solidite': 'Strength',
  'Confidentialite persistante': 'Forward secrecy',
  'forte': 'strong',
  'moyenne': 'moderate',
  'faible': 'weak',
  'cassee': 'broken',
  'inconnue de cette table': 'unknown to this table',
  'certificat': 'certificate'
};
