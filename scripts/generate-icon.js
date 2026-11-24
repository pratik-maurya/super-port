const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// Generate a 128x128 valid PNG file for extension icon
function createPng(width, height) {
  // RGBA buffer
  const rowSize = width * 4 + 1;
  const rawData = Buffer.alloc(rowSize * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0; // Filter type 0 (None)

    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 4;
      // Background dark cyberpunk #0d1117 with cyan / purple lightning
      const dx = x - width / 2;
      const dy = y - height / 2;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 56) {
        // Glowing circle background
        rawData[pixelOffset] = 22;     // R
        rawData[pixelOffset + 1] = 27;  // G
        rawData[pixelOffset + 2] = 34;  // B
        rawData[pixelOffset + 3] = 255; // A
      } else {
        rawData[pixelOffset] = 13;
        rawData[pixelOffset + 1] = 17;
        rawData[pixelOffset + 2] = 23;
        rawData[pixelOffset + 3] = 255;
      }

      // Lightning bolt shape
      const isInBolt = (
        (x > 50 && x < 76 && y > 24 && y < 64 && Math.abs(x - (64 - (y - 44) * 0.4)) < 12) ||
        (x > 44 && x < 84 && y >= 60 && y <= 68) ||
        (x > 54 && x < 80 && y > 64 && y < 104 && Math.abs(x - (64 - (y - 84) * 0.4)) < 12)
      );

      if (isInBolt) {
        rawData[pixelOffset] = 56;      // R: cyan #38bdf8
        rawData[pixelOffset + 1] = 189;  // G
        rawData[pixelOffset + 2] = 248;  // B
        rawData[pixelOffset + 3] = 255;  // A
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);

  // PNG Header
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits per channel
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // Deflate
  ihdrData[11] = 0; // Filter
  ihdrData[12] = 0; // Interlace
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // IDAT
  const idatChunk = createChunk('IDAT', compressed);

  // IEND
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(4 + 4 + len + 4);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);

  const crc = crc32(chunk.slice(4, 8 + len));
  chunk.writeInt32BE(crc, 8 + len);
  return chunk;
}

// Simple CRC32 table
const crcTable = [];
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) {
    if (c & 1) {
      c = 0xedb88320 ^ (c >>> 1);
    } else {
      c = c >>> 1;
    }
  }
  crcTable[n] = c;
}

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return crc ^ -1;
}

const resourcesDir = path.resolve(__dirname, '..', 'resources');
if (!fs.existsSync(resourcesDir)) {
  fs.mkdirSync(resourcesDir, { recursive: true });
}

const png = createPng(128, 128);
fs.writeFileSync(path.join(resourcesDir, 'icon.png'), png);
console.log('Generated resources/icon.png (128x128 valid PNG)');
