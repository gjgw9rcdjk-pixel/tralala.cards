'use client';

import { useEffect, useState } from 'react';
import { SEED_FEEDBACK } from '@/lib/content';
import { submitFeedback, fetchFeedback, voteFeedback } from '@/lib/analytics';

const MAX_LEN = 280;
const BOARD_SIZE = 20;
const DRAFT_KEY = 'tralala.sayDraft';
const VOTES_KEY = 'tralala.feedbackVotes';

function read(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function write(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// Suggestion types offered in the form. 'question' is no longer offered but
// older board items may still carry it, so it keeps a label.
const TYPES = [
  ['idea', 'typeIdea', 'phIdea'],
  ['bug', 'typeBug', 'phBug'],
];
const TYPE_LABEL = { question: 'typeQuestion', idea: 'typeIdea', bug: 'typeBug' };

// Public board: the latest 20 suggestions, each up/down-votable once per device.
function Board({ s, lang, board, isSeed, votes, onVote }) {
  const typeLabel = (t) => (TYPE_LABEL[t] ? s[TYPE_LABEL[t]] : null);
  return (
    <>
      <div className="tl-board-title">{s.boardTitle}</div>
      {isSeed && <div className="tl-note">{s.boardEmpty}</div>}
      {board.map((item) => (
        <div key={item.id} className="tl-item tl-post">
          <div className="tl-post__votes">
            <button onClick={() => onVote(item.id, 'up')} aria-pressed={votes[item.id] === 'up'} aria-label={s.ariaVoteUp}>▲</button>
            <span>{item.up - item.down}</span>
            <button onClick={() => onVote(item.id, 'down')} aria-pressed={votes[item.id] === 'down'} aria-label={s.ariaVoteDown}>▼</button>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            {(isSeed || item.type) && (
              <div className="tl-item__label" style={{ color: 'var(--yellow)', marginBottom: 6 }}>
                {isSeed ? s.exampleTag : typeLabel(item.type)}
              </div>
            )}
            <p className="tl-post__text">{item.text}</p>
          </div>
        </div>
      ))}
    </>
  );
}

export function SayScreen({ s, lang, onPlay }) {
  const [type, setType] = useState('idea');
  const [text, setText] = useState('');
  const [status, setStatus] = useState('idle'); // idle | sending | sent | failed
  const [failReason, setFailReason] = useState('offline'); // offline | limit | server
  const [sentText, setSentText] = useState('');
  const [board, setBoard] = useState([]);
  const [isSeed, setIsSeed] = useState(false);
  const [votes, setVotes] = useState({});

  useEffect(() => {
    const d = read(DRAFT_KEY, null);
    if (d?.text) {
      setText(d.text);
      setType(TYPES.some(([id]) => id === d.type) ? d.type : 'idea');
    }
    setVotes(read(VOTES_KEY, {}));
  }, []);

  // Keeps the draft through reloads and failed sends (offline-first).
  useEffect(() => {
    if (status === 'sent') return;
    write(DRAFT_KEY, text ? { text, type } : null);
  }, [text, type, status]);

  useEffect(() => {
    fetchFeedback().then((items) => {
      if (items && items.length) {
        setBoard(items.slice(0, BOARD_SIZE));
        setIsSeed(false);
      } else {
        setBoard(SEED_FEEDBACK[lang].map((t, i) => ({ id: -(i + 1), text: t, up: 0, down: 0 })));
        setIsSeed(true);
      }
    });
  }, [lang]);

  const send = async () => {
    const trimmed = text.trim();
    if (!trimmed || status === 'sending') return;
    setStatus('sending');
    const res = await submitFeedback(trimmed, { type });
    if (!res || res.error) {
      setFailReason(res?.status === 429 ? 'limit' : res?.status ? 'server' : 'offline');
      setStatus('failed');
      return;
    }
    setBoard((b) => (isSeed ? [res] : [res, ...b].slice(0, BOARD_SIZE)));
    setIsSeed(false);
    setSentText(trimmed);
    setText('');
    write(DRAFT_KEY, null);
    setStatus('sent');
  };

  const vote = (id, kind) => {
    const prev = votes[id] || null;
    const next = prev === kind ? null : kind;
    setVotes((v) => {
      const n = { ...v };
      if (next) n[id] = next;
      else delete n[id];
      write(VOTES_KEY, n);
      return n;
    });
    if (id < 0) {
      // Example items aren't real rows — only the local count moves.
      setBoard((b) => b.map((it) => {
        if (it.id !== id) return it;
        let { up, down } = it;
        if (prev === 'up') up -= 1;
        if (prev === 'down') down -= 1;
        if (next === 'up') up += 1;
        if (next === 'down') down += 1;
        return { ...it, up, down };
      }));
      return;
    }
    voteFeedback(id, next).then((res) => {
      if (res) setBoard((b) => b.map((it) => (it.id === res.id ? { ...it, up: res.up, down: res.down } : it)));
    });
  };

  const board_ = <Board s={s} lang={lang} board={board} isSeed={isSeed} votes={votes} onVote={vote} />;

  if (status === 'sent') {
    return (
      <div className="tl-screen">
        <div className="tl-scroll">
          <div style={{ padding: '30px 28px 8px' }}>
            <div className="tl-card tl-card--green" style={{ padding: '28px 24px' }}>
              <div className="tl-card__label">{s.sentLabel}</div>
              <p className="tl-card__q" style={{ fontSize: 30, lineHeight: 1.12, letterSpacing: '-.03em', margin: '14px 0 12px' }}>{s.thanks}</p>
              <p style={{ margin: 0, font: '500 13.5px/1.55 var(--body)', color: '#494638' }}>“{sentText}” {s.sentNote}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '24px 24px 0' }}>
            <button className="tl-btn tl-btn--primary" onClick={onPlay}>{s.backToPlaying}</button>
            <button className="tl-link-btn" onClick={() => setStatus('idle')}>{s.sendAnother}</button>
          </div>
          <div className="tl-list" style={{ paddingTop: 0 }}>{board_}</div>
        </div>
      </div>
    );
  }

  const placeholder = s[TYPES.find(([id]) => id === type)[2]];

  return (
    <div className="tl-screen">
      <div className="tl-scroll">
        <div style={{ padding: '8px 24px 0' }}>
          <h2 className="tl-title">{s.sayTitle}</h2>
          {status !== 'failed' && <div className="tl-sub">{s.saySub}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '18px 24px 0' }}>
          {status === 'failed' && (
            <div className="tl-error" role="alert">
              <span aria-hidden="true">!</span>
              <span>
                <b>{s.failTitle}</b>
                <small>{{ limit: s.failLimit, server: s.failServer, offline: s.failOffline }[failReason]}</small>
              </span>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }} role="group">
            {TYPES.map(([id, key]) => (
              <button key={id} className="tl-chip" style={{ padding: '10px 14px' }} aria-pressed={type === id} onClick={() => setType(id)}>
                {s[key]}
              </button>
            ))}
          </div>
          <div className="tl-textarea-wrap">
            <textarea
              className="tl-field"
              value={text}
              maxLength={MAX_LEN}
              onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
              placeholder={placeholder}
              aria-label={placeholder}
              lang={lang}
            />
            <span className="tl-counter">{text.length} / {MAX_LEN}</span>
          </div>
          <div className="tl-note">{s.sayNote}</div>
          <button className="tl-btn tl-btn--primary" onClick={send} disabled={!text.trim() || status === 'sending'}>
            {status === 'sending' ? s.sending : status === 'failed' ? s.tryAgain : s.sendBtn}
          </button>
        </div>
        <div className="tl-list">{board_}</div>
      </div>
    </div>
  );
}
