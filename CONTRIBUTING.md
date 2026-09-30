# Contributing

An excellent experiment is small enough to understand and surprising enough to remember.

1. Open an issue describing one assumption and its smallest counterexample.
2. Use [the lab template](docs/LAB_TEMPLATE.md).
3. Implement the original behavior and a repair as pure deterministic simulations.
4. Explain the repair's limits. Do not present toy code as production-ready infrastructure.
5. Run `npm run examples` and `npm test`; check keyboard navigation, mobile layout, and the downloaded test. The optional `tests/browser/check.py` (Playwright) exercises the real page.
6. Submit a focused pull request with a screenshot and the invariant it demonstrates.

Keep runtime dependencies at zero. Do not introduce remote scripts, telemetry,
API-key requirements, or external fonts. Avoid unbounded resource consumption.
Use synthetic data only. Cite inspiration and preserve any third-party licenses.

By contributing, you agree to license executable contributions under MIT and
original prose under CC BY 4.0. Be respectful, constructive, and specific in reviews.
