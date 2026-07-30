#!/usr/bin/env node
/**
 * build-site.mjs — inietta in index.html le recensioni approvate e il JSON-LD.
 *
 *   node scripts/build-site.mjs
 *
 * Perché un passo di build invece di un fetch al caricamento: il sito resta
 * apribile anche da file://, i dati strutturati sono nel sorgente (i crawler
 * non devono eseguire JavaScript per vederli) e la pagina non fa richieste
 * di rete per mostrare le recensioni.
 *
 * Vengono scritte SOLO le recensioni con approved:true — la stessa lista che
 * finisce nel markup visibile e nel JSON-LD, come richiede Google.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = resolve(ROOT, 'index.html');
const REVIEWS = resolve(ROOT, 'data/reviews.json');

const EXCERPT_LENGTH = 180; // deve restare allineato a index.html
const REVIEWS_FULL_TEXT = false;

const LISTING_IT = 'https://www.posarellivillas.it/italia/toscana/san-gimignano/95494';

const fail = (m) => {
  console.error(`\n✗ ${m}\n`);
  process.exit(1);
};

/** Stesso taglio a fine parola usato dalla pagina, così testo e JSON-LD coincidono. */
function excerpt(text) {
  if (REVIEWS_FULL_TEXT || text.length <= EXCERPT_LENGTH) return text;
  let slice = text.slice(0, EXCERPT_LENGTH);
  const sp = slice.lastIndexOf(' ');
  if (sp > EXCERPT_LENGTH * 0.6) slice = slice.slice(0, sp);
  return `${slice.replace(/[\s,;:.–-]+$/, '')}…`;
}

function replaceBlock(html, name, content) {
  const re = new RegExp(`(<!-- ${name}:START -->)([\\s\\S]*?)(<!-- ${name}:END -->)`);
  if (!re.test(html)) fail(`in index.html manca il blocco <!-- ${name}:START --> … <!-- ${name}:END -->`);
  return html.replace(re, `$1\n${content}\n$3`);
}

/* ------------------------------------------------------------------ dati */

let data;
try {
  data = JSON.parse(await readFile(REVIEWS, 'utf8'));
} catch {
  fail(`data/reviews.json non è leggibile. Lancia prima: npm run reviews`);
}

const all = data.reviews ?? [];
const approved = all.filter((r) => r.approved === true);

if (all.length === 0) fail('data/reviews.json non contiene recensioni.');

let html = await readFile(INDEX, 'utf8');

/* ------------------------------------------- blocco dati per la pagina */

const payload = {
  fetchedAt: data.fetchedAt ?? null,
  aggregate: {
    rating: data.aggregate?.rating ?? null,
    count: data.aggregate?.count ?? null,
  },
  // in pagina finiscono solo le approvate, e senza il campo approved
  reviews: approved.map(({ id, rating, author, from, lang, date, text }) => ({
    id, rating, author, from, lang, date, text, approved: true,
  })),
};

html = replaceBlock(
  html,
  'REVIEWS:DATA',
  `<script type="application/json" id="reviews-data">${JSON.stringify(payload).replace(/</g, '\\u003c')}</script>`
);

/* ------------------------------------------------------------- JSON-LD */

const ld = {
  '@context': 'https://schema.org',
  '@type': 'LodgingBusiness',
  name: 'Villa Sabrina',
  description:
    'Casa vacanze con piscina privata sulle colline del Chianti, a 5 km da San Gimignano. ' +
    '160 m² su due piani, 3 camere da letto, fino a 7 ospiti, giardino recintato di uso esclusivo.',
  url: LISTING_IT,
  address: {
    '@type': 'PostalAddress',
    addressLocality: 'San Gimignano',
    addressRegion: 'Toscana',
    addressCountry: 'IT',
  },
  numberOfRooms: 3,
  maximumAttendeeCapacity: 7,
  petsAllowed: 'Su richiesta',
  smokingAllowed: false,
  amenityFeature: [
    'Piscina privata',
    'Giardino recintato',
    'Aria condizionata',
    'Wi-Fi gratuito',
    'Barbecue',
    'Parcheggio interno',
    'Lavatrice',
    'Lavastoviglie',
    'Vista panoramica',
  ].map((n) => ({ '@type': 'LocationFeatureSpecification', name: n, value: true })),
  photo: [
    'assets/img/hero-poster-2600.webp',
    'assets/img/casa-vigna-torri-dallalto-2000.webp',
    'assets/img/piscina-lettini-ombrellone-1920.webp',
    'assets/img/vista-colline-torri-san-gimignano-1920.webp',
  ],
};

// aggregateRating e review vengono da data/reviews.json, non sono scritti a mano
if (data.aggregate?.rating && data.aggregate?.count) {
  ld.aggregateRating = {
    '@type': 'AggregateRating',
    ratingValue: data.aggregate.rating,
    reviewCount: data.aggregate.count,
    bestRating: 5,
    worstRating: 1,
  };
}

if (approved.length > 0) {
  ld.review = approved.map((r) => {
    const review = {
      '@type': 'Review',
      author: { '@type': 'Person', name: r.author },
      reviewRating: {
        '@type': 'Rating',
        ratingValue: r.rating ?? 5,
        bestRating: 5,
        worstRating: 1,
      },
      reviewBody: excerpt(r.text),
    };
    if (r.date) review.datePublished = r.date;
    if (r.lang) review.inLanguage = r.lang;
    return review;
  });
}

html = replaceBlock(
  html,
  'JSONLD',
  `<script type="application/ld+json">${JSON.stringify(ld, null, 0).replace(/</g, '\\u003c')}</script>`
);

await writeFile(INDEX, html, 'utf8');

/* ---------------------------------------------------------------- report */

console.log('');
console.log(`  recensioni nel JSON     ${all.length}`);
console.log(`  approvate → in pagina   ${approved.length}`);
console.log(`  aggregateRating         ${ld.aggregateRating ? `${ld.aggregateRating.ratingValue}/5 su ${ld.aggregateRating.reviewCount}` : '— assente'}`);
console.log(`  review nel JSON-LD      ${ld.review?.length ?? 0}`);
if (approved.length === 0) {
  console.log('');
  console.log('  ⚠ nessuna recensione approvata: la sezione mostrerà il messaggio di cortesia.');
  console.log('    Per approvarne una: metti "approved": true in data/reviews.json e rilancia questo comando.');
}
console.log(`\n✓ index.html aggiornato\n`);
