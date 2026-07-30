/**
 * check-a11y.mjs — contrasti reali e navigazione da tastiera.
 * Legge i colori calcolati dal browser, non quelli sperati.
 */
import puppeteer from 'puppeteer-core';

const URL = 'http://127.0.0.1:8788/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME, headless: 'new', args: ['--no-sandbox'],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle0' });

/* ------------------------------------------------------------- contrasti */
const contrast = await page.evaluate(() => {
  const srgb = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const lum = (rgb) => {
    const [r, g, b] = rgb.map((v) => srgb(v / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const parse = (s) => (s.match(/\d+(\.\d+)?/g) || []).slice(0, 3).map(Number);
  const ratio = (a, b) => {
    const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (l1 + 0.05) / (l2 + 0.05);
  };
  const bgOf = (el) => {
    let n = el;
    while (n && n !== document.documentElement) {
      const c = getComputedStyle(n).backgroundColor;
      const p = parse(c);
      if (p.length === 3 && !/rgba\(0, 0, 0, 0\)/.test(c)) return p;
      n = n.parentElement;
    }
    return [20, 31, 28];
  };

  const targets = [
    ['corpo · salvia su fondo', '#casa .body p'],
    ['corpo · salvia su fondo alt', '#spazi .body'],
    ['oro · etichetta sezione', '.eyebrow'],
    ['voce di menu', '.nav a'],
    ['testo recensione', '.review-text'],
    ['meta recensione', '.review-foot'],
    ['data recensione', '.review-date'],
    ['etichetta lingua', '.review-lang'],
    ['link "leggi tutta"', '.review-more'],
    ['dintorni · km oro', '.dintorno .km'],
    ['dintorni · descrizione', '.dintorno .desc'],
    ['nota CTA recensioni', '.rev-cta .note'],
    ['servizi · voce', '.servizi-list span'],
    ['informazioni · testo', '.info p'],
    ['avviso prezzi', '.notice'],
    ['footer · testo', '.site-footer p'],
    ['footer · barra bassa', '.foot-bottom'],
    ['footer · luogo', '.foot-loc'],
    ['pulsante bordato', '.btn'],
    ['caption fascia', '.band figcaption'],
    ['stat · etichetta', '.stats span'],
    ['hero · sottotitolo', '.hero-tag'],
    ['hero · meta', '.hero-meta'],
    ['galleria · nota', '.gal-hint'],
    ['lightbox · contatore', '.lb-count'],
  ];

  return targets.map(([label, sel]) => {
    const el = document.querySelector(sel);
    if (!el) return { label, sel, missing: true };
    const cs = getComputedStyle(el);
    const fg = parse(cs.color);
    const bg = bgOf(el);
    const size = parseFloat(cs.fontSize);
    const weight = Number(cs.fontWeight) || 400;
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const r = ratio(fg, bg);
    return {
      label, sel,
      ratio: Math.round(r * 100) / 100,
      size: Math.round(size * 10) / 10,
      need: large ? 3 : 4.5,
      pass: r >= (large ? 3 : 4.5),
      passAAA: r >= (large ? 4.5 : 7),
    };
  });
});

console.log('\n=== CONTRASTI (WCAG 2.1) ===');
let failed = 0;
for (const c of contrast) {
  if (c.missing) { console.log(`  ?  ${c.label} — selettore non trovato (${c.sel})`); continue; }
  const mark = c.pass ? (c.passAAA ? 'AAA' : 'AA ') : 'NO ';
  if (!c.pass) failed++;
  console.log(`  ${mark}  ${String(c.ratio).padStart(5)}:1  (serve ${c.need})  ${c.size}px  ${c.label}`);
}
console.log(failed ? `\n  ✗ ${failed} sotto soglia` : '\n  ✓ tutti i testi passano AA');

/* -------------------------------------------------------------- tastiera */
console.log('\n=== TASTIERA ===');

const focusables = await page.evaluate(() =>
  document.querySelectorAll('a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])').length);
console.log(`  elementi raggiungibili con Tab: ${focusables}`);

// lightbox: apertura da tastiera, frecce, Esc, ritorno del fuoco
await page.evaluate(() => document.querySelector('#galleria').scrollIntoView());
await new Promise((r) => setTimeout(r, 500));
await page.evaluate(() => document.querySelector('.tile').focus());
const tileFocused = await page.evaluate(() => document.activeElement.className.includes('tile'));
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 400));
const lbOpen = await page.evaluate(() => document.querySelector('#lightbox').classList.contains('is-open'));
const firstCap = await page.evaluate(() => document.querySelector('#lb-count').textContent);
await page.keyboard.press('ArrowRight');
await new Promise((r) => setTimeout(r, 250));
const afterArrow = await page.evaluate(() => document.querySelector('#lb-count').textContent);
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 350));
const lbClosed = await page.evaluate(() => !document.querySelector('#lightbox').classList.contains('is-open'));
const focusBack = await page.evaluate(() => document.activeElement.className.includes('tile'));

