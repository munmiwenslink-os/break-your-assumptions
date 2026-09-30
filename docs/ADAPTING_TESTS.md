# Turn an experiment into an application test

**As downloaded, an exported file tests only the reference implementation bundled inside it.**
It becomes a test of your application only after you connect an adapter.

Each `<lab>.test.cjs` contains, in order: the self-contained reference simulation, an
`underTest(condition)` function, a `conditions` table, invariant tests, and negative controls.

1. **Invariant tests** call `underTest(condition.value)` for every condition the lab offers.
   Initially `underTest` calls the repaired reference. Replace its body with a call into
   your own code that returns `{ pass, actual, expected }` derived from observed state.
2. **Negative controls** ("Reference original ...") always call the bundled original
   reference, never your adapter. They document that the invariant can fail and that the
   no-failure controls pass. Keep them as a self-check or delete them once your own
   known-bad implementation gives you a real negative control.

For asynchronous adapters, make the test callbacks `async` and `await underTest(...)`.
Never hard-code `{ pass: true }`; derive every result from application state, and keep the
invariant unweakened. Run the file with `node --test <lab>.test.cjs`. A green result before
you connect an adapter says nothing about your application.

## Payment example

In an isolated test database:

1. Create a fresh account with zero balance.
2. Submit one fake provider event with ID `evt_42` and amount 100 minor units.
3. Submit the exact same event repeatedly, including concurrently.
4. Read the stored account balance and ledger entries.
5. Assert a balance of 100 and exactly one matching credit entry.
6. Repeat after restarting the worker to test durable deduplication.

Never run this against real payment accounts. The in-memory Set in the reference
is intentionally insufficient for a multi-worker deployment. A unique event key,
atomic database transaction, and an explicit provider identity policy matter.

## Invariants to carry into other adapters

| Lab | Application-level assertion |
| --- | --- |
| Ticket | Concurrent attempts against stock=1 produce one accepted booking and stock=0 |
| Clock | Per-producer ordering survives an injected wall-clock adjustment |
| Unicode | The chosen normalization policy matches canonically equivalent inputs consistently |
| Offline | Independent edits survive; conflicting same-field values remain available for resolution |
| Backup | A fresh restore serves a user, the linked document, and its actual attachment bytes |

## Scope and confidence

An invariant is bounded by the inputs and schedules you tested. Expand with your
own crash/retry cases, transactions, persistence, authorization, and deployment
topology. Keep negative controls: a known broken implementation should fail the
same assertion that your fixed implementation passes.
