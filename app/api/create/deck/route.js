// Step 3 of /create: write the whole deck (15-50 cards) plus a short name
// and one emoji for it.
// Streams newline-delimited JSON so the page can show each card as soon as
// the model finishes it:
//   {"type":"deck","id":"...","left":4}         (promo code only: deck id for
//                                                ↻, decks left on the code)
//   {"type":"name","name":"..."}
//   {"type":"icon","icon":"🎂"}               (may be missing if the model
//                                                didn't give a real emoji)
//   {"type":"card","text":"...","level":2}      (one per card)
//   {"type":"fix","from":"...","text":"..."}    (code checks found a problem
//                                                and the card was rewritten)
//   {"type":"done","meta":{...}}  or  {"type":"error","error":"...","message":"..."}
// Plus an empty line every few seconds, so phones and proxies don't drop the
// connection while the model is still thinking and nothing else is sent.

import { streamJson, gate, clip, errorInfo } from '../ai';
import { cardRules, checkCards, fixCards } from '../rules';
import { logDeck, logProblem, takeGeneration } from '../codes';

export const maxDuration = 300;
const KEEPALIVE_MS = 5000;

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    icon: { type: 'string' },
    cards: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          text: { type: 'string' },
          level: { type: 'integer', enum: [1, 2, 3] },
        },
        required: ['text', 'level'],
        additionalProperties: false,
      },
    },
  },
  required: ['name', 'icon', 'cards'],
  additionalProperties: false,
};

// Finished pieces inside a partial JSON answer. The schema fixes the key
// order, so a card is complete once its closing brace has arrived.
const STR = '"((?:[^"\\\\]|\\\\.)*)"';
const NAME_RE = new RegExp(`"name"\\s*:\\s*${STR}`);
const ICON_RE = new RegExp(`"icon"\\s*:\\s*${STR}`);
const CARD_RE = new RegExp(`\\{\\s*"text"\\s*:\\s*${STR}\\s*,\\s*"level"\\s*:\\s*([123])\\s*\\}`, 'g');
const unquote = (raw) => JSON.parse(`"${raw}"`);

// The first emoji in the model's answer (keeps skin tones and joined emoji
// like 👨‍👩‍👧 whole), or '' if there is none.
const EMOJI_RE = /\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\p{Emoji_Modifier})?)*/u;
const firstEmoji = (text) => (String(text ?? '').match(EMOJI_RE) || [''])[0];

