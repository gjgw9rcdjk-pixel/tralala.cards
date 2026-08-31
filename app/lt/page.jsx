import HomeBody from '../HomeBody';
import { buildMetadata, buildJsonLd } from '@/lib/seo';

export const metadata = buildMetadata('lt');

const jsonLd = buildJsonLd('lt');

export default function HomeLt() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeBody lang="lt" />
    </>
  );
}
