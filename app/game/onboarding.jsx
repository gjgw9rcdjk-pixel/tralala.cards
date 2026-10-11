'use client';

import { useEffect, useRef, useState } from 'react';
import { GAME_STRINGS } from '@/lib/gameStrings';
import { NeonFlamingo, Sheet, dragTransform } from './parts';
import { TvIcon } from './tv';

// Audience → decks it deals on the first round (design 14a·04).
export const AUDIENCES = [
  { id: 'friends', key: 'whoFriends', glyph: '♣', color: '#FFC93C', decks: ['union', 'awkward', 'firsts'] },
  { id: 'date', key: 'whoDate', glyph: '♥', color: '#B579FF', decks: ['duo', 'night', 'dnd'] },
  { id: 'family', key: 'whoFamily', glyph: '◆', color: '#3FA9FF', decks: ['know', 'door', 'firsts'] },
  { id: 'work', key: 'whoWork', glyph: '♦', color: '#3AD07A', decks: ['reply', 'union', 'know'] },
];

export function Splash() {
  return (
    <div className="tl-splash" aria-hidden="true">
      {/* Same stack as the home screen and the app icon. */}
      <div className="tl-stack">
        <span className="tl-stack__card tl-stack__card--blue" />
        <span className="tl-stack__card tl-stack__card--yellow" />
        <span className="tl-stack__card tl-stack__card--front"><NeonFlamingo className="tl-flamingo" /></span>
      </div>
      <span className="tl-wordmark" style={{ fontSize: 40, letterSpacing: '-.03em' }}>
        Tralala<span className="tl-wordmark__tld">.cards</span>
      </span>
    </div>
  );
}

// ── tour: five cards you swipe like the game (first START) ──────────────

const TOUR_STEPS = 5;
const TOUR_SWIPE = 70;
// Offset colour per tour card: pink, yellow, blue, green, pink.
const TOUR_OFFSET = ['255,78,125', '255,201,60', '63,169,255', '58,208,122', '255,78,125'];

function TourBody({ step, s }) {
  if (step === 0) {
    return (
      <>
        <div className="tl-card__label">{s.tourPlayLabel}</div>
        <p className="tl-tour__title">{s.tourPlayTitle}</p>
        <p className="tl-tour__body">{s.tourPlayBody}</p>
        <div className="tl-tour__hint" aria-hidden="true">
          <span className="tl-tour__finger" />
          {s.tourPlayHint}
        </div>
      </>
    );
  }
  if (step === 1) {
    return (
      <>
        <div className="tl-card__label">{s.tourSwipeLabel}</div>
        <p className="tl-tour__title">{s.tourSwipeTitle}</p>
        <div className="tl-tour__cross">
          <span className="tl-tour__go" style={{ gridArea: 'up' }}><b>↑</b>{s.tourGoSave}</span>
          <span className="tl-tour__go" style={{ gridArea: 'left' }}><b>←</b>{s.tourGoNext}</span>
          <span className="tl-tour__mini" style={{ gridArea: 'mid' }} aria-hidden="true" />
          <span className="tl-tour__go" style={{ gridArea: 'right' }}><b>→</b>{s.tourGoBack}</span>
          <span className="tl-tour__go" style={{ gridArea: 'down' }}><b>↓</b>{s.tourGoSkip}</span>
        </div>
        <p className="tl-tour__body tl-tour__body--small">{s.tourSwipeTap}</p>
      </>
    );
  }
  if (step === 2) {
    return (
      <>
        <div className="tl-card__label">{s.tourTvLabel}</div>
        <p className="tl-tour__title">{s.tourTvTitle}</p>
        <p className="tl-tour__body">{s.tourTvBody}</p>
        <div className="tl-tour__where">
          <span className="tl-tour__tvbtn" aria-hidden="true"><TvIcon /></span>
          {s.tourTvWhere}
        </div>
      </>
    );
  }
  if (step === 3) {
    return (
      <>
        <div className="tl-tour__labelrow">
          <span className="tl-card__label">{s.tourOwnLabel}</span>
          <span className="tl-badge">{s.soon}</span>
        </div>
        <p className="tl-tour__title">{s.tourOwnTitle}</p>
        <p className="tl-tour__body">{s.tourOwnBody}</p>
        <div className="tl-tour__stack" aria-hidden="true">
          <span /><span /><span><NeonFlamingo className="tl-flamingo" /></span>
        </div>
      </>
    );
  }
  return (
    <>
      <p className="tl-tour__title" style={{ marginTop: 0 }}>{s.obWhoTitle}</p>
      <p className="tl-tour__body" style={{ marginBottom: 0 }}>{s.tourWhoSub}</p>
    </>
  );
}

