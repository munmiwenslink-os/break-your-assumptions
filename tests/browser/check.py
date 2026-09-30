#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""Optional browser verification for Break Your Assumptions.

Not part of `npm test` and not run in CI: it needs Python 3, the `playwright`
package, and a Chromium browser. It drives the real page and exercises every lab.

Usage:
  python3 tests/browser/check.py <page-url> [--shots DIR]
Examples:
  python3 tests/browser/check.py file:///path/to/break-your-assumptions/index.html
  python3 tests/browser/check.py http://localhost:8080/
  python3 tests/browser/check.py https://<user>.github.io/break-your-assumptions/
"""
import argparse, json, os, subprocess, sys, tempfile
from playwright.sync_api import sync_playwright

DEFAULTS = {  # independent of the engine: what the original handler must show for option #1
    'payment': ('300', '100'), 'ticket': ('2', '1'), 'clock': ('B → A', 'A → B'),
    'unicode': ('No match', 'Match'), 'offline': ('1', '2'), 'backup': ('2', '3'),
}
results = []


def check(name, ok, detail=''):
    results.append((name, bool(ok), detail))
    print(('PASS ' if ok else 'FAIL ') + name + (f'  [{detail}]' if detail and not ok else ''))


def norm(url):
    return url.split('#')[0]


def new_page(browser, url, viewport=None, reduced=False, init=None):
    ctx = browser.new_context(viewport=viewport or {'width': 1280, 'height': 900}, accept_downloads=True,
                              reduced_motion='reduce' if reduced else 'no-preference')
    page = ctx.new_page()
    log = {'console': [], 'errors': [], 'bad': []}
    page.on('console', lambda m: log['console'].append(m.text) if m.type in ('error', 'warning') else None)
    page.on('pageerror', lambda e: log['errors'].append(str(e)))
    page.on('requestfailed', lambda r: log['bad'].append('FAILED ' + r.url))
    page.on('response', lambda r: log['bad'].append(f'{r.status} {r.url}') if r.status >= 400 else None)
    if init:
        page.add_init_script(init)
    page.goto(url)
    page.wait_for_selector('#cards .card')
    return ctx, page, log


def verdict(page):
    return page.inner_text('.verdict'), page.locator('.verdict').get_attribute('class')


def metrics(page):
    vals = page.locator('.metrics strong').all_inner_texts()
    return vals[0], vals[1]  # expected, observed


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('url')
    ap.add_argument('--shots')
    args = ap.parse_args()
    url = args.url
    shots = args.shots
    if shots:
        os.makedirs(shots, exist_ok=True)
    tmp = tempfile.mkdtemp(prefix='bya-dl-')

    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx, page, log = new_page(browser, url)
        labs = page.evaluate("window.AssumptionLab.labs.map(l => ({id: l.id, title: l.title, options: l.options}))")
        check('six labs are listed', page.locator('#cards .card').count() == 6 and len(labs) == 6)
        check('progress starts at 0 / 6', page.inner_text('#progress') == '0 / 6 fixes explored')
        check('page has a single h1 and a skip link', page.locator('h1').count() == 1 and page.locator('a.skip').count() == 1)

        for lab in labs:
            lid = lab['id']
            page.evaluate("history.replaceState(null, '', location.pathname + location.search)")
            page.evaluate("window.dispatchEvent(new HashChangeEvent('hashchange'))")
            card = page.locator(f'[data-lab="{lid}"]')
            card.focus(); page.keyboard.press('Enter')
            page.wait_for_selector('#workbench:not([hidden])')
            check(f'{lid}: keyboard Enter opens the lab and sets the hash', page.evaluate('location.hash') == '#' + lid)
            check(f'{lid}: heading receives focus', page.evaluate("document.activeElement && document.activeElement.id") == 'lab-title')
            check(f'{lid}: repair disabled before the first run', page.is_disabled('#repair'))
            page.locator('[data-choice="0"]').click()
            check(f'{lid}: prediction is reflected with aria-pressed', page.get_attribute('[data-choice="0"]', 'aria-pressed') == 'true')
            page.click('#run')
            text, cls = verdict(page)
            exp, obs = metrics(page)
            want_obs, want_exp = DEFAULTS[lid]
            check(f'{lid}: default original breaks the invariant', 'fail' in cls and (obs, exp) == (want_obs, want_exp), f'{text} obs={obs} exp={exp}')
            check(f'{lid}: trace is chronological and non-empty', page.locator('.trace li').count() >= 3)
            check(f'{lid}: announcer mentions the result', 'Assumption broken' in page.inner_text('#announce'))
            check(f'{lid}: lesson, limits, source and download appear',
                  page.is_visible('#lesson') and page.is_visible('.boundary') and page.locator('details pre code').count() == 1 and page.is_visible('#download'))
            page.click('#repair')
            text, cls = verdict(page)
            exp, obs = metrics(page)
            check(f'{lid}: default repair holds the invariant', 'pass' in cls and obs == exp == want_exp, f'{text} obs={obs} exp={exp}')
            # every condition, both versions, and mode preservation
            for value, label, breaks in lab['options']:
                page.select_option('#condition', value)
                page.click('#run')
                _, cls = verdict(page)
                check(f'{lid}: original under "{label}" {"breaks" if breaks else "holds (no-failure control)"}', ('fail' in cls) == breaks, cls)
                page.click('#repair')
                _, cls = verdict(page)
                check(f'{lid}: repair under "{label}" holds', 'pass' in cls, cls)
                # changing condition keeps the repaired mode
                others = [o[0] for o in lab['options'] if o[0] != value]
                if others:
                    page.select_option('#condition', others[0])
                    check(f'{lid}: changing the condition keeps the repaired mode', page.inner_text('#state') == 'REPAIR APPLIED' and 'pass' in verdict(page)[1])
                    page.click('#run')
                    check(f'{lid}: Run experiment returns to the original handler', page.inner_text('#state') == 'ORIGINAL HANDLER')
                    page.select_option('#condition', value)
            if lid == 'offline':
                page.select_option('#condition', 'same'); page.click('#run'); page.click('#repair')
                check('offline: same-field repair retains both candidates', page.locator('.conflict').count() == 1 and 'retain both' in page.inner_text('.trace'))
                page.select_option('#condition', 'different')
                check('offline: different-field repair shows no conflict notice', page.locator('.conflict').count() == 0)
            # download and run the exported file with the real Node runner
            with page.expect_download() as dl:
                page.click('#download')
            d = dl.value
            path = os.path.join(tmp, d.suggested_filename)
            d.save_as(path)
            check(f'{lid}: download is named {lid}.test.cjs', d.suggested_filename == f'{lid}.test.cjs', d.suggested_filename)
            env = {k: v for k, v in os.environ.items() if k != 'NODE_TEST_CONTEXT'}
            run = subprocess.run(['node', '--test', path], capture_output=True, text=True, env=env, cwd=tmp)
            check(f'{lid}: downloaded file passes under node --test', run.returncode == 0 and ('# fail 0' in run.stdout or 'ℹ fail 0' in run.stdout), run.stdout[-300:] + run.stderr[-300:])
            if shots:
                page.screenshot(path=os.path.join(shots, f'desktop-{lid}.png'), full_page=True)

        check('progress shows 6 / 6 after all repairs', page.inner_text('#progress') == '6 / 6 fixes explored')
        check('all six cards are marked explored', page.locator('.card-bottom', has_text='Fix explored').count() == 6)
        stored = page.evaluate("localStorage.getItem('bya-progress-v1')")
        check('stored progress contains only the six lab IDs', sorted(json.loads(stored)) == sorted(l['id'] for l in labs), str(stored))
        page.reload(); page.wait_for_selector('#cards .card')
        check('progress persists across reload', page.inner_text('#progress') == '6 / 6 fixes explored')
        page.click('#reset-progress')
        check('reset clears progress immediately', page.inner_text('#progress') == '0 / 6 fixes explored')
        page.reload(); page.wait_for_selector('#cards .card')
        check('reset persists across reload', page.inner_text('#progress') == '0 / 6 fixes explored' and page.evaluate("localStorage.getItem('bya-progress-v1')") is None)
        check('no console errors, page errors, failed or 4xx/5xx requests (desktop run)', not (log['errors'] or log['bad'] or [c for c in log['console']]), json.dumps(log))
        ctx.close()

        # direct links and history
        base = norm(url)
        ctx, page, log = new_page(browser, base + '#unicode')
        page.wait_for_selector('#workbench:not([hidden])')
        check('direct link #unicode opens that lab', page.inner_text('#lab-title') == 'The invisible difference')
        page.goto(base + '#payment'); page.wait_for_selector('#lab-title')
        page.evaluate("location.hash = 'ticket'")
        page.wait_for_function("document.querySelector('#lab-title') && document.querySelector('#lab-title').textContent === 'The last ticket'")
        page.go_back()
        page.wait_for_function("document.querySelector('#lab-title') && document.querySelector('#lab-title').textContent === 'Payment déjà vu'")
        check('browser Back returns to the previous lab', page.inner_text('#lab-title') == 'Payment déjà vu')
        page.go_forward()
        page.wait_for_function("document.querySelector('#lab-title') && document.querySelector('#lab-title').textContent === 'The last ticket'")
        check('browser Forward returns to the next lab', page.inner_text('#lab-title') == 'The last ticket')
        page.click('#close-lab')
        check('Close experiment hides the workbench and returns focus to its card', page.is_hidden('#workbench') and page.evaluate("document.activeElement.dataset.lab") == 'ticket')
        page.goto(base + '#nonsense'); page.wait_for_selector('#cards .card')
        check('unknown fragment opens no lab and throws no error', page.is_hidden('#workbench') and not log['errors'], json.dumps(log))
        ctx.close()

        # optional storage
        blocked = "Object.defineProperty(window, 'localStorage', {get() { throw new DOMException('blocked', 'SecurityError'); }});"
        ctx, page, log = new_page(browser, base + '#payment', init=blocked)
        page.click('#run'); page.click('#repair')
        check('blocked localStorage: experiment and repair still work', 'pass' in verdict(page)[1] and page.inner_text('#progress') == '1 / 6 fixes explored')
        page.click('#reset-progress')
        check('blocked localStorage: reset does not throw', page.inner_text('#progress') == '0 / 6 fixes explored' and not log['errors'], json.dumps(log))
        ctx.close()
        for bad in ['{not json', '{"a":1}', '"payment"', '[1,null,"nope","payment"]']:
            init = f"try {{ localStorage.setItem('bya-progress-v1', {json.dumps(bad)}); }} catch (e) {{}}"
            ctx, page, log = new_page(browser, base, init=init)
            expected = '1 / 6 fixes explored' if bad.startswith('[1') else '0 / 6 fixes explored'
            check(f'malformed stored progress {bad!r} is tolerated', page.inner_text('#progress') == expected and not log['errors'], page.inner_text('#progress') + json.dumps(log))
            ctx.close()

        # narrow layouts
        for width in (390, 320):
            ctx, page, log = new_page(browser, base, viewport={'width': width, 'height': 844})
            def overflow():
                return page.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            check(f'{width}px: landing has no horizontal page overflow', overflow() <= 0, str(overflow()))
            for lab in labs:
                page.goto(base + '#' + lab['id']); page.wait_for_selector('#lab-title')
                page.click('#run'); page.click('#repair')
                check(f'{width}px: {lab["id"]} with results has no horizontal page overflow', overflow() <= 0, str(overflow()))
                if width == 390 and shots:
                    page.screenshot(path=os.path.join(shots, f'mobile-{lab["id"]}.png'), full_page=True)
            if shots and width == 390:
                page.goto(base); page.wait_for_selector('#cards .card')
                page.screenshot(path=os.path.join(shots, 'mobile-landing.png'), full_page=True)
            ctx.close()

        # reduced motion and keyboard focus
        ctx, page, log = new_page(browser, base, reduced=True)
        check('reduced motion: smooth scrolling disabled', page.evaluate("getComputedStyle(document.documentElement).scrollBehavior") == 'auto')
        check('reduced motion: card transitions disabled', page.evaluate("getComputedStyle(document.querySelector('.card')).transitionDuration") in ('0s', '0s, 0s'))
        page.keyboard.press('Tab')
        check('first Tab stop is the skip link and becomes visible', page.evaluate("document.activeElement.className") == 'skip' and page.evaluate("document.activeElement.getBoundingClientRect().top") >= 0)
        page.evaluate("document.querySelector('.card').focus()"); page.keyboard.press('Shift+Tab'); page.keyboard.press('Tab')
        outline = page.evaluate("(() => { const s = getComputedStyle(document.activeElement); return [s.outlineStyle, s.outlineWidth]; })()")
        check('keyboard focus shows a visible outline', outline[0] != 'none' and outline[1] != '0px', str(outline))
        ctx.close()
        browser.close()

    failed = [r for r in results if not r[1]]
    print(f'\n{len(results) - len(failed)} passed, {len(failed)} failed, {len(results)} total')
    sys.exit(1 if failed else 0)


if __name__ == '__main__':
    main()
