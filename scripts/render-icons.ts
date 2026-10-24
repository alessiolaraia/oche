// Rendert public/icons/icon.svg in PNGs (Chromium via Playwright). Aufruf: npx tsx scripts/render-icons.ts
import { chromium } from '@playwright/test';
import { readFileSync } from 'node:fs';

const svg = readFileSync('public/icons/icon.svg', 'utf8');
const targets: [string, number, number][] = [
  // Name, Größe, Innenabstand (maskable braucht Sicherheitszone)
  ['icon-192.png', 192, 0],
  ['icon-512.png', 512, 0],
  ['maskable-512.png', 512, 0.1],
  ['apple-touch-icon.png', 180, 0],
];
const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad] of targets) {
  await page.setViewportSize({ width: size, height: size });
  const inner = Math.round(size * (1 - 2 * pad));
  await page.setContent(
    `<html><body style="margin:0;background:#F1EEEA;display:grid;place-items:center;width:${size}px;height:${size}px">
     <div style="width:${inner}px;height:${inner}px">${svg.replace('<svg ', `<svg width="${inner}" height="${inner}" `)}</div></body></html>`,
  );
  await page.screenshot({ path: `public/icons/${name}`, omitBackground: false });
  console.log(name);
}
await browser.close();
