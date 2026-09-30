const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const engine = require('../src/engine.js');

for (const lab of engine.labs) {
  test(`${lab.id}: original failure and repair satisfy opposite sides of the invariant`, () => {
    const value = lab.parse(lab.options[0][0]);
    assert.equal(lab.run(false, value).pass, false);
    const repaired = lab.run(true, value);
    assert.equal(repaired.pass, true);
    assert.deepEqual(repaired.actual, repaired.expected);
  });
  test(`${lab.id}: every offered control runs and every repair holds`, () => {
    for (const [raw] of lab.options) {
      const value = lab.parse(raw);
      const before = lab.run(false, value), after = lab.run(true, value);
      assert.ok(before.trace.length > 0);
      assert.equal(after.pass, true);
      assert.deepEqual(after.actual, after.expected);
      assert.deepEqual(after, lab.run(true, value), 'Simulation must be deterministic');
    }
  });
  test(`${lab.id}: downloaded test is standalone and executes its assertions`, () => {
    let executed = 0;
    vm.runInNewContext(engine.exportTest(lab.id), {
      require(name) {
        if (name === 'node:test') return (name, fn) => { fn(); executed++; };
        if (name === 'node:assert/strict') return assert;
        throw Error('Unexpected import: ' + name);
      }
    });
    assert.equal(executed, lab.options.length * 2);
  });
}

test('payment: duplicate count changes the bug but never repaired balance', () => {
  for (const n of [1, 2, 10, 100]) {
    assert.equal(engine.payment(false, n).actual, n * 100);
    assert.equal(engine.payment(true, n).actual, 100);
  }
});
test('ticket: adversarial schedule oversells; serial atomic model never does', () => {
  for (const n of [1, 2, 8, 50]) {
    assert.equal(engine.ticket(false, n).actual, n);
    assert.equal(engine.ticket(true, n).actual, 1);
  }
});
test('clock: zero correction is a valid control and rollback reverses order', () => {
  assert.equal(engine.clock(false, 0).actual, 'A → B');
  assert.equal(engine.clock(false, 500).actual, 'B → A');
});
test('offline: distinct changes survive the merge', () => {
  assert.deepEqual(engine.offline(true, false).result, { title: 'Final', body: 'Hello world' });
  assert.deepEqual(engine.offline(true, false).conflicts, {});
});
test('offline: conflicting changes remain recoverable, never silently resolved', () => {
  assert.deepEqual(engine.offline(true, true).conflicts.title, ['Final', 'Review']);
  assert.equal(engine.offline(true, true).result.title, 'Final');
  assert.equal(engine.offline(false, true).result.title, 'Review');
});
test('backup: an existing archive can fail a restored application probe', () => {
  assert.equal(engine.backup(false, false).actual, 2);
  assert.equal(engine.backup(false, true).actual, 3);
});
test('export rejects unknown lab IDs', () => assert.throws(() => engine.exportTest('missing'), /Unknown lab/));

// ---- Tests added while repairing the starter release ----

const root = path.join(__dirname, '..');

test('every control declares whether the original breaks, and the declaration is true', () => {
  for (const lab of engine.labs) {
    for (const [raw, , originalBreaks] of lab.options) {
      assert.equal(typeof originalBreaks, 'boolean', `${lab.id}/${raw} needs an explicit flag`);
      assert.equal(lab.run(false, lab.parse(raw)).pass, !originalBreaks, `${lab.id}/${raw}`);
    }
    assert.ok(lab.options.some(o => o[2] === true), `${lab.id} needs at least one failing condition`);
  }
});

test('every lab except the two-way ones offers a no-failure control', () => {
  const withControl = engine.labs.filter(l => l.options.some(o => o[2] === false)).map(l => l.id).sort();
  assert.deepEqual(withControl, ['backup', 'clock', 'payment', 'ticket']);
});

