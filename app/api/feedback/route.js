// Public feedback board: anyone can post a short suggestion (rate-limited to
// one per device per day) and browse what others wrote.
// Storage: an incrementing id (tralala:feedback:seq), a newest-first list of
// those ids (tralala:feedback:ids), one hash per item
// (tralala:feedback:item:<id>) holding { text, ts, up, down }, and one
// expiring key per device (tralala:feedback-limit:<device>) enforcing the
// daily limit.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { listFeedback } from '@/lib/feedbackKv';

const MAX_LEN = 500;
const LIST_LIMIT = 200;
const LIMIT_TTL_SECONDS = 60 * 60 * 24;

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { text, device } = body || {};
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (!trimmed || trimmed.length > MAX_LEN) {
    return NextResponse.json({ error: 'invalid_text' }, { status: 400 });
  }
  if (typeof device !== 'string' || device.length < 1 || device.length > 128) {
    return NextResponse.json({ error: 'invalid_device' }, { status: 400 });
  }

  const limitKey = `tralala:feedback-limit:${device}`;

  try {
    const limited = await kv.get(limitKey);
    if (limited) {
      return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
    }

    const id = await kv.incr('tralala:feedback:seq');
    const item = { text: trimmed, ts: Date.now(), up: 0, down: 0 };
    await Promise.all([
      kv.hset(`tralala:feedback:item:${id}`, item),
      kv.lpush('tralala:feedback:ids', String(id)),
      kv.set(limitKey, 1, { ex: LIMIT_TTL_SECONDS }),
    ]);

    return NextResponse.json({ id, ...item });
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}

export async function GET() {
  try {
    const items = await listFeedback(LIST_LIMIT);
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
