'use client';

// Private analytics dashboard, rendered by ./page.jsx for the logged-in
// owner only (lib/adminAuth.js; reached from /admin). /api/analytics checks
// the same session cookie. See README "Admin".

import { useEffect, useMemo, useState } from 'react';
import { QUESTION_BY_ID, CATEGORIES, LANGUAGES } from '@/lib/content';
import { track } from '@/lib/analytics';

const CAT_COLOR = {
  future: '#407aea', dnd: '#407aea', deep: '#8a63de', night: '#8a63de', couples: '#b950b2', duo: '#b950b2', spicy: '#d3456c',
  awkward: '#d05500', union: '#a77900', fun: '#a77900', know: '#748d00', food: '#009c3f', door: '#009c3f',
  team: '#00a084', reply: '#00a084', firsts: '#0093cc', fries: '#a77900', lights: '#8a63de', cart: '#a77900', snow: '#407aea',
};
const LANG_COLOR = { en: '#5983e9', lt: '#d95960', es: '#af8200', pl: '#b365c4', de: '#25a351', it: '#0095db' };
const GOLD = '#e8c468';
const UNLOVED = 'rgba(232,230,225,.16)';
const INK = '#e8e6e1';

const RANGES = [
  { key: '7', label: '7D', days: 7 },
  { key: '30', label: '30D', days: 30 },
  { key: '90', label: '90D', days: 90 },
  { key: 'max', label: 'MAX', days: null },
];

