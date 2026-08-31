'use client';

import { useEffect, useState } from 'react';
import { savedLang } from './analytics';

// Shared by app/LandingContent.jsx and app/LandingFooter.jsx so the marketing
// copy below the game tracks whatever language is selected inside CardGame.jsx.
// CardGame lives in a separate component tree, so a same-tab CustomEvent
// ('tralala:lang', dispatched from CardGame's chooseLang) is used to notify
// these siblings live — localStorage alone doesn't fire a 'storage' event in
// the tab that wrote it.
export function useLandingLang(initialLang = 'en') {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    const s = savedLang();
    if (s) setLang(s);

    const onLang = (e) => setLang(e.detail);
    window.addEventListener('tralala:lang', onLang);
    return () => window.removeEventListener('tralala:lang', onLang);
  }, []);

  return lang;
}
