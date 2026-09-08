/* Vue « Aide » — mode d emploi complet, hors ligne — INTERCEPTOR (by NeoZ) */
import { $, el, clear } from '../lib/dom.js';
import { fieldHelp } from '../lib/filters.js';
import { cmd, toast } from '../app.js';
import { t, lang } from '../lib/i18n.js';
import { HELP_SECTIONS as SECTIONS_EN } from './content-en.js';

const SECTIONS = [
  {
    h: 'Par ou commencer',
    p: ['Si vous decouvrez l outil, ouvrez le **Tutoriel** dans la barre laterale : douze lecons guidees, avec des boutons qui font reellement l action decrite et des verifications qui lisent l etat reel de votre capture. Cette page-ci est la reference complete, a garder sous la main.'],
    ul: []
  },
  {
    h: 'Prise en main en trois etapes',
    p: ['INTERCEPTOR demarre seul et capture en permanence. Il n y a rien a configurer pour commencer.'],
    ul: [
      '1. Naviguez normalement : chaque requete apparait en direct dans la vue Requetes.',
      '2. Cliquez sur une ligne : le panneau du bas montre TOUT ce qui a ete capture, onglet par onglet.',
      '3. Le bandeau de gauche donne acces aux alertes de securite, aux flux, aux journaux et aux reglages.'
    ]
  },
  {
    h: 'Langue et confort',
    p: ['Le bouton FR / EN de l en-tete bascule toute l interface, l aide et le tutoriel entre le francais et l anglais. Reglages -> Interface propose aussi le mode simple, le theme clair ou sombre, le contraste renforce, la taille du texte et la densite du tableau.'],
    ul: []
  },
  {
    h: 'Les trois fenetres',
    p: ['La meme interface se presente sous trois formes, au choix.'],
    table: [
      ['Console complete', 'Onglet plein ecran. Alt+Shift+I, ou le bouton « Actions -> Ouvrir dans un onglet ».'],
      ['Panneau lateral', 'Colle a la fenetre du navigateur pendant que vous naviguez. Alt+Shift+S.'],
      ['Fenetre compacte', 'Clic sur l icone de la barre d outils. Ctrl+Shift+Y.']
    ]
  },
  {
    h: 'Raccourcis clavier',
    table: [
      ['/', 'Placer le curseur dans la recherche'],
      ['fleche haut / bas', 'Requete precedente / suivante, avec le detail ouvert'],
      ['Echap', 'Fermer le detail ou un menu'],
      ['P', 'Mettre la capture en pause ou la reprendre'],
      ['F', 'Activer ou figer le suivi du flux'],
      ['1 a 9', 'Basculer directement sur une vue'],
      ['Ctrl+Shift+U', 'Pause / reprise, meme hors de la console'],
      ['Ctrl+clic', 'Ajouter une ligne a la selection'],
      ['Maj+clic', 'Selectionner une plage de lignes'],
      ['2 lignes + Comparer', 'Confronter deux requetes ligne a ligne']
    ]
  },
  {
    h: 'Le tableau des requetes',
    ul: [
      'Colonnes : le bouton « Colonnes » en propose une trentaine. Votre choix est conserve.',
      'Tri : cliquez sur un en-tete de colonne ; un second clic inverse l ordre.',
      'Suivre : le tableau reste colle aux dernieres requetes. Il se fige des que vous remontez.',
      'Selection : Ctrl+clic et Maj+clic. Les exports et la suppression portent alors sur la selection.',
      'Epingler : la colonne etoile marque une ligne pour la retrouver avec le filtre « flag: ».',
      'Aucune limite d affichage : seules les lignes visibles sont dessinees, la liste entiere reste accessible.'
    ]
  },
  {
    h: 'Les vues',
    table: [
      ['Requetes', 'Le flux complet, avec le detail en douze onglets.'],
      ['Securite', 'Toutes les alertes trouvees automatiquement, classees par gravite.'],
      ['Synthese', 'Agregats de la session : statuts, types, domaines les plus lourds, requetes les plus lentes, debit dans le temps.'],
      ['Comparaison', 'Deux requetes selectionnees, confrontees ligne a ligne (entetes et corps).'],
      ['Flux temps reel', 'WebSocket et Server-Sent Events, message par message, en direct.'],
      ['Cookies', 'Chaque pose, modification ou suppression de cookie, y compris en JavaScript.'],
      ['Navigation', 'Les huit evenements de navigation de Firefox.'],
      ['Workers et WebRTC', 'Workers, Service Workers, WebRTC, etat des sondes de page.'],
      ['Etat du systeme', 'Etat reel de chaque couche, chiffres du noyau, test de couverture.'],
      ['Regles', 'Blocage, redirection et reecriture d entetes, avec un editeur visuel.'],
      ['Boite a outils', 'Vingt et une familles d outils sur un seul texte de travail : encodages, chiffrement, formats binaires, certificats, empreintes, reseau, entetes, horodatages, reference HTTP.'],
      ['Reglages', 'Tout ce qui se configure, avec des profils prets a l emploi.'],
      ['Tutoriel', 'Douze lecons guidees, avec suivi de progression.']
    ]
  },
  {
    h: 'La boite a outils',
    p: [
      'Un seul texte de travail, vingt et un onglets qui le regardent. On colle une valeur une fois — depuis le presse-papiers, depuis le menu contextuel d une ligne, ou depuis un onglet du detail — et chaque outil travaille dessus. Tout se calcule dans la page : aucune de ces fonctions n emet la moindre requete.'
    ],
    table: [
      ['Transformer', '121 transformations classees en dix-huit familles : base64 et base64 URL, base32, base58, base45, Ascii85, URL, entites HTML, hexadecimal, binaire, octal, echappements Unicode, punycode, JSON, YAML, CSV, XML, gzip et deflate, casse, lignes, echappements de chaine, Protocol Buffers, MessagePack, CBOR, ASN.1. « Tout essayer » applique chaque decodage et ne garde que les resultats lisibles.'],
      ['Cles et essais', 'XOR avec cle repetee, recherche des 255 cles d un octet, les vingt-cinq decalages de Cesar, Vigenere. Ces chiffres ne protegent rien : ils relisent une valeur volontairement obscurcie.'],
      ['JWT', 'Entete, charge utile, validite, temps restant. La signature se verifie vraiment, sur les douze algorithmes courants : HS256 a HS512 avec la cle partagee, RS, PS et ES avec la cle publique collee en PEM ou en JWK. Sans cle, l ecran le dit, plutot que de laisser croire qu un jeton decode est un jeton valide.'],
      ['Chiffrement', 'AES-GCM, AES-CBC et AES-CTR dans les deux sens, avec vecteur d initialisation et donnees authentifiees ; derivation PBKDF2 et HKDF ; verification d une signature detachee RSA, RSA-PSS, ECDSA ou HMAC. Tout passe par le moteur du navigateur, rien ne sort de la machine.'],
      ['Empreintes', 'MD5, SHA-1, SHA-256, SHA-384, SHA-512, CRC-32, Adler-32, FNV-1a, djb2, somme des octets, et HMAC avec cle.'],
      ['Binaire', 'Protocol Buffers, MessagePack et CBOR lus octet par octet, sans schema ; ASN.1, DER et resume d un certificat X.509 (sujet, emetteur, validite, noms couverts, usages) ; trente-sept jeux de caracteres et reparation du mojibake.'],
      ['Mesures', 'Caracteres, octets, lignes, mots, entropie de Shannon, frequence des caracteres, et reperage des caracteres invisibles qui servent a masquer du contenu.'],
      ['Hexadecimal', 'Vidage classique : decalage, seize octets, colonne lisible.'],
      ['Identifier', 'Ce que la forme du texte laisse deviner : famille d empreinte, signature de fichier dans les premiers octets, alphabet employe. Des candidats, jamais un verdict.'],
      ['Horodatage', 'Onze origines possibles (Unix en secondes, millisecondes, microsecondes et nanosecondes, FILETIME Windows, Chrome, HFS, Apple, ticks .NET, serie Excel, jour julien) et toutes les ecritures d un meme instant. Lit aussi les durees ecrites « 1d12h ».'],
      ['Nombres', 'Un entier reecrit dans toutes les bases, sans perte de chiffre, avec ses proprietes et sa lecture en adresse IPv4 ou en port.'],
      ['Structures', 'Parametres d URL, cookies et entetes reconnus dans le texte colle.'],
      ['Entetes', 'Vingt-quatre entetes decoupes en detail : Set-Cookie et ses attributs, politique de securite, HSTS, Cache-Control, Accept pondere, Authorization. Chaque manque reel est signale — un attribut absent, une directive qui annule la protection.'],
      ['Chercher', 'Vingt motifs tout prets (courriel, adresse, empreinte, jeton, cle privee), chemins dans un JSON, selecteurs CSS et XPath dans du HTML, et la cle de Luhn.'],
      ['Expression reguliere', 'Correspondances, groupes captures, position, et remplacement applique.'],
      ['Comparer', 'Le texte de travail confronte a un autre : lignes ajoutees, retirees, communes, premiere difference au caractere pres, comparaison mot a mot et format unifie.'],
      ['URL', 'Chaque partie d une URL, le service connu derriere le port, et l avertissement quand un domaine punycode ressemble a un autre.'],
      ['Adresse IP', 'Calcul complet d un sous-reseau IPv4 ou IPv6 : masque, joker, reseau, diffusion, plage utilisable, nom inverse, categorie (RFC 1918, 6598, 4193...) et test d appartenance a un prefixe. Plus le decoupage en sous-reseaux, le resume d une liste de prefixes, la conversion d une plage en prefixes et l enumeration des adresses.'],
      ['Reference', 'Hors ligne : 62 codes de statut, 9 methodes et leurs proprietes, 129 entetes HTTP, 70 types de media, 83 ports, 31 suites TLS avec leur solidite, 16 codes de fermeture WebSocket, 14 erreurs HTTP/2 et 27 codes d erreur reseau de Firefox. Champ de recherche sur le nom comme sur la description.'],
      ['Generer', 'UUID v3, v4, v5 et v7, ULID, NanoID, suites aleatoires, mots de passe avec leur entropie reelle, adresse materielle, adresse privee, port dynamique, et seize valeurs limites qui font tomber les validateurs mal ecrits.'],
      ['Importer une requete', 'Une commande cURL ou une requete HTTP brute devient une ligne du tableau, a l etat « pending ». Elle n est pas emise : l onglet « Rejouer » de son detail s en charge si vous le demandez.']
    ]
  },
  {
    h: 'Ce qui est capture',
    p: ['Plusieurs couches observent le trafic en parallele, puis un correlateur les fusionne.'],
    table: [
      ['webRequest', 'Les 9 evenements du cycle de vie reseau, sur toutes les URL.'],
      ['StreamFilter', 'Le corps integral des reponses. Le flux est reecrit a l identique vers la page : la capture ne peut pas casser un site.'],
      ['Sondes de page', 'fetch, XHR, sendBeacon, trames WebSocket, messages SSE, piles JavaScript, Service Workers, WebRTC.'],
      ['PerformanceObserver', 'Chronometrage precis, protocole reel, tailles, Server-Timing. Voit meme le cache memoire.'],
      ['TLS et DNS', 'Version, suite, chaine de certificats complete ; nom canonique et adresses.'],
      ['Proxy', 'Decision de routage. Facultatif, desactive par defaut.'],
      ['Classement Firefox', 'Le verdict de la protection contre le pistage du navigateur lui-meme, distinct de notre propre liste.'],
      ['Cookies JavaScript', 'L ecriture de document.cookie, avec la pile d appel qui l a provoquee.'],
      ['WebTransport', 'Sessions HTTP/3, si l API existe dans ce Firefox.'],
      ['Perception de page', 'Premier affichage, plus grand element affiche, decalages de mise en page, taches longues.']
    ]
  },
  {
    h: 'Pourquoi il n y a jamais de doublon',
    p: [
      'Trois couches peuvent voir la meme requete : webRequest, les sondes de page et PerformanceObserver. Sans correlation, une ligne apparaitrait par couche.',
      'webRequest fait autorite : son requestId est unique, redirections comprises. Une observation venue ' +
      'd une autre couche ne rejoint une ligne que si cette couche n y a pas deja contribue. Une observation ' +
      'qui ne trouve pas sa place devient sa propre ligne : rien n est jamais perdu.',
      'La colonne Couches montre qui a alimente chaque ligne : WR webRequest, JS sondes de page, PF performance, TLS, PX proxy.'
    ]
  },
  {
    h: 'Analyse automatique : uniquement des failles demontrables',
    p: ['Chaque requete terminee est auditee sans aucune action de votre part. Une seule regle gouverne cette liste : une alerte ne sort que si elle est DEMONTRABLE a partir de ce qui a ete capture, et si elle correspond a une faille reellement exploitable. Chaque alerte affiche sa preuve — le fait observe qui la justifie.'],
    ul: [
      'Secret expose : 61 formats proprietaires (AWS, GitHub, GitLab, Stripe, Slack, npm, Datadog, cles privees PEM...). Ces formats ne se confondent avec rien.',
      'Identifiants ecrits dans l URL, ou jeton passe en query string : la valeur finit dans les journaux, l historique et l entete Referer.',
      'Jeton JWT signe avec « alg: none » : sa charge utile se modifie sans cle.',
      'Envoi en clair : http avec un cookie, un entete Authorization ou un corps — donc interceptable et modifiable.',
      'Contenu mixte, certificat non fiable, domaine non concordant, certificat expire, TLS 1.0 ou 1.1, suite de chiffrement cassee.',
      'CORS exploitable : origine renvoyee en miroir, ou « null », avec Allow-Credentials — n importe quel site lit alors la reponse authentifiee.',
      'Cookies : pose en clair sans Secure, prefixe __Host- ou __Secure- non respecte, SameSite=None sans Secure — cas ou le navigateur rejette le cookie.',
      'Vos propres motifs : Reglages -> Analyse -> Motifs de secret personnels.'
    ]
  },
  {
    h: 'Exports',
    table: [
      ['HAR 1.2', 'Relu par les outils de developpement de Firefox, Charles, Fiddler, Postman. Enrichi des couches, du TLS, des piles et des alertes.'],
      ['JSON', 'Enregistrements complets et statistiques du noyau.'],
      ['CSV', 'Tableau pour analyse externe, en UTF-8 avec BOM.'],
      ['Markdown', 'Rapport d alertes classe par gravite.'],
      ['Script cURL', 'Toutes les requetes filtrees, pretes a rejouer en ligne de commande.'],
      ['Collection Postman', 'Format v2.1, groupee par domaine, avec les reponses reellement observees.'],
      ['Liste d URL', 'Un fichier texte, une URL par ligne.'],
      ['Import HAR', 'Relire ici une capture faite ailleurs. Un HAR exporte par INTERCEPTOR est restaure a l identique.']
    ],
    p: ['Par requete, le menu « Copier » produit cURL, wget, HTTPie, fetch, Node, Python, PowerShell, la requete ou la reponse HTTP brute, une fiche Markdown ou l enregistrement JSON complet.']
  },
  {
    h: 'Modifier le trafic : regles et rejeu',
    p: [
      'Par defaut, INTERCEPTOR observe sans jamais rien modifier ni emettre.',
      'La vue Regles permet de bloquer, de rediriger (avec groupes captures $1..$9), de forcer le HTTPS, ' +
      'de reecrire des entetes, et de simuler une reponse. Lors d une simulation, le corps reel du serveur ' +
      'reste enregistre : la page recoit le contenu simule, vous voyez les deux. Le code de statut d origine ' +
      'est conserve, Firefox ne permettant pas de le reecrire depuis une extension.',
      'L onglet Rejouer, dans le detail d une requete, renvoie une requete modifiable. Regles et rejeu sont ' +
      'desactives par defaut et demandent une confirmation explicite. A n utiliser que sur des cibles dont ' +
      'vous avez la responsabilite.'
    ]
  },
  {
    h: 'Limites reelles',
    p: ['Aucune extension Firefox ne peut les depasser. Rien n est contourne ici.'],
    ul: [
      'Pages privilegiees : about:config, about:addons, Nouvel onglet, pages d erreur. Toute extension y est interdite.',
      'Domaines reserves par Mozilla : accounts.firefox.com, addons.mozilla.org.',
      'Trafic hors Firefox : INTERCEPTOR observe le navigateur, pas le systeme.',
      'Requetes emises depuis un Worker : capturees, mais sans pile JavaScript.',
      'Flux de donnees WebRTC : la signalisation et les candidats sont journalises, pas le contenu des flux.',
      'Brotli : Firefox decode generalement avant le filtre ; gzip et deflate sont decompresses si besoin.'
    ]
  },
  {
    h: 'Securite de l extension',
    ul: [
      'Aucune sortie reseau, sauf deux actions volontaires : le test de couverture (vers l origine de l onglet actif) et le rejeu de requete.',
      'Aucun innerHTML sur des donnees capturees : un site observe ne peut rien injecter dans cette interface.',
      'Aucun eval, aucune chaine executee. CSP stricte sur les pages de l extension.',
      'Jeton aleatoire par document entre la page et l extension ; les commandes d interface exigent un expediteur interne.',
      'Moindre privilege : les permissions proxy et notifications sont facultatives et demandees au moment de leur activation.'
    ]
  },
  {
    h: 'Memoire et performances',
    p: [
      'Toutes les limites valent 0 = illimite par defaut. Sans plafond, tout reste en memoire vive : sur une ' +
      'session longue avec des flux volumineux, la consommation peut atteindre plusieurs gigaoctets.',
      'Le profil « Equilibre » des reglages pose des plafonds raisonnables en un clic.'
    ]
  }
];

