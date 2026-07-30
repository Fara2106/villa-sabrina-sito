#!/usr/bin/env node
/**
 * build-images.mjs — genera assets/img/ dalle foto originali.
 *
 *   node scripts/build-images.mjs            (genera)
 *   node scripts/build-images.mjs --force    (rigenera anche se già presente)
 *
 * Non tocca, non sposta e non cancella nessun file originale: apre in lettura
 * le due cartelle di scatti e scrive solo dentro assets/img/.
 *
 * Per ogni foto: WebP q82 alle larghezze richieste + un JPEG progressivo a
 * 1400px come fallback. Le larghezze superiori alla sorgente vengono saltate:
 * le foto professionali sono 1920px e ingrandirle peggiorerebbe solo il file.
 */

import { mkdir, writeFile, readdir, access } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const SRC_PRO = join(ROOT, 'Foto Posarelli (professionali)');
const SRC_DRONE = join(ROOT, 'Foto fatte da me');
const OUT_DIR = join(ROOT, 'assets/img');

const FORCE = process.argv.includes('--force');
const WEBP_QUALITY = 82;
const JPEG_WIDTH = 1400;

/* ------------------------------------------------------------- selezione */
/*
 * crop:  'hero'    ritaglio 16:9
 *        'band'    striscia 6:1 (le fasce panorama sono alte ~150px)
 *        'portrait' ritaglio 4:5
 *        null      fotogramma intero
 * focusY: 0 = ritaglia dall'alto, 1 = dal basso, 0.5 = centro
 * lift:   correzione gamma per gli scatti sottoesposti (>1 schiarisce le
 *         mezzetinte lasciando stare le alte luci)
 */
