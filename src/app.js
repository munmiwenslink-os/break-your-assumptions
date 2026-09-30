/* SPDX-License-Identifier: MIT */
(() => {
  'use strict';
  const { labs, exportTest, sourceOf } = window.AssumptionLab;
  const $ = selector => document.querySelector(selector);
  const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const storageKey = 'bya-progress-v1';
  let explored = new Set();
  try { const saved = JSON.parse(localStorage.getItem(storageKey) || '[]'); if (Array.isArray(saved)) explored = new Set(saved.filter(id => labs.some(l => l.id === id))); } catch { /* Storage is optional. */ }
  let active = null, prediction = null, ran = false, mode = 'original';
  const announce = message => { const node = $('#announce'); if (node) node.textContent = message; };

  function renderCards() {
    $('#cards').innerHTML = labs.map((lab, i) => `<button class="card ${active?.id === lab.id ? 'selected' : ''}" data-lab="${lab.id}" aria-controls="workbench"><span class="card-top"><span class="lab-number">0${i + 1} / ${lab.category}</span><span class="card-icon" aria-hidden="true">${lab.icon}</span></span><h3>${lab.title}</h3><p>${lab.description}</p><span class="card-bottom"><span>${explored.has(lab.id) ? '✓ Fix explored' : lab.time + ' · Interactive'}</span><span class="arrow" aria-hidden="true">↗</span></span></button>`).join('');
    $('#progress').textContent = `${explored.size} / 6 fixes explored`;
    document.querySelectorAll('[data-lab]').forEach(button => button.addEventListener('click', () => {
      if (location.hash === '#' + button.dataset.lab) openLab(button.dataset.lab);
      else location.hash = button.dataset.lab;
    }));
  }

  function openLab(id) {
    active = labs.find(l => l.id === id);
    if (!active) return;
    prediction = null; ran = false; mode = 'original';
    const lab = active;
    $('#workbench').hidden = false;
    $('#workbench').innerHTML = `<div class="bench-heading"><div><p class="eyebrow">EXPERIMENT 0${labs.indexOf(lab) + 1} / ${lab.category}</p><h2 id="lab-title" tabindex="-1">${lab.title}</h2></div><button class="text-button" id="close-lab">Close experiment ×</button></div><blockquote>“${lab.assumption}”</blockquote><div class="bench-grid"><div class="controls"><h3><span class="step">01</span> Make a prediction</h3><p>${lab.question}</p><div class="choices">${lab.choices.map((c, i) => `<button class="choice" data-choice="${i}" aria-pressed="false">${c}</button>`).join('')}</div><p id="prediction-note" class="muted" aria-live="polite">Choose an answer, then test it. You can also skip the prediction.</p><h3><span class="step">02</span> Change the conditions</h3><label for="condition">${lab.control}</label><select id="condition">${lab.options.map(([value, text]) => `<option value="${value}">${text}</option>`).join('')}</select><div class="actions"><button id="run" class="button primary">Run experiment ↗</button><button id="repair" class="button secondary" disabled>Apply repair</button></div><p class="muted">Run the original first, then apply the repair. Changing the condition re-runs whichever version you last ran. Simulation only: no real payments, network calls, or files are changed.</p></div><div class="results" role="region" aria-label="Observation log"><div class="results-top"><span>OBSERVATION LOG</span><span id="state">READY</span></div><div id="output"><div class="empty-state"><span aria-hidden="true">⌁</span><h3>Let's test that assumption.</h3><p>Run the experiment to inspect the result and its event trace.</p></div></div></div></div><div id="lesson" hidden><div class="lesson-grid"><div><p class="eyebrow">WHY IT BREAKS</p><p>${lab.why}</p></div><div><p class="eyebrow">THE REPAIR</p><p>${lab.fix}</p></div></div><div class="boundary"><b>Where this model stops</b><p>${lab.limit}</p></div><details><summary>Inspect the simulation source</summary><pre tabindex="0" aria-label="Simulation source code"><code>${escape(sourceOf(lab.run))}</code></pre></details><div class="export"><div><h3>Keep the lesson in your test suite.</h3><p>Download a standalone Node.js test. As downloaded, it verifies the included reference implementation only. It tests your own application after you connect an adapter (see docs/ADAPTING_TESTS.md).</p></div><button class="button secondary" id="download">Download .test.cjs ↓</button></div></div>`;
    document.querySelectorAll('[data-choice]').forEach(button => button.addEventListener('click', () => {
      prediction = Number(button.dataset.choice);
      document.querySelectorAll('[data-choice]').forEach(b => b.setAttribute('aria-pressed', String(b === button)));
      $('#prediction-note').textContent = 'Prediction recorded for the default scenario. Run the experiment to see what happens.';
    }));
    $('#condition').addEventListener('change', () => { if (ran) execute(mode === 'repaired'); });
    $('#run').addEventListener('click', () => execute(false));
    $('#repair').addEventListener('click', () => execute(true));
    $('#download').addEventListener('click', download);
    $('#close-lab').addEventListener('click', () => { const id = active.id; $('#workbench').hidden = true; active = null; location.hash = 'experiments'; renderCards(); document.querySelector(`[data-lab="${id}"]`).focus(); });
    renderCards();
    $('#lab-title').focus({ preventScroll: true });
    $('#workbench').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
  }

  function execute(fixed) {
    const value = active.parse($('#condition').value), result = active.run(fixed, value);
    ran = true; mode = fixed ? 'repaired' : 'original';
    $('#state').textContent = fixed ? 'REPAIR APPLIED' : 'ORIGINAL HANDLER';
    $('#output').innerHTML = `<div class="verdict ${result.pass ? 'pass' : 'fail'}">${result.pass ? '✓ Invariant holds' : '↯ Assumption broken'}</div><div class="metrics"><div><span>EXPECTED</span><strong>${escape(result.expected)}</strong></div><div><span>OBSERVED</span><strong>${escape(result.actual)}</strong></div></div><p class="metric-label">${result.unit}</p><ol class="trace">${result.trace.map(line => `<li>${escape(line)}</li>`).join('')}</ol>${result.conflicts && Object.keys(result.conflicts).length ? '<p class="conflict">Both conflicting values are retained. A human decision is still needed.</p>' : ''}`;
    $('#repair').disabled = fixed;
    announce(`${fixed ? 'Repair applied' : 'Original handler'}. ${result.pass ? 'Invariant holds.' : 'Assumption broken.'} Expected ${result.expected}, observed ${result.actual}, ${result.unit}.`);
    $('#lesson').hidden = false;
    if (prediction !== null) $('#prediction-note').textContent = (prediction === active.answer ? 'Correct prediction for the default scenario. ' : 'The default scenario contradicts your prediction. ') + (fixed ? 'The repair changes the behavior.' : 'Controls may produce a different outcome.');
    if (fixed && result.pass) {
      explored.add(active.id);
      try { localStorage.setItem(storageKey, JSON.stringify([...explored])); } catch { /* Session progress still works. */ }
      renderCards();
    }
  }

  function download() {
    const blob = new Blob([exportTest(active.id)], { type: 'text/javascript;charset=utf-8' });
    const url = URL.createObjectURL(blob), link = document.createElement('a');
    link.href = url; link.download = `${active.id}.test.cjs`; document.body.append(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  $('#reset-progress').addEventListener('click', () => {
    explored.clear(); try { localStorage.removeItem(storageKey); } catch { /* Optional. */ } renderCards(); announce('Progress reset. 0 of 6 fixes explored.');
  });
  function route() { const id = location.hash.slice(1); if (labs.some(l => l.id === id)) openLab(id); else if (active) { active = null; $('#workbench').hidden = true; renderCards(); } }
  window.addEventListener('hashchange', route);
  renderCards(); route();
})();
