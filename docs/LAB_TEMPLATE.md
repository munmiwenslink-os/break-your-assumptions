# New experiment template

- **ID:** short, stable, lowercase
- **Title:** memorable and specific
- **Assumption:** one falsifiable claim
- **Default prediction:** two clear answers, one correct for the original default
- **Controls:** bounded inputs; include a no-failure control where meaningful. Each option is `[value, label, originalBreaks]`, and `originalBreaks` must match the real behavior (a test enforces it)
- **Model:** a pure, deterministic function with no external dependencies
- **Invariant:** an observable correctness condition
- **Original:** a minimal counterexample
- **Repair:** a minimal improvement, with its limits stated
- **Trace:** explain events in chronological order
- **Boundary:** what this toy model cannot establish
- **Tests:** original fails; repair passes; all controls run; export executes
- **Sources:** authoritative links for any external claims or borrowed material

Add metadata and a self-contained function to `src/engine.js`. The function must
return `{pass, actual, expected, unit, trace}`, accept `(fixed, condition)`, and reject
out-of-range conditions with a `RangeError` or `TypeError` so a lab can never run unbounded.
The exporter uses `function.toString()`, so simulation functions must not depend on
module-scoped helpers. Update the "/ 6" progress copy if the collection grows. Run `npm run examples` and commit the regenerated `examples/`.
Use JSON-serializable arguments. Verify the keyboard flow and a narrow viewport.
