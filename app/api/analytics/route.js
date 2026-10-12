// Read-only export of the anonymous, aggregate counters written by
// /api/track — sessions (total/new/returning/by day/by language), card views
// (by question, by category, by category-within-language, by filter mode),
// shares (by question, by category), how many new devices came back, and
// how far people got in /create. Owner session only
// (lib/adminAuth.js); backs the /insights page.
//
// Pass ?range=7 / 30 / 90 / max (default: max) to scope everything except the
// sessions-per-day chart — that one always comes back in full so a caller can
// slice it however it wants — to that many trailing days.

import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import { adminOnly } from '@/lib/adminAuth';

// Every source hash stores fields as "<date>|<rest>". This splits on the
// first "|", keeps only fields whose date falls in `dateSet` (null = keep
// everything), and sums values into buckets keyed by whatever `keyFn` turns
// the remainder into.
function sumByField(hash, dateSet, keyFn) {
  const out = {};
  for (const [field, val] of Object.entries(hash || {})) {
    const sep = field.indexOf('|');
    if (sep === -1) continue;
    const date = field.slice(0, sep);
    if (dateSet && !dateSet.has(date)) continue;
    const bucketKey = keyFn(field.slice(sep + 1));
    out[bucketKey] = (out[bucketKey] || 0) + (Number(val) || 0);
  }
  return out;
}

// null = no date filtering (the "max" / since-launch case).
function dateSetForRange(rangeParam) {
  if (rangeParam === 'max') return null;
  const n = Number(rangeParam);
  if (!Number.isInteger(n) || n <= 0) return null;
  const set = new Set();
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() - i);
    set.add(d.toISOString().slice(0, 10));
  }
  return set;
}

const CREATE_STEPS = ['open', 'code', 'idea', 'deck', 'play', 'finish'];
const DAY_MS = 24 * 60 * 60 * 1000;
const addDays = (iso, n) => new Date(Date.parse(iso) + n * DAY_MS).toISOString().slice(0, 10);

// /create steps: how many devices reached each one in the range, and how
// many wrote two decks or more. Fields are "<date>|<device>" (app/api/track).
async function createFunnel(dateSet, owners) {
  const hashes = await Promise.all(CREATE_STEPS.map((step) => kv.hgetall(`tralala:analytics:create:${step}`)));
  const steps = {};
  let twoDecks = 0;
  let decksWritten = 0;
  CREATE_STEPS.forEach((step, i) => {
    const perDevice = {};
    for (const [field, val] of Object.entries(hashes[i] || {})) {
      const sep = field.indexOf('|');
      const date = field.slice(0, sep);
      const device = field.slice(sep + 1);
      if (sep === -1 || (dateSet && !dateSet.has(date)) || owners.has(device)) continue;
      perDevice[device] = (perDevice[device] || 0) + (Number(val) || 0);
    }
    steps[step] = Object.keys(perDevice).length;
    if (step === 'deck') {
      twoDecks = Object.values(perDevice).filter((n) => n >= 2).length;
      decksWritten = Object.values(perDevice).reduce((a, b) => a + b, 0);
    }
  });
  return { steps, twoDecks, decksWritten };
}

// What the written decks were like (size, language, 18+) and how people
// treated the cards: ↻ swaps, ✕ removals, cards played from their own decks.
async function createMix(dateSet) {
  const [decks, cards] = await Promise.all([
    kv.hgetall('tralala:analytics:createdeck'),
    kv.hgetall('tralala:analytics:createcards'),
  ]);
  const mix = { size: {}, lang: {}, adult: {} };
  for (const [field, val] of Object.entries(decks || {})) {
    const [date, kind, value] = field.split('|');
    if (!mix[kind] || (dateSet && !dateSet.has(date))) continue;
    mix[kind][value] = (mix[kind][value] || 0) + (Number(val) || 0);
  }
  return { ...mix, cards: sumByField(cards, dateSet, (rest) => rest) }; // cards: { swap, remove, card }
}

