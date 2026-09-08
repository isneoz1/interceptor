/* English content for the Help and Tutorial views — INTERCEPTOR (by NeoZ)
 *
 * The French text lives in the views themselves; this file mirrors it in
 * English so the language switch changes everything, not just the labels.
 */

export const HELP_SECTIONS = [
  {
    h: 'Where to start',
    p: ['New here? Open the **Tutorial** in the sidebar: twelve guided lessons whose buttons really perform the action described, and whose checkboxes read your real capture. This page is the full reference, to keep at hand.'],
    ul: []
  },
  {
    h: 'Three steps to get going',
    p: ['INTERCEPTOR starts on its own and captures continuously. There is nothing to configure to begin.'],
    ul: [
      '1. Browse normally: every request appears live in the Requests view.',
      '2. Click a row: the bottom panel shows EVERYTHING captured, tab by tab.',
      '3. The left sidebar gives access to security alerts, streams, logs and settings.'
    ]
  },
  {
    h: 'The three windows',
    p: ['The same interface comes in three shapes, your choice.'],
    table: [
      ['Full console', 'Full-screen tab. Alt+Shift+I, or Actions -> Open in a tab.'],
      ['Sidebar panel', 'Stays beside the page while you browse. Alt+Shift+S.'],
      ['Compact window', 'Click the toolbar icon. Ctrl+Shift+Y.']
    ]
  },
  {
    h: 'Keyboard shortcuts',
    table: [
      ['/', 'Focus the search box'],
      ['Arrow up / down', 'Previous / next request when the detail is open'],
      ['Esc', 'Close the detail, a menu or the shortcut sheet'],
      ['P', 'Pause or resume capture'],
      ['F', 'Follow the live flow, or freeze it'],
      ['C', 'Compare the two selected rows'],
      ['S', 'Save the current filter'],
      ['1 to 9', 'Jump to a view'],
      ['?', 'Show the shortcut sheet'],
      ['Ctrl+click', 'Add a row to the selection'],
      ['Shift+click', 'Select a range of rows'],
      ['Right click', 'Row context menu'],
      ['Ctrl+Shift+U', 'Pause / resume, even outside the console']
    ]
  },
  {
    h: 'The request table',
    ul: [
      'Columns: the Columns button offers more than thirty. Your choice is kept.',
      'Sort: click a column header; click again to reverse the order.',
      'Resize: drag the right edge of a header. Widths are remembered.',
      'Follow: the table sticks to the newest requests, and freezes as soon as you scroll up.',
      'Selection: Ctrl+click and Shift+click. Exports and deletion then act on the selection.',
      'Pin: the star column marks a row so the "flag:" filter can find it again.',
      'No display cap: only visible rows are drawn, the whole list stays reachable.'
    ]
  },
  {
    h: 'The views',
    table: [
      ['Requests', 'The full flow, with the twelve-tab detail panel.'],
      ['Security', 'Every alert found automatically, sorted by severity.'],
      ['Summary', 'Session aggregates: statuses, types, heaviest domains, slowest requests, throughput over time.'],
      ['Comparison', 'Two selected requests, compared line by line (headers and bodies).'],
      ['Live streams', 'WebSocket and Server-Sent Events, message by message, live.'],
      ['Cookies', 'Every cookie set, changed or removed, including those written in JavaScript.'],
      ['Navigation', 'The eight Firefox navigation events.'],
      ['Context', 'Workers, Service Workers, WebRTC, WebTransport, page perception metrics.'],
      ['Diagnostics', 'Real state of every layer, core figures, coverage test.'],
      ['Rules', 'Blocking, redirecting, header rewriting and response mocking, with a visual editor.'],
      ['Toolbox', 'Twenty-one families of tools on a single working text: encodings, encryption, binary formats, certificates, hashes, network, headers, timestamps, HTTP reference.'],
      ['Settings', 'Everything configurable, with ready-made profiles.'],
      ['Tutorial', 'Twelve guided lessons with progress tracking.']
    ]
  },
  {
    h: 'The toolbox',
    p: [
      'One working text, twenty-one tabs looking at it. You paste a value once — from the clipboard, from a row context menu, or from a detail tab — and every tool works on it. Everything is computed in the page: none of these functions sends a single request.'
    ],
    table: [
      ['Transform', '121 transformations in eighteen families: base64 and base64 URL, base32, base58, base45, Ascii85, URL, HTML entities, hexadecimal, binary, octal, Unicode escapes, punycode, JSON, YAML, CSV, XML, gzip and deflate, letter case, lines, string escaping, Protocol Buffers, MessagePack, CBOR, ASN.1. "Try everything" applies every decoding and keeps only the readable results.'],
      ['Keys and trials', 'XOR with a repeated key, a sweep of the 255 single-byte keys, all twenty-five Caesar shifts, Vigenere. These ciphers protect nothing: they read back a deliberately obscured value.'],
      ['JWT', 'Header, payload, validity, time left. The signature is really verified across the twelve common algorithms: HS256 to HS512 with the shared key, RS, PS and ES with the public key pasted as PEM or JWK. With no key the screen says so, rather than letting a decoded token pass for a valid one.'],
      ['Encryption', 'AES-GCM, AES-CBC and AES-CTR both ways, with initialisation vector and authenticated data; PBKDF2 and HKDF derivation; verification of a detached RSA, RSA-PSS, ECDSA or HMAC signature. Everything goes through the browser engine, nothing leaves the machine.'],
      ['Hashes', 'MD5, SHA-1, SHA-256, SHA-384, SHA-512, CRC-32, Adler-32, FNV-1a, djb2, byte sum, and HMAC with a key.'],
      ['Binary', 'Protocol Buffers, MessagePack and CBOR read byte by byte, without a schema; ASN.1, DER and a summary of an X.509 certificate (subject, issuer, validity, names covered, usages); thirty-seven character sets and mojibake repair.'],
      ['Measurements', 'Characters, bytes, lines, words, Shannon entropy, character frequency, and detection of the invisible characters used to hide content.'],
      ['Hexadecimal', 'The classic dump: offset, sixteen bytes, readable column.'],
      ['Identify', 'What the shape of the text suggests: hash family, file signature in the first bytes, alphabet used. Candidates, never a verdict.'],
      ['Timestamp', 'Eleven possible epochs (Unix in seconds, milliseconds, microseconds and nanoseconds, Windows FILETIME, Chrome, HFS, Apple, .NET ticks, Excel serial, Julian day) and every notation of one instant. It also reads durations written "1d12h".'],
      ['Numbers', 'An integer rewritten in every base, without losing a digit, with its properties and its reading as an IPv4 address or a port.'],
      ['Structures', 'URL parameters, cookies and headers recognised in the pasted text.'],
      ['Headers', 'Twenty-four headers broken down in detail: Set-Cookie and its attributes, content security policy, HSTS, Cache-Control, weighted Accept, Authorization. Every real gap is flagged — a missing attribute, a directive that cancels the protection.'],
      ['Find', 'Twenty ready-made patterns (email, address, hash, token, private key), paths inside a JSON document, CSS and XPath selectors in HTML, and the Luhn checksum.'],
      ['Regular expression', 'Matches, captured groups, position, and the replacement applied.'],
      ['Compare', 'The working text against another one: lines added, removed, in common, the first difference down to the character, word-by-word comparison and the unified format.'],
      ['URL', 'Every part of a URL, the service known behind the port, and a warning when a punycode domain looks like another one.'],
      ['IP address', 'Full subnet computation for IPv4 or IPv6: mask, wildcard, network, broadcast, usable range, reverse name, category (RFC 1918, 6598, 4193...) and a membership test against a prefix. Plus splitting into subnets, summarising a list of prefixes, turning a range into prefixes and enumerating addresses.'],
      ['Reference', 'Offline: 62 status codes, 9 methods and their properties, 129 HTTP headers, 70 media types, 83 ports, 31 TLS cipher suites with their strength, 16 WebSocket close codes, 14 HTTP/2 errors and 27 Firefox network error codes. A search field covers names and descriptions alike.'],
      ['Generate', 'UUID v3, v4, v5 and v7, ULID, NanoID, random sequences, passwords with their real entropy, hardware address, private address, dynamic port, and sixteen edge-case values that break sloppy validators.'],
      ['Import a request', 'A cURL command or a raw HTTP request becomes a row in the table, in the "pending" state. It is not sent: the "Replay" tab of its detail does that, if you ask for it.']
    ]
  },
  {
    h: 'What is captured',
    p: ['Several layers watch the traffic in parallel, then a correlator merges them.'],
    table: [
      ['webRequest', 'The 9 network lifecycle events, on every URL.'],
      ['StreamFilter', 'Full response bodies. The stream is rewritten byte for byte to the page: capturing cannot break a site.'],
      ['Page probes', 'fetch, XHR, sendBeacon, WebSocket frames, SSE messages, JavaScript stacks, Service Workers, WebRTC.'],
      ['PerformanceObserver', 'Precise timing, real protocol, sizes, Server-Timing. Sees even the memory cache.'],
      ['TLS and DNS', 'Version, cipher suite, full certificate chain; canonical name and addresses.'],
      ['Proxy', 'Routing decision. Optional, off by default.'],
      ['Firefox classification', 'The browser own tracking-protection verdict, separate from our list.'],
      ['JavaScript cookies', 'document.cookie writes, with the call stack that caused them.'],
      ['WebTransport', 'HTTP/3 sessions, when the API exists in this Firefox.'],
      ['Page perception', 'First paint, largest contentful paint, layout shifts, long tasks.']
    ]
  },
  {
    h: 'Why there are never duplicates',
    p: [
      'Three layers can see the same request: webRequest, the page probes and PerformanceObserver. Without correlation, one row per layer would appear.',
      'webRequest is authoritative: its requestId is unique, redirects included. An observation from another layer joins a row only if that layer has not already contributed to it. An observation that finds no home becomes its own row: nothing is ever lost.',
      'The Layers column shows who fed each row: WR webRequest, JS page probes, PF performance, TLS, PX proxy.'
    ]
  },
  {
    h: 'Automatic analysis: only demonstrable flaws',
    p: ['Every finished request is audited without any action from you. One rule governs the whole list: an alert only comes out if it is DEMONSTRABLE from what was captured, and if it matches a genuinely exploitable flaw. Every alert shows its evidence — the observed fact that justifies it.'],
    ul: [
      'Exposed secret: 61 vendor-specific formats (AWS, GitHub, GitLab, Stripe, Slack, npm, Datadog, PEM private keys...). Those formats cannot be confused with anything else.',
      'Credentials written in the URL, or a token passed in the query string: the value ends up in logs, history and the Referer header.',
      'JWT signed with « alg: none »: its payload can be changed without any key.',
      'Sent in the clear: http carrying a cookie, an Authorization header or a body — therefore interceptable and alterable.',
      'Mixed content, untrusted certificate, domain mismatch, expired certificate, TLS 1.0 or 1.1, broken cipher suite.',
      'Exploitable CORS: origin mirrored back, or « null », with Allow-Credentials — any site can then read the authenticated response.',
      'Cookies: set in the clear without Secure, __Host- or __Secure- prefix not respected, SameSite=None without Secure — cases where the browser rejects the cookie.',
      'Your own patterns: Settings -> Analysis -> Custom secret patterns.'
    ]
  },
  {
    h: 'Exports',
    table: [
      ['HAR 1.2', 'Read by Firefox DevTools, Charles, Fiddler, Postman. Enriched with layers, TLS, stacks and alerts.'],
      ['JSON', 'Complete records and core statistics.'],
      ['CSV', 'Spreadsheet-friendly table, UTF-8 with BOM.'],
      ['Markdown', 'Alert report sorted by severity.'],
      ['cURL script', 'Every filtered request, ready to replay from a terminal.'],
      ['Postman collection', 'v2.1 format, grouped by domain, with the responses actually observed.'],
      ['URL list', 'A text file, one URL per line.'],
      ['HAR import', 'Read a capture made elsewhere. A HAR exported by INTERCEPTOR comes back identical.']
    ],
    p: ['Per request, the Copy menu produces cURL, wget, HTTPie, fetch, Node, Python, PowerShell, the raw HTTP request or response, a Markdown sheet or the complete JSON record.']
  },
  {
    h: 'Changing traffic: rules and replay',
    p: [
      'By default INTERCEPTOR observes without ever modifying or emitting anything.',
      'The Rules view can block, redirect (with $1..$9 capture groups), force HTTPS, rewrite headers and mock a response. While mocking, the real server body is still recorded: the page receives the mock, you see both. The original status code is kept, because Firefox does not let an extension rewrite it.',
      'The Replay tab, inside a request detail, sends an editable copy of the request. Rules and replay are off by default and require explicit confirmation. Use them only on targets you are responsible for.'
    ]
  },
  {
    h: 'Real limits',
    p: ['No Firefox extension can go beyond these. Nothing is being worked around here.'],
    ul: [
      'Privileged pages: about:config, about:addons, New Tab, error pages. Every extension is barred from them.',
      'Domains reserved by Mozilla: accounts.firefox.com, addons.mozilla.org.',
      'Traffic outside Firefox: the browser is observed, not the system.',
      'JavaScript stacks for requests issued from a Worker.',
      'WebRTC data-channel payloads (signalling and candidates are logged).',
      'Brotli: Firefox usually decodes before us; gzip and deflate are decompressed when needed.'
    ]
  },
  {
    h: 'Extension security',
    ul: [
      'No network output, except two deliberate actions: the coverage test (towards the active tab own origin) and request replay.',
      'No innerHTML on captured data: an observed site cannot inject anything into this interface.',
      'No eval, no executed string. Strict CSP on extension pages.',
      'Random per-document token between page and extension; interface commands require an internal sender.',
      'Least privilege: the proxy and notifications permissions are optional and requested only when enabled.'
    ]
  },
  {
    h: 'Memory and performance',
    p: [
      'Every limit means 0 = unlimited by default. Without caps everything stays in RAM: over a long session with heavy streams, usage can reach several gigabytes.',
      'The Balanced profile in the settings applies sensible caps in one click.'
    ]
  }
];

