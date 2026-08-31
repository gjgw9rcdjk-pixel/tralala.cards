import HomeBody from '../HomeBody';
import { buildMetadata, buildJsonLd } from '@/lib/seo';

export const metadata = buildMetadata('pl');

const jsonLd = buildJsonLd('pl');

export default function HomePl() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <HomeBody lang="pl" />
    </>
  );
}
