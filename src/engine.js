/* SPDX-License-Identifier: MIT */
(function (root) {
  'use strict';

  const VERSION = '0.1.0';

  function payment(fixed, deliveries = 3) {
    if (!Number.isInteger(deliveries) || deliveries < 1 || deliveries > 1000) throw new RangeError('deliveries must be an integer from 1 to 1000');
    let balance = 0;
    const seen = new Set(), trace = [];
    for (let n = 1; n <= deliveries; n++) {
      const event = { id: 'evt_42', amount: 100 };
      if (fixed && seen.has(event.id)) { trace.push(`Delivery ${n}: duplicate ignored.`); continue; }
      seen.add(event.id); balance += event.amount;
      trace.push(`Delivery ${n}: credited 100 units; balance = ${balance}.`);
    }
    return { pass: balance === 100, actual: balance, expected: 100, unit: 'units credited', trace };
  }

  function ticket(fixed, buyers = 2) {
    if (!Number.isInteger(buyers) || buyers < 1 || buyers > 1000) throw new RangeError('buyers must be an integer from 1 to 1000');
    let stock = 1, sold = 0;
    const trace = [];
    trace.push(fixed ? 'Each reservation checks and decrements stock in one atomic step.'
      : `${buyers === 1 ? 'The buyer reads' : `All ${buyers} buyers read`} stock = 1 before any write happens.`);
    // Broken schedule: all buyers read before any buyer writes.
    const snapshots = Array(buyers).fill(stock);
    for (let n = 0; n < buyers; n++) {
      const available = fixed ? stock : snapshots[n];
      if (available > 0) {
        stock = available - 1; sold++;
        trace.push(`Buyer ${n + 1}: reservation accepted; stock = ${stock}.`);
      } else trace.push(`Buyer ${n + 1}: sold out.`);
    }
    trace.push(`Result: ${sold} ticket${sold === 1 ? '' : 's'} sold from a stock of 1.`);
    return { pass: sold === 1, actual: sold, expected: 1, unit: 'tickets sold', trace };
  }

  function clock(fixed, rollback = 500) {
    if (!Number.isInteger(rollback) || rollback < 0 || rollback > 3600000) throw new RangeError('rollback must be an integer from 0 to 3600000 ms');
    const first = 10000, second = first + 100 - rollback;
    const events = [{ id: 'A', wall: first, sequence: 1 }, { id: 'B', wall: second, sequence: 2 }];
    const ordered = [...events].sort((a, b) => fixed ? a.sequence - b.sequence : a.wall - b.wall);
    const actual = ordered.map(e => e.id).join(' → ');
    return { pass: actual === 'A → B', actual, expected: 'A → B', unit: 'event order',
      trace: [`A happens first: wall clock ${first} ms, sequence 1.`,
        `Clock correction: −${rollback} ms. B happens 100 ms later: wall clock ${second} ms, sequence 2.`,
        `Sorted by ${fixed ? 'local sequence' : 'wall-clock timestamp'}: ${actual}.`] };
  }

  function unicode(fixed, form = 'accent') {
    if (form !== 'accent' && form !== 'ring') throw new RangeError('form must be "accent" or "ring"');
    const pairs = { accent: ['caf\u00e9', 'cafe\u0301'], ring: ['\u00c5', 'A\u030a'] };
    const [stored, query] = pairs[form];
    const actual = fixed ? stored.normalize('NFC') === query.normalize('NFC') : stored === query;
    const points = s => [...s].map(c => 'U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).join(' ');
    return { pass: actual, actual: actual ? 'Match' : 'No match', expected: 'Match', unit: 'search result',
      trace: [`Stored: ${stored} (${points(stored)}).`, `Query: ${query} (${points(query)}).`,
        fixed ? 'Normalize both strings to NFC before equality.' : 'Compare raw code-point sequences.'] };
  }

  function offline(fixed, sameField = false) {
    if (typeof sameField !== 'boolean') throw new TypeError('sameField must be a boolean');
    const base = { title: 'Draft', body: 'Hello' };
    const patchA = { title: 'Final' }, patchB = sameField ? { title: 'Review' } : { body: 'Hello world' };
    const snapshotA = { ...base, ...patchA }, snapshotB = { ...base, ...patchB };
    const trace = ['Both devices start with title=Draft, body=Hello.', 'Device A edits title to Final.',
      sameField ? 'Device B edits title to Review.' : 'Device B edits body to Hello world.'];
    let result, conflicts = {};
    if (!fixed) { result = snapshotB; trace.push('A uploads, then B replaces the entire document. A’s edit is lost.'); }
    else {
      result = { ...snapshotA };
      for (const [key, value] of Object.entries(patchB)) {
        if (Object.hasOwn(patchA, key) && patchA[key] !== value) {
          conflicts[key] = [patchA[key], value];
          trace.push(`Conflict on ${key}: retain both values for a human decision.`);
        } else { result[key] = value; trace.push(`Merge B’s changed field: ${key}.`); }
      }
    }
    const preserved = sameField ? (conflicts.title?.length === 2 ? 2 : 1)
      : Number(result.title === 'Final') + Number(result.body === 'Hello world');
    return { pass: preserved === 2, actual: preserved, expected: 2, unit: 'edits retained', trace, result, conflicts };
  }

  function backup(fixed, includeAttachment = false) {
    if (typeof includeAttachment !== 'boolean') throw new TypeError('includeAttachment must be a boolean');
    const live = { users: [{ id: 1, name: 'Mira' }], documents: [{ id: 7, owner: 1, attachment: 'file_7' }],
      attachments: { file_7: 'example attachment bytes' } };
    const archive = fixed ? JSON.stringify(live) : JSON.stringify({ users: live.users,
      documents: live.documents, attachments: includeAttachment ? live.attachments : {} });
    const restored = JSON.parse(archive);
    // Probe the reconstructed application, not merely the backup file's existence.
    const checks = [restored.users.some(u => u.id === 1), restored.documents.some(d => d.id === 7),
      restored.documents.every(d => restored.attachments[d.attachment] === live.attachments[d.attachment])];
    const actual = checks.filter(Boolean).length;
    return { pass: actual === 3, actual, expected: 3, unit: 'restore checks passed',
      trace: [`Archive exists: ${archive.length} characters.`, `User lookup: ${checks[0] ? 'PASS' : 'FAIL'}.`,
        `Document lookup: ${checks[1] ? 'PASS' : 'FAIL'}.`, `Open attachment: ${checks[2] ? 'PASS' : 'FAIL'}.`] };
  }

  const labs = [
    { id: 'payment', title: 'Payment déjà vu', category: 'EVENTS', icon: '↺', time: '4 min',
      assumption: 'One payment event means one delivery.', question: 'What happens when the same 100-unit event arrives three times?',
      choices: ['100 units credited', '300 units credited'], answer: 1,
      description: 'One payment. Three deliveries. Follow the balance as retries become money.',
      control: 'Webhook deliveries', options: [['3', '3 deliveries', true], ['5', '5 deliveries', true], ['1', '1 delivery (control)', false]],
      parse: Number, run: payment,
      why: 'The handler treats every delivery as a new payment. Delivery identity and business-event identity are different things.',
      fix: 'Remember processed event IDs and credit only once. In a real database, the unique event record and balance update must commit in one transaction.',
      limit: 'The Set is a single-process teaching model. It does not survive a restart or provide concurrency safety across workers.',
      invariant: 'Exactly 100 units are credited for any positive number of deliveries of this one event.' },
    { id: 'ticket', title: 'The last ticket', category: 'CONCURRENCY', icon: '⇉', time: '5 min',
      assumption: 'Checking availability is enough to prevent overselling.', question: 'Two buyers read “1 ticket left” before either writes. How many bookings succeed?',
      choices: ['One booking', 'Two bookings'], answer: 1,
      description: 'Two buyers. One seat. A perfectly reasonable check meets an unfortunate schedule.',
      control: 'Concurrent buyers', options: [['2', '2 buyers', true], ['4', '4 buyers', true], ['1', '1 buyer (control)', false]],
      parse: Number, run: ticket,
      why: 'Both buyers read the same old stock value. Each booking looks valid in isolation, but together they oversell.',
      fix: 'Make the check and decrement one atomic operation. A database implementation can use a conditional update with stock > 0 and require one affected row.',
      limit: 'This is a deterministic interleaving model, not real concurrent threads. The repaired branch models an atomic reservation; plain JavaScript alone is not a distributed lock.',
      invariant: 'One unit of stock allows exactly one successful reservation.' },
    { id: 'clock', title: 'The lying clock', category: 'TIME', icon: '◷', time: '4 min',
      assumption: 'Later events always have larger timestamps.', question: 'B happens after A, but the clock moves back 500 ms. Which event sorts first?',
      choices: ['A still sorts first', 'B sorts first'], answer: 1,
      description: 'Turn the clock back. Watch a timestamp reorder what already happened.',
      control: 'Clock correction', options: [['500', 'Back 500 ms', true], ['5000', 'Back 5 seconds', true], ['0', 'No correction (control)', false]],
      parse: Number, run: clock,
      why: 'A wall clock can be corrected. Sorting by its reading can reverse the known order of events in one producer.',
      fix: 'Use a sequence number to retain order within this producer. Use an appropriate monotonic clock for elapsed durations.',
      limit: 'A local counter does not establish a global order across machines or survive restarts by itself. Distributed ordering needs its own protocol.',
      invariant: 'The known producer order stays A then B regardless of the simulated wall-clock correction.' },
    { id: 'unicode', title: 'The invisible difference', category: 'TEXT', icon: 'Å', time: '4 min',
      assumption: 'Text that looks the same compares equal.', question: 'Does composed café equal cafe followed by a combining acute accent?',
      choices: ['Yes, raw equality matches', 'No, the sequences differ'], answer: 1,
      description: 'Two identical-looking names hide different sequences of code points.',
      control: 'Text example', options: [['accent', 'café / combining accent', true], ['ring', 'Å / combining ring', true]],
      parse: String, run: unicode,
      why: 'The same canonically equivalent text can have different Unicode representations. Raw equality compares those representations.',
      fix: 'For this search policy, normalize both stored text and queries to NFC before comparing them.',
      limit: 'NFC is not case folding, transliteration, confusable detection, or a universal identity policy. Keep original display text and define normalization per field.',
      invariant: 'These canonically equivalent example strings match after NFC normalization.' },
    { id: 'offline', title: 'Offline twins', category: 'SYNC', icon: '⇄', time: '6 min',
      assumption: 'The latest uploaded document contains the latest edits.', question: 'A changes the title; B changes the body offline. B uploads last. Are both edits kept?',
      choices: ['Both edits are kept', 'A’s title edit disappears'], answer: 1,
      description: 'Two devices edit the same document. Reconnection should not mean forgetting.',
      control: 'Edit pattern', options: [['different', 'Different fields', true], ['same', 'Same field (conflict)', true]],
      parse: value => value === 'same', run: offline,
      why: 'Uploading a whole stale snapshot replaces unrelated changes. Upload order is not the same as edit completeness.',
      fix: 'Merge changed fields against a shared base. If both devices change the same field differently, retain both candidates and request a decision.',
      limit: 'This models two edits with a known common base. A production sync engine needs version tracking, deletions, more clients, and durable conflict resolution.',
      invariant: 'Both edits remain recoverable, either merged or explicitly retained as a conflict.' },
    { id: 'backup', title: 'The perfect backup', category: 'RECOVERY', icon: '▣', time: '5 min',
      assumption: 'A successful backup file means the app can be recovered.', question: 'The database is backed up, but attachment bytes are missing. Is the restored app complete?',
      choices: ['Yes, the archive exists', 'No, documents cannot open'], answer: 1,
      description: 'The archive is there. The restore succeeds. The document still will not open.',
      control: 'Original backup contents', options: [['missing', 'Database only', true], ['complete', 'Database + attachment (control)', false]],
      parse: value => value === 'complete', run: backup,
      why: 'A database row can reference data outside the database. A parseable archive can still be an incomplete application backup.',
      fix: 'Include referenced attachment bytes and run a restore drill with application-level probes.',
      limit: 'This small JSON model omits encryption keys, permissions, point-in-time consistency, external services, and recovery-time objectives.',
      invariant: 'The restored user, document, and attachment all remain accessible.' }
  ];

  // Function.prototype.toString keeps the IIFE indentation on every line but the first.
  function sourceOf(fn) {
    return fn.toString().split('\n').map((line, i) => (i === 0 ? line : line.replace(/^ {2}/, ''))).join('\n');
  }

  function exportTest(id) {
    const lab = labs.find(item => item.id === id);
    if (!lab) throw new Error('Unknown lab: ' + id);
    const name = lab.run.name;
    const conditions = lab.options.map(([raw, label, originalBreaks]) => ({ value: lab.parse(raw), label, originalBreaks }));
    return `// Generated by Break Your Assumptions v${VERSION} (MIT)
// Lab: ${lab.title} - assumption: ${lab.assumption}
// Run: node --test ${id}.test.cjs
//
// WHAT THIS FILE TESTS
// As downloaded, this file verifies the reference implementation bundled below.
// It does NOT test your application until you connect an adapter: replace the body
// of underTest() with a call into YOUR code that returns {pass, actual, expected}
// derived from observed application state. See docs/ADAPTING_TESTS.md.

const test = require('node:test');
const assert = require('node:assert/strict');

// ---- Reference simulation (teaching model, self-contained) ----
${sourceOf(lab.run)}

// ---- ADAPTER: replace this body to test your own application ----
// Currently it calls the bundled repaired reference, so the tests below check the reference.
function underTest(condition) {
  return ${name}(true, condition);
}

const invariant = ${JSON.stringify(lab.invariant)};
const conditions = [
${conditions.map(c => '  ' + JSON.stringify(c)).join(',\n')}
];

// Invariant checks: these run against underTest(), i.e. your adapter once connected.
for (const condition of conditions) {
  test(\`\${invariant} [\${condition.label}]\`, () => {
    const result = underTest(condition.value);
    assert.equal(result.pass, true);
    assert.deepEqual(result.actual, result.expected);
  });
}

// Negative controls: these always call the bundled ORIGINAL reference, never your adapter.
// They prove the invariant can fail, and that the no-failure controls pass.
for (const condition of conditions) {
  test(\`Reference original \${condition.originalBreaks ? 'violates' : 'satisfies'} the invariant [\${condition.label}]\`, () => {
    assert.equal(${name}(false, condition.value).pass, !condition.originalBreaks);
  });
}
`;
  }

  const api = { VERSION, labs, sourceOf, payment, ticket, clock, unicode, offline, backup, exportTest };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.AssumptionLab = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
