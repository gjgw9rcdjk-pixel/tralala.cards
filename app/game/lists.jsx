'use client';

import { useMemo, useState } from 'react';
import { CATEGORIES, QUESTION_BY_ID } from '@/lib/content';
import { DECK_STYLE } from '@/lib/gameMeta';
import { cards, fmt } from '@/lib/gameStrings';

const catOf = (row) => CATEGORIES.find((c) => c.id === row[0]);
// Deck colour for a label on a dark row; the 18+ deck has no fill colour.
const labelColor = (catId) => DECK_STYLE[catId].color || 'var(--yellow)';

function ScreenHead({ title, sub, children }) {
  return (
    <div style={{ flex: 'none', padding: '8px 24px 14px' }}>
      <h2 className="tl-title">{title}</h2>
      {sub && <div className="tl-sub">{sub}</div>}
      {children}
    </div>
  );
}

// ── saved ───────────────────────────────────────────────────────────────

export function SavedScreen({ s, lang, saved, savedAt, onUnsave, onShare, onStart }) {
  const [filter, setFilter] = useState(null);
  const rows = saved.map((id) => QUESTION_BY_ID.get(id)).filter(Boolean);
  const cats = CATEGORIES.filter((c) => rows.some((r) => r[0] === c.id));
  const shown = filter ? rows.filter((r) => r[0] === filter) : rows;
  const dateFmt = useMemo(() => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric' }), [lang]);

  if (!rows.length) {
    return (
      <div className="tl-screen">
        <ScreenHead title={s.savedTitle} />
        <div className="tl-empty">
          <div className="tl-empty__art" aria-hidden="true">
            <span style={{ transform: 'rotate(-5deg)' }} />
            <span style={{ transform: 'rotate(3deg)' }}>★</span>
          </div>
          <div className="tl-empty__title">{s.emptyTitle}</div>
          <div className="tl-empty__text">{s.emptyText}</div>
          <button className="tl-btn-small" onClick={onStart}>{s.startRound}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="tl-screen">
      <ScreenHead title={s.savedTitle} sub={`${cards(s, rows.length)} · ${s.savedHint}`} />
      {cats.length > 1 && (
        <div className="tl-chips" style={{ paddingTop: 0, paddingBottom: 6 }}>
          <button className="tl-chip" aria-pressed={!filter} onClick={() => setFilter(null)}>{s.all}</button>
          {cats.map((c) => (
            <button key={c.id} className="tl-chip" aria-pressed={filter === c.id} onClick={() => setFilter(c.id)}>
              {c.names[lang]}
            </button>
          ))}
        </div>
      )}
      <div className="tl-scroll">
        <div className="tl-list">
          {shown.map((row, i) => {
            const cat = catOf(row);
            const at = savedAt[row[1]];
            const first = i === 0;
            return (
              <div key={row[1]} className={first ? 'tl-item tl-item--hero' : 'tl-item'}>
                <div className="tl-item__label" style={first ? undefined : { color: labelColor(cat.id) }}>{cat.names[lang]}</div>
                <p className="tl-item__q" lang={lang}>{row[2][lang]}</p>
                <div className="tl-item__foot">
                  {first && at && <span className="tl-badge">{fmt(s.savedOn, { date: dateFmt.format(at).toUpperCase() })}</span>}
                  <button className="tl-item__act tl-item__act--share" onClick={() => onShare(row[1])} aria-label={s.ariaShare}>↗</button>
                  <button className="tl-item__act tl-item__act--star" onClick={() => onUnsave(row[1])} aria-label={s.ariaUnsave}>★</button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