export function render() {
  const pane = clear($('#view-help'));
  const box = el('div', { class: 'pane narrow help' });
  pane.appendChild(box);

  box.appendChild(el('h2', { text: lang() === 'en' ? 'INTERCEPTOR — user manual' : 'INTERCEPTOR — mode d emploi' }));
  box.appendChild(el('p', { text: lang() === 'en'
    ? 'Network supervision station for Firefox, created by NeoZ. This page holds everything you need to know: it works offline and always matches the installed version.'
    : 'Poste de supervision reseau pour Firefox, cree par NeoZ. Cette page contient tout ce qu il faut savoir : elle fonctionne hors ligne et suit exactement la version installee.' }));

  const sections = lang() === 'en' ? SECTIONS_EN : SECTIONS;
  for (const section of sections) {
    box.appendChild(el('h2', { text: section.h }));
    for (const p of section.p || []) box.appendChild(el('p', { text: p }));
    if (section.ul) {
      const ul = el('ul');
      for (const li of section.ul) ul.appendChild(el('li', { text: li }));
      box.appendChild(ul);
    }
    if (section.table) box.appendChild(table(['', ''], section.table));
  }

  /* Syntaxe de recherche : construite depuis le code, donc toujours exacte. */
  box.appendChild(el('h2', { text: lang() === 'en' ? 'Search syntax' : 'Syntaxe de recherche' }));
  box.appendChild(el('p', { text:
    'Ecrivez du texte libre, ou combinez les criteres ci-dessous. Prefixez par un tiret pour exclure : ' +
    '« -image ». Encadrez de guillemets pour chercher une expression avec des espaces. Une expression ' +
    'reguliere s ecrit entre deux barres obliques : /\\/api\\/v[0-9]+\\//.' }));
  box.appendChild(table(lang() === 'en' ? ['Criterion', 'Meaning'] : ['Critere', 'Signification'],
    fieldHelp().map(f => [
      f.name + ':' + (f.kind === 'num' ? '>100' : f.kind === 'bool' ? 'oui' : 'valeur'),
      f.help + (f.kind === 'num' ? '  (comparaisons > >= < <= =)' : '')
    ])));
  box.appendChild(el('p', { text:
    'La case « corps » a cote de la recherche delegue le travail au noyau : il cherche aussi dans les corps, ' +
    'les entetes, les trames WebSocket, les messages SSE et les piles JavaScript. Les corps ne transitent ' +
    'jamais en masse vers l interface, seuls les identifiants correspondants reviennent.' }));

  box.appendChild(el('h2', { text: lang() === 'en' ? 'Permanent installation' : 'Installation permanente' }));
  box.appendChild(el('p', { text:
    'Un chargement temporaire (about:debugging) disparait a la fermeture de Firefox. Pour une installation ' +
    'durable il faut un paquet .xpi signe par Mozilla, ou Firefox Developer Edition / Nightly avec ' +
    'xpinstall.signatures.required = false dans about:config.' }));

  const about = el('p', { class: 'note' });
  box.appendChild(about);
  cmd('about', {}).then(res => {
    if (res && !res.error) {
      about.textContent = 'Version ' + res.version + ' — ' + res.author + ' — console : ' + res.consoleUrl;
    }
  });

  box.appendChild(el('div', { class: 'actions' }, [
    el('button', {
      class: 'btn', type: 'button',
      on: { click: () => { navigator.clipboard.writeText(location.href).then(() => toast('Adresse de la console copiee'), () => {}); } }
    }, 'Copier l adresse de cette console')
  ]));
}

function table(head, rows) {
  const t = el('table');
  if (head && head.some(Boolean)) {
    const tr = el('tr');
    for (const h of head) tr.appendChild(el('th', { text: h }));
    t.appendChild(tr);
  }
  for (const row of rows) {
    const tr = el('tr');
    for (const cell of row) tr.appendChild(el('td', { text: cell }));
    t.appendChild(tr);
  }
  return t;
}
