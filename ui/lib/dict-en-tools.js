/* Dictionnaire anglais — boite a outils, cible, diagnostic interne
 * INTERCEPTOR (by D4RK)
 *
 * Suite de dict-en.js, dont il complete la table (`...EN_TOOLS`). Meme regle :
 * la cle est le texte francais tel qu il apparait dans le code.
 */
import { EN_OUTILS } from './dict-en-outils.js';
import { EN_PANNEAUX } from './dict-en-panneaux.js';
import { EN_PANNEAUX2 } from './dict-en-panneaux2.js';
import { EN_RESEAU } from './dict-en-reseau.js';
import { EN_CONSOLE } from './dict-en-console.js';
import { EN_ALERTES } from './dict-en-alertes.js';
import { EN_REF_HTTP } from './dict-en-ref-http.js';
import { EN_REF_ENTETES } from './dict-en-ref-entetes.js';
import { EN_REF_RESEAU } from './dict-en-ref-reseau.js';
import { EN_CODE } from './dict-en-code.js';

export const EN_TOOLS = {
  /* ------------------------------ Navigation ------------------------------ */
  'Outils': 'Tools',
  'Boite a outils': 'Toolbox',

  /* -------------------- Noms de vues et explications ---------------------- */
  'Sites et chemins': 'Sites and paths',
  'Flux temps reel': 'Live streams',
  'Workers et WebRTC': 'Workers and WebRTC',
  'Etat du systeme': 'System state',
  'Journal interne': 'Internal log',
  'Agir sur le trafic': 'Act on traffic',

  'Tout le trafic, requete par requete': 'All traffic, request by request',
  'Ce qui est risque : secrets, cookies mal proteges, HTTP en clair':
    'What is risky: secrets, poorly protected cookies, cleartext HTTP',
  'Les chiffres d ensemble : statuts, types, domaines, debit':
    'The overall figures: statuses, types, domains, throughput',
  'Ce qui existe sur les sites visites, hote par hote':
    'What exists on the visited sites, host by host',
  'WebSocket et Server-Sent Events, message par message':
    'WebSocket and Server-Sent Events, message by message',
  'Deux requetes confrontees ligne a ligne': 'Two requests compared line by line',
  'Chaque cookie pose, modifie ou supprime': 'Every cookie set, changed or removed',
  'Les changements de page et de cadre': 'Page and frame changes',
  'Workers, Service Workers, WebRTC et mesures de page':
    'Workers, Service Workers, WebRTC and page measurements',
  'Decoder, hacher, mesurer ou inspecter une valeur':
    'Decode, hash, measure or inspect a value',
  'Bloquer, rediriger, modifier le trafic automatiquement':
    'Block, redirect or modify traffic automatically',
  'Suspendre une requete pour la modifier avant son depart':
    'Hold a request to edit it before it leaves',
  'Ce que chaque couche capture reellement, et les chiffres du noyau':
    'What each layer actually captures, and the core figures',
  'Les erreurs d INTERCEPTOR lui-meme, et ses commandes':
    'INTERCEPTOR own errors, and its commands',
  'Toutes les options, et quatre profils tout prets':
    'Every option, and four ready-made profiles',
  'Douze lecons pour prendre l outil en main': 'Twelve lessons to get started',
  'Le mode d emploi complet, hors ligne': 'The complete manual, offline',

  /* --------------------------- Boite a outils ----------------------------- */
  'Collez ici une valeur : jeton, corps de requete, entetes, chaine encodee…':
    'Paste a value here: token, request body, headers, encoded string…',
  'Depuis le presse-papiers': 'From clipboard',
  'Transformer': 'Transform',
  'Transformation': 'Transformation',
  'Appliquer': 'Apply',
  'Tout essayer': 'Try everything',
  'Resultat': 'Result',
  'Resultats lisibles': 'Readable results',
  'Copier le resultat': 'Copy result',
  'Reprendre comme entree': 'Use as input',
  'Echec : ': 'Failed: ',
  'Aucun decodage ne rend un resultat lisible : le texte est probablement deja en clair.':
    'No decoding yields a readable result: the text is probably already plain.',
  'Choisissez une transformation, ou « Tout essayer » pour laisser INTERCEPTOR reconnaitre l encodage.':
    'Pick a transformation, or use "Try everything" to let INTERCEPTOR recognise the encoding.',

  /* ---------------------------------- JWT --------------------------------- */
  'Jeton JWT': 'JWT token',
  'Collez un jeton dans le texte de travail.': 'Paste a token into the working text.',
  'Ce texte n est pas un JWT : ': 'This text is not a JWT: ',
  'Algorithme « none » : ce jeton n est pas signe. Un serveur qui l accepte est vulnerable.':
    'Algorithm "none": this token is unsigned. A server accepting it is vulnerable.',
  'La signature n est pas verifiee : INTERCEPTOR ne detient pas la cle du serveur. Un JWT decode n est pas un JWT valide.':
    'The signature is not verified: INTERCEPTOR does not hold the server key. A decoded JWT is not a valid JWT.',
  'Ce jeton est expire.': 'This token has expired.',
  'Ce jeton n est pas encore valide.': 'This token is not valid yet.',
  'Entete': 'Header',
  'Charge utile': 'Payload',
  'Charge utile brute': 'Raw payload',
  'Algorithme': 'Algorithm',
  'Emis le': 'Issued at',
  'Valide a partir de': 'Valid from',
  'Expire le': 'Expires at',
  'Temps restant': 'Time remaining',
  'Signature': 'Signature',

  /* ------------------------------ Empreintes ------------------------------ */
  'Empreintes': 'Hashes',
  'Tout calculer': 'Compute all',
  'Choisissez un algorithme pour calculer l empreinte du texte de travail.':
    'Pick an algorithm to hash the working text.',

  /* --------------------------- Mesures, entropie -------------------------- */
  'Mesures': 'Measurements',
  'Caracteres': 'Characters',
  'Octets (UTF-8)': 'Bytes (UTF-8)',
  'Lignes': 'Lines',
  'Mots': 'Words',
  'Entropie': 'Entropy',
  'Entropie par octet': 'Entropy per byte',
  'Entropie totale (bits)': 'Total entropy (bits)',
  'Octets distincts': 'Distinct bytes',
  'Texte vide.': 'Empty text.',
  'Tres desordonne : donnees compressees, chiffrees ou binaires.':
    'Very disordered: compressed, encrypted or binary data.',
  'Desordonne : ressemble a un jeton ou a une cle aleatoire.':
    'Disordered: looks like a random token or key.',
  'Ordinaire : ressemble a du texte, du JSON ou du code.':
    'Ordinary: looks like text, JSON or code.',
  'Tres repetitif : peu de caracteres distincts.':
    'Very repetitive: few distinct characters.',

  /* ------------------------------ Hexadecimal ----------------------------- */
  'Hexadecimal': 'Hexadecimal',
  'Vidage hexadecimal': 'Hex dump',
  'Copier le vidage': 'Copy dump',
  'Texte de travail vide.': 'Working text is empty.',

  /* ------------------------------ Horodatage ------------------------------ */
  'Horodatage': 'Timestamp',
  'Maintenant (ISO)': 'Now (ISO)',
  'Maintenant (secondes)': 'Now (seconds)',
  'Maintenant (millisecondes)': 'Now (milliseconds)',
  'Placez une valeur dans le texte de travail pour la convertir.':
    'Put a value in the working text to convert it.',
  'Non convertible : ': 'Not convertible: ',
  'Lectures de « ': 'Readings of "',

  /* ------------------------------ Generateurs ----------------------------- */
  'Generer': 'Generate',
  'Generateurs': 'Generators',
  'UUID v4': 'UUID v4',
  '16 octets': '16 bytes',
  '32 octets': '32 bytes',
  '64 octets': '64 bytes',
  'La valeur produite remplace le texte de travail.':
    'The generated value replaces the working text.',

  /* ------------------------------- Structures ----------------------------- */
  'Structures': 'Structures',
  'Parametres d URL': 'URL parameters',
  'Entetes': 'Headers',
  'Aucun couple cle=valeur reconnu.': 'No key=value pair recognised.',
  'Aucun cookie reconnu.': 'No cookie recognised.',
  'Aucune ligne « Nom: valeur » reconnue.': 'No "Name: value" line recognised.',

  /* -------------------------- Expression reguliere ------------------------ */
  'Expression reguliere': 'Regular expression',
  'Correspondances': 'Matches',
  'Ecrivez une expression pour voir ses correspondances.':
    'Write an expression to see its matches.',
  'Expression invalide : ': 'Invalid expression: ',
  'Aucune correspondance.': 'No match.',

  /* --------------------------------- Cible -------------------------------- */
  'Arborescence': 'Tree',
  'Hotes': 'Hosts',
  'Chemins distincts': 'Distinct paths',
  'Filtrer par hote…': 'Filter by host…',
  'Tout deplier': 'Expand all',
  'Tout replier': 'Collapse all',
  'Copier les hotes': 'Copy hosts',
  'Voir les requetes': 'View requests',
  'Copier l hote': 'Copy host',
  'Seulement avec alertes': 'Only with alerts',
  'Tous les hotes': 'All hosts',
  'Methodes': 'Methods',
  'Parametres vus': 'Parameters seen',
  'Parametres': 'Parameters',
  'Cliquer pour ouvrir cette requete': 'Click to open this request',
  ' requetes supplementaires a ce niveau : ouvrez le tableau pour tout voir.':
    ' more requests at this level: open the table to see them all.',
  'Rien a montrer sur le perimetre observe. Naviguez, ou elargissez le perimetre en haut a droite.':
    'Nothing to show in the observed scope. Browse, or widen the scope at the top right.',

  /* -------------------------- Diagnostic interne -------------------------- */
  'Journal': 'Journal',
  'Avertissements': 'Warnings',
  'Informations': 'Information',
  'Evenements': 'Events',
  'Lecture du journal…': 'Reading the journal…',
  'Chercher dans le journal…': 'Search the journal…',
  'Vider le journal': 'Clear journal',
  'Poser un repere': 'Drop a marker',
  'Exporter le journal': 'Export journal',
  'Commandes les plus lentes': 'Slowest commands',
  'Entrees conservees': 'Entries kept',
  'Entrees ecartees faute de place': 'Entries dropped for lack of room',
  'Plafond du journal': 'Journal cap',
  'Journal demarre a': 'Journal started at',
  'Cliquer pour ne garder que ce niveau': 'Click to keep only this level',
  'Cliquer pour afficher le detail': 'Click to show details',
  'Rien a signaler : aucune erreur interne, ou les filtres ecartent tout.':
    'Nothing to report: no internal error, or the filters exclude everything.',
  'Activez « Journal de diagnostic » dans Reglages -> Diagnostic interne pour enregistrer les erreurs et les commandes du noyau.':
    'Enable "Diagnostic journal" in Settings -> Internal diagnostics to record core errors and commands.',

  /* ----------------------------- Etats vides ----------------------------- */
  'Journal desactive': 'Journal disabled',
  'Interception inactive': 'Interception inactive',
  'Aucune requete suspendue': 'No held request',
  'Aucun hote': 'No host',

  /* --------------------------- Interception ------------------------------ */
  'Interception': 'Interception',
  'Interception en direct': 'Live interception',
  'Interception active': 'Interception active',
  'Demarrer l interception': 'Start interception',
  'Arreter l interception': 'Stop interception',
  'Requetes suspendues': 'Held requests',
  'Portee': 'Scope',
  'Requetes sortantes': 'Outgoing requests',
  'Reponses entrantes': 'Incoming responses',
  'Tout laisser passer': 'Forward everything',
  'Laisser passer': 'Forward',
  'Envoyer modifiee': 'Send modified',
  'Abandonner': 'Drop',
  'En attente': 'Held',
  'Laissees passer': 'Forwarded',
  'Modifiees': 'Modified',
  'Abandonnees': 'Dropped',
  'Relachees par echeance': 'Released on timeout',
  'Requete sortante': 'Outgoing request',
  'Reponse entrante': 'Incoming response',
  'onglet': 'tab',
  'URL': 'URL',
  'Ligne': 'Row',
  'Echeance de securite (ms)': 'Safety timeout (ms)',
  'Filtre (expression reguliere) — vide = toutes les requetes':
    'Filter (regular expression) — empty = every request',
  'Entetes envoyees (une par ligne : Nom: valeur)':
    'Sent headers (one per line: Name: value)',
  'Entetes recues (une par ligne : Nom: valeur)':
    'Received headers (one per line: Name: value)',
  'L interception ne retient une requete que si cette console est ouverte. Une echeance la relache automatiquement, et fermer la console relache tout : une navigation ne peut pas rester bloquee.':
    'Interception only holds a request while this console is open. A timeout releases it automatically, and closing the console releases everything: browsing can never stay stuck.',
  'Demarrez l interception pour suspendre les requetes et les modifier avant leur depart.':
    'Start interception to hold requests and edit them before they leave.',
  'Naviguez : la prochaine requete correspondant au filtre s arretera ici.':
    'Browse: the next request matching the filter will stop here.',
  'L URL a change : la requete partira par redirection, et les entetes modifiees ici ne seront pas appliquees a ce depart.':
    'The URL changed: the request will leave as a redirect, and headers edited here will not apply to that departure.',

  /* Catalogue des transformations, panneaux et tables de reference :
     chaque famille a son fichier, pour qu aucun ne depasse la limite de lignes. */
  ...EN_OUTILS,
  ...EN_PANNEAUX,
  ...EN_PANNEAUX2,
  ...EN_RESEAU,
  ...EN_CONSOLE,
  ...EN_ALERTES,
  ...EN_REF_HTTP,
  ...EN_REF_ENTETES,
  ...EN_REF_RESEAU,
  ...EN_CODE
};
