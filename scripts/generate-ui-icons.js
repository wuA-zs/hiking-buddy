const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const OUT_DIR = path.resolve(__dirname, "../assets/walking-buddy");
const SIZE = 256;
const INK = [16, 18, 17, 255];
const SOFT = [16, 18, 17, 190];
const CLEAR = [0, 0, 0, 0];

function png() {
  return new PNG({ width: SIZE, height: SIZE });
}

function blend(img, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= img.width || y >= img.height || alpha <= 0) return;
  const idx = (img.width * y + x) << 2;
  if (color[3] === 0) {
    img.data[idx + 3] = Math.round(img.data[idx + 3] * (1 - alpha));
    return;
  }
  const srcA = (color[3] / 255) * alpha;
  const dstA = img.data[idx + 3] / 255;
  const outA = srcA + dstA * (1 - srcA);
  if (outA <= 0) return;
  img.data[idx] = Math.round((color[0] * srcA + img.data[idx] * dstA * (1 - srcA)) / outA);
  img.data[idx + 1] = Math.round((color[1] * srcA + img.data[idx + 1] * dstA * (1 - srcA)) / outA);
  img.data[idx + 2] = Math.round((color[2] * srcA + img.data[idx + 2] * dstA * (1 - srcA)) / outA);
  img.data[idx + 3] = Math.round(outA * 255);
}

function drawDisc(img, cx, cy, radius, color = INK, alpha = 1) {
  const r = radius;
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y += 1) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 4; sy += 1) {
        for (let sx = 0; sx < 4; sx += 1) {
          const dx = x + (sx + 0.5) / 4 - cx;
          const dy = y + (sy + 0.5) / 4 - cy;
          if (dx * dx + dy * dy <= r * r) hits += 1;
        }
      }
      if (hits) blend(img, x, y, color, (hits / 16) * alpha);
    }
  }
}

function line(img, x1, y1, x2, y2, width = 16, color = INK) {
  const r = width / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy || 1;
  const minX = Math.floor(Math.min(x1, x2) - r - 1);
  const maxX = Math.ceil(Math.max(x1, x2) + r + 1);
  const minY = Math.floor(Math.min(y1, y2) - r - 1);
  const maxY = Math.ceil(Math.max(y1, y2) + r + 1);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const px = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / lenSq));
          const nx = x1 + t * dx;
          const ny = y1 + t * dy;
          if ((px - nx) ** 2 + (py - ny) ** 2 <= r * r) hits += 1;
        }
      }
      if (hits) blend(img, x, y, color, hits / 9);
    }
  }
}

function polyline(img, points, width = 16, color = INK) {
  for (let i = 0; i < points.length - 1; i += 1) line(img, ...points[i], ...points[i + 1], width, color);
}

function polygonContains(x, y, points) {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function fillPolygon(img, points, color = INK) {
  const minX = Math.floor(Math.min(...points.map(([x]) => x)));
  const maxX = Math.ceil(Math.max(...points.map(([x]) => x)));
  const minY = Math.floor(Math.min(...points.map(([, y]) => y)));
  const maxY = Math.ceil(Math.max(...points.map(([, y]) => y)));
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          if (polygonContains(x + (sx + 0.5) / 3, y + (sy + 0.5) / 3, points)) hits += 1;
        }
      }
      if (hits) blend(img, x, y, color, hits / 9);
    }
  }
}

function rectFill(img, x0, y0, w, h, r, color = INK) {
  for (let y = Math.floor(y0); y <= Math.ceil(y0 + h); y += 1) {
    for (let x = Math.floor(x0); x <= Math.ceil(x0 + w); x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const px = x + (sx + 0.5) / 3;
          const py = y + (sy + 0.5) / 3;
          const cx = Math.max(x0 + r, Math.min(px, x0 + w - r));
          const cy = Math.max(y0 + r, Math.min(py, y0 + h - r));
          if ((px - cx) ** 2 + (py - cy) ** 2 <= r * r) hits += 1;
        }
      }
      if (hits) blend(img, x, y, color, hits / 9);
    }
  }
}

function strokeCircle(img, cx, cy, radius, width = 16, color = INK) {
  for (let y = Math.floor(cy - radius - width); y <= Math.ceil(cy + radius + width); y += 1) {
    for (let x = Math.floor(cx - radius - width); x <= Math.ceil(cx + radius + width); x += 1) {
      let hits = 0;
      for (let sy = 0; sy < 3; sy += 1) {
        for (let sx = 0; sx < 3; sx += 1) {
          const d = Math.hypot(x + (sx + 0.5) / 3 - cx, y + (sy + 0.5) / 3 - cy);
          if (Math.abs(d - radius) <= width / 2) hits += 1;
        }
      }
      if (hits) blend(img, x, y, color, hits / 9);
    }
  }
}

