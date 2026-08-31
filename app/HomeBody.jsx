import CardGame from './CardGame';
import LandingContent from './LandingContent';
import LandingFooter from './LandingFooter';

// Shared by every language route (app/page.jsx for en, app/lt/page.jsx etc.
// for the rest) — same markup, just seeded with a different starting language.
export default function HomeBody({ lang }) {
  return (
    <>
      <main>
        <section id="play" className="land-play">
          <CardGame initialLang={lang} />
        </section>

        <LandingContent lang={lang} />
      </main>

      <LandingFooter lang={lang} />
    </>
  );
}
