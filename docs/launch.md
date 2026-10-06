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
AMO link in the repository's homepage field.

## 2. Make the repository page convince in ten seconds

- Upload `docs/images/social-preview.png` under **Settings → General → Social preview**. It is
  the image shown when the link is shared anywhere; GitHub has no API for it.
- Pin the repository on your GitHub profile.
- Optional: enable **Discussions**, so people can ask without opening an issue.

## 3. Present it — texts ready to paste

**Before posting anywhere, read that community's rules on self-promotion.** Several only
allow it in a given thread or on a given day. Post once per community, answer every
comment yourself, and never repost the same text elsewhere on the same day.

### Hacker News — Show HN

Title (80 characters at most):

```
Show HN: SWIFT – a Firefox network inspector that proves what it shows
```

Text:

```
I built SWIFT, a Firefox extension, for the questions the network panel can't
answer: which line of JavaScript made this call, what a WebSocket frame means (socket.io,
STOMP, MQTT, GraphQL…), which preflight made a CORS request fail, whether a
Content-Digest really matches the body, what a passkey sign-in actually proved, which
GraphQL operation hides behind yet another POST /graphql. It can also turn the captured API
calls into an OpenAPI 3.1 description.

Its one rule: show only what the browser measured or sent. When a value can't be proven,
it says why instead of guessing — a cross-origin timing hidden without Timing-Allow-Origin
is reported as hidden, not as 0 ms; a digest over bytes Firefox already decoded is "not
verifiable", not "mismatch".

Things I learned building it: Firefox usually decodes gzip/brotli before an extension
sees a response body, so a Content-Digest can't be checked on most compressed responses;
an HTTP message signature (RFC 9421) can only be verified if the signature base is rebuilt
byte for byte — the test suite rebuilds and verifies the RFC's own worked examples.

No telemetry, no server, no dependencies, MIT. 2084 assertions run under Node, many of
them against published vectors (RFCs, Yubico's fido2, dnspython, graphql-core).

https://github.com/isneoz1/interceptor
```

If the AMO listing is not live yet, add a last line saying so and how to load the `.xpi`
as a temporary add-on — people will ask.

### Reddit — r/firefox

Title:

```
I made a network inspector for Firefox that shows the JS stack behind every request and decodes WebSocket frames
```

Text:

```
SWIFT sits next to the built-in network panel and answers what it can't: the
JavaScript call stack behind each fetch/XHR/WebSocket, WebSocket frames decoded by
subprotocol, the CORS preflight that blocked a request, cookies rejected and why, every
certificate of the chain read in full, the GraphQL operation behind each POST /graphql. It
also verifies things rather than repeating them: digests, HTTP message signatures, passkey
sign-ins — and exports the API calls it saw as an OpenAPI 3.1 description.

Nothing leaves your machine — no telemetry, no server, no dependencies. English and French.
Source and install: https://github.com/isneoz1/interceptor
```

### Reddit — r/webdev

Check the current self-promotion rule first. Use the r/firefox text, and lead with the
developer problem it solves: "Why is my CORS request blocked?" — the preflight is paired
with the request it authorised, and the header that refused it is named.

### Mozilla Discourse

In the add-ons section of `discourse.mozilla.org`, a short post with the r/firefox text and
the AMO link once it exists. Mozilla's own community is where add-on users and reviewers
read.

### LinuxFr.org (en français)

Un journal, pas une dépêche :

```
SWIFT : un inspecteur réseau pour Firefox qui prouve ce qu'il affiche

Je développe SWIFT, une extension Firefox qui répond aux questions que le panneau
réseau intégré laisse sans réponse : quelle ligne de JavaScript a lancé cet appel, ce que
veut dire une trame WebSocket (socket.io, STOMP, MQTT, GraphQL…), quel preflight a fait
échouer une requête CORS, si un Content-Digest correspond vraiment au corps, ce qu'une
connexion par clé d'accès a réellement prouvé, quelle opération GraphQL se cache derrière
un énième POST /graphql. Il sait aussi décrire en OpenAPI 3.1 les appels d'API capturés.

Sa règle : n'afficher que ce que le navigateur a mesuré ou envoyé. Quand une valeur ne
peut pas être prouvée, il dit pourquoi au lieu de deviner.

Aucune télémétrie, aucun serveur, aucune dépendance. Licence MIT, interface en français et
en anglais : https://github.com/isneoz1/interceptor
```

### dev.to or Hashnode — one article

One concrete story is worth more than a feature list. Three that the project can back with
its own history (see `CHANGELOG.md`):

- *Firefox decodes the body before your extension sees it* — why a Content-Digest check
  gave false mismatches, and how 4.5 stopped asserting what it could not prove.
- *Rebuilding an HTTP message signature byte for byte* — RFC 9421's signature base, and the
  six test cases of its Appendix B used as tests.
- *The "sending" phase that was never measured* — how 4.4 found a timing the browser does
  not expose, and removed it.

## 4. What not to do

- No extra accounts, bought stars, votes or reviews: Hacker News, Reddit and AMO detect
  them, and ban the project, not just the account.
- No "the best" or "the most complete": show one concrete thing it does that the reader
  cannot do today, and let them judge.
- Don't post before the install path works for a reader on the release version of Firefox,
  or say plainly that it does not yet.
