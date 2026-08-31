// Per-language SEO metadata + structured data for the site's language routes:
// / (en), /lt, /de, /es, /it, /pl. Each route renders the same page (see
// app/HomeBody.jsx) with a different starting language — app/page.jsx for en,
// app/lt/page.jsx etc. for the rest.

export const LOCALES = ['en', 'lt', 'de', 'es', 'it', 'pl'];

// '' for en (root) so PATH_BY_LANG[lang] + '/?vibe=...' composes correctly
// wherever it's used — see PATH_BY_LANG usage in app/LandingContent.jsx.
export const PATH_BY_LANG = {
  en: '/',
  lt: '/lt',
  de: '/de',
  es: '/es',
  it: '/it',
  pl: '/pl',
};

const OG_LOCALE = {
  en: 'en_US',
  lt: 'lt_LT',
  de: 'de_DE',
  es: 'es_ES',
  it: 'it_IT',
  pl: 'pl_PL',
};

const TITLE_BY_LANG = {
  en: 'Conversation Cards for Friends, Couples & Groups | Tralala',
  lt: 'Pokalbių kortelės draugams, poroms ir grupėms | Tralala',
  de: 'Gesprächskarten für Freunde, Paare & Gruppen | Tralala',
  es: 'Cartas de Conversación para Amigos y Parejas | Tralala',
  it: 'Carte per conversazioni con amici, coppie e gruppi | Tralala',
  pl: 'Karty do rozmów dla przyjaciół, par i grup | Tralala',
};

// Kept under ~155 characters so Google doesn't truncate mid-sentence in
// search results — see the character counts checked before shipping.
const DESCRIPTION_BY_LANG = {
  en: 'Hundreds of conversation cards and icebreaker questions for friends, couples, parties, teams and road trips. Free to play — no account, no setup.',
  lt: 'Šimtai pokalbių kortelių ir pažinties klausimų draugams, poroms, vakarėliams, komandoms ir kelionėms. Žaisk nemokamai — be paskyros, be nustatymo.',
  de: 'Hunderte Gesprächskarten, Eisbrecherfragen und Gesprächsstarter für Freunde, Paare, Partys, Teams und Roadtrips. Kostenlos spielen — kein Konto nötig.',
  es: 'Cientos de cartas de conversación y preguntas para romper el hielo, para amigos, parejas, fiestas, equipos y viajes. Gratis — sin cuenta ni configuración.',
  it: 'Centinaia di carte per conversazioni e domande rompighiaccio, per amici, coppie, feste, team e viaggi. Gratis — senza account, senza configurazione.',
  pl: 'Setki kart do rozmów i pytań na przełamanie lodów — dla przyjaciół, par, imprez, zespołów i podróży. Graj za darmo — bez konta, bez konfiguracji.',
};

const KEYWORDS_BY_LANG = {
  en: ['conversation cards', 'conversation starters', 'icebreaker questions', 'questions for couples', 'deep questions to ask', 'party games', 'team building questions'],
  lt: ['pokalbių kortelės', 'klausimai porai', 'klausimai draugams', 'gilūs klausimai', 'pažinties žaidimas', 'žaidimas vakarėliui'],
  de: ['gesprächskarten', 'fragen für paare', 'eisbrecher fragen', 'tiefgründige fragen', 'partyspiel fragen', 'teambuilding fragen'],
  es: ['cartas de conversación', 'preguntas para parejas', 'preguntas para romper el hielo', 'preguntas profundas', 'juego de preguntas', 'juegos para fiestas'],
  it: ['carte per conversazioni', 'domande per coppie', 'domande rompighiaccio', 'domande profonde', 'gioco di domande', 'giochi per feste'],
  pl: ['karty do rozmów', 'pytania dla par', 'pytania na przełamanie lodów', 'głębokie pytania', 'gra w pytania', 'gry towarzyskie'],
};

// Single source of truth for the site title/description (English defaults),
// used by the root layout as the site-wide fallback for routes that don't
// set their own metadata (e.g. /moderate).
export const SITE_TITLE = TITLE_BY_LANG.en;
export const SITE_DESCRIPTION = DESCRIPTION_BY_LANG.en;

export function buildMetadata(lang) {
  const title = TITLE_BY_LANG[lang];
  const description = DESCRIPTION_BY_LANG[lang];
  const path = PATH_BY_LANG[lang];

  const languages = { 'x-default': '/' };
  for (const l of LOCALES) languages[l] = PATH_BY_LANG[l];

  return {
    title,
    description,
    keywords: KEYWORDS_BY_LANG[lang],
    alternates: { canonical: path, languages },
    openGraph: {
      title,
      description,
      url: path,
      siteName: 'Tralala.cards',
      type: 'website',
      locale: OG_LOCALE[lang],
    },
    twitter: { card: 'summary_large_image', title, description },
  };
}

export function buildJsonLd(lang) {
  const path = PATH_BY_LANG[lang];
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: 'Tralala',
    url: `https://tralala.cards${path === '/' ? '' : path}`,
    description: DESCRIPTION_BY_LANG[lang],
    applicationCategory: 'LifestyleApplication',
    operatingSystem: 'Any',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    inLanguage: LOCALES,
  };
}
