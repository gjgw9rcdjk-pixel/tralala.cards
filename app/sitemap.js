import { PATH_BY_LANG, LOCALES } from '@/lib/seo';

export default function sitemap() {
  const base = 'https://tralala.cards';

  const languages = {};
  for (const lang of LOCALES) {
    languages[lang] = `${base}${PATH_BY_LANG[lang] === '/' ? '' : PATH_BY_LANG[lang]}`;
  }

  return LOCALES.map((lang) => ({
    url: languages[lang],
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: lang === 'en' ? 1 : 0.9,
    alternates: { languages },
  }));
}