// Per deck: how many people played it and how many cards they saw (counted
// from 2026-10-12), for all languages and per language. Fields are
// "<date>|<deck>|<lang>|<device>" (app/api/track).
async function deckPeople(dateSet, owners) {
  const hash = (await kv.hgetall('tralala:analytics:deckpeople')) || {};
  const all = {};
  const byLang = {};
  const add = (bucket, deck, device, n) => {
    const row = (bucket[deck] ||= { devices: new Set(), cards: 0 });
    row.devices.add(device);
    row.cards += n;
  };
  for (const [field, val] of Object.entries(hash)) {
    const [date, deck, lang, ...rest] = field.split('|');
    const device = rest.join('|');
    if (!device || (dateSet && !dateSet.has(date)) || owners.has(device)) continue;
    const n = Number(val) || 0;
    add(all, deck, device, n);
    if (lang !== '-') add((byLang[lang] ||= {}), deck, device, n);
  }
  const flat = (bucket) => Object.fromEntries(
    Object.entries(bucket).map(([deck, r]) => [deck, { people: r.devices.size, cards: r.cards }])
  );
  return { all: flat(all), byLang: Object.fromEntries(Object.entries(byLang).map(([l, b]) => [l, flat(b)])) };
}

// People (devices) by kind of device in the range: { ios, android, computer }.
async function platforms(dateSet, owners) {
  const hash = (await kv.hgetall('tralala:analytics:platform')) || {};
  const seen = {};
  for (const field of Object.keys(hash)) {
    const [date, platform, ...rest] = field.split('|');
    const device = rest.join('|');
    if (!device || (dateSet && !dateSet.has(date)) || owners.has(device)) continue;
    (seen[platform] ||= new Set()).add(device);
  }
  return Object.fromEntries(Object.entries(seen).map(([k, v]) => [k, v.size]));
}

// Devices that used a feature in the range, and how many times.
async function features(dateSet, owners) {
  const names = ['tv', 'share'];
  const hashes = await Promise.all(names.map((n) => kv.hgetall(`tralala:analytics:feature:${n}`)));
  const out = {};
  names.forEach((name, i) => {
    const devices = new Set();
    let times = 0;
    for (const [field, val] of Object.entries(hashes[i] || {})) {
      const sep = field.indexOf('|');
      const device = field.slice(sep + 1);
      if (sep === -1 || (dateSet && !dateSet.has(field.slice(0, sep))) || owners.has(device)) continue;
      devices.add(device);
      times += Number(val) || 0;
    }
    out[name] = { people: devices.size, times };
  });
  return out;
}

// Of the devices first seen in the range, how many opened the game again the
// next day, and within 7 days. Only days that are fully over count, and only
// devices first seen from 2026-10-12 (when first-seen dates started).
async function comeback(dateSet, owners) {
  const today = new Date().toISOString().slice(0, 10);
  const firstSeen = Object.entries((await kv.hgetall('tralala:analytics:firstseen')) || {})
    .filter(([device, day]) => !owners.has(device) && (!dateSet || dateSet.has(day)) && day < today);
  const days = new Set();
  for (const [, day] of firstSeen) for (let i = 1; i <= 7; i++) days.add(addDays(day, i));
  const list = [...days].filter((d) => d < today);
  const sets = await Promise.all(list.map((d) => kv.smembers(`tralala:analytics:active:${d}`)));
  const active = Object.fromEntries(list.map((d, i) => [d, new Set(sets[i] || [])]));
  const seen = (device, day) => active[day]?.has(device);
  const out = { nextDay: { of: 0, back: 0 }, week: { of: 0, back: 0 } };
  for (const [device, day] of firstSeen) {
    if (addDays(day, 1) < today) {
      out.nextDay.of += 1;
      if (seen(device, addDays(day, 1))) out.nextDay.back += 1;
    }
    if (addDays(day, 7) < today) {
      out.week.of += 1;
      if ([1, 2, 3, 4, 5, 6, 7].some((i) => seen(device, addDays(day, i)))) out.week.back += 1;
    }
  }
  return out;
}

