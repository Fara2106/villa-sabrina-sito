#!/usr/bin/env node
/**
 * approve-reviews.mjs — approva o revoca recensioni in data/reviews.json.
 *
 *   node scripts/approve-reviews.mjs --list             elenca tutto con id e stato
 *   node scripts/approve-reviews.mjs --list --pending   solo quelle da valutare
 *   node scripts/approve-reviews.mjs <id> <id> …        approva
 *   node scripts/approve-reviews.mjs --revoke <id> …    torna a non approvata
 *
 * Dopo aver approvato, rilancia `npm run build` per aggiornare index.html.
 * Serve solo a evitare di modificare il JSON a mano: il file resta la fonte
 * di verità e si può benissimo editare in un editor di testo.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const FILE = resolve(ROOT, 'data/reviews.json');

const args = process.argv.slice(2);
const LIST = args.includes('--list');
const PENDING = args.includes('--pending');
const REVOKE = args.includes('--revoke');
const ids = args.filter((a) => !a.startsWith('--'));

let data;
try {
  data = JSON.parse(await readFile(FILE, 'utf8'));
} catch {
  console.error('\n✗ data/reviews.json non leggibile. Lancia prima: npm run reviews\n');
  process.exit(1);
}

if (LIST || ids.length === 0) {
  const rows = data.reviews.filter((r) => (PENDING ? r.approved !== true : true));
  console.log('');
  for (const r of rows) {
    const mark = r.approved === true ? '[32m✓[0m' : '·';
    const head = `${mark} ${r.id}  ${r.rating}/5  ${(r.lang ?? '??').padEnd(2)}  ${(r.date ?? '').padEnd(10)}  ${r.author}${r.from ? ` · ${r.from}` : ''}`;
    console.log(head);
    console.log(`     ${r.text.slice(0, 108)}${r.text.length > 108 ? '…' : ''}`);
  }
  const ok = data.reviews.filter((r) => r.approved === true).length;
  console.log(`\n  ${rows.length} mostrate · ${ok} approvate su ${data.reviews.length} totali`);
  console.log(`  Approva con:  node scripts/approve-reviews.mjs <id> [<id> …]\n`);
  process.exit(0);
}

const byId = new Map(data.reviews.map((r) => [r.id, r]));
const missing = ids.filter((i) => !byId.has(i));
if (missing.length) {
  console.error(`\n✗ id non trovati: ${missing.join(', ')}\n`);
  process.exit(1);
}

let changed = 0;
for (const id of ids) {
  const r = byId.get(id);
  const next = !REVOKE;
  if (r.approved !== next) {
    r.approved = next;
    changed++;
  }
}

await writeFile(FILE, `${JSON.stringify(data, null, 2)}\n`, 'utf8');

const total = data.reviews.filter((r) => r.approved === true).length;
console.log(`\n✓ ${changed} ${REVOKE ? 'revocate' : 'approvate'} · ora in pagina: ${total}`);
console.log(`  Aggiorna il sito con: npm run build\n`);
