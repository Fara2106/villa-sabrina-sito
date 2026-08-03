#!/usr/bin/env node
/**
 * check-testi.mjs — quello che sui testi non si vede rileggendo.
 *
 *   npm run check:testi
 *
 * Cinque misure, in quest'ordine:
 *
 *   1. i testi scritti a mano nel markup contro I18N.it. Sono il fallback per
 *      chi arriva senza JavaScript, ed è l'unica versione che un crawler legge
 *      prima di eseguire lo script: se restano indietro dopo una riscrittura,
 *      il sito serve per mesi la versione vecchia senza che nessuno se ne
 *      accorga. È successo, ed è il motivo per cui questo controllo esiste.
 *   2. le cinque lingue devono avere le stesse chiavi: una che manca diventa
 *      un buco in pagina.
 *   3. quanto sono lunghi titolo e descrizione: Google ne mostra ~60 e ~155
 *      caratteri, il resto lo taglia.
 *   4. le frasi dette due volte. Rileggendo non si vedono — la stessa frase in
 *      due sezioni distanti non suona ripetuta — mentre contando le sequenze
 *      di 5+ parole saltano fuori. Non tutte sono difetti: le date della
 *      piscina o "uso esclusivo" ripetuti fra la scheda e le informazioni
 *      pratiche vanno bene. Vanno guardate, non azzerate.
 *   5. i fatti della scheda Posarelli devono esserci ancora tutti: riscrivere
 *      non può perdere per strada un dato.
 */
import { readFile } from 'node:fs/promises';
import { parse } from 'node-html-parser';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const html = await readFile(resolve(ROOT, 'index.html'), 'utf8');

