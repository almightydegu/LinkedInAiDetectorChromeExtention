#!/usr/bin/env node
/**
 * setup.js — Generates the PNG icons required by the Chrome extension.
 * Run once before loading the extension: node setup.js
 * No npm install needed — uses only built-in Node.js modules.
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const zlib = require('zlib');

// ── Minimal PNG encoder ──────────────────────────────────────────────────────

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const tb  = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);  len.writeUInt32BE(data.length);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([tb, data])));
  return Buffer.concat([len, tb, data, crcBuf]);
}

/**
 * Encode a PNG from a pixel callback.
 * @param {number} w
 * @param {number} h
 * @param {(x:number,y:number)=>[number,number,number,number]} getPixel  RGBA 0-255
 */
function encodePNG(w, h, getPixel) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(w, 0);
  ihdrData.writeUInt32BE(h, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA

  const rows = [];
  for (let y = 0; y < h; y++) {
    const row = Buffer.alloc(1 + w * 4);
    row[0] = 0; // filter: None
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = getPixel(x, y);
      row[1 + x * 4]     = r;
      row[1 + x * 4 + 1] = g;
      row[1 + x * 4 + 2] = b;
      row[1 + x * 4 + 3] = a;
    }
    rows.push(row);
  }

  const raw  = Buffer.concat(rows);
  const comp = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([sig, chunk('IHDR', ihdrData), chunk('IDAT', comp), chunk('IEND', Buffer.alloc(0))]);
}

// ── Robot icon pixel art ─────────────────────────────────────────────────────

/**
 * Renders a simple robot face icon at the given size.
 * The design scales proportionally.
 */
function robotPixel(px, py, size) {
  const s = size;

  // Colours
  const BG          = [0,   0,   0,   0  ]; // transparent
  const BODY        = [29,  78,  216, 255 ]; // blue-700
  const EYE         = [255, 255, 255, 255 ]; // white
  const PUPIL       = [30,  58,  138, 255 ]; // blue-900
  const ANTENNA_COL = [96,  165, 250, 255 ]; // blue-400

  const cx = s / 2;

  // Proportional layout
  const headL = Math.round(s * 0.22);
  const headR = Math.round(s * 0.78);
  const headT = Math.round(s * 0.12);
  const headB = Math.round(s * 0.52);

  const bodyL = Math.round(s * 0.18);
  const bodyR = Math.round(s * 0.82);
  const bodyT = headB;
  const bodyB = Math.round(s * 0.88);

  const armW  = Math.round(s * 0.07);
  const armL  = Math.round(s * 0.09);
  const armR  = Math.round(s * 0.91);
  const armT  = Math.round(s * 0.60);
  const armB  = Math.round(s * 0.82);

  // Antenna stem
  const antX  = Math.round(cx);
  const antT  = 0;
  const antB  = headT;

  // Antenna ball
  const ballR = Math.max(1, Math.round(s * 0.07));
  const ballY = antT + ballR;

  // Eyes
  const eyeY  = Math.round(headT + (headB - headT) * 0.42);
  const eyeR  = Math.max(1, Math.round(s * 0.10));
  const pupR  = Math.max(1, Math.round(s * 0.05));
  const eyeLX = Math.round(headL + (headR - headL) * 0.30);
  const eyeRX = Math.round(headL + (headR - headL) * 0.70);

  // Mouth bar
  const mouthT = Math.round(headT + (headB - headT) * 0.72);
  const mouthB = Math.round(mouthT + Math.max(1, Math.round(s * 0.06)));
  const mouthL = Math.round(headL + (headR - headL) * 0.25);
  const mouthR = Math.round(headL + (headR - headL) * 0.75);

  function dist(x1, y1, x2, y2) { return Math.sqrt((x1-x2)**2 + (y1-y2)**2); }

  // Antenna ball
  if (dist(px, py, antX, ballY) < ballR) return ANTENNA_COL;

  // Antenna stem
  if (Math.abs(px - antX) <= Math.max(0, Math.round(s * 0.03)) && py >= antT + ballR && py < antB) return ANTENNA_COL;

  // Arms
  if ((px >= armL && px < armL + armW || px > armR - armW && px <= armR) && py >= armT && py <= armB) return BODY;

  // Head
  if (px >= headL && px <= headR && py >= headT && py <= headB) {
    // Eyes
    if (dist(px, py, eyeLX, eyeY) < eyeR || dist(px, py, eyeRX, eyeY) < eyeR) {
      if (dist(px, py, eyeLX, eyeY) < pupR || dist(px, py, eyeRX, eyeY) < pupR) return PUPIL;
      return EYE;
    }
    // Mouth
    if (py >= mouthT && py <= mouthB && px >= mouthL && px <= mouthR) return EYE;
    return BODY;
  }

  // Body
  if (px >= bodyL && px <= bodyR && py >= bodyT && py <= bodyB) return BODY;

  return BG;
}

// ── Generate files ────────────────────────────────────────────────────────────

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir);

const SIZES = [16, 48, 128];

for (const size of SIZES) {
  const png  = encodePNG(size, size, (x, y) => robotPixel(x, y, size));
  const file = path.join(iconsDir, `icon${size}.png`);
  fs.writeFileSync(file, png);
  console.log(`Created ${file}`);
}

console.log('\nAll icons generated. You can now load the extension in Chrome.');
