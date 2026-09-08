/* Dictionnaire anglais — Code, OTP, empreintes supplementaires, emplacement
 * INTERCEPTOR (by NeoZ)
 *
 * Suite de dict-en-tools.js. Meme regle : la cle est le texte francais tel
 * qu il apparait dans le code. Couvre le panneau Code (brouillage/lecture),
 * les codes OTP, les empreintes supplementaires et le menu d ancrage.
 */
export const EN_CODE = {
  /* ------------------------------- Panneau Code -------------------------- */
  'Code': 'Code',
  'Brouiller un code, ou rendre lisible un code brouille — sans jamais l executer':
    'Obfuscate code, or make obfuscated code readable — without ever running it',
  'Rendre lisible': 'Make readable',
  'Brouiller': 'Obfuscate',
  'Deroule les enveloppes eval et decode fromCharCode, echappements et base64':
    'Unwraps eval layers and decodes fromCharCode, escapes and base64',
  'Enveloppe le code dans une forme qui s auto-decode a l execution':
    'Wraps the code in a form that self-decodes at run time',
  'Collez un code dans le texte de travail, en haut, puis choisissez une action.':
    'Paste code into the working text above, then pick an action.',
  'Le code brouille s execute a l identique : on remet la source telle quelle avant de la lancer. Ce n est pas du chiffrement — la cle voyage avec le code : cela gene une lecture rapide, cela ne protege pas un secret.':
    'The obfuscated code runs identically: the source is restored as-is before it runs. This is not encryption — the key travels with the code: it slows a quick read, it does not protect a secret.',
  'Reindenter': 'Reindent',
  'Ce qui a ete fait': 'What was done',
  'Code brouille': 'Obfuscated code',
  'Code lisible': 'Readable code',
  'Copier le resultat': 'Copy the result',
  'Reprendre comme entree': 'Reuse as input',
  'Resultat vide': 'Empty result',
  'Echec : ': 'Failed: ',
  'Choisissez une forme puis « Brouiller ».': 'Pick a form then « Obfuscate ».',
  'Collez un code brouille puis « Rendre lisible ».': 'Paste obfuscated code then « Make readable ».',
  'Resultat copie': 'Result copied',

  /* Styles de brouillage (obfuscation.js). */
  'Securise (ou-exclusif + tableau, universel)': 'Secure (XOR + array, universal)',
  'Compact (base64)': 'Compact (base64)',
  'Chaine echappee (\\xNN)': 'Escaped string (\\xNN)',
  'Codes de caracteres': 'Character codes',
  'Double couche (compact puis securise)': 'Double layer (compact then secure)',

  /* Etapes rapportees par le deobfuscateur (obfuscation-lire.js). */
  'procedes decodes (fromCharCode, echappements, base64)':
    'techniques decoded (fromCharCode, escapes, base64)',
  'code reindente': 'code reindented',
  'aucun procede reconnu — le code semble deja lisible':
    'no technique recognised — the code already looks readable',
  'code vide': 'empty code',

  /* -------------------------------- Codes OTP ---------------------------- */
  'Codes OTP': 'OTP codes',
  'TOTP et HOTP, calcules a partir d un secret que vous fournissez':
    'TOTP and HOTP, computed from a secret you provide',
  'Lire le lien otpauth colle': 'Read the pasted otpauth link',
  'Lien otpauth lu': 'otpauth link read',
  'secret (base32, ex. JBSWY3DPEHPK3PXP)': 'secret (base32, e.g. JBSWY3DPEHPK3PXP)',
  'Format du secret': 'Secret format',
  'Algorithme': 'Algorithm',
  'Pas (s)': 'Step (s)',
  'Code TOTP maintenant': 'TOTP code now',
  'Fenetres voisines': 'Neighbouring windows',
  'Code HOTP a ce compteur': 'HOTP code at this counter',
  'Code calcule': 'Computed code',
  'valable encore': 'valid for another',
  'fenetre': 'window',
  'compteur': 'counter',
  'Copier le code': 'Copy the code',
  'un serveur accepte souvent la precedente et la suivante':
    'a server often accepts the previous and next one',
  'maintenant': 'now',
  'precedente': 'previous',
  'suivante': 'next',
  'Secret de test': 'Test secret',
  'pour vos propres essais': 'for your own trials',
  'Generer un secret aleatoire': 'Generate a random secret',
  'Secret genere': 'Secret generated',
  'Code copie': 'Code copied',
  'Le secret reste sur cette page et ne part nulle part. Cet outil recalcule un code public a partir du secret que vous donnez.':
    'The secret stays on this page and goes nowhere. This tool recomputes a public code from the secret you give.',

  /* ------------------- Empreintes supplementaires ------------------------ */
  'Empreintes supplementaires': 'Additional digests',
  'familles': 'families',
  'MD4 et NTLM ne protegent plus rien : ils servent a relire une valeur, jamais a prouver une identite.':
    'MD4 and NTLM protect nothing any more: they help re-read a value, never prove an identity.',
  'MurmurHash3': 'MurmurHash3',
  'xxHash32': 'xxHash32',
  'Variantes CRC': 'CRC variants',
  'normalisees': 'standardised',
  'Calculer': 'Compute',
  'Toutes': 'All',

  /* Usages des variantes CRC (sommes.js). */
  'bus SMBus, capteurs I2C': 'SMBus, I2C sensors',
  'sondes 1-Wire Dallas/Maxim': '1-Wire Dallas/Maxim probes',
  'radiodiffusion de donnees DARC': 'DARC data broadcasting',
  'archives LHA, ARC': 'LHA, ARC archives',
  'automates industriels Modbus RTU': 'Modbus RTU industrial controllers',
  'trames USB': 'USB frames',
  'aussi appelee CCITT-FALSE': 'also called CCITT-FALSE',
  'transfert XMODEM, ZMODEM': 'XMODEM, ZMODEM transfer',
  'protocole Kermit, souvent nomme CCITT': 'Kermit protocol, often named CCITT',
  'bus Genibus, DNP': 'Genibus bus, DNP',
  'telephonie CDMA2000': 'CDMA2000 telephony',
  'telephonie sans fil DECT': 'DECT cordless telephony',
  'ZIP, PNG, gzip, Ethernet': 'ZIP, PNG, gzip, Ethernet',
  'archives bzip2': 'bzip2 archives',
  'CRC-32C : iSCSI, SCTP, ext4, Btrfs': 'CRC-32C: iSCSI, SCTP, ext4, Btrfs',
  'flux de transport MPEG-2': 'MPEG-2 transport stream',
  'variante sans ou-exclusif final': 'variant without final XOR',
  'commande cksum POSIX': 'POSIX cksum command',
  'archives xz': 'xz archives',
  'bandes DLT, norme ECMA-182': 'DLT tapes, ECMA-182 standard',

  /* ------------------------- Alphabets supplementaires ------------------- */
  'Base62 (identifiants courts) — encoder': 'Base62 (short identifiers) — encode',
  'Base62 (identifiants courts) — decoder': 'Base62 (short identifiers) — decode',
  'Base32 Crockford (sans I L O U) — encoder': 'Crockford Base32 (no I L O U) — encode',
  'Base32 Crockford (sans I L O U) — decoder': 'Crockford Base32 (no I L O U) — decode',

  /* ------------------------ Emplacement de la console -------------------- */
  'Console': 'Console',
  'Ouvrir la console': 'Open the console',
  'Position de la fenetre detachee': 'Detached window position',
  'Onglet complet': 'Full tab',
  'Fenetre detachee': 'Detached window',
  'Panneau lateral': 'Side panel',
  'Fenetre compacte au clic': 'Compact window on click',
  'Fenetre compacte': 'Compact window',
  'En haut': 'At the top',
  'En bas': 'At the bottom',
  'Au centre': 'Centred',
  'Plein ecran': 'Full screen',
  'La ou je la laisse': 'Where I leave it',
  'Emplacement de la console': 'Console placement',
  'Comme l ancrage des outils de developpement de Firefox : choisissez ou la console s ouvre quand vous cliquez sur l icone. Les boutons d ancrage en haut de la console font la meme chose d un clic.':
    'Like docking the Firefox developer tools: choose where the console opens when you click the icon. The dock buttons at the top of the console do the same in one click.',
  'Utilisee uniquement quand la console s ouvre en fenetre detachee. « La ou je la laisse » retient la derniere position.':
    'Used only when the console opens as a detached window. « Where I leave it » remembers the last position.'
};
