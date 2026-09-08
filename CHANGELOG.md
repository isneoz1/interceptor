# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
  seven -> eight capture layers, 883 -> 892 assertions. And one that was wrong rather than
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
- Test suite added: 892 assertions across five suites, running under Node with no browser
  and no dependencies, validated against published RFC vectors. `build.ps1` already required
  these suites but the directory was absent, so packaging failed wherever Node was
  installed.
- Documentation screenshots are generated by `tools/captures.mjs`, which renders the real
  console against the real kernel rather than producing mockups.

[3.1.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.1.0
[3.0.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.0.0
