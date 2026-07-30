#!/usr/bin/env node
/**
 * fetch-reviews.mjs — specchia le recensioni pubbliche della scheda Posarelli
 * di Villa Sabrina in data/reviews.json.
 *
 *   node scripts/fetch-reviews.mjs --dry-run   (mostra le differenze, non scrive)
 *   node scripts/fetch-reviews.mjs             (scrive)
 *
 * Principi:
 *  - un solo fetch per lingua, User-Agent identificabile;
 *  - id stabile (hash autore+testo): una recensione approvata resta approvata;
 *  - merge, mai sovrascrittura: il campo `approved` scritto a mano non si perde;
 *  - se il parsing trova zero recensioni esce con codice 1 e NON scrive nulla.
 */

import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'node-html-parser';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_FILE = resolve(ROOT, 'data/reviews.json');

const SOURCES = {
  it: 'https://www.posarellivillas.it/italia/toscana/san-gimignano/95494',
  en: 'https://www.posarellivillas.com/italy/tuscany/san-gimignano/95494',
};

const UA =
  'VillaSabrinaSiteBot/1.0 (+https://www.posarellivillas.it/italia/toscana/san-gimignano/95494; ' +
  'mirror delle recensioni della propria scheda; contatto: lorefara97@gmail.com)';

const DRY_RUN = process.argv.includes('--dry-run');

/* ------------------------------------------------------------------ utils */

const fail = (msg) => {
  console.error(`\n[31m✗ ${msg}[0m\n`);
  process.exit(1);
};

const norm = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/**
 * Il campo paese della scheda è compilato a mano dagli ospiti, quindi arriva
 * in forme miste: "GB", "United Kingdom", "Uk", "Deutschland", e perfino due
 * stati americani ("FL" con località Miami, "WA" con località Seattle).
 * Qui si normalizza a codici ISO 3166-1 alpha-2. Nessun valore viene inventato:
 * ciò che non è in tabella resta come pubblicato.
 */
const COUNTRY_ALIASES = new Map(
  Object.entries({
    us: 'US', usa: 'US', 'united states': 'US', fl: 'US', wa: 'US',
    gb: 'GB', uk: 'GB', 'united kingdom': 'GB',
    de: 'DE', deutschland: 'DE', germany: 'DE',
    nl: 'NL', nederland: 'NL',
    ch: 'CH', schweiz: 'CH',
    it: 'IT', italia: 'IT', italy: 'IT',
    fr: 'FR', france: 'FR',
    at: 'AT', austria: 'AT',
    au: 'AU', australia: 'AU',
    ca: 'CA', canada: 'CA',
    be: 'BE', belgium: 'BE', belgique: 'BE',
    se: 'SE', sweden: 'SE', sverige: 'SE',
    si: 'SI', slovenia: 'SI',
  })
);

const normCountry = (raw) => {
  const v = norm(raw);
  if (!v) return null;
  return COUNTRY_ALIASES.get(v.toLowerCase()) ?? v;
};

/** id stabile: dipende solo da autore + testo, non dall'ordine in pagina. */
const stableId = (author, text) =>
  createHash('sha256')
    .update(`${norm(author).toLowerCase()}|${norm(text).toLowerCase()}`)
    .digest('hex')
    .slice(0, 12);

/**
 * Rilevamento della lingua originale del testo. Euristica a punteggio su
 * parole funzione: sufficiente per etichettare "en / de / nl / fr / it / …",
 * che è l'unico uso che ne facciamo. Nessuna traduzione, mai.
 */
const STOPWORDS = {
  it: ' il lo la i gli le un una di da del della che con per non più molto abbiamo siamo stato stata bellissima casa piscina posto soggiorno ospiti tutto è ',
  en: ' the a an of and to in is was were we our have had very with for this that stay stayed house pool lovely great beautiful everything would ',
  de: ' der die das und ist war wir uns haben hatte sehr mit für nicht sind auch ein eine schöne haus pool alles sehr gut aufenthalt ',
  nl: ' de het een en is was wij we ons hebben hadden zeer met voor niet ook heel mooie huis zwembad alles verblijf prachtig ',
  fr: ' le la les un une et est était nous notre avons avec pour ne pas très bien belle maison piscine séjour tout trés ',
  es: ' el la los las un una y es era nosotros hemos con para no muy bien casa piscina estancia todo ',
  da: ' og er var vi vores har havde meget med for ikke også et en dejligt hus pool alt ophold ',
  sv: ' och är var vi vår har hade mycket med för inte också ett en fint hus pool allt vistelse ',
};

