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
import { QUESTIONS, LANGUAGES } from '@/lib/content';

const LANG_CODES = new Set(LANGUAGES.map((l) => l.code));

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
    if (event === 'session_start') {
      const ops = [
        kv.sadd('tralala:analytics:devices', device),
        kv.hincrby('tralala:analytics:sessions:byday', day, 1),
      ];
      if (lang) ops.push(kv.hincrby('tralala:analytics:sessions:bylangday', `${day}|${lang}`, 1));
      const [added] = await Promise.all(ops);
      await kv.hincrby('tralala:analytics:sessions:bykindday', `${day}|${added ? 'new' : 'returning'}`, 1);
    } else if (event === 'cards_viewed') {
      const qid = Number(p.question);
      if (Number.isInteger(qid) && qid >= 0 && qid < QUESTIONS.length) {
        const category = QUESTIONS[qid][0];
        const ops = [
          kv.hincrby('tralala:analytics:views:byquestionday', `${day}|${qid}`, 1),
          kv.hincrby('tralala:analytics:views:bycategoryday', `${day}|${category}`, 1),
          kv.hincrby('tralala:analytics:views:byfiltermodeday', `${day}|${p.allMode ? 'all' : 'narrowed'}`, 1),
        ];
        if (lang) ops.push(kv.hincrby('tralala:analytics:views:bycatlangday', `${day}|${category}|${lang}`, 1));
        await Promise.all(ops);
      }
    } else if (event === 'share_open') {
      const qid = Number(p.question);
      if (Number.isInteger(qid) && qid >= 0 && qid < QUESTIONS.length) {
        const category = QUESTIONS[qid][0];
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
