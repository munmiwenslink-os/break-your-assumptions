/* SPDX-License-Identifier: MIT */
'use strict';
// Regenerates examples/*.test.cjs from src/engine.js. Run: npm run examples
const fs = require('node:fs');
const path = require('node:path');
const engine = require('../src/engine.js');

const dir = path.join(__dirname, '..', 'examples');
fs.mkdirSync(dir, { recursive: true });
for (const lab of engine.labs) {
  const file = path.join(dir, `${lab.id}.test.cjs`);
  fs.writeFileSync(file, engine.exportTest(lab.id), 'utf8');
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
