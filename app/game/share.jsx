'use client';

import { useEffect, useRef, useState } from 'react';
import { QUESTION_BY_ID } from '@/lib/content';
import { PATH_BY_LANG } from '@/lib/seo';
import { renderCard, SURFACES } from '@/lib/shareImage';
import { track } from '@/lib/analytics';
import { Sheet } from './parts';

// Deep link that opens the game on this exact card (handled in Game.jsx).
export function cardLink(id, lang) {
  const path = PATH_BY_LANG[lang] === '/' ? '' : PATH_BY_LANG[lang];
  return `https://tralala.cards${path}/?q=${encodeURIComponent(id)}`;
}

function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Shares a deck card (by `id`), or any other card given as `text` — e.g. a
// /create deck that lives only on this phone. Those have no card link, so
// they point at the site instead and skip the Link format.
export function ShareSheet({ s, lang, id, text: ownText, fromSaved, onClose }) {
  const text = id ? QUESTION_BY_ID.get(id)[2][lang] : ownText;
  const link = id ? cardLink(id, lang) : `https://tralala.cards${PATH_BY_LANG[lang] === '/' ? '' : PATH_BY_LANG[lang] || ''}`;
  const fileName = `tralala-${id || 'card'}.png`;
  const [format, setFormat] = useState(fromSaved ? 'story' : 'square'); // square | story | link
  const [surface, setSurface] = useState('cream');
  const [preview, setPreview] = useState(null);
  const [status, setStatus] = useState('');

  const imageFormat = format === 'link' ? 'square' : format;

  // Images are rendered ahead of the tap: iPhone Safari only opens the share
  // menu if navigator.share() runs right after the tap, so there is no time
  // to draw the PNG then. `ready` holds finished blobs for instant use.
  const pending = useRef(new Map());
  const ready = useRef(new Map());
  const keyOf = (f) => `${f}|${surface}|${text}`;
  const make = (f) => {
    const key = keyOf(f);
    if (!pending.current.has(key)) {
      pending.current.set(key, renderCard({ text, format: f, surface }).then((blob) => {
        if (blob) ready.current.set(key, blob);
        else pending.current.delete(key);
        return blob;
      }));
    }
    return pending.current.get(key);
  };

  useEffect(() => {
    make('square');
    make('story');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [surface, text]);

  useEffect(() => { if (id) track('share_open', { question: id, lang }); }, [id, lang]);

  useEffect(() => {
    let url;
    let live = true;
    make(imageFormat).then((blob) => {
      if (!live || !blob) return;
      url = URL.createObjectURL(blob);
      setPreview(url);
    });
    return () => {
      live = false;
      if (url) URL.revokeObjectURL(url);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [imageFormat, surface, lang, text]);

  const flash = (msg) => {
    setStatus(msg);
    setTimeout(() => setStatus(''), 2200);
  };

  // Opens the phone's share menu with the image (its "Save Image" puts it in
  // Photos). Where that menu can't take files, e.g. desktop, it downloads.
  const shareImage = async (f, withLink = true) => {
    const blob = ready.current.get(keyOf(f)) || await make(f);
    if (!blob) {
      flash(s.shareFailed);
      return;
    }
    const file = new File([blob], fileName, { type: 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share(withLink ? { files: [file], text: link } : { files: [file] });
        return;
      }
    } catch (e) {
      if (e?.name === 'AbortError') return;
    }
    download(blob, file.name);
    flash(s.imageSaved);
  };

  const sendText = async () => {
    const body = `${text}\n\nTralala.cards\n${link}`;
    try {
      if (navigator.share) {
        await navigator.share({ text: body });
        return;
      }
      await navigator.clipboard.writeText(body);
      flash(s.copied);
    } catch (e) {
      if (e?.name !== 'AbortError') flash(s.shareFailed);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      flash(s.copied);
    } catch {
      flash(s.shareFailed);
    }
  };

  const saveImage = () => shareImage(imageFormat, false);

  const targets = [
    ['↗', s.story, () => shareImage('story')],
    ['▣', s.post, () => shareImage('square')],
    ['✉', s.sendT, sendText],
    id && ['⧉', s.linkT, copyLink],
  ].filter(Boolean);

  return (
    <Sheet onClose={onClose} label={s.shareTitle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <h2 className="tl-sheet-title">{s.shareTitle}</h2>
        {fromSaved && <span className="tl-badge" style={{ marginLeft: 'auto' }}>{s.fromSaved}</span>}
      </div>
      <div style={{ display: 'flex', gap: 14, marginTop: 16, alignItems: 'flex-start' }}>
        <div className={`tl-share-preview tl-share-preview--${format === 'story' ? 'story' : 'square'}`}>
          {format === 'link' ? (
            <span className="tl-share-link">{link.replace('https://', '')}</span>
          ) : preview ? (
            <img src={preview} alt={text} />
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="tl-segmented" style={{ marginTop: 0, height: 44 }} role="group">
            {[['square', '1:1'], ['story', '9:16'], id && ['link', s.fmtLink]].filter(Boolean).map(([f, t]) => (
              <button key={f} aria-pressed={format === f} onClick={() => setFormat(f)}>{t}</button>
            ))}
          </div>
          {format !== 'link' && (
            <div className="tl-surface-row">
              <span>{s.surface}</span>
              <span style={{ display: 'flex', gap: 6 }}>
                {Object.entries(SURFACES).map(([k, v]) => (
                  <button
                    key={k}
                    aria-pressed={surface === k}
                    aria-label={k}
                    onClick={() => setSurface(k)}
                    style={{ background: v.bg, border: v.border ? `1px solid ${v.border}` : 'none' }}
                  />
                ))}
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="tl-targets">
        {targets.map(([icon, t, fn]) => (
          <button key={t} onClick={fn}>
            <span aria-hidden="true">{icon}</span>
            <b>{t}</b>
          </button>
        ))}
      </div>
      <button className="tl-btn tl-btn--primary" style={{ marginTop: 12 }} onClick={format === 'link' ? copyLink : saveImage}>
        {status || (format === 'link' ? s.copyLink : s.saveImage)}
      </button>
    </Sheet>
  );
}
