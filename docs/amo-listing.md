# Publishing on addons.mozilla.org

Everything the AMO submission form asks for, ready to paste. Nothing here can be automated:
Mozilla requires a signed-in developer account, so these are the steps only you can take.

**Why it matters.** Right now SWIFT can only be loaded as a temporary add-on, which goes away
when Firefox restarts: the release channel refuses to install an unsigned `.xpi` for good. A
permanent install takes Developer Edition, Nightly or ESR *and* flipping
`xpinstall.signatures.required`. AMO removes both barriers and adds its own search traffic.

Checked on 7 November 2026 against Mozilla's guides, [Create an appealing listing](https://extensionworkshop.com/documentation/develop/create-an-appealing-listing/)
and [Submitting an add-on](https://extensionworkshop.com/documentation/publish/submitting-an-add-on/),
AMO's public API, and the field limits in its source, `mozilla/addons-server`.

---

## Before you submit

- [ ] **The add-on ID is now `swift@neoz`.** It becomes permanent the moment you first
      publish. Changing it later means publishing a different add-on and orphaning every
      existing install, so make sure it is what you want *before* the first upload.
- [ ] **Bump the version.** AMO refuses a version number it has already seen. The repository
      is at `5.9.0`, which has never been submitted, so it can go up as-is. Only bump again if
      a submission gets rejected and you need to resubmit.
- [ ] **The package**: `swift-5.9.0.xpi` from the GitHub release, its SHA-256 is in the release
      notes. `npm run build` produces a new `dist/swift-<version>.xpi` from the repository.
- [x] **Data collection is declared**: `data_collection_permissions` is `{"required": ["none"]}`,
      which AMO requires of every new extension since 3 November 2025. Mozilla's linter
      (`npx web-ext lint` on the unpacked package) reported 0 errors and two warnings on 5.8.0:
      Firefox 115 to 139 do not know this key. That is expected — they ignore it, and since
      SWIFT collects nothing there is no consent to ask for on those versions. It has not been
      run on 5.9.0 yet: run it before you submit, or read the report of AMO's own validator,
      which checks the package when you upload it.
- [ ] The reviewer will read the source. It is plain ES modules with no build step, no
      minification and no bundler, so no separate source upload is required — say so in the
      notes below.
- [ ] **Your display name.** The listing names the author from the account that owns it: set
      the display name of your AMO profile to `D4RK`.
- [ ] **Platforms**: the desktop ones only, Windows, macOS and Linux. The manifest declares no
      Firefox for Android support and SWIFT has never been tried there; Mozilla's advice is to
      leave Android out rather than collect poor reviews from people it does not work for.

---

## Listing fields

**Name** (50 characters at most)

```
SWIFT Network Inspector
```

Mozilla asks for a name that is « unique and descriptive ». « Swift » and « SWIFT » are both
already on AMO, and the first six results for *network inspector* all have « Inspector » in
their name. In Firefox itself the add-on stays SWIFT, which comes from the manifest. If the form
shows SWIFT, replace it here.

**Add-on URL**

```
swift-network-inspector
```

The URL must be unique: `swift` belongs to a theme. This one was free on 7 November 2026.

**Summary** (250 characters at most, no web address allowed)

```
A network inspector for Firefox: every request recorded, explained in plain words, and changeable. Block, throttle, rewrite or replay any of them. No proxy, no certificate, no account. Nothing leaves your machine.
```

**Categories**

Primary: *Web Development*. Secondary: *Privacy & Security*.

That is where people look for this kind of tool: HTTP Header Live, simple-modify-headers and
GraphQL Network Inspector are all in Web Development.

**Tags**

```
privacy, security
```

AMO's tags are a closed list, published at `https://addons.mozilla.org/api/v5/addons/tags/`,
and these are the two that fit. Do not look for *network* or *debugging*: they do not exist.

**Support email**

Mozilla's advice is to give at least an address. It is shown to everyone: use one made for
this, not a personal one.

**Support site**

```
https://github.com/isneoz1/interceptor/issues
```

**Homepage**

```
https://isneoz1.github.io/interceptor/
```

The website, with the film. If the submission form does not offer this field, add it on the
listing once it exists.

**Licence**

MIT (already declared in `LICENSE` and in `package.json`).

**Leave unticked**

*This add-on is experimental*: it reduces the add-on's visibility on AMO. *This add-on has a
privacy policy*: Mozilla requires one when data is transmitted from the user's device, and
SWIFT transmits nothing.

---

## Screenshots

Upload these six, in this order, so they tell a story. They are 3200 × 2000, the 1.6:1 ratio
Mozilla recommends, and they carry no added text, as it asks: the `vitrine-*.png` images do, so
keep those for the README. All six come from a demonstration capture on made-up sites
(`example.com` and the like).

| File | Caption | Légende |
|---|---|---|
| `docs/images/console-requetes.png` | Every request of a page in one table: method, status, host, size and timing. | Toutes les requêtes d'une page dans un seul tableau : méthode, statut, hôte, taille et durée. |
| `docs/images/console-graphql.png` | A 200 that hides an error: the GraphQL operation is named, and its error read with its path and code. | Un 200 qui cache une erreur : l'opération GraphQL est nommée, et son erreur lue avec son chemin et son code. |
| `docs/images/console-photo.png` | What a photo gives away: where it was taken, the author and the camera's serial number. | Ce qu'une photo révèle : où elle a été prise, son auteur et le numéro de série de l'appareil. |
| `docs/images/console-securite.png` | Findings it can prove: each one comes with the request that shows it. | Des constats qu'il peut prouver : chacun vient avec la requête qui le montre. |
| `docs/images/console-regles.png` | Rules from twelve ready-made templates: block, redirect, rewrite, mock or throttle. | Des règles à partir de douze modèles : bloquer, rediriger, réécrire, simuler ou ralentir. |
| `docs/images/console-outils.png` | The toolbox: everything is computed locally. | La boîte à outils : tout est calculé sur place. |

---

## Description

Paste as-is. The field takes bold, italics, links, lists, blockquotes and code in Markdown, but
no headings, and 15,000 characters at most. Most people scan a listing for a few seconds, so
what it does for them comes first.

```
**See what your browser really sends.** SWIFT is a network inspector for Firefox: it records every request, explains it in plain words, and lets you block, rewrite or replay it. No proxy. No certificate. No account. Nothing leaves your machine.

**It answers why, not just that**

- **Why was this refused?** A failed CORS request is paired with the preflight that caused it, and the header that said no is named.
- **Why is this cookie ignored?** The exact rule it breaks: prefix, SameSite, Secure, domain.
- **What is behind this POST?** GraphQL, JSON-RPC and SOAP calls are named in the table, and a 200 that hides an error is read for you.
- **Is this token genuine?** Every JWT a request carries is read, and verified with the key its issuer publishes when the capture holds it.
- **Which code made this call?** The JavaScript stack behind fetch, XHR, sendBeacon and WebSocket calls, recorded with DevTools closed.
- **What does this photo give away?** Where it was taken, the author and the camera's serial number, read from the image as it arrives.
- **What does my browser announce?** The User-Agent read honestly: Windows 11 still writes "NT 10.0", so SWIFT says Windows 10/11 rather than guess.

**Change the traffic, without leaving the browser**

- Twelve ready-made rules, each saying in plain words what it will do: no caching, block cookies, throttle, remove tracking parameters and more
- Block, redirect, or rewrite headers and URL parameters with rules you build in the interface
- Serve a local file in place of a response
- Pause a request before it leaves, edit it, then let it go
- Replay any request, after confirmation

**Findings it can prove**

Every finished request is audited automatically: exposed secrets, credentials sent in clear, exploitable CORS, cookies that will be rejected and why, obsolete TLS, a CSP nonce reused across responses. It reports only what it can demonstrate from the captured data, and masks sensitive values by default.

**What most tools leave as text, opened**

- OAuth 2.0, OpenID Connect and SAML 2.0 decoded; the protections of a response read together; digests announced by a server checked against the bytes received
- HTTP message signatures (RFC 9421) rebuilt byte for byte and verified with a key you paste; passkey (WebAuthn) sign-ins opened and their signature verified; DNS over HTTPS decoded
- What servers announce: an API's end-of-service dates, the quota left, when to retry, the caches on the way, the proxy that generated a 502
- Reports the browser sends on its own: CSP violations, network errors, deprecations

**One request is one row**

Eight layers observe each request — webRequest, the response stream, page probes, PerformanceObserver, TLS, DNS, cookies, navigation — and a correlator merges them. Two identical polling GETs stay two rows, because they are two requests. Search with a real syntax: method, status, host, size, duration, content type. Export to HAR, JSON, CSV, Postman or an OpenAPI 3.1 description, or generate ready-to-run code in 39 formats. 140 local transformations across 26 tools: encodings, digests, JWT, OTP, timestamps, image metadata and more.

**Nothing leaves your machine**

No telemetry, no analytics, no server, no external dependency. Captured traffic lives in memory, and on disk only if you turn on persistence, in your own browser's IndexedDB.

Interface in English and French: it starts in French on a French Firefox, in English otherwise. Open source under the MIT licence.
```

---

## French listing

Mozilla advises a localized listing for each language the add-on supports, and lets you localize
the name, the summary, the description and the captions. Once the listing exists, add French.

**Nom**

```
SWIFT Inspecteur réseau
```

**Résumé**

```
Un inspecteur réseau pour Firefox : chaque requête enregistrée, expliquée en mots simples, et modifiable. Bloquez, ralentissez, réécrivez ou rejouez celles que vous voulez. Sans proxy, sans certificat, sans compte. Rien ne quitte votre machine.
```

**Description**

```
**Voyez ce que votre navigateur envoie vraiment.** SWIFT est un inspecteur réseau pour Firefox : il enregistre chaque requête, l'explique en mots simples, et vous laisse la bloquer, la réécrire ou la rejouer. Sans proxy. Sans certificat. Sans compte. Rien ne quitte votre machine.

**Il répond à « pourquoi », pas seulement à « quoi »**

- **Pourquoi est-ce refusé ?** Une requête CORS en échec est reliée au preflight qui l'a causée, et l'en-tête qui a dit non est nommé.
- **Pourquoi ce cookie est-il ignoré ?** La règle exacte qu'il enfreint : préfixe, SameSite, Secure, domaine.
- **Que cache ce POST ?** Les appels GraphQL, JSON-RPC et SOAP sont nommés dans le tableau, et un 200 qui cache une erreur est lu pour vous.
- **Ce jeton est-il authentique ?** Chaque JWT d'une requête est lu, et vérifié avec la clé que publie son émetteur quand la capture la contient.
- **Quel code a fait cet appel ?** La pile JavaScript derrière les appels fetch, XHR, sendBeacon et WebSocket, enregistrée outils de développement fermés.
- **Que révèle cette photo ?** L'endroit où elle a été prise, son auteur et le numéro de série de l'appareil, lus dans l'image à son arrivée.
- **Que dit mon navigateur de lui-même ?** Le User-Agent lu honnêtement : Windows 11 écrit toujours « NT 10.0 », alors SWIFT dit Windows 10/11 plutôt que de deviner.

**Changez le trafic sans quitter le navigateur**

- Douze règles toutes prêtes, qui disent en mots simples ce qu'elles vont faire : sans cache, cookies bloqués, débit limité, paramètres de suivi retirés et d'autres
- Bloquez, redirigez, réécrivez les en-têtes et les paramètres d'URL avec vos propres règles
- Servez un fichier local à la place d'une réponse
- Suspendez une requête avant qu'elle parte, modifiez-la, puis laissez-la partir
- Rejouez n'importe quelle requête, après confirmation

**Des constats qu'il peut prouver**

Chaque requête terminée est auditée automatiquement : secrets exposés, identifiants envoyés en clair, CORS exploitable, cookies qui seront rejetés et pourquoi, TLS obsolète, nonce CSP réutilisé d'une réponse à l'autre. Il ne signale que ce qu'il peut démontrer à partir de la capture, et masque par défaut les valeurs sensibles.

**Ce que la plupart des outils laissent à l'état de texte**

- OAuth 2.0, OpenID Connect et SAML 2.0 décodés ; les protections d'une réponse lues ensemble ; les empreintes annoncées par un serveur comparées aux octets reçus
- Signatures de messages HTTP (RFC 9421) reconstruites octet par octet et vérifiées avec la clé que vous collez ; connexions par clé d'accès (WebAuthn) ouvertes et leur signature vérifiée ; DNS over HTTPS décodé
- Ce que les serveurs annoncent : les dates de fin d'une API, le quota restant, quand réessayer, les caches traversés, le proxy qui a produit un 502
- Les rapports que le navigateur envoie de lui-même : violations de CSP, erreurs réseau, dépréciations

**Une requête, une ligne**

Huit couches observent chaque requête — webRequest, le flux de la réponse, les sondes de page, PerformanceObserver, TLS, DNS, cookies, navigation — et un corrélateur les fusionne. Deux GET identiques envoyés à intervalles réguliers restent deux lignes, parce que ce sont deux requêtes. Une vraie syntaxe de recherche : méthode, statut, hôte, taille, durée, type de contenu. Export en HAR, JSON, CSV, Postman ou description OpenAPI 3.1, et code prêt à lancer dans 39 formats. 140 transformations locales dans 26 outils : encodages, empreintes, JWT, OTP, dates, métadonnées d'image et d'autres.

**Rien ne quitte votre machine**

Aucune télémétrie, aucune statistique, aucun serveur, aucune dépendance externe. La capture reste en mémoire, et sur le disque seulement si vous activez la persistance, dans l'IndexedDB de votre navigateur.

Interface en français et en anglais : elle démarre en français si Firefox est en français, en anglais sinon. Open source, licence MIT.
```

---

## Permission justifications

Reviewers ask why each permission is needed. These are the real reasons.

| Permission | Why |
|---|---|
| `<all_urls>` | The point of the add-on is to observe traffic on whatever the user browses. Restricting it to a host list would mean it silently misses everything else. |
| `webRequest` | The primary capture layer: the nine network lifecycle events. |
| `webRequestBlocking` | Firefox only allows `filterResponseData()` (the response body) from a blocking listener, and `getSecurityInfo()` (TLS details) inside a blocking `onHeadersReceived` listener; body capture is on by default. The same listeners apply the user's own rules (block, redirect, rewrite headers and URL parameters, mock, delay, throttle) and manual interception, which holds a request while the user edits it — off by default, and only while the console is open. When no rule or interception applies, they return without changing anything. |
| `webNavigation` | Attaches each request to the document and frame that caused it. |
| `cookies` | The cookie journal, and the analysis of why a cookie will be rejected. |
| `tabs` | Groups traffic per tab and lets the user filter to the active one. |
| `dns` | Resolves canonical name and addresses per host, shown in the detail panel. |
| `storage`, `unlimitedStorage` | Settings, rules, and optional on-disk persistence of the capture. Local only. |
| `downloads` | Saves HAR, JSON, CSV and Postman exports the user asked for. |
| `clipboardWrite` | "Copy as curl" and the other copy actions. |
| `contextMenus` | Right-click entries on a captured row. |
| `proxy` (optional) | The passive proxy layer. Off by default; Firefox asks at the moment the user enables it. |
| `notifications` (optional) | Alerts when a security finding appears. Off by default. |

---

## Reviewer notes

```
Source: https://github.com/isneoz1/interceptor — this exact version is tagged there.

No build step, no minification, no bundler. The .xpi is a zip of plain ES modules that
Firefox loads directly, so the uploaded package is already the readable source.

No remote code. The extension never calls eval() or new Function(), loads no remote
script, and contacts no server. The strings matching /eval/ in the source belong to two
read-only features: the Content-Security-Policy analyser, which explains what
'unsafe-eval' means in a site's policy, and the deobfuscation tool, which unwraps
eval(...) wrappers TEXTUALLY, for display, without executing anything.

Network access: none of its own. The only requests it can emit are the ones the user
explicitly replays, after a confirmation dialog.

Data: nothing is transmitted anywhere. Captured traffic is held in memory, and written to
IndexedDB only when the user enables persistence.

webRequestBlocking is required by filterResponseData() (response bodies) and by
getSecurityInfo() (TLS details), and serves the user's own rules and manual interception.
Interception is off by default, requires the console to be open, and always releases a
held request when its deadline expires. When no rule or interception applies, the
listeners return without changing anything.
```

---

## After it is published

- Add the AMO install badge and link to the top of `README.md`.
- On the website (`docs/index.html`), point « Get SWIFT for Firefox » at the listing, and
  replace the install section and its note about temporary add-ons.
- In `.github/ISSUE_TEMPLATE/bug_report.yml`, add addons.mozilla.org to the choices of
  « How is it installed? ».
- Upload `docs/images/social-preview.png` under **Settings → General → Social preview**;
  GitHub has no API for it, so it is a manual one-time step.
- Present it: `docs/launch.md` has texts ready to paste for Hacker News, Reddit, Mozilla
  Discourse, LinuxFr.org and a blog article, each claim checkable in the repository.
- Answer the reviews: Mozilla's advice is to reply when someone reports an issue or suggests an
  improvement. People who see that you listen are more inclined to try it.
