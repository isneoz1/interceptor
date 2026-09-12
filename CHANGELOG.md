# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.9.0] — 2026-09-12

### Added

- **The reference gained an "All" family, and it is the default.** Fourteen tables answered
  fourteen separate questions: you had to know which one held your answer before you could
  ask. **All** searches every one of them at once and says where each result came from.

  `timeout` returns `408 Request Timeout`, `504 Gateway Timeout`, the `Timeout` header,
  `SETTINGS_TIMEOUT` and `NS_ERROR_NET_TIMEOUT` — four different tables, one search.

  It searches the explanations as well as the names, which is what makes it useful when you
  cannot name what you are looking for: `ocsp` finds `bad_certificate_status_response`,
  whose name says nothing about OCSP, and `preflight` finds both `OPTIONS` and
  `Access-Control-Max-Age`.

  It is the default family now, because arriving at the reference with a value in hand and
  landing on the status codes only helped when the value happened to be a status code.

  The `Ctrl+K` palette is unaffected — it already reached every line by name — and **All**
  adds nothing to it, so the 691 entries are never offered twice.

1149 assertions across five suites.

## [3.8.0] — 2026-09-12

### Added

- **The method and status tables now cover their IANA registries entirely.** Statuses went
  from 60 of 61 to 61 of 61 — the missing one being `104 Upload Resumption Supported`.
  Methods went from 9 of 40 to **40 of 40**.

  A browser never sends `PROPFIND`, `MKCALENDAR` or `ORDERPATCH`. But INTERCEPTOR also reads
  imported captures and the traffic of third-party clients, and there a method with no
  explanation helps nobody. Each one carries the properties the registry itself declares —
  safe, idempotent, cacheable — not a guess from the name. `LOCK` is marked non-idempotent
  because every call creates another lock, which is exactly what the registry says.

- **`Ctrl+K` now answers questions, not just "where is that screen".** The command palette
  searches the **691 reference lines** alongside the views, tools and actions: every header,
  status code, method, media type, port, TLS cipher suite, TLS alert, HTTP/2, HTTP/3 and
  QUIC error, DNS record type and DNS response code.

  Type `cache-status`, `429` or `PROPFIND`, press Enter, and the reference opens on that
  entry, already explained. The search existed before — inside the tool. Reaching it took
  four gestures for a one-second question: open the toolbox, find the Reference tab, pick
  the right family, then search. Now it takes one.

  Commands keep priority when both match: `cookies` still offers the Cookies view before the
  `Cookie` header. Entries carry a weight that moves them behind an equally good command
  without ever hiding them, so the palette does not get harder to use as the tables grow.

  The entries are built from the panel tables themselves, so a table added later becomes
  searchable from `Ctrl+K` the same day. A test opens all 691 of them one by one and checks
  that each really lands on its own line.

### Fixed

- **250 reference descriptions had no English translation.** The panel called the translator
  on every one of them; the dictionary simply did not have them. In an interface set to
  English, the TLS alerts, the HTTP/3 and QUIC errors, the DNS record types and their
  response codes were displayed **entirely in French** — five whole tables — along with the
  hundred headers and thirty-one methods added to cover the IANA registries.

  All 250 are now written, and a test reads the fourteen tables directly: adding a line
  without its translation fails the suite. Protocol names stay untouched on purpose —
  `PROTOCOL_ERROR`, `AAAA` and `PostgreSQL` are spelled the same everywhere, and translating
  them would make them impossible to look up.

- **`yes` and `no` were displayed as `oui` and `non`** in nineteen places, including the
  method properties, the certificate summary and the comparison view. A value is usually
  captured data, which must never be translated — but these two are interface words, and
  only two of the twenty-one call sites remembered it.

- **A port range was never translated either** — "port systeme (1 a 1023)" had its English
  entry all along, and nothing called for it. Same for the authentication and cipher fields
  of a TLS suite card.

- **The test harness silently dropped nested nodes.** `ui/lib/dom.js` tells a node from a
  string by its `nodeType`; the stub DOM had none, so every child element became the string
  `"[object Object]"`. Any test that built a view was only ever reading its first layer.
  The stub now reports `nodeType` and `firstChild`, which is what made the 691-entry
  rendering test possible in the first place.

