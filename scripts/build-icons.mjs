// Gera os ícones PNG do app a partir de icons/icon.svg (o desenho vetorial, que vale para qualquer tamanho).
// Uso: node scripts/build-icons.mjs
import { readFileSync } from 'node:fs';
import { chromium } from 'playwright';

const svg = readFileSync('icons/icon.svg', 'utf8');
// Quadrado cheio, sem cantos: o iPhone e o Android recortam o formato sozinhos.
const square = svg.replace('rx="150"', 'rx="0"');
// Maskable: a caixa fica dentro da zona segura (círculo de 80% do centro).
const maskable = square.replace('<g id="caixa">', '<g id="caixa" transform="translate(450 455) scale(0.8) translate(-450 -455)">');

const ICONS = [
  ['icons/icon-512.png', svg, 512],
  ['icons/icon-192.png', svg, 192],
  ['icons/favicon.png', svg, 64],
  ['icons/icon-maskable-512.png', maskable, 512],
  ['icons/apple-touch-icon.png', square, 180],
];

const browser = await chromium.launch();
const page = await browser.newPage();
const shot = async (html, w, h, path, type = 'png') => {
  await page.setViewportSize({ width: w, height: h });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block}</style>${html}`);
  await page.screenshot({ path, type, omitBackground: type === 'png', ...(type === 'jpeg' && { quality: 92 }) });
};
const sized = (s, w) => s.replace('<svg ', `<svg width="${w}" height="${w}" `);

for (const [path, src, w] of ICONS) await shot(sized(src, w), w, w, path);
// Imagem de compartilhamento (WhatsApp, redes): ícone no centro de um fundo claro.
await shot(`<div style="width:1200px;height:630px;background:#f6f7f2;display:grid;place-items:center">${sized(svg, 440)}</div>`, 1200, 630, 'icons/og.jpg', 'jpeg');

await browser.close();
console.log('Ícones gerados.');
