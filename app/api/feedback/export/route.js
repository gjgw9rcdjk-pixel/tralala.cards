// Private export of the full feedback list, for offline analysis. There is
// no admin login — access is gated by a long random key set as the
// FEEDBACK_EXPORT_KEY env var (Vercel dashboard → Settings → Environment
// Variables). Anyone with the exact URL (including the key) can read every
// submission, so keep that URL private. See README "Feedback export". The
// same key also gates /moderate (delete) and /api/feedback/moderate.

import { NextResponse } from 'next/server';
import { listFeedback, checkExportKey } from '@/lib/feedbackKv';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const keyError = checkExportKey(searchParams);
  if (keyError) return NextResponse.json({ error: keyError.error }, { status: keyError.status });

  try {
    const items = await listFeedback();
    return NextResponse.json(items);
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
