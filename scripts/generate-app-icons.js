const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const ROOT = path.resolve(__dirname, "..");
const ASSETS = path.join(ROOT, "assets");

const COLORS = {
  pine: [35, 94, 65, 255],
  deepPine: [24, 61, 45, 255],
  moss: [123, 177, 113, 255],
  mint: [191, 224, 177, 255],
  cream: [248, 245, 225, 255],
  sun: [239, 184, 88, 255],
  sky: [105, 167, 148, 255],
  transparent: [0, 0, 0, 0],
};

function mix(a, b, t) {
  return a.map((value, index) =>
    index === 3 ? Math.round(value + (b[index] - value) * t) : Math.round(value + (b[index] - value) * t),
  );
}

function setPixel(png, x, y, color) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height) return;
  const idx = (png.width * y + x) << 2;
  png.data[idx] = color[0];
  png.data[idx + 1] = color[1];
  png.data[idx + 2] = color[2];
  png.data[idx + 3] = color[3];
}

function blendPixel(png, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= png.width || y >= png.height || alpha <= 0) return;
  const idx = (png.width * y + x) << 2;
  const srcA = (color[3] / 255) * alpha;
  const dstA = png.data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  png.data[idx] = Math.round((color[0] * srcA + png.data[idx] * dstA * (1 - srcA)) / outA);
  png.data[idx + 1] = Math.round((color[1] * srcA + png.data[idx + 1] * dstA * (1 - srcA)) / outA);
  png.data[idx + 2] = Math.round((color[2] * srcA + png.data[idx + 2] * dstA * (1 - srcA)) / outA);
  png.data[idx + 3] = Math.round(outA * 255);
}

function createPng(size, fill = COLORS.transparent) {
  const png = new PNG({ width: size, height: size });
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) setPixel(png, x, y, fill);
  }
  return png;
}

function pointInPolygon(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const xi = points[i][0];
    const yi = points[i][1];
    const xj = points[j][0];
    const yj = points[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function fillPolygon(png, points, color) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          if (pointInPolygon(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3, points)) coverage += 1;
        }
      }
      if (coverage) blendPixel(png, x, y, color, coverage / 9);
    }
  }
}

function fillCircle(png, cx, cy, radius, color) {
  const minX = Math.floor(cx - radius - 1);
  const maxX = Math.ceil(cx + radius + 1);
  const minY = Math.floor(cy - radius - 1);
  const maxY = Math.ceil(cy + radius + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const dx = x + (sx + 0.5) / 4 - cx;
          const dy = y + (sy + 0.5) / 4 - cy;
          if (dx * dx + dy * dy <= radius * radius) coverage += 1;
        }
      }
      if (coverage) blendPixel(png, x, y, color, coverage / 16);
    }
  }
}

function strokeRoundLine(png, points, width, color) {
  const radius = width / 2;
  for (let i = 0; i < points.length - 1; i += 1) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[i + 1];
    const minX = Math.floor(Math.min(x1, x2) - radius - 1);
    const maxX = Math.ceil(Math.max(x1, x2) + radius + 1);
    const minY = Math.floor(Math.min(y1, y2) - radius - 1);
    const maxY = Math.ceil(Math.max(y1, y2) + radius + 1);
    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;
    for (let y = minY; y <= maxY; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        let coverage = 0;
        for (let sy = 0; sy < 3; sy += 1) {
          for (let sx = 0; sx < 3; sx += 1) {
            const px = x + (sx + 0.5) / 3;
            const py = y + (sy + 0.5) / 3;
            const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
            const nx = x1 + t * dx;
            const ny = y1 + t * dy;
            const distSq = (px - nx) ** 2 + (py - ny) ** 2;
            if (distSq <= radius * radius) coverage += 1;
          }
        }
        if (coverage) blendPixel(png, x, y, color, coverage / 9);
      }
    }
  }
  for (const [x, y] of points) fillCircle(png, x, y, radius, color);
}

