import zlib from 'node:zlib';

let crcTable = null;

function fallbackCrc32(buffer) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let value = n;
      for (let k = 0; k < 8; k += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[n] = value >>> 0;
    }
  }
  let crc = 0xffffffff;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function crc32(buffer) {
  return typeof zlib.crc32 === 'function' ? zlib.crc32(buffer) >>> 0 : fallbackCrc32(buffer);
}

function dosTimestamp(date) {
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const year = Math.max(1980, safeDate.getFullYear());
  const time = ((safeDate.getHours() & 31) << 11) |
    ((safeDate.getMinutes() & 63) << 5) |
    (Math.floor(safeDate.getSeconds() / 2) & 31);
  const day = (((year - 1980) & 127) << 9) |
    (((safeDate.getMonth() + 1) & 15) << 5) |
    (safeDate.getDate() & 31);
  return { time, date: day };
}

/**
 * Construit une archive ZIP (méthode "store", sans compression) sans dépendance.
 * Les fichiers sont petits ; le store-only maximise la simplicité et la rapidité.
 */
export function createZip(files, { date = new Date() } = {}) {
  const { time, date: dosDate } = dosTimestamp(date);
  const entries = Object.entries(files)
    .map(([name, content]) => {
      const normalized = name.replaceAll('\\', '/').replace(/^\/+/, '');
      if (!normalized || normalized.split('/').some((part) => part === '..' || part === '')) {
        throw new Error(`Nom de fichier ZIP invalide : ${name}`);
      }
      const nameBytes = Buffer.from(normalized, 'utf8');
      const data = Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8');
      return { nameBytes, data, crc: crc32(data) };
    })
    .sort((a, b) => a.nameBytes.compare(b.nameBytes));

  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // noms de fichiers UTF-8
    local.writeUInt16LE(0, 8); // store
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(dosDate, 12);
    local.writeUInt32LE(entry.crc, 14);
    local.writeUInt32LE(entry.data.length, 18);
    local.writeUInt32LE(entry.data.length, 22);
    local.writeUInt16LE(entry.nameBytes.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, entry.nameBytes, entry.data);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(dosDate, 14);
    central.writeUInt32LE(entry.crc, 16);
    central.writeUInt32LE(entry.data.length, 20);
    central.writeUInt32LE(entry.data.length, 24);
    central.writeUInt16LE(entry.nameBytes.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, entry.nameBytes);

    offset += local.length + entry.nameBytes.length + entry.data.length;
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralSize, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, ...centralParts, end]);
}
