// Checks the production build has everything needed to install and run offline.
import { existsSync, readFileSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
const fail = (msg) => { console.error(`✕ ${msg}`); process.exitCode = 1; };
const ok = (msg) => console.log(`✓ ${msg}`);
const read = (f) => readFileSync(new URL(f, dist), 'utf8');

for (const f of ['index.html', 'manifest.webmanifest', 'sw.js', 'pwa-192.png', 'pwa-512.png', 'maskable-512.png', 'apple-touch-icon.png', 'favicon.svg']) {
  existsSync(new URL(f, dist)) ? ok(`${f} exists`) : fail(`${f} missing`);
}

const manifest = JSON.parse(read('manifest.webmanifest'));
manifest.name === 'Magic: ranked' ? ok('manifest name') : fail(`manifest name is ${manifest.name}`);
manifest.display === 'standalone' ? ok('standalone display') : fail('display not standalone');
manifest.icons?.some((i) => i.sizes === '512x512' && i.purpose === 'maskable') ? ok('maskable icon') : fail('no maskable icon');
manifest.icons?.some((i) => i.sizes === '192x192') ? ok('192 icon') : fail('no 192 icon');

const html = read('index.html');
html.includes('manifest.webmanifest') ? ok('manifest linked') : fail('manifest not linked');
html.includes('Content-Security-Policy') ? ok('CSP present') : fail('CSP missing');

const sw = read('sw.js');
sw.includes('index.html') ? ok('app shell precached') : fail('index.html not precached');
sw.includes('scryfall-api') && sw.includes('scryfall-images') ? ok('Scryfall runtime caching') : fail('runtime caching missing');
