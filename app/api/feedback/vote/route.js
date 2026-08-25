// Records one up/down (or null, to un-vote) on a feedback item and returns
// its updated tally. Mirrors the toggle logic in app/api/rate/route.js, but
// keyed by feedback id instead of question id.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const { id, kind, device } = body || {};
  const numId = Number(id);
  if (!Number.isInteger(numId) || numId <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }
  if (kind !== 'up' && kind !== 'down' && kind !== null) {
    return NextResponse.json({ error: 'invalid_kind' }, { status: 400 });
  }
  if (typeof device !== 'string' || device.length < 1 || device.length > 128) {
    return NextResponse.json({ error: 'invalid_device' }, { status: 400 });
  }

  const field = String(numId);
  const itemKey = `tralala:feedback:item:${numId}`;
  const voterKey = `tralala:feedback-voter:${device}`;

  try {
    const prev = await kv.hget(voterKey, field);

    if (prev !== kind) {
      const ops = [];
      if (prev === 'up') ops.push(kv.hincrby(itemKey, 'up', -1));
      if (prev === 'down') ops.push(kv.hincrby(itemKey, 'down', -1));
      if (kind === 'up') ops.push(kv.hincrby(itemKey, 'up', 1));
      if (kind === 'down') ops.push(kv.hincrby(itemKey, 'down', 1));
      ops.push(kind === null ? kv.hdel(voterKey, field) : kv.hset(voterKey, { [field]: kind }));
      await Promise.all(ops);
    }

    const [up, down] = await Promise.all([
      kv.hget(itemKey, 'up'),
      kv.hget(itemKey, 'down'),
    ]);
    return NextResponse.json({ id: numId, up: Number(up) || 0, down: Number(down) || 0 });
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
