/**
 * check-contrast-on-images.mjs — contrasto del testo che sta SOPRA una foto.
 *
 * Il controllo in check-a11y.mjs risale il DOM per trovare un background-color
 * e quindi non vede nulla quando dietro c'è un'immagine: hero, fasce panorama
 * e chiusura passavano senza essere mai misurate.
 *
 * Qui si misura sul serio: per ogni elemento si nasconde il testo, si fotografa
 * la sua area, e si calcola il contrasto fra il colore del testo e OGNI pixel
 * di sfondo. Conta il caso peggiore, non la media.
 */
import puppeteer from 'puppeteer-core';
import sharp from 'sharp';

const URL = process.env.VS_URL || 'http://127.0.0.1:8788/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const TARGETS = [
  ['hero · etichetta', '.hero .eyebrow'],
  ['hero · titolo', '.hero h1'],
  ['hero · sottotitolo', '.hero-tag'],
  ['hero · meta', '.hero-meta'],
  ['hero · "Scorri"', '.scroll-hint span:first-child'],
  ['fascia 1 · didascalia', '.band:nth-of-type(1) figcaption'],
  ['chiusura · etichetta', '.closing .eyebrow'],
  ['chiusura · titolo', '.closing h2'],
  ['chiusura · testo', '.closing p:not(.eyebrow)'],
];

const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const lum = (r, g, b) =>
  0.2126 * srgb(r / 255) + 0.7152 * srgb(g / 255) + 0.0722 * srgb(b / 255);
const ratio = (l1, l2) => {
  const [a, b] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (a + 0.05) / (b + 0.05);
};

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
});

let worstOverall = Infinity;
const rows = [];

for (const width of [390, 1440]) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 });
  await page.evaluate(() => {
    document.querySelectorAll('.reveal').forEach((el) => el.classList.add('in'));
  });
  await new Promise((r) => setTimeout(r, 1200));

  for (const [label, sel] of TARGETS) {
    const info = await page.evaluate((s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      el.scrollIntoView({ block: 'center' });
      return null;
    }, sel).then(() => new Promise((r) => setTimeout(r, 700)))
      .then(() => page.evaluate((s) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const cs = getComputedStyle(el);
        const m = (cs.color.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
        const size = parseFloat(cs.fontSize);
        const weight = Number(cs.fontWeight) || 400;

        // I rettangoli VERI delle righe di testo, non la scatola dell'elemento:
        // un <p> di blocco è largo quanto la pagina anche se la scritta occupa
        // trecento pixel, e misurare la scatola significa misurare soprattutto
        // sfondo vuoto dove testo non ce n'è.
        const range = document.createRange();
        range.selectNodeContents(el);
        // getClientRects() restituisce un rettangolo per il nodo di testo e uno
        // per ogni elemento inline: un <i> dentro il titolo compare due volte.
        // Senza deduplica la stessa area viene pesata il doppio.
        // I rettangoli del range sono gonfiati da ascendente e discendente del
        // font: con un display come il Bodoni a 158px sbordano sopra e sotto,
        // fin dentro il testo vicino. Se quel vicino ha lo stesso colore si
        // finisce per misurare crema su crema, cioè 1:1, e sembra un difetto
        // gravissimo che non esiste. Vanno ritagliati sulla scatola vera.
        const bb = el.getBoundingClientRect();
        const seen = new Set();
        const rects = [];
        for (const r of range.getClientRects()) {
          const x = Math.max(r.x, bb.x);
          const y = Math.max(r.y, bb.y);
          const right = Math.min(r.right, bb.right);
          const bottom = Math.min(r.bottom, bb.bottom);
          if (right - x < 2 || bottom - y < 2) continue;
          const k = [x, y, right, bottom].map(Math.round).join(':');
          if (seen.has(k)) continue;
          seen.add(k);
          rects.push({ x, y, width: right - x, height: bottom - y });
        }
        range.detach?.();
        if (!rects.length) return null;

        // ATTENZIONE: il clip di page.screenshot è in coordinate di PAGINA,
        // non di viewport: senza gli offset di scroll si fotografa altrove.
        const boxes = rects.map((r) => ({
          x: Math.max(0, Math.floor(r.x + window.scrollX)),
          y: Math.max(0, Math.floor(r.y + window.scrollY)),
          w: Math.ceil(r.width), h: Math.ceil(r.height),
        }));
        return {
          boxes,
          pageW: document.documentElement.scrollWidth,
          pageH: document.documentElement.scrollHeight,
          color: m, size,
          large: size >= 24 || (size >= 18.66 && weight >= 700),
        };
      }, sel));

    if (!info) continue;

    // nascondi il testo e fotografa solo lo sfondo che gli sta sotto
    await page.evaluate((s) => {
      document.querySelector(s).style.visibility = 'hidden';
    }, sel);
    await new Promise((r) => setTimeout(r, 400));

    const need = info.large ? 3 : 4.5;
    const tl = lum(info.color[0], info.color[1], info.color[2]);

    let worst = Infinity;
    let fails = 0;
    let total = 0;

    for (const b of info.boxes) {
      const clip = {
        x: b.x, y: b.y,
        width: Math.min(b.w, info.pageW - b.x),
        height: Math.min(b.h, info.pageH - b.y),
      };
      if (clip.width < 2 || clip.height < 2) continue;
      const buf = await page.screenshot({ clip, type: 'png' });
      const { data, info: meta } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      for (let i = 0; i < data.length; i += meta.channels) {
        const c = ratio(tl, lum(data[i], data[i + 1], data[i + 2]));
        if (c < worst) worst = c;
        if (c < need) fails++;
        total++;
      }
    }
    await page.evaluate((s) => { document.querySelector(s).style.visibility = ''; }, sel);
    if (!total) continue;

    const failPct = (fails / total) * 100;
    if (worst < worstOverall) worstOverall = worst;

    rows.push({ width, label, worst, need, failPct, size: info.size });
  }
  await page.close();
}

console.log('\n=== CONTRASTO DEL TESTO SOPRA LE FOTO ===');
console.log('   (caso peggiore su ogni pixel dello sfondo, non la media)\n');
let bad = 0;
for (const w of [390, 1440]) {
  console.log(`  ── ${w}px ──`);
  for (const r of rows.filter((x) => x.width === w)) {
    const ok = r.worst >= r.need;
    if (!ok) bad++;
    const mark = ok ? 'OK ' : 'NO ';
    console.log(
      `  ${mark} ${r.worst.toFixed(2).padStart(6)}:1  (serve ${r.need})  ` +
      `${r.failPct > 0 ? `${r.failPct.toFixed(1)}% dell'area sotto soglia  ` : ''}${r.label}`
    );
  }
}
console.log(
  bad
    ? `\n  ✗ ${bad} elementi non leggibili in almeno un punto\n`
    : `\n  ✓ tutto leggibile anche nel punto peggiore (minimo ${worstOverall.toFixed(2)}:1)\n`
);

await browser.close();
process.exit(bad ? 1 : 0);
