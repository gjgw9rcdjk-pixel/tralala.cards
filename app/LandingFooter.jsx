'use client';

import { LANGUAGES } from '@/lib/content';
import { LANDING } from '@/lib/landingCopy';
import { LOCALES, PATH_BY_LANG } from '@/lib/seo';
import { useLandingLang } from '@/lib/useLandingLang';

const NAME_BY_CODE = Object.fromEntries(LANGUAGES.map((l) => [l.code, l.name]));

// Same cookie as rememberLang() in app/game/Game.jsx. middleware.js sends a
// bare visit to / to the saved language, so without this the "English" link
// would bounce a returning German visitor straight back to /de.
function rememberLang(code) {
  document.cookie = `tl_lang=${code}; path=/; max-age=31536000; samesite=lax`;
}

export default function LandingFooter({ lang: initialLang = 'en' }) {
  const lang = useLandingLang(initialLang);
  const t = LANDING[lang] ?? LANDING.en;

  return (
    <footer className="land-footer">
      <div className="land-wrap">
        {t.footer1}
        <br />
        {t.footer2}
        <br />
        {t.footer3}
        {/* Real links to every language page, in the server HTML, so crawlers
            (which never use the in-game language sheet) can follow them. */}
        <ul className="land-langs">
          {LOCALES.map((code) => (
            <li key={code}>
              <a
                href={PATH_BY_LANG[code]}
                hrefLang={code}
                lang={code}
                onClick={() => rememberLang(code)}
                aria-current={code === initialLang ? 'page' : undefined}
              >
                {NAME_BY_CODE[code]}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
