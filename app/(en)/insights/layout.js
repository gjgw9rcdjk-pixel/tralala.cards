// Keeps this private analytics page out of search engines — it's gated by
// FEEDBACK_EXPORT_KEY (via /api/analytics), not indexing, but there's no
// reason to let it show up in results either. metadata exports need a
// Server Component, so this layout just wraps the 'use client' page in
// app/insights/page.jsx.

export const metadata = {
  robots: { index: false, follow: false },
};

export default function InsightsLayout({ children }) {
  return children;
}
