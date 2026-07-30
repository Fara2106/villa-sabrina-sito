/**
 * find-smooth-clip.mjs — trova i tratti di volo fluidi dentro i video del drone.
 *
 *   node scripts/find-smooth-clip.mjs "Video fatti con il drone/file.mp4" [durata]
 *   node scripts/find-smooth-clip.mjs --all [durata]
 *
 * I filmati sono girati a mano e hanno strappi. Invece di sceglierli a occhio,
 * qui si misura: si estraggono fotogrammi a bassa risoluzione, si stima lo
 * spostamento fra l'uno e l'altro con la correlazione di fase, e si cerca la
 * finestra in cui l'ACCELERAZIONE è più bassa — cioè dove il drone si muove in
 * modo costante invece che a scatti.
 *
 * Non basta cercare "poco movimento": un drone fermo è fluido ma noioso. Serve
 * movimento presente e regolare, quindi si scarta anche chi sta troppo fermo.
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';

const run = promisify(execFile);

const FPS = 10;          // fotogrammi al secondo analizzati
const W = 256, H = 144;  // risoluzione di analisi
const args = process.argv.slice(2);
const WINDOW = Number(args.find((a) => /^\d+$/.test(a))) || 8;   // secondi da isolare

/* ------------------------------------------------- correlazione di fase */

function fft2(re, im, w, h, inverse) {
  const fft1 = (re1, im1, n, inv) => {
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) {
        [re1[i], re1[j]] = [re1[j], re1[i]];
        [im1[i], im1[j]] = [im1[j], im1[i]];
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = (inv ? 2 : -2) * Math.PI / len;
      const wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const ur = re1[i + k], ui = im1[i + k];
          const vr = re1[i + k + len / 2] * cr - im1[i + k + len / 2] * ci;
          const vi = re1[i + k + len / 2] * ci + im1[i + k + len / 2] * cr;
          re1[i + k] = ur + vr; im1[i + k] = ui + vi;
          re1[i + k + len / 2] = ur - vr; im1[i + k + len / 2] = ui - vi;
          const ncr = cr * wr - ci * wi;
          ci = cr * wi + ci * wr; cr = ncr;
        }
      }
    }
    if (inv) for (let i = 0; i < n; i++) { re1[i] /= n; im1[i] /= n; }
  };
  const rowRe = new Float64Array(w), rowIm = new Float64Array(w);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) { rowRe[x] = re[y * w + x]; rowIm[x] = im[y * w + x]; }
    fft1(rowRe, rowIm, w, inverse);
    for (let x = 0; x < w; x++) { re[y * w + x] = rowRe[x]; im[y * w + x] = rowIm[x]; }
  }
  const colRe = new Float64Array(h), colIm = new Float64Array(h);
  for (let x = 0; x < w; x++) {
    for (let y = 0; y < h; y++) { colRe[y] = re[y * w + x]; colIm[y] = im[y * w + x]; }
    fft1(colRe, colIm, h, inverse);
    for (let y = 0; y < h; y++) { re[y * w + x] = colRe[y]; im[y * w + x] = colIm[y]; }
  }
}

/** Spostamento (dx,dy) fra due fotogrammi in scala di grigi. */
function shift(a, b, w, h) {
  const ar = Float64Array.from(a), ai = new Float64Array(w * h);
  const br = Float64Array.from(b), bi = new Float64Array(w * h);
  // finestra di Hann: senza, i bordi generano picchi falsi
  for (let y = 0; y < h; y++) {
    const wy = 0.5 - 0.5 * Math.cos((2 * Math.PI * y) / (h - 1));
    for (let x = 0; x < w; x++) {
      const wx = 0.5 - 0.5 * Math.cos((2 * Math.PI * x) / (w - 1));
      ar[y * w + x] *= wx * wy;
      br[y * w + x] *= wx * wy;
    }
  }
  fft2(ar, ai, w, h, false);
  fft2(br, bi, w, h, false);
  const cr = new Float64Array(w * h), ci = new Float64Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const r = ar[i] * br[i] + ai[i] * bi[i];
    const m = ai[i] * br[i] - ar[i] * bi[i];
    const mag = Math.hypot(r, m) || 1e-9;
    cr[i] = r / mag; ci[i] = m / mag;
  }
  fft2(cr, ci, w, h, true);
  let best = -Infinity, bx = 0, by = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const v = cr[y * w + x];
      if (v > best) { best = v; bx = x; by = y; }
    }
  }
  return [bx > w / 2 ? bx - w : bx, by > h / 2 ? by - h : by];
}