const SELECTION = [
  {
    src: [SRC_DRONE, 'dji_fly_20260622_152504_43_1782135976157_photo_optimized.jpg'],
    out: 'hero-colline-vigna-san-gimignano',
    role: 'Hero',
    crop: 'hero', focusY: 0.45,
    widths: [800, 1400, 2000, 2600],
    alt: {
      it: 'La villa fra i cipressi con la vigna e la piscina, e le torri di San Gimignano all’orizzonte',
      en: 'The villa among cypresses with the vineyard and pool, and the towers of San Gimignano on the horizon',
    },
  },
  {
    src: [SRC_PRO, '31-villa-sabrina-outdoor-posarellivillas-24-.jpg'],
    out: 'fascia-colline-campi',
    role: 'Fascia panorama 1',
    crop: 'band', focusY: 0.34,
    widths: [800, 1400, 1920],
    alt: {
      it: 'Le colline coltivate della campagna intorno a San Gimignano',
      en: 'The cultivated hills of the countryside around San Gimignano',
    },
  },
  {
    src: [SRC_PRO, '12-villa-sabrina-outdoor-posarellivillas-18-.jpg'],
    out: 'fascia-filari-vigna',
    role: 'Fascia panorama 2',
    crop: 'band', focusY: 0.42,
    widths: [800, 1400, 1920],
    alt: {
      it: 'Filari di vigna e cipressi visti dall’alto',
      en: 'Rows of vines and cypress trees seen from above',
    },
  },
  {
    src: [SRC_PRO, '13-villa-sabrina-outdoor-posarellivillas-8-.jpg'],
    out: 'casa-facciata-porticato',
    role: 'Ritratto — la casa',
    crop: 'portrait', focusX: 0.52,
    widths: [800, 1021],
    alt: {
      it: 'La facciata della casa in pietra e intonaco con il porticato e il prato davanti',
      en: 'The stone and plaster façade of the house with its portico and the lawn in front',
    },
  },
  {
    src: [SRC_PRO, '04-villa-sabrina-posarellivillas-5-.jpg'],
    out: 'soggiorno-camino',
    role: 'Spazi — soggiorno',
    widths: [800, 1400, 1920],
    alt: {
      it: 'Il soggiorno con il camino in muratura, le pareti gialle e le tende blu',
      en: 'The living room with its masonry fireplace, yellow walls and blue curtains',
    },
  },
  {
    src: [SRC_PRO, '35-villa-sabrina-posarellivillas-32-.jpg'],
    out: 'camera-letto-baldacchino',
    role: 'Spazi — camera',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La camera matrimoniale con letto a baldacchino e veli bianchi, pareti verdi e pavimento in cotto',
      en: 'The double bedroom with a four-poster bed and white drapes, green walls and terracotta floor',
    },
  },
  {
    src: [SRC_PRO, '19-villa-sabrina-posarellivillas-17-.jpg'],
    out: 'cucina-credenze-blu',
    role: 'Spazi — cucina',
    widths: [800, 1400, 1920],
    alt: {
      it: 'L’angolo cottura con le ante blu e il tavolo da pranzo in legno apparecchiato',
      en: 'The kitchen corner with blue cabinet doors and the laid wooden dining table',
    },
  },
  {
    src: [SRC_PRO, '01-villa-sabrina-outdoor-posarellivillas-34-.jpg'],
    out: 'piscina-lettini-ombrellone',
    role: 'Spazi — piscina',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La piscina con i lettini, le poltrone e il grande ombrellone, con le colline sullo sfondo',
      en: 'The swimming pool with sun loungers, armchairs and a large parasol, hills in the background',
    },
  },
  {
    src: [SRC_PRO, '23-villa-sabrina-outdoor-posarellivillas-12-.jpg'],
    out: 'giardino-porticato-prato',
    role: 'Spazi — giardino',
    widths: [800, 1400, 1920],
    alt: {
      it: 'Il porticato attrezzato che si affaccia sul prato del giardino',
      en: 'The furnished portico looking onto the garden lawn',
    },
  },
  {
    src: [SRC_DRONE, 'dji_fly_20260622_161326_69_1782137753852_aeb.jpg'],
    out: 'proprieta-dallalto-piscina',
    role: 'Galleria — esterno',
    lift: 1.34,
    widths: [800, 1400, 2000],
    alt: {
      it: 'La proprietà vista dall’alto: la casa, il giardino terrazzato fiorito e la piscina',
      en: 'The property seen from above: the house, the terraced flowering garden and the pool',
    },
  },
  {
    src: [SRC_PRO, '17-villa-sabrina-outdoor-posarellivillas-30-.jpg'],
    out: 'piscina-cipressi-divano',
    role: 'Galleria — esterno',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La piscina vista dal divano all’ombra, con la siepe e i cipressi',
      en: 'The pool seen from the shaded sofa, with the hedge and cypress trees',
    },
  },
  {
    src: [SRC_PRO, '46-villa-sabrina-outdoor-posarellivillas-43-.jpg'],
    out: 'loggia-tavola-apparecchiata',
    role: 'Galleria — esterno',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La tavola apparecchiata sotto la loggia in pietra, pronta per una cena all’aperto',
      en: 'The table laid under the stone loggia, ready for dinner outdoors',
    },
  },
  {
    src: [SRC_PRO, '27-villa-sabrina-outdoor-posarellivillas-19-.jpg'],
    out: 'vista-colline-torri-san-gimignano',
    role: 'Galleria — vista',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La vista dalla proprietà: i filari, la valle e le torri di San Gimignano sul crinale',
      en: 'The view from the property: the vine rows, the valley and the towers of San Gimignano on the ridge',
    },
  },
  {
    src: [SRC_PRO, '63-villa-sabrina-outdoor-posarellivillas-40-.jpg'],
    out: 'scalinata-fiorita',
    role: 'Galleria — dettaglio',
    crop: 'portrait', focusX: 0.5,
    widths: [800, 1021],
    alt: {
      it: 'La scalinata in pietra che sale nel giardino fra gli arbusti fioriti',
      en: 'The stone staircase climbing through the garden between flowering shrubs',
    },
  },
  {
    src: [SRC_PRO, '41-villa-sabrina-outdoor-posarellivillas-38-.jpg'],
    out: 'piscina-teli-lettino',
    role: 'Galleria — dettaglio',
    crop: 'portrait', focusX: 0.45,
    widths: [800, 1021],
    alt: {
      it: 'Teli da bagno blu arrotolati sui lettini a bordo piscina',
      en: 'Rolled blue pool towels on the sun loungers at the poolside',
    },
  },
  {
    src: [SRC_PRO, '49-villa-sabrina-posarellivillas-18-.jpg'],
    out: 'bagno-ardesia-lavabo',
    role: 'Galleria — interno',
    widths: [800, 1400, 1920],
    alt: {
      it: 'Il bagno rifatto, con lavabo d’appoggio su mensola in legno e specchio tondo retroilluminato',
      en: 'The renovated bathroom, with a countertop basin on a wooden shelf and a round backlit mirror',
    },
  },
  {
    src: [SRC_PRO, '44-villa-sabrina-posarellivillas-27-.jpg'],
    out: 'camera-finestra-colline',
    role: 'Galleria — interno',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La seconda camera con letto a baldacchino e la finestra aperta sulle colline',
      en: 'The second bedroom with a four-poster bed and the window open onto the hills',
    },
  },
  {
    src: [SRC_PRO, '34-villa-sabrina-posarellivillas-9-.jpg'],
    out: 'scala-ferro-battuto',
    role: 'Galleria — dettaglio',
    crop: 'portrait', focusX: 0.42,
    widths: [800, 1021],
    alt: {
      it: 'La scala interna con la ringhiera in ferro battuto',
      en: 'The internal staircase with its wrought-iron railing',
    },
  },
  {
    src: [SRC_PRO, '20-villa-sabrina-posarellivillas-33-.jpg'],
    out: 'cucina-dettaglio-piano-blu',
    role: 'Galleria — interno',
    widths: [800, 1400, 1920],
    alt: {
      it: 'Dettaglio della cucina: il piano di lavoro blu, il muro in pietra e la cappa in acciaio',
      en: 'Kitchen detail: the blue worktop, the stone wall and the steel extractor hood',
    },
  },
  {
    src: [SRC_PRO, '53-villa-sabrina-outdoor-posarellivillas-48-.jpg'],
    out: 'chiusura-tavola-arco-vista',
    role: 'Chiusura',
    widths: [800, 1400, 1920],
    alt: {
      it: 'La tavola apparecchiata inquadrata dall’arco in pietra, con le colline oltre',
      en: 'The laid table framed by the stone arch, with the hills beyond',
    },
  },
];

