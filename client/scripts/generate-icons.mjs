/**
 * Generates all Smart Finance image assets — no image libraries needed.
 * - PWA icons (192/512/maskable/apple) into public/
 * - Capacitor sources (1024 icon, 2732 splash) into assets/
 *
 * The mark is the LogoMark: cobalt rounded square, white rising spend line,
 * coin dot. Anti-aliased via 3×3 supersampling; encoded as RGBA PNG.
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(here, '../public');
const assetsDir = path.resolve(here, '../assets');

const BG = [29, 95, 214]; // #1d5fd6 cobalt
const INK = [255, 255, 255];
const GROUND = [243, 245, 247]; // #f3f5f7

function crc32(buf) {
  let c;
  const table = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const raw = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    raw[y * (1 + width * 4)] = 0;
    rgba.copy(raw, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

function distToSegment(px, py, x1, y1, x2, y2) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  let t = lenSq === 0 ? 0 : ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

function coverage3(px, py, test) {
  let hit = 0;
  for (let sx = 0; sx < 3; sx++) {
    for (let sy = 0; sy < 3; sy++) {
      if (test(px + (sx + 0.5) / 3, py + (sy + 0.5) / 3)) hit++;
    }
  }
  return hit / 9;
}

function insideRoundedRect(x, y, size, radius) {
  const cx = Math.max(radius, Math.min(size - radius, x));
  const cy = Math.max(radius, Math.min(size - radius, y));
  return Math.hypot(x - cx, y - cy) <= radius;
}

/** The mark's ink coverage at (px,py), given a content transform. */
function makeMark(size, scale, offsetX, offsetY) {
  const pt = ([x, y]) => [(offsetX + x * scale) * size, (offsetY + y * scale) * size];
  const pts = [
    [0.25, 0.672],
    [0.39, 0.531],
    [0.5, 0.625],
    [0.734, 0.375],
  ].map(pt);
  const dot = pt([0.734, 0.375]);
  const dotR = 0.069 * scale * size;
  const stroke = 0.06875 * scale * size;

  return (px, py) => {
    let ink = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[i + 1];
      ink = Math.max(ink, coverage3(px, py, (x, y) => distToSegment(x, y, x1, y1, x2, y2) <= stroke / 2));
    }
    for (const [jx, jy] of pts.slice(1, -1)) {
      ink = Math.max(ink, coverage3(px, py, (x, y) => Math.hypot(x - jx, y - jy) <= stroke / 2));
    }
    ink = Math.max(ink, coverage3(px, py, (x, y) => Math.hypot(x - dot[0], y - dot[1]) <= dotR));
    return ink;
  };
}

/** mode: 'rounded' (transparent corners) | 'square' (full-bleed) | 'splash' (light ground) */
function render(size, mode, markScale = 0.9) {
  const mark = makeMark(size, markScale, (1 - markScale) / 2, (1 - markScale) / 2);
  const corner = size * 0.18;
  const rgba = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      const ink = mark(x + 0.5, y + 0.5);

      let bgR = 0;
      let bgG = 0;
      let bgB = 0;
      let bgA = 0;
      if (mode === 'splash') {
        bgR = GROUND[0]; bgG = GROUND[1]; bgB = GROUND[2]; bgA = 1;
      } else if (mode === 'square') {
        bgR = BG[0]; bgG = BG[1]; bgB = BG[2]; bgA = 1;
      } else {
        const cov = coverage3(x + 0.5, y + 0.5, (px, py) => insideRoundedRect(px, py, size, corner));
        bgR = BG[0]; bgG = BG[1]; bgB = BG[2]; bgA = cov;
      }

      const alpha = ink + bgA * (1 - ink);
      rgba[i] = Math.round((INK[0] * ink + bgR * bgA * (1 - ink)) / (alpha || 1));
      rgba[i + 1] = Math.round((INK[1] * ink + bgG * bgA * (1 - ink)) / (alpha || 1));
      rgba[i + 2] = Math.round((INK[2] * ink + bgB * bgA * (1 - ink)) / (alpha || 1));
      rgba[i + 3] = Math.round(255 * alpha);
    }
  }
  return encodePng(size, size, rgba);
}

mkdirSync(publicDir, { recursive: true });
mkdirSync(assetsDir, { recursive: true });

// PWA icons
writeFileSync(path.join(publicDir, 'pwa-192x192.png'), render(192, 'rounded'));
console.log('wrote public/pwa-192x192.png');
writeFileSync(path.join(publicDir, 'pwa-512x512.png'), render(512, 'rounded'));
console.log('wrote public/pwa-512x512.png');
writeFileSync(path.join(publicDir, 'pwa-maskable-512x512.png'), render(512, 'square', 0.72));
console.log('wrote public/pwa-maskable-512x512.png');
writeFileSync(path.join(publicDir, 'apple-touch-icon.png'), render(180, 'square', 0.78));
console.log('wrote public/apple-touch-icon.png');

// Capacitor sources
writeFileSync(path.join(assetsDir, 'icon-1024.png'), render(1024, 'square', 0.82));
console.log('wrote assets/icon-1024.png');
writeFileSync(path.join(assetsDir, 'splash-2732.png'), render(2732, 'splash', 0.2));
console.log('wrote assets/splash-2732.png');