test('simulations reject out-of-range or wrongly typed conditions instead of running unbounded', () => {
  for (const fixed of [false, true]) {
    for (const bad of [0, -1, 1001, 1.5, NaN, Infinity, '3', null]) {
      assert.throws(() => engine.payment(fixed, bad), RangeError, `payment ${String(bad)}`);
      assert.throws(() => engine.ticket(fixed, bad), RangeError, `ticket ${String(bad)}`);
    }
    for (const bad of [-1, 3600001, 0.5, NaN, Infinity, '500', null]) {
      assert.throws(() => engine.clock(fixed, bad), RangeError, `clock ${String(bad)}`);
    }
    for (const bad of ['', 'other', 'Accent', false, null, 3]) {
      assert.throws(() => engine.unicode(fixed, bad), RangeError, `unicode ${String(bad)}`);
    }
    for (const bad of ['same', 1, 0, null]) {
      assert.throws(() => engine.offline(fixed, bad), TypeError, `offline ${String(bad)}`);
      assert.throws(() => engine.backup(fixed, bad), TypeError, `backup ${String(bad)}`);
    }
  }
});

test('documented bounds are inclusive and still satisfy the repaired invariant', () => {
  assert.equal(engine.payment(true, 1).pass, true);
  assert.equal(engine.payment(true, 1000).pass, true);
  assert.equal(engine.payment(false, 1000).actual, 100000);
  assert.equal(engine.ticket(true, 1000).pass, true);
  assert.equal(engine.ticket(false, 1000).actual, 1000);
  assert.equal(engine.clock(false, 3600000).actual, 'B → A');
  assert.equal(engine.clock(true, 3600000).pass, true);
});

test('clock: repaired order is independent of every offered and boundary rollback', () => {
  for (const rollback of [0, 1, 99, 100, 101, 500, 5000, 3600000]) {
    assert.equal(engine.clock(true, rollback).actual, 'A → B');
  }
  // With the wall clock only stepping back by less than the 100 ms gap, raw ordering is still fine.
  assert.equal(engine.clock(false, 99).actual, 'A → B');
  assert.equal(engine.clock(false, 101).actual, 'B → A');
});

test('unicode: both forms differ under raw equality and match after NFC', () => {
  for (const form of ['accent', 'ring']) {
    assert.equal(engine.unicode(false, form).actual, 'No match');
    assert.equal(engine.unicode(true, form).actual, 'Match');
  }
});

test('offline: repair never loses either edit in either pattern', () => {
  const different = engine.offline(true, false);
  assert.equal(different.result.title, 'Final');
  assert.equal(different.result.body, 'Hello world');
  const same = engine.offline(true, true);
  assert.deepEqual(same.conflicts, { title: ['Final', 'Review'] });
  assert.equal(engine.offline(false, false).actual, 1);
  assert.equal(engine.offline(false, true).actual, 1);
});

test('backup: only the complete-backup control keeps the original passing', () => {
  assert.equal(engine.backup(false, true).pass, true);
  assert.equal(engine.backup(false, false).pass, false);
  assert.equal(engine.backup(true, false).pass, true);
  assert.equal(engine.backup(true, true).pass, true);
});