export function Tour({ lang, onDone }) {
  const [step, setStep] = useState(0);
  const [dir, setDir] = useState('next'); // which side the new card comes from
  const [dx, setDx] = useState(0);
  const drag = useRef(null);
  // Languages without tour texts yet fall back to English.
  const s = { ...GAME_STRINGS.en, ...(GAME_STRINGS[lang] || {}) };
  const last = step === TOUR_STEPS - 1;

  const go = (to) => {
    if (to < 0 || to >= TOUR_STEPS) return;
    setDir(to > step ? 'next' : 'back');
    setStep(to);
    setDx(0);
  };

  // Desktop keyboard, same as the game: → next, ← back.
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'ArrowRight') go(step + 1);
      else if (e.key === 'ArrowLeft') go(step - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  // Swipe left = next, right = back, tap = next (the game's own gestures).
  const onPointerDown = (e) => {
    drag.current = { x: e.clientX, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e) => {
    if (!drag.current) return;
    const d = e.clientX - drag.current.x;
    if (Math.abs(d) > 6) drag.current.moved = true;
    // The last card has nowhere further to go.
    setDx(last && d < 0 ? d / 4 : d);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    const { moved } = drag.current;
    drag.current = null;
    if (!moved) { if (!last) go(step + 1); return; }
    if (dx <= -TOUR_SWIPE && !last) go(step + 1);
    else if (dx >= TOUR_SWIPE && step > 0) go(step - 1);
    else setDx(0);
  };

  const rgb = TOUR_OFFSET[step];
  return (
    <div className="tl-screen tl-tour">
      <div className="tl-ob-top">
        <span className="tl-dots" aria-hidden="true">
          {Array.from({ length: TOUR_STEPS }, (_, i) => <span key={i} data-on={i === step} />)}
        </span>
        <button className="tl-ob-skip" onClick={() => onDone(null)}>{s.obSkip}</button>
      </div>

      <div className={`tl-card-area tl-tour__area${last ? ' tl-tour__area--last' : ''}`}>
        <div
          key={step}
          className="tl-card tl-tour__card"
          data-from={dir}
          role="group"
          aria-roledescription="slide"
          aria-label={`${step + 1} / ${TOUR_STEPS}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          style={{
            '--offset': `rgba(${rgb}, .92)`,
            '--glow': `rgba(${rgb}, .2)`,
            ...(dx ? { transform: dragTransform({ x: dx, y: 0 }), transition: 'none', animation: 'none' } : {}),
          }}
        >
          <TourBody step={step} s={s} />
        </div>
      </div>

      {last ? (
        <div className="tl-tour__who">
          {AUDIENCES.map((a) => (
            <button key={a.id} className="tl-who" onClick={() => onDone({ audience: a.id, decks: a.decks })}>
              <span className="tl-who__glyph" style={{ background: a.color }} aria-hidden="true">{a.glyph}</span>
              <span className="tl-who__name">{s[a.key]}</span>
              <span className="tl-who__go" aria-hidden="true">→</span>
            </button>
          ))}
          <button className="tl-tour__pick" onClick={() => onDone(null)}>{s.tourPickDeck}</button>
        </div>
      ) : (
        <div className="tl-ob-foot">
          <button className="tl-btn tl-btn--primary" onClick={() => go(step + 1)}>{s.next}</button>
        </div>
      )}
    </div>
  );
}

// ── add to home screen (14d·13) ─────────────────────────────────────────

const isIos = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;

// Captures Chrome/Android's install event so the sheet can trigger it later.
export function useInstallPrompt() {
  const [evt, setEvt] = useState(null);
  useEffect(() => {
    const on = (e) => { e.preventDefault(); setEvt(e); };
    window.addEventListener('beforeinstallprompt', on);
    return () => window.removeEventListener('beforeinstallprompt', on);
  }, []);
  // Client-only facts, read after mount so server and client markup match.
  const [env, setEnv] = useState({ installed: false, ios: false });
  useEffect(() => { setEnv({ installed: isStandalone(), ios: isIos() }); }, []);
  // `available`: we can offer a one-tap or step-by-step install (used for the
  // automatic prompt after the first round).
  const available = !env.installed && (!!evt || env.ios);
  return { available, installed: env.installed, ios: env.ios, evt, clear: () => setEvt(null) };
}

export function InstallSheet({ s, ios, evt, onClose, onPromptUsed }) {
  const install = async () => {
    if (evt) {
      evt.prompt();
      try { await evt.userChoice; } catch {}
      onPromptUsed?.(); // the browser's prompt can only be shown once
    }
    onClose();
  };
  return (
    <Sheet onClose={onClose} label={s.installTitle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div className="tl-install-icon" aria-hidden="true">
          <span style={{ background: '#FFC93C', transform: 'rotate(-8deg)', left: 16 }} />
          <span className="tl-install-icon__front">?</span>
        </div>
        <div>
          <h2 className="tl-sheet-title" style={{ lineHeight: 1.1 }}>{s.installTitle}</h2>
          <div className="tl-sub">{s.installSub}</div>
        </div>
      </div>
      {ios ? (
        <div className="tl-install-steps">
          <div><span>1</span>{s.installStep1.split('{icon}')[0]}<b aria-hidden="true">⬆</b>{s.installStep1.split('{icon}')[1]}</div>
          <div><span>2</span>{s.installStep2}</div>
        </div>
      ) : !evt && (
        // No one-tap install in this browser: point to its own menu.
        <div className="tl-install-steps">
          <div><span>1</span>{s.installMenu1.split('{icon}')[0]}<b aria-hidden="true">⋮</b>{s.installMenu1.split('{icon}')[1]}</div>
          <div><span>2</span>{s.installMenu2}</div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
        <button className="tl-btn tl-btn--secondary" style={{ flex: 1, height: 62, fontSize: 14 }} onClick={onClose}>{s.notNow}</button>
        <button className="tl-btn tl-btn--primary" style={{ flex: 1.3, fontSize: 14 }} onClick={evt && !ios ? install : onClose}>
          {evt && !ios ? s.install : s.ok}
        </button>
      </div>
    </Sheet>
  );
}
