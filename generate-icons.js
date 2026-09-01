const fs = require('fs');
const zlib = require('zlib');

function crc32(buf) {
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0);
    }
  }
  return (crc ^ -1) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeData = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeData));
  return Buffer.concat([len, typeData, crc]);
}

function createPNG(width, height, pixelFunc) {
  const rawData = [];
  for (let y = 0; y < height; y++) {
    rawData.push(0); // filter byte
    for (let x = 0; x < width; x++) {
      const [r, g, b, a] = pixelFunc(x, y, width, height);
      rawData.push(r, g, b, a);
    }
  }
  const compressed = zlib.deflateSync(Buffer.from(rawData));

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', Buffer.alloc(0))
  ]);
}

function roundedRect(x, y, w, h, r, px, py, pw, ph) {
  const cx = x + w / 2, cy = y + h / 2;
  const dx = px - cx, dy = py - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const maxDist = Math.sqrt((w/2)*(w/2) + (h/2)*(h/2));
  if (dist > maxDist) return false;
  const nx = Math.max(Math.abs(dx) - (w/2 - r), 0) * Math.sign(dx);
  const ny = Math.max(Math.abs(dy) - (h/2 - r), 0) * Math.sign(dy);
  return Math.sqrt(nx * nx + ny * ny) <= r;
}

function generateIcon(size) {
  const s = size;
  return createPNG(s, s, (x, y) => {
    const r = s * 0.18;
    const inRect = roundedRect(0, 0, s, s, r, x + 0.5, y + 0.5, s, s);
    if (!inRect) return [0, 0, 0, 0];

    // Blue background
    const bgR = 66, bgG = 133, bgB = 244;

    // Check if in tab bar area
    const barY1 = s * 0.2;
    const barY2 = s * 0.8;
    const barH = s * 0.12;
    const barGap = s * 0.08;

    for (let i = 0; i < 3; i++) {
      const by = barY1 + i * (barH + barGap);
      const bx1 = s * (0.22 + i * 0.04);
      const bx2 = s * (0.78 - i * 0.04);

      if (y >= by && y <= by + barH && x >= bx1 && x <= bx2) {
        // White bar
        return [255, 255, 255, 255];
      }

      // Small circle at start of bar
      const circleR = s * 0.035;
      const circleX = bx1;
      const circleY = by + barH / 2;
      const dx = x - circleX, dy = y - circleY;
      if (Math.sqrt(dx*dx + dy*dy) <= circleR) {
        return [255, 255, 255, 255];
      }
    }

    return [bgR, bgG, bgB, 255];
  });
}

[16, 32, 48, 128].forEach(size => {
  const png = generateIcon(size);
  fs.writeFileSync(`E:/Webs/chrome-extensions/tab-group-organizer/icons/icon${size}.png`, png);
  console.log(`icon${size}.png: ${png.length} bytes`);
});

console.log('All icons generated!');
