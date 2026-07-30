import puppeteer from 'puppeteer-core';

const OUT = '/private/tmp/claude-501/-Users-lorenzofaraoni-Documents-Web--Apps--Villa-Sabrina-sito/3e2cbe46-ff13-4ffb-9095-610d0995d51a/scratchpad';
const URL = 'http://127.0.0.1:8788/index.html';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-dev-shm-usage', '--force-device-scale-factor=1'],
});

const widths = [
  { w: 360, h: 780, name: '360' },
  { w: 768, h: 1024, name: '768' },
  { w: 1280, h: 900, name: '1280' },
  { w: 1920, h: 1080, name: '1920' },
];

const errors = [];

for (const { w, h, name } of widths) {
  const page = await browser.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`[${name}] ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`[${name}] PAGEERROR ${e.message}`));
  page.on('requestfailed', (r) => errors.push(`[${name}] 404/fail ${r.url().split('/').pop()}`));

  await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
  await page.goto(URL, { waitUntil: 'networkidle0', timeout: 60000 });
  await new Promise((r) => setTimeout(r, 900));

  // hero
  await page.screenshot({ path: `${OUT}/shot-${name}-hero.jpg`, type: 'jpeg', quality: 80 });

  // sezione recensioni
  await page.evaluate(() => document.querySelector('#recensioni').scrollIntoView());
  await new Promise((r) => setTimeout(r, 1200));
  await page.screenshot({ path: `${OUT}/shot-${name}-reviews.jpg`, type: 'jpeg', quality: 80 });

  // overflow orizzontale?
  const overflow = await page.evaluate(() => ({
    scrollW: document.documentElement.scrollWidth,
    clientW: document.documentElement.clientWidth,
  }));
  if (overflow.scrollW > overflow.clientW + 1) {
    errors.push(`[${name}] OVERFLOW ORIZZONTALE: scrollWidth ${overflow.scrollW} > clientWidth ${overflow.clientW}`);
  }

  console.log(`${name}px  ok  (scrollW ${overflow.scrollW} / clientW ${overflow.clientW})`);
  await page.close();
}

// sezioni chiave a 1280 (una schermata intera fa crashare il renderer:
// la pagina è alta parecchie migliaia di pixel di sole immagini)
const SECTIONS = ['#casa', '#spazi', '#servizi', '#dintorni', '#galleria', '#informazioni'];
const page = await browser.newPage();
page.on('requestfailed', (r) => errors.push(`[sezioni] fail ${r.url().split('/').pop()}`));
await page.setViewport({ width: 1280, height: 900 });
await page.goto(URL, { waitUntil: 'networkidle0' });
for (const sel of SECTIONS) {
  await page.evaluate((s) => document.querySelector(s).scrollIntoView(), sel);
  await new Promise((r) => setTimeout(r, 1100));
  await page.screenshot({ path: `${OUT}/shot-sec-${sel.slice(1)}.jpg`, type: 'jpeg', quality: 78 });
}
console.log('sezioni catturate');
await page.close();

await browser.close();

if (errors.length) {
  console.log('\n=== PROBLEMI ===');
  [...new Set(errors)].forEach((e) => console.log('  ' + e));
} else {
  console.log('\nnessun errore di console, nessuna richiesta fallita, nessun overflow');
}
