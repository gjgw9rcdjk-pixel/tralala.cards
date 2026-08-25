// Private export of the full feedback list, for offline analysis. There is
// no admin login — access is gated by a long random key set as the
// FEEDBACK_EXPORT_KEY env var (Vercel dashboard → Settings → Environment
// Variables). Anyone with the exact URL (including the key) can read every
// submission, so keep that URL private. See README "Feedback export".

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

export async function GET(request) {
  const expected = process.env.FEEDBACK_EXPORT_KEY;
  if (!expected) {
    return NextResponse.json({ error: 'not_configured' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  if (searchParams.get('key') !== expected) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const ids = await kv.lrange('tralala:feedback:ids', 0, -1);
    const items = await Promise.all(
      (ids || []).map(async (id) => {
        const item = await kv.hgetall(`tralala:feedback:item:${id}`);
        if (!item || !item.text) return null;
        return {
          id: Number(id),
          text: item.text,
          ts: Number(item.ts) || 0,
          up: Number(item.up) || 0,
          down: Number(item.down) || 0,
        };
      })
    );
    return NextResponse.json(items.filter(Boolean));
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