- **The README figures are all recounted now, everywhere they appear.** The same number is
  often printed twice — once in the summary table, once in the tool description — and only
  the first was checked, so the second drifted in silence: it still claimed 62 statuses and
  9 methods. Six more figures joined the check, including the 691 reference lines.

1140 assertions across five suites.

## [3.7.0] — 2026-09-12

### Added

- **The header reference now covers the IANA permanent registry entirely** — 187 of 187,
  up from 87. Plus 42 headers the registry has never taken in but that real traffic carries
  anyway: `X-Forwarded-For`, `CF-Ray`, `RateLimit`, `Sec-GPC`, `Idempotency-Key`. 229 in all.

  "Every header in the world" is not a measurable claim. The IANA registry is: an official,
  enumerable list that changes over time. So that is what was measured against, and what is
  now enforced — **a test fails when the registry gains an entry the table lacks**. A figure
  nobody recounts ends up lying.

  Each description was written from the specification IANA cites for that entry, not from
  what the name suggests. Where an entry belongs to a protocol the browser does not speak —
  WebDAV, CalDAV, OData, SOAP — that is said plainly: knowing you are looking at a header
  from another world beats thinking you understood it.

  Among the additions that matter for real traffic: `Cache-Status` and `CDN-Cache-Control`
  for CDN debugging, `Proxy-Status` for knowing which hop failed and why, `Deprecation` and
  `Sunset` for API lifecycle, `DPoP` for modern OAuth, `Client-Cert` for mTLS terminated at a
  proxy, `Last-Event-ID` for resuming an SSE stream, and the `Signature` / `Signature-Input`
  pair that INTERCEPTOR already parses as structured fields.

1104 assertions across five suites.

## [3.6.0] — 2026-09-10

### Changed

- **Structured fields move from RFC 8941 to RFC 9651.** The 2024 revision supersedes the
  2021 one and adds two base types, taking the total from six to eight:

  - **Date** — `@1659578233`, seconds since the Unix epoch. The panel shows the readable
    instant alongside, because the value is in seconds while everything in JavaScript is in
    milliseconds. A decimal is refused, as the specification requires, and so is a value
    outside years 1 to 9999.
  - **Display string** — `%"This is intended for display to %c3%bcsers."`, percent-encoded
    UTF-8 meant for a human to read. Distinct from an ordinary string, which carries only
    ASCII — and that distinction is the whole point of having the type.

  This is not a cosmetic gap. A reader that does not know a type does not merely miss that
  member: it rejects **the entire header**. A single `@1659578233` made everything around it
  unreadable.

  Verified against the specification's own examples, including the display string from
  section 3.3.8 verbatim. The six original types are untouched.

1098 assertions across five suites.

## [3.5.0] — 2026-09-10

### Added

- **Body integrity, verified rather than repeated.** A server can announce the digest of
  what it sends. Reading that announcement is of limited use — but INTERCEPTOR holds the
  body, so it recomputes the digest and says whether it **matches**, showing both values
  when it does not. No browser does this, and it is exactly the promise of the project: not
  "the server announces sha-256=…", but whether that claim survives contact with the bytes.

  RFC 9530 (`Content-Digest`, `Repr-Digest`, structured fields), the older RFC 3230 `Digest`
  form still widely deployed, and `Content-MD5`. On the request side too, where the client
  is the one making the claim.

  What cannot be recomputed here says so — `unixsum`, `crc32c` — rather than leaving an
  absent verdict to be read as approval. Algorithms outside the IANA registry are described
  as unknown, never guessed. `Want-Content-Digest` is read as well, where a weight of zero
  means "not this one" rather than "a little".

- **`Server-Timing`, next to the duration actually measured.** A request took 214 ms; how
  many does the server claim? That is the only way to tell whether the problem is on its
  side or on the way there. The panel now shows each measurement and what is left over —
  network, queueing, or time the server does not count.

  A server can claim *more* than the measured duration, through overlapping measurements or
  asynchronous work counted separately. That is stated plainly instead of producing a
  negative remainder that would mean nothing.

