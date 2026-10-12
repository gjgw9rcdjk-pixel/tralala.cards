// Records one card a code user removed (✕) or swapped (↻) while making a
// deck, for the list on /create/admin (logDropped in ../codes.js). Needs a
// working code; the owner's own testing isn't kept.

import { isAdmin } from '@/lib/adminAuth';
import { checkCode, clientIp, logDropped } from '../codes';
import { errorResponse } from '../ai';

const KINDS = new Set(['remove', 'swap']);

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = String(body.text ?? '').trim();
    if (!KINDS.has(body.kind) || !text) return Response.json({ error: 'bad_request' }, { status: 400 });
    if (await isAdmin()) return new Response(null, { status: 204 });
    const { code } = await checkCode(body.code, clientIp(request));
    await logDropped({ code, kind: body.kind, text });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
