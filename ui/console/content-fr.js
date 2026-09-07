/* Contenu francais du tutoriel — INTERCEPTOR (by D4RK)
 *
 * Douze lecons. Chaque lecon peut proposer des boutons qui font reellement
 * l action decrite, et des verifications qui lisent l etat reel de la capture.
 * La version anglaise vit dans content-en.js.
 */
import { $ } from '../lib/dom.js';
import { state, toast } from '../app.js';
import { poser } from './tools.js';

const go = (view, query) =>
  document.dispatchEvent(new CustomEvent('ic:goto', { detail: { view, query } }));

const stats = () => state.stats || null;
const seen = () => state.seen;

export const LESSONS = [
  {
    id: 'bienvenue',
    title: 'Bienvenue',
    goal: 'Comprendre ce que fait INTERCEPTOR',
    body: [
      { p: 'INTERCEPTOR observe tout ce que Firefox envoie et recoit : pages, images, appels d API, WebSocket, cookies, certificats. Il demarre seul et n a besoin d aucun reglage pour fonctionner.' },
      { p: 'Six couches de capture regardent le trafic en meme temps, et un correlateur les recolle : une vraie requete donne toujours une seule ligne, jamais deux.' },
      { ul: [
        'La **console** (cette page) est le poste de travail complet.',
        'Le **panneau lateral** suit le trafic pendant que vous naviguez : Alt+Shift+S.',
        'La **fenetre compacte** (clic sur l icone) sert au coup d oeil rapide.'
      ] },
      { p: 'Le bouton vert en haut a gauche indique que la capture tourne. Cliquez dessus pour mettre en pause, recliquez pour reprendre.' }
    ],
    actions: [
      ['Mettre en pause / reprendre', () => $('#capture').click()],
      ['Ouvrir le panneau lateral', async () => {
        try { await (typeof browser !== 'undefined' ? browser : chrome).sidebarAction.open(); }
        catch { toast('Utilisez Alt+Shift+S', false); }
      }]
    ],
    checks: [
      ['La capture est en cours', () => !!(stats() && stats().capturing)],
      ['Au moins une requete a ete enregistree', () => !!(stats() && stats().store.total > 0)]
    ]
  },

  {
    id: 'tableau',
    title: 'Lire le tableau',
    goal: 'Savoir ce que chaque colonne raconte',
    body: [
      { p: 'Ouvrez un site dans un autre onglet, puis revenez ici : les lignes arrivent en direct. Le tableau n a aucune limite d affichage, meme avec des centaines de milliers de lignes.' },
      { ul: [
        'La **barre de couleur** a gauche donne le niveau de risque trouve par l analyse.',
        'La colonne **Couches** montre qui a vu la requete : WR webRequest, JS sondes de page, PF performance, TLS, PX proxy.',
        'Un clic sur un **en-tete de colonne** trie ; un second clic inverse l ordre.',
        'Le bouton **Colonnes** en propose une trentaine : ajoutez « Serveur », « Protocole » ou « Marqueurs ».',
        'Le bouton **Suivre** colle la vue aux dernieres requetes ; il se fige des que vous remontez.'
      ] },
      { p: 'Ctrl+clic ajoute une ligne a la selection, Maj+clic selectionne une plage. Les exports et la suppression portent alors sur la selection.' }
    ],
    actions: [
      ['Aller au tableau', () => go('requests')],
      ['Ouvrir le choix des colonnes', () => { go('requests'); setTimeout(() => $('#columns').click(), 60); }],
      ['Activer / figer le suivi', () => { go('requests'); setTimeout(() => $('#follow').click(), 60); }]
    ],
    checks: [
      ['Au moins dix requetes capturees', () => !!(stats() && stats().store.total >= 10)],
      ['Vous avez trie une colonne', () => seen().sort],
      ['Vous avez selectionne au moins une ligne', () => seen().selection]
    ]
  },

  {
    id: 'filtrer',
    title: 'Filtrer et chercher',
    goal: 'Retrouver une requete parmi des milliers',
    body: [
      { p: 'La barre de recherche accepte du texte libre, mais surtout des criteres precis. Tapez, la liste se reduit instantanement.' },
      { code: 'method:POST          les requetes POST\nstatus:>=400         tout ce qui echoue\nhost:api.exemple.com un domaine precis\nsize:>100000         les grosses reponses\nduration:>1000       les requetes lentes\ntag:tracker          ce que l analyse a marque\n-image               exclure les images\n/\\/v[0-9]+\\//        expression reguliere' },
      { p: 'Les puces sous la barre d outils sont des filtres d un clic : API, Pages, Erreurs, Alertes, Tiers, Flux, Epinglees…' },
      { p: 'La case **corps** confie la recherche au noyau : il cherche alors dans les corps, les entetes, les trames WebSocket et les piles JavaScript. Les corps ne remontent jamais en masse vers l interface.' }
    ],
    actions: [
      ['Essayer status:>=400', () => go('requests', 'status:>=400')],
      ['Essayer method:POST', () => go('requests', 'method:POST')],
      ['Voir toute la syntaxe', () => go('help')],
      ['Effacer le filtre', () => go('requests', '')]
    ],
    checks: [
      ['Vous avez utilise un filtre', () => seen().filter],
      ['Vous avez essaye une facette', () => seen().facet]
    ]
  },

  {
    id: 'detail',
    title: 'Le detail d une requete',
    goal: 'Tout voir d une seule requete',
    body: [
      { p: 'Cliquez sur une ligne : le panneau du bas s ouvre avec douze onglets. Vous pouvez le redimensionner en tirant la barre grise, et passer d une requete a l autre avec les fleches haut et bas.' },
      { ul: [
        '**Resume** : methode, statut, serveur, DNS, TLS, contexte, couches, regles appliquees.',
        '**En-tetes** : parametres d URL, entetes envoyees et recues, cliquables pour copier.',
        '**Requete** / **Reponse** : le corps complet, mis en forme ou brut, apercu hexadecimal, image affichee.',
        '**Cookies** : Set-Cookie decortique, mutations observees, cookies du domaine.',
        '**Securite** : version TLS, suite, chaine de certificats entiere.',
        '**Alertes** : ce que l analyse a trouve, avec la valeur masquee.',
        '**Flux** : trames WebSocket et messages SSE.',
        '**Chronologie** : DNS, connexion, TLS, attente, reception, redirections.',
        '**Pile JS** : la ligne de code qui a declenche la requete.',
        '**Rejouer** : renvoyer la requete apres modification.',
        '**Brut** : l enregistrement complet, champ par champ.'
      ] },
      { p: 'Le menu **Copier** produit la requete en cURL, wget, HTTPie, fetch, Node, Python, PowerShell, HTTP brut, Markdown ou JSON.' }
    ],
    actions: [
      ['Ouvrir la premiere ligne', () => {
        go('requests');
        setTimeout(() => {
          const row = document.querySelector('.trow');
          if (row) row.click();
          else toast('Naviguez d abord sur un site pour avoir des lignes', false);
        }, 80);
      }]
    ],
    checks: [
      ['Vous avez ouvert le detail d une requete', () => seen().detail],
      ['Vous avez consulte plusieurs onglets du detail', () => seen().tabs >= 3]
    ]
  },

  {
    id: 'securite',
    title: 'Les alertes de securite',
    goal: 'Lire ce que l analyse trouve toute seule',
    body: [
      { p: 'Chaque requete terminee est auditee automatiquement : cles d API, jetons, mots de passe, e-mails, cartes bancaires validees par la cle de Luhn, HTTP en clair, certificats douteux, entetes de securite absents, CORS trop permissif, cookies de session mal proteges, pisteurs.' },
      { p: 'Les valeurs sensibles sont **masquees** par defaut : une cle apparait sous la forme « sk_liv…C0 (32 car.) ». Le masquage se coupe dans les reglages si vous devez voir la valeur entiere.' },
      { p: 'La vue Securite regroupe tout, classe par gravite. Un clic sur une alerte ouvre la requete concernee.' },
      { p: 'Vous pouvez ajouter **vos propres motifs** de secret et **vos propres domaines** de pistage dans les reglages : le format est « Nom = expression reguliere = severite ».' }
    ],
    actions: [
      ['Ouvrir la vue Securite', () => go('alerts')],
      ['Ne garder que les alertes', () => go('requests', 'risk:critical')],
      ['Regler l analyse', () => go('settings')]
    ],
    checks: [
      ['Vous avez ouvert la vue Securite', () => seen().views.has('alerts')],
      ['L analyse a tourne sur vos requetes', () => !!(stats() && stats().analyzer.analyzed > 0)]
    ]
  },

  {
    id: 'flux',
    title: 'Flux, cookies et journaux',
    goal: 'Voir ce que le reseau seul ne montre pas',
    body: [
      { p: '**Flux temps reel** suit les WebSocket et les Server-Sent Events message par message, dans les deux sens. webRequest ne voit que la poignee de main : le contenu vient des sondes posees dans la page.' },
      { p: '**Cookies** journalise chaque pose, modification et suppression, y compris les cookies ecrits en JavaScript, avec la pile d appel qui les a poses.' },
      { p: '**Navigation** liste les huit evenements de navigation de Firefox. **Contexte** rassemble les Workers, Service Workers, WebRTC, WebTransport et les mesures de perception de page (premier affichage, plus grand element, decalages).' }
    ],
    actions: [
      ['Ouvrir Flux temps reel', () => go('streams')],
      ['Ouvrir le journal des cookies', () => go('cookies')],
      ['Ouvrir le journal de contexte', () => go('context')]
    ],
    checks: [
      ['Vous avez ouvert Flux temps reel', () => seen().views.has('streams')],
      ['Vous avez ouvert un journal', () => seen().views.has('cookies') || seen().views.has('navigation') || seen().views.has('context')]
    ]
  },

  {
    id: 'synthese',
    title: 'La synthese chiffree',
    goal: 'Prendre du recul sur une session entiere',
    body: [
      { p: 'La vue **Synthese** agrege la capture courante : repartition des statuts et des types, domaines les plus lourds, requetes les plus lentes, part des requetes tierces, volume echange, debit dans le temps.' },
      { p: 'Tous les chiffres viennent des enregistrements reels du perimetre choisi. Changez le perimetre en haut a droite pour comparer un onglet et l ensemble de Firefox.' }
    ],
    actions: [
      ['Ouvrir la synthese', () => go('summary')],
      ['Ouvrir le diagnostic', () => go('stats')]
    ],
    checks: [
      ['Vous avez ouvert la synthese', () => seen().views.has('summary')]
    ]
  },

  {
    id: 'exporter',
    title: 'Exporter et comparer',
    goal: 'Sortir les donnees et confronter deux requetes',
    body: [
      { ul: [
        '**HAR 1.2** : relu par les outils de developpement, Charles, Fiddler, Postman.',
        '**JSON complet** : tout, y compris nos extensions.',
        '**CSV** : pour un tableur.',
        '**Rapport d alertes** en Markdown.',
        '**Script cURL** : toutes les requetes filtrees, pretes a rejouer.',
        '**Collection Postman** : groupee par domaine, avec les reponses observees.',
        '**Liste d URL** : un fichier texte.'
      ] },
      { p: 'L export porte sur les lignes filtrees, ou sur votre selection si vous en avez une. Le fichier est ecrit par le noyau : fermer la fenetre n interrompt rien.' },
      { p: 'Selectionnez exactement **deux** lignes (Ctrl+clic) puis cliquez sur **Comparer** : les differences d entetes et de corps apparaissent cote a cote.' },
      { p: 'Vous pouvez aussi **importer un HAR** capture ailleurs pour le relire ici.' }
    ],
    actions: [
      ['Ouvrir le menu Exporter', () => { go('requests'); setTimeout(() => $('#export').click(), 60); }],
      ['Importer un fichier HAR', () => { go('settings'); toast('Reglages -> Sauvegarde -> Importer un HAR'); }]
    ],
    checks: [
      ['Vous avez exporte au moins un fichier', () => !!(stats() && stats().save.files > 0)]
    ]
  },

  {
    id: 'regler',
    title: 'Regler l outil',
    goal: 'Adapter la capture a votre machine et a votre besoin',
    body: [
      { p: 'Toutes les limites valent **0 = illimite** par defaut. Sans plafond, tout reste en memoire vive : sur une longue session avec des flux volumineux, la consommation peut atteindre plusieurs gigaoctets.' },
      { ul: [
        '**Maximum** : tout capturer, aucune limite.',
        '**Equilibre** : tout observer, mais plafonner la memoire. Le meilleur compromis au quotidien.',
        '**Leger** : sessions tres longues, machine modeste.',
        '**Observation discrete** : metadonnees seules, aucun contenu conserve.'
      ] },
      { p: 'Chaque couche de capture s active independamment, et la vue Diagnostic montre pour chacune le reglage ET la disponibilite reelle de l API dans votre Firefox.' },
      { p: 'La **langue** (francais ou anglais), le **mode simple**, le theme, la densite, la taille du texte, le contraste, le format de l heure, le comportement du clic sur l icone et le compteur du badge se reglent aussi la.' },
      { p: 'Le **mode simple** ne garde que Requetes, Securite, Synthese, Reglages, Tutoriel et Aide : de quoi travailler sans jamais se perdre. Les vues avancees reviennent en le desactivant.' }
    ],
    actions: [
      ['Ouvrir les reglages', () => go('settings')],
      ['Voir l etat des couches', () => go('stats')]
    ],
    checks: [
      ['Vous avez ouvert les reglages', () => seen().views.has('settings')],
      ['Vous avez ouvert le diagnostic', () => seen().views.has('stats')]
    ]
  },

  {
    id: 'intervenir',
    title: 'Modifier le trafic',
    goal: 'Bloquer, rediriger, simuler, rejouer — en connaissance de cause',
    body: [
      { p: 'Par defaut INTERCEPTOR **observe sans jamais rien modifier**. Deux mecanismes peuvent changer cela, tous deux desactives au depart.' },
      { ul: [
        'Le **moteur de regles** : bloquer une requete, rediriger vers une autre URL, forcer le HTTPS, reecrire des entetes, ou **simuler une reponse** (le corps reel reste enregistre).',
        'Le **rejeu** : renvoyer une requete apres avoir modifie la methode, l URL, les entetes ou le corps.'
      ] },
      { p: 'Les regles se construisent avec des champs et des boutons, sans ecrire de JSON. Cinq modeles sont fournis. La regle decrit toujours en clair ce qu elle fera, sous la forme « Si … alors … ».' },
      { p: 'A n utiliser que sur des cibles dont vous avez la responsabilite.' }
    ],
    actions: [
      ['Ouvrir l editeur de regles', () => go('rules')],
      ['Comprendre le rejeu', () => go('help')]
    ],
    checks: [
      ['Vous avez ouvert l editeur de regles', () => seen().views.has('rules')]
    ]
  },

  {
    id: 'outils',
    title: 'La boite a outils',
    goal: 'Decoder, verifier et fabriquer une valeur, sans rien envoyer',
    body: [
      { p: 'Un seul **texte de travail**, vingt et un onglets qui le regardent. On colle une valeur une fois — depuis le presse-papiers, depuis le menu contextuel d une ligne, ou depuis le bouton « Boite a outils » d un corps de reponse — et chaque outil travaille dessus.' },
      { p: 'Tout se calcule dans la page. Aucun de ces outils n emet la moindre requete : ni au chargement, ni au clic.' },
      { ul: [
        '**Transformer** : 121 transformations. « Tout essayer » applique chaque decodage et ne garde que les resultats lisibles — c est la bonne premiere action sur une valeur inconnue.',
        '**JWT** : entete, charge utile, expiration, et la signature reellement verifiee si vous fournissez la cle (douze algorithmes, cle partagee ou cle publique).',
        '**Chiffrement** et **Empreintes** : AES, PBKDF2, HKDF, MD5, SHA, CRC-32, HMAC.',
        '**Binaire** : Protocol Buffers, MessagePack, CBOR, certificats X.509, jeux de caracteres.',
        '**Entetes**, **URL**, **Adresse IP** : ce que la valeur dit vraiment, et ce qui lui manque.',
        '**Reference** : statuts, entetes, types de media, ports, suites TLS — hors ligne.'
      ] },
      { p: 'Un resultat se reprend comme entree d un autre outil : on enchaine les etapes sans jamais recopier a la main.' }
    ],
    actions: [
      ['Ouvrir la boite a outils', () => go('tools')],
      ['Y poser une valeur d essai', () => {
        poser('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJkNHJrIiwiaWF0IjoxNTE2MjM5MDIyfQ.abc');
        toast('Jeton pose : ouvrez l onglet JWT');
      }]
    ],
    checks: [
      ['Vous avez ouvert la boite a outils', () => seen().views.has('tools')]
    ]
  },

  {
    id: 'limites',
    title: 'Verifier et connaitre les limites',
    goal: 'Savoir ce qui est capture, et ce qui ne peut pas l etre',
    body: [
      { p: 'Le **test de couverture** du Diagnostic declenche de vraies requetes depuis l onglet actif, vers sa propre origine uniquement : fetch, POST avec corps, XHR, image, sendBeacon, EventSource, WebSocket, balise script. Il compte ensuite les lignes apparues.' },
      { p: 'Ce qu aucune extension Firefox ne peut faire, et qu INTERCEPTOR ne pretend donc pas faire :' },
      { ul: [
        'Les pages privilegiees : about:config, about:addons, Nouvel onglet, pages d erreur.',
        'Les domaines reserves par Mozilla : accounts.firefox.com, addons.mozilla.org.',
        'Le trafic hors Firefox : c est le navigateur qui est observe, pas le systeme.',
        'La pile JavaScript des requetes emises depuis un Worker.',
        'Le contenu des flux de donnees WebRTC (la signalisation, elle, est journalisee).',
        'Brotli : Firefox decode le plus souvent avant nous ; gzip et deflate sont decompresses.'
      ] },
      { p: 'Vous savez tout. L aide reste disponible a tout moment, et ce tutoriel peut etre relance depuis les reglages.' }
    ],
    actions: [
      ['Lancer le test de couverture', () => { go('stats'); toast('Cliquez sur « Lancer le test » dans Verification de couverture'); }],
      ['Ouvrir l aide complete', () => go('help')]
    ],
    checks: [
      ['Une verification de couverture a ete lancee', () => !!(stats() && stats().probe.runs > 0)]
    ]
  }
];
