'use client';

import { CATEGORIES } from '@/lib/content';
import { LANDING } from '@/lib/landingCopy';
import { useLandingLang } from '@/lib/useLandingLang';
import { PATH_BY_LANG } from '@/lib/seo';

export default function LandingContent({ lang: initialLang = 'en' }) {
  const lang = useLandingLang(initialLang);
  const t = LANDING[lang] ?? LANDING.en;
  // Vibe links stay on this route's own path (e.g. /lt/?vibe=deep#play) —
  // tied to the page's own language, not whatever the switcher currently
  // shows, so a crawler (which never clicks the switcher) always lands back
  // on the same indexed URL it came from.
  const vibeBasePath = PATH_BY_LANG[initialLang] === '/' ? '' : PATH_BY_LANG[initialLang];

  return (
    <>
      <section className="land-intro">
        <div className="land-wrap land-intro-inner">
          <div className="land-kicker">{t.kicker}</div>
          <h2 className="land-intro-h2">
            {t.h2Line1}<br />{t.h2Line2}
          </h2>
          <p className="land-lede">{t.lede}</p>
          <a className="land-cta" href="#play">{t.cta}</a>
          <div className="land-fineprint">{t.introFine}</div>
        </div>
      </section>

      <section className="land-section" aria-labelledby="vibes-h2">
        <div className="land-wrap">
          <h2 id="vibes-h2" className="land-h2">{t.vibesH2}</h2>
          <div className="land-vibe-grid">
            {CATEGORIES.map((c) => (
              <a key={c.id} className="land-vibe-card" href={`${vibeBasePath}/?vibe=${c.id}#play`}>
                <span className="land-vibe-icon" aria-hidden="true">{c.icon}</span>
                <span className="land-vibe-name">{t.vibes[c.id]?.title}</span>
                <span className="land-vibe-blurb">{t.vibes[c.id]?.blurb}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="land-section" aria-labelledby="about-h2">
        <div className="land-wrap land-narrow">
          <h2 id="about-h2" className="land-h2">{t.aboutH2}</h2>
          <p className="land-p">{t.aboutP1}</p>
          <p className="land-p">{t.aboutP2}</p>
          <p className="land-p">{t.aboutP3}</p>
        </div>
      </section>

      <section className="land-section" aria-labelledby="for-h2">
        <div className="land-wrap">
          <h2 id="for-h2" className="land-h2">{t.forH2}</h2>
          <ul className="land-chip-row">
            {t.perfectFor.map((label) => (
              <li key={label} className="land-chip">{label}</li>
            ))}
          </ul>
        </div>
      </section>

      <section className="land-section land-cta-section">
        <div className="land-wrap">
          <h2 className="land-h2">{t.ctaH2}</h2>
          <a className="land-cta" href="#play">{t.cta}</a>
          <div className="land-fineprint">{t.ctaFine}</div>
        </div>
      </section>
    </>
  );
}
