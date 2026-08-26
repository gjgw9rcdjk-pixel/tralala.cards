// Keeps this private moderation page out of search engines — it's gated by
// FEEDBACK_EXPORT_KEY, not indexing, but there's no reason to let it show up
// in results either. metadata exports need a Server Component, so this
// layout just wraps the 'use client' page in app/moderate/page.jsx.

export const metadata = {
  robots: { index: false, follow: false },
};

export default function ModerateLayout({ children }) {
  return children;
}
