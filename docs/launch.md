# Getting SWIFT known

Everything here needs your own accounts, so none of it can be automated. The steps are in
order of impact. Every claim in the texts below is checkable in the repository — keep it
that way: one false claim costs more trust than ten true ones earn.

---

## 1. Be installable where Firefox users look

**Submit to addons.mozilla.org first** — `docs/amo-listing.md` has every field ready to paste.
Until the add-on is signed, the release version of Firefox refuses to install it, so most
people who find the project cannot try it. Every other step works better after this one.

Then, as `docs/amo-listing.md` lists at its end: the AMO badge at the top of the README, the
install button of the website.

## 2. Make the first ten seconds convince

The website, <https://isneoz1.github.io/interceptor/>, is the link to share: the film plays
inline there, which a GitHub README cannot do, and the page works on a phone.

- Upload `docs/images/social-preview.png` under **Settings → General → Social preview**. It is
  the image shown when the repository's link is shared anywhere; GitHub has no API for it.
- Pin the repository on your GitHub profile.
- Optional: enable **Discussions**, so people can ask without opening an issue.

## 3. Present it — texts ready to paste

**Before posting anywhere, read that community's rules on self-promotion.** Several only
allow it in a given thread or on a given day. Post once per community, answer every
comment yourself, and never repost the same text elsewhere on the same day.

Readers of these communities know the tools. Never say the built-in panel cannot do something
without checking: it has a Stack Trace tab, parsers for Socket.IO, SockJS, SignalR, WAMP and
STOMP, the reason of a CORS failure, URL blocking, throttling, and Edit and Resend. What SWIFT
adds is listed, row by row, in the README: « Firefox already has a network panel. Why this? »

### Hacker News — Show HN

Title (80 characters at most):

```
Show HN: SWIFT – a Firefox network inspector that proves what it shows
```

Text:

```
I built SWIFT, a Firefox extension that records every request with DevTools closed and
explains it: which GraphQL operation hides behind yet another POST /graphql, which preflight
made a CORS request fail, whether a Content-Digest really matches the body, whether a JWT
verifies with the key its issuer published, what a passkey sign-in actually proved. It can
also turn the captured API calls into an OpenAPI 3.1 description, and its rules do what a
debugging proxy does — throttle, map to a local file, no caching, block cookies, pause and
edit a request — without a proxy or a root certificate.

Its one rule: show only what the browser measured or sent. When a value can't be proven,
it says why instead of guessing — a cross-origin timing hidden without Timing-Allow-Origin
is reported as hidden, not as 0 ms; a digest over bytes Firefox already decoded is "not
verifiable", not "mismatch"; a User-Agent saying Windows NT 10.0 reads "Windows 10/11",
because Windows 11 writes the same thing.

Things I learned building it: Firefox usually decodes gzip/brotli before an extension
sees a response body, so a Content-Digest can't be checked on most compressed responses;
an HTTP message signature (RFC 9421) can only be verified if the signature base is rebuilt
byte for byte — the test suite rebuilds and verifies the RFC's own worked examples; a rule
that adds a URL parameter with an apostrophe redirects forever if you compare spellings,
because the browser hands the address back with %27.

No telemetry, no server, no dependencies, MIT. 4038 assertions run under Node, many of
them against published vectors (RFCs, Yubico's fido2, dnspython, graphql-core).

https://isneoz1.github.io/interceptor/
```

If the AMO listing is not live yet, add a last line saying so and how to load the `.xpi`
as a temporary add-on — people will ask.

### Reddit — r/firefox

Title:

```
I made a free network inspector for Firefox: no proxy, no certificate, and it even shows what a photo gives away
```

Text:

```
SWIFT goes next to the built-in network panel. It records every request with DevTools
closed and keeps bodies whole, names the GraphQL operation behind each POST /graphql, pairs
a failed CORS request with the preflight that caused it, says exactly why a cookie will be
rejected, verifies JWTs, digests and HTTP message signatures, and reads what a photo carries:
GPS position, author, camera serial number.

Its rules do what a paid debugging proxy does — throttle a site, serve a local file, strip
tracking parameters, block cookies, pause and edit a request — from inside Firefox.

Nothing leaves your machine: no telemetry, no server, no dependencies. English and French.
Site, film and install: https://isneoz1.github.io/interceptor/
```

### Reddit — r/webdev

Check the current self-promotion rule first. Use the r/firefox text, and lead with the
developer problem it solves: "Why is my CORS request blocked?" — the preflight is paired
with the request it authorised, and the header that refused it is named.

### Reddit — r/privacy

Read its rules first, and post only if they allow it. Lead with what anyone can check on
their own: photos carry GPS coordinates, and SWIFT shows them for any image a site serves.
Link the source, and say it sends nothing anywhere.

### Mozilla Discourse

In the add-ons section of `discourse.mozilla.org`, a short post with the r/firefox text and
the AMO link once it exists. Mozilla's own community is where add-on users and reviewers
read.

### LinuxFr.org (en français)

Un journal, pas une dépêche :

```
SWIFT : un inspecteur réseau pour Firefox qui prouve ce qu'il affiche

Je développe SWIFT, une extension Firefox qui enregistre chaque requête, même outils de
développement fermés, et l'explique : quelle opération GraphQL se cache derrière un énième
POST /graphql, quel preflight a fait échouer une requête CORS, si un Content-Digest
correspond vraiment au corps, si un jeton JWT se vérifie avec la clé que publie son émetteur,
ce qu'une connexion par clé d'accès a réellement prouvé, et ce qu'une photo laisse filer :
sa position GPS, son auteur, le numéro de série de l'appareil. Il sait aussi décrire en
OpenAPI 3.1 les appels d'API capturés, et ses règles font ce que fait un proxy de débogage —
limiter le débit, servir un fichier local, retirer les paramètres de suivi, suspendre et
modifier une requête — sans proxy ni certificat racine.

Sa règle : n'afficher que ce que le navigateur a mesuré ou envoyé. Quand une valeur ne
peut pas être prouvée, il dit pourquoi au lieu de deviner.

Aucune télémétrie, aucun serveur, aucune dépendance. Licence MIT, interface en français et
en anglais : https://isneoz1.github.io/interceptor/
```

### dev.to or Hashnode — one article

One concrete story is worth more than a feature list. Stories the project can back with its
own history (see `CHANGELOG.md`):

- *Firefox decodes the body before your extension sees it* — why a Content-Digest check
  gave false mismatches, and how 4.5 stopped asserting what it could not prove.
- *Rebuilding an HTTP message signature byte for byte* — RFC 9421's signature base, and the
  six test cases of its Appendix B used as tests.
- *The "sending" phase that was never measured* — how 4.4 found a timing the browser does
  not expose, and removed it.
- *An apostrophe that redirects forever* — why a URL-parameter rule must compare values, not
  spellings, once the browser has rewritten the address by the WHATWG URL Standard.
- *Windows 11 says it is Windows 10, iOS 26 says it is 18.6* — reading a User-Agent honestly,
  against the 428 test strings of ua-parser-js.
- *A 100 MB image in 100 KB* — bounding a metadata reader that runs on whatever a page serves.

## 4. What not to do

- No extra accounts, bought stars, votes or reviews: Hacker News, Reddit and AMO detect
  them, and ban the project, not just the account.
- No "the best" or "the most complete": show one concrete thing it does that the reader
  cannot do today, and let them judge.
- Don't post before the install path works for a reader on the release version of Firefox,
  or say plainly that it does not yet.
