const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const DIR = path.resolve(__dirname, "../assets/walking-buddy");
const OUT = path.resolve(__dirname, "../assets/walking-buddy-preview.png");
const files = fs
  .readdirSync(DIR)
  .filter((file) => file.endsWith(".png"))
  .sort();

const cell = 112;
const cols = 7;
const rows = Math.ceil(files.length / cols);
const sheet = new PNG({ width: cols * cell, height: rows * cell });

function set(x, y, color) {
  const idx = (sheet.width * y + x) << 2;
  sheet.data[idx] = color[0];
  sheet.data[idx + 1] = color[1];
  sheet.data[idx + 2] = color[2];
  sheet.data[idx + 3] = color[3];
}

for (let y = 0; y < sheet.height; y += 1) {
  for (let x = 0; x < sheet.width; x += 1) set(x, y, [246, 247, 242, 255]);
}

for (let n = 0; n < files.length; n += 1) {
  const icon = PNG.sync.read(fs.readFileSync(path.join(DIR, files[n])));
  const ox = (n % cols) * cell + 24;
  const oy = Math.floor(n / cols) * cell + 16;
  for (let y = 0; y < 64; y += 1) {
    for (let x = 0; x < 64; x += 1) {
      const sx = Math.floor((x / 64) * icon.width);
      const sy = Math.floor((y / 64) * icon.height);
      const src = (icon.width * sy + sx) << 2;
      const alpha = icon.data[src + 3] / 255;
      if (!alpha) continue;
      const dst = (sheet.width * (oy + y) + (ox + x)) << 2;
      const color = [47, 111, 78];
      sheet.data[dst] = Math.round(color[0] * alpha + sheet.data[dst] * (1 - alpha));
      sheet.data[dst + 1] = Math.round(color[1] * alpha + sheet.data[dst + 1] * (1 - alpha));
      sheet.data[dst + 2] = Math.round(color[2] * alpha + sheet.data[dst + 2] * (1 - alpha));
      sheet.data[dst + 3] = 255;
    }
  }
}

fs.writeFileSync(OUT, PNG.sync.write(sheet));
console.log(OUT);