console.log(`  tessera galleria riceve il fuoco     ${tileFocused ? 'sì' : 'NO'}`);
console.log(`  Invio apre la lightbox               ${lbOpen ? 'sì' : 'NO'}`);
console.log(`  freccia destra cambia foto           ${firstCap !== afterArrow ? 'sì' : 'NO'}  (${firstCap.trim()} → ${afterArrow.trim()})`);
console.log(`  Esc chiude                           ${lbClosed ? 'sì' : 'NO'}`);
console.log(`  il fuoco torna alla tessera          ${focusBack ? 'sì' : 'NO'}`);

// "Mostra altre"
await page.evaluate(() => document.querySelector('#recensioni').scrollIntoView());
await new Promise((r) => setTimeout(r, 400));
const before = await page.evaluate(() => document.querySelectorAll('#reviews-list .review').length);
await page.evaluate(() => document.querySelector('#reviews-more').focus());
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 400));
const after = await page.evaluate(() => document.querySelectorAll('#reviews-list .review').length);
const hiddenNow = await page.evaluate(() => document.querySelector('#reviews-more').hidden);
console.log(`  "Mostra altre" da tastiera           ${after > before ? 'sì' : 'NO'}  (${before} → ${after} recensioni)`);
console.log(`  il pulsante sparisce a lista finita  ${hiddenNow ? 'sì' : 'NO'}`);

// cambio lingua
await page.evaluate(() => document.querySelector('.lang button[data-lang="en"]').focus());
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 500));
const langState = await page.evaluate(() => ({
  html: document.documentElement.lang,
  nav: document.querySelector('.nav a').textContent,
  cta: document.querySelector('#cta-hero').href,
  score: document.querySelector('#score-value').textContent,
  alt: document.querySelector('.hero img').alt.slice(0, 40),
}));
console.log(`  toggle lingua da tastiera            ${langState.html === 'en' ? 'sì' : 'NO'}  (lang="${langState.html}", menu "${langState.nav}", voto "${langState.score}")`);
console.log(`  i link seguono la lingua             ${langState.cta.includes('.com') ? 'sì' : 'NO'}  ${langState.cta.replace('https://www.', '')}`);
console.log(`  gli alt seguono la lingua            "${langState.alt}…"`);

// menu mobile
await page.setViewport({ width: 360, height: 780 });
await new Promise((r) => setTimeout(r, 300));
await page.evaluate(() => document.querySelector('#burger').focus());
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 450));
const menuOpen = await page.evaluate(() => ({
  open: document.querySelector('#nav').classList.contains('is-open'),
  expanded: document.querySelector('#burger').getAttribute('aria-expanded'),
  focusInside: document.querySelector('#nav').contains(document.activeElement),
}));
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 400));
const menuClosed = await page.evaluate(() => !document.querySelector('#nav').classList.contains('is-open'));
console.log(`  menu mobile apre da tastiera         ${menuOpen.open ? 'sì' : 'NO'}  (aria-expanded="${menuOpen.expanded}")`);
console.log(`  il fuoco entra nel menu              ${menuOpen.focusInside ? 'sì' : 'NO'}`);
console.log(`  Esc chiude il menu                   ${menuClosed ? 'sì' : 'NO'}`);

/* ------------------------------------------------- prefers-reduced-motion */
const page2 = await browser.newPage();
await page2.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
await page2.setViewport({ width: 1280, height: 900 });
await page2.goto(URL, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 600));
const rm = await page2.evaluate(() => {
  const el = document.querySelector('.section-title.reveal') || document.querySelector('.reveal');
  const cs = getComputedStyle(el);
  return {
    opacity: cs.opacity,
    transform: cs.transform,
    transition: cs.transitionDuration,
    tile: getComputedStyle(document.querySelector('.tile img')).transitionDuration,
  };
});
console.log('\n=== PREFERS-REDUCED-MOTION ===');
console.log(`  contenuti visibili senza animazione  ${rm.opacity === '1' ? 'sì' : 'NO'}  (opacity ${rm.opacity}, transform ${rm.transform})`);
console.log(`  transizioni azzerate                 ${parseFloat(rm.transition) < 0.01 ? 'sì' : 'NO'}  (sezioni ${rm.transition}, tessere ${rm.tile})`);

await browser.close();
console.log('');