1081 assertions across five suites.

## [3.4.0] — 2026-09-10

### Changed

- **A new visual direction.** The interface was deep indigo with neon accents, violet-cyan
  gradients, glowing card borders and frosted overlays. That combination has become the
  signature of an interface assembled without intent, and it was working against a tool
  whose whole job is to make dense data readable.

  It is now neutral greys, a single restrained blue, and one-pixel rules doing the
  structural work. Card gradients, hover glows and the blur behind modals are gone. Corner
  radii tighten from 6/9/14 to 3/5/8 — a data tool reads better in crisp frames than in
  pills. Severity moves to a two-pixel edge on the left of a card rather than a tinted
  background, so text always sits on a plain surface.

  The active row and the active view now carry the same inset bar, so one signal means one
  thing everywhere. Hover marks the border instead of lifting the element: in a dense table,
  things that jump under the pointer are tiring to read.

  Every pair is still measured. A restrained direction earns no more licence for grey on
  grey than a loud one, and all of them clear the WCAG 2.1 thresholds as before.

- The icon, the social preview card and the README showcase images follow the same palette.

1033 assertions across five suites.

## [3.3.0] — 2026-09-10

### Added

- **gRPC-Web bodies are read.** gRPC does not travel through a browser as-is: HTTP/2 and
  HTTP trailers are out of reach of page code, so what actually gets captured is gRPC-Web.
  Its body is a run of length-prefixed frames, and the panel now decodes them, along with
  the protobuf inside each one — the protobuf decoder was already there.

  What matters most is the trailers frame. **A gRPC-Web call can answer HTTP 200 and still
  have failed**: the verdict lives in `grpc-status`, never in the HTTP status. That is the
  classic trap of the protocol, and it is now stated plainly, with the status name and what
  it means. Compressed frames say so instead of being handed to the protobuf decoder, which
  would produce nonsense. A body cut short by the capture limit is reported as truncated
  rather than passed off as complete.

  Both encodings are handled: `application/grpc-web+proto` and the base64
  `application/grpc-web-text+proto`.

- **CORS preflights are paired with the request they authorised.** When a CORS request
  fails, the browser shows the error on *that* request — while the cause sits in the
  response to the `OPTIONS` a few rows above, usually already forgotten.

  Each preflight is now matched with the request that followed it, and the panel says
  whether the response actually permitted it, citing the header that decided: a missing
  `Access-Control-Allow-Methods`, an origin that does not match, a header left out of
  `Access-Control-Allow-Headers`, a preflight that answered 4xx — and the rule most often
  forgotten, `Access-Control-Allow-Origin: *` together with credentials, which no browser
  accepts and which produces an error mentioning neither.

  The rules are those of the Fetch specification, including the details that trip people
  up: safelisted methods need no mention, safelisted headers need no permission, and `*` in
  `Access-Control-Allow-Headers` does not cover `Authorization`.

  A preflight with no request after it is reported too — that absence is itself an answer.

### Fixed

- `lireGrpcWeb` accepted a base64 string whose length was not a multiple of four. The
  alphabet check passed, then `atob` threw a `DOMException` that no caller was prepared for.
  Found by feeding degenerate input to every function that reads a value off the wire.

### Checked

- Every one of the 134 transformations was called with 42 degenerate inputs — empty
  strings, lone surrogates, control bytes, truncated JSON, ten-thousand-character
  strings - for 5628 calls in total. None crashes; each either answers or refuses
  explicitly. The same sweep over the 26 functions that read headers, bodies and frames
  found exactly one unhandled path, the one fixed above.

1033 assertions across five suites.

## [3.2.0] — 2026-09-09

### Added

