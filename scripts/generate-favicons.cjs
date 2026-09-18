const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

// 1. Generate favicon.svg (Brutalist Tech FinGo Symbol)
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg-grad" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#141414"/>
      <stop offset="100%" stop-color="#0A0A0A"/>
    </radialGradient>
    <filter id="neon-glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <!-- Rounded dark obsidian tile -->
  <rect width="512" height="512" rx="100" fill="url(#bg-grad)"/>
  <rect width="504" height="504" x="4" y="4" rx="98" fill="none" stroke="#282828" stroke-width="4"/>
  <!-- FinGo Acid Green Neon Symbol (Scaled & Centered) -->
  <g transform="translate(68, 70) scale(0.95)" filter="url(#neon-glow)">
    <polygon points="385,10 139,10 10,139 10,358 93,275 93,174 172,95 385,95" fill="#C6FF00"/>
    <polygon points="385,155 218,155 137,236 267,236 138,365 265,365 385,245" fill="#C6FF00"/>
  </g>
</svg>
`;

fs.writeFileSync('favicon.svg', svgContent, 'utf8');
if (fs.existsSync('dist')) {
  fs.writeFileSync('dist/favicon.svg', svgContent, 'utf8');
}
console.log('✓ favicon.svg gerado com sucesso.');

// 2. Load authentic fingo-symbol.png
const symbolPngData = fs.readFileSync('img/fingo/fingo-symbol.png');
const symbolPng = PNG.sync.read(symbolPngData);

// High-quality renderer for dark tile with centered FinGo symbol
function renderFaviconPng(targetSize, cornerRadius = 0) {
  const target = new PNG({ width: targetSize, height: targetSize });
  
  // Background: #0A0A0A with rounded corners
  const bgR = 10, bgG = 10, bgB = 10;
  const radius = cornerRadius > 0 ? cornerRadius : Math.round(targetSize * 0.20);
  
  // Padding for symbol
  const pad = Math.round(targetSize * 0.15);
  const iconW = targetSize - (pad * 2);
  const iconH = Math.round(iconW * (symbolPng.height / symbolPng.width));
  const offX = pad;
  const offY = Math.round((targetSize - iconH) / 2);

  for (let y = 0; y < targetSize; y++) {
    for (let x = 0; x < targetSize; x++) {
      const tidx = (targetSize * y + x) << 2;

      // Rounded rect mask test
      let inBounds = true;
      let alpha = 255;
      
      const dx = Math.min(x, targetSize - 1 - x);
      const dy = Math.min(y, targetSize - 1 - y);
      if (dx < radius && dy < radius) {
        const dist = Math.sqrt((radius - dx) ** 2 + (radius - dy) ** 2);
        if (dist > radius) {
          inBounds = false;
          alpha = 0;
        } else if (dist > radius - 1) {
          alpha = Math.round((1 - (dist - (radius - 1))) * 255);
        }
      }

      if (!inBounds) {
        target.data[tidx] = 0;
        target.data[tidx + 1] = 0;
        target.data[tidx + 2] = 0;
        target.data[tidx + 3] = alpha;
        continue;
      }

      // Check if inside icon area
      let symR = bgR, symG = bgG, symB = bgB, symA = 0;
      if (x >= offX && x < offX + iconW && y >= offY && y < offY + iconH) {
        // Bilinear sample from symbolPng
        const srcX = ((x - offX) / iconW) * (symbolPng.width - 1);
        const srcY = ((y - offY) / iconH) * (symbolPng.height - 1);
        const x0 = Math.floor(srcX);
        const x1 = Math.min(x0 + 1, symbolPng.width - 1);
        const y0 = Math.floor(srcY);
        const y1 = Math.min(y0 + 1, symbolPng.height - 1);
        const wx = srcX - x0;
        const wy = srcY - y0;

        const p00 = (symbolPng.width * y0 + x0) << 2;
        const p10 = (symbolPng.width * y0 + x1) << 2;
        const p01 = (symbolPng.width * y1 + x0) << 2;
        const p11 = (symbolPng.width * y1 + x1) << 2;

        const a00 = symbolPng.data[p00 + 3];
        const a10 = symbolPng.data[p10 + 3];
        const a01 = symbolPng.data[p01 + 3];
        const a11 = symbolPng.data[p11 + 3];

        symA = (a00 * (1 - wx) * (1 - wy) +
                a10 * wx * (1 - wy) +
                a01 * (1 - wx) * wy +
                a11 * wx * wy) / 255;

        // Symbol is Neon Acid Green #C6FF00
        symR = 198;
        symG = 255;
        symB = 0;
      }

      // Blend symbol over dark background
      const finalR = Math.round(symR * symA + bgR * (1 - symA));
      const finalG = Math.round(symG * symA + bgG * (1 - symA));
      const finalB = Math.round(symB * symA + bgB * (1 - symA));

      target.data[tidx] = finalR;
      target.data[tidx + 1] = finalG;
      target.data[tidx + 2] = finalB;
      target.data[tidx + 3] = alpha;
    }
  }

  return PNG.sync.write(target);
}

// Generate 32x32 PNG
const png32 = renderFaviconPng(32, 6);
fs.writeFileSync('favicon-32x32.png', png32);
if (fs.existsSync('dist')) fs.writeFileSync('dist/favicon-32x32.png', png32);
console.log('✓ favicon-32x32.png gerado com sucesso.');

// Generate 192x192 PNG
const png192 = renderFaviconPng(192, 38);
fs.writeFileSync('favicon-192x192.png', png192);
if (fs.existsSync('dist')) fs.writeFileSync('dist/favicon-192x192.png', png192);
console.log('✓ favicon-192x192.png gerado com sucesso.');

// Generate 16x16 PNG for multi-size ICO
const png16 = renderFaviconPng(16, 3);

// Build standard ICO file containing 32x32 and 16x16 PNG frames
function createIco(images) {
  // ICO Header: 6 bytes
  // Reserved (2 bytes) = 0
  // Type (2 bytes) = 1 (icon)
  // Number of images (2 bytes)
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(images.length, 4);

  const dirEntries = [];
  let currentOffset = 6 + images.length * 16;

  for (const img of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(img.width === 256 ? 0 : img.width, 0); // width
    entry.writeUInt8(img.height === 256 ? 0 : img.height, 1); // height
    entry.writeUInt8(0, 2); // color palette count (0 if no palette)
    entry.writeUInt8(0, 3); // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(img.data.length, 8); // size of image data
    entry.writeUInt32LE(currentOffset, 12); // offset of image data
    dirEntries.push(entry);
    currentOffset += img.data.length;
  }

  return Buffer.concat([header, ...dirEntries, ...images.map(i => i.data)]);
}

const icoBuffer = createIco([
  { width: 32, height: 32, data: png32 },
  { width: 16, height: 16, data: png16 }
]);

fs.writeFileSync('favicon.ico', icoBuffer);
if (fs.existsSync('dist')) fs.writeFileSync('dist/favicon.ico', icoBuffer);
console.log('✓ favicon.ico gerado com sucesso.');
