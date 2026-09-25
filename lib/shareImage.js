// Renders a question card to a PNG on a <canvas>, client-side (design 13d).
// Exported cards match the in-game card: tilted −1.4° with the pink offset
// shadow, with enough margin that nothing is clipped. One brand line
// ("Tralala.cards") and no deck label, so the question stands on its own.

export const SURFACES = {
  cream: { bg: '#FFFDF8', ink: '#131318', label: '#C22050', muted: '#8A8578' },
  sand: { bg: '#EFEBE2', ink: '#131318', label: '#C22050', muted: '#8A8578' },
  ink: { bg: '#131318', ink: '#FFFDF8', label: '#FF4E7D', muted: 'rgba(255,255,255,.5)', border: 'rgba(255,255,255,.25)' },
};

export const FORMATS = {
  square: { w: 1080, h: 1080 },
  story: { w: 1080, h: 1920 },
};

// next/font gives each font a generated family name; read it from the CSS
// variables set on <html> in app/layout.jsx.
function family(varName, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  return v || fallback;
}

function wrap(ctx, text, maxWidth) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width <= maxWidth || !line) line = test;
    else {
      lines.push(line);
      line = word;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Largest font size (stepping down) whose wrapped lines fit the box.
function fitText(ctx, text, font, maxWidth, maxHeight, start, min, lineHeight) {
  for (let size = start; size >= min; size -= 2) {
    ctx.font = font(size);
    const lines = wrap(ctx, text, maxWidth);
    if (lines.length * size * lineHeight <= maxHeight) return { size, lines };
  }
  ctx.font = font(min);
  return { size: min, lines: wrap(ctx, text, maxWidth) };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function dotGround(ctx, w, h) {
  ctx.fillStyle = '#101014';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,.075)';
  for (let y = 22.5; y < h; y += 45) {
    for (let x = 22.5; x < w; x += 45) {
      ctx.beginPath();
      ctx.arc(x, y, 3.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function spaced(ctx, px) {
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${px}px`;
}

export async function renderCard({ text, format = 'square', surface = 'cream' }) {
  const display = family('--font-archivo', 'Archivo');
  const body = family('--font-jakarta', 'Plus Jakarta Sans');
  await Promise.all([
    document.fonts.load(`800 60px ${display}`),
    document.fonts.load(`italic 800 60px ${display}`),
    document.fonts.load(`800 30px ${body}`),
  ]).catch(() => {});

  const { w, h } = FORMATS[format];
  const sf = SURFACES[surface];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  dotGround(ctx, w, h);

  const qFont = (size) => `800 ${size}px ${display}`;
  const OFFSET = 42;
  // Card with the in-game pink offset shadow (never rotated, so it crops cleanly).
  const drawCard = (x, y, cw, ch) => {
    roundRect(ctx, x + OFFSET, y + OFFSET, cw, ch, 54);
    ctx.fillStyle = 'rgba(255,78,125,.92)';
    ctx.fill();
    roundRect(ctx, x, y, cw, ch, 54);
    ctx.fillStyle = sf.bg;
    ctx.fill();
    if (sf.border) {
      ctx.strokeStyle = sf.border;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  };
  const drawLines = (lines, size, x, y) => {
    ctx.font = qFont(size);
    spaced(ctx, -size * 0.03);
    ctx.fillStyle = sf.ink;
    ctx.textBaseline = 'top';
    lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * size * 1.14));
    spaced(ctx, 0);
  };
  // One brand mention: the wordmark doubles as the address.
  const WORDMARK = 48;
  const drawWordmark = (x, baseline) => {
    ctx.textBaseline = 'alphabetic';
    ctx.font = `italic 800 ${WORDMARK}px ${display}`;
    spaced(ctx, -1);
    ctx.fillStyle = sf.label;
    ctx.fillText('Tralala.cards', x, baseline);
    spaced(ctx, 0);
  };

  // Same −1.4° tilt as the question card in the app, around the card's centre.
  const tilt = (x, y, cw, ch) => {
    const cx = x + cw / 2;
    const cy = y + ch / 2;
    ctx.translate(cx, cy);
    ctx.rotate((-1.4 * Math.PI) / 180);
    ctx.translate(-cx, -cy);
  };

  const INNER = 78;
  ctx.save();
  if (format === 'square') {
    const cw = w - 90 * 2 - OFFSET;
    const ch = cw;
    const cx = (w - cw - OFFSET) / 2;
    const cy = (h - ch - OFFSET) / 2;
    tilt(cx, cy, cw, ch);
    drawCard(cx, cy, cw, ch);
    const ix = cx + INNER;
    const iw = cw - INNER * 2;
    const top = cy + INNER;
    const footTop = cy + ch - INNER - WORDMARK;
    const room = footTop - top - 40;
    const { size, lines } = fitText(ctx, text, qFont, iw, room, 88, 52, 1.14);
    const qh = lines.length * size * 1.14;
    drawLines(lines, size, ix, top + Math.max(0, (room - qh) / 2));
    drawWordmark(ix, cy + ch - INNER);
  } else {
    const cw = w - 90 * 2 - OFFSET;
    const ix = 90 + INNER;
    const iw = cw - INNER * 2;
    const { size, lines } = fitText(ctx, text, qFont, iw, 1000, 92, 56, 1.14);
    const qh = lines.length * size * 1.14;
    const ch = INNER + qh + 84 + WORDMARK + INNER;
    const cy = (h - ch - OFFSET) / 2;
    tilt(90, cy, cw, ch);
    drawCard(90, cy, cw, ch);
    drawLines(lines, size, ix, cy + INNER);
    drawWordmark(ix, cy + ch - INNER);
  }
  ctx.restore();

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
