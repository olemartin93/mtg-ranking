// End-to-end smoke test on the production build at phone size.
// Scryfall is stubbed so the test is deterministic. Checks: app renders,
// search works, decks persist, and the app still loads offline via the service worker.
// Usage: npm run build && node scripts/e2e.mjs [screenshotDir]
import { chromium, devices } from 'playwright';
import { preview } from 'vite';

const shots = process.argv[2];
const server = await preview({ preview: { port: 4173, strictPort: true } });
const base = 'http://localhost:4173/mtg-ranking/';

const card = (name, extra = {}) => ({
  object: 'card', id: name.toLowerCase().replace(/\W/g, '-'), name, cmc: 1, type_line: 'Instant', mana_cost: '{R}',
  oracle_text: 'Deal 3 damage to any target.', color_identity: ['R'], legalities: { modern: 'legal', commander: 'legal' },
  set: 'tst', set_name: 'Test', rarity: 'common', released_at: '2024-01-01', ...extra,
});
const svgCard = (label) => `<svg xmlns="http://www.w3.org/2000/svg" width="488" height="680"><rect width="100%" height="100%" rx="20" fill="#7c2d12"/><text x="50%" y="50%" fill="white" font-size="36" text-anchor="middle">${label}</text></svg>`;

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices['Pixel 7'], serviceWorkers: 'allow' });
await context.route('https://cards.scryfall.io/**', (r) => r.fulfill({ contentType: 'image/svg+xml', body: svgCard(decodeURIComponent(r.request().url().split('/').pop() ?? '')) }));
await context.route('https://api.scryfall.com/**', (route) => {
  const url = new URL(route.request().url());
  const json = (b) => route.fulfill({ contentType: 'application/json', body: JSON.stringify(b) });
  if (url.pathname === '/sets') return json({ data: [{ object: 'set', id: 's', code: 'nxt', name: 'Next Big Set', set_type: 'expansion', released_at: '2099-01-01', card_count: 42, icon_svg_uri: 'https://svgs.scryfall.io/x.svg', digital: false }] });
  if (url.pathname === '/cards/lightning-bolt') return json(card('Lightning Bolt', { image_uris: { normal: 'https://cards.scryfall.io/Lightning%20Bolt' } }));
  const names = ['Lightning Bolt', 'Shock', 'Lava Spike', 'Rift Bolt', 'Chain Lightning', 'Fireblast'];
  return json({ object: 'list', has_more: false, total_cards: names.length, data: names.map((n) => card(n, { image_uris: { normal: `https://cards.scryfall.io/${encodeURIComponent(n)}` } })) });
});

const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
const step = async (name, fn) => { await fn(); console.log(`✓ ${name}`); if (shots) await page.screenshot({ path: `${shots}/${name.replace(/\W+/g, '-')}.png` }); };

try {
  await step('home loads', async () => {
    await page.goto(base);
    await page.getByRole('heading', { name: /Magic/ }).waitFor();
  });
  await step('search shows cards', async () => {
    await page.getByRole('searchbox').fill('bolt');
    await page.getByRole('button', { name: 'Search' }).click();
    await page.getByRole('img', { name: 'Lightning Bolt' }).waitFor();
  });
  await step('create deck', async () => {
    await page.getByRole('link', { name: 'Decks' }).click();
    await page.getByRole('textbox', { name: 'Deck name' }).fill('Burn');
    await page.getByRole('combobox', { name: 'Deck format' }).selectOption('modern');
    await page.getByRole('button', { name: 'Create deck' }).click();
    await page.getByText('Building:').waitFor();
  });
  await step('add card to deck', async () => {
    await page.goto(`${base}#/card/lightning-bolt`);
    await page.getByRole('button', { name: '+ Deck' }).click();
    await page.getByRole('button', { name: '+ Deck' }).click();
    await page.getByText(/Added to deck/).waitFor();
  });
  await step('deck stats', async () => {
    await page.getByText('Building:').click();
    await page.getByRole('tab', { name: 'Stats' }).click();
    await page.getByText('Mana curve').waitFor();
  });
  await step('upcoming sets', async () => {
    await page.getByRole('link', { name: 'Upcoming' }).click();
    await page.getByText('Next Big Set').waitFor();
  });
  await step('rankings', async () => {
    await page.getByRole('link', { name: 'Rankings' }).click();
    await page.getByText('#1', { exact: true }).waitFor();
  });
  await step('works offline after reload', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); // make sure the SW controls the page
    await page.evaluate(async () => { if (!navigator.serviceWorker.controller) await new Promise((r) => navigator.serviceWorker.addEventListener('controllerchange', r)); });
    await context.setOffline(true);
    await page.goto(`${base}#/decks`);
    await page.getByText('Burn').first().waitFor();
    await page.getByText(/Offline/).waitFor();
  });
  if (errors.length) throw new Error(`Page errors: ${errors.join('; ')}`);
  console.log('All e2e checks passed');
} catch (e) {
  console.error('✕', e instanceof Error ? e.message : e);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.httpServer.close();
}