- **Command palette** (`Ctrl+K`). Seventeen views, twenty-three tools and the header
  actions are reachable by name instead of by hunting. Typing filters on subsequences, so
  three letters are usually enough: `chm` finds *Sites and paths*, `cook` finds *Cookies*.
  Matched letters are highlighted, so you can see why a result ranked where it did.

  The ranking is deliberately predictable rather than clever - a word start beats a letter
  in the middle, a short label beats a long one, and ties keep declaration order. The same
  letters always bring back the same first result, which is what makes it usable once you
  know it by heart.

  The registry is built from the real `VIEWS` and tool tables, never from a copied list: a
  view added later appears in the palette without anyone remembering to register it, and a
  view removed disappears from it.

- **WebSocket subprotocol decoding.** A frame reading `42["order",{"id":77}]` says nothing
  as it stands. It is an Engine.IO type-4 packet carrying a socket.io type-2 event named
  `order`, and the Live streams view now says so above the raw frame, which stays visible.
  **Engine.IO / socket.io**, **STOMP 1.2** and **SignalR** are read, each following its
  published specification; when the shape does not match, nothing is invented.

  The probe now also records the subprotocol the server actually *negotiated* - it was only
  sending the list the page requested, and the server's choice is what decides how to read
  the frames that follow. That choice disambiguates: a frame reading `2` is an Engine.IO
  ping as readily as it is plain text.

- **HAR export with secrets masked**, next to the faithful one. A HAR is made to be
  shared - attached to a ticket, sent to a colleague, dropped into an online analyser - and
  it carries the `Authorization` header, session cookies and API keys pasted into a URL.
  Exporting and sharing is disclosing.

  The sanitised export blanks secret-bearing headers by name, query parameters whose name
  announces a secret, and anything the analyser's own patterns recognise wherever it sits,
  response bodies included. It reuses those patterns rather than keeping a second list, so
  what the analyser flags is exactly what the export masks. The file states how many values
  it masked, so a sanitised export is never mistaken for traffic that had nothing to hide.
  The faithful export stays: you need it to replay.

### Fixed

- The keyboard handler called `ev.target.matches()` without checking there was an element
  to call it on. An event addressed to the document itself has no `matches`, and the whole
  handler threw before reaching any shortcut.

960 assertions across five suites.

## [3.1.1] — 2026-09-09

### Fixed

Two whole views were still French while the interface was in English, and the
test that was supposed to catch exactly that could not see them.

- **System state.** Every one of its labels goes through the dictionary, but
  none had an entry, because they live in `grid([['Label', value]])` tables
  rather than in literal `t('...')` calls - and the coverage test only ever
  read literal calls. Its values were worse: `"yes · API yes"`, `"3 blocked ·
  1 redirected"` and the rest were assembled with `+` at runtime, so no key
  could ever match them. They are templates filled in by `tp()` now.
- **The rules view.** The sentence that tells you in plain language what a rule
  will do - *"If host contains "api.example.com", then the request leaves 750
  ms late"* - was concatenated the same way. That is the sentence you read
  before turning on something that modifies traffic, so it mattered most.
- **The search-syntax table** in the help, whose 38 field descriptions come
  from `FIELDS` in `filters.js`, and three help paragraphs built inline.
- **The column list** in the settings showed `"Heure — Heure"`: neither half
  went through the dictionary.
- **Nine `aria-label` attributes** stayed French in English mode. They are
  invisible, but they are the only name a screen reader gets.
- The masked-secret preview ended in `car.`, an abbreviation the kernel emits
  itself - and the kernel has no dictionary. It now shows the length alone,
  which reads the same in every language.

### Changed

- `node tools/captures.mjs --texte --lang=fr|en` writes what each view
  actually renders instead of screenshots. Rendering twice and diffing is the
  only check that nothing can slip past: a fragment identical in both
  languages is either a proper noun or a missing translation. It found all of
  the above, and took the count from 126 suspects to 36 - all of them sample
  URLs, API names, or words that are the same word in both languages.
- The coverage test now compares runtime values rather than source literals,
  so a string containing a backslash matches its entry instead of being
  reported as untranslated.
- Screenshots show the real version from the manifest, and the author no
  longer renders as `undefined` in the help.

## [3.1.0] — 2026-09-08

### Changed

