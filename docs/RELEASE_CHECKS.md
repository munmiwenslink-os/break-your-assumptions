# v0.1.0 verification record

Every row states what was actually executed. Nothing here is a claim about untested browsers,
assistive technology, or production suitability.

Environment: Linux cloud workspace, Node.js 22.22.2 and 24.21.0, Python 3 with Playwright 1.56.0 and the
bundled Chromium, 2026-09-30.

| Check | Result |
| --- | --- |
| `npm test` (engine, exporter, repository-hygiene tests), Node.js 22.22.2 | 41 tests, 41 passed, 0 failed |
| `npm test`, Node.js 24.21.0 | 41 tests, 41 passed, 0 failed |
| `npm run test:examples` (six committed exported files), Node.js 22.22.2 and 24.21.0 | 30 tests, 30 passed, 0 failed on each |
| Starter release claims (25 core tests, 12 example tests) | Historical claims only. Re-run and superseded by the rows above |
| Browser script `tests/browser/check.py` on `file:///.../index.html` | 167 checks, 167 passed |
| Same script on `http://localhost:8765/break-your-assumptions/` (repository-subpath layout) | 167 checks, 167 passed |
| axe-core (WCAG 2 A/AA, 2.1 A/AA, best-practice tags) at 1280 px and 390 px, landing and all six labs with results and source open | 0 violations reported. axe is a scratch tool and is not part of this repository |
| Downloaded test files executed with `node --test` after a real browser download | All six passed |

What the browser script covers: all six default failures and repaired outcomes, every selectable
condition in both versions (including no-failure controls), both offline edit patterns, mode
preservation when changing a condition, downloads, progress persistence and reset, blocked and
malformed local storage, direct links with Back and Forward, horizontal overflow at 390 px and
320 px, reduced-motion styles, keyboard opening, focus, skip link, and console/page errors and
failed requests.

## After publication (2026-09-30)

| Check | Result |
| --- | --- |
| GitHub Actions on free `ubuntu-latest` runners, Node.js 22 and 24 | First run failed on Node.js 24 (see below). After the fix, both matrix jobs passed |
| GitHub Pages deployment from `main` (root) | Live at https://wenslink-os.github.io/break-your-assumptions/ |
| Live page assets (`index.html`, `styles.css`, `src/engine.js`, `src/app.js`, `assets/favicon.svg`) | All HTTP 200; no console messages captured on load |
| Live in-page script in desktop Chrome: six default failures and repairs, every condition in both versions, both offline patterns, direct hash links, Back/Forward, progress and reset | 43 of 43 checks passed |
| Live narrow layout: 390 px-wide frame, landing plus all six labs with results and source open | No horizontal page overflow |
| Live test download: the generated file for each lab, captured from the page without saving to disk | Byte-identical to the committed `examples/<lab>.test.cjs`, which run in CI and locally |

Live checks used an in-page script in Chrome rather than Playwright, because the build workspace
cannot reach `github.io`. Downloaded files were not executed with Node.js straight from the live site;
they are identical to the committed examples that CI executes.

## Defect found by CI and fixed

The first GitHub Actions run failed on Node.js 24 while Node.js 22 passed. The cause was a test
that parsed the test runner's TAP output (`# tests N`); Node.js 24 prints the spec format
(`ℹ tests N`) when not attached to a terminal. The test now accepts both formats and still asserts
the exact test count and zero failures. No assertion was removed or weakened.

## Not verified

- Browsers other than Chromium, and real mobile devices (narrow layouts were emulated with a resized viewport).
- Screen readers. The live-region text was checked in the DOM, not heard through assistive technology.
- Any claim of formal accessibility conformance.

## Manual checklist for future releases

- Open `index.html` directly, then via the optional local server.
- Run `npm test`, `npm run test:examples`, and `tests/browser/check.py` against a file URL and a subpath URL.
- Try a real screen reader and a real phone.
- After deployment, repeat the browser script against the live URL and download one test file.
