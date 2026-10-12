// Persists anonymous, aggregate-only product events (session_start,
// cards_viewed, share_open) as running counters in Vercel KV — no per-event
// rows, no personal data, nothing tied to a person. See lib/analytics.js
// `track()` for the client side and /api/analytics for reading the totals
// back out.
//
// Every counter is day-bucketed: each hash field is "<date>|<rest>" (e.g.
// "2026-08-28|fun" or "2026-08-28|know|en"), all in ONE hash per metric —
// not one Redis key per day. That keeps writes to a handful of HINCRBYs and
// lets /api/analytics answer "just the last 7/30/90 days" (or everything)
// with a single HGETALL per metric, filtering and summing by date in JS.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { QUESTION_BY_ID, LANGUAGES } from '@/lib/content';
import { isAdmin } from '@/lib/adminAuth';

const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));

// The owner's own devices: any event sent while logged in as admin marks the
// device, and nothing from a marked device is counted again (also after the
// login runs out), so testing doesn't end up in the numbers.
const OWNERS_KEY = 'tralala:analytics:owners';

// Steps of /create, counted once per device per day ("<date>|<device>" →
// times), so /api/analytics can count how many people reached each step and
// how many wrote two decks or more.
const CREATE_STEPS = new Set(['open', 'code', 'idea', 'deck', 'play', 'finish']);
const ACTIVE_TTL_SECONDS = 120 * 24 * 60 * 60;
// Card-level counts in /create: ↻ swaps and ✕ removals while making a deck,
// and cards shown while playing one's own deck.
const CREATE_CARD = new Set(['swap', 'remove', 'card']);
const DECK_SIZES = new Set([15, 20, 25, 30, 35, 40, 45, 50]);

// What kind of device someone plays on, from the browser's user agent:
// the question behind "iPhone app first?". Recorded per device per day.
function platformOf(request) {
  const ua = request.headers.get('user-agent') || '';
  // iPads that ask for the desktop site (Safari's default) say "Macintosh"
  // and count as computers.
  if (/iPhone|iPad|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'computer';
}
const notePlatform = (request, day, device) =>
  kv.hincrby('tralala:analytics:platform', `${day}|${platformOf(request)}|${device}`, 1);

// Which features a device used on a day ("<date>|<device>" → times).
const feature = (name, day, device) => kv.hincrby(`tralala:analytics:feature:${name}`, `${day}|${device}`, 1);

function today() {
  return new Date().toISOString().slice(0, 10);
}

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { event, props, device } = body || {};
  if (typeof device !== 'string' || device.length < 1 || device.length > 128) {
    return NextResponse.json({ error: 'invalid_device' }, { status: 400 });
  }

  const p = props && typeof props === 'object' ? props : {};
  const lang = LANG_CODES.has(p.lang) ? p.lang : null;
  const day = today();

  try {
    if (await isAdmin()) {
      await kv.sadd(OWNERS_KEY, device);
      return new NextResponse(null, { status: 204 });
    }
    if (await kv.sismember(OWNERS_KEY, device)) return new NextResponse(null, { status: 204 });

    if (event === 'session_start') {
      const activeKey = `tralala:analytics:active:${day}`;
      const ops = [
        kv.sadd('tralala:analytics:devices', device),
        kv.hincrby('tralala:analytics:sessions:byday', day, 1),
        kv.sadd(activeKey, device),
        notePlatform(request, day, device),
      ];
      if (lang) ops.push(kv.hincrby('tralala:analytics:sessions:bylangday', `${day}|${lang}`, 1));
      const [added] = await Promise.all(ops);
      // First day of a device, for "came back next day / within a week".
      // Only devices new from 2026-10-12 have one.
      await Promise.all([
        kv.hincrby('tralala:analytics:sessions:bykindday', `${day}|${added ? 'new' : 'returning'}`, 1),
        added ? kv.hset('tralala:analytics:firstseen', { [device]: day }) : null,
        kv.expire(activeKey, ACTIVE_TTL_SECONDS),
      ]);
    } else if (event === 'create' && CREATE_STEPS.has(p.step)) {
      const ops = [kv.hincrby(`tralala:analytics:create:${p.step}`, `${day}|${device}`, 1)];
      if (p.step === 'open') ops.push(notePlatform(request, day, device));
      // A written deck also says what kind: size, language, 18+.
      if (p.step === 'deck') {
        const deckKey = 'tralala:analytics:createdeck';
        if (DECK_SIZES.has(p.size)) ops.push(kv.hincrby(deckKey, `${day}|size|${p.size}`, 1));
        if (typeof p.lang === 'string' && /^[a-z]{2,8}$/.test(p.lang)) ops.push(kv.hincrby(deckKey, `${day}|lang|${p.lang}`, 1));
        ops.push(kv.hincrby(deckKey, `${day}|adult|${p.adult ? 1 : 0}`, 1));
      }
      await Promise.all(ops);
    } else if (event === 'create_card' && CREATE_CARD.has(p.what)) {
      await kv.hincrby('tralala:analytics:createcards', `${day}|${p.what}`, 1);
    } else if (event === 'tv_connect') {
      await feature('tv', day, device);
    } else if (event === 'cards_viewed') {
      const qid = p.question;
      const row = typeof qid === 'string' ? QUESTION_BY_ID.get(qid) : null;
      if (row) {
        const category = row[0];
        const ops = [
          kv.hincrby('tralala:analytics:views:byquestionday', `${day}|${qid}`, 1),
          kv.hincrby('tralala:analytics:views:bycategoryday', `${day}|${category}`, 1),
          kv.hincrby('tralala:analytics:views:byfiltermodeday', `${day}|${p.allMode ? 'all' : 'narrowed'}`, 1),
          // Who played which deck, so /insights can count people, not just cards.
          kv.hincrby('tralala:analytics:deckpeople', `${day}|${category}|${lang || '-'}|${device}`, 1),
        ];
        if (lang) ops.push(kv.hincrby('tralala:analytics:views:bycatlangday', `${day}|${category}|${lang}`, 1));
        await Promise.all(ops);
      }
    } else if (event === 'share_open') {
      await feature('share', day, device);
      const qid = p.question;
      const row = typeof qid === 'string' ? QUESTION_BY_ID.get(qid) : null;
      if (row) {
        const category = row[0];
        await Promise.all([
          kv.hincrby('tralala:analytics:shares:byquestionday', `${day}|${qid}`, 1),
          kv.hincrby('tralala:analytics:shares:bycategoryday', `${day}|${category}`, 1),
        ]);
      }
    }
    // Any other event name is accepted and ignored, so the client's
    // fire-and-forget track() calls don't need a server-side case for every
    // event it ever sends.
    return new NextResponse(null, { status: 204 });
  } catch {
    return new NextResponse(null, { status: 204 });
  }
}
