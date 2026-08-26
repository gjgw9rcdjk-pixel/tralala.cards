import { ImageResponse } from 'next/og.js';
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const serifRegular = await readFile(join(__dirname, 'assets/InstrumentSerif-Regular.ttf'));
const serifItalic = await readFile(join(__dirname, 'assets/InstrumentSerif-Italic.ttf'));

const SCREEN = '#0c0c0d';
const PAPER = '#e2ded5'; // exact rendered color of oklch(0.90 0.012 85), the app's "Warm paper" card bg
const INK = '#e8e6e1';
const INK_FAINT = 'rgba(232,230,225,.55)';
const CARD_INK = '#131316';
const STACK_BACK_1 = '#3a3835';
const STACK_BACK_2 = '#8a8681';

const fonts = (size) => [
  { name: 'Instrument Serif', data: serifRegular, weight: 400, style: 'normal' },
  { name: 'Instrument Serif', data: serifItalic, weight: 400, style: 'italic' },
];

async function renderPng(node, width, height, outPath) {
  const res = new ImageResponse(node, { width, height, fonts: fonts() });
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(outPath, buf);
  console.log('wrote', outPath, `${width}x${height}`);
}

// ── Square app icon (favicon / apple-icon / PWA) — the same 3-card stack as
// the app's home screen (app/page.jsx intro view): two rotated card shadows
// behind a "Warm paper" front card, with the italic "T" mark on top. ──
function markIcon(size) {
  const cardW = size * 0.5;
  const cardH = cardW * (262 / 194); // same portrait ratio as the in-app stack
  const radius = cardW * (6 / 194); // same corner radius proportion as the app

  const layer = (bg, transform, { children, ...styleExtra } = {}) => ({
    type: 'div',
    props: {
      style: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: cardW,
        height: cardH,
        background: bg,
        borderRadius: radius,
        display: 'flex',
        ...(transform ? { transform } : {}),
        ...styleExtra,
      },
      children,
    },
  });

  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: SCREEN,
      },
      children: {
        type: 'div',
        props: {
          style: { position: 'relative', width: cardW, height: cardH, display: 'flex' },
          children: [
            layer(STACK_BACK_1, `rotate(-9deg) translateY(${cardW * (6 / 194)}px)`),
            layer(STACK_BACK_2, `rotate(-4.5deg) translateY(${cardW * (3 / 194)}px)`),
            layer(PAPER, null, {
              alignItems: 'center',
              justifyContent: 'center',
              children: {
                type: 'div',
                props: {
                  style: {
                    fontFamily: 'Instrument Serif',
                    fontStyle: 'italic',
                    fontSize: cardW * 0.95,
                    lineHeight: 1,
                    color: CARD_INK,
                    transform: 'translateY(2%)',
                  },
                  children: 'T',
                },
              },
            }),
          ],
        },
      },
    },
  };
}

// ── Open Graph share image — wordmark + tagline, matching the in-app card ──
function ogImage() {
  return {
    type: 'div',
    props: {
      style: {
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: SCREEN,
      },
      children: [
        {
          type: 'div',
          props: {
            style: { display: 'flex', alignItems: 'baseline' },
            children: [
              {
                type: 'span',
                props: {
                  style: { fontFamily: 'Instrument Serif', fontSize: 128, color: INK, letterSpacing: '-0.02em' },
                  children: 'Tra',
                },
              },
              {
                type: 'span',
                props: {
                  style: { fontFamily: 'Instrument Serif', fontStyle: 'italic', fontSize: 128, color: INK, letterSpacing: '-0.02em' },
                  children: 'lala',
                },
              },
            ],
          },
        },
        {
          type: 'div',
          props: {
            style: { fontFamily: 'Instrument Serif', fontSize: 72, color: INK, letterSpacing: '-0.02em', marginTop: -12 },
            children: 'cards',
          },
        },
        {
          type: 'div',
          props: {
            style: {
              marginTop: 36,
              fontSize: 20,
              letterSpacing: '0.18em',
              color: INK_FAINT,
              textTransform: 'uppercase',
            },
            children: 'Conversation cards for groups',
          },
        },
      ],
    },
  };
}

await renderPng(markIcon(512), 512, 512, join(root, 'public/icon-512.png'));
await renderPng(markIcon(192), 192, 192, join(root, 'public/icon-192.png'));
await renderPng(markIcon(512), 512, 512, join(root, 'app/icon.png'));
await renderPng(markIcon(180), 180, 180, join(root, 'app/apple-icon.png'));
await renderPng(ogImage(), 1200, 630, join(root, 'app/opengraph-image.png'));

console.log('done');