- **New icon.** The previous one was Mozilla's Firefox Developer Edition logo. The file is
  MPL-2.0, but the Firefox logo is a registered trademark of the Mozilla Foundation, and a
  third-party add-on carrying it implies an endorsement that does not exist - which is a
  rejection ground on addons.mozilla.org. The replacement is an original drawing under the
  same MIT licence as the rest of the repository: three traffic rows of unequal width,
  crossed by the vertical interception bar, with the green capture indicator from the
  console header. `node tools/apercu-icone.mjs` renders it at the sizes Firefox actually
  uses, on light and dark backgrounds, because an icon is judged at 16 px in a toolbar.

### Fixed

- **The settings page was half French in English mode.** Its text lives in a table and is
  rendered through `t(group.note)` and `t(field[3])`; the coverage test only ever read
  literal `t('...')` calls, so 73 visible strings had no dictionary entry and silently fell
  back to French. All translated, and the test now imports the tables themselves.
- **Two settings texts bypassed the dictionary entirely.** The quick-profile summary
  concatenated names and descriptions straight into the DOM, and the language hint
  interpolated a computed number into its own string, which no key can ever match. The
  latter is now a template filled in by `tp()` after translation.
- **Figures that had drifted**, each recounted against the code: 144 -> 154 modules,
  ~28,000 -> ~30,800 lines, 101 -> 113 interface modules, five -> six view families,
  seven -> eight capture layers, 883 -> 895 assertions. And one that was wrong rather than
  stale: "six layers see the same request", repeated in seven places, when only three can
  produce a record for one real request - `webRequest`, the page probes and
  `PerformanceObserver`. `tls` and `proxy` only tag a record that already exists.

### Added

- `tools/banniere.mjs` renders the social preview card GitHub serves to X, Reddit, Discord
  and LinkedIn, built from the real console screenshot rather than a mockup.
- The test suite now recounts every figure the README quotes, and `build.ps1` refuses to
  package when the assertion badge disagrees with what the five suites actually report. The
  count had been wrong three times before this.

## [3.0.0] — 2026-09-07

First public release.

### Added

- **Eight capture layers** running in parallel: `webRequest` (9 events), response bodies via
  `StreamFilter`, TLS via `securityInfo`, DNS resolution, navigation context, cookie
  mutations, page probes (`fetch`, `XHR`, WebSocket, SSE, Beacon, WebRTC, Service Workers,
  JS stacks, `PerformanceObserver`), and an optional passive proxy layer.
- **Anti-duplicate correlator**: one real request produces one row, whichever layers saw it.
  Observations with no parent are promoted to their own row rather than dropped.
- **17 views** across traffic, logs, tools, traffic control, system and learning.
- **12-tab detail panel**, including a Raw tab that prints the complete record.
- **Security analyser** that only reports provable, exploitable findings, each carrying its
  evidence.
- **Toolbox**: 125 transformations in 23 families, all computed locally.
- **Rule engine**: block, redirect, upgrade to HTTPS, rewrite headers, mock responses,
  inject latency, replace body patterns. Off by default.
- **Manual interception** with an auto-release safety net.
- **Request replay** with full editing.
- **Export** to HAR 1.2, JSON, CSV, Postman, Markdown report, URL list; **code generation**
  in 39 formats; **import** from HAR, session JSON and `curl`.
- Bilingual interface (English / French), four ready-made capture profiles, and offline
  reference tables covering 62 statuses, 129 headers, 70 media types, 83 ports, 31 TLS
  cipher suites, TLS alerts, QUIC and HTTP/3 errors, and DNS records.

### Fixed

- **Rule engine — unparseable URL expression widened a rule instead of narrowing it.**
  A malformed regular expression compiled to `null`, which the matcher read as "no URL
  condition", so the rule matched *all* traffic. A forgotten parenthesis on a blocking rule
  would have blocked the entire browser. Such a rule is now inert, and the interface says so.
- **`build.ps1` could not be parsed by Windows PowerShell 5.1.** The file was UTF-8 without
  a BOM and contained em dashes, which the default `powershell.exe` reads as ANSI,
  desynchronising the parser. The script is now ASCII and runs on both 5.1 and 7.