function detectLang(text) {
  const t = ` ${norm(text).toLowerCase().replace(/[^\p{L}\s]/gu, ' ').replace(/\s+/g, ' ')} `;
  if (!t.trim()) return null;
  const words = t.trim().split(' ');
  let best = null;
  let bestScore = 0;
  for (const [lang, list] of Object.entries(STOPWORDS)) {
    const set = new Set(list.trim().split(/\s+/));
    let hits = 0;
    for (const w of words) if (set.has(w)) hits++;
    const score = hits / words.length;
    if (score > bestScore) {
      bestScore = score;
      best = lang;
    }
  }
  // sotto il 4% di parole funzione riconosciute non ci fidiamo
  return bestScore >= 0.04 ? best : null;
}

/* ----------------------------------------------------------------- fetch */

async function getPage(url) {
  const res = await fetch(url, {
    headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'it,en' },
    redirect: 'follow',
  });
  if (!res.ok) fail(`${url} ha risposto HTTP ${res.status}. Nessuna modifica scritta.`);
  const html = await res.text();
  if (html.length < 10_000) fail(`la risposta da ${url} è troppo corta (${html.length} byte): probabile blocco o errore.`);
  return html;
}

/* ----------------------------------------------------------------- parse */

function parseReviews(html, url) {
  const doc = parse(html);

  const cards = doc.querySelectorAll('[itemprop="review"]');
  if (cards.length === 0) {
    fail(
      `il markup della pagina è probabilmente cambiato: il selettore [itemprop="review"] non trova nulla su ${url}.\n` +
        `  Controlla la pagina a mano e aggiorna parseReviews() in scripts/fetch-reviews.mjs.\n` +
        `  data/reviews.json NON è stato toccato.`
    );
  }

  const reviews = cards.map((card) => {
    const pick = (sel) => card.querySelector(sel);
    const text = norm(pick('[itemprop="reviewBody"]')?.text);
    const author = norm(pick('[itemprop="author"] [itemprop="name"]')?.text);
    const rating = Number(norm(pick('[itemprop="ratingValue"]')?.text)) || null;

    const locality = norm(pick('[itemprop="addressLocality"]')?.text);
    const country = normCountry(pick('[itemprop="addressCountry"]')?.getAttribute('content'));
    const from = locality ? (country ? `${locality} (${country})` : locality) : null;

    const rawDate = norm(pick('[itemprop="datePublished"]')?.getAttribute('content'));
    // "2026-06-29 04:06:59" -> "2026-06-29"; teniamo solo il giorno
    const date = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : null;

    const label = norm(pick('.review-desc-value')?.text) || null;

    return { rating, author, from, date, text, label };
  });

  const withText = reviews.filter((r) => r.text && r.author);
  if (withText.length === 0) {
    fail(
      `trovate ${cards.length} card ma nessuna con reviewBody + author su ${url}: ` +
        `i selettori interni sono cambiati. data/reviews.json NON è stato toccato.`
    );
  }

  const aggEl = doc.querySelector('[itemprop="aggregateRating"]');
  const aggregate = {
    rating: Number(norm(aggEl?.querySelector('[itemprop="ratingValue"]')?.text)) || null,
    count: Number(norm(aggEl?.querySelector('[itemprop="reviewCount"]')?.text)) || null,
    label: norm(aggEl?.querySelector('.review-desc-value')?.text) || null,
  };

  return { reviews: withText, aggregate, cardCount: cards.length };
}

/* ------------------------------------------------------------------ main */

const pages = {};
for (const [lang, url] of Object.entries(SOURCES)) {
  process.stderr.write(`· fetch ${lang.toUpperCase()} ${url}\n`);
  pages[lang] = parseReviews(await getPage(url), url);
}

const it = pages.it;
const en = pages.en;

if (it.reviews.length !== en.reviews.length) {
  console.warn(
    `⚠ le due lingue riportano un numero diverso di recensioni (IT ${it.reviews.length}, EN ${en.reviews.length}). ` +
      `Uso la pagina IT come riferimento.`
  );
}

// I testi delle recensioni sono scritti dagli ospiti e identici nelle due
// lingue: cambiano solo le etichette del sito. La IT è la fonte di record.
const scraped = it.reviews.map((r) => ({
  id: stableId(r.author, r.text),
  rating: r.rating,
  author: r.author,
  from: r.from,
  lang: detectLang(r.text),
  date: r.date,
  text: r.text,
  approved: false,
}));

// etichetta del voto nelle due lingue (es. Eccellente / Excellent)
const labels = { it: it.aggregate.label, en: en.aggregate.label };

/* ------------------------------------------------------- merge non distruttivo */

