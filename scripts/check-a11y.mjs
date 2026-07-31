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
    ['servizi · voce', '.servizi-gruppo li'],
    ['informazioni · testo', '.info p'],
    ['avviso prezzi', '.notice'],
    ['footer · testo', '.site-footer p'],
    ['footer · barra bassa', '.foot-bottom'],
    ['footer · luogo', '.foot-loc'],
    ['pulsante bordato', '.btn'],
    ['caption fascia', '.band figcaption'],
    ['stat · etichetta', '.stats span'],
    ['barra bassa · recensioni', '.dock .score'],
    ['arrivo · testo', '.arrivo-grid p'],
    ['arrivo · coordinate', '.coord'],
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
await page.evaluate(() => document.querySelector('.tile-media').focus());
const tileFocused = await page.evaluate(() => document.activeElement.classList.contains('tile-media'));
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
const focusBack = await page.evaluate(() => document.activeElement.classList.contains('tile-media'));

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

// col pannello aperto il Tab non deve uscire sul contenuto dietro, e una ✕
// visibile deve bastare a chiudere: su un telefono Esc non esiste
await page.evaluate(() => document.querySelector('#burger').click());
await new Promise((r) => setTimeout(r, 500));
let escaped = 0;
for (let i = 0; i < 12; i++) {
  await page.keyboard.press('Tab');
  if (!(await page.evaluate(() => document.querySelector('#nav').contains(document.activeElement)))) escaped++;
}
const closeVisible = await page.evaluate(() => {
  const b = document.querySelector('#nav-close');
  const r = b.getBoundingClientRect();
  const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { visibile: r.width > 0 && b.contains(top), area: `${Math.round(r.width)}×${Math.round(r.height)}` };
});
const scrollBlocked = await page.evaluate(async () => {
  const y = window.scrollY;
  window.scrollBy(0, 600);
  await new Promise((r) => setTimeout(r, 120));
  return window.scrollY === y;
});
await page.evaluate(() => document.querySelector('#nav-close').click());
await new Promise((r) => setTimeout(r, 450));
const closedByTap = await page.evaluate(() => !document.querySelector('#nav').classList.contains('is-open'));
console.log(`  il Tab resta dentro al pannello      ${escaped === 0 ? 'sì' : `NO (${escaped}/12 fuori)`}`);
console.log(`  la ✕ è visibile e in cima            ${closeVisible.visibile ? 'sì' : 'NO'}  (${closeVisible.area})`);
console.log(`  si chiude col tocco                  ${closedByTap ? 'sì' : 'NO'}`);
console.log(`  la pagina non scorre dietro          ${scrollBlocked ? 'sì' : 'NO'}`);

// le cinque foto de "Gli spazi" aprono la lightbox anche senza mouse
const spazi = await page.evaluate(() => {
  const b = document.querySelectorAll('.spazio-media');
  return {
    n: b.length,
    bottoni: [...b].every((e) => e.tagName === 'BUTTON'),
    etichette: [...b].every((e) => (e.getAttribute('aria-label') || '').length > 3),
  };
});
await page.evaluate(() => document.querySelector('.spazio-media').focus());
await page.keyboard.press('Enter');
await new Promise((r) => setTimeout(r, 400));
const spazioApre = await page.evaluate(() => document.querySelector('#lightbox').classList.contains('is-open'));
await page.keyboard.press('Escape');
await new Promise((r) => setTimeout(r, 300));
console.log(`  "Gli spazi": foto raggiungibili      ${spazi.bottoni && spazi.etichette ? 'sì' : 'NO'}  (${spazi.n} bottoni con etichetta)`);
console.log(`  Invio apre la lightbox               ${spazioApre ? 'sì' : 'NO'}`);

// il nome del comando dev'essere una frase, non tutta la didascalia
const nomeTessera = await page.evaluate(() => {
  const b = document.querySelector('.tile-media');
  return (b.getAttribute('aria-label') || b.textContent).replace(/\s+/g, ' ').trim();
});
console.log(`  nome della tessera galleria          ${nomeTessera.length} caratteri${nomeTessera.length > 160 ? '  ⚠ troppo lungo' : ''}`);

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