function strokeArc(img, cx, cy, radius, start, end, width = 16, color = INK) {
  const steps = Math.max(12, Math.ceil(Math.abs(end - start) * radius / 7));
  const points = [];
  for (let i = 0; i <= steps; i += 1) {
    const a = start + ((end - start) * i) / steps;
    points.push([cx + Math.cos(a) * radius, cy + Math.sin(a) * radius]);
  }
  polyline(img, points, width, color);
}

function save(name, draw) {
  const img = png();
  draw(img);
  fs.writeFileSync(path.join(OUT_DIR, `${name}.png`), PNG.sync.write(img));
}

function mountainMini(img) {
  polyline(img, [[48, 176], [92, 126], [124, 154], [156, 104], [208, 176]], 15);
  line(img, 102, 136, 116, 154, 12);
  line(img, 156, 104, 176, 140, 12);
}

const icons = {
  alert: (i) => {
    strokeCircle(i, 128, 128, 86, 16);
    line(i, 128, 68, 128, 140, 17);
    drawDisc(i, 128, 178, 10);
  },
  back: (i) => {
    polyline(i, [[142, 72], [86, 128], [142, 184]], 18);
    line(i, 91, 128, 190, 128, 18);
  },
  bolt: (i) => fillPolygon(i, [[145, 30], [70, 140], [123, 140], [104, 226], [190, 106], [136, 108]]),
  camera: (i) => {
    rectFill(i, 42, 76, 172, 126, 28);
    rectFill(i, 72, 56, 56, 34, 13);
    rectFill(i, 156, 62, 30, 16, 8);
    drawDisc(i, 128, 140, 42, CLEAR);
    strokeCircle(i, 128, 140, 38, 15);
    drawDisc(i, 184, 106, 8);
  },
  chat: (i) => {
    rectFill(i, 40, 48, 176, 136, 34);
    fillPolygon(i, [[86, 176], [74, 218], [124, 184]]);
    line(i, 78, 104, 178, 104, 14, CLEAR);
    line(i, 78, 138, 150, 138, 14, CLEAR);
  },
  check: (i) => {
    strokeCircle(i, 128, 128, 86, 16);
    polyline(i, [[82, 130], [114, 162], [178, 94]], 18);
  },
  "chevron-down": (i) => polyline(i, [[62, 96], [128, 160], [194, 96]], 22),
  "chevron-right": (i) => polyline(i, [[96, 62], [160, 128], [96, 194]], 22),
  "chevron-up": (i) => polyline(i, [[62, 160], [128, 96], [194, 160]], 22),
  chip: (i) => {
    rectFill(i, 66, 66, 124, 124, 22);
    rectFill(i, 96, 96, 64, 64, 12, CLEAR);
    for (const x of [84, 112, 144, 172]) {
      line(i, x, 42, x, 62, 10);
      line(i, x, 194, x, 214, 10);
    }
    for (const y of [84, 112, 144, 172]) {
      line(i, 42, y, 62, y, 10);
      line(i, 194, y, 214, y, 10);
    }
  },
  clock: (i) => {
    strokeCircle(i, 128, 128, 84, 16);
    line(i, 128, 78, 128, 132, 16);
    line(i, 128, 130, 166, 154, 16);
  },
  globe: (i) => {
    strokeCircle(i, 128, 128, 84, 15);
    strokeArc(i, 128, 128, 40, -Math.PI / 2, Math.PI / 2, 12);
    strokeArc(i, 128, 128, 40, Math.PI / 2, (Math.PI * 3) / 2, 12);
    line(i, 52, 128, 204, 128, 12);
    strokeArc(i, 128, 128, 74, -2.45, -0.7, 10);
    strokeArc(i, 128, 128, 74, 0.7, 2.45, 10);
  },
  key: (i) => {
    strokeCircle(i, 94, 112, 38, 16);
    line(i, 126, 134, 196, 204, 16);
    line(i, 166, 174, 190, 150, 14);
    line(i, 184, 192, 210, 166, 14);
  },
  leaf: (i) => {
    fillPolygon(i, [[54, 146], [78, 64], [178, 44], [208, 74], [188, 172], [92, 198]]);
    line(i, 76, 178, 176, 76, 13, CLEAR);
    line(i, 118, 134, 150, 144, 10, CLEAR);
    line(i, 137, 114, 128, 86, 10, CLEAR);
  },
  map: (i) => {
    fillPolygon(i, [[42, 62], [98, 42], [158, 62], [214, 42], [214, 188], [158, 214], [98, 194], [42, 214]]);
    line(i, 98, 42, 98, 194, 12, CLEAR);
    line(i, 158, 62, 158, 214, 12, CLEAR);
    line(i, 70, 166, 104, 126, 10, CLEAR);
    line(i, 104, 126, 132, 154, 10, CLEAR);
    line(i, 132, 154, 166, 106, 10, CLEAR);
    line(i, 166, 106, 196, 156, 10, CLEAR);
  },
  mute: (i) => {
    fillPolygon(i, [[42, 102], [82, 102], [132, 62], [132, 194], [82, 154], [42, 154]]);
    line(i, 166, 98, 214, 146, 16);
    line(i, 214, 98, 166, 146, 16);
  },
  navigate: (i) => {
    fillPolygon(i, [[128, 34], [214, 220], [132, 184], [80, 222]]);
    fillPolygon(i, [[128, 72], [172, 180], [132, 162], [104, 184]], CLEAR);
  },
  person: (i) => {
    drawDisc(i, 128, 82, 36);
    strokeArc(i, 128, 206, 76, Math.PI, Math.PI * 2, 24);
  },
  pin: (i) => {
    strokeCircle(i, 128, 94, 48, 16);
    fillPolygon(i, [[80, 116], [128, 224], [176, 116]]);
    drawDisc(i, 128, 94, 21, CLEAR);
  },
  refresh: (i) => {
    strokeArc(i, 128, 128, 72, -2.9, 0.35, 16);
    strokeArc(i, 128, 128, 72, 0.25, 3.45, 16);
    fillPolygon(i, [[194, 96], [218, 100], [204, 124]]);
    fillPolygon(i, [[62, 160], [38, 156], [52, 132]]);
  },
  send: (i) => {
    fillPolygon(i, [[34, 116], [220, 38], [148, 218], [116, 146]]);
    fillPolygon(i, [[76, 118], [174, 78], [120, 134]], CLEAR);
  },
  settings: (i) => {
    strokeCircle(i, 128, 128, 34, 16);
    for (let k = 0; k < 8; k += 1) {
      const a = (Math.PI * 2 * k) / 8;
      line(i, 128 + Math.cos(a) * 60, 128 + Math.sin(a) * 60, 128 + Math.cos(a) * 86, 128 + Math.sin(a) * 86, 18);
      drawDisc(i, 128 + Math.cos(a) * 88, 128 + Math.sin(a) * 88, 10);
    }
  },
  sparkle: (i) => {
    fillPolygon(i, [[128, 28], [146, 104], [222, 128], [146, 152], [128, 228], [110, 152], [34, 128], [110, 104]]);
    fillPolygon(i, [[58, 44], [68, 76], [100, 86], [68, 96], [58, 128], [48, 96], [16, 86], [48, 76]], SOFT);
  },
  trash: (i) => {
    rectFill(i, 70, 82, 116, 138, 18);
    rectFill(i, 88, 52, 80, 24, 12);
    line(i, 58, 78, 198, 78, 15);
    line(i, 104, 116, 104, 184, 10, CLEAR);
    line(i, 128, 116, 128, 184, 10, CLEAR);
    line(i, 152, 116, 152, 184, 10, CLEAR);
  },
  volume: (i) => {
    fillPolygon(i, [[42, 102], [82, 102], [132, 62], [132, 194], [82, 154], [42, 154]]);
    strokeArc(i, 142, 128, 42, -0.7, 0.7, 13);
    strokeArc(i, 142, 128, 72, -0.72, 0.72, 13);
  },
};

for (const [name, draw] of Object.entries(icons)) save(name, draw);
save("app-mark", (i) => {
  fillPolygon(i, [[34, 182], [90, 84], [126, 152], [156, 104], [224, 182]]);
  line(i, 50, 194, 96, 166, 16, CLEAR);
  line(i, 96, 166, 138, 184, 16, CLEAR);
  line(i, 138, 184, 188, 148, 16, CLEAR);
  strokeCircle(i, 196, 138, 22, 12, CLEAR);
});

console.log(`Generated ${Object.keys(icons).length + 1} custom icons in ${OUT_DIR}`);