- **`windowId` was captured but never displayed**, contrary to the project's own rule that
  every captured field is shown somewhere.
- **English mode was incomplete.** The status bar, the severity tiles, the quick-filter
  chips, the follow button, the journal labels, the rule action names, the size units and
  the resource-type labels were rendered without going through the translation function, or
  were built before the language was known. In English they stayed French. Every call site
  now translates, the affected views rebuild when the configuration arrives, and a new test
  fails the build if any displayed string lacks a dictionary entry.
- **CSP findings could not be translated.** They were assembled by string concatenation, so
  the resulting sentence never matched a dictionary key. They are now templates plus values,
  the same convention the analyser already used for its evidence.

### Added after the first release

- **HPACK header decompression (RFC 7541).** An HTTP/2 HEADERS frame carries a
  compressed block, and the frame decoder used to stop at its edge with "compressed
  HPACK, not decompressed here". It now reads the block through: prefixed integers
  (section 5.1), literal strings with Huffman coding (section 5.2 and Appendix B),
  the 61-entry static table, and a dynamic table carried across the frames of a
  connection. Verified against every complete example in Appendix C, and against the
  published Huffman encoding of `www.example.com`.

- **Header parameter encodings (RFC 8187, 2231, 2047, 6266).** A real
  `Content-Disposition` rarely says `filename=report.pdf`; it says
  `filename*=UTF-8''%e2%82%ac%20rates`, sometimes split across `name*0`/`name*1`
  continuations, sometimes carrying an email-style `=?UTF-8?B?...?=` word. All three
  are now decoded, the extended form takes priority over the plain one as RFC 6266
  requires, and the header analyser shows the real filename instead of the raw value.
  Path traversal, control characters and bidirectional marks in a proposed filename
  are reported. Three matching transformations were added to the toolbox.

- **Transport encodings and 64-bit digests.** Z85 (ZeroMQ RFC 32) and uuencode
  (POSIX) join the alphabet family; SipHash-2-4 and xxHash64 join the digests;
  the JWT panel gains the JWK thumbprint of RFC 7638. Z85 matches the vector
  published in the ZeroMQ specification, SipHash matches the five reference
  vectors of its own implementation, xxHash64 matches the documented value for
  the empty input, and the thumbprint matches the example in RFC 7638 section 3.1.
  132 transformations in total.

- **Structured fields (RFC 8941).** Modern HTTP headers share one grammar — list,
  dictionary or item, built on six base types. `Priority: u=1, i` is now read as a
  dictionary of two members, one of them an implicit boolean, instead of an opaque
  string. Nine headers are parsed with the form their own specification requires.
  Checked against the examples of sections 3.1 to 3.3.

- **PHP `serialize()`.** The format turns up constantly in session cookies, hidden
  fields and job queues, and stayed opaque without a reader. All forms are parsed —
  null, boolean, integer, float including `INF` and `NAN`, string counted in *bytes*,
  array, object, PHP 8.1 enum, and both reference kinds — along with the NUL-encoded
  `protected` and `private` visibility that would otherwise print as invisible
  characters. Nothing is executed: the structure is read, no object is reconstructed.
  Two more transformations, 134 in total.

- **Identifiers are decoded, not merely recognised.** The Identify panel reported
  "looks like a UUID" and stopped there. It now reads what the identifier actually
  contains: a UUID gives its version, its variant and — for v1, v6 and v7 — the
  timestamp, clock sequence and node it embeds, including whether that node is a real
  machine address or a random draw. ULID, Snowflake (Twitter, Discord, Instagram),
  MongoDB ObjectId and KSUID give their creation date, machine, sequence and counter.
  When several readings hold, all are shown with their dates: the tool proposes, it
  does not choose. Checked against the RFC 9562 worked example, Discord's documented
  snowflake, the KSUID reference example, and the 48-bit bound of the ULID timestamp.

- **The toolbox is organised by intent.** Twenty-three tools sat in one flat row of
  tabs that wrapped onto two lines and could not be scanned. They are now grouped into
  six named families — decode and convert, encryption and digests, network and HTTP,
  read and measure, search and compare, produce — so you look for what you want to do
  rather than for a tool name.