export const LESSONS = {
  bienvenue: {
    title: 'Welcome',
    goal: 'Understand what INTERCEPTOR does',
    body: [
      { p: 'INTERCEPTOR watches everything Firefox sends and receives: pages, images, API calls, WebSockets, cookies, certificates. It starts on its own and needs no configuration.' },
      { p: 'Several capture layers watch the traffic at once, and a correlator glues them back together: one real request always yields one row, never two.' },
      { ul: [
        'The **console** (this page) is the full workbench.',
        'The **sidebar panel** follows traffic while you browse: Alt+Shift+S.',
        'The **compact window** (toolbar icon) is for a quick glance.'
      ] },
      { p: 'The green button at the top left shows capture is running. Click it to pause, click again to resume.' }
    ]
  },
  tableau: {
    title: 'Reading the table',
    goal: 'Know what each column tells you',
    body: [
      { p: 'Open a site in another tab, then come back: rows arrive live. The table has no display cap, even with hundreds of thousands of rows.' },
      { ul: [
        'The **colour bar** on the left shows the risk level found by the analysis.',
        'The **Layers** column shows who saw the request: WR webRequest, JS page probes, PF performance, TLS, PX proxy.',
        'Clicking a **column header** sorts; a second click reverses the order.',
        'The **Columns** button offers more than thirty: add Server, Protocol or Tags.',
        'The **Follow** button sticks the view to the newest requests; it freezes as soon as you scroll up.'
      ] },
      { p: 'Ctrl+click adds a row to the selection, Shift+click selects a range. Exports and deletion then act on the selection.' }
    ]
  },
  filtrer: {
    title: 'Filter and search',
    goal: 'Find one request among thousands',
    body: [
      { p: 'The search box takes free text, but above all precise criteria. Type, and the list narrows instantly.' },
      { code: 'method:POST          POST requests\nstatus:>=400         everything failing\nhost:api.example.com one domain\nsize:>100000         large responses\nduration:>1000       slow requests\ntag:tracker          what the analysis flagged\n-image               exclude images\n/\\/v[0-9]+\\//        regular expression' },
      { p: 'The chips under the toolbar are one-click filters: API, Pages, Errors, Alerts, Third-party, Streams, Pinned…' },
      { p: 'The **bodies** checkbox hands the search to the core: it then searches bodies, headers, WebSocket frames and JavaScript stacks. Bodies never travel to the interface in bulk.' }
    ]
  },
  detail: {
    title: 'The request detail',
    goal: 'See everything about one request',
    body: [
      { p: 'Click a row: the bottom panel opens with twelve tabs. Drag the grey bar to resize it, and move between requests with the up and down arrows.' },
      { ul: [
        '**Overview**: method, status, server, DNS, TLS, context, layers, applied rules.',
        '**Headers**: URL parameters, sent and received headers, click to copy.',
        '**Request** / **Response**: the full body, formatted or raw, hex preview, image displayed.',
        '**Cookies**: parsed Set-Cookie, observed changes, cookies of the domain.',
        '**Security**: TLS version, cipher suite, whole certificate chain.',
        '**Alerts**: what the analysis found, with the value masked.',
        '**Streams**: WebSocket frames and SSE messages.',
        '**Timing**: DNS, connect, TLS, wait, receive, redirects.',
        '**JS stack**: the line of code that triggered the request.',
        '**Replay**: send the request again after editing it.',
        '**Raw**: the complete record, field by field.'
      ] },
      { p: 'The **Copy** menu produces the request as cURL, wget, HTTPie, fetch, Node, Python, PowerShell, raw HTTP, Markdown or JSON.' }
    ]
  },
  securite: {
    title: 'Security alerts',
    goal: 'Read what the analysis finds on its own',
    body: [
      { p: 'Every finished request is audited automatically: API keys, tokens, passwords, e-mails, card numbers validated with the Luhn checksum, cleartext HTTP, dubious certificates, missing security headers, permissive CORS, badly protected session cookies, trackers.' },
      { p: 'Sensitive values are **masked** by default: a key shows as "sk_liv…C0 (32 chars)". Masking can be turned off in the settings when you must see the whole value.' },
      { p: 'The Security view gathers everything, sorted by severity. Clicking an alert opens the request concerned.' },
      { p: 'You can add **your own secret patterns** and **your own tracking domains** in the settings; the format is "Name = regular expression = severity".' }
    ]
  },
  flux: {
    title: 'Streams, cookies and logs',
    goal: 'See what the network alone does not show',
    body: [
      { p: '**Live streams** follows WebSockets and Server-Sent Events message by message, both directions. webRequest only sees the handshake: the content comes from probes placed inside the page.' },
      { p: '**Cookies** logs every set, change and removal, including cookies written in JavaScript, with the call stack that wrote them.' },
      { p: '**Navigation** lists the eight Firefox navigation events. **Context** gathers Workers, Service Workers, WebRTC, WebTransport and page perception metrics (first paint, largest element, layout shifts).' }
    ]
  },
  synthese: {
    title: 'The figures summary',
    goal: 'Step back and look at a whole session',
    body: [
      { p: 'The **Summary** view aggregates the current capture: status and type breakdown, heaviest domains, slowest requests, third-party share, volume exchanged, throughput over time.' },
      { p: 'Every figure comes from the real records of the chosen scope. Change the scope at the top right to compare one tab with the whole of Firefox.' }
    ]
  },
  exporter: {
    title: 'Export and compare',
    goal: 'Get the data out and confront two requests',
    body: [
      { ul: [
        '**HAR 1.2**: read by DevTools, Charles, Fiddler, Postman.',
        '**Full JSON**: everything, including our extensions.',
        '**CSV**: for a spreadsheet.',
        '**Markdown** alert report.',
        '**cURL script**: every filtered request, ready to replay.',
        '**Postman collection**: grouped by domain, with the observed responses.',
        '**URL list**: a plain text file.'
      ] },
      { p: 'Exports cover the filtered rows, or your selection when you have one. The file is written by the core: closing this window interrupts nothing.' },
      { p: 'Select exactly **two** rows (Ctrl+click) then click **Compare**: header and body differences appear side by side.' },
      { p: 'You can also **import a HAR** captured elsewhere and read it here.' }
    ]
  },
  regler: {
    title: 'Tune the tool',
    goal: 'Fit the capture to your machine and your need',
    body: [
      { p: 'Every limit means **0 = unlimited** by default. Without caps everything stays in RAM: over a long session with heavy streams, usage can reach several gigabytes.' },
      { ul: [
        '**Maximum**: capture everything, no limits.',
        '**Balanced**: observe everything, but cap memory. The best everyday compromise.',
        '**Light**: very long sessions, modest machine.',
        '**Quiet observation**: metadata only, no content kept.'
      ] },
      { p: 'Each capture layer can be switched independently, and the Diagnostics view shows for each one the setting AND whether the API really exists in your Firefox.' },
      { p: 'Theme, language, density, time format, icon click behaviour and badge counter are set there too.' }
    ]
  },
  intervenir: {
    title: 'Changing traffic',
    goal: 'Block, redirect, mock, replay — knowingly',
    body: [
      { p: 'By default INTERCEPTOR **observes without ever changing anything**. Two mechanisms can change that, both off at first.' },
      { ul: [
        'The **rules engine**: block a request, redirect it, force HTTPS, rewrite headers, or **mock a response** (the real body is still recorded).',
        '**Replay**: send a request again after editing method, URL, headers or body.'
      ] },
      { p: 'Rules are built with fields and buttons, no JSON required. Five templates are provided. A rule always states in plain words what it will do, as "If … then …".' },
      { p: 'Use this only on targets you are responsible for.' }
    ]
  },
  outils: {
    title: 'The toolbox',
    goal: 'Decode, verify and build a value, without sending anything',
    body: [
      { p: 'One **working text**, twenty-one tabs looking at it. You paste a value once — from the clipboard, from a row context menu, or from the "Toolbox" button on a response body — and every tool works on it.' },
      { p: 'Everything is computed in the page. None of these tools sends a single request: not on load, not on click.' },
      { ul: [
        '**Transform**: 121 transformations. "Try everything" applies each decoding and keeps only the readable results — the right first move on an unknown value.',
        '**JWT**: header, payload, expiry, and the signature really verified when you provide the key (twelve algorithms, shared key or public key).',
        '**Encryption** and **Hashes**: AES, PBKDF2, HKDF, MD5, SHA, CRC-32, HMAC.',
        '**Binary**: Protocol Buffers, MessagePack, CBOR, X.509 certificates, character sets.',
        '**Headers**, **URL**, **IP address**: what the value really says, and what it lacks.',
        '**Reference**: statuses, headers, media types, ports, TLS cipher suites — offline.'
      ] },
      { p: 'A result can be taken as the input of another tool: you chain the steps without ever retyping anything.' }
    ]
  },
  limites: {
    title: 'Verify, and know the limits',
    goal: 'Know what is captured, and what cannot be',
    body: [
      { p: 'The **coverage test** in Diagnostics fires real requests from the active tab, towards its own origin only: fetch, POST with body, XHR, image, sendBeacon, EventSource, WebSocket and a script tag. It then counts the rows that appeared.' },
      { p: 'What no Firefox extension can do, and INTERCEPTOR therefore does not claim to do:' },
      { ul: [
        'Privileged pages: about:config, about:addons, New Tab, error pages.',
        'Domains reserved by Mozilla: accounts.firefox.com, addons.mozilla.org.',
        'Traffic outside Firefox: the browser is observed, not the system.',
        'JavaScript stacks for requests issued from a Worker.',
        'WebRTC data-channel payloads (signalling is logged).',
        'Brotli: Firefox usually decodes before us; gzip and deflate are decompressed.'
      ] },
      { p: 'That is everything. The reference help stays available at any time, and this tutorial can be restarted from the settings.' }
    ]
  }
};