export async function POST(request) {
  // One deck = one generation on the promo code, taken up front.
  const { body, access, response } = await gate(request, ({ code, ip }, b) => takeGeneration(code, ip, b.adult === true));
  if (response) return response;

  const brief = clip(body.brief, 800);
  const deckLang = clip(body.deckLang, 40) || 'English';
  const count = Math.min(50, Math.max(15, Number(body.count) || 15));
  // On a code, 18+ only if clarify offered it (see codes.js).
  const adult = access.admin ? body.adult === true : access.adult;
  const answers = (Array.isArray(body.answers) ? body.answers : [])
    .slice(0, 5)
    .map((a) => `- ${clip(a.question, 120)} → ${clip(a.answer, 60)}`)
    .join('\n');

  const prompt = `Write a deck of exactly ${count} cards in ${deckLang} for this occasion:
<brief>
${brief}
</brief>
${answers ? `\nThe organiser's answers:\n<answers>\n${answers}\n</answers>\n` : ''}
Before answering, quietly draft about 1.5 times as many candidates, drop any that break the rules (generic, too long, duplicate angle, fits any deck, chatbot words${/lithuan|lietuv/i.test(deckLang) ? ', gendered forms' : ''}), and keep the best ${count} in warm-up order.

Also give the deck a name in ${deckLang}, in the style of the game's own decks:
- 1-4 words. No quotes, no emoji, no exclamation mark, no dashes.
- It hints at the mood instead of describing the content: never the words "questions", "cards" or "deck", and never the occasion word for word ("Mom's 60th Questions" is bad).
- Pick one shape: an everyday phrase, sign or button given a new meaning (Do Not Disturb, Add to Cart, Lights Off); a moment or scene (3AM, First Snow, The Wrong Door); an idiom (Double Trouble); a small absurd image (The Appliance Union, Cold Fries).
- It makes sense at first sight: no pun that needs explaining, no slogan, nothing cheesy.
- In a language other than English, use that language's own phrase or idiom, not a translated English one (Cold Fries is "Skonio reikalas" in Lithuanian and "Kłótnie o pietruszkę" in Polish; Double Trouble is "Topf & Deckel" in German).
- The guest of honour's first name may appear in it if the organiser gave one.

And pick one emoji for the deck as "icon": a concrete object or symbol that fits the name or the occasion (like 🔕 for Do Not Disturb, 🍟 for Cold Fries, 🚪 for The Wrong Door). Avoid faces and hearts unless nothing else fits.`;

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj) => controller.enqueue(enc.encode(`${JSON.stringify(obj)}\n`));
      const ping = setInterval(() => {
        try { controller.enqueue(enc.encode('\n')); } catch { /* stream closed */ }
      }, KEEPALIVE_MS);
      let nameSent = false;
      let deckName = '';
      let iconSent = false;
      let deckIcon = '';
      let sent = 0;
      const started = Date.now();
      let firstCardMs = null;
      let ok = false;
      let meta = null;
      if (access.deckId) send({ type: 'deck', id: access.deckId, left: access.left });
      try {
        const system = cardRules(deckLang, { adult });
        const out = await streamJson({
          name: 'deck', model: body.model, effort: 'high', maxTokens: 64000,
          system, prompt, schema, signal: request.signal,
          onText: (soFar) => {
            if (!nameSent) {
              const n = soFar.match(NAME_RE);
              if (n) { deckName = clip(unquote(n[1]), 40); send({ type: 'name', name: deckName }); nameSent = true; }
            }
            if (!iconSent) {
              const ic = soFar.match(ICON_RE);
              if (ic) {
                deckIcon = firstEmoji(unquote(ic[1]));
                if (deckIcon) send({ type: 'icon', icon: deckIcon });
                iconSent = true;
              }
            }
            const cards = [...soFar.matchAll(CARD_RE)];
            if (firstCardMs == null && cards.length) firstCardMs = Date.now() - started;
            for (; sent < cards.length && sent < count; sent += 1) {
              send({ type: 'card', text: clip(unquote(cards[sent][1]), 200), level: Number(cards[sent][2]) });
            }
          },
        });
        const { text } = out;
        meta = out.meta;
        // Code checks on the finished deck; flagged cards get one small fix call.
        const texts = (JSON.parse(text).cards || []).slice(0, count).map((c) => clip(c.text, 200));
        const flagged = checkCards(texts, deckLang);
        if (flagged.length) {
          try {
            const fix = await fixCards({ texts, flagged, deckLang, brief, adult, model: body.model, signal: request.signal });
            fix.fixes.forEach(({ i, text: t }) => send({ type: 'fix', from: texts[i], text: t }));
            meta.cost = Math.round((meta.cost + fix.meta.cost) * 10000) / 10000;
            meta.ms += fix.meta.ms;
            meta.fixed = fix.fixes.length;
          } catch (err) {
            // The deck is already on screen; a failed fix just leaves it as is.
            if (request.signal.aborted) throw err;
            console.error('[create] fix failed', err);
          }
        }
        send({ type: 'done', meta });
        ok = true;
      } catch (err) {
        // A server-side failure before half the cards were written: the deck
        // doesn't count (the cards so far stay with the player). A deck the
        // player walked away from does (the AI call was already paid for).
        if (sent < count / 2 && !request.signal.aborted) await access.refund?.();
        const gone = request.signal.aborted;
        if (!gone) send({ type: 'error', ...errorInfo(err) });
        await logProblem({
          route: 'deck',
          kind: gone ? 'disconnected' : errorInfo(err).error,
          code: body.code,
          detail: `${sent}/${count} cards${gone ? '' : ` · ${err.message}`}`,
        });
      } finally {
        clearInterval(ping);
        await logDeck({
          code: access.admin ? null : body.code,
          name: deckIcon ? `${deckIcon} ${deckName}` : deckName,
          lang: deckLang,
          count,
          cards: sent,
          firstCardMs,
          totalMs: Date.now() - started,
          cost: meta?.cost,
          fixed: meta?.fixed,
          ok,
        });
        try { controller.close(); } catch { /* client already gone */ }
      }
    },
  });

  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