let previous = null;
try {
  previous = JSON.parse(await readFile(OUT_FILE, 'utf8'));
} catch {
  /* primo giro: nessun file esistente */
}

const prevById = new Map((previous?.reviews ?? []).map((r) => [r.id, r]));
const scrapedIds = new Set(scraped.map((r) => r.id));

const merged = scraped.map((r) => {
  const old = prevById.get(r.id);
  // `approved` è l'unico campo editoriale: si conserva sempre.
  return old ? { ...r, approved: old.approved === true } : r;
});

const added = merged.filter((r) => !prevById.has(r.id));
const removed = [...prevById.values()].filter((r) => !scrapedIds.has(r.id));
const changed = merged.filter((r) => {
  const old = prevById.get(r.id);
  return old && (old.text !== r.text || old.date !== r.date || old.from !== r.from);
});

const output = {
  fetchedAt: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  source: SOURCES.it,
  sourceEn: SOURCES.en,
  aggregate: {
    rating: it.aggregate.rating,
    count: it.aggregate.count,
    label: labels,
  },
  reviews: merged,
};

/* ---------------------------------------------------------------- report */

const approvedCount = merged.filter((r) => r.approved).length;
const langs = merged.reduce((acc, r) => {
  const k = r.lang ?? '??';
  acc[k] = (acc[k] ?? 0) + 1;
  return acc;
}, {});

console.log('');
console.log(`  recensioni lette      ${merged.length}   (card in pagina: ${it.cardCount})`);
console.log(`  aggregate dichiarato  ${output.aggregate.rating}/5 su ${output.aggregate.count}`);
console.log(`  lingue rilevate       ${Object.entries(langs).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`  con data              ${merged.filter((r) => r.date).length}`);
console.log(`  approvate (mantenute) ${approvedCount}`);
console.log(`  nuove                 ${added.length}`);
console.log(`  testo/data cambiati   ${changed.length}`);
console.log(`  spariti dalla scheda  ${removed.length}`);

if (output.aggregate.count && merged.length !== output.aggregate.count) {
  console.warn(
    `\n⚠ la scheda dichiara ${output.aggregate.count} recensioni ma ne ho estratte ${merged.length}. ` +
      `Non è un errore fatale (alcune possono essere senza testo), ma vale un controllo.`
  );
}

if (added.length) {
  console.log('\n  — nuove recensioni (entrano con approved:false) —');
  for (const r of added) {
    console.log(`    ${r.id}  ${r.rating}/5  ${r.author} · ${r.from ?? '—'} · ${r.lang ?? '??'} · ${r.date ?? 'senza data'}`);
    console.log(`               "${r.text.slice(0, 96)}${r.text.length > 96 ? '…' : ''}"`);
  }
}
if (changed.length) {
  console.log('\n  — modificate sulla scheda —');
  for (const r of changed) console.log(`    ${r.id}  ${r.author}`);
}
if (removed.length) {
  console.log('\n  — non più sulla scheda (verranno rimosse dal JSON) —');
  for (const r of removed) console.log(`    ${r.id}  ${r.author}  approved:${r.approved === true}`);
}

if (DRY_RUN) {
  console.log(`\n[33m--dry-run: nessuna scrittura.[0m Per applicare: npm run reviews\n`);
  process.exit(0);
}

/*
 * Se non e cambiato niente di sostanziale il file NON si riscrive.
 * Senza questo controllo `fetchedAt` cambierebbe a ogni esecuzione e il file
 * risulterebbe sempre modificato: l'automazione settimanale farebbe un commit
 * e aprirebbe un avviso ogni lunedi anche senza novita, e dopo un mese quegli
 * avvisi non li leggerebbe piu nessuno.
 *
 * Conseguenza voluta: `fetchedAt` e la data dell'ultimo CAMBIAMENTO, non
 * dell'ultimo controllo. In fondo alla pagina e quella che interessa.
 */
const semantico = (d) =>
  JSON.stringify({
    aggregate: d?.aggregate ?? null,
    reviews: (d?.reviews ?? []).map((r) => [
      r.id, r.rating, r.author, r.from, r.lang, r.date, r.text, r.approved === true,
    ]),
  });

if (previous && semantico(previous) === semantico(output)) {
  console.log(
    `\n= nessuna modifica: data/reviews.json lasciato com'e ` +
      `(ultimo cambiamento ${previous.fetchedAt}).\n`
  );
  process.exit(0);
}

await mkdir(dirname(OUT_FILE), { recursive: true });
await writeFile(OUT_FILE, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(`\n[32m✓ scritto data/reviews.json[0m (${merged.length} recensioni, ${approvedCount} approvate)\n`);