- **Three more timestamp origins**, bringing the total to fourteen read side by side:
  NTP (RFC 5905, seconds since 1900), GPS (seconds since 6 January 1980), and the
  packed 32-bit MS-DOS date used in ZIP archives, whose fields are juxtaposed bits
  rather than a count and whose resolution is two seconds.

- **A neon visual direction, with readability enforced rather than assumed.** Deep
  indigo surfaces, a violet accent, neon state colours, rounded cards with a glow on
  their border. The glow stays on edges and never sits behind text, where it would
  blur it. Every colour pair declared in the theme is now measured against the WCAG
  2.1 contrast formula by `tests/contraste.mjs`, and the build stops if one falls
  below the reading threshold: 39 pairs per theme, all passing, the tightest at 4.53
  against a threshold of 3. The high-contrast setting switches gradients and glows
  off entirely rather than dimming them, and reduced-motion removes the hover lift.

### Fixed after the first release

- **The table jumped while scrolling with the wheel.** The two spacers that hold the
  place of the undrawn rows were rounded independently. With a fractional row height —
  which is what `calc(28px * scale)` produces at any zoom other than 100% — their sum
  changed by up to a pixel at every notch, so `scrollHeight` moved under the scrollbar
  and the content shifted. The spacers are now exact, so spacer + drawn rows + spacer
  always equals the total height. Measured over sixty real wheel events: the old
  arithmetic produced fourteen different total heights, the new one produces a single
  constant. The window computation moved into `ui/lib/fenetre-virtuelle.js`, a pure
  function with its own tests, and the table is no longer rebuilt when the visible
  window has not moved.
- **Five views silently truncated long lists.** Beyond the internal logs and the
  Security view, the live streams stopped at 200 connections, the site map at 200
  requests per path, and JSON path search announced a result count larger than what
  it drew. All now render in batches; no list is capped.
- **Two views froze on long lists, and silently truncated them.** The internal logs
  built up to three thousand rows in one pass and dropped the rest; the Security view
  did the same at two thousand findings. Both now render in batches through
  `ui/lib/liste-progressive.js`: the first batch is immediate, the next arrive as you
  approach the bottom, and nothing is capped. Measured on four thousand findings: 150
  cards drawn at once, the rest following the scroll.
- **Two colour pairs in the light theme were below the reading threshold** and had
  been since the first release: white on the accent button (4.03) and amber on a light
  surface (4.43). Both corrected, both now measured by the test.
- **Nine translation keys were defined twice**, the later one silently overriding the
  earlier. Two were user-visible mistakes: the `Duration` column showed *Lifetime*, and
  *Active interception* stayed in French. All duplicates are gone, and a test now fails
  the build if any key is defined more than once.

### Internal

- Six finished modules were reachable from no import — 886 lines of RFC-accurate code that
  never ran. They are now wired where the data is:
  CSP analysis and RFC 9111 cache freshness into the Headers tab, `multipart/form-data`
  decoding into the Request tab, RFC 3986 canonical URLs and homograph detection into the
  URL panel, reverse DNS names into the Address panel, WebSocket and HTTP/2 frame decoding
  into the Binary panel, and TLS / QUIC / HTTP-3 / DNS tables into the Reference panel.
- Test suite added: 1081 assertions across five suites, running under Node with no browser
  and no dependencies, validated against published RFC vectors. `build.ps1` already required
  these suites but the directory was absent, so packaging failed wherever Node was
  installed.
- Documentation screenshots are generated by `tools/captures.mjs`, which renders the real
  console against the real kernel rather than producing mockups.

[3.9.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.9.0
[3.8.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.8.0
[3.7.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.7.0
[3.6.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.6.0
[3.5.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.5.0
[3.4.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.4.0
[3.3.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.3.0
[3.2.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.2.0
[3.1.1]: https://github.com/isneoz1/interceptor/releases/tag/v3.1.1
[3.1.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.1.0
[3.0.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.0.0
