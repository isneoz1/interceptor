# Publishing on addons.mozilla.org

Everything the AMO submission form asks for, ready to paste. Nothing here can be automated:
Mozilla requires a signed-in developer account, so these are the steps only you can take.

**Why it matters.** Right now the only way to install INTERCEPTOR is to sideload an unsigned
`.xpi`, which Firefox refuses outright on the release channel. That limits the audience to
people running Developer Edition, Nightly or ESR *and* willing to flip
`xpinstall.signatures.required`. AMO removes both barriers and adds its own search traffic.

---

## Before you submit

- [ ] **The add-on ID is now `interceptor@neoz`.** It becomes permanent the moment you first
      publish. Changing it later means publishing a different add-on and orphaning every
      existing install, so make sure it is what you want *before* the first upload.
- [ ] **Bump the version.** AMO refuses a version number it has already seen. The repository
      is at `3.5.0`, which has never been submitted, so it can go up as-is. Only bump again if
      a submission gets rejected and you need to resubmit.
- [ ] **Build a fresh package**: `npm run build` produces `dist/interceptor-<version>.xpi`.
- [ ] The reviewer will read the source. It is plain ES modules with no build step, no
      minification and no bundler, so no separate source upload is required — say so in the
      notes below.

---

## Listing fields

**Name**

```
INTERCEPTOR
```

**Summary** (250 characters max)

```
See every request Firefox makes: response bodies off the wire, the JavaScript stack behind each call, TLS and cookies. Block, rewrite or replay any of them. No duplicated rows, no telemetry, no dependencies.
```

**Categories**

Primary: *Privacy & Security*. Secondary: *Other*.
(AMO allows two per application.)

**Tags**

```
developer tools, network, http, debugging, security, privacy, websocket, interception
```

**Support site**

```
https://github.com/isneoz1/interceptor/issues
```

**Homepage**

```
https://github.com/isneoz1/interceptor
```

**Licence**

MIT (already declared in `LICENSE` and in the manifest metadata).

---

## Description

Paste as-is. AMO accepts a limited subset of HTML; plain paragraphs and lists are safest.

```
Firefox's own network panel tells you THAT a request happened. INTERCEPTOR tells you
everything about it — and lets you change it.

WHAT IT CAPTURES

Eight layers run in parallel, because none of them is enough alone:

• webRequest — the nine lifecycle events, on every URL
• StreamFilter — the full response body, read off the wire as it arrives
• Page probes — fetch, XMLHttpRequest, WebSocket frames, Server-Sent Events, sendBeacon,
  WebRTC, Service Workers, and the JavaScript call stack behind each one
• PerformanceObserver — catches even what the memory cache or a Service Worker serves,
  which webRequest never sees
• securityInfo — TLS version, cipher suite, the complete certificate chain
• DNS — canonical name and resolved addresses
• Cookies — every mutation, including those made from JavaScript
• Navigation — which document, which frame

ONE REQUEST IS ONE ROW

Several layers observe the same request. A correlator merges them, so you never see the
same call twice. Two identical polling GETs stay two separate rows, because they are two
separate requests. An observation that finds no parent becomes its own row rather than
being dropped — nothing captured is ever hidden from you.

WHAT YOU CAN DO WITH IT

• Read the complete record: headers, bodies, timings, TLS, cookies, stack, and a Raw tab
  that prints every field the extension holds
• Search with a real syntax: method, status, host, size, duration, content type, and more
• Block, redirect, or rewrite requests and responses with rules you build in the interface
• Pause a request before it leaves, edit it, then let it go
• Replay any request after confirmation
• Export to HAR, JSON, CSV or Postman, or generate ready-to-run code in 39 formats
  (curl, fetch, Python, PowerShell, Node, HTTPie and others)
• 134 local transformations across 23 tools: encodings, digests, JWT, OTP, timestamps,
  identifiers, structured headers, HPACK, and more

A SECURITY ANALYSER THAT DOES NOT GUESS

Every finished request is audited automatically: exposed secrets, credentials sent in
clear, exploitable CORS, cookies that will be rejected and why, obsolete TLS. It reports
only what it can demonstrate from the captured data, and masks sensitive values by default.

PRIVACY

Nothing leaves your machine. No telemetry, no analytics, no remote server, no external
dependency of any kind. Captured traffic lives in memory, and on disk only if you turn on
persistence — in your own browser's local storage.

Interface in English and French. Open source under the MIT licence.
```

---

## Permission justifications

Reviewers ask why each permission is needed. These are the real reasons.

| Permission | Why |
|---|---|
| `<all_urls>` | The point of the add-on is to observe traffic on whatever the user browses. Restricting it to a host list would mean it silently misses everything else. |
| `webRequest` | The primary capture layer: the nine network lifecycle events. |
| `webRequestBlocking` | Required to pause a request before it is sent so the user can edit or block it. Only active when the user turns interception on, and only while the console is open. |
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

webRequestBlocking is used solely for the interception feature, which is off by default,
requires the console to be open, and always releases a held request when its deadline
expires.
```

---

## After it is published

- Add the AMO install badge and link to the top of `README.md`.
- Add the AMO listing URL to the repository's homepage field.
- Upload `docs/images/social-preview.png` under **Settings → General → Social preview**;
  GitHub has no API for it, so it is a manual one-time step.
