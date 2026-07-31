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
 * Vengono scritte SOLO le recensioni con approved:true, ed è la stessa lista
 * che finisce nel markup visibile. Nel JSON-LD invece non finiscono affatto:
 * il perché sta nel commento accanto alla costruzione di `ld`.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const INDEX = resolve(ROOT, 'index.html');
const REVIEWS = resolve(ROOT, 'data/reviews.json');

/* Il taglio a 180 caratteri e l'interruttore REVIEWS_FULL_TEXT vivevano anche
   qui, perché servivano a costruire i reviewBody del JSON-LD. Ora che le
   recensioni dal JSON-LD sono uscite, l'unica copia che conta è quella in
   index.html: quando arriva il permesso di Posarelli si cambia lì, in un
   posto solo, e non più in due da tenere allineati. */

const LISTING_IT = 'https://www.posarellivillas.it/italia/toscana/san-gimignano/95494';
/* Deve restare uguale al canonical in index.html. Il giorno del dominio
   proprio si cambiano tutti e due. */
const SITE_URL = 'https://fara2106.github.io/villa-sabrina-sito/';

/* Le coordinate della casa non stanno in questo file, e non stanno in
 * pagina. Nella porzione accanto i proprietari ci abitano tutto l'anno: la
 * posizione esatta la dà Posarelli a chi ha prenotato, non un sito pubblico.
 * Se un giorno dovessero servire davvero, si ricavano dal GPS nell'EXIF degli
 * scatti del drone in "Foto fatte da me" — ma la scelta di pubblicarle non è
 * tecnica, e va rifatta ogni volta.
 */

const fail = (m) => {
  console.error(`\n✗ ${m}\n`);
  process.exit(1);
};

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
  /* url è la pagina ufficiale di questa casa, cioè questa. Prima puntava alla
     scheda Posarelli, che era la stessa contraddizione del vecchio canonical
     detta in un altro linguaggio. Posarelli resta, ma al posto giusto: sameAs
     è «lo stesso soggetto, altrove», ed è esattamente quello che è. */
  url: SITE_URL,
  sameAs: [LISTING_IT],
  /* Comune, regione, paese e basta: nessuna via, nessun civico, nessun geo.
     Per farsi trovare da chi cerca "casa vacanze San Gimignano" il comune
     basta; il resto lo dà Posarelli a chi ha prenotato. */
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

/* Qui c'erano aggregateRating e le 12 Review. Sono stati tolti apposta.
 *
 * Google: «se l'entità recensita controlla le recensioni su sé stessa, le sue
 * pagine che usano LocalBusiness o qualunque altro tipo di Organization non
 * sono eleggibili per le stelle». LodgingBusiness è una sottoclasse di
 * LocalBusiness, e questo è il sito della casa recensita: le stelle non
 * sarebbero mai arrivate, e la marcatura resta auto-referenziale — cioè un
 * rischio senza contropartita.
 *
 * Le recensioni continuano a stare in pagina, dove servono a chi legge: sono
 * nel blocco REVIEWS:DATA qui sopra. Non tornano qui dentro nemmeno quando
 * Posarelli darà il permesso ai testi integrali: quello riguarda il diritto di
 * ripubblicarli, non il tipo di marcatura, che resta ineleggibile.
 */

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
console.log(`  review nel JSON-LD      nessuna, per scelta (vedi il commento sul JSON-LD)`);
if (approved.length === 0) {
  console.log('');
  console.log('  ⚠ nessuna recensione approvata: la sezione mostrerà il messaggio di cortesia.');
  console.log('    Per approvarne una: metti "approved": true in data/reviews.json e rilancia questo comando.');
}
console.log(`\n✓ index.html aggiornato\n`);