export async function GET(request) {
  const denied = await adminOnly();
  if (denied) return denied;
  const { searchParams } = new URL(request.url);

  const rangeParam = searchParams.get('range') || 'max';
  const dateSet = dateSetForRange(rangeParam);

  const [
    sessionsByDay,
    sessionsByKindDay,
    sessionsByLangDay,
    viewsByQuestionDay,
    viewsByCategoryDay,
    viewsByCatLangDay,
    viewsByFilterModeDay,
    sharesByQuestionDay,
    sharesByCategoryDay,
  ] = await Promise.all([
    kv.hgetall('tralala:analytics:sessions:byday'),
    kv.hgetall('tralala:analytics:sessions:bykindday'),
    kv.hgetall('tralala:analytics:sessions:bylangday'),
    kv.hgetall('tralala:analytics:views:byquestionday'),
    kv.hgetall('tralala:analytics:views:bycategoryday'),
    kv.hgetall('tralala:analytics:views:bycatlangday'),
    kv.hgetall('tralala:analytics:views:byfiltermodeday'),
    kv.hgetall('tralala:analytics:shares:byquestionday'),
    kv.hgetall('tralala:analytics:shares:bycategoryday'),
  ]);

  const kind = sumByField(sessionsByKindDay, dateSet, (rest) => rest); // { new, returning }
  const owners = new Set((await kv.smembers('tralala:analytics:owners')) || []);
  const [create, retention, mix, used, decks, devices] = await Promise.all([
    createFunnel(dateSet, owners),
    comeback(dateSet, owners),
    createMix(dateSet),
    features(dateSet, owners),
    deckPeople(dateSet, owners),
    platforms(dateSet, owners),
  ]);

  // "<date>|<category>|<lang>" has two "|"s, so it needs its own pass rather
  // than the single-split sumByField helper.
  const byCategoryByLang = {};
  for (const [field, val] of Object.entries(viewsByCatLangDay || {})) {
    const [date, category, lang] = field.split('|');
    if (!date || !category || !lang) continue;
    if (dateSet && !dateSet.has(date)) continue;
    byCategoryByLang[lang] = byCategoryByLang[lang] || {};
    byCategoryByLang[lang][category] = (byCategoryByLang[lang][category] || 0) + (Number(val) || 0);
  }

  return NextResponse.json({
    range: rangeParam,
    sessions: {
      total: (kind.new || 0) + (kind.returning || 0),
      new: kind.new || 0,
      returning: kind.returning || 0,
      byDay: sessionsByDay || {}, // full history, unfiltered — for the chart
      byLang: sumByField(sessionsByLangDay, dateSet, (rest) => rest),
    },
    views: {
      byQuestion: sumByField(viewsByQuestionDay, dateSet, (rest) => rest),
      byCategory: sumByField(viewsByCategoryDay, dateSet, (rest) => rest),
      byCategoryByLang,
      byFilterMode: sumByField(viewsByFilterModeDay, dateSet, (rest) => rest), // { all, narrowed }
    },
    shares: {
      byQuestion: sumByField(sharesByQuestionDay, dateSet, (rest) => rest),
      byCategory: sumByField(sharesByCategoryDay, dateSet, (rest) => rest),
    },
    retention, // { nextDay: { of, back }, week: { of, back } }
    create: { ...create, mix }, // { steps, twoDecks, decksWritten, mix: { size, lang, adult, cards } }
    features: used, // { tv: { people, times }, share: { people, times } }
    devices, // people by kind of device: { ios, android, computer }
    decks, // { all: { deck: { people, cards } }, byLang: { lang: { deck: { people, cards } } } }
  });
}
