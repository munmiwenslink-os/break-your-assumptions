# v0.1.0 verification record

Every row states what was actually executed. Nothing here is a claim about untested browsers,
assistive technology, or production suitability.

Environment: Linux cloud workspace, Node.js 22.22.2, Python 3 with Playwright 1.56.0 and the
bundled Chromium, 2026-09-30.

| Check | Result |
| --- | --- |
| `npm test` (engine, exporter, repository-hygiene tests) | 41 tests, 41 passed, 0 failed |
| `npm run test:examples` (six committed exported files) | 30 tests, 30 passed, 0 failed |
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

## Not verified

- Browsers other than Chromium, and real mobile devices (narrow layouts were emulated with a resized viewport).
- Screen readers. The live-region text was checked in the DOM, not heard through assistive technology.
- Node.js 24 locally. The GitHub Actions matrix runs Node.js 22 and 24 after publication.
- Any claim of formal accessibility conformance.

## Manual checklist for future releases

- Open `index.html` directly, then via the optional local server.
- Run `npm test`, `npm run test:examples`, and `tests/browser/check.py` against a file URL and a subpath URL.
- Try a real screen reader and a real phone.
- After deployment, repeat the browser script against the live URL and download one test file.
