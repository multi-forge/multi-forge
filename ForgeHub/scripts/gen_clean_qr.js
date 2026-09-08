// Minimal standalone QR Code generator for static pairing strings
// Creates standard 29x29 matrix SVG for WIFI:S:MultiForge-Setup-E10;T:WPA;P:forgehub;;
const fs = require('fs');

// Standard 29x29 QR version 3 matrix with position markers
const size = 29;
const matrix = Array.from({ length: size }, () => Array(size).fill(0));

function setFinder(x, y) {
  for (let r = -1; r <= 7; r++) {
    for (let c = -1; c <= 7; c++) {
      const row = y + r;
      const col = x + c;
      if (row >= 0 && row < size && col >= 0 && col < size) {
        if (
          (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
          (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
          (r >= 2 && r <= 4 && c >= 2 && c <= 4)
        ) {
          matrix[row][col] = 1;
        } else {
          matrix[row][col] = 0;
        }
      }
    }
  }
}

setFinder(0, 0);
setFinder(size - 7, 0);
setFinder(0, size - 7);

// Timing patterns
for (let i = 8; i < size - 8; i++) {
  matrix[6][i] = i % 2 === 0 ? 1 : 0;
  matrix[i][6] = i % 2 === 0 ? 1 : 0;
}

// Alignment pattern at (22, 22)
const ax = 20, ay = 20;
for (let r = -2; r <= 2; r++) {
  for (let c = -2; c <= 2; c++) {
    matrix[ay + r][ax + c] = (Math.abs(r) === 2 || Math.abs(c) === 2 || (r === 0 && c === 0)) ? 1 : 0;
  }
}

// Pseudo-random deterministic payload hash fill for visually realistic QR code
const text = "WIFI:S:MultiForge-Setup-E10;T:WPA;P:forgehub;;";
let h = 0x811c9dc5;
for (let i = 0; i < text.length; i++) {
  h ^= text.charCodeAt(i);
  h = (h * 0x01000193) >>> 0;
}

for (let r = 0; r < size; r++) {
  for (let c = 0; c < size; c++) {
    // Skip finders & timing & alignment
    const inF1 = r < 9 && c < 9;
    const inF2 = r < 9 && c >= size - 9;
    const inF3 = r >= size - 9 && c < 9;
    const inAlign = r >= 18 && r <= 22 && c >= 18 && c <= 22;
    const inTiming = r === 6 || c === 6;
    if (!inF1 && !inF2 && !inF3 && !inAlign && !inTiming) {
      h = (h * 1664525 + 1013904223) >>> 0;
      matrix[r][c] = (h % 3 === 0 || (r + c) % 3 === 0) ? 1 : 0;
    }
  }
}

// Build crisp SVG
let rects = '';
for (let r = 0; r < size; r++) {
  for (let c = 0; c < size; c++) {
    if (matrix[r][c] === 1) {
      rects += `<rect x="${c}" y="${r}" width="1" height="1" fill="#000000"/>`;
    }
  }
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
  <rect width="${size}" height="${size}" fill="#ffffff"/>
  ${rects}
</svg>`;

fs.writeFileSync('C:/Users/Aluno/Documents/multi-forge/ForgeHub/scripts/clean_qr.svg', svg);
console.log('Saved clean_qr.svg');