/* --------------------------------------------------------------- analisi */

async function analyse(file) {
  const dir = await mkdtemp(join(tmpdir(), 'vs-flow-'));
  try {
    await run('ffmpeg', ['-v', 'error', '-i', file,
      '-vf', `fps=${FPS},scale=${W}:${H}`, '-pix_fmt', 'gray',
      join(dir, 'f%04d.png'), '-y']);
    const files = (await readdir(dir)).filter((f) => f.endsWith('.png')).sort();
    if (files.length < FPS * (WINDOW + 1)) return null;

    const frames = [];
    for (const f of files) {
      const { data } = await sharp(join(dir, f)).greyscale().raw()
        .toBuffer({ resolveWithObject: true });
      frames.push(data);
    }

    const dx = [], dy = [];
    for (let i = 1; i < frames.length; i++) {
      const [x, y] = shift(frames[i - 1], frames[i], W, H);
      dx.push(x); dy.push(y);
    }
    // accelerazione = quanto cambia lo spostamento da un fotogramma all'altro
    const acc = [];
    for (let i = 1; i < dx.length; i++) {
      acc.push(Math.hypot(dx[i] - dx[i - 1], dy[i] - dy[i - 1]));
    }
    const speed = dx.map((v, i) => Math.hypot(v, dy[i]));

    const win = FPS * WINDOW;
    let best = null;
    for (let s = 0; s + win < acc.length; s++) {
      let sa = 0, sv = 0, spikes = 0;
      for (let i = s; i < s + win; i++) {
        sa += acc[i];
        sv += speed[i];
        if (acc[i] > 6) spikes++;      // strappo netto
      }
      const meanAcc = sa / win;
      const meanSpeed = sv / win;
      // vogliamo movimento presente ma regolare
      const score = meanAcc + spikes * 0.35 + (meanSpeed < 0.25 ? 2.5 : 0);
      if (!best || score < best.score) {
        best = { score, start: s / FPS, meanAcc, meanSpeed, spikes };
      }
    }
    return best;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/* ------------------------------------------------------------------ main */

const files = args.filter((a) => !a.startsWith('--') && !/^\d+$/.test(a));
if (files.length === 0) {
  console.error('\nuso: node scripts/find-smooth-clip.mjs <video…> [secondi]\n');
  process.exit(1);
}

console.log(`\nfinestra cercata: ${WINDOW}s · analisi a ${FPS} fps\n`);
const results = [];
for (const f of files) {
  process.stderr.write(`· ${f.split('/').pop()}\r`);
  try {
    const r = await analyse(f);
    if (r) results.push({ file: f, ...r });
  } catch (e) {
    console.error(`  ${f}: ${e.message.split('\n')[0]}`);
  }
}
process.stderr.write('                                                            \r');

results.sort((a, b) => a.score - b.score);
console.log('  ' + 'punteggio'.padEnd(11) + 'da'.padEnd(8) + 'scatti'.padEnd(8) + 'accel.'.padEnd(9) + 'velocità'.padEnd(10) + 'file');
console.log('  ' + '─'.repeat(78));
for (const r of results) {
  console.log(
    '  ' + r.score.toFixed(2).padEnd(11) +
    (r.start.toFixed(1) + 's').padEnd(8) +
    String(r.spikes).padEnd(8) +
    r.meanAcc.toFixed(2).padEnd(9) +
    r.meanSpeed.toFixed(2).padEnd(10) +
    r.file.split('/').pop().replace(/dji_fly_\d+_\d+_/, '#').slice(0, 22)
  );
}
console.log('\n  punteggio basso = movimento regolare. "scatti" = fotogrammi con strappo netto.\n');
