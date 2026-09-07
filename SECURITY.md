# Security policy

## Reporting a vulnerability

Please report security issues privately through
[GitHub Security Advisories](https://github.com/isneoz1/interceptor/security/advisories/new)
rather than in a public issue.

Include what you need to make the problem reproducible: the affected version, the steps, and
what an attacker gains. You will get an acknowledgement within a few days.

## Scope

INTERCEPTOR runs with broad browser permissions — `<all_urls>`, `webRequest`,
`webRequestBlocking`, `cookies`. That makes the following especially worth reporting:

| Area | Why it matters |
|---|---|
| **Command surface** (`background/api/rpc.js`) | Commands are meant to be reachable only from extension pages. A way to reach them from a web page would expose the whole capture. |
| **Page probes** (`content/hooks.js`, `content/bridge.js`) | These run in the page. A way for a page to forge observations, or to read another origin's data through them, is a vulnerability. |
| **Rule engine** (`background/rules/engine.js`) | A rule matching more traffic than it declares. This class of bug is already covered by tests — an escape from them is worth reporting. |
| **Body and header rendering** | Captured content is attacker-controlled by definition. Any path where it is interpreted rather than displayed is a vulnerability. |
| **Exports** | Data leaving through an export in a way the user did not ask for. |

## Out of scope

- The extension requiring broad permissions. That is what a network supervision tool does,
  and the permissions are listed with their justification in the README.
- Findings the security analyser does **not** report. The analyser deliberately only reports
  what it can prove; a missing hardening header is not treated as a vulnerability. If you
  think a rule should exist, open a normal feature request.
- Anything requiring the user to install a modified build.

## What INTERCEPTOR does with your data

Nothing leaves the machine. No telemetry, no account, no server. Captured traffic lives in
memory, and reaches disk only if you turn persistence on. See the *Privacy* section of the
README.
