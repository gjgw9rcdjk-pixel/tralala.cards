'use client';

// The TV side of TV mode. Shows a room code until a phone joins, then the
// phone's current card, big and landscape, with the neon flamingo peeking
// over it. No buttons: everything is controlled from the phone.

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CATEGORIES, QUESTION_BY_ID } from '@/lib/content';
import { deckOffset } from '@/lib/gameMeta';
import { GAME_STRINGS, fmt } from '@/lib/gameStrings';
import { joinRoom, newRoomCode, roomPeople } from '@/lib/tvLink';
import { CardTimer, NeonFlamingo, QText } from '@/app/game/parts';
import { TvIcon } from '@/app/game/tv';
import { TV_STRINGS } from './strings';
import '@/app/game/game.css';
import './tv.css';

const ROOM_KEY = 'tralala.tv.room';

function browserLang() {
  const l = (navigator.language || 'en').slice(0, 2);
  return TV_STRINGS[l] ? l : 'en';
}

export default function TvScreen() {
  const [room, setRoom] = useState(null);
  const [state, setState] = useState('connecting'); // connecting | ready | unavailable
  const [phones, setPhones] = useState(0);
  const [card, setCard] = useState(null);
  const [lang, setLang] = useState('en');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => { setLang(browserLang()); }, []);

  useEffect(() => {
    let live = true;
    let link = null;
    (async () => {
      setState('connecting');
      // Keep the code across reloads so a joined phone stays joined.
      let code = sessionStorage.getItem(ROOM_KEY) || newRoomCode();
      try {
        for (let tries = 0; tries < 3; tries += 1) {
          link = await joinRoom(code, 'tv');
          // Another TV already uses this code: pick a fresh one.
          if ((await roomPeople(link.channel)).tv <= 1) break;
          link.close();
          code = newRoomCode();
        }
        if (!live) { link.close(); return; }
        sessionStorage.setItem(ROOM_KEY, code);
        setRoom(code);
        const recount = async () => { if (live) setPhones((await roomPeople(link.channel)).phone); };
        link.channel.presence.subscribe(recount);
        await recount();
        await link.channel.subscribe('card', (msg) => {
          if (!live) return;
          const data = msg.data || {};
          if (data.lang && TV_STRINGS[data.lang]) setLang(data.lang);
          setCard(data.kind === 'idle' ? null : data);
        });
        setState('ready');
      } catch (err) {
        link?.close();
        if (live) setState('unavailable');
      }
    })();
    return () => { live = false; link?.close(); };
  }, [attempt]);

  const t = TV_STRINGS[lang] || TV_STRINGS.en;

  if (state === 'unavailable') {
    return (
      <Frame>
        <div className="tv-wait">
          <p className="tv-wait__title">{t.unavailable}</p>
          <button className="tv-retry" onClick={() => setAttempt((n) => n + 1)}>{t.retry}</button>
        </div>
      </Frame>
    );
  }

  if (!card) {
    return (
      <Frame>
        <div className="tv-wait">
          <div className="tv-wait__flamingo"><NeonFlamingo className="tl-flamingo" /></div>
          <h1 className="tv-wait__title">{t.title}</h1>
          {phones > 0 ? (
            <p className="tv-wait__steps">{t.connected}</p>
          ) : (
            <>
              <p className="tv-wait__steps">{t.steps}</p>
              <div className="tv-code" aria-live="polite">{room || '····'}</div>
            </>
          )}
        </div>
      </Frame>
    );
  }

  return (
    <Frame corner={room && <><TvIcon className="tv-corner__icon" />{t.join} {room}</>}>
      <TvCard card={card} t={t} />
    </Frame>
  );
}

function Frame({ children, corner }) {
  return (
    <div className="tl-shell tv">
      <header className="tv-top">
        <span className="tl-wordmark tl-wordmark--still tv-wordmark">
          Tralala<span className="tl-wordmark__tld">.cards</span>
        </span>
        {corner && <span className="tv-corner">{corner}</span>}
      </header>
      {children}
    </div>
  );
}

function TvCard({ card, t }) {
  const row = card.kind === 'deck' ? QUESTION_BY_ID.get(card.id) : null;
  const text = row ? row[2][card.lang] || row[2].en : card.text || '';
  const cat = row && CATEGORIES.find((c) => c.id === row[0]);
  const label = cat ? cat.names[card.lang] || cat.names.en : card.label;
  const off = cat ? deckOffset(cat.id) : null;
  const tint = off ? { '--offset': `rgba(${off.rgb}, .92)`, '--glow': `rgba(${off.rgb}, .2)`, '--label': off.label } : undefined;

  // Slide in from the side the phone moved towards.
  const last = useRef(card.i);
  const dir = card.i < last.current ? 'back' : 'next';
  useEffect(() => { last.current = card.i; }, [card.i]);

  // Size the question to fill the card: the largest font at which the card
  // keeps its 16:9 shape (or fits the screen, whichever is smaller) and no
  // word sticks out. Capped so a three-word card doesn't turn into a poster.
  const qRef = useRef(null);
  useLayoutEffect(() => {
    const p = qRef.current;
    const box = p?.closest('.tv-stage');
    if (!p || !box) return undefined;
    const fit = () => {
      const cardEl = p.parentElement;
      const fits = (size) => {
        p.style.fontSize = `${size}px`;
        const maxH = Math.min(cardEl.offsetWidth * 9 / 16, box.clientHeight * 0.86);
        return cardEl.offsetHeight <= maxH + 1 && p.scrollWidth <= p.clientWidth + 1;
      };
      let lo = 28;
      let hi = Math.max(lo, Math.round(box.clientHeight * 0.13));
      if (fits(hi)) return;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (fits(mid)) lo = mid; else hi = mid;
      }
      fits(lo);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [text]);

  const s = GAME_STRINGS[card.lang] || GAME_STRINGS.en;
  return (
    <main className="tv-stage">
      <div className="tv-card-wrap" key={`${card.i}-${text}`} data-dir={dir}>
        <div className="tv-peek" aria-hidden="true"><NeonFlamingo className="tl-flamingo" /></div>
        <div className="tl-card tv-card" style={tint}>
          <div className="tl-card__label tv-card__label">
            <span>{label}</span>
            {card.n > 0 && <span className="tv-card__count">{fmt(t.cardOf, { i: card.i, n: card.n })}</span>}
          </div>
          <p ref={qRef} className="tv-card__q" lang={card.lang}><QText text={text} /></p>
        </div>
      </div>
      {card.timer > 0 && <div className="tv-timer"><CardTimer s={s} resetKey={`${card.i}-${text}`} /></div>}
    </main>
  );
}
