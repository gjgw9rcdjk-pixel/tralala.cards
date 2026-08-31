'use client';

import { LANDING } from '@/lib/landingCopy';
import { useLandingLang } from '@/lib/useLandingLang';

export default function LandingFooter({ lang: initialLang = 'en' }) {
  const lang = useLandingLang(initialLang);
  const t = LANDING[lang] ?? LANDING.en;

  return (
    <footer className="land-footer">
      <div className="land-wrap">
        {t.footer1}
        <br />
        {t.footer2}
      </div>
    </footer>
  );
}