/* ---------------------------------------------------------------- helper */

const ASPECT = { hero: 16 / 9, band: 6 / 1, portrait: 4 / 5 };

/** Ritaglio secondo il ruolo, calcolato sulle dimensioni reali della sorgente. */
function cropBox(meta, item) {
  const { width: W, height: H } = meta;
  if (!item.crop) return null;
  const target = ASPECT[item.crop];
  let w = W;
  let h = Math.round(W / target);
  if (h > H) {
    h = H;
    w = Math.round(H * target);
  }
  const fx = item.focusX ?? 0.5;
  const fy = item.focusY ?? 0.5;
  const left = Math.max(0, Math.min(W - w, Math.round((W - w) * fx)));
  const top = Math.max(0, Math.min(H - h, Math.round((H - h) * fy)));
  return { left, top, width: w, height: h };
}

const exists = (p) => access(p).then(() => true, () => false);

/* ------------------------------------------------------------------ main */

await mkdir(OUT_DIR, { recursive: true });

// controllo preliminare: tutti i file sorgente esistono davvero?
const missing = [];
for (const item of SELECTION) {
  if (!(await exists(join(...item.src)))) missing.push(join(...item.src));
}
if (missing.length) {
  console.error('\n✗ file sorgente non trovati:\n' + missing.map((m) => `   ${m}`).join('\n') + '\n');
  process.exit(1);
}

const manifest = [];
let written = 0;
let skipped = 0;

