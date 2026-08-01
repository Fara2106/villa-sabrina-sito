#!/usr/bin/env node
/**
 * check-perf.mjs — misura la pagina come la riceve un telefono in 4G.
 *
 *   npm run serve            (in un'altra shell)
 *   npm run check:perf
 *
 * Nasce da un errore vero: l'entrata in dissolvenza dell'hero aveva portato
 * l'LCP da 2,6 a 4,3 secondi, e il difetto non si vedeva né a schermo né in
 * nessuno degli altri controlli — la pagina sembrava identica, solo più lenta.
 * Il punto che conta è QUALE elemento è LCP: qui è il titolo dell'hero, non la
 * fotografia, quindi tutto ciò che ne ritarda il primo disegno (opacità di
 * partenza a zero, font che blocca, ritardi di animazione) si paga per intero.
 *
 * Esce con codice 1 se una soglia salta: serve a fermare una regressione, non
 * a fare classifiche.
 *
 * Perché non basta Lighthouse. Lanciato sul sito online, sulla stessa URL e a
 * parità di byte scaricati (538 KiB), tre esecuzioni di fila hanno dato 76, 81
 * e 100 di Performance, con l'FCP fra 1,3 e 3,9 secondi: Lighthouse simula la
 * rete lenta sopra a quella vera, e la rete vera cambia. Questo script invece
 * impone la banda con il Chrome DevTools Protocol, quindi ripete lo stesso
 * numero. Per decidere se una modifica ha peggiorato qualcosa si guarda qui;
 * Lighthouse resta utile per l'occhio d'insieme e per SEO e accessibilità.
 * Il segnale che distingue i due casi è il peso: se i byte non cambiano e il
 * tempo sì, è la misura, non la pagina.
 */

import puppeteer from 'puppeteer-core';

const URL = process.env.SITE_URL || 'http://127.0.0.1:8788/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

/* Soglie: il margine è quello misurato oggi, non un numero di listino. */
const LIMITE = {
  lcp: 1200,        // ms — oggi siamo intorno ai 450
  cls: 0.05,
  bytePrimoSchermo: 900 * 1024,
};

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const page = await browser.newPage();
await page.setViewport({ width: 412, height: 823, isMobile: true, hasTouch: true, deviceScaleFactor: 2.6 });

/* 4G lento e processore quattro volte più lento: un telefono vero in campagna
   toscana, che è esattamente dove questa pagina viene aperta. */
const cdp = await page.target().createCDPSession();
await cdp.send('Network.enable');
await cdp.send('Network.emulateNetworkConditions', {
  offline: false,
  latency: 150,
  downloadThroughput: (1.6 * 1024 * 1024) / 8,
  uploadThroughput: (750 * 1024) / 8,
});
await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });

await page.evaluateOnNewDocument(() => {
  window.__lcp = [];
  window.__cls = 0;
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) {
      window.__lcp.push({
        t: Math.round(e.startTime),
        size: e.size,
        el: e.element
          ? e.element.tagName +
            (e.element.id ? `#${e.element.id}` : '') +
            (e.element.className ? `.${String(e.element.className).split(' ')[0]}` : '')
          : '?',
      });
    }
  }).observe({ type: 'largest-contentful-paint', buffered: true });
  new PerformanceObserver((l) => {
    for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value;
  }).observe({ type: 'layout-shift', buffered: true });
});

const fallite = [];
page.on('requestfailed', (r) => fallite.push(r.url().split('/').pop()));

await page.goto(URL, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));

const m = await page.evaluate(() => {
  const nav = performance.getEntriesByType('navigation')[0] || {};
  const fcp = performance.getEntriesByName('first-contentful-paint')[0];
  const res = performance.getEntriesByType('resource');
  const perTipo = {};
  let byte = 0;
  for (const r of res) {
    byte += r.transferSize || 0;
    const ext = (r.name.split('?')[0].match(/\.(\w+)$/) || [, 'altro'])[1];
    perTipo[ext] = (perTipo[ext] || 0) + (r.transferSize || 0);
  }
  return {
    lcp: window.__lcp,
    cls: Math.round(window.__cls * 1000) / 1000,
    fcp: fcp ? Math.round(fcp.startTime) : null,
    documento: Math.round((nav.transferSize || 0) / 1024),
    byte,
    file: res.length,
    perTipo: Object.fromEntries(
      Object.entries(perTipo)
        .sort((a, b) => b[1] - a[1])
        .map(([k, v]) => [k, `${Math.round(v / 1024)} kB`])
    ),
  };
});

const ultimo = m.lcp[m.lcp.length - 1];

console.log('\n=== PRIMO SCHERMO, telefono in 4G ===');
console.log(`  documento (compresso dal server)  ${m.documento} kB`);
console.log(`  file scaricati                    ${m.file}  ·  ${Math.round(m.byte / 1024)} kB`);
console.log(`  per formato                       ${JSON.stringify(m.perTipo)}`);
console.log(`  first contentful paint            ${m.fcp} ms`);
console.log(`  layout shift cumulativo           ${m.cls}`);

console.log('\n=== CANDIDATI LCP, in ordine ===');
for (const e of m.lcp) {
  console.log(`  ${String(`${e.t} ms`).padStart(8)}  ${String(e.size).padStart(8)} px²  ${e.el}`);
}
console.log(`\n  → LCP: ${ultimo ? `${ultimo.t} ms su ${ultimo.el}` : 'non rilevato'}`);

/* --------------------------------------------------------------- verdetto */
const male = [];
if (!ultimo) male.push('nessun elemento LCP rilevato');
else if (ultimo.t > LIMITE.lcp) male.push(`LCP ${ultimo.t} ms sopra il limite di ${LIMITE.lcp} ms (elemento: ${ultimo.el})`);
if (m.cls > LIMITE.cls) male.push(`layout shift ${m.cls} sopra ${LIMITE.cls}`);
if (m.byte > LIMITE.bytePrimoSchermo) male.push(`${Math.round(m.byte / 1024)} kB al primo schermo, oltre i ${Math.round(LIMITE.bytePrimoSchermo / 1024)} kB`);
if (fallite.length) male.push(`richieste fallite: ${[...new Set(fallite)].join(', ')}`);

/* Le fotografie devono arrivare in AVIF: se ricompare il WebP vuol dire che
   una <source> è saltata nel markup e si pagano un terzo di byte in più. */
const formati = await page.evaluate(() =>
  [...document.querySelectorAll('img')]
    .filter((i) => i.currentSrc && /assets\/img/.test(i.currentSrc))
    .map((i) => i.currentSrc.split('.').pop())
);
const nonAvif = formati.filter((f) => f !== 'avif');
console.log(`\n  fotografie servite: ${formati.length}, di cui in AVIF ${formati.length - nonAvif.length}`);
if (nonAvif.length) male.push(`${nonAvif.length} immagini non servite in AVIF (${[...new Set(nonAvif)].join(', ')})`);

if (male.length) {
  console.log('\n=== FUORI SOGLIA ===');
  male.forEach((x) => console.log(`  ✗ ${x}`));
  console.log('');
  await browser.close();
  process.exit(1);
}

console.log('\n  ✓ tutto dentro le soglie\n');
await browser.close();