test('exported file states that it tests the reference until an adapter is connected', () => {
  for (const lab of engine.labs) {
    const text = engine.exportTest(lab.id);
    assert.match(text, /verifies the reference implementation bundled below/);
    assert.match(text, /does NOT test your application until you connect an adapter/);
    assert.match(text, /function underTest\(condition\)/);
    assert.equal(text.includes('fetch('), false);
    assert.deepEqual([...text.matchAll(/require\('([^']+)'\)/g)].map(m => m[1]).sort(), ['node:assert/strict', 'node:test']);
  }
});

test('exported file covers every offered condition twice (invariant + negative control)', () => {
  for (const lab of engine.labs) {
    const names = [];
    vm.runInNewContext(engine.exportTest(lab.id), {
      require(name) {
        if (name === 'node:test') return (title, fn) => { names.push(title); fn(); };
        if (name === 'node:assert/strict') return assert;
        throw Error('Unexpected import: ' + name);
      }
    });
    assert.equal(names.length, lab.options.length * 2, lab.id);
    for (const [, label] of lab.options) assert.equal(names.filter(n => n.endsWith(`[${label}]`)).length, 2, `${lab.id}/${label}`);
  }
});

test('an adapter that keeps the original bug makes the exported invariant tests fail', () => {
  for (const lab of engine.labs) {
    const source = engine.exportTest(lab.id).replace(`return ${lab.run.name}(true, condition);`, `return ${lab.run.name}(false, condition);`);
    assert.notEqual(source, engine.exportTest(lab.id), 'adapter body must be replaceable');
    const outcomes = [];
    vm.runInNewContext(source, {
      require(name) {
        if (name === 'node:test') return (title, fn) => { try { fn(); outcomes.push([title, true]); } catch { outcomes.push([title, false]); } };
        if (name === 'node:assert/strict') return assert;
        throw Error('Unexpected import: ' + name);
      }
    });
    const invariantOutcomes = outcomes.slice(0, lab.options.length);
    lab.options.forEach(([, , originalBreaks], i) => assert.equal(invariantOutcomes[i][1], !originalBreaks, `${lab.id} #${i}`));
    assert.ok(invariantOutcomes.some(o => o[1] === false), `${lab.id}: a buggy adapter must be caught`);
    // Negative controls call the bundled original directly and are unaffected by the adapter.
    assert.ok(outcomes.slice(lab.options.length).every(o => o[1] === true), `${lab.id}: negative controls`);
  }
});

test('all six exported files execute under the real Node test runner', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bya-export-'));
  try {
    const env = { ...process.env };
    delete env.NODE_TEST_CONTEXT;
    for (const lab of engine.labs) {
      const file = path.join(dir, `${lab.id}.test.cjs`);
      fs.writeFileSync(file, engine.exportTest(lab.id), 'utf8');
      const run = spawnSync(process.execPath, ['--test', file], { encoding: 'utf8', env, cwd: dir });
      assert.equal(run.status, 0, `${lab.id} exited ${run.status}\n${run.stdout}\n${run.stderr}`);
      assert.match(run.stdout, new RegExp(`# tests ${lab.options.length * 2}\\b`), `${lab.id} test count`);
      assert.match(run.stdout, /# fail 0\b/, `${lab.id} failures`);
    }
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('committed examples/*.test.cjs are exactly what the exporter generates (run npm run examples to refresh)', () => {
  const files = fs.readdirSync(path.join(root, 'examples')).filter(f => f.endsWith('.test.cjs')).sort();
  assert.deepEqual(files, engine.labs.map(l => `${l.id}.test.cjs`).sort());
  for (const lab of engine.labs) {
    assert.equal(fs.readFileSync(path.join(root, 'examples', `${lab.id}.test.cjs`), 'utf8'), engine.exportTest(lab.id), lab.id);
  }
});

test('package version, engine version, and exporter header agree', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.equal(engine.VERSION, pkg.version);
  assert.match(engine.exportTest('payment'), new RegExp(`v${pkg.version.replace(/\./g, '\\.')}`));
});

test('index.html uses only local relative assets and no remote scripts, fonts, or trackers', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
  for (const [, url] of html.matchAll(/<(?:script|link|img)\b[^>]*?(?:src|href)="([^"]+)"/g)) {
    assert.doesNotMatch(url, /^(?:[a-z]+:)?\/\//i, `remote asset: ${url}`);
    assert.doesNotMatch(url, /^\//, `root-absolute asset breaks GitHub Pages subpaths: ${url}`);
    assert.ok(fs.existsSync(path.join(root, url)), `missing asset: ${url}`);
  }
  assert.doesNotMatch(css, /url\(\s*['"]?(?:https?:)?\/\//i);
  assert.doesNotMatch(css, /@import/);
});

test('ticket: the trace shows the stale read that causes the oversell, and the atomic step that prevents it', () => {
  const broken = engine.ticket(false, 2).trace;
  assert.match(broken[0], /All 2 buyers read stock = 1 before any write happens/);
  assert.equal(broken.filter(line => /reservation accepted/.test(line)).length, 2);
  assert.match(broken.at(-1), /Result: 2 tickets sold from a stock of 1/);
  assert.match(engine.ticket(true, 2).trace[0], /atomic step/);
  assert.match(engine.ticket(true, 2).trace.at(-1), /Result: 1 ticket sold from a stock of 1/);
});