for (const item of SELECTION) {
  const srcPath = join(...item.src);
  const base = sharp(srcPath, { failOn: 'error' });
  const meta = await base.metadata();
  const box = cropBox(meta, item);
  const srcW = box ? box.width : meta.width;
  const srcH = box ? box.height : meta.height;

  const widths = [...new Set(item.widths)].filter((w) => w <= srcW).sort((a, b) => a - b);
  if (widths.length === 0) widths.push(srcW);

  const pipelineFor = () => {
    let p = sharp(srcPath, { failOn: 'error' }).rotate();
    if (box) p = p.extract(box);
    // In sharp gammaOut > gamma schiarisce: la curva alza le mezzetinte e
    // lascia stare le alte luci, che una moltiplicazione lineare brucerebbe.
    if (item.lift) p = p.gamma(2.2, Math.min(3, 2.2 * item.lift));
    return p;
  };

  const variants = [];
  for (const w of widths) {
    const file = `${item.out}-${w}.webp`;
    const dest = join(OUT_DIR, file);
    if (!FORCE && (await exists(dest))) {
      skipped++;
    } else {
      await pipelineFor()
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: WEBP_QUALITY, effort: 5 })
        .toFile(dest);
      written++;
    }
    variants.push({ file, width: w, height: Math.round((w / srcW) * srcH) });
  }

  // Fallback JPEG progressivo. Il nome NON contiene la larghezza: per i
  // ritratti la sorgente ritagliata è più stretta di JPEG_WIDTH, e un nome
  // calcolato porterebbe il markup a puntare a un file che non esiste.
  const jpegW = Math.min(JPEG_WIDTH, srcW);
  const jpegFile = `${item.out}-fallback.jpg`;
  const jpegDest = join(OUT_DIR, jpegFile);
  if (!FORCE && (await exists(jpegDest))) {
    skipped++;
  } else {
    await pipelineFor()
      .resize({ width: jpegW, withoutEnlargement: true })
      .jpeg({ quality: 82, progressive: true, mozjpeg: true })
      .toFile(jpegDest);
    written++;
  }

  const largest = variants[variants.length - 1];
  manifest.push({
    name: item.out,
    role: item.role,
    source: item.src[1],
    sourceFolder: item.src[0] === SRC_DRONE ? 'Foto fatte da me' : 'Foto Posarelli (professionali)',
    sourceSize: `${meta.width}×${meta.height}`,
    crop: item.crop ?? 'intero',
    lift: item.lift ?? null,
    intrinsic: { width: largest.width, height: largest.height },
    aspect: +(srcW / srcH).toFixed(4),
    variants,
    jpeg: { file: jpegFile, width: jpegW, height: Math.round((jpegW / srcW) * srcH) },
    alt: item.alt,
  });

  process.stderr.write(`· ${item.out.padEnd(36)} ${srcW}×${srcH}  →  ${widths.join('/')}\n`);
}

await writeFile(join(OUT_DIR, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');

/* ----------------------------------------------------------- MANIFEST.md */

const rows = manifest
  .map((m) => {
    const sizes = m.variants.map((v) => v.width).join(', ');
    return `| \`${m.name}\` | ${m.role} | ${m.intrinsic.width}×${m.intrinsic.height} | WebP ${sizes} + JPEG ${m.jpeg.width} | \`${m.source}\` | ${m.sourceFolder === 'Foto fatte da me' ? 'drone' : 'Posarelli'} |`;
  })
  .join('\n');

const md = `# Immagini di Villa Sabrina

Generato da \`scripts/build-images.mjs\`. **Non modificare i file in questa
cartella a mano**: vengono riscritti a ogni build. Per cambiare selezione,
ritagli o testi alternativi si modifica l'array \`SELECTION\` nello script.

Ultima generazione: ${new Date().toISOString().slice(0, 10)}
Formati: WebP qualità ${WEBP_QUALITY} alle larghezze indicate, più un JPEG
progressivo a ${JPEG_WIDTH}px come fallback.

## Da sapere sulle sorgenti

Le foto professionali di Posarelli sono tutte **1920×1277**, quindi 2000 e
2600px non sono generabili da quelle: ingrandirle peggiorerebbe l'immagine e
il peso. Solo l'hero e le viste aeree, che vengono dal drone (**4000×2250**),
arrivano oltre i 1920px.

Nessuna sorgente è verticale: i ritratti 4:5 sono ritagli, con il centro di
interesse indicato da \`focusX\` nello script.

## File

| Nome | Ruolo | Dimensione intrinseca | Varianti | File originale | Origine |
|---|---|---|---|---|---|
${rows}

## Ritagli e correzioni applicate

${manifest
  .filter((m) => m.crop !== 'intero' || m.lift)
  .map(
    (m) =>
      `- \`${m.name}\` — ritaglio **${m.crop}**${m.lift ? `, schiaritura gamma ×${m.lift} (lo scatto è il fotogramma sottoesposto della coppia AEB del drone: l'altro ha il 5% dell'inquadratura bruciata e non è recuperabile)` : ''}`
  )
  .join('\n')}

## Testi alternativi

Gli \`alt\` vivono nel dizionario delle traduzioni dentro \`index.html\`
(chiavi \`alt.<nome-file>\`). Qui sono riportati per riferimento.

${manifest.map((m) => `- **${m.name}**\n  - IT: ${m.alt.it}\n  - EN: ${m.alt.en}`).join('\n')}
`;

await writeFile(join(OUT_DIR, 'MANIFEST.md'), md, 'utf8');

const files = (await readdir(OUT_DIR)).filter((f) => /\.(webp|jpg)$/.test(f));
console.log(`\n✓ ${manifest.length} foto · ${files.length} file in assets/img/ (${written} scritti, ${skipped} già presenti)`);
console.log(`  MANIFEST.md e manifest.json aggiornati\n`);
