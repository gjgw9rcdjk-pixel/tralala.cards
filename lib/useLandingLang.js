'use client';

import { useEffect, useState } from 'react';

// Shared by app/LandingContent.jsx and app/LandingFooter.jsx so the marketing
// copy below the game tracks whatever language is selected inside app/game/Game.jsx.
// The game lives in a separate component tree, so a same-tab CustomEvent
// ('tralala:lang', dispatched from Game's chooseLang) is used to notify
// these siblings live — localStorage alone doesn't fire a 'storage' event in
// the tab that wrote it.
export function useLandingLang(initialLang = 'en') {
  const [lang, setLang] = useState(initialLang);

  useEffect(() => {
    const onLang = (e) => setLang(e.detail);
    window.addEventListener('tralala:lang', onLang);
    return () => window.removeEventListener('tralala:lang', onLang);
  }, []);

  return lang;
}
