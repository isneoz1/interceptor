# Changelog

All notable changes to this project are documented here.
Format based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versioning follows
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.0.0] — 2026-09-07

First public release.

### Added

- **Seven capture layers** running in parallel: `webRequest` (9 events), response bodies via
  `StreamFilter`, page probes (`fetch`, `XHR`, WebSocket, SSE, Beacon, WebRTC, Service
  Workers, JS stacks), `PerformanceObserver`, TLS via `securityInfo`, DNS resolution, cookie
  mutations, navigation context, and an optional passive proxy layer.
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
- **Two views froze on long lists, and silently truncated them.** The internal logs
  built up to three thousand rows in one pass and dropped the rest; the Security view
  did the same at two thousand findings. Both now render in batches through
  `ui/lib/liste-progressive.js`: the first batch is immediate, the next arrive as you
  approach the bottom, and nothing is capped. Measured on four thousand findings: 150
  cards drawn at once, the rest following the scroll.
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
- Test suite added: 822 assertions across five suites, running under Node with no browser
  and no dependencies, validated against published RFC vectors. `build.ps1` already required
  these suites but the directory was absent, so packaging failed wherever Node was
  installed.
- Documentation screenshots are generated by `tools/captures.mjs`, which renders the real
  console against the real kernel rather than producing mockups.

[3.0.0]: https://github.com/isneoz1/interceptor/releases/tag/v3.0.0