const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmtDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${MONTH_SHORT[m - 1]} ${d}`;
}
function fmtNum(n) {
  return (n || 0).toLocaleString('en-US');
}

const CREATE_STEPS = [
  ['open', 'Opened /create'],
  ['code', 'Had a working code'],
  ['idea', 'Refined an idea'],
  ['deck', 'Got a deck'],
  ['play', 'Started playing'],
  ['finish', 'Played to the end'],
];

// When each deck went live (git history), so a new one isn't read as unpopular.
const DECK_ADDED = {
  union: '2026-09-29', night: '2026-09-29', reply: '2026-09-29', dnd: '2026-09-29', door: '2026-09-29',
  fries: '2026-09-29', duo: '2026-09-29', lights: '2026-10-11', cart: '2026-10-11', snow: '2026-10-11',
};
const NEW_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

const MIN_VOTES = 3; // a question needs at least this many ⭐+✕ before it shows up in Most saved / Often left on

export default function InsightsDashboard() {
  const [range, setRange] = useState('30');
  const [activeLang, setActiveLang] = useState('all');
  const [data, setData] = useState(null);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');
  const [hoverIdx, setHoverIdx] = useState(null);

  // Opening this page marks the device as the owner's, so it isn't counted.
  useEffect(() => { track('owner'); }, []);

  useEffect(() => {
    setError('');
    Promise.all([
      fetch(`/api/analytics?range=${range}`).then((res) => {
        if (!res.ok) throw new Error(String(res.status));
        return res.json();
      }),
      fetch('/api/stats').then((res) => (res.ok ? res.json() : {})),
    ])
      .then(([analytics, statsData]) => {
        setData(analytics);
        setStats(statsData);
      })
      .catch(() => setError('Logged out, or the analytics backend is unavailable.'));
  }, [range]);

  const sessionsTotal = data?.sessions?.total || 0;
  const returning = data?.sessions?.returning || 0;
  const newSessions = data?.sessions?.new || 0;
  const returningPct = sessionsTotal ? Math.round((returning / sessionsTotal) * 100) : 0;
  const newPct = 100 - returningPct;

  const languageRows = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.sessions.byLang || {}).sort(([, a], [, b]) => b - a);
    const total = entries.reduce((s, [, n]) => s + n, 0) || 1;
    // Round every row normally except the last, which gets whatever
    // percentage is left over — keeps the column always summing to exactly
    // 100% instead of drifting a point or two from independent rounding.
    let remaining = 100;
    return entries.map(([code, count], i) => {
      const pct = i === entries.length - 1 ? remaining : Math.round((count / total) * 100);
      remaining -= pct;
      return { code, count, pct, name: LANGUAGES.find((l) => l.code === code)?.name || code };
    });
  }, [data]);

  // New devices that opened the game again (from /api/analytics).
  const backPct = (r) => (r?.of ? `${Math.round((r.back / r.of) * 100)}%` : '—');
  const retention = data?.retention;

  // /create: how many people reached each step, as a share of those who opened it.
  const createRows = useMemo(() => {
    const steps = data?.create?.steps;
    if (!steps) return [];
    const base = steps.open || 0;
    return CREATE_STEPS.map(([id, label]) => ({
      id,
      label,
      n: steps[id] || 0,
      pct: base ? Math.round(((steps[id] || 0) / base) * 100) : 0,
    }));
  }, [data]);

  // What the written decks were like, as rows for a small bar list.
  const mix = data?.create?.mix;
  const mixRows = (counts, sortBy, label) => {
    const entries = Object.entries(counts || {});
    const total = entries.reduce((a, [, n]) => a + n, 0) || 1;
    return entries
      .sort(sortBy)
      .map(([k, n]) => ({ k, label: label(k), n, pct: Math.round((n / total) * 100) }));
  };
  const DEVICE_LABEL = { ios: ['iPhone', '#e8e6e1'] /* iPads too */, android: ['Android', '#25a351'], computer: ['Computer', '#5983e9'] };
  const deviceRows = mixRows(data?.devices, ([, a], [, b]) => b - a, (k) => DEVICE_LABEL[k]?.[0] || k)
    .map((r) => ({ ...r, color: DEVICE_LABEL[r.k]?.[1] || INK }));
  const sizeRows = mixRows(mix?.size, ([a], [b]) => Number(a) - Number(b), (k) => `${k} cards`);
  const langRows = mixRows(mix?.lang, ([, a], [, b]) => b - a, (k) => (k === 'other' ? 'Other' : k.toUpperCase()));
  const adultDecks = mix?.adult?.['1'] || 0;
  const mixDecks = adultDecks + (mix?.adult?.['0'] || 0);
  const decksWritten = data?.create?.decksWritten || 0;
  const perDeck = (n) => (decksWritten ? (n / decksWritten).toFixed(1) : '—');

  // Cards played: the game's built-in decks vs people's own /create decks.
  const ownCards = mix?.cards?.card || 0;
  const builtInCards = Object.values(data?.views?.byCategory || {}).reduce((a, b) => a + b, 0);
  const ownPct = ownCards + builtInCards ? Math.round((ownCards / (ownCards + builtInCards)) * 100) : 0;

  const categoryShare = useMemo(() => {
    if (!data) return {};
    return activeLang === 'all' ? data.views?.byCategory || {} : data.views?.byCategoryByLang?.[activeLang] || {};
  }, [data, activeLang]);

  // Deck popularity: people who played each deck (from Oct 12), cards seen,
  // cards per person, and the saved share of its ⭐/✕. Decks no longer in the
  // game are folded into one "Old decks" row at the bottom.
  const deckRows = useMemo(() => {
    const people = (activeLang === 'all' ? data?.decks?.all : data?.decks?.byLang?.[activeLang]) || {};
    const votes = {};
    for (const [qid, v] of Object.entries(stats || {})) {
      const deck = QUESTION_BY_ID.get(qid)?.[0];
      if (!deck || v?.like == null) continue;
      const t = (votes[deck] ||= { like: 0, down: 0 });
      t.like += v.like || 0;
      t.down += v.down || 0;
    }
    const row = (id) => {
      const p = people[id] || { people: 0, cards: 0 };
      const v = votes[id];
      const voted = v ? v.like + v.down : 0;
      return {
        people: p.people,
        cards: categoryShare[id] || 0,
        depth: p.people ? p.cards / p.people : null,
        love: voted >= MIN_VOTES ? Math.round((v.like / voted) * 100) : null,
      };
    };
    const live = CATEGORIES.map((cat) => ({
      id: cat.id,
      icon: cat.icon,
      name: cat.names.en,
      note: cat.note,
      added: DECK_ADDED[cat.id],
      color: CAT_COLOR[cat.id] || INK,
      ...row(cat.id),
    })).sort((a, b) => b.people - a.people || b.cards - a.cards);
    const liveIds = new Set(CATEGORIES.map((c) => c.id));
    const oldIds = [...new Set([...Object.keys(categoryShare), ...Object.keys(people)])].filter((id) => !liveIds.has(id));
    if (oldIds.length) {
      const old = oldIds.map(row);
      live.push({
        id: 'old',
        icon: '·',
        name: 'Old decks',
        old: true,
        color: UNLOVED,
        people: old.reduce((a, r) => a + r.people, 0),
        cards: old.reduce((a, r) => a + r.cards, 0),
        depth: null,
        love: null,
      });
    }
    return live;
  }, [data, stats, activeLang, categoryShare]);
  // Bars follow people once they're counted; until then, cards.
  const byPeople = deckRows.some((r) => r.people > 0);
  const deckMax = Math.max(1, ...deckRows.map((r) => (byPeople ? r.people : r.cards)));

  const sessionsForCps = activeLang === 'all' ? sessionsTotal : data?.sessions?.byLang?.[activeLang] || 0;
  const viewsForCps = Object.values(categoryShare).reduce((s, n) => s + n, 0);
  const cps = sessionsForCps ? (viewsForCps / sessionsForCps).toFixed(1) : '—';

  const mostSeen = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.views?.byQuestion || {})
      .map(([qid, count]) => ({ qid, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [data]);

  const votedQuestions = useMemo(() => {
    if (!stats) return [];
    return Object.entries(stats)
      .map(([qid, s]) => ({ qid, ...s, total: (s.like || 0) + (s.down || 0) }))
      .filter((q) => q.total >= MIN_VOTES && q.percent != null);
  }, [stats]);
  const mostLoved = useMemo(() => [...votedQuestions].sort((a, b) => b.percent - a.percent).slice(0, 6), [votedQuestions]);
  const leastLoved = useMemo(() => [...votedQuestions].sort((a, b) => a.percent - b.percent).slice(0, 6), [votedQuestions]);

  const chartDays = useMemo(() => {
    if (!data) return [];
    const entries = Object.entries(data.sessions.byDay || {}).sort(([a], [b]) => (a < b ? -1 : 1));
    const rangeMeta = RANGES.find((r) => r.key === range);
    const sliced = rangeMeta?.days ? entries.slice(-rangeMeta.days) : entries;
    return sliced.map(([date, count]) => ({ date, count }));
  }, [data, range]);
  const chartMax = Math.max(1, ...chartDays.map((d) => d.count));
  // Round step for the 4 gridline intervals, so the y-axis reads 0/10/20/30/40.
  const chartStep = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => s * 4 >= chartMax * 1.05) || Math.ceil(chartMax / 4);

  const questionText = (qid) => QUESTION_BY_ID.get(qid)?.[2]?.en || '(deleted question)';
  const questionCat = (qid) => CATEGORIES.find((c) => c.id === QUESTION_BY_ID.get(qid)?.[0]);

  return (
    <main style={S.page}>
      <div style={S.head}>
        <div className="serif" style={S.wordmark}>
          Tra<i style={{ fontStyle: 'italic' }}>lala</i>.cards
        </div>
        <div style={S.eyebrow}>PRIVATE ANALYTICS</div>
      </div>

      {error && <p style={S.muted}>{error}</p>}

      {data && (
        <>
          <div style={S.chipRow}>
            {RANGES.map((r) => (
              <button key={r.key} onClick={() => setRange(r.key)} style={r.key === range ? S.chipActive : S.chip}>
                {r.label}
              </button>
            ))}
          </div>

          <div style={S.tiles}>
            <Tile label="GAMES STARTED" value={fmtNum(sessionsTotal)} sub={`START presses · ${RANGES.find((r) => r.key === range)?.label}`} />
            <Tile label="FROM A KNOWN DEVICE" value={`${returningPct}%`} sub={`${fmtNum(returning)} of ${fmtNum(sessionsTotal)} starts, not people`} />
            <Tile label="CARDS / START" value={cps} sub={activeLang === 'all' ? 'cards seen per START press' : `cards per START — ${LANGUAGES.find((l) => l.code === activeLang)?.name}`} />
            <Tile
              label="NEW PEOPLE CAME BACK"
              value={backPct(retention?.nextDay)}
              sub={retention?.nextDay?.of
                ? `next day · ${backPct(retention.week)} within 7 days (of ${fmtNum(retention.nextDay.of)} new)`
                : 'counting from Oct 12'}
            />
          </div>

          <Section title="GAMES STARTED OVER TIME" sub="START presses, by day. Pressing START again counts again; /create visits don't count.">
            {chartDays.length === 0 ? (
              <p style={S.muted}>No visits recorded yet for this window.</p>
            ) : (
              <div style={S.chartWrap}>
                {(() => {
                  const stepX = chartDays.length > 1 ? 872 / (chartDays.length - 1) : 0;
                  const yAt = (v) => 4 + 176 - (v / (chartStep * 4)) * 176;
                  let line = '';
                  chartDays.forEach((d, i) => {
                    const x = i * stepX, y = yAt(d.count);
                    line += `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)} `;
                  });
                  const area = `M0,180 L${line.slice(1)}L${((chartDays.length - 1) * stepX).toFixed(1)},180 Z`;
                  const hovered = hoverIdx != null ? chartDays[hoverIdx] : null;
                  // The SVG stretches (preserveAspectRatio="none"), so HTML labels
                  // are placed by percent of the viewBox instead of inside it.
                  const xPct = hovered ? (hoverIdx * stepX / 872) * 100 : 0;
                  const pickDay = (e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setHoverIdx(Math.max(0, Math.min(chartDays.length - 1, Math.round(((e.clientX - rect.left) / rect.width) * (chartDays.length - 1)))));
                  };
                  return (
                    <>
                      <div style={S.plot}>
                        {[0, 1, 2, 3, 4].map((t) => (
                          <span key={t} style={{ ...S.yTick, top: `${((4 + 44 * t) / 200) * 100}%` }}>{fmtNum(chartStep * (4 - t))}</span>
                        ))}
                        <svg viewBox="0 0 872 200" preserveAspectRatio="none" style={{ ...S.svg, touchAction: 'pan-y' }}>
                          {[0, 1, 2, 3, 4].map((t) => (
                            <line key={t} x1="0" x2="872" y1={4 + 44 * t} y2={4 + 44 * t} stroke="rgba(232,230,225,.08)" strokeWidth="1" />
                          ))}
                          <path d={area} fill={INK} opacity="0.14" stroke="none" />
                          <path d={line.trim()} fill="none" stroke={INK} strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
                          {hovered && (
                            <>
                              <line x1={hoverIdx * stepX} x2={hoverIdx * stepX} y1="4" y2="180" stroke="rgba(232,230,225,.42)" strokeDasharray="2,3" />
                              <circle cx={hoverIdx * stepX} cy={yAt(hovered.count)} r="4" fill={INK} stroke="#0c0c0d" strokeWidth="2" />
                            </>
                          )}
                          <rect
                            x="0" y="0" width="872" height="180" fill="transparent"
                            onPointerDown={pickDay}
                            onPointerMove={pickDay}
                            onPointerLeave={(e) => { if (e.pointerType === 'mouse') setHoverIdx(null); }}
                          />
                        </svg>
                        {hovered && (
                          <div style={{
                            ...S.tip,
                            left: `calc(${S.plot.paddingLeft}px + (100% - ${S.plot.paddingLeft}px) * ${xPct / 100})`,
                            top: `${(yAt(hovered.count) / 200) * 100}%`,
                            transform: `translate(${xPct < 12 ? '-12px' : xPct > 88 ? 'calc(-100% + 12px)' : '-50%'}, calc(-100% - 10px))`,
                          }}>
                            <b style={S.tipNum}>{fmtNum(hovered.count)}</b> {hovered.count === 1 ? 'start' : 'starts'} · {fmtDate(hovered.date)}
                          </div>
                        )}
                      </div>
                      <div style={{ ...S.axisRow, paddingLeft: S.plot.paddingLeft }}>
                        <span>{fmtDate(chartDays[0].date)}</span>
                        <span>{fmtDate(chartDays[chartDays.length - 1].date)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}
          </Section>

          <div style={S.grid2}>
            <div style={S.panel}>
              <div style={S.sectionTitle}>STARTS: NEW VS KNOWN DEVICE</div>
              <div style={S.splitBar}>
                <span style={{ width: `${newPct}%`, background: INK }} />
                <span style={{ width: `${returningPct}%`, background: UNLOVED }} />
              </div>
              <LegendRow color={INK} label="First start on a device" value={`${fmtNum(newSessions)} `} sub={`${newPct}%`} />
              <LegendRow color={UNLOVED} label="Device seen before" value={`${fmtNum(returning)} `} sub={`${returningPct}%`} />
            </div>
            <div style={S.panel}>
              <div style={S.sectionTitle}>LANGUAGES</div>
              {languageRows.length === 0 && <p style={S.muted}>No data yet.</p>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 11, marginTop: 18 }}>
                {languageRows.map((l) => (
                  <BarRow key={l.code} name={l.name} pct={l.pct} widthPct={l.pct} value={`${fmtNum(l.count)} ${l.pct}%`} color={LANG_COLOR[l.code] || INK} />
                ))}
              </div>
            </div>
          </div>

          <Section title="DEVICES" sub="People (devices) by what they play on, game and /create. Counting from Oct 12.">
            <div style={S.card}>
              {deviceRows.length === 0 ? (
                <p style={S.muted}>No data yet in this window.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {deviceRows.map((r) => (
                    <BarRow key={r.k} name={r.label} widthPct={r.pct} value={`${fmtNum(r.n)} ${r.pct}%`} color={r.color} />
                  ))}
                </div>
              )}
            </div>
          </Section>

          <Section title="MAKE YOUR OWN CARDS" sub="People (devices) who reached each step of /create, out of those who opened it">
            <div style={S.card}>
              {createRows[0]?.n ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {createRows.map((r) => (
                      <div key={r.id} style={S.funnelRow}>
                        <span style={S.barRowName}>{r.label}</span>
                        <span style={S.barTrack}>
                          <span style={{ ...S.barFill, width: `${r.pct}%`, background: '#d3456c' }} />
                        </span>
                        <span style={S.barVal}>{fmtNum(r.n)} · {r.pct}%</span>
                      </div>
                    ))}
                  </div>
                  <div style={S.hr} />
                  <LegendRow
                    color={GOLD}
                    label="Wrote 2 or more decks"
                    value={`${fmtNum(data.create.twoDecks)} `}
                    sub={`of ${fmtNum(data.create.steps.deck)} who got a deck`}
                  />
                  <div style={S.hr} />
                  <div style={S.miniLabel}>CARD QUALITY — WHILE MAKING A DECK</div>
                  <LegendRow color="#d3456c" label="↻ swapped, per deck" value={`${perDeck(mix?.cards?.swap || 0)} `} sub={`${fmtNum(mix?.cards?.swap)} in all`} />
                  <LegendRow color="#d3456c" label="✕ removed, per deck" value={`${perDeck(mix?.cards?.remove || 0)} `} sub={`${fmtNum(mix?.cards?.remove)} in all`} />
                  {mixDecks > 0 && (
                    <>
                      <div style={S.hr} />
                      <div style={S.grid2Plain}>
                        <div>
                          <div style={S.miniLabel}>DECK SIZE</div>
                          <div style={S.mixList}>
                            {sizeRows.map((r) => (
                              <BarRow key={r.k} name={r.label} widthPct={r.pct} value={`${fmtNum(r.n)} ${r.pct}%`} color={GOLD} />
                            ))}
                          </div>
                        </div>
                        <div>
                          <div style={S.miniLabel}>DECK LANGUAGE</div>
                          <div style={S.mixList}>
                            {langRows.map((r) => (
                              <BarRow key={r.k} name={r.label} widthPct={r.pct} value={`${fmtNum(r.n)} ${r.pct}%`} color={LANG_COLOR[r.k] || INK} />
                            ))}
                          </div>
                        </div>
                      </div>
                      <LegendRow color="#d3456c" label="18+ decks" value={`${fmtNum(adultDecks)} `} sub={`${Math.round((adultDecks / mixDecks) * 100)}%`} />
                    </>
                  )}
                </>
              ) : (
                <p style={S.muted}>No one has opened /create in this window yet (counting from Oct 12).</p>
              )}
            </div>
          </Section>

          <Section title="FEATURES" sub="People (devices) who used each one in this window">
            <div style={S.card}>
              <LegendRow color={INK} label="TV mode" value={`${fmtNum(data.features?.tv?.people)} people `} sub={`${fmtNum(data.features?.tv?.times)} times`} />
              <LegendRow color={INK} label="Shared a card" value={`${fmtNum(data.features?.share?.people)} people `} sub={`${fmtNum(data.features?.share?.times)} times`} />
              <div style={S.hr} />
              <div style={S.miniLabel}>CARDS PLAYED</div>
              <LegendRow color={INK} label="Built-in decks" value={`${fmtNum(builtInCards)} `} sub={`${100 - ownPct}%`} />
              <LegendRow color="#d3456c" label="Own decks (/create)" value={`${fmtNum(ownCards)} `} sub={`${ownPct}%`} />
              <p style={S.muted}>Counting TV, own-deck shares and own-deck cards from Oct 12.</p>
            </div>
          </Section>

          <Section
            title="DECKS"
            sub="Which decks people pick and stay with. Tap a language to see it there."
            right={
              <div style={S.chipRow}>
                <button onClick={() => setActiveLang('all')} style={activeLang === 'all' ? S.chipActive : S.chip}>ALL</button>
                {LANGUAGES.map((l) => (
                  <button key={l.code} onClick={() => setActiveLang(l.code)} style={activeLang === l.code ? S.chipActive : S.chip}>
                    {l.code.toUpperCase()}
                  </button>
                ))}
              </div>
            }
          >
            <div style={S.card}>
              <div style={{ ...S.deckRow, ...S.deckHead }}>
                <span />
                <span>DECK</span>
                <span />
                <span style={S.num}>PEOPLE</span>
                <span style={S.num}>CARDS</span>
                <span style={S.num}>PER PERSON</span>
                <span style={S.num}>SAVED</span>
              </div>
              {deckRows.map((d) => {
                const fresh = d.added && Date.now() - Date.parse(d.added) < NEW_DAYS * DAY_MS;
                return (
                  <div key={d.id} style={{ ...S.deckRow, opacity: d.old ? 0.5 : 1 }}>
                    <span style={S.catIcon}>{d.icon}</span>
                    <span style={S.catName}>
                      {d.name}
                      {d.note && <span style={S.catNote}> {d.note}</span>}
                      {fresh && <span style={S.newTag}> NEW · {fmtDate(d.added)}</span>}
                    </span>
                    <span style={S.barTrack}>
                      <span style={{ ...S.barFill, width: `${Math.round(((byPeople ? d.people : d.cards) / deckMax) * 100)}%`, background: d.color }} />
                    </span>
                    <span style={S.num}><b>{fmtNum(d.people)}</b></span>
                    <span style={S.num}>{fmtNum(d.cards)}</span>
                    <span style={S.num}>{d.depth == null ? '—' : d.depth.toFixed(1)}</span>
                    <span style={S.num}>{d.love == null ? '—' : `${d.love}%`}</span>
                  </div>
                );
              })}
              <p style={S.muted}>
                People and cards per person are counted from Oct 12. Saved = ⭐ saved vs ✕ left the deck on a card; all-time, all languages, needs {MIN_VOTES}+.
                A deck marked NEW has had less time to be found.
              </p>
            </div>
          </Section>

          <Section title="QUESTIONS" sub={`Saved % = ⭐ saved vs ✕ (which also leaves the deck, so it often just means "stopped here"). All-time, needs ${MIN_VOTES}+. Views follow the range above.`}>
            <div style={S.qGrid}>
              <QCol title="MOST SEEN" dotColor={INK}>
                {mostSeen.length === 0 && <p style={S.muted}>No views yet.</p>}
                {mostSeen.map((q, i) => (
                  <QItem key={q.qid} rank={i + 1} text={questionText(q.qid)} catColor={CAT_COLOR[questionCat(q.qid)?.id]} catName={questionCat(q.qid)?.names?.en} meta={`${fmtNum(q.count)} views`} />
                ))}
              </QCol>
              <QCol title="MOST SAVED ⭐" dotColor={GOLD}>
                {mostLoved.length === 0 && <p style={S.muted}>Not enough votes yet.</p>}
                {mostLoved.map((q, i) => (
                  <QItem key={q.qid} rank={i + 1} text={questionText(q.qid)} catColor={CAT_COLOR[questionCat(q.qid)?.id]} catName={questionCat(q.qid)?.names?.en} meta={`${q.percent}% saved · ${fmtNum(q.like)} ⭐`} />
                ))}
              </QCol>
              <QCol title="OFTEN LEFT ON ✕ — CHECK THESE" dotColor={UNLOVED}>
                {leastLoved.length === 0 && <p style={S.muted}>Not enough votes yet.</p>}
                {leastLoved.map((q, i) => (
                  <QItem key={q.qid} rank={i + 1} text={questionText(q.qid)} catColor={CAT_COLOR[questionCat(q.qid)?.id]} catName={questionCat(q.qid)?.names?.en} meta={`${fmtNum(q.down)} ✕ · ${q.percent}% saved`} />
                ))}
              </QCol>
            </div>
          </Section>

          <div style={S.footer}>
            Anonymous, aggregate-only — no personal data, nothing shared with a third party.
          </div>
        </>
      )}
    </main>
  );
}

function Tile({ label, value, sub }) {
  return (
    <div style={S.tile}>
      <div style={S.tileLabel}>{label}</div>
      <div className="serif" style={S.tileValue}>{value}</div>
      <div style={S.tileSub}>{sub}</div>
    </div>
  );
}

function Section({ title, sub, right, children }) {
  return (
    <section style={S.section}>
      <div style={S.sectionHead}>
        <div>
          <div style={S.sectionTitle}>{title}</div>
          {sub && <div style={S.muted}>{sub}</div>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

function LegendRow({ color, label, value, sub }) {
  return (
    <div style={S.legendRow}>
      <span style={S.legendKey}>
        <span style={{ ...S.swatch, background: color }} />
        {label}
      </span>
      <span style={S.legendVal}>
        {value}
        <span style={S.legendSub}>{sub}</span>
      </span>
    </div>
  );
}

function BarRow({ name, widthPct, value, color }) {
  return (
    <div style={S.barRow}>
      <span style={S.barRowName}>{name}</span>
      <span style={S.barTrack}>
        <span style={{ ...S.barFill, width: `${widthPct}%`, background: color }} />
      </span>
      <span style={S.barVal}>{value}</span>
    </div>
  );
}

function QCol({ title, dotColor, children }) {
  return (
    <div style={S.qCol}>
      <div style={S.qColHead}>
        <span style={{ ...S.qColDot, background: dotColor }} />
        <span style={S.qColTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function QItem({ rank, text, catColor, catName, meta }) {
  return (
    <div style={S.qItem}>
      <span style={S.qRank}>{String(rank).padStart(2, '0')}</span>
      <div style={{ minWidth: 0 }}>
        <div className="serif" style={S.qText}>{text}</div>
        <div style={S.qMeta}>
          <span style={{ ...S.qCatDot, background: catColor || INK }} />
          {catName} · <b style={{ color: 'rgba(232,230,225,.62)' }}>{meta}</b>
        </div>
      </div>
    </div>
  );
}

const mono = (size, weight = 500, tracking = '.08em') => ({
  font: `${weight} ${size}px var(--font-mono), monospace`,
  letterSpacing: tracking,
});

const S = {
  page: { minHeight: '100dvh', background: '#0c0c0d', color: INK, padding: '30px 20px 80px', maxWidth: 920, margin: '0 auto' },
  head: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, paddingBottom: 20, borderBottom: '1px solid rgba(232,230,225,.12)', flexWrap: 'wrap' },
  wordmark: { fontSize: 30, lineHeight: 1 },
  eyebrow: { ...mono(9, 600, '.18em'), color: 'rgba(232,230,225,.42)' },
  muted: { ...mono(11, 400, '.02em'), color: 'rgba(232,230,225,.4)', margin: '8px 0 0' },
  chipRow: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '6px 12px', borderRadius: 100, border: '1px solid rgba(232,230,225,.22)', background: 'transparent', color: 'rgba(232,230,225,.42)', cursor: 'pointer', ...mono(9, 500, '.1em') },
  chipActive: { padding: '6px 12px', borderRadius: 100, border: '1px solid #e8e6e1', background: '#e8e6e1', color: '#0c0c0d', cursor: 'pointer', ...mono(9, 500, '.1em') },
  tiles: { display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 1, background: 'rgba(232,230,225,.12)', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, overflow: 'hidden', marginTop: 20 },
  tile: { background: '#17151a', padding: '18px 16px' },
  tileLabel: { ...mono(9, 600, '.12em'), color: 'rgba(232,230,225,.42)' },
  tileValue: { marginTop: 8, fontSize: 30, lineHeight: 1 },
  tileSub: { marginTop: 6, ...mono(10, 400, '.02em'), color: 'rgba(232,230,225,.42)' },
  section: { marginTop: 36 },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 14, marginBottom: 14, flexWrap: 'wrap' },
  sectionTitle: { ...mono(10, 600, '.16em'), color: 'rgba(232,230,225,.62)' },
  card: { background: '#17151a', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, padding: '20px 20px 12px', overflowX: 'auto' },
  chartWrap: { background: '#17151a', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, padding: '18px 18px 12px' },
  svg: { display: 'block', width: '100%', height: 180 },
  plot: { position: 'relative', paddingLeft: 30 },
  yTick: { position: 'absolute', left: 0, width: 24, textAlign: 'right', transform: 'translateY(-50%)', ...mono(9, 400, '.04em'), color: 'rgba(232,230,225,.42)', pointerEvents: 'none' },
  tip: { position: 'absolute', whiteSpace: 'nowrap', pointerEvents: 'none', background: '#0c0c0d', border: '1px solid rgba(232,230,225,.22)', borderRadius: 4, padding: '4px 8px', ...mono(11, 400, '.02em'), color: 'rgba(232,230,225,.7)' },
  tipNum: { color: INK, fontWeight: 600 },
  axisRow: { display: 'flex', justifyContent: 'space-between', marginTop: 8, ...mono(9, 400, '.04em'), color: 'rgba(232,230,225,.42)' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 1, background: 'rgba(232,230,225,.12)', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, overflow: 'hidden', marginTop: 36 },
  panel: { background: '#17151a', padding: 20, overflowX: 'auto' },
  splitBar: { display: 'flex', height: 10, borderRadius: 100, overflow: 'hidden', marginTop: 14 },
  legendRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 12, ...mono(11, 400, '.01em') },
  legendKey: { display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, color: 'rgba(232,230,225,.62)' },
  swatch: { width: 8, height: 8, borderRadius: 2, flex: 'none' },
  legendVal: { flex: 'none', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums', color: INK, fontWeight: 600 },
  legendSub: { color: 'rgba(232,230,225,.42)', fontSize: 10, marginLeft: 4 },
  miniLabel: { ...mono(9, 600, '.1em'), color: 'rgba(232,230,225,.42)' },
  hr: { height: 1, background: 'rgba(232,230,225,.12)', margin: '18px 0' },
  deckRow: { display: 'grid', gridTemplateColumns: '24px minmax(150px, 1.4fr) minmax(60px, 1fr) 52px 52px 70px 44px', alignItems: 'center', gap: 10, padding: '5px 0', minWidth: 560 },
  deckHead: { ...mono(9, 600, '.1em'), color: 'rgba(232,230,225,.42)', paddingBottom: 8, borderBottom: '1px solid rgba(232,230,225,.12)', marginBottom: 6 },
  num: { fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap' },
  newTag: { color: '#e8c468', fontSize: 9, letterSpacing: '.06em' },
  catIcon: { fontSize: 14, textAlign: 'center' },
  catName: { fontSize: 11, color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap' },
  catNote: { color: 'rgba(232,230,225,.42)', fontSize: 9 },
  grid2Plain: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 24, marginBottom: 6 },
  mixList: { display: 'flex', flexDirection: 'column', gap: 9, marginTop: 12 },
  funnelRow: { display: 'grid', gridTemplateColumns: 'minmax(110px, 160px) 1fr 76px', alignItems: 'center', gap: 10 },
  barRow: { display: 'grid', gridTemplateColumns: '78px 1fr 76px', alignItems: 'center', gap: 10 },
  barRowName: { fontSize: 11, color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  barTrack: { position: 'relative', height: 14, background: '#1d1a20', borderRadius: 3, overflow: 'hidden' },
  barFill: { position: 'absolute', inset: '0 auto 0 0', borderRadius: 3 },
  barVal: { fontSize: 11, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'rgba(232,230,225,.62)', whiteSpace: 'nowrap' },
  qGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 1, background: 'rgba(232,230,225,.12)', border: '1px solid rgba(232,230,225,.12)', borderRadius: 6, overflow: 'hidden' },
  qCol: { background: '#17151a', padding: 16 },
  qColHead: { display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 },
  qColDot: { width: 6, height: 6, borderRadius: 100, flex: 'none' },
  qColTitle: { ...mono(9, 600, '.1em'), color: 'rgba(232,230,225,.62)' },
  qItem: { display: 'flex', gap: 10, padding: '10px 0', borderTop: '1px solid rgba(232,230,225,.12)' },
  qRank: { flex: 'none', width: 16, fontSize: 9, color: 'rgba(232,230,225,.3)', fontWeight: 600, paddingTop: 2, fontVariantNumeric: 'tabular-nums' },
  qText: { fontSize: 14, lineHeight: 1.3 },
  qMeta: { display: 'flex', alignItems: 'center', gap: 5, marginTop: 6, fontSize: 9, color: 'rgba(232,230,225,.42)' },
  qCatDot: { width: 5, height: 5, borderRadius: 100, flex: 'none' },
  footer: { marginTop: 40, paddingTop: 16, borderTop: '1px solid rgba(232,230,225,.12)', ...mono(10, 400, '.02em'), color: 'rgba(232,230,225,.3)' },
};
