"""Browser regression checks. Run a local HTTP server on port 8000 first."""
import json
from pathlib import Path
from playwright.sync_api import sync_playwright

CARDS = json.loads(Path(__file__).with_name('data').joinpath('cards.json').read_text(encoding='utf-8'))
BY_ID = {c['id']: c for c in CARDS}


def current(page):
    return int(page.locator('.card-number').inner_text().split()[-1])


with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=1)
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto('http://localhost:8000')
    page.locator('.topic').first.wait_for()
    assert page.locator('.topic').count() == 11
    assert page.locator('.summary strong').first.inner_text() == '190'
    page.locator('.all').click()
    first = current(page)
    page.locator('.option').nth((BY_ID[first]['correctIndex'] + 1) % 4).click()
    assert page.locator('.wrong').count() == 1
    assert page.locator('.correct').count() == 1
    assert page.locator('.option:disabled').count() == 4
    assert page.locator('.explanation').inner_text() == BY_ID[first]['explanation']
    assert page.locator('progress').get_attribute('value') == '0'
    page.locator('.primary').click()
    seen = []
    while page.locator('.card').count():
        n = current(page)
        seen.append(n)
        assert page.locator('h2').inner_text() == BY_ID[n]['question']
        page.locator('.option').nth(BY_ID[n]['correctIndex']).click()
        assert page.locator('.wrong').count() == 0
        assert page.locator('.explanation').inner_text() == BY_ID[n]['explanation']
        assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
        page.locator('.primary').click()
    assert len(seen) == 190 and len(set(seen)) == 190 and seen[-1] == first
    assert page.locator('h1').inner_text() == 'Готово!'
    assert '191' in page.locator('.done').inner_text()
    page.get_by_role('button', name='Повторить тему', exact=True).click()
    assert page.locator('progress').get_attribute('max') == '190'
    assert page.locator('progress').get_attribute('value') == '0'
    page.get_by_role('button', name='← К темам').click()
    page.get_by_role('button', name='Банковский надзор и CBC', exact=False).click()
    assert page.locator('progress').get_attribute('max') == '9'
    for _ in range(9):
        n = current(page)
        assert BY_ID[n]['topic'] == 'Банковский надзор и CBC'
        page.locator('.option').nth(BY_ID[n]['correctIndex']).click()
        page.locator('.primary').click()
    page.get_by_role('button', name='Повторить тему', exact=True).click()
    assert page.locator('progress').get_attribute('max') == '9'
    page.set_viewport_size({'width': 320, 'height': 640})
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.set_viewport_size({'width': 1280, 'height': 900})
    page.get_by_role('button', name='← К темам').click()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    page.screenshot(path='test-results/home.png', full_page=True)
    page.route('**/data/cards.json', lambda route: route.fulfill(status=503, body='Unavailable'))
    page.reload()
    page.get_by_role('button', name='Попробовать снова').wait_for()
    page.unroute('**/data/cards.json')
    page.get_by_role('button', name='Попробовать снова').click()
    page.locator('.all').wait_for()
    assert not errors, errors
    browser.close()
    print('PASS: 190 cards, wrong-answer requeue, completion, restart, topic filtering, responsive layout, load-error retry')
