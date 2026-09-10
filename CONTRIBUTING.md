# Contributing to INTERCEPTOR

Thank you for considering it. This file is the practical side — what to run, what the
conventions are, and what gets a change rejected. The [README](README.md) explains what the
project is and why it works the way it does.

---

## Before you write anything

**Open an issue first for anything beyond a small fix.** Not as bureaucracy: this project
turns down features regularly, and hearing that after you have written them is a waste of
your evening. A short description of what you want to add is enough.

The one rule that decides most of it:

> **No feature that claims something it cannot prove.**

INTERCEPTOR reports what it can demonstrate from captured data, and stays silent otherwise.
A heuristic that is right most of the time is not welcome here — a network tool that
occasionally invents a finding is worse than one that admits it does not know. This is why
there is no TLS fingerprinting, for instance: a WebExtension cannot see the ClientHello, so
any JA3 value would be fabricated.

---

## Running it

No dependencies, no build step, no package manager to configure.

```bash
git clone https://github.com/isneoz1/interceptor
cd interceptor
```

Load it in Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary
Add-on…**, pick `manifest.json`. Reload the add-on from that same page after each change.

---

## What must pass

```bash
npm test              # every assertion, five suites, no browser needed
.\build.ps1 -Verify   # file inventory, tests, and the figure checks
```

The build refuses to package when something is inconsistent, not only when a test fails:

- a colour pair in either theme drops below its WCAG 2.1 contrast threshold
- the assertion count in the README disagrees with what the suites report
- a translation key is defined twice, or a displayed string has none

That last one catches more than you would expect. **The French source text *is* the
translation key** — `t('Requetes')` looks up `'Requests'`. So a new user-visible string needs
an entry in `ui/lib/dict-en*.js`, and translating the source would break English mode
entirely.

If your string is assembled at runtime — `'Found ' + n + ' rows'` — it can never match a key.
Use a template instead: `tp('Found {n} rows', { n })`.

---

## Conventions

| | |
|---|---|
| **Modules** | ES modules Firefox loads directly. No bundler, no transpiler, no dependency. |
| **File size** | 200 to 400 lines. A file past 800 is asking to be split. |
| **Comments** | In French, and they explain the **why**. What the code does is visible in the code; why it does it that way is not. |
| **Naming** | French for the project's own vocabulary, English for what the platform names (`webRequest`, `Set-Cookie`, `grpc-status`). |
| **Commits** | `type: what changed`, then a body explaining what problem it solves. `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`. |

[Section 19 of the README](README.md#19-why-the-source-is-in-french) explains the French
choice, which surprises people. Short version: the interface's source language is also its
translation key, so the two cannot be separated.

---

## Adding a decoder or a tool

This is the most common contribution, and the easiest to get right.

1. Write it as a **pure function** in `ui/lib/`. No DOM, no browser API — it should be
   testable without either.
2. Follow the published specification and **cite it in a comment**, with its RFC number or
   its URL. If the input does not match the shape, throw rather than guess.
3. Add assertions to the matching suite, using **vectors from the specification** where the
   specification provides them. Appendix examples are better than values you computed
   yourself — if your implementation is wrong, so is your expected value.
4. Wire it into a view. A module nothing imports is dead code, and a test refuses to build
   when one exists.

---

## Reporting a bug

Open the **Internal log** view, export the diagnostics, and attach the file. It carries
internal errors and the command log — **not your traffic**.

For anything touching security, see [SECURITY.md](SECURITY.md) instead: those go privately,
not into a public issue.

---

## What happens to your pull request

It gets read properly. Expect questions about *why*, more than about style — the conventions
above are easy to fix, and a change that solves the wrong problem is not.

Licence: MIT, like the rest. By contributing, you agree your work ships under it.
