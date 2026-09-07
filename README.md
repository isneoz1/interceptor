<div align="center">

<img src="icons/icon.svg" width="96" alt="INTERCEPTOR">

# INTERCEPTOR

**Poste de supervision réseau complet pour Firefox.**
Tout le trafic du navigateur, capturé sans doublon, expliqué en clair, et modifiable à la demande.

Créé par **D4RK**

![Firefox 115+](https://img.shields.io/badge/Firefox-115%2B-FF6611?style=flat-square&logo=firefoxbrowser&logoColor=white)
![Manifest V2](https://img.shields.io/badge/Manifest-V2-444?style=flat-square)
![Licence MIT](https://img.shields.io/badge/Licence-MIT-00DDFF?style=flat-square)
![Sans dépendance](https://img.shields.io/badge/D%C3%A9pendances-aucune-2ea043?style=flat-square)
![641 vérifications](https://img.shields.io/badge/Tests-641%20v%C3%A9rifications-2ea043?style=flat-square)
![Français et anglais](https://img.shields.io/badge/Langues-FR%20%2F%20EN-444?style=flat-square)

</div>

---

## Sommaire

1. [Ce que c'est](#1-ce-que-cest)
2. [Aperçu en images](#2-aperçu-en-images)
3. [Installation](#3-installation)
4. [Comment ça marche : les couches de capture](#4-comment-ça-marche--les-couches-de-capture)
5. [Une requête = une ligne : le corrélateur](#5-une-requête--une-ligne--le-corrélateur)
6. [Les surfaces : popup, panneau, console](#6-les-surfaces--popup-panneau-console)
7. [Les vues, une par une](#7-les-vues-une-par-une)
8. [Le panneau de détail : douze onglets](#8-le-panneau-de-détail--douze-onglets)
9. [La recherche : syntaxe complète](#9-la-recherche--syntaxe-complète)
10. [L'analyseur de sécurité](#10-lanalyseur-de-sécurité)
11. [La boîte à outils : 23 familles](#11-la-boîte-à-outils--23-familles)
12. [Agir sur le trafic : règles et interception](#12-agir-sur-le-trafic--règles-et-interception)
13. [Rejouer une requête](#13-rejouer-une-requête)
14. [Importer et exporter](#14-importer-et-exporter)
15. [Réglages](#15-réglages)
16. [Raccourcis clavier](#16-raccourcis-clavier)
17. [Vie privée : ce qui sort de la machine](#17-vie-privée--ce-qui-sort-de-la-machine)
18. [Architecture du code](#18-architecture-du-code)
19. [Tests](#19-tests)
20. [Construire le paquet](#20-construire-le-paquet)
21. [Contribuer](#21-contribuer)
22. [Licence](#22-licence)

---

## 1. Ce que c'est

INTERCEPTOR est une extension Firefox qui observe **tout** ce que le navigateur envoie et
reçoit, puis vous donne les moyens de le comprendre et d'agir dessus.

Les outils réseau intégrés au navigateur montrent les requêtes. INTERCEPTOR va plus loin
sur quatre points précis :

| | Ce que fait INTERCEPTOR |
|---|---|
| **Il ne rate rien** | Sept couches de capture tournent en parallèle : `webRequest`, corps de réponse par `StreamFilter`, sondes de page (`fetch`, `XHR`, WebSocket, SSE, Beacon, WebRTC), `PerformanceObserver`, TLS, cookies, navigation. Ce que l'une manque, une autre le voit. |
| **Il ne compte pas deux fois** | Un corrélateur apparie les observations des différentes couches. Une requête réelle donne **une** ligne, même vue par cinq couches. Deux `GET` identiques en polling restent deux lignes. |
| **Il explique** | 62 codes de statut, 129 en-têtes, 70 types de média, 83 ports, 31 suites TLS, les alertes TLS, les erreurs QUIC et HTTP/3, les types DNS : tout est décrit en français, hors ligne, dans l'outil. |
| **Il ne devine pas** | L'analyseur de sécurité ne signale que ce qui est **démontrable** à partir de la capture. Chaque alerte porte sa preuve. Un en-tête de durcissement manquant n'est pas une faille : il n'est pas signalé. |

**Ce que ce n'est pas** : ce n'est ni un proxy, ni un scanner de vulnérabilités, ni un
outil d'attaque. Tout se passe dans votre Firefox, sur votre machine.

**Chiffres** : 144 modules JavaScript, ~28 000 lignes, aucune dépendance externe,
641 vérifications automatisées, interface française et anglaise.

---

## 2. Aperçu en images

> Toutes les images ci-dessous sont des captures de l'outil réel. Elles sont produites par
> `node tools/captures.mjs`, qui rend la vraie console dans un Chromium sans interface,
> alimentée par un trafic passé dans le **vrai noyau** — même magasin, même analyseur,
> mêmes statistiques que dans Firefox.

### Le tableau des requêtes

Tout le trafic, une ligne par requête. Colonnes réglables, tri, facettes, défilement
virtualisé (le tableau reste fluide à des dizaines de milliers de lignes).

![Vue Requêtes](docs/images/console-requetes.png)

### La vue Sécurité

Ce que l'analyseur a pu **démontrer**, classé par gravité, avec pour chacun la preuve et
la requête d'origine.

![Vue Sécurité](docs/images/console-securite.png)

### Le détail d'une requête

Douze onglets couvrant l'intégralité de l'enregistrement, dont un onglet « Brut » qui
affiche l'objet complet : aucune donnée capturée ne peut échapper à l'affichage.

![Panneau de détail](docs/images/console-detail.png)

### Les en-têtes, lus et interprétés

Chaque en-tête est expliqué. La politique **CSP** est décomposée directive par directive,
avec en clair ce qu'elle laisse passer. La **fraîcheur de cache** est recalculée selon les
formules de la RFC 9111, à partir des en-têtes reçus et des horodatages mesurés.

![Onglet En-têtes](docs/images/console-entetes.png)

### La synthèse chiffrée

Les chiffres d'ensemble du périmètre observé : statuts, types, domaines par volume et par
nombre, protocoles réels, couches de capture actives.

![Vue Synthèse](docs/images/console-synthese.png)

### Sites et chemins

Ce qui existe sur les sites visités, hôte par hôte, reconstruit à partir du trafic observé.

![Vue Sites et chemins](docs/images/console-sites.png)

### La boîte à outils

125 transformations réparties en 23 familles : décoder, hacher, mesurer, inspecter — tout
se calcule en local, rien ne sort.

![Boîte à outils](docs/images/console-outils.png)

### Les règles

Bloquer, rediriger, forcer HTTPS, réécrire des en-têtes, simuler une réponse, injecter de
la latence, remplacer un motif dans un corps.

![Vue Règles](docs/images/console-regles.png)

### L'état du système

Ce que chaque couche capture réellement, et les chiffres du noyau.

![Vue État du système](docs/images/console-etat.png)

### Les réglages

Toutes les options, et quatre profils tout prêts.

![Vue Réglages](docs/images/console-reglages.png)

### L'aide intégrée

Le mode d'emploi complet, hors ligne, dans l'extension.

![Vue Aide](docs/images/console-aide.png)

---

## 3. Installation

### A. Chargement temporaire (le plus simple, pour essayer)

1. Ouvrez `about:debugging#/runtime/this-firefox` dans Firefox.
2. Cliquez **Charger un module complémentaire temporaire…**.
3. Choisissez le fichier `manifest.json` à la racine du dépôt.

La capture démarre immédiatement, sans aucun réglage. L'extension disparaît au
redémarrage de Firefox (c'est le principe du chargement temporaire).

### B. Paquet `.xpi`

```powershell
.\build.ps1
```

Le paquet est écrit dans `dist/interceptor-<version>.xpi`. Firefox n'installe un `.xpi`
non signé que sur les versions **Developer Edition**, **Nightly** ou **ESR**, après avoir
mis `xpinstall.signatures.required` à `false` dans `about:config`. Sur un Firefox
standard, utilisez le chargement temporaire ci-dessus.

### C. Premier lancement

Rien à configurer. Au premier démarrage, la console s'ouvre sur l'aide. Ensuite :

- **Ctrl+Shift+Y** — la fenêtre compacte
- **Alt+Shift+S** — le panneau latéral
- **Alt+Shift+I** — la console complète dans un onglet
- **Ctrl+Shift+U** — pause / reprise de la capture, même hors de la console

### Permissions demandées, et pourquoi

| Permission | À quoi elle sert |
|---|---|
| `<all_urls>`, `webRequest`, `webRequestBlocking` | Voir et, si vous l'activez, modifier les requêtes |
| `webNavigation` | Savoir quelle page est à l'origine de quelle requête |
| `cookies` | Journaliser chaque cookie posé, modifié ou supprimé |
| `dns` | Résoudre les noms pour afficher l'adresse réelle contactée |
| `storage`, `unlimitedStorage` | Conserver vos réglages, et la session si vous activez la persistance |
| `downloads` | Écrire les fichiers d'export sur le disque |
| `clipboardWrite` | Les boutons « Copier » |
| `contextMenus` | Les entrées du menu contextuel |
| `proxy`, `notifications` | **Optionnelles** : demandées seulement si vous activez ces fonctions |

---

## 4. Comment ça marche : les couches de capture

Le noyau (`background/`) démarre sept couches dans l'ordre du cycle de vie d'une requête.
Chacune voit quelque chose que les autres ne voient pas.

```
   ┌─ proxy ─────────── le plus précoce (optionnel, passif)
   │
   ├─ webRequest ────── 9 événements : onBeforeRequest → onCompleted / onErrorOccurred
   │   ├─ StreamFilter ─ le corps de la réponse, tel qu'il arrive sur le fil
   │   ├─ securityInfo ─ certificat, version TLS, suite de chiffrement
   │   └─ dns.resolve ── nom canonique et adresses réelles
   │
   ├─ navigation ────── contexte de page : quel document, quel cadre
   │
   ├─ cookies ───────── mutations de cookies, y compris celles faites en JavaScript
   │
   └─ sondes de page ── injectées dans la page (content/hooks.js) :
       fetch, XMLHttpRequest, WebSocket, EventSource (SSE), sendBeacon,
       WebRTC, Service Workers, PerformanceObserver, piles d'appel JS
```

**Pourquoi plusieurs couches ?** Parce qu'aucune ne suffit :

- `webRequest` ne donne pas le corps de la réponse → `StreamFilter` le donne.
- `webRequest` ne voit pas une requête servie par le cache ou par un Service Worker →
  `PerformanceObserver` la voit.
- `webRequest` ne dit pas *quelle ligne de JavaScript* a déclenché l'appel → la sonde de
  page capture la pile.
- Les trames WebSocket individuelles ne passent pas par `webRequest` → la sonde les lit.

Chaque couche s'active et se désactive indépendamment dans les réglages, et la vue
**État du système** montre en direct ce que chacune capture réellement.

---

## 5. Une requête = une ligne : le corrélateur

C'est le cœur du projet, et le problème le plus difficile. Sept couches observent la même
requête ; il faut une seule ligne.

Le corrélateur (`background/core/dedup.js`) applique trois règles strictes :

1. **Deux observations de la même couche ne fusionnent jamais.**
   Deux `GET` identiques faits en boucle par du polling restent deux lignes distinctes.
   C'est ce que vous voulez voir.

2. **Une observation secondaire rejoint un enregistrement au plus une fois.**
   Appariement 1:1, en file d'attente. `webRequest` est la couche autoritaire ; les autres
   viennent s'y raccrocher, chacune une seule fois.

3. **Une observation orpheline devient sa propre ligne.**
   Si aucun parent n'est trouvé dans la fenêtre de corrélation, l'observation est promue en
   ligne autonome. **Rien n'est jamais perdu** — une requête de Service Worker, qui
   n'apparaît dans aucun événement `webRequest`, reste visible.

La signature d'appariement est `MÉTHODE + URL normalisée + onglet/cadre`. La normalisation
d'URL (minuscules, port par défaut retiré, segments `.` et `..` résolus) fait que
`HTTPS://A.FR:443/x/../y` et `https://a.fr/y` donnent la même clé.

Le compteur **Fusions** de la barre d'état indique combien d'observations ont été
appariées. La vue **État du système** détaille les couches, les orphelines promues et les
files d'attente.

---

## 6. Les surfaces : popup, panneau, console

La **même page** sert de popup, de panneau latéral, d'onglet plein écran et de page
d'options. La mise en page s'adapte à la largeur disponible, et l'échelle typographique se
recalcule pour rester lisible d'un panneau de 340 px à un écran de 4 000 px.

| Surface | Ouverture | Pour quoi |
|---|---|---|
| **Popup** | Clic sur l'icône | Coup d'œil rapide : compteurs, pause, accès à la console |
| **Panneau latéral** | `Alt+Shift+S` | Surveiller pendant qu'on navigue, la page reste visible |
| **Console plein écran** | `Alt+Shift+I` | Le poste de travail complet |
| **Page d'options** | Gestionnaire de modules | La même console |

Le comportement du clic sur l'icône se règle dans les réglages (popup, onglet, panneau ou
fenêtre détachée).

<div align="center"><img src="docs/images/popup.png" width="380" alt="Popup"></div>

---

## 7. Les vues, une par une

La barre latérale regroupe 17 vues en cinq familles. Le **mode simple** (réglages) masque
les vues avancées pour ne garder que l'essentiel.

### Trafic

| Vue | Ce qu'elle montre |
|---|---|
| **Requêtes** | Tout le trafic, requête par requête. Colonnes réglables, tri par n'importe quelle colonne, facettes rapides (API, pages, ressources, flux, erreurs, alertes, tiers, lentes…), sélection multiple, menu contextuel par ligne, annotation libre et marquage couleur. Le tableau est virtualisé : seules les lignes visibles sont dessinées. |
| **Sécurité** | Les alertes de l'analyseur, groupées par gravité, avec la preuve de chacune et un lien vers la requête. Export du rapport en Markdown. |
| **Synthèse** | Les chiffres d'ensemble : requêtes, domaines, volumes reçus et envoyés, durée médiane, erreurs, part de tierces, part chiffrée, cache, trames, cookies. Puis les répartitions : statuts, types de ressource, domaines par volume et par nombre, protocoles réels, types de contenu, couches de capture. |
| **Sites et chemins** | L'arborescence de ce qui existe sur chaque hôte visité, reconstruite à partir du trafic. Utile pour voir la surface réelle d'une application. |
| **Flux temps réel** | WebSocket et Server-Sent Events, message par message, avec le sens (entrant/sortant), l'horodatage et la charge utile. |
| **Comparaison** | Deux requêtes confrontées ligne à ligne : en-têtes, corps, minutage. Sélectionnez deux lignes et appuyez sur `C`. |

### Journaux

| Vue | Ce qu'elle montre |
|---|---|
| **Cookies** | Chaque cookie posé, modifié ou supprimé, avec la cause et tous ses attributs. |
| **Navigation** | Les changements de page et de cadre : début, validation, DOM prêt, fin, erreurs, changements d'historique. |
| **Workers et WebRTC** | Workers, Service Workers, connexions WebRTC et mesures de performance de page. |

### Outils

| Vue | Ce qu'elle montre |
|---|---|
| **Boîte à outils** | Voir la [section 11](#11-la-boîte-à-outils--23-familles). |

### Agir sur le trafic

| Vue | Ce qu'elle montre |
|---|---|
| **Règles** | Les règles d'interception automatique. Voir la [section 12](#12-agir-sur-le-trafic--règles-et-interception). |
| **Interception** | La file des requêtes suspendues, à modifier puis relâcher une par une. |

### Système

| Vue | Ce qu'elle montre |
|---|---|
| **État du système** | Ce que chaque couche capture réellement, les capacités détectées du navigateur, les compteurs du magasin, du corrélateur et de l'analyseur. C'est la vue à regarder quand quelque chose semble manquer. |
| **Journal interne** | Les erreurs d'INTERCEPTOR lui-même, et le journal de ses propres commandes. Exportable pour un rapport de bogue. |
| **Réglages** | Voir la [section 15](#15-réglages). |

### Apprendre

| Vue | Ce qu'elle montre |
|---|---|
| **Tutoriel** | Douze leçons pour prendre l'outil en main. Une leçon ne se coche que lorsque vous avez réellement fait le geste — jamais à votre place. |
| **Aide** | Le mode d'emploi complet, hors ligne. |

---

## 8. Le panneau de détail : douze onglets

Cliquez une ligne : le panneau s'ouvre en bas, redimensionnable. Les flèches ↑ ↓ passent à
la requête précédente ou suivante **dans l'ordre affiché**, filtres compris.

| Onglet | Contenu |
|---|---|
| **Résumé** | Identité (méthode, URL, statut avec son sens, type de média), réseau (IP, protocole réel, cache, tailles sur le fil, mesures de performance), contexte (onglet, fenêtre, cadre, document, origine, tierce partie, classement de pistage Firefox), et l'annotation libre. |
| **En-têtes** | Paramètres de l'URL, en-têtes envoyés, en-têtes reçus, en-têtes vus par le code JavaScript. Chaque en-tête connu est expliqué au survol. Puis deux analyses calculées : la **fraîcheur HTTP** (RFC 9111 : durée de fraîcheur, âge courant décomposé, temps restant, validateurs, `Vary`, directives) et la **politique CSP** (chaque directive avec son sens, puis en clair ce que la politique laisse passer). |
| **Requête** | Le corps envoyé : nature, source, type déclaré, encodage, compression. Mise en forme automatique du JSON, champs de formulaire décomposés, et **décodage des corps `multipart/form-data`** partie par partie (nom du champ, nom de fichier, type, contenu). |
| **Réponse** | Le corps reçu, avec les mêmes traitements, plus l'aperçu des images et le rendu hexadécimal du binaire. |
| **Cookies** | Les cookies posés et modifiés par cette requête, tous attributs détaillés. |
| **Sécurité** | Certificat, chaîne, version TLS, suite de chiffrement, confidentialité persistante, transparence des certificats. |
| **Alertes** | Les résultats de l'analyseur pour cette requête, avec la preuve de chacun. |
| **Flux** | Les trames WebSocket ou les messages SSE de cette connexion. |
| **Chronologie** | Chaque étape horodatée, de la première observation à la dernière. |
| **Pile JS** | La pile d'appel JavaScript qui a déclenché la requête, quand la sonde de page a pu la capturer. |
| **Rejouer** | Voir la [section 13](#13-rejouer-une-requête). |
| **Brut** | L'objet complet, tel qu'il est en mémoire. C'est le filet de sécurité : **aucune donnée capturée ne peut rester invisible**. Un test automatisé (`tests/detail-coverage.test.mjs`) vérifie que chacun des 60 champs d'un enregistrement est affiché quelque part. |

---

## 9. La recherche : syntaxe complète

Le champ de recherche accepte du texte libre, des expressions régulières entre `/`, et des
filtres par champ. Les termes se combinent par **ET**. Un `-` en tête **exclut**.

```
method:POST status:5xx host:api. size:>100000 -image /regex/
```

### Champs texte

`method:` `type:` `host:` `path:` `url:` `mime:` `scheme:` `proto:` `ip:` `tag:` `risk:`
`src:` `state:` `init:` `tls:` `error:` `classe:` `note:` `color:`

### Champs numériques

Acceptent `>`, `<`, `>=`, `<=`, `=` et les plages.

`status:` (accepte aussi `2xx` à `5xx`) `size:` `duration:` `tab:` `frame:` `id:`
`findings:` `redirects:` `ws:` `sse:` `cookies:` `wire:`

### Champs booléens

`flag:` (épinglées) `third:` (tierces) `cache:` (servies par le cache) `body:` (corps
capturé) `stack:` (pile JS présente) `private:` (navigation privée) `replayed:` (rejouées)
`imported:` (venues d'un HAR importé)

### Exemples

| Recherche | Ce qu'elle trouve |
|---|---|
| `status:5xx` | Toutes les erreurs serveur |
| `host:api. method:POST` | Les POST vers un hôte contenant « api. » |
| `size:>1000000` | Tout ce qui dépasse un mégaoctet |
| `duration:>3000 -image` | Les requêtes lentes, hors images |
| `risk:critical` | Les requêtes portant une alerte critique |
| `third:true cookies:>0` | Les tierces parties qui posent des cookies |
| `/\/api\/v[0-9]+\//` | Les chemins d'API versionnés, par expression régulière |
| `tag:cleartext` | Ce qui circule en clair |

La case **corps** étend la recherche aux corps, en-têtes, trames et piles.
Le bouton ★ enregistre le filtre courant et rappelle les recherches récentes.
La touche `?` à côté du champ ouvre l'aide complète de la syntaxe.

---

## 10. L'analyseur de sécurité

Une seule ligne de conduite : **une alerte ne sort que si elle est démontrable à partir de
ce qui a été capturé, et si elle correspond à une faille réellement exploitable.**
Chaque alerte porte sa preuve, en clair.

### Ce qui est signalé

| Règle | Gravité | Preuve |
|---|---|---|
| Identifiants écrits dans l'URL | critique | L'URL contient `utilisateur:motdepasse@` — le mot de passe est dans l'historique, les journaux et le `Referer` |
| Jeton passé en query string | élevée | Un paramètre nommé sans ambiguïté (`access_token`, `api_key`…) porte une valeur assez longue pour être un jeton |
| Jeton JWT non signé (`alg: none`) | critique | L'en-tête du jeton le déclare lui-même : sa charge utile se modifie sans clé |
| Données envoyées en clair (HTTP) | critique | Schéma `http` **et** quelque chose à voler : `Authorization`, cookie, ou corps de requête |
| Contenu mixte sur page HTTPS | élevée | La page est en `https`, la ressource en `http` : modifiable en chemin |
| Certificat non fiable / domaine non concordant | critique | Firefox rejette la chaîne de certification |
| Certificat expiré, TLS obsolète, suite cassée | élevée | Version ou suite lue dans `securityInfo` |
| CORS : origine en miroir avec credentials | critique | Le serveur renvoie l'`Origin` du client **et** `Allow-Credentials: true` |
| CORS : origine `null` avec credentials | élevée | Même mécanisme, avec l'origine `null` |
| Cookie posé en clair | élevée | Posé par une réponse `http` sans `Secure` : il repartira en clair |
| Préfixe `__Host-` / `__Secure-` non respecté | moyenne | Les règles du préfixe ne sont pas tenues : **le navigateur rejette le cookie** |
| `SameSite=None` sans `Secure` | moyenne | La combinaison est refusée par le navigateur |
| Secrets dans les corps et les en-têtes | variable | Une valeur au format propre à un fournisseur connu, qui ne se confond avec rien d'autre |

### Ce qui a été volontairement retiré, et pourquoi

- **« En-têtes de sécurité absents »** — un durcissement manquant n'est pas une faille,
  c'est une occasion manquée. Rien n'est exploitable du seul fait qu'un en-tête n'est pas là.
- **« Données personnelles »** détectées par expression régulière (courriel, carte, IBAN) —
  trop de fausses pistes, et trouver une adresse dans une page n'est pas une vulnérabilité.

C'est ce qui fait qu'une capture propre affiche **zéro alerte** au lieu d'une liste de bruit.

### Réglages associés

Le masquage des secrets est actif par défaut : une valeur détectée s'affiche tronquée. Vous
pouvez ajouter vos propres motifs de secrets et de pisteurs dans les réglages.

---

## 11. La boîte à outils : 23 familles

125 transformations, 23 familles, **tout se calcule en local**. Le menu contextuel d'une
ligne du tableau, et les boutons « Boîte à outils » du panneau de détail, y envoient
directement une valeur.

| Famille | Contenu |
|---|---|
| **Transformer** | Le catalogue complet des 125 transformations, groupées : bases, texte, web, casse, normalisation Unicode, lignes… |
| **Clés et essais** | XOR (avec recherche de clé sur un octet), Vigenère, César sur les 26 décalages |
| **Chiffrement** | AES-GCM / CBC / CTR, dérivation PBKDF2, signature et vérification RSA et ECDSA |
| **JWT** | Décodage en-tête et charge utile, libellés des revendications standard, vérification de signature avec une clé |
| **Empreintes** | MD5, SHA-1, SHA-2, SHA-3, SHAKE, BLAKE2b/2s, CRC (20 variantes normalisées), Adler-32, FNV-1a, MurmurHash3, xxHash32, HMAC |
| **Mesures** | Longueur, octets, entropie de Shannon, distribution des caractères |
| **Hexadécimal** | Vidage hexadécimal avec colonne ASCII |
| **Binaire** | Protocol Buffers, MessagePack, CBOR, ASN.1/DER et certificats X.509, jeux de caractères et réparation de mojibake, **trames WebSocket et HTTP/2 décodées octet par octet** |
| **Code** | Génération de code d'appel dans 39 formats (voir [section 14](#14-importer-et-exporter)), lisibilité et désobfuscation |
| **Codes OTP** | HOTP et TOTP (RFC 4226 / 6238), fenêtres voisines, liens `otpauth://` |
| **Identifier** | Reconnaissance d'une valeur inconnue : format, encodage probable, empreinte candidate |
| **Horodatage** | Unix en secondes / millisecondes / microsecondes / nanosecondes, Apple/Cocoa, semaine ISO, durées |
| **Nombres** | Conversion entre bases 2 à 36, valeurs limites, Luhn |
| **Structures** | JSON, XML, YAML : arbre navigable, chemins JSONPath, sélecteurs CSS et XPath |
| **En-têtes** | Un bloc d'en-têtes collé est découpé ligne par ligne, chaque valeur décomposée, chaque point à regarder signalé |
| **Chercher** | Motifs prêts à l'emploi : jetons, clés, adresses, identifiants |
| **Expression régulière** | Banc d'essai avec groupes capturés et remplacement |
| **Comparer** | Diff ligne à ligne et mot à mot, distance de Levenshtein, similarité |
| **URL** | Chaque partie de l'URL, forme canonique RFC 3986, service connu sur le port, **détection d'homographes** (un « а » cyrillique dans un mot latin est signalé) |
| **Adresse IP** | IPv4 et IPv6 : masque, réseau, diffusion, plage utilisable, catégorie, découpage en sous-réseaux, résumé d'une liste de préfixes, plage vers préfixes, énumération, nom inverse `in-addr.arpa` / `ip6.arpa` (lecture dans les deux sens) |
| **Référence** | Les tables complètes, hors ligne : 62 statuts, 9 méthodes, 129 en-têtes, 70 types de média, 83 ports, 31 suites TLS, fermetures WebSocket, erreurs HTTP/2, **erreurs HTTP/3 et QPACK**, **erreurs de transport QUIC**, **alertes TLS**, **types d'enregistrement DNS**, **codes de réponse DNS**, erreurs réseau de Firefox |
| **Générer** | UUID v3/v4/v5/v7, ULID, nanoid, mots de passe avec calcul de force, adresses MAC, hexadécimal et base64 aléatoires |
| **Importer une requête** | Coller une commande `curl` et en refaire une requête rejouable |

---

## 12. Agir sur le trafic : règles et interception

> **Désactivé par défaut.** Tant que vous n'activez rien, INTERCEPTOR observe sans jamais
> altérer le trafic.

### Les règles

Une règle a des **conditions** et une **action**.

**Conditions** : hôte (contient), URL (expression régulière, avec groupes capturés),
méthode, type de ressource. Elles se combinent par ET.

**Actions** :

| Action | Effet |
|---|---|
| `block` | La requête est annulée |
| `redirect` | La requête part vers une autre URL — `$1`…`$9` reprennent les groupes capturés |
| `upgrade` | Une requête `http` est renvoyée en `https` |
| `modifyHeaders` | Ajoute, remplace ou retire des en-têtes de requête et de réponse |
| `mock` | La page reçoit une réponse simulée — **le corps réel du serveur reste enregistré** |
| `delay` | La requête part avec un retard, pour simuler un réseau lent (plafonné à 30 s) |
| `replaceBody` | La page reçoit le corps du serveur avec un motif remplacé |

Sept modèles prêts à l'emploi sont fournis (bloquer les pisteurs, simuler une panne d'API,
forcer HTTPS, injecter un en-tête…). Chaque règle affiche en français ce qu'elle fait :
*« Si hôte contient « exemple.com » ET méthode POST, alors la requête est bloquée. »*

Une règle dont l'expression d'URL est illisible est **inerte** et signalée comme telle :
une parenthèse oubliée ne peut pas transformer « cette URL » en « toutes les URL ».

### L'interception manuelle

Suspend une requête avant son départ, le temps de la modifier à la main, puis de la
relâcher. La file d'attente est visible dans la vue **Interception**. Si toutes les
consoles se ferment, tout est relâché automatiquement : aucune navigation ne peut rester
bloquée sans que personne puisse trancher.

---

## 13. Rejouer une requête

L'onglet **Rejouer** du panneau de détail reprend une requête capturée, laisse tout modifier
(méthode, URL, en-têtes, corps) et la renvoie. La réponse apparaît à côté, et la ligne
rejouée est marquée dans le tableau (`replayed:true`).

Utile pour : vérifier qu'un paramètre change le résultat, tester une valeur limite,
reproduire une erreur, comparer deux variantes avec la vue **Comparaison**.

---

## 14. Importer et exporter

### Exporter la capture

| Format | Fichier | Pour quoi |
|---|---|---|
| **HAR 1.2** | `.har` | Le format d'échange standard : relisible par Firefox, Chrome, Charles, Fiddler, Wireshark… |
| **JSON complet** | `.json` | L'intégralité des enregistrements avec les statistiques |
| **CSV** | `.csv` | Pour un tableur |
| **Collection Postman** | `.postman_collection.json` | Rejouer dans Postman |
| **Rapport d'alertes** | `.md` | La synthèse de sécurité en Markdown |
| **Liste d'URL** | `.txt` | Une URL par ligne |
| **Réglages** | `.json` | Sauvegarde de la configuration |
| **Diagnostic** | `.json` | Le journal interne, pour un rapport de bogue |

### Générer du code d'appel

Une requête capturée se recopie en **39 formats** :

- **Ligne de commande** — cURL (bash, PowerShell, cmd.exe), wget, HTTPie,
  PowerShell `Invoke-WebRequest` et `Invoke-RestMethod`
- **JavaScript et Python** — `fetch`, Node.js, Python `requests`, Python `http.client`
- **Ruby** — `net/http`, HTTParty
- **PHP** — cURL, Guzzle
- **Go, Rust** — `net/http`, `reqwest`
- **JVM** — Java `java.net.http`, OkHttp, Kotlin
- **.NET** — C# `HttpClient`, RestSharp
- **Apple** — Swift `URLSession`, Objective-C `NSURLSession`
- **Autres** — Dart, Elixir, R, Perl, Clojure…
- **Brut et documentation** — requête HTTP brute, réponse HTTP brute, fiche Markdown,
  enregistrement JSON complet

Une sélection multiple exporte un script complet, prêt à exécuter.

### Importer

- **HAR** — un fichier HAR produit par un autre outil se charge dans le tableau ; les lignes
  importées sont marquées `imported:true`.
- **Session** — une capture INTERCEPTOR exportée en JSON se recharge intégralement.
- **curl** — une commande `curl` collée devient une requête rejouable.
- **Réglages** — une configuration exportée se réimporte.

---

## 15. Réglages

Règle du projet : **toute option présente a un effet réel dans le code, et toute option de
l'interface existe dans la configuration. Aucun réglage décoratif.**

### Quatre profils prêts

| Profil | Ce qu'il fait |
|---|---|
| **Complet** | Toutes les couches, tous les corps, aucune limite |
| **Léger** | Capture l'essentiel, plafonne les corps — pour les longues sessions |
| **Discret** | Pas de corps, pas de piles — l'empreinte mémoire minimale |
| **Sécurité** | Tout ce qui alimente l'analyseur, le reste réduit |

### Les groupes de réglages

- **Apparence et langue** — français / anglais, thème sombre / clair / automatique,
  contraste renforcé, échelle du texte (avec adaptation automatique à l'écran), densité,
  format d'heure, mode simple
- **Couches de capture** — chacune des sept couches, activable indépendamment
- **Corps** — capture des corps de requête et de réponse, plafonds en octets, corps
  binaires, types de ressource à ignorer
- **Flux** — trames WebSocket, messages SSE, plafonds
- **Analyse** — analyseur actif, secrets, transport, cookies, CORS, masquage des secrets,
  motifs personnels de secrets et de pisteurs
- **Interface** — défilement automatique, périmètre par défaut, retour à la ligne des corps,
  mise en forme du JSON, comportement du clic sur l'icône, position de la console
- **Badge et notifications** — ce qu'affiche le badge de l'icône, notification sur alerte
  critique
- **Persistance** — conserver la capture entre les redémarrages, plafond de stockage
- **Nettoyage** — vider à chaque navigation, plafond du nombre de lignes en mémoire

---

## 16. Raccourcis clavier

| Touche | Effet |
|---|---|
| `/` | Placer le curseur dans la recherche |
| `↑` `↓` | Requête précédente / suivante |
| `Échap` | Fermer le détail, un menu, ou cette fenêtre |
| `P` | Mettre la capture en pause ou la reprendre |
| `F` | Suivre le flux ou le figer |
| `C` | Comparer les deux lignes sélectionnées |
| `S` | Enregistrer le filtre courant |
| `1` à `9` | Basculer sur une vue |
| `?` | Afficher l'aide clavier |
| `Ctrl+clic` | Ajouter une ligne à la sélection |
| `Maj+clic` | Sélectionner une plage de lignes |
| `Clic droit` | Menu contextuel de la ligne |
| `Ctrl+Shift+Y` | Ouvrir la fenêtre compacte |
| `Alt+Shift+S` | Ouvrir le panneau latéral |
| `Alt+Shift+I` | Ouvrir la console dans un onglet |
| `Ctrl+Shift+U` | Pause / reprise, même hors de la console |

---

## 17. Vie privée : ce qui sort de la machine

**Rien.**

- Aucune requête réseau n'est émise par l'extension, sauf celles que **vous** déclenchez
  explicitement : un rejeu, une sonde manuelle.
- Aucune télémétrie, aucun compte, aucun serveur.
- Toutes les tables de référence sont embarquées : la boîte à outils et l'aide fonctionnent
  **hors ligne**.
- Tous les calculs (empreintes, chiffrement, décodage) se font dans le navigateur.
- La capture vit en mémoire. Elle n'est écrite sur le disque que si vous activez la
  persistance, et seulement dans le stockage local de l'extension.
- Les exports sont écrits là où vous les demandez, par le gestionnaire de téléchargements
  de Firefox.

La politique de sécurité du contenu déclarée dans le manifeste interdit tout script
extérieur : `script-src 'self'; object-src 'none'; child-src 'none'; frame-src 'none'`.

---

## 18. Architecture du code

Aucune dépendance externe, aucune étape de compilation. Ce sont des modules ES chargés
directement par Firefox.

```
manifest.json              Manifest V2, Firefox 115+

background/                Le noyau — page d'arrière-plan persistante
├── background.js          Démarrage, badge, menus, raccourcis
├── core/
│   ├── config.js          Configuration : valeurs par défaut, persistance, diffusion
│   ├── store.js           Magasin mémoire des enregistrements (60 champs par ligne)
│   ├── dedup.js           Corrélateur anti-doublon
│   ├── analyzer.js        Orchestration de l'analyse
│   ├── analyzer-regles.js Les règles de sécurité et leurs preuves
│   ├── secrets.js         Motifs de secrets et de pisteurs
│   ├── persist.js         Session conservée entre les redémarrages
│   └── debug.js           Journal interne
├── capture/               Les sept couches
│   ├── webrequest.js      9 événements webRequest
│   ├── streamfilter.js    Corps de réponse sur le fil
│   ├── bodies.js          Décodage et décompression des corps
│   ├── security.js        TLS et certificats
│   ├── dnsinfo.js         Résolution DNS
│   ├── navigation.js      Contexte de page
│   ├── cookies.js         Mutations de cookies
│   ├── proxy.js           Couche proxy (optionnelle)
│   └── probe.js           Sonde manuelle
├── ingest/                Entrées non-webRequest
│   ├── page.js            Observations des sondes de page
│   ├── promote.js         Promotion des observations orphelines
│   ├── har.js             Import HAR
│   └── curl.js            Lecture d'une commande curl
├── rules/
│   ├── engine.js          Moteur de règles
│   └── intercept.js       Interception manuelle
├── export/                HAR, JSON, CSV, Postman, rapport, 39 générateurs de code
├── api/                   Service de commandes vers l'interface, diffusion temps réel
└── lib/                   Utilitaires partagés du noyau

content/
├── bridge.js              Pont page ↔ noyau (content script)
└── hooks.js               Sondes injectées dans la page

ui/                        L'interface — la même page pour les quatre surfaces
├── console.html/.js       Coquille : en-tête, navigation, routage des vues
├── app.js                 État partagé, accès au noyau, thème, échelle
├── popup.html/.js         La popup
├── theme.css, console.css Socle visuel (tout s'appuie sur --scale)
├── console/               Une vue par fichier + le panneau de détail
└── lib/                   Codecs, empreintes, réseau, tables de référence, i18n

tests/                     641 vérifications, sans navigateur
tools/captures.mjs         Génération des captures de la documentation
build.ps1                  Vérification et fabrication du .xpi
```

### Principes tenus dans tout le code

- **Tout champ capturé est affiché.** Un test le vérifie mécaniquement.
- **Aucun réglage décoratif.** Toute option a un effet réel.
- **Aucune alerte non démontrable.** Chaque finding porte sa preuve.
- **Rien n'est jamais perdu.** Une observation sans parent devient sa propre ligne.
- **Fichiers courts et cohésifs.** 200 à 400 lignes typiques.
- **Commentaires qui disent *pourquoi*,** pas *quoi*.

---

## 19. Tests

```bash
npm test
```

641 vérifications, sans navigateur et sans dépendance. Les modules du noyau et de
l'interface sont écrits pour Firefox : `tests/harnais.mjs` fournit le minimum d'API
WebExtension et de DOM pour qu'ils s'importent et se testent sous Node. **La logique testée
est exactement celle qui s'exécute dans le navigateur, sans réécriture.**

| Suite | Vérifications | Ce qu'elle couvre |
|---|---|---|
| `core.test.mjs` | 173 | Normalisation d'URL, signatures de corrélation, magasin, moteur de règles (dans les deux sens : ce qui correspond **et** ce qui ne doit pas), analyseur de sécurité règle par règle, export HAR, import curl, les 39 générateurs de code |
| `avance.test.mjs` | 130 | Trames WebSocket et HTTP/2, CSP, fraîcheur RFC 9111, multipart, URL canoniques et homographes, tables de protocole, structures binaires, empreintes rares, générateurs |
| `ui-load.test.mjs` | 122 | Chargement effectif des 101 modules d'interface, graphe de modules complet (aucun import mort, aucun fichier hors du graphe), cohérence avec les pages HTML et le manifeste |
| `detail-coverage.test.mjs` | 120 | Chacun des 60 champs d'un enregistrement est affiché, chaque onglet a une fonction de rendu, chaque champ cherchable existe |
| `outils.test.mjs` | 96 | La boîte à outils, contre des vecteurs publiés |

Les valeurs attendues viennent de sources publiées : vecteurs de RFC (4226, 6238, 6455,
4231, 9113, 3986, 7578, 9111), valeurs de contrôle normalisées (les 20 variantes CRC sont
vérifiées contre leur valeur de contrôle publiée pour `123456789`), FIPS 202 pour SHA-3,
RFC 7693 pour BLAKE2, RFC 9562 pour les UUID.

---

## 20. Construire le paquet

```powershell
.\build.ps1 -Verify    # vérifie sans construire
.\build.ps1            # vérifie, teste, puis écrit dist/interceptor-<version>.xpi
```

Le script vérifie que les 146 fichiers requis sont présents, que chaque surface déclarée
dans le manifeste existe sur le disque, puis lance les cinq suites de tests. **Si un test
échoue, la construction s'arrête.**

Fonctionne avec Windows PowerShell 5.1 comme avec PowerShell 7.

Pour régénérer les captures de la documentation :

```bash
node tools/captures.mjs
```

---

## 21. Contribuer

Les remontées de bogues et les propositions sont bienvenues.

Pour un rapport de bogue utile : ouvrez la vue **Journal interne**, exportez le
diagnostic, et joignez-le. Il contient les erreurs internes et le journal des commandes,
pas votre trafic.

Avant d'ouvrir une pull request :

```bash
npm test              # les 641 vérifications doivent passer
.\build.ps1 -Verify   # la construction doit être verte
```

Conventions du dépôt : modules ES sans dépendance, fichiers de 200 à 400 lignes,
commentaires en français qui expliquent le *pourquoi*, et une règle non négociable —
**aucune fonctionnalité qui affirme quelque chose qu'elle ne peut pas démontrer.**

---

## 22. Licence

[MIT](LICENSE) — © 2026 D4RK

---

<div align="center">

**INTERCEPTOR** · créé par D4RK

*Tout voir. Ne rien inventer.*

</div>