function fillRoundedRect(png, x0, y0, w, h, r, color) {
  for (let y = Math.floor(y0); y < Math.ceil(y0 + h); y += 1) {
    for (let x = Math.floor(x0); x < Math.ceil(x0 + w); x += 1) {
      let coverage = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const px = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          const cx = Math.max(x0 + r, Math.min(px, x0 + w - r));
          const cy = Math.max(y0 + r, Math.min(py, y0 + h - r));
          if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) coverage += 1;
        }
      }
      if (coverage) blendPixel(png, x, y, color, coverage / 9);
    }
  }
}

function drawMark(png, scale = 1, offsetX = 0, offsetY = 0) {
  const s = (value) => value * scale;
  const p = (x, y) => [offsetX + s(x), offsetY + s(y)];

  fillCircle(png, offsetX + s(688), offsetY + s(288), s(70), COLORS.sun);
  fillCircle(png, offsetX + s(688), offsetY + s(288), s(44), [255, 218, 124, 255]);

  fillPolygon(
    png,
    [p(170, 700), p(365, 368), p(495, 604), p(565, 510), p(760, 700)],
    COLORS.deepPine,
  );
  fillPolygon(png, [p(286, 700), p(530, 286), p(842, 700)], COLORS.pine);
  fillPolygon(png, [p(448, 424), p(530, 286), p(628, 458), p(569, 430), p(526, 490)], COLORS.cream);
  fillPolygon(png, [p(318, 448), p(365, 368), p(418, 464), p(376, 442), p(350, 496)], COLORS.mint);

  strokeRoundLine(
    png,
    [p(214, 734), p(340, 662), p(468, 700), p(574, 632), p(746, 690), p(850, 620)],
    s(52),
    [25, 74, 54, 210],
  );
  strokeRoundLine(
    png,
    [p(214, 724), p(340, 652), p(468, 690), p(574, 622), p(746, 680), p(850, 610)],
    s(32),
    COLORS.cream,
  );

  fillCircle(png, offsetX + s(830), offsetY + s(602), s(64), [248, 245, 225, 255]);
  fillCircle(png, offsetX + s(830), offsetY + s(602), s(34), COLORS.moss);
  fillPolygon(png, [p(792, 650), p(830, 770), p(868, 650)], [248, 245, 225, 255]);
  fillPolygon(png, [p(808, 654), p(830, 726), p(852, 654)], COLORS.moss);
}

function drawIconBackground(png) {
  const size = png.width;
  for (let y = 0; y < size; y += 1) {
    const t = y / (size - 1);
    const color = mix([45, 118, 82, 255], [24, 67, 50, 255], t);
    for (let x = 0; x < size; x += 1) setPixel(png, x, y, color);
  }
  fillCircle(png, size * 0.2, size * 0.12, size * 0.5, [89, 154, 116, 70]);
  fillCircle(png, size * 0.9, size * 0.18, size * 0.42, [255, 255, 255, 28]);
}

function writePng(png, fileName) {
  const outPath = path.join(ASSETS, fileName);
  fs.writeFileSync(outPath, PNG.sync.write(png));
  console.log(`wrote ${outPath}`);
}

function makeIcon() {
  const png = createPng(1024);
  drawIconBackground(png);
  drawMark(png);
  writePng(png, "icon.png");
}

function makeAdaptiveIcon() {
  const png = createPng(1024, COLORS.transparent);
  drawMark(png, 0.72, 144, 134);
  writePng(png, "adaptive-icon.png");
}

function makeSplashIcon() {
  const png = createPng(1242, COLORS.transparent);
  fillRoundedRect(png, 182, 182, 878, 878, 220, [47, 111, 78, 255]);
  fillCircle(png, 364, 304, 410, [89, 154, 116, 58]);
  fillCircle(png, 958, 350, 300, [255, 255, 255, 24]);
  drawMark(png, 0.78, 103, 125);
  writePng(png, "splash-icon.png");
}

function makeFavicon() {
  const png = createPng(64);
  drawIconBackground(png);
  drawMark(png, 0.0625, 0, 0);
  writePng(png, "favicon.png");
}

makeIcon();
makeAdaptiveIcon();
makeSplashIcon();
makeFavicon();
