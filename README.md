# Break Your Assumptions

**It works. Until it doesn't.**

Six free, runnable experiments in the invisible assumptions that break software.
Predict an outcome, trigger a failure, inspect its trace, apply a repair, and take
a regression-test reference into your own project.

**Live demo: https://munmiwenslink-os.github.io/break-your-assumptions/**

No signup · No API keys · No runtime dependencies · No build step · No analytics

## What it does

Each experiment is a small, deterministic teaching model of one assumption that
real systems get wrong. You choose a prediction, adjust bounded conditions, run the
original (broken) behavior, read the chronological trace and the invariant that failed,
then apply a repaired implementation and compare. Every lab explains why it breaks,
states where the model stops being true, lets you inspect its source, and offers a
standalone Node.js test file to download.

## Run it locally

Download or clone this repository, then open **`index.html`** in a modern browser.
Everything runs locally, including test downloads. No server is required, and all
asset paths are relative, so the same files also work under a GitHub Pages
repository subpath.

Optional local HTTP server:

```bash
python3 -m http.server 8080
```

On Windows, `py -m http.server 8080` works when Python's launcher is installed.
Open http://localhost:8080 and stop the server with Ctrl+C. After the files are
downloaded, the application needs no network access. It is not an installable offline PWA.

Direct links open a lab, for example `index.html#unicode`. Progress ("fixes explored")
is optional and stored only in your browser under `bya-progress-v1`; if browser
storage is blocked or malformed, every experiment still works for the session.

## The six experiments

| Experiment | Assumption under test | Original failure | Repair explored |
| --- | --- | --- | --- |
| Payment déjà vu | One payment event means one delivery | The same event credited on every retry | Event-ID deduplication |
| The last ticket | Checking availability prevents overselling | Two buyers read "1 left" before either writes | Atomic check-and-reserve model |
| The lying clock | Later events have larger timestamps | A clock correction reverses timestamp ordering | Producer-local sequence number |
| The invisible difference | Text that looks the same compares equal | Composed and decomposed forms differ under raw equality | Explicit NFC normalization |
| Offline twins | The last uploaded document has the latest edits | A stale snapshot overwrites another device's edit | Field merge; same-field conflicts keep both candidates |
| The perfect backup | An existing archive means the app is recoverable | Referenced attachment bytes are missing | Include attachments and probe the restored app |

Every lab has a default failing scenario and selectable conditions, including
no-failure controls where they make sense (one delivery, one buyer, no clock
correction, a complete backup). Predictions refer to the default scenario; changing a
condition can change the outcome. Progress records **fixes explored**, not skill or certification.

## Run the tests

Install Node.js 22 or later. No `npm install` is needed.

```bash
npm test               # engine, exporter, and repository-hygiene tests
npm run test:examples  # the committed, generated example test files
npm run examples       # regenerate examples/*.test.cjs from src/engine.js
```

`npm test` checks every original failure and repaired invariant, every selectable
condition, input bounds, determinism, conflict retention, that each exported test file
is standalone and runs under the real Node test runner, and that the committed examples
match the exporter output. Continuous integration runs on GitHub Actions with Node 22 and 24.

An optional browser check drives the real page with Playwright (Python 3, `pip install playwright`,
and a Chromium browser). It is not part of `npm test` or CI:

```bash
python3 tests/browser/check.py file:///absolute/path/to/index.html
python3 tests/browser/check.py http://localhost:8080/
```

## Adapt an exported test to your application

**A downloaded test initially verifies the included reference implementation, not your
application.** It tests your code only after you replace the body of `underTest()` with an
adapter that drives your system and returns `{ pass, actual, expected }` from observed
state. The invariant tests call `underTest()`; the "reference original" tests always call the
bundled original and never your adapter. See [Adapting tests](docs/ADAPTING_TESTS.md).

## Limits of the teaching models

These are small executable models, not production-grade infrastructure. There are no real
payments, databases, network faults, concurrent workers, or destructive file operations.
The concurrency lab schedules reads and writes deliberately; it does not create threads.
Each lab lists its own boundary in the interface, and the invariants cover only the inputs and
schedules modeled. Passing here says nothing about the reliability of your system.

## Contribute

Keep one assumption, a minimal counterexample, an honest repair, and one explicit invariant,
and explain what the model does **not** prove. See [CONTRIBUTING.md](CONTRIBUTING.md) and the
[lab template](docs/LAB_TEMPLATE.md). Proposals can be opened as an issue using the
"Suggest an experiment" template.

## Project map

| Path | Purpose |
| --- | --- |
| `index.html`, `styles.css` | Responsive, accessible static interface |
| `src/engine.js` | Lab metadata, pure simulations, standalone test exporter |
| `src/app.js` | Navigation, controls, observations, optional local progress |
| `tests/engine.test.cjs` | Dependency-free Node verification |
| `tests/browser/check.py` | Optional Playwright verification of the real page |
| `examples/*.test.cjs` | Generated, ready-to-run exported reference tests |
| `scripts/build-examples.cjs` | Regenerates the examples |
| `.github/workflows/test.yml` | CI on Node 22 and 24 |
| `docs/` | Lab template, test-adaptation guide, release checks |
| `RELEASE_NOTES.md` | Notes for the current release |

## Inspirations

Learning through construction and counterexamples, including
[build-your-own-x](https://github.com/codecrafters-io/build-your-own-x) and
[awesome-falsehood](https://github.com/kdeldycke/awesome-falsehood). The lessons and
implementations here are original; no affiliation or endorsement is implied.

## Privacy and accessibility

No third-party assets, remote fonts, analytics, accounts, or API calls are used. Only lab IDs are
saved in browser local storage, and "Reset progress" clears them. The interface supports keyboard
operation, visible focus, labeled controls, reduced motion, text status indicators, responsive
layouts, and a live region that announces results. This is not a claim of independently audited
accessibility conformance.

## License

Executable code (JavaScript, HTML, CSS, SVG, workflows, and exported tests): [MIT](LICENSE).
Original prose explanations and documentation: [CC BY 4.0](LICENSE-CONTENT.md).

Version **0.1.0**. Ideas that are not shipped: user-authored repairs, adapters for other
languages, a richer common lab schema, and an offline PWA.
