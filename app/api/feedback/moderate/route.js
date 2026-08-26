// Private view + delete for the feedback board, gated by the same shared
// secret as /api/feedback/export (FEEDBACK_EXPORT_KEY) — there's no admin
// login, so this key is the only thing standing between anyone and the
// ability to remove a submission. Backs the /moderate page.

import { NextResponse } from 'next/server';
import { listFeedback, deleteFeedback, checkExportKey } from '@/lib/feedbackKv';

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

export async function DELETE(request) {
  const { searchParams } = new URL(request.url);
  const keyError = checkExportKey(searchParams);
  if (keyError) return NextResponse.json({ error: keyError.error }, { status: keyError.status });

  const id = Number(searchParams.get('id'));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    await deleteFeedback(id);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'kv_unavailable' }, { status: 503 });
  }
}
