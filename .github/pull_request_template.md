## What this changes

<!-- One or two sentences. What behaviour is different after this? -->

## Why

<!-- The problem being solved. If it fixes an issue, link it: Fixes #123 -->

## Checks

- [ ] `npm test` passes — all ten suites, no failure
- [ ] If the number of assertions changed, the README states the new total (the build compares them)
- [ ] `./build.ps1 -Verify` is green
- [ ] New behaviour is covered by a test that fails without the change
- [ ] If a field was added to a record, it is displayed somewhere (`detail-coverage` enforces this)
- [ ] If a setting was added, it has a real effect in the code (`ui-load` checks that something reads it)
- [ ] If an analyser finding was added, it carries evidence provable from captured data

## Screenshots

<!-- For interface changes. `node tools/captures.mjs` regenerates the documentation set. -->
