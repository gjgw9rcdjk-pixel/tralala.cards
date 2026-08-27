export default function robots() {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: '/moderate' },
    ],
    sitemap: 'https://tralala.cards/sitemap.xml',
  };
}
