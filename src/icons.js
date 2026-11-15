import zlib from 'node:zlib';

// Générateur d’icônes PNG/ICO sans dépendance : les couleurs suivent le thème de chaque application.

function crc32(buf) {
  let c;
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) {
    c = (crc ^ buf[i]) & 0xff;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePng(size, pixelFn) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x += 1) {
      const [r, g, b, a] = pixelFn(x, y);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ]);
}

function hexToRgb(hex, fallback) {
  const match = /^#?([0-9a-f]{6})$/i.exec(String(hex || ''));
  if (!match) return fallback;
  const value = parseInt(match[1], 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function makePng(size, accent, second) {
  const ss = 4;
  const radius = size * 0.24;
  const spark = (u, v) => {
    const dx = Math.abs(u - 0.5);
    const dy = Math.abs(v - 0.5);
    const d = Math.sqrt(dx * dx + dy * dy);
    const arm = Math.max(0, 1 - d / 0.34) * Math.max(0, 1 - Math.min(dx, dy) * 9);
    const core = Math.max(0, 1 - d / 0.14);
    return Math.min(1, arm + core);
  };
  return encodePng(size, (x, y) => {
    let cover = 0;
    let inkR = 0;
    let inkG = 0;
    let inkB = 0;
    for (let sy = 0; sy < ss; sy += 1) {
      for (let sx = 0; sx < ss; sx += 1) {
        const px = x + (sx + 0.5) / ss;
        const py = y + (sy + 0.5) / ss;
        let inside;
        if (px >= radius && px <= size - radius) inside = true;
        else if (py >= radius && py <= size - radius) inside = true;
        else {
          const cx = px < radius ? radius : size - radius;
          const cy = py < radius ? radius : size - radius;
          inside = (px - cx) ** 2 + (py - cy) ** 2 <= radius * radius;
        }
        if (!inside) continue;
        cover += 1;
        const t = ((px / size) * 0.55 + (py / size) * 0.45);
        const base = [mix(accent[0], second[0], t), mix(accent[1], second[1], t), mix(accent[2], second[2], t)];
        const s = spark(px / size, py / size);
        inkR += base[0] * (1 - s) + 255 * s;
        inkG += base[1] * (1 - s) + 255 * s;
        inkB += base[2] * (1 - s) + 255 * s;
      }
    }
    if (!cover) return [0, 0, 0, 0];
    const alpha = Math.round((cover / (ss * ss)) * 255);
    return [Math.round(inkR / cover), Math.round(inkG / cover), Math.round(inkB / cover), alpha];
  });
}

function makeIco(accent, second) {
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = sizes.map((size) => makePng(size, accent, second));
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);
  let offset = 6 + 16 * images.length;
  const entries = images.map((img, index) => {
    const size = sizes[index];
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(img.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += img.length;
    return entry;
  });
  return Buffer.concat([header, ...entries, ...images]);
}

/**
 * Retourne les icônes Tauri attendues dans `src-tauri/icons/`.
 * @param {{ accent?: string, secondary?: string }} theme
 * @returns {Record<string, Buffer>}
 */
export function createIconSet(theme = {}) {
  const accent = hexToRgb(theme.accent, [120, 106, 255]);
  const second = hexToRgb(theme.secondary, [66, 201, 218]);
  return {
    'icon.png': makePng(512, accent, second),
    '32x32.png': makePng(32, accent, second),
    '128x128.png': makePng(128, accent, second),
    '128x128@2x.png': makePng(256, accent, second),
    'icon.ico': makeIco(accent, second)
  };
}
