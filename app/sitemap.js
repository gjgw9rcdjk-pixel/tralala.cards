import { PATH_BY_LANG, LOCALES } from '@/lib/seo';

// No lastModified: the content has no real per-page modified date, and a
// build-time value would change on every deploy without the page changing.
export default function sitemap() {
  const base = 'https://tralala.cards';
  const urlOf = (lang) => `${base}${PATH_BY_LANG[lang] === '/' ? '' : PATH_BY_LANG[lang]}`;

  const languages = {};
  for (const lang of LOCALES) languages[lang] = urlOf(lang);
  languages['x-default'] = urlOf('en');

  return LOCALES.map((lang) => ({
    url: urlOf(lang),
    changeFrequency: 'weekly',
    priority: lang === 'en' ? 1 : 0.9,
    alternates: { languages },
  }));
}
