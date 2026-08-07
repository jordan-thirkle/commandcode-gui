// Generates a simple 1200x630 OG cover placeholder PNG (solid dark with accent bar).
// No external deps — writes a minimal valid PNG via zlib.
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, '..', 'site', 'assets', 'img', 'og-cover.png');

const W = 1200;
const H = 630;
const bg = [13, 17, 23]; // #0d1117
const bar = [47, 129, 247]; // accent

// RGBA rows top-to-bottom
const raw = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (x < 12) {
      raw[i] = bar[0]; raw[i + 1] = bar[1]; raw[i + 2] = bar[2]; raw[i + 3] = 255;
    } else {
      raw[i] = bg[0]; raw[i + 1] = bg[1]; raw[i + 2] = bg[2]; raw[i + 3] = 255;
    }
  }
}

// PNG chunks
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  // crc32 over type + data
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // color type RGBA
// rest 0

// Filter byte per row (0 = None)
const stride = W * 4;
const filtered = Buffer.alloc(H * (stride + 1));
for (let y = 0; y < H; y++) {
  filtered[y * (stride + 1)] = 0;
  raw.copy(filtered, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
}

const png = Buffer.concat([
  sig,
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(filtered)),
  chunk('IEND', Buffer.alloc(0)),
]);

writeFileSync(out, png);
console.log('wrote', out, png.length, 'bytes');
