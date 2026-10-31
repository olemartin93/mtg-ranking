// Renders public/favicon.svg to the PNG icons the PWA manifest needs.
// Uses Playwright's Chromium: `node scripts/generate-icons.mjs`
import { createRequire } from 'node:module';
import { execSync } from 'node:child_process';

// Use a local playwright if installed, otherwise the global one.
const require = createRequire(import.meta.url);
let pw;
try { pw = require('playwright'); } catch { pw = require(execSync('npm root -g').toString().trim() + '/playwright'); }
const { chromium } = pw;
import { readFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const targets = [
  { file: 'pwa-192.png', size: 192, pad: 0 },
  { file: 'pwa-512.png', size: 512, pad: 0 },
  { file: 'apple-touch-icon.png', size: 180, pad: 0, square: true },
  // Maskable icons need the artwork inside the central 80% safe zone.
  { file: 'maskable-512.png', size: 512, pad: 0.12, square: true },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  const inner = Math.round(t.size * (1 - t.pad * 2));
  const bg = t.square ? '#020617' : 'transparent';
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<html><body style="margin:0;background:${bg};display:flex;align-items:center;justify-content:center;width:${t.size}px;height:${t.size}px">
    <div style="width:${inner}px;height:${inner}px">${(t.square ? svg.replace(`rx="112"`, `rx="0"`) : svg).replace("<svg ", `<svg width="${inner}" height="${inner}" `)}</div></body></html>`);
  await page.screenshot({ path: new URL(`../public/${t.file}`, import.meta.url).pathname, omitBackground: !t.square });
  console.log('wrote', t.file);
}
await browser.close();
