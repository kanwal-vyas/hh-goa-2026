// Downscale a PNG (RGBA, 8-bit, non-interlaced) with alpha-aware box
// filtering and re-encode. Used to shrink the crab asset from 1200px to
// a web-friendly size.
import { readFileSync, writeFileSync } from 'node:fs';
import { inflateSync, deflateSync } from 'node:zlib';

const [, , inPath, outPath, targetSize] = process.argv;
const SIZE = Number(targetSize || 200);

const buf = readFileSync(inPath);

// ---- parse PNG chunks ----
let pos = 8;
let idat = [];
let w = 0;
let h = 0;
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.toString('ascii', pos + 4, pos + 8);
  if (type === 'IHDR') {
    w = buf.readUInt32BE(pos + 8);
    h = buf.readUInt32BE(pos + 12);
    const bitDepth = buf[pos + 16];
    const colorType = buf[pos + 17];
    const interlace = buf[pos + 20];
    if (bitDepth !== 8 || colorType !== 6 || interlace !== 0) {
      throw new Error(`unsupported PNG: bitDepth=${bitDepth} colorType=${colorType} interlace=${interlace}`);
    }
  } else if (type === 'IDAT') {
    idat.push(buf.slice(pos + 8, pos + 8 + len));
  }
  pos += 12 + len;
}

// ---- unfilter scanlines ----
const raw = inflateSync(Buffer.concat(idat));
const stride = w * 4;
const out = Buffer.alloc(stride * h);
for (let y = 0; y < h; y++) {
  const rowStart = y * (stride + 1);
  const f = raw[rowStart];
  for (let x = 0; x < stride; x++) {
    const v = raw[rowStart + 1 + x];
    const a = x >= 4 ? out[y * stride + x - 4] : 0;
    const b = y > 0 ? out[(y - 1) * stride + x] : 0;
    const c = x >= 4 && y > 0 ? out[(y - 1) * stride + x - 4] : 0;
    let val = v;
    if (f === 1) val += a;
    else if (f === 2) val += b;
    else if (f === 3) val += (a + b) >> 1;
    else if (f === 4) {
      const p = a + b - c;
      const pa = Math.abs(p - a);
      const pb = Math.abs(p - b);
      const pc = Math.abs(p - c);
      val += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
    }
    out[y * stride + x] = val & 0xff;
  }
}

// ---- alpha-aware box downscale ----
const sx = SIZE / w;
const sy = SIZE / h;
const dst = Buffer.alloc(SIZE * SIZE * 4);
for (let dy = 0; dy < SIZE; dy++) {
  const y0 = Math.floor(dy / sy);
  const y1 = Math.min(h, Math.ceil((dy + 1) / sy));
  for (let dx = 0; dx < SIZE; dx++) {
    const x0 = Math.floor(dx / sx);
    const x1 = Math.min(w, Math.ceil((dx + 1) / sx));
    let r = 0;
    let g = 0;
    let b = 0;
    let a = 0;
    let count = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const i = (y * w + x) * 4;
        const alpha = out[i + 3];
        r += out[i] * alpha;
        g += out[i + 1] * alpha;
        b += out[i + 2] * alpha;
        a += alpha;
        count++;
      }
    }
    const di = (dy * SIZE + dx) * 4;
    if (a === 0) {
      dst[di] = dst[di + 1] = dst[di + 2] = dst[di + 3] = 0;
    } else {
      // un-premultiply
      dst[di] = Math.round(r / a);
      dst[di + 1] = Math.round(g / a);
      dst[di + 2] = Math.round(b / a);
      dst[di + 3] = Math.round(a / count);
    }
  }
}

// ---- encode PNG ----
function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return ~c >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(SIZE, 0);
ihdr.writeUInt32BE(SIZE, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // RGBA
const scanlines = Buffer.alloc(SIZE * (SIZE * 4 + 1));
for (let y = 0; y < SIZE; y++) {
  scanlines[y * (SIZE * 4 + 1)] = 0; // filter None
  dst.copy(scanlines, y * (SIZE * 4 + 1) + 1, y * SIZE * 4, (y + 1) * SIZE * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(scanlines, { level: 9 })),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(outPath, png);
console.log(`${w}x${h} -> ${SIZE}x${SIZE}, ${(png.length / 1024).toFixed(1)}KB`);