function extractObj(src, marker) {
  const start = src.indexOf(marker);
  const open = src.indexOf('{', start);
  let depth = 0, i = open, inStr = null, esc = false;
  for (; i < src.length; i++) {
    const c = src[i];
    if (inStr) {
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === inStr) inStr = null;
      continue;
    }
    if (c === "'" || c === '"') { inStr = c; continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return src.slice(open, i);
}

const I18N = new Function('return ' + extractObj(html, 'var I18N ='))();
const ALT = new Function('return ' + extractObj(html, 'var ALT ='))();
const doc = parse(html);
const norm = (s) => s.replace(/\s+/g, ' ').trim();

/* 1 — markup vs i18n.it */
let dis = 0;
for (const el of doc.querySelectorAll('[data-i18n]')) {
  const key = el.getAttribute('data-i18n');
  const val = I18N.it[key];
  if (typeof val !== 'string') { console.log(`  ! ${key} manca in I18N.it`); dis++; continue; }
  if (key === 'rev.average') continue;           // template con {count}
  if (norm(el.innerHTML) !== norm(val)) {
    dis++;
    console.log(`\n[${key}]\n  markup: ${norm(el.innerHTML)}\n  i18n  : ${norm(val)}`);
  }
}
for (const el of doc.querySelectorAll('[data-i18n-alt]')) {
  const key = el.getAttribute('data-i18n-alt').replace(/^alt\./, '');
  if (ALT.it[key] !== norm(el.getAttribute('alt') || '')) {
    dis++; console.log(`\n[alt ${key}] markup ≠ ALT.it`);
  }
}
console.log(`1 · disallineamenti markup↔i18n: ${dis}`);

/* 2 — chiavi per lingua */
const base = Object.keys(I18N.it);
let mancanti = 0;
for (const l of Object.keys(I18N)) {
  const miss = base.filter((k) => !(k in I18N[l]));
  const extra = Object.keys(I18N[l]).filter((k) => !base.includes(k));
  if (miss.length || extra.length) { mancanti++; console.log(`  ${l}: mancano ${miss} · in più ${extra}`); }
}
console.log(`2 · lingue con chiavi fuori posto: ${mancanti} (base ${base.length} chiavi)`);

/* 3 — lunghezze di title e description */
console.log('3 · title / description');
const metaHead = doc.querySelector('meta[name="description"]').getAttribute('content');
console.log(`  <head> description  ${metaHead.length} car.`);
console.log(`  <title>             ${doc.querySelector('title').text.length} car.`);
for (const l of Object.keys(I18N)) {
  console.log(`  ${l}  title ${String(I18N[l]['meta.title'].length).padStart(3)}  desc ${String(I18N[l]['meta.desc'].length).padStart(3)}`);
}

/* 4 — ripetizioni: sequenze di 5+ parole che compaiono più di una volta */
function prosa(lang) {
  const d = I18N[lang], out = [];
  for (const [k, v] of Object.entries(d)) {
    if (typeof v === 'string') { if (v.length > 40) out.push([k, v]); continue; }
    if (Array.isArray(v)) {
      v.forEach((it, i) => {
        if (it && typeof it === 'object') {
          for (const f of ['text', 'body', 'title']) if (it[f] && it[f].length > 40) out.push([`${k}[${i}].${f}`, it[f]]);
        }
      });
    } else if (v && typeof v === 'object') {
      for (const [kk, arr] of Object.entries(v)) {
        (Array.isArray(arr) ? arr : [arr]).forEach((s, i) => { if (typeof s === 'string' && s.length > 40) out.push([`${k}.${kk}[${i}]`, s]); });
      }
    }
  }
  return out;
}
const N = 5;
for (const l of Object.keys(I18N)) {
  const seen = new Map();
  for (const [k, txt] of prosa(l)) {
    const w = txt.replace(/<[^>]+>/g, ' ').toLowerCase().replace(/[.,:;—–()«»"]/g, ' ').split(/\s+/).filter(Boolean);
    for (let i = 0; i + N <= w.length; i++) {
      const g = w.slice(i, i + N).join(' ');
      if (!seen.has(g)) seen.set(g, new Set());
      seen.get(g).add(k);
    }
  }
  const dup = [...seen].filter(([, ks]) => ks.size > 1);
  console.log(`4 · ${l}: ${dup.length} sequenze di ${N}+ parole in due punti diversi`);
  for (const [g, ks] of dup) console.log(`     «${g}» → ${[...ks].join(' + ')}`);
}

/* 5 — i fatti della scheda devono esserci ancora (testo italiano) */
const tuttoIT = JSON.stringify(I18N.it) + JSON.stringify(ALT.it) + metaHead + doc.querySelector('title').text;
const fatti = [
  ['160 m²', /centosessanta metri quadri|160/],
  ['due piani', /due piani/],
  ['tre camere', /tre camere|3 camere/],
  ['aria condizionata', /aria condizionata/],
  ['sette posti letto', /[Ss]ette posti letto|7 ospiti/],
  ['piscina 10×5', /10 × 5|ieci metri per cinque/],
  ['profondità 0,80–1,65', /ottanta centimetri|80 centimetri/],
  ['stagione piscina', /15 aprile al 15 ottobre/],
  ['piscina recintata', /ecintata/],
  ['camino non utilizzabile', /non si accende/],
  ['divano letto singolo', /divano letto singolo/],
  ['cantinetta', /cantinetta/],
  ['giardino recintato', /iardino recintato|tutto recintato|completamente recintato/],
  ['barbecue', /arbecue/],
  ['illuminazione esterna', /lluminazione esterna/],
  ['parcheggio interno', /archeggio dentro la proprietà|archeggio interno|archeggio all’interno/i],
  ['Pisa 85 km', /85/],
  ['Poggibonsi 8 km', /8 chilometri|"8"/],
  ['supermercato 4-5 min', /quattro o cinque minuti/],
  ['strada bianca', /strada bianca|strada sterrata/],
  ['baldacchino', /baldacchino/],
  ['teli piscina compresi', /teli.{0,40}compres|Teli piscina/i],
  ['culla', /culla|Lettino per bebè/],
];
const persi = fatti.filter(([, re]) => !re.test(tuttoIT));
console.log(`5 · fatti della scheda ancora in pagina: ${fatti.length - persi.length}/${fatti.length}`);
persi.forEach(([n]) => console.log(`     ✗ ${n}`));

/* Le ripetizioni sono da leggere, non da superare: non fanno fallire nulla.
   Fanno fallire invece un testo rimasto indietro nel markup, una chiave che
   manca in una lingua e un dato della scheda sparito dalla pagina. */
console.log('');
if (dis || mancanti || persi.length) {
  console.log('✗ da sistemare: ' + [
    dis && `${dis} testi disallineati fra markup e i18n`,
    mancanti && `${mancanti} lingue con chiavi fuori posto`,
    persi.length && `${persi.length} fatti della scheda spariti`,
  ].filter(Boolean).join(' · '));
  process.exit(1);
}
console.log('✓ markup e traduzioni allineati, nessun dato perso\n');
