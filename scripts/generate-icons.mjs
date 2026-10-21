import zlib from 'node:zlib';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

const crcTable = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    c = (c >>> 8) ^ crcTable[(c ^ buf[i]) & 0xFF];
  }
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function makePng(width, height, getPixelRgba) {
  const rowLen = width * 4 + 1;
  const raw = Buffer.alloc(height * rowLen);

  for (let y = 0; y < height; y++) {
    raw[y * rowLen] = 0; // Filter 0
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = getPixelRgba(x, y, width, height);
      const offset = y * rowLen + 1 + x * 4;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
      raw[offset + 3] = a;
    }
  }

  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(4 + 4 + len + 4);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 4, 'ascii');
    data.copy(buf, 8);
    const crc = crc32(buf.subarray(4, 8 + len));
    buf.writeUInt32BE(crc, 8 + len);
    return buf;
  }

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function renderAssoComptaIcon(x, y, w, h) {
  const nx = x / w;
  const ny = y / h;

  // Background: Deep dark slate / navy
  let r = 2;
  let g = 6;
  let b = 23;
  let a = 255;

  // Center badge rounded box (0.15 to 0.85 in both x & y)
  const bMinX = 0.14, bMaxX = 0.86;
  const bMinY = 0.14, bMaxY = 0.86;
  const radius = 0.16;

  // SDF rounded rectangle
  const cx = 0.5;
  const cy = 0.5;
  const halfW = (bMaxX - bMinX) / 2;
  const halfH = (bMaxY - bMinY) / 2;

  const dx = Math.abs(nx - cx) - (halfW - radius);
  const dy = Math.abs(ny - cy) - (halfH - radius);
  const distOutside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  const distInside = Math.min(Math.max(dx, dy), 0);
  const dist = distOutside + distInside - radius;

  if (dist <= 0) {
    // Inside badge: gradient from vibrant blue (top left) to emerald/cyan (bottom right)
    const t = (nx + ny) / 2;
    // Blue: 37, 99, 235 (#2563eb) -> Emerald/Teal: 16, 185, 129 (#10b981)
    let br = Math.round(37 * (1 - t) + 16 * t);
    let bg = Math.round(99 * (1 - t) + 185 * t);
    let bb = Math.round(235 * (1 - t) + 129 * t);

    // Subtle inner border
    if (dist > -0.015) {
      br = Math.min(255, br + 60);
      bg = Math.min(255, bg + 60);
      bb = Math.min(255, bb + 60);
    }

    // Receipt icon shape in center (white / light slate)
    // Rect: 0.32 to 0.68 horizontally, 0.28 to 0.72 vertically
    const recMinX = 0.34, recMaxX = 0.66;
    const recMinY = 0.28, recMaxY = 0.72;
    const recRadius = 0.04;

    const rdx = Math.abs(nx - cx) - ((recMaxX - recMinX) / 2 - recRadius);
    const rdy = Math.abs(ny - cy) - ((recMaxY - recMinY) / 2 - recRadius);
    const rdistOut = Math.hypot(Math.max(rdx, 0), Math.max(rdy, 0));
    const rdistIn = Math.min(Math.max(rdx, rdy), 0);
    const rdist = rdistOut + rdistIn - recRadius;

    if (rdist <= 0) {
      // White receipt paper
      br = 248;
      bg = 250;
      bb = 252;

      // Draw lines on the receipt
      // Line 1: ny ~ 0.38
      // Line 2: ny ~ 0.48
      // Line 3: ny ~ 0.58
      // Highlight/Total line: ny ~ 0.64
      if (nx >= 0.40 && nx <= 0.60 && Math.abs(ny - 0.38) <= 0.015) {
        br = 59; bg = 130; bb = 246; // blue bar
      } else if (nx >= 0.40 && nx <= 0.56 && Math.abs(ny - 0.47) <= 0.012) {
        br = 148; bg = 163; bb = 184; // slate-400
      } else if (nx >= 0.40 && nx <= 0.52 && Math.abs(ny - 0.55) <= 0.012) {
        br = 148; bg = 163; bb = 184;
      } else if (nx >= 0.40 && nx <= 0.60 && Math.abs(ny - 0.63) <= 0.018) {
        br = 16; bg = 185; bb = 129; // emerald total bar
      }
    }

    r = br;
    g = bg;
    b = bb;
  }

  return [r, g, b, a];
}

const icon192 = makePng(192, 192, renderAssoComptaIcon);
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), icon192);
console.log('Generated icon-192.png, size:', icon192.length);

const icon512 = makePng(512, 512, renderAssoComptaIcon);
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), icon512);
console.log('Generated icon-512.png, size:', icon512.length);
